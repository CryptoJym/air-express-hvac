const SUPPORTED_ENVIRONMENTS = new Set(["integration", "production"]);

const DEFAULT_ENDPOINTS = Object.freeze({
  integration: Object.freeze({
    apiBaseUrl: "https://api-integration.servicetitan.io",
    authUrl: "https://auth-integration.servicetitan.io/connect/token",
  }),
  production: Object.freeze({
    apiBaseUrl: "https://api.servicetitan.io",
    authUrl: "https://auth.servicetitan.io/connect/token",
  }),
});

const DEFAULT_TOKEN_REFRESH_LEEWAY_MS = 30_000;
const MIN_TOKEN_REUSE_WINDOW_MS = 5_000;
const tokenStateByConfigKey = new Map();

function requireString(value, envName) {
  const parsedValue = typeof value === "string" ? value.trim() : "";
  if (!parsedValue) {
    throw new Error(`Missing required environment variable: ${envName}`);
  }
  return parsedValue;
}

function parseEnvironment(value) {
  const parsedValue = requireString(value, "SERVICETITAN_ENV").toLowerCase();
  if (!SUPPORTED_ENVIRONMENTS.has(parsedValue)) {
    throw new Error(
      `Invalid SERVICETITAN_ENV "${parsedValue}". Expected "integration" or "production".`
    );
  }
  return parsedValue;
}

function toAbsoluteUrl(value, envName) {
  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`Invalid URL for ${envName}: ${value}`);
  }
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function resolveApiUrl(baseUrl, pathOrUrl) {
  if (typeof pathOrUrl !== "string" || !pathOrUrl.trim()) {
    throw new Error("pathOrUrl must be a non-empty string.");
  }

  const trimmedPath = pathOrUrl.trim();
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmedPath) || trimmedPath.startsWith("//")) {
    throw new Error("pathOrUrl must be a relative ServiceTitan API path.");
  }

  return new URL(trimmedPath.replace(/^\/+/, ""), `${baseUrl}/`).toString();
}

function calculateRefreshAt(nowMs, expiresInSeconds, refreshLeewayMs) {
  const expiresInMs = expiresInSeconds * 1000;
  const expiresAt = nowMs + expiresInMs;
  const effectiveLeewayMs = Math.min(
    refreshLeewayMs,
    Math.max(0, expiresInMs - MIN_TOKEN_REUSE_WINDOW_MS)
  );
  const refreshAt = expiresAt - effectiveLeewayMs;
  return { refreshAt, expiresAt };
}

function makeConfigKey(config) {
  return [
    config.env,
    config.tenantId,
    config.appKey,
    config.clientId,
    config.authUrl,
    config.apiBaseUrl,
  ].join("|");
}

export function loadServiceTitanConfig(env = process.env) {
  const serviceTitanEnv = parseEnvironment(env.SERVICETITAN_ENV);
  const defaultEndpoints = DEFAULT_ENDPOINTS[serviceTitanEnv];

  const apiBaseUrl = trimTrailingSlash(
    toAbsoluteUrl(
      env.SERVICETITAN_API_BASE_URL?.trim() || defaultEndpoints.apiBaseUrl,
      "SERVICETITAN_API_BASE_URL"
    )
  );

  const authUrl = toAbsoluteUrl(
    env.SERVICETITAN_AUTH_URL?.trim() || defaultEndpoints.authUrl,
    "SERVICETITAN_AUTH_URL"
  );

  return Object.freeze({
    env: serviceTitanEnv,
    tenantId: requireString(env.SERVICETITAN_TENANT_ID, "SERVICETITAN_TENANT_ID"),
    appKey: requireString(env.SERVICETITAN_APP_KEY, "SERVICETITAN_APP_KEY"),
    clientId: requireString(env.SERVICETITAN_CLIENT_ID, "SERVICETITAN_CLIENT_ID"),
    clientSecret: requireString(env.SERVICETITAN_CLIENT_SECRET, "SERVICETITAN_CLIENT_SECRET"),
    apiBaseUrl,
    authUrl,
  });
}

export function createServiceTitanClient({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  tokenRefreshLeewayMs = DEFAULT_TOKEN_REFRESH_LEEWAY_MS,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required to create the ServiceTitan client.");
  }
  if (!Number.isFinite(tokenRefreshLeewayMs) || tokenRefreshLeewayMs < 0) {
    throw new Error("tokenRefreshLeewayMs must be a non-negative finite number.");
  }

  const config = loadServiceTitanConfig(env);
  const publicConfig = Object.freeze({
    env: config.env,
    tenantId: config.tenantId,
    appKey: config.appKey,
    clientId: config.clientId,
    apiBaseUrl: config.apiBaseUrl,
    authUrl: config.authUrl,
  });
  const cacheKey = makeConfigKey(config);

  function getTokenState() {
    let state = tokenStateByConfigKey.get(cacheKey);
    if (!state) {
      state = {
        tokenCache: null,
        inFlightTokenPromise: null,
      };
      tokenStateByConfigKey.set(cacheKey, state);
    }
    return state;
  }

  async function refreshAccessToken() {
    const tokenBody = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    const response = await fetchImpl(config.authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: tokenBody.toString(),
    });

    let tokenPayload;
    try {
      tokenPayload = await response.json();
    } catch {
      throw new Error("ServiceTitan auth response was not valid JSON.");
    }

    if (!response.ok) {
      const authError =
        tokenPayload?.error_description ||
        tokenPayload?.error ||
        `HTTP ${response.status}`;
      throw new Error(`ServiceTitan token request failed: ${authError}`);
    }

    const accessToken = tokenPayload?.access_token;
    const expiresInSeconds = Number(tokenPayload?.expires_in);

    if (!accessToken || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
      throw new Error("ServiceTitan token response did not include valid token fields.");
    }

    const nowMs = now();
    const { refreshAt, expiresAt } = calculateRefreshAt(
      nowMs,
      expiresInSeconds,
      tokenRefreshLeewayMs
    );

    const tokenState = getTokenState();
    tokenState.tokenCache = {
      accessToken,
      refreshAt,
      expiresAt,
    };

    return tokenState.tokenCache.accessToken;
  }

  async function getAccessToken({ forceRefresh = false } = {}) {
    const nowMs = now();
    const tokenState = getTokenState();

    if (!forceRefresh && tokenState.tokenCache && nowMs < tokenState.tokenCache.refreshAt) {
      return tokenState.tokenCache.accessToken;
    }

    if (!tokenState.inFlightTokenPromise) {
      tokenState.inFlightTokenPromise = refreshAccessToken().finally(() => {
        tokenState.inFlightTokenPromise = null;
      });
    }

    return tokenState.inFlightTokenPromise;
  }

  async function authorizedRequest(pathOrUrl, init = {}) {
    const requestUrl = resolveApiUrl(config.apiBaseUrl, pathOrUrl);
    const accessToken = await getAccessToken();
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", accessToken);
    headers.set("ST-App-Key", config.appKey);

    return fetchImpl(requestUrl, {
      ...init,
      headers,
    });
  }

  return {
    config: publicConfig,
    loadConfig: () => publicConfig,
    getAccessToken,
    authorizedRequest,
  };
}

let defaultClient = null;

function getDefaultClient() {
  if (!defaultClient) {
    defaultClient = createServiceTitanClient();
  }
  return defaultClient;
}

export function getServiceTitanConfig() {
  return getDefaultClient().loadConfig();
}

export function getServiceTitanAccessToken(options) {
  return getDefaultClient().getAccessToken(options);
}

export function serviceTitanAuthorizedRequest(pathOrUrl, init) {
  return getDefaultClient().authorizedRequest(pathOrUrl, init);
}
