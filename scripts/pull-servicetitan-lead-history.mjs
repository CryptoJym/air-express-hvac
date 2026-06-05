#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createServiceTitanClient, loadServiceTitanConfig } from "../api/_lib/servicetitan-client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const outCsvPath = join(root, "data", "servicetitan-api-lead-history-redacted.csv");
const outSummaryPath = join(root, "data", "servicetitan-api-lead-history-summary.json");

const OUTPUT_FIELDS = [
  "source_date",
  "evidence_class",
  "service_titan_lead_id",
  "created_at",
  "modified_at",
  "new_reward_impact_period",
  "campaign_id_or_source",
  "service_type_or_category",
  "lead_status",
  "priority",
  "booked_job_id_if_available",
  "sold_or_revenue_marker_if_approved",
  "capture_source",
  "business_unit_id",
  "job_type_id",
  "call_reason_id",
  "customer_id_present",
  "location_id_present",
  "pii_excluded",
  "source_evidence",
  "blocker",
  "next_action",
];

const IMPACT_PERIODS = [
  {
    id: "before_new_reward_target_brief",
    label: "Before New Reward target brief",
    startDate: "",
    endDate: "2026-03-11",
  },
  {
    id: "target_brief_to_ga4_lead_proof",
    label: "Target brief to GA4/lead proof",
    startDate: "2026-03-12",
    endDate: "2026-04-23",
  },
  {
    id: "after_ga4_lead_proof",
    label: "After GA4/lead proof",
    startDate: "2026-04-24",
    endDate: "",
  },
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
    value = value.trim();
    parsed[match[1]] = value;
  }
  return parsed;
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const string = String(value);
  return /[",\n\r]/.test(string) ? `"${string.replaceAll("\"", "\"\"")}"` : string;
}

function writeCsv(path, rows, headers) {
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${lines.join("\n")}\n`);
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function isoDate(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function isoWeekStart(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function monthKey(value = "") {
  const date = isoDate(value);
  return date ? date.slice(0, 7) : "unknown";
}

function classifyImpactPeriod(createdAt = "") {
  const date = isoDate(createdAt);
  if (!date) return "unclassified_date";
  const period = IMPACT_PERIODS.find((candidate) => {
    const afterStart = !candidate.startDate || date >= candidate.startDate;
    const beforeEnd = !candidate.endDate || date <= candidate.endDate;
    return afterStart && beforeEnd;
  });
  return period?.id || "unclassified_date";
}

function countBy(rows, keyFn) {
  return rows.reduce((counts, row) => {
    const key = keyFn(row) || "unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function sortedObject(object) {
  return Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
}

function normalizeLead(row, env) {
  const campaign = row.campaignId ? String(row.campaignId) : "";
  const captureSource = row.captureSource ? String(row.captureSource) : "";
  const serviceCategory = [
    row.jobTypeId ? `job_type:${row.jobTypeId}` : "",
    row.businessUnitId ? `business_unit:${row.businessUnitId}` : "",
    row.callReasonId ? `call_reason:${row.callReasonId}` : "",
  ].filter(Boolean).join(";") || "not_available";
  const campaignSource = campaign || captureSource || "not_available";
  const bookedId = row.bookingId ? String(row.bookingId) : "";

  return {
    source_date: new Date().toISOString().slice(0, 10),
    evidence_class: "servicetitan_api_lead_history_redacted",
    service_titan_lead_id: row.id ? String(row.id) : "",
    created_at: row.createdOn || "",
    modified_at: row.modifiedOn || "",
    new_reward_impact_period: classifyImpactPeriod(row.createdOn),
    campaign_id_or_source: campaignSource,
    service_type_or_category: serviceCategory,
    lead_status: row.status || "",
    priority: row.priority || "",
    booked_job_id_if_available: bookedId,
    sold_or_revenue_marker_if_approved: "",
    capture_source: captureSource,
    business_unit_id: row.businessUnitId ? String(row.businessUnitId) : "",
    job_type_id: row.jobTypeId ? String(row.jobTypeId) : "",
    call_reason_id: row.callReasonId ? String(row.callReasonId) : "",
    customer_id_present: row.customerId ? "true" : "false",
    location_id_present: row.locationId ? "true" : "false",
    pii_excluded: "true",
    source_evidence: "ServiceTitan CRM v2 GET /leads read-only API",
    blocker: "",
    next_action:
      env.SERVICETITAN_LEAD_CAMPAIGN_ID && campaign !== env.SERVICETITAN_LEAD_CAMPAIGN_ID
        ? "Review whether this non-website campaign belongs in Air Express marketing attribution."
        : "Join safe lead fields to GSC/GA4/GBP periods after Google history is restored.",
  };
}

async function fetchJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { parseError: "ServiceTitan response was not JSON." };
  }
}

async function main() {
  const envFile = argValue("--env-file");
  const startDate = argValue("--start-date", "2026-01-01");
  const endDate = argValue("--end-date", new Date().toISOString().slice(0, 10));
  const pageSize = Number(argValue("--page-size", "100"));
  const maxPages = Number(argValue("--max-pages", "100"));
  const env = { ...process.env, ...parseEnvFile(envFile) };
  const config = loadServiceTitanConfig(env);
  const client = createServiceTitanClient({ env });
  const rows = [];
  const attempts = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const params = new URLSearchParams({
      createdOnOrAfter: `${startDate}T00:00:00Z`,
      createdBefore: `${endDate}T23:59:59Z`,
      pageSize: String(pageSize),
      page: String(page),
    });
    const endpoint = `/crm/v2/tenant/${config.tenantId}/leads?${params.toString()}`;
    const response = await client.authorizedRequest(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const payload = await fetchJson(response);
    attempts.push({
      page,
      status: response.status,
      ok: response.ok,
      rowCount: Array.isArray(payload.data) ? payload.data.length : 0,
      hasMore: Boolean(payload.hasMore),
      totalCount: Number(payload.totalCount || 0),
    });
    if (!response.ok) {
      writeJson(outSummaryPath, {
        generatedAt: new Date().toISOString(),
        evidenceClass: "servicetitan_api_lead_history_redacted",
        status: "blocked_api",
        requestedRange: { startDate, endDate },
        attempts,
        piiExcluded: true,
        secretHandling:
          "No credential values, access tokens, customer names, phones, emails, addresses, lead summaries, lead URLs, or raw payloads are stored.",
        blocker: payload.title || payload.error || `HTTP ${response.status}`,
      });
      throw new Error(`ServiceTitan lead history pull failed with HTTP ${response.status}.`);
    }
    for (const lead of Array.isArray(payload.data) ? payload.data : []) {
      rows.push(normalizeLead(lead, env));
    }
    if (!payload.hasMore) break;
  }

  const websiteCampaignId = env.SERVICETITAN_LEAD_CAMPAIGN_ID || "";
  const websiteCampaignRows = websiteCampaignId
    ? rows.filter((row) => row.campaign_id_or_source === websiteCampaignId)
    : [];
  const bookedRows = rows.filter((row) => row.booked_job_id_if_available);
  const summary = {
    generatedAt: new Date().toISOString(),
    evidenceClass: "servicetitan_api_lead_history_redacted",
    status: "api_history_pulled",
    requestedRange: { startDate, endDate },
    endpoint: "ServiceTitan CRM v2 GET /leads",
    sourceDocs:
      "https://developer.servicetitan.io/docs/apis/tenant-crm-v2/endpoints",
    rows: rows.length,
    pagesFetched: attempts.length,
    reportedTotalCount: attempts.at(-1)?.totalCount || rows.length,
    websiteCampaignIdPresent: Boolean(websiteCampaignId),
    websiteCampaignLeadCount: websiteCampaignRows.length,
    bookedLeadCount: bookedRows.length,
    piiExcluded: true,
    secretHandling:
      "No credential values, access tokens, customer names, phones, emails, street addresses, lead summaries, lead URLs, raw notes, payment data, or raw ServiceTitan payloads are stored.",
    storedFields: OUTPUT_FIELDS,
    excludedFields: [
      "summary",
      "leadUrl",
      "leadCustomerName",
      "leadPhone",
      "leadEmail",
      "leadStreet",
      "leadUnit",
      "leadCity",
      "leadState",
      "leadZip",
      "leadCountry",
      "raw payload",
    ],
    impactPeriods: IMPACT_PERIODS,
    countsByImpactPeriod: sortedObject(countBy(rows, (row) => row.new_reward_impact_period)),
    countsByMonth: sortedObject(countBy(rows, (row) => monthKey(row.created_at))),
    countsByWeek: sortedObject(countBy(rows, (row) => isoWeekStart(row.created_at))),
    countsByStatus: sortedObject(countBy(rows, (row) => row.lead_status)),
    countsByCampaignOrSource: sortedObject(countBy(rows, (row) => row.campaign_id_or_source)),
    websiteCampaignCountsByWeek: sortedObject(countBy(websiteCampaignRows, (row) => isoWeekStart(row.created_at))),
    attempts,
    outputPath: "data/servicetitan-api-lead-history-redacted.csv",
  };

  writeCsv(outCsvPath, rows, OUTPUT_FIELDS);
  writeJson(outSummaryPath, summary);
  console.log(JSON.stringify({
    status: summary.status,
    rows: summary.rows,
    websiteCampaignLeadCount: summary.websiteCampaignLeadCount,
    bookedLeadCount: summary.bookedLeadCount,
    outCsvPath,
    outSummaryPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
