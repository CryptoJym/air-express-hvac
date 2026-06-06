export const TURNSTILE_RESPONSE_FIELD = "cf-turnstile-response";

const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_SITE_KEY_ENV_KEYS = Object.freeze([
  "TURNSTILE_SITE_KEY",
  "TURNSTILE_SITEKEY",
  "CLOUDFLARE_TURNSTILE_SITE_KEY",
]);
const TURNSTILE_SECRET_KEY_ENV_KEYS = Object.freeze([
  "TURNSTILE_SECRET_KEY",
  "CLOUDFLARE_TURNSTILE_SECRET_KEY",
]);

function readFirstStringEnv(env, keys) {
  for (const key of keys) {
    const value = typeof env?.[key] === "string" ? env[key].trim() : "";
    if (value) {
      return { key, value };
    }
  }

  return null;
}

export function inspectTurnstileConfig(env = process.env) {
  const siteKey = readFirstStringEnv(env, TURNSTILE_SITE_KEY_ENV_KEYS);
  const secretKey = readFirstStringEnv(env, TURNSTILE_SECRET_KEY_ENV_KEYS);
  const missingKeys = [];

  if (!siteKey) {
    missingKeys.push(TURNSTILE_SITE_KEY_ENV_KEYS[0]);
  }
  if (!secretKey) {
    missingKeys.push(TURNSTILE_SECRET_KEY_ENV_KEYS[0]);
  }

  return Object.freeze({
    configured: missingKeys.length === 0,
    siteKeyConfigured: Boolean(siteKey),
    secretKeyConfigured: Boolean(secretKey),
    missingKeys: Object.freeze(missingKeys),
  });
}

export function loadTurnstileClientConfig(env = process.env) {
  const siteKey = readFirstStringEnv(env, TURNSTILE_SITE_KEY_ENV_KEYS);
  if (!siteKey) {
    return null;
  }

  return Object.freeze({
    siteKey: siteKey.value,
  });
}

export function loadTurnstileServerConfig(env = process.env) {
  const secretKey = readFirstStringEnv(env, TURNSTILE_SECRET_KEY_ENV_KEYS);
  if (!secretKey) {
    return null;
  }

  return Object.freeze({
    secretKey: secretKey.value,
  });
}

export function readTurnstileToken(formData) {
  const token = formData.get(TURNSTILE_RESPONSE_FIELD);
  return typeof token === "string" ? token.trim() : "";
}

export function getRequestIp(request) {
  const cfConnectingIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || "";
}

export async function verifyTurnstileToken(
  token,
  {
    env = process.env,
    remoteIp = "",
    fetchImpl = globalThis.fetch,
  } = {}
) {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken) {
    return {
      success: false,
      reason: "missing_token",
      errorCodes: [],
    };
  }

  const config = loadTurnstileServerConfig(env);
  if (!config) {
    return {
      success: false,
      reason: "not_configured",
      errorCodes: [],
      missingKeys: [TURNSTILE_SECRET_KEY_ENV_KEYS[0]],
    };
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required to verify Turnstile tokens.");
  }

  const body = new URLSearchParams({
    secret: config.secretKey,
    response: normalizedToken,
  });
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetchImpl(TURNSTILE_SITEVERIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Turnstile siteverify request failed with HTTP ${response.status}`);
  }

  const result = await response.json();
  const errorCodes = Array.isArray(result?.["error-codes"]) ? result["error-codes"] : [];

  return {
    success: result?.success === true,
    reason: result?.success === true ? "success" : "verification_failed",
    errorCodes,
    hostname: typeof result?.hostname === "string" ? result.hostname : undefined,
    action: typeof result?.action === "string" ? result.action : undefined,
  };
}

export function jsonResponse(payload, { status = 200 } = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
