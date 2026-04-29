#!/usr/bin/env node

import { resolveMx, resolveTxt } from "node:dns/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const COMMON_DKIM_SELECTORS = Object.freeze(["google", "selector1", "selector2", "default"]);

const DEFAULTS = {
  host: "airexpresshvac.net",
  includeMx: true,
  dkimSelectors: COMMON_DKIM_SELECTORS,
};

function buildResult(name, ok, detail) {
  return { name, ok, detail };
}

export function formatMxRecords(records) {
  return records
    .slice()
    .sort((left, right) => left.priority - right.priority || left.exchange.localeCompare(right.exchange))
    .map((record) => `${record.priority} ${record.exchange}`)
    .join(", ");
}

export function flattenTxtRecords(records) {
  return records.map((parts) => parts.join(""));
}

function formatValue(value, maxLength = 96) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function formatValues(values) {
  return values.map((value) => formatValue(value)).join(" | ");
}

function findRecordWithPrefix(values, prefix) {
  const normalizedPrefix = prefix.toLowerCase();
  return values.find((value) => value.toLowerCase().startsWith(normalizedPrefix));
}

async function resolveTxtValues(dnsImpl, host) {
  const records = await dnsImpl.resolveTxt(host);
  return flattenTxtRecords(records);
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

async function checkSpfRecord(dnsImpl, host) {
  try {
    const values = await resolveTxtValues(dnsImpl, host);
    const spfRecord = findRecordWithPrefix(values, "v=spf1");

    if (!spfRecord) {
      if (!values.length) {
        return buildResult(`SPF for ${host}`, false, "No TXT records returned.");
      }

      return buildResult(`SPF for ${host}`, false, `No SPF TXT record found. TXT values: ${formatValues(values)}`);
    }

    return buildResult(`SPF for ${host}`, true, formatValue(spfRecord));
  } catch (error) {
    return buildResult(
      `SPF for ${host}`,
      false,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function checkDmarcRecord(dnsImpl, host) {
  const dmarcHost = `_dmarc.${host}`;

  try {
    const values = await resolveTxtValues(dnsImpl, dmarcHost);
    const dmarcRecord = findRecordWithPrefix(values, "v=dmarc1");

    if (!dmarcRecord) {
      if (!values.length) {
        return buildResult(`DMARC for ${host}`, false, "No TXT records returned.");
      }

      return buildResult(`DMARC for ${host}`, false, `No DMARC TXT record found. TXT values: ${formatValues(values)}`);
    }

    return buildResult(`DMARC for ${host}`, true, formatValue(dmarcRecord));
  } catch (error) {
    return buildResult(
      `DMARC for ${host}`,
      false,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function checkDkimRecord(dnsImpl, host, selectors) {
  const attemptedSelectors = Array.from(
    new Set(
      (selectors || [])
        .map((selector) => selector.trim())
        .filter(Boolean)
    )
  );

  for (const selector of attemptedSelectors) {
    const dkimHost = `${selector}._domainkey.${host}`;

    try {
      const values = await resolveTxtValues(dnsImpl, dkimHost);
      const dkimRecord = findRecordWithPrefix(values, "v=dkim1");

      if (dkimRecord) {
        return buildResult(`DKIM for ${host}`, true, `Found ${selector}._domainkey (${formatValue(dkimRecord)})`);
      }
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error)) {
        return buildResult(`DKIM for ${host}`, false, error instanceof Error ? error.message : String(error));
      }
    }
  }

  return buildResult(
    `DKIM for ${host}`,
    false,
    `No DKIM TXT record found for selectors: ${attemptedSelectors.join(", ")}.`
  );
}

export async function runEmailAuthVerification(options = {}) {
  const dnsImpl = options.dnsImpl ?? { resolveMx, resolveTxt };
  const config = {
    ...DEFAULTS,
    ...options,
    dkimSelectors: options.dkimSelectors ? [...options.dkimSelectors] : [...DEFAULTS.dkimSelectors],
  };

  const results = [];

  if (config.includeMx) {
    results.push(await checkMxRecords(dnsImpl, config.host));
  }

  results.push(await checkSpfRecord(dnsImpl, config.host));
  results.push(await checkDmarcRecord(dnsImpl, config.host));
  results.push(await checkDkimRecord(dnsImpl, config.host, config.dkimSelectors));

  return results;
}

function parseArgs(argv) {
  const config = {
    ...DEFAULTS,
    dkimSelectors: [...DEFAULTS.dkimSelectors],
  };

  let customDkimSelectors = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--host" && next) {
      config.host = next;
      index += 1;
      continue;
    }

    if (arg === "--skip-mx") {
      config.includeMx = false;
      continue;
    }

    if (arg === "--dkim-selector" && next) {
      if (!customDkimSelectors) {
        config.dkimSelectors = [];
        customDkimSelectors = true;
      }

      config.dkimSelectors.push(next);
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
  console.log(`Usage: npm run verify:email-auth -- [options]

Options:
  --host <hostname>           Domain to verify (default: ${DEFAULTS.host})
  --skip-mx                   Skip MX validation and only verify SPF, DMARC, and DKIM
  --dkim-selector <selector>  DKIM selector to require. Repeat to override common defaults.
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

  const results = await runEmailAuthVerification(config);
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
