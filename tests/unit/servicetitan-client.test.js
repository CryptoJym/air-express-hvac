import assert from "node:assert/strict";
import test from "node:test";

import {
  createServiceTitanClient,
  loadServiceTitanConfig,
} from "../../api/_lib/servicetitan-client.js";

function makeEnv(overrides = {}, namespace = "") {
  return {
    SERVICETITAN_ENV: "integration",
    SERVICETITAN_TENANT_ID: "4378713196",
    SERVICETITAN_APP_KEY: `ak1.test-app-key${namespace}`,
    SERVICETITAN_CLIENT_ID: `cid.test-client-id${namespace}`,
    SERVICETITAN_CLIENT_SECRET: `cs1.test-client-secret${namespace}`,
    ...overrides,
  };
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

test("loadServiceTitanConfig loads integration defaults and required values", () => {
  const config = loadServiceTitanConfig(makeEnv({}, "-config"));

  assert.equal(config.env, "integration");
  assert.equal(config.tenantId, "4378713196");
  assert.equal(config.apiBaseUrl, "https://api-integration.servicetitan.io");
  assert.equal(config.authUrl, "https://auth-integration.servicetitan.io/connect/token");
});

test("createServiceTitanClient exposes a redacted public config shape", () => {
  const client = createServiceTitanClient({
    env: makeEnv({}, "-redacted"),
    fetchImpl: async () => jsonResponse({ access_token: "token", expires_in: 120 }),
  });

  assert.equal(client.config.clientSecret, undefined);
  assert.equal(client.loadConfig().clientSecret, undefined);
  assert.equal(client.config.clientId, "cid.test-client-id-redacted");
});

test("loadServiceTitanConfig supports production mode with URL overrides", () => {
  const config = loadServiceTitanConfig(
    makeEnv(
      {
      SERVICETITAN_ENV: "production",
      SERVICETITAN_API_BASE_URL: "https://api.servicetitan.io/",
      SERVICETITAN_AUTH_URL: "https://auth.servicetitan.io/connect/token",
      },
      "-production"
    )
  );

  assert.equal(config.env, "production");
  assert.equal(config.apiBaseUrl, "https://api.servicetitan.io");
  assert.equal(config.authUrl, "https://auth.servicetitan.io/connect/token");
});

test("loadServiceTitanConfig throws when required env values are missing", () => {
  assert.throws(
    () =>
      loadServiceTitanConfig(
        makeEnv({
          SERVICETITAN_CLIENT_SECRET: "   ",
        }, "-missing")
      ),
    /SERVICETITAN_CLIENT_SECRET/
  );
});

test("createServiceTitanClient rejects invalid token refresh leeway", () => {
  assert.throws(
    () =>
      createServiceTitanClient({
        env: makeEnv({}, "-bad-leeway"),
        tokenRefreshLeewayMs: -1,
        fetchImpl: async () => jsonResponse({ access_token: "token", expires_in: 120 }),
      }),
    /tokenRefreshLeewayMs/
  );
});

test("getAccessToken shares module-scope cache across client instances", async () => {
  let nowMs = 0;
  const authCalls = [];
  const authResponses = [
    jsonResponse({ access_token: "token-1", expires_in: 120 }),
    jsonResponse({ access_token: "token-2", expires_in: 120 }),
  ];

  const env = makeEnv({}, "-shared-cache");
  const clientA = createServiceTitanClient({
    env,
    now: () => nowMs,
    tokenRefreshLeewayMs: 30_000,
    fetchImpl: async (url, init) => {
      authCalls.push({ url, init });
      const response = authResponses.shift();
      if (!response) {
        throw new Error("No auth response configured for test.");
      }
      return response;
    },
  });
  const clientB = createServiceTitanClient({
    env,
    now: () => nowMs,
    tokenRefreshLeewayMs: 30_000,
    fetchImpl: async (url, init) => {
      authCalls.push({ url, init });
      const response = authResponses.shift();
      if (!response) {
        throw new Error("No auth response configured for test.");
      }
      return response;
    },
  });

  const firstToken = await clientA.getAccessToken();
  assert.equal(firstToken, "token-1");
  assert.equal(authCalls.length, 1);

  nowMs = 50_000;
  const secondToken = await clientB.getAccessToken();
  assert.equal(secondToken, "token-1");
  assert.equal(authCalls.length, 1);

  nowMs = 91_000;
  const thirdToken = await clientA.getAccessToken();
  assert.equal(thirdToken, "token-2");
  assert.equal(authCalls.length, 2);
});

test("getAccessToken dedupes concurrent refreshes", async () => {
  let resolveAuth;
  const authCalls = [];

  const client = createServiceTitanClient({
    env: makeEnv({}, "-concurrent"),
    fetchImpl: async (url, init) => {
      authCalls.push({ url, init });
      return new Promise((resolve) => {
        resolveAuth = () => resolve(jsonResponse({ access_token: "token-1", expires_in: 120 }));
      });
    },
  });

  const tokenPromiseA = client.getAccessToken();
  const tokenPromiseB = client.getAccessToken();
  const tokenPromiseC = client.getAccessToken();

  resolveAuth();

  const [tokenA, tokenB, tokenC] = await Promise.all([
    tokenPromiseA,
    tokenPromiseB,
    tokenPromiseC,
  ]);

  assert.equal(authCalls.length, 1);
  assert.equal(tokenA, "token-1");
  assert.equal(tokenB, "token-1");
  assert.equal(tokenC, "token-1");
});

test("getAccessToken surfaces auth JSON errors clearly", async () => {
  const client = createServiceTitanClient({
    env: makeEnv({}, "-auth-error"),
    fetchImpl: async () =>
      jsonResponse(
        { error: "invalid_client", error_description: "client secret rejected" },
        { ok: false, status: 401 }
      ),
  });

  await assert.rejects(client.getAccessToken(), /client secret rejected/);
});

test("authorizedRequest rejects invalid request paths", async () => {
  const client = createServiceTitanClient({
    env: makeEnv({}, "-invalid-path"),
    fetchImpl: async () => jsonResponse({ access_token: "token-auth", expires_in: 120 }),
  });

  await assert.rejects(client.authorizedRequest(""), /pathOrUrl must be a non-empty string/);
});

test("authorizedRequest rejects absolute URLs", async () => {
  const client = createServiceTitanClient({
    env: makeEnv({}, "-absolute-url"),
    fetchImpl: async () => jsonResponse({ access_token: "token-auth", expires_in: 120 }),
  });

  await assert.rejects(
    client.authorizedRequest("https://evil.example.com/crm/v2/tenant/4378713196/leads"),
    /relative ServiceTitan API path/
  );
});

test("authorizedRequest adds auth headers and resolves API-relative paths", async () => {
  let authCallCount = 0;
  let apiCall = null;

  const client = createServiceTitanClient({
    env: makeEnv({}, "-request"),
    fetchImpl: async (url, init) => {
      if (url.includes("/connect/token")) {
        authCallCount += 1;
        return jsonResponse({ access_token: "token-auth", expires_in: 120 });
      }
      apiCall = { url, init };
      return jsonResponse({ ok: true });
    },
  });

  const response = await client.authorizedRequest("/crm/v2/tenant/4378713196/leads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Test": "yes",
    },
    body: JSON.stringify({ test: true }),
  });

  assert.equal(authCallCount, 1);
  assert.equal(apiCall.url, "https://api-integration.servicetitan.io/crm/v2/tenant/4378713196/leads");
  assert.equal(apiCall.init.method, "POST");
  assert.equal(apiCall.init.headers.get("Authorization"), "token-auth");
  assert.equal(apiCall.init.headers.get("ST-App-Key"), "ak1.test-app-key-request");
  assert.equal(apiCall.init.headers.get("X-Test"), "yes");
  assert.equal(response.ok, true);
});
