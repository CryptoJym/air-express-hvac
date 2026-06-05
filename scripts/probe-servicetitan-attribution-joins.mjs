#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createServiceTitanClient, loadServiceTitanConfig } from "../api/_lib/servicetitan-client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "data", "servicetitan-attribution-join-probe.json");

const ENDPOINTS = [
  {
    surface: "CRM export bookings",
    path: (tenant, from) => `/crm/v2/tenant/${tenant}/export/bookings?from=${encodeURIComponent(from)}&includeRecentChanges=true`,
    requiredScope: "CRM > Bookings (Read)",
    sourceDocs: "https://developer.servicetitan.io/docs/apis/tenant-crm-v2/endpoints",
  },
  {
    surface: "JPM export jobs",
    path: (tenant, from) => `/jpm/v2/tenant/${tenant}/export/jobs?from=${encodeURIComponent(from)}&includeRecentChanges=true`,
    requiredScope: "Job Planning and Management > Jobs (Read)",
    sourceDocs: "https://developer.servicetitan.io/docs/apis/tenant-jpm-v2/endpoints/Export_Jobs",
  },
  {
    surface: "Accounting export invoices",
    path: (tenant, from) => `/accounting/v2/tenant/${tenant}/export/invoices?from=${encodeURIComponent(from)}&includeRecentChanges=true`,
    requiredScope: "Accounting > Invoices (Read)",
    sourceDocs: "https://developer.servicetitan.io/docs/apis/tenant-accounting-v2",
  },
  {
    surface: "Accounting export invoice items",
    path: (tenant, from) => `/accounting/v2/tenant/${tenant}/export/invoice-items?from=${encodeURIComponent(from)}&includeRecentChanges=true`,
    requiredScope: "Accounting > Invoice Items (Read)",
    sourceDocs: "https://developer.servicetitan.io/docs/apis/tenant-accounting-v2/endpoints/Export_InvoiceItems",
  },
  {
    surface: "Accounting export payments",
    path: (tenant, from) => `/accounting/v2/tenant/${tenant}/export/payments?from=${encodeURIComponent(from)}&includeRecentChanges=true`,
    requiredScope: "Accounting > Payments (Read)",
    sourceDocs: "https://developer.servicetitan.io/docs/apis/tenant-accounting-v2",
  },
];

const JOIN_FIELD_NAMES = [
  "id",
  "leadId",
  "bookingId",
  "jobId",
  "invoiceId",
  "customerId",
  "locationId",
  "campaignId",
  "leadCallId",
  "partnerLeadCallId",
  "createdOn",
  "modifiedOn",
  "completedOn",
  "status",
  "total",
  "subtotal",
  "balance",
  "amount",
];

const FORBIDDEN_KEY_PATTERNS = [
  /name/i,
  /phone/i,
  /email/i,
  /address/i,
  /street/i,
  /city/i,
  /state/i,
  /zip/i,
  /postal/i,
  /summary/i,
  /note/i,
  /description/i,
  /url/i,
];

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const next = process.argv[index + 1];
  return next && !next.startsWith("--") ? next : fallback;
}

function parseEnvFile(filePath) {
  if (!filePath || !existsSync(filePath)) return {};
  const parsed = {};
  const source = readFileSync(filePath, "utf8");
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith("\"") && value.endsWith("\"")) {
      value = value
        .slice(1, -1)
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, "\"")
        .replace(/\\\\/g, "\\");
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    parsed[match[1]] = value.trim();
  }
  return parsed;
}

function safeError(payload, status) {
  const value = payload?.title || payload?.error || payload?.message || `HTTP ${status}`;
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/access[_-]?token[=:]\s*[^,\s]+/gi, "access_token=[redacted]")
    .slice(0, 300);
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { parseError: "Response was not JSON." };
  }
}

function countTruthy(rows, field) {
  return rows.filter((row) => row && row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== "").length;
}

function numberSum(rows, field) {
  return rows.reduce((total, row) => {
    const value = Number(row?.[field]);
    return Number.isFinite(value) ? total + value : total;
  }, 0);
}

function safeKeys(row = {}) {
  return Object.keys(row)
    .filter((key) => JOIN_FIELD_NAMES.includes(key))
    .sort();
}

function forbiddenKeyHints(row = {}) {
  return Object.keys(row)
    .filter((key) => FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(key)))
    .sort();
}

function summarizeRows(rows) {
  const first = rows[0] || {};
  const numericFields = ["total", "subtotal", "balance", "amount"];
  return {
    rowCount: rows.length,
    safeJoinKeysInFirstRow: safeKeys(first),
    omittedSensitiveKeyHintsInFirstRow: forbiddenKeyHints(first),
    joinFieldPresence: Object.fromEntries(
      JOIN_FIELD_NAMES.map((field) => [field, countTruthy(rows, field)])
    ),
    aggregateNumericFields: Object.fromEntries(
      numericFields.map((field) => [field, numberSum(rows, field)])
    ),
  };
}

async function probeEndpoint(client, config, endpoint, from) {
  const response = await client.authorizedRequest(endpoint.path(config.tenantId, from), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const payload = await readJson(response);
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const base = {
    surface: endpoint.surface,
    status: response.ok ? "readable" : "blocked",
    httpStatus: response.status,
    requiredScope: endpoint.requiredScope,
    sourceDocs: endpoint.sourceDocs,
    hasMore: Boolean(payload.hasMore),
    continueFromPresent: Boolean(payload.continueFrom),
    piiExcluded: true,
  };

  if (!response.ok) {
    return {
      ...base,
      blocker: safeError(payload, response.status),
      nextAction: `Confirm ServiceTitan entitlement for ${endpoint.requiredScope}.`,
    };
  }

  return {
    ...base,
    ...summarizeRows(rows),
    blocker: rows.length
      ? ""
      : "Endpoint is readable but returned no rows for the requested export cursor/date.",
    nextAction: rows.length
      ? "Use safe join keys only; do not store raw rows or customer PII."
      : "Try an earlier export cursor/date or confirm whether this tenant has data on the endpoint.",
  };
}

async function main() {
  const envFile = argValue("--env-file");
  const from = argValue("--from", "2026-01-01");
  const env = { ...process.env, ...parseEnvFile(envFile) };
  const config = loadServiceTitanConfig(env);
  const client = createServiceTitanClient({ env });

  const probes = [];
  for (const endpoint of ENDPOINTS) {
    probes.push(await probeEndpoint(client, config, endpoint, from));
  }

  const readable = probes.filter((probe) => probe.status === "readable");
  const result = {
    generatedAt: new Date().toISOString(),
    evidenceClass: "servicetitan_attribution_join_probe",
    status: readable.length ? "partial_join_surfaces_readable" : "blocked_no_join_surface_readable",
    requested: {
      from,
      endpointCount: ENDPOINTS.length,
    },
    secretHandling:
      "No credential values, access tokens, raw payloads, customer names, phones, emails, addresses, notes, summaries, descriptions, URLs, or line-item text are stored.",
    mutationBoundary:
      "Read-only GET probes only. No ServiceTitan lead, booking, job, invoice, payment, customer, note, export-marker, provider, or production mutation is performed.",
    probes,
    summary: {
      readableSurfaces: readable.map((probe) => probe.surface),
      blockedSurfaces: probes.filter((probe) => probe.status !== "readable").map((probe) => probe.surface),
      recommendedJoinPath:
        readable.some((probe) => probe.surface === "JPM export jobs")
          ? "Use JPM export jobs as the first booking/job/revenue join candidate, then join invoices/payments only if Accounting scopes are readable."
          : "Request JPM Jobs (Read) and Accounting Invoices/Payments (Read), or import an owner-approved redacted export.",
    },
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({
    status: result.status,
    readableSurfaces: result.summary.readableSurfaces,
    blockedSurfaces: result.summary.blockedSurfaces,
    outPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
