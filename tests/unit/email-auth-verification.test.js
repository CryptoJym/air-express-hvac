import assert from "node:assert/strict";
import test from "node:test";

import { runEmailAuthVerification } from "../../scripts/verify-email-auth.mjs";

function createDnsError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

test("runEmailAuthVerification passes when MX, SPF, DMARC, and DKIM are present", async () => {
  const results = await runEmailAuthVerification({
    host: "airexpresshvac.net",
    dnsImpl: {
      resolveMx: async () => [{ exchange: "aspmx.l.google.com", priority: 1 }],
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

        throw createDnsError("ENODATA");
      },
    },
  });

  assert.equal(results.every((result) => result.ok), true);
});

test("runEmailAuthVerification fails when SPF and DKIM are missing", async () => {
  const results = await runEmailAuthVerification({
    host: "airexpresshvac.net",
    dnsImpl: {
      resolveMx: async () => [{ exchange: "aspmx.l.google.com", priority: 1 }],
      resolveTxt: async (host) => {
        if (host === "_dmarc.airexpresshvac.net") {
          return [["v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"]];
        }

        throw createDnsError("ENODATA");
      },
    },
  });

  const failingNames = results.filter((result) => !result.ok).map((result) => result.name);
  assert.deepEqual(failingNames, ["SPF for airexpresshvac.net", "DKIM for airexpresshvac.net"]);
});
