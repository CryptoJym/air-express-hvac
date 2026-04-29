#!/usr/bin/env node

import { resolveMx, resolveNs, resolveTxt } from "node:dns/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runEmailAuthVerification } from "./verify-email-auth.mjs";

const DEFAULTS = {
  siteOrigin: "https://airexpressutah.com",
  wwwOrigin: "https://www.airexpressutah.com",
  legacyOrigin: "https://airexpresshvac.net",
  siteHost: "airexpressutah.com",
  legacyHost: "airexpresshvac.net",
  requireLegacyRedirect: true,
  requireLegacyEmailAuth: true,
  legacyDkimSelectors: [],
};

const LEGACY_PROBE_PATH = "/contact.html?utm_source=cutover-test";

function buildResult(name, ok, detail) {
  return { name, ok, detail };
}

function formatMxRecords(records) {
  return records
    .slice()
    .sort((left, right) => left.priority - right.priority || left.exchange.localeCompare(right.exchange))
    .map((record) => `${record.priority} ${record.exchange}`)
    .join(", ");
}

export function validateGitHubAuthRedirect(locationHeader, siteOrigin) {
  if (!locationHeader) {
    return buildResult("OAuth redirect", false, "Missing Location header.");
  }

  let redirectUrl;
  try {
    redirectUrl = new URL(locationHeader);
  } catch (error) {
    return buildResult(
      "OAuth redirect",
      false,
      `OAuth Location header is not a valid URL: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (redirectUrl.origin !== "https://github.com" || redirectUrl.pathname !== "/login/oauth/authorize") {
    return buildResult(
      "OAuth redirect",
      false,
      `Expected GitHub authorize URL, received ${redirectUrl.origin}${redirectUrl.pathname}.`
    );
  }

  const clientId = redirectUrl.searchParams.get("client_id") || "";
  if (!clientId) {
    return buildResult("OAuth redirect", false, "GitHub OAuth redirect is missing client_id.");
  }

  if (clientId.trim() !== clientId || /[\r\n\t]/.test(clientId)) {
    return buildResult(
      "OAuth redirect",
      false,
      "GitHub OAuth client_id contains unexpected whitespace or control characters."
    );
  }

  const expectedCallback = `${siteOrigin}/api/callback`;
  const actualCallback = redirectUrl.searchParams.get("redirect_uri");
  if (actualCallback !== expectedCallback) {
    return buildResult(
      "OAuth redirect",
      false,
      `Expected redirect_uri ${expectedCallback} but received ${actualCallback || "(missing)"}.`
    );
  }

  return buildResult(
    "OAuth redirect",
    true,
    `GitHub authorize redirect is clean and uses redirect_uri ${expectedCallback}.`
  );
}

export function validateLegacyRedirect(locationHeader, siteOrigin) {
  if (!locationHeader) {
    return buildResult("Legacy redirect", false, "Missing Location header.");
  }

  let redirectUrl;
  try {
    redirectUrl = new URL(locationHeader);
  } catch (error) {
    return buildResult(
      "Legacy redirect",
      false,
      `Legacy redirect Location header is not a valid absolute URL: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (redirectUrl.origin !== siteOrigin) {
    return buildResult(
      "Legacy redirect",
      false,
      `Expected redirect to ${siteOrigin}, received ${redirectUrl.origin}.`
    );
  }

  return buildResult(
    "Legacy redirect",
    true,
    `Legacy web traffic redirects to ${redirectUrl.origin}${redirectUrl.pathname}${redirectUrl.search}.`
  );
}

async function fetchWithManualRedirect(fetchImpl, url) {
  return fetchImpl(url, {
    method: "GET",
    redirect: "manual",
  });
}

async function checkPage(fetchImpl, name, url, acceptableStatuses = [200]) {
  try {
    const response = await fetchWithManualRedirect(fetchImpl, url);
    if (!acceptableStatuses.includes(response.status)) {
      return buildResult(name, false, `Expected HTTP ${acceptableStatuses.join(" or ")}, received ${response.status}.`);
    }

    return buildResult(name, true, `HTTP ${response.status} from ${url}.`);
  } catch (error) {
    return buildResult(
      name,
      false,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function checkNameservers(dnsImpl, siteHost) {
  try {
    const records = await dnsImpl.resolveNs(siteHost);
    if (!records.length) {
      return buildResult(`Nameservers for ${siteHost}`, false, "No NS records returned.");
    }

    return buildResult(`Nameservers for ${siteHost}`, true, records.join(", "));
  } catch (error) {
    return buildResult(
      `Nameservers for ${siteHost}`,
      false,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function checkMxRecords(dnsImpl, host) {
  try {
    const records = await dnsImpl.resolveMx(host);
    if (!records.length) {
      return buildResult(`MX for ${host}`, false, "No MX records returned.");
    }

    return buildResult(`MX for ${host}`, true, formatMxRecords(records));
  } catch (error) {
    return buildResult(
      `MX for ${host}`,
      false,
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function runCutoverVerification(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const dnsImpl = options.dnsImpl ?? { resolveNs, resolveMx, resolveTxt };
  const config = {
    ...DEFAULTS,
    ...options,
    legacyDkimSelectors: options.legacyDkimSelectors ? [...options.legacyDkimSelectors] : [...DEFAULTS.legacyDkimSelectors],
  };

  const results = [];

  results.push(await checkNameservers(dnsImpl, config.siteHost));
  results.push(await checkMxRecords(dnsImpl, config.siteHost));
  results.push(await checkMxRecords(dnsImpl, config.legacyHost));

  if (config.requireLegacyEmailAuth) {
    results.push(
      ...(await runEmailAuthVerification({
        dnsImpl,
        host: config.legacyHost,
        includeMx: false,
        dkimSelectors: config.legacyDkimSelectors.length ? config.legacyDkimSelectors : undefined,
      }))
    );
  }

  results.push(await checkPage(fetchImpl, `Homepage ${config.siteOrigin}`, `${config.siteOrigin}/`));
  results.push(await checkPage(fetchImpl, `Homepage ${config.wwwOrigin}`, `${config.wwwOrigin}/`, [200, 301, 302, 307, 308]));
  results.push(await checkPage(fetchImpl, "Contact page", `${config.siteOrigin}/contact.html`));
  results.push(await checkPage(fetchImpl, "Decap admin", `${config.siteOrigin}/admin/`));

  try {
    const authResponse = await fetchWithManualRedirect(fetchImpl, `${config.siteOrigin}/api/auth`);
    if (authResponse.status !== 302) {
      results.push(
        buildResult("OAuth redirect", false, `Expected HTTP 302 from /api/auth, received ${authResponse.status}.`)
      );
    } else {
      results.push(validateGitHubAuthRedirect(authResponse.headers.get("location"), config.siteOrigin));
    }
  } catch (error) {
    results.push(
      buildResult("OAuth redirect", false, error instanceof Error ? error.message : String(error))
    );
  }

  if (config.requireLegacyRedirect) {
    try {
      const legacyUrl = `${config.legacyOrigin}${LEGACY_PROBE_PATH}`;
      const response = await fetchWithManualRedirect(fetchImpl, legacyUrl);
      if (![301, 302, 307, 308].includes(response.status)) {
        results.push(
          buildResult(
            "Legacy redirect",
            false,
            `Expected HTTP 301/302/307/308 from ${legacyUrl}, received ${response.status}.`
          )
        );
      } else {
        results.push(validateLegacyRedirect(response.headers.get("location"), config.siteOrigin));
      }
    } catch (error) {
      results.push(
        buildResult("Legacy redirect", false, error instanceof Error ? error.message : String(error))
      );
    }
  }

  return results;
}

function parseArgs(argv) {
  const config = {
    ...DEFAULTS,
    legacyDkimSelectors: [...DEFAULTS.legacyDkimSelectors],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--site-origin" && next) {
      config.siteOrigin = next;
      index += 1;
      continue;
    }

    if (arg === "--www-origin" && next) {
      config.wwwOrigin = next;
      index += 1;
      continue;
    }

    if (arg === "--legacy-origin" && next) {
      config.legacyOrigin = next;
      index += 1;
      continue;
    }

    if (arg === "--site-host" && next) {
      config.siteHost = next;
      index += 1;
      continue;
    }

    if (arg === "--legacy-host" && next) {
      config.legacyHost = next;
      index += 1;
      continue;
    }

    if (arg === "--skip-legacy-redirect") {
      config.requireLegacyRedirect = false;
      continue;
    }

    if (arg === "--skip-legacy-email-auth") {
      config.requireLegacyEmailAuth = false;
      continue;
    }

    if (arg === "--legacy-dkim-selector" && next) {
      config.legacyDkimSelectors.push(next);
      index += 1;
      continue;
    }

    if (arg === "--help") {
      config.help = true;
    }
  }

  return config;
}

function printUsage() {
  console.log(`Usage: npm run verify:cutover -- [options]

Options:
  --site-origin <url>         Canonical production origin (default: ${DEFAULTS.siteOrigin})
  --www-origin <url>          WWW origin to probe (default: ${DEFAULTS.wwwOrigin})
  --legacy-origin <url>       Legacy web origin to verify redirect from (default: ${DEFAULTS.legacyOrigin})
  --site-host <hostname>      Hostname for NS/MX lookups (default: ${DEFAULTS.siteHost})
  --legacy-host <hostname>    Legacy hostname for MX lookups (default: ${DEFAULTS.legacyHost})
  --legacy-dkim-selector <s>  DKIM selector for legacy email auth. Repeat to override common defaults.
  --skip-legacy-email-auth    Skip SPF, DMARC, and DKIM verification for the legacy domain
  --skip-legacy-redirect      Skip the legacy domain redirect probe
`);
}

function printResults(results) {
  for (const result of results) {
    const prefix = result.ok ? "PASS" : "FAIL";
    console.log(`${prefix} ${result.name}: ${result.detail}`);
  }
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  if (config.help) {
    printUsage();
    process.exit(0);
  }

  const results = await runCutoverVerification(config);
  printResults(results);

  if (results.some((result) => !result.ok)) {
    process.exit(1);
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (invokedPath === currentFilePath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
}
