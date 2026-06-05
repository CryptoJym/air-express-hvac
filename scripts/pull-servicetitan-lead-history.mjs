#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createServiceTitanClient, loadServiceTitanConfig } from "../api/_lib/servicetitan-client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const outCsvPath = join(root, "data", "servicetitan-api-lead-history-redacted.csv");
const outSummaryPath = join(root, "data", "servicetitan-api-lead-history-summary.json");
const CAPTCHA_SOURCE_INTRODUCED = Object.freeze({
  date: "2026-06-04",
  timestamp: "2026-06-04T15:21:32-06:00",
  commit: "27cf80099165065e7f5bd0c0ca49d595326c4c44",
  evidence:
    "Git history shows Cloudflare Turnstile source added in commit 27cf800 on 2026-06-04; live delivery remains separately verified.",
});

const OUTPUT_FIELDS = [
  "source_date",
  "evidence_class",
  "service_titan_lead_id",
  "created_at",
  "modified_at",
  "week_start",
  "new_reward_impact_period",
  "captcha_period",
  "captcha_state",
  "campaign_id_or_source",
  "service_type_inferred",
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

function addDays(isoDateValue, days) {
  const date = new Date(`${isoDateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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

function countNested(rows, keyFn, nestedKeyFn) {
  return rows.reduce((counts, row) => {
    const key = keyFn(row) || "unknown";
    const nestedKey = nestedKeyFn(row) || "unknown";
    counts[key] ||= {};
    counts[key][nestedKey] = (counts[key][nestedKey] || 0) + 1;
    return counts;
  }, {});
}

function sortedObject(object) {
  return Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
}

function sortedNestedObject(object) {
  return Object.fromEntries(
    Object.entries(object)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, sortedObject(value)])
  );
}

function classifyCaptchaPeriod(createdAt = "") {
  const date = isoDate(createdAt);
  if (!date) return "unclassified_date";
  return date >= CAPTCHA_SOURCE_INTRODUCED.date
    ? "source_captcha_day_or_after"
    : "before_source_captcha";
}

function captchaState(createdAt = "") {
  const period = classifyCaptchaPeriod(createdAt);
  if (period === "source_captcha_day_or_after") {
    return "source_ready_pending_live_verification";
  }
  if (period === "before_source_captcha") {
    return "pre_captcha_source";
  }
  return "unclassified";
}

function classifyServiceType(row = {}) {
  const summary = String(row.summary || "").toLowerCase();
  const rules = [
    ["emergency_repair", /emergency|urgent|same[ -]?day/],
    ["heat_pump", /heat pump/],
    ["ac_installation", /install.*\bac\b|replace.*\bac\b|air conditioner replacement/],
    ["ac_repair", /\bac\b|a\/c|air conditioning|cooling|no cool|not cooling/],
    ["heating_furnace", /heat|furnace|heater/],
    ["maintenance_tuneup", /maintenance|tune[ -]?up|service plan/],
    ["air_quality", /air quality|duct|filter|iaq|humid|dehumid|ventilat/],
    ["estimate", /estimate|quote/],
    ["other", /other|something else/],
  ];
  return rules.find(([, pattern]) => pattern.test(summary))?.[0] || "unclassified_summary";
}

function qualityProxy(rows) {
  const total = rows.length;
  const statusCounts = sortedObject(countBy(rows, (row) => row.lead_status || "unknown"));
  const dismissed = Number(statusCounts.Dismissed || 0);
  const converted = Number(statusCounts.Converted || 0);
  const open = Number(statusCounts.Open || 0);
  return {
    total,
    dismissed,
    open,
    converted,
    dismissedRate: total ? dismissed / total : 0,
    convertedRate: total ? converted / total : 0,
    interpretation: total
      ? "Status mix is a lead-quality proxy only; booking and revenue joins are outside the current report scope."
      : "No leads in this period, so CAPTCHA quality effect cannot be measured yet.",
  };
}

function weeklyTrend(rows, websiteCampaignRows, startDate, endDate) {
  const observedWeeks = rows.map((row) => row.week_start).filter(Boolean).sort();
  let cursor = observedWeeks[0] || isoWeekStart(startDate);
  const finalWeek = isoWeekStart(endDate);
  const trend = [];

  while (cursor && finalWeek && cursor <= finalWeek) {
    const weekRows = rows.filter((row) => row.week_start === cursor);
    const websiteRows = websiteCampaignRows.filter((row) => row.week_start === cursor);
    trend.push({
      week: cursor,
      totalLeads: weekRows.length,
      websiteCampaignLeads: websiteRows.length,
      captchaPeriod: cursor >= isoWeekStart(CAPTCHA_SOURCE_INTRODUCED.date)
        ? "source_captcha_week_or_after"
        : "before_source_captcha_week",
      serviceTypes: sortedObject(countBy(weekRows, (row) => row.service_type_inferred)),
      statuses: sortedObject(countBy(weekRows, (row) => row.lead_status)),
    });
    cursor = addDays(cursor, 7);
  }

  return trend;
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
    week_start: isoWeekStart(row.createdOn),
    new_reward_impact_period: classifyImpactPeriod(row.createdOn),
    captcha_period: classifyCaptchaPeriod(row.createdOn),
    captcha_state: captchaState(row.createdOn),
    campaign_id_or_source: campaignSource,
    service_type_inferred: classifyServiceType(row),
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
  const rowsByCaptchaPeriod = {
    before_source_captcha: rows.filter((row) => row.captcha_period === "before_source_captcha"),
    source_captcha_day_or_after: rows.filter((row) => row.captcha_period === "source_captcha_day_or_after"),
  };
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
    captcha: {
      ...CAPTCHA_SOURCE_INTRODUCED,
      liveStatus: "source_added_live_turnstile_env_or_canonical_delivery_pending",
      interpretation:
        "Use this as the source-code marker only. Current live checks show the public CAPTCHA config is not healthy on the active delivery paths, and there are no leads on/after the source date, so do not claim CAPTCHA changed lead quality yet.",
    },
    piiExcluded: true,
    secretHandling:
      "No credential values, access tokens, customer names, phones, emails, street addresses, lead summaries, lead URLs, raw notes, payment data, or raw ServiceTitan payloads are stored.",
    summaryTextHandling:
      "ServiceTitan summary text is read only for fixed keyword classification into service_type_inferred. Raw summary text is not printed or stored.",
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
    countsByCaptchaPeriod: Object.fromEntries(
      Object.entries(rowsByCaptchaPeriod).map(([period, periodRows]) => [period, periodRows.length])
    ),
    countsByCaptchaPeriodStatus: sortedNestedObject(countNested(rows, (row) => row.captcha_period, (row) => row.lead_status)),
    qualityProxyByCaptchaPeriod: Object.fromEntries(
      Object.entries(rowsByCaptchaPeriod)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, periodRows]) => [period, qualityProxy(periodRows)])
    ),
    countsByMonth: sortedObject(countBy(rows, (row) => monthKey(row.created_at))),
    countsByWeek: sortedObject(countBy(rows, (row) => isoWeekStart(row.created_at))),
    completeWeeklyTrend: weeklyTrend(rows, websiteCampaignRows, startDate, endDate),
    countsByStatus: sortedObject(countBy(rows, (row) => row.lead_status)),
    countsByServiceType: sortedObject(countBy(rows, (row) => row.service_type_inferred)),
    websiteCampaignCountsByServiceType: sortedObject(countBy(websiteCampaignRows, (row) => row.service_type_inferred)),
    countsByWeekServiceType: sortedNestedObject(countNested(rows, (row) => row.week_start, (row) => row.service_type_inferred)),
    countsByWeekStatus: sortedNestedObject(countNested(rows, (row) => row.week_start, (row) => row.lead_status)),
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
