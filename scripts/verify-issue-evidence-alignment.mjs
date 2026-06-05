#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const outPath = path.join(rootDir, "data", "issue-evidence-alignment-check.json");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  const [headers, ...records] = rows;
  if (!headers?.length) {
    throw new Error("CSV is missing a header row.");
  }

  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""]))
  );
}

function includesAll(source, terms) {
  const haystack = String(source || "").toLowerCase();
  return terms.every((term) => haystack.includes(String(term).toLowerCase()));
}

const completionRows = parseCsv(read("data/issue-24-30-completion-audit.csv"));
const acceptanceRows = parseCsv(read("data/issue-24-30-acceptance-criteria-audit.csv"));
const completionByIssue = new Map(completionRows.map((row) => [row.issue, row]));

const liveMeasurement = readJson("data/live-measurement-path-check.json");
const deliverySync = readJson("data/owned-site-delivery-sync-check.json");
const historyStatus = readJson("data/google-history/history-pull-status.json");
const mappingStatus = readJson("data/newreward-air-express-provider-readonly-recheck.json");
const serviceTitanStatus = readJson("data/servicetitan-export-access-check.json");
const serviceTitanLeadSummary = readJson("data/servicetitan-api-lead-history-summary.json");
const serviceTitanJoinProbe = readJson("data/servicetitan-attribution-join-probe.json");

const expectedCompletion = {
  "#24": { status: "open", completion_state: "parent_incomplete" },
  "#25": { status: "closed", completion_state: "completed_verified" },
  "#26": { status: "open", completion_state: "partial_mapping_found_provider_mixed" },
  "#27": { status: "open", completion_state: "blocked_local_token_scope_and_provider_reconnect" },
  "#28": { status: "open", completion_state: liveMeasurement.status },
  "#29": { status: "open", completion_state: "prepared_blocked_by_data_access" },
  "#30": { status: "open", completion_state: "partial_api_history_pulled_lead_path_review" },
};

const checks = [];

function check(id, passed, evidence, nextAction = "") {
  checks.push({
    id,
    status: passed ? "passed" : "failed",
    evidence,
    nextAction,
  });
}

for (const [issue, expected] of Object.entries(expectedCompletion)) {
  const row = completionByIssue.get(issue);
  check(
    `${issue}-completion-state`,
    Boolean(row) && row.status === expected.status && row.completion_state === expected.completion_state,
    row
      ? `${issue} row status=${row.status}, completion_state=${row.completion_state}; expected ${expected.status}/${expected.completion_state}.`
      : `${issue} row is missing.`,
    `Update data/issue-24-30-completion-audit.csv for ${issue}.`
  );
}

const row26 = completionByIssue.get("#26") || {};
const gscRootCause = mappingStatus.rootCauseSummary?.gsc || {};
const ga4RootCause = mappingStatus.rootCauseSummary?.ga4 || {};
check(
  "#26-mapping-json-alignment",
  mappingStatus.status === "rows_found" &&
    mappingStatus.targetedLookup?.clients?.[0]?.primaryWebsiteId === "cmorqbs9j001r5nr1h25vosp8" &&
    gscRootCause.credentialStatus === "revoked" &&
    gscRootCause.connectionStatus === "error" &&
    ga4RootCause.credentialStatus === "expired" &&
    ga4RootCause.connectionStatus === "EXPIRED" &&
    ga4RootCause.propertyId === "" &&
    includesAll(row26.current_evidence, ["rows_found", "cmorqbs9j001r5nr1h25vosp8", "revoked", "EXPIRED", "propertyId null"]) &&
    includesAll(row26.remaining_blocker, ["SEO workspace", "propertyId", "read scopes"]),
  `mappingStatus.status=${mappingStatus.status}; #26 evidence=${row26.current_evidence || ""}`,
  "Refresh the mapping verifier and #26 matrix row together."
);

const row27 = completionByIssue.get("#27") || {};
check(
  "#27-google-scope-alignment",
  historyStatus.status === "blocked" &&
    historyStatus.gsc?.status === "blocked_local_token_scope" &&
    historyStatus.ga4?.status === "blocked_local_token_scope" &&
    historyStatus.gbp?.status === "not_included" &&
    includesAll(row27.current_evidence, ["webmasters.readonly", "analytics.readonly", "not_included", "revoked", "expired", "propertyId null"]),
  `history status=${historyStatus.status}; gsc=${historyStatus.gsc?.status}; ga4=${historyStatus.ga4?.status}; gbp=${historyStatus.gbp?.status}`,
  "Refresh the Google history pull and #27 matrix row together."
);

const row28 = completionByIssue.get("#28") || {};
const liveMeasurementDeliveryOpenStates = new Set([
  "fixed_locally_pending_live",
  "partial_live_www_only_canonical_pending",
]);
check(
  "#28-live-delivery-alignment",
  liveMeasurementDeliveryOpenStates.has(liveMeasurement.status) &&
    deliverySync.status === "pending_delivery_sync" &&
    includesAll(row28.current_evidence, [liveMeasurement.status, "pending_delivery_sync", "G-JZ7PY32EVX"]) &&
    includesAll(row28.remaining_blocker, ["canonical", "sync"]),
  `liveMeasurement.status=${liveMeasurement.status}; deliverySync.status=${deliverySync.status}`,
  "Refresh live measurement, delivery sync, and #28 matrix row together."
);

const row29 = completionByIssue.get("#29") || {};
check(
  "#29-impact-report-alignment",
  historyStatus.status === "blocked" &&
    includesAll(row29.current_evidence, ["blocked state", "GSC", "GA4", "ServiceTitan", "CAPTCHA"]) &&
    includesAll(row29.remaining_blocker, ["read scopes", "provider"]),
  `historyStatus.status=${historyStatus.status}; #29 evidence=${row29.current_evidence || ""}`,
  "Refresh the history pull/report and #29 matrix row together."
);

const row30 = completionByIssue.get("#30") || {};
check(
  "#30-servicetitan-alignment",
  serviceTitanStatus.status === "auth_ready_no_export" &&
    serviceTitanLeadSummary.status === "api_history_pulled" &&
    Number(serviceTitanLeadSummary.rows || 0) === 78 &&
    Number(serviceTitanLeadSummary.websiteCampaignLeadCount || 0) === 76 &&
    serviceTitanLeadSummary.captcha?.date === "2026-06-04" &&
    serviceTitanLeadSummary.completeWeeklyTrend?.some((week) => week.week === "2026-05-25" && Number(week.totalLeads || 0) === 0) &&
    serviceTitanLeadSummary.completeWeeklyTrend?.some((week) => week.week === "2026-06-01" && Number(week.totalLeads || 0) === 0) &&
    includesAll(row30.current_evidence, ["api_history_pulled", "78", "76", "redacted", "CAPTCHA"]) &&
    includesAll(row30.remaining_blocker, ["Turnstile", "canonical"]) &&
    includesAll(row30.remaining_blocker, ["out of scope"]),
  `serviceTitanStatus.status=${serviceTitanStatus.status}; serviceTitanLeadSummary.status=${serviceTitanLeadSummary.status}; joinProbe.status=${serviceTitanJoinProbe.status}; #30 evidence=${row30.current_evidence || ""}`,
  "Refresh ServiceTitan lead history and #30 matrix row together."
);

const acceptanceByIssue = new Map();
for (const row of acceptanceRows) {
  acceptanceByIssue.set(row.issue, [...(acceptanceByIssue.get(row.issue) || []), row]);
}

check(
  "#25-acceptance-closure",
  (acceptanceByIssue.get("#25") || []).length > 0 &&
    acceptanceByIssue.get("#25").every((row) => row.closure_ready === "true"),
  "#25 acceptance rows must all remain closure_ready=true.",
  "Do not reopen #25 unless new resolver-code evidence appears."
);

for (const issue of ["#24", "#26", "#27", "#28", "#29", "#30"]) {
  const rows = acceptanceByIssue.get(issue) || [];
  check(
    `${issue}-acceptance-open-gate`,
    rows.length > 0 && rows.some((row) => row.closure_ready === "false"),
    `${issue} acceptance rows=${rows.length}; non-closure-ready rows=${rows.filter((row) => row.closure_ready === "false").length}.`,
    `Keep ${issue} open until every criterion has direct proof.`
  );
}

const failures = checks.filter((row) => row.status === "failed");
const result = {
  generatedAt: new Date().toISOString(),
  status: failures.length ? "failed" : "passed",
  scope:
    "Repo-local issue evidence alignment only. No provider mutation, OAuth consent, deploy, ServiceTitan action, external send, token access, or customer data access.",
  observed: {
    liveMeasurementStatus: liveMeasurement.status,
    deliverySyncStatus: deliverySync.status,
    googleHistoryStatus: historyStatus.status,
    gscStatus: historyStatus.gsc?.status || "",
    ga4Status: historyStatus.ga4?.status || "",
    gbpStatus: historyStatus.gbp?.status || "",
    newRewardMappingStatus: mappingStatus.status,
    serviceTitanStatus: serviceTitanStatus.status,
    serviceTitanLeadStatus: serviceTitanLeadSummary.status || "",
    serviceTitanJoinProbeStatus: serviceTitanJoinProbe.status || "",
  },
  summary: {
    checks: checks.length,
    failures: failures.length,
    openIssuesWithExternalGates: ["#24", "#26", "#27", "#28", "#29", "#30"],
    completedIssue: "#25",
  },
  checks,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
console.log(`Status: ${result.status}`);

if (failures.length) {
  for (const failure of failures) {
    console.error(`- ${failure.id}: ${failure.evidence}`);
  }
  process.exit(1);
}
