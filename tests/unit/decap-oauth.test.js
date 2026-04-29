import assert from "node:assert/strict";
import test from "node:test";

import * as authModule from "../../api/auth.js";
import * as callbackModule from "../../api/callback.js";

function withEnv(overrides) {
  const previous = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

test("oauth handlers use root /api edge function exports", () => {
  assert.equal(typeof authModule.default, "function");
  assert.equal(authModule.config?.runtime, "edge");
  assert.equal("GET" in authModule, false);

  assert.equal(typeof callbackModule.default, "function");
  assert.equal(callbackModule.config?.runtime, "edge");
  assert.equal("GET" in callbackModule, false);
});

test("oauth handlers reject non-GET methods", async () => {
  const authResponse = await authModule.default(
    new Request("https://airexpressutah.com/api/auth", { method: "POST" })
  );
  assert.equal(authResponse.status, 405);
  assert.equal(authResponse.headers.get("allow"), "GET");

  const callbackResponse = await callbackModule.default(
    new Request("https://airexpressutah.com/api/callback", { method: "POST" })
  );
  assert.equal(callbackResponse.status, 405);
  assert.equal(callbackResponse.headers.get("allow"), "GET");
});

test("auth handler returns 500 json when client id is missing", async () => {
  const restoreEnv = withEnv({
    OAUTH_GITHUB_CLIENT_ID: undefined,
  });

  try {
    const response = await authModule.default(new Request("https://airexpressutah.com/api/auth"));
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("content-type"), "application/json");
    const payload = await response.json();
    assert.match(payload.error, /OAUTH_GITHUB_CLIENT_ID/i);
  } finally {
    restoreEnv();
  }
});

test("auth handler issues github redirect and state cookie", async () => {
  const restoreEnv = withEnv({
    OAUTH_GITHUB_CLIENT_ID: "github-client-id",
  });

  try {
    const response = await authModule.default(new Request("https://airexpressutah.com/api/auth"));
    assert.equal(response.status, 302);

    const location = response.headers.get("location");
    assert.ok(location);
    const authorizeUrl = new URL(location);
    assert.equal(authorizeUrl.origin, "https://github.com");
    assert.equal(authorizeUrl.pathname, "/login/oauth/authorize");
    assert.equal(
      authorizeUrl.searchParams.get("redirect_uri"),
      "https://airexpressutah.com/api/callback"
    );

    const stateFromLocation = authorizeUrl.searchParams.get("state");
    assert.ok(stateFromLocation);

    const setCookie = response.headers.get("set-cookie");
    assert.ok(setCookie);
    assert.match(setCookie, /decap_oauth_state=/);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);
    assert.match(setCookie, /Secure/);

    const cookieState = /decap_oauth_state=([^;]+)/.exec(setCookie)?.[1];
    assert.equal(cookieState, stateFromLocation);
  } finally {
    restoreEnv();
  }
});

test("callback handler rejects mismatched state cookie", async () => {
  const restoreEnv = withEnv({
    OAUTH_GITHUB_CLIENT_ID: "github-client-id",
    OAUTH_GITHUB_CLIENT_SECRET: "github-client-secret",
  });

  try {
    const response = await callbackModule.default(
      new Request("https://airexpressutah.com/api/callback?code=abc123&state=expected-state", {
        headers: {
          cookie: "decap_oauth_state=wrong-state",
        },
      })
    );

    assert.equal(response.status, 403);
    assert.match(response.headers.get("content-type"), /text\/html/);
    const html = await response.text();
    assert.match(html, /authorization:github:error/);
    assert.match(html, /State mismatch/i);
  } finally {
    restoreEnv();
  }
});

test("callback handler exchanges code and returns decap success payload", async () => {
  const restoreEnv = withEnv({
    OAUTH_GITHUB_CLIENT_ID: "github-client-id",
    OAUTH_GITHUB_CLIENT_SECRET: "github-client-secret",
  });
  const originalFetch = globalThis.fetch;
  const fetchCalls = [];

  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    fetchCalls.push({ url, init });

    if (url === "https://github.com/login/oauth/access_token") {
      return new Response(JSON.stringify({ access_token: "token-abc" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const response = await callbackModule.default(
      new Request("https://airexpressutah.com/api/callback?code=abc123&state=expected-state", {
        headers: {
          cookie: "decap_oauth_state=expected-state",
        },
      })
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "https://github.com/login/oauth/access_token");
    assert.equal(fetchCalls[0].init.method, "POST");
    assert.equal(
      fetchCalls[0].init.headers["Content-Type"],
      "application/x-www-form-urlencoded"
    );
    assert.match(fetchCalls[0].init.body, /client_id=github-client-id/);
    assert.match(fetchCalls[0].init.body, /client_secret=github-client-secret/);
    assert.match(fetchCalls[0].init.body, /code=abc123/);
    assert.match(
      fetchCalls[0].init.body,
      /redirect_uri=https%3A%2F%2Fairexpressutah\.com%2Fapi%2Fcallback/
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.match(response.headers.get("set-cookie"), /decap_oauth_state=/);
    assert.match(response.headers.get("set-cookie"), /Max-Age=0/);

    const html = await response.text();
    assert.match(html, /authorization:github:success/);
    assert.match(html, /token-abc/);
    assert.match(html, /"provider":"github"/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});
