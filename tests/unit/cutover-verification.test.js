import assert from "node:assert/strict";
import test from "node:test";

import {
  runCutoverVerification,
  validateGitHubAuthRedirect,
  validateLegacyRedirect,
} from "../../scripts/verify-cutover.mjs";

test("validateGitHubAuthRedirect accepts a clean GitHub OAuth redirect", () => {
  const result = validateGitHubAuthRedirect(
    "https://github.com/login/oauth/authorize?client_id=abc123&redirect_uri=https%3A%2F%2Fairexpressutah.com%2Fapi%2Fcallback&scope=repo%2Cuser&state=token",
    "https://airexpressutah.com"
  );

  assert.equal(result.ok, true);
  assert.match(result.detail, /redirect_uri/i);
});

test("validateGitHubAuthRedirect rejects control characters in the client id", () => {
  const result = validateGitHubAuthRedirect(
    "https://github.com/login/oauth/authorize?client_id=abc123%0A&redirect_uri=https%3A%2F%2Fairexpressutah.com%2Fapi%2Fcallback&scope=repo%2Cuser&state=token",
    "https://airexpressutah.com"
  );

  assert.equal(result.ok, false);
  assert.match(result.detail, /client_id/i);
});

test("validateLegacyRedirect accepts redirects to the canonical site", () => {
  const result = validateLegacyRedirect(
    "https://airexpressutah.com/contact.html?utm_source=cutover-test",
    "https://airexpressutah.com"
  );

  assert.equal(result.ok, true);
});

test("runCutoverVerification reports all required checks as passing for a healthy launch state", async () => {
  const fetchCalls = [];
  const fetchImpl = async (url) => {
    fetchCalls.push(url.toString());

    if (url === "https://airexpressutah.com/") {
      return new Response("", { status: 200 });
    }

    if (url === "https://www.airexpressutah.com/") {
      return new Response("", { status: 200 });
    }

    if (url === "https://airexpressutah.com/contact.html") {
      return new Response("", { status: 200 });
    }

    if (url === "https://airexpressutah.com/admin/") {
      return new Response("", { status: 200 });
    }

    if (url === "https://airexpressutah.com/api/auth") {
      return new Response(null, {
        status: 302,
        headers: {
          Location:
            "https://github.com/login/oauth/authorize?client_id=abc123&redirect_uri=https%3A%2F%2Fairexpressutah.com%2Fapi%2Fcallback&scope=repo%2Cuser&state=token",
        },
      });
    }

    if (url === "https://airexpresshvac.net/contact.html?utm_source=cutover-test") {
      return new Response(null, {
        status: 308,
        headers: {
          Location: "https://airexpressutah.com/contact.html?utm_source=cutover-test",
        },
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  const dnsImpl = {
    resolveNs: async (host) => {
      assert.equal(host, "airexpressutah.com");
      return ["ns1.cloudflare.com", "ns2.cloudflare.com"];
    },
    resolveMx: async (host) => {
      if (host === "airexpressutah.com") {
        return [{ exchange: "aspmx.l.google.com", priority: 1 }];
      }

      if (host === "airexpresshvac.net") {
        return [{ exchange: "aspmx.l.google.com", priority: 1 }];
      }

      throw new Error(`Unexpected MX lookup: ${host}`);
    },
    resolveTxt: async (host) => {
      if (host === "airexpresshvac.net") {
        return [["v=spf1 include:_spf.google.com ~all"]];
      }

      if (host === "_dmarc.airexpresshvac.net") {
        return [["v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"]];
      }

      if (host === "google._domainkey.airexpresshvac.net") {
        return [["v=DKIM1; k=rsa; p=abc123"]];
      }

      throw new Error(`Unexpected TXT lookup: ${host}`);
    },
  };

  const results = await runCutoverVerification({
    fetchImpl,
    dnsImpl,
  });

  assert.equal(results.every((result) => result.ok), true);
  assert.deepEqual(fetchCalls, [
    "https://airexpressutah.com/",
    "https://www.airexpressutah.com/",
    "https://airexpressutah.com/contact.html",
    "https://airexpressutah.com/admin/",
    "https://airexpressutah.com/api/auth",
    "https://airexpresshvac.net/contact.html?utm_source=cutover-test",
  ]);
});

test("runCutoverVerification surfaces missing legacy SPF and DKIM before cutover is considered healthy", async () => {
  const fetchImpl = async (url) => {
    if (url === "https://airexpressutah.com/") {
      return new Response("", { status: 200 });
    }

    if (url === "https://www.airexpressutah.com/") {
      return new Response("", { status: 200 });
    }

    if (url === "https://airexpressutah.com/contact.html") {
      return new Response("", { status: 200 });
    }

    if (url === "https://airexpressutah.com/admin/") {
      return new Response("", { status: 200 });
    }

    if (url === "https://airexpressutah.com/api/auth") {
      return new Response(null, {
        status: 302,
        headers: {
          Location:
            "https://github.com/login/oauth/authorize?client_id=abc123&redirect_uri=https%3A%2F%2Fairexpressutah.com%2Fapi%2Fcallback&scope=repo%2Cuser&state=token",
        },
      });
    }

    if (url === "https://airexpresshvac.net/contact.html?utm_source=cutover-test") {
      return new Response(null, {
        status: 308,
        headers: {
          Location: "https://airexpressutah.com/contact.html?utm_source=cutover-test",
        },
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  const dnsImpl = {
    resolveNs: async () => ["ns1.cloudflare.com", "ns2.cloudflare.com"],
    resolveMx: async (host) => [{ exchange: "aspmx.l.google.com", priority: host === "airexpressutah.com" ? 1 : 5 }],
    resolveTxt: async (host) => {
      if (host === "_dmarc.airexpresshvac.net") {
        return [["v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"]];
      }

      throw new Error(`Unexpected TXT lookup: ${host}`);
    },
  };

  const results = await runCutoverVerification({
    fetchImpl,
    dnsImpl,
  });

  const failingNames = results.filter((result) => !result.ok).map((result) => result.name);

  assert.deepEqual(failingNames, ["SPF for airexpresshvac.net", "DKIM for airexpresshvac.net"]);
});
