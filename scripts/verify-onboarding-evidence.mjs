#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

const REQUIRED_FILES = [
  "README.md",
  "AGENT_TRANSFER_PACKET.md",
  "docs/onboarding-gap-map.md",
  "docs/source-evidence-map.md",
  "docs/gsc-ga4-history-and-impact-plan.md",
  "docs/air-express-newreward-mapping-reconciliation-packet.md",
  "docs/air-express-google-readonly-reconnect-packet.md",
  "docs/issue-board-seed.md",
  "docs/air-express-content-briefs.md",
  "docs/air-express-blog-distribution-schedule.md",
  "docs/air-express-access-request-packet.md",
  "docs/air-express-owned-site-delivery-sync-packet.md",
  "docs/air-express-servicetitan-redacted-export-import.md",
  "docs/max-social-access-request-draft.md",
  "docs/max-case-study-outreach-draft.md",
  "scripts/import-servicetitan-redacted-export.mjs",
  "scripts/verify-newreward-air-express-mapping.mjs",
  "scripts/verify-live-measurement-path.mjs",
  "scripts/verify-owned-site-delivery-sync.mjs",
  "scripts/verify-site-file-manifest.mjs",
  "scripts/verify-public-claims.mjs",
  "scripts/verify-issue-evidence-alignment.mjs",
  "scripts/refresh-air-express-onboarding-evidence.mjs",
  "scripts/build-owned-site-delivery-sync-packet.mjs",
  "scripts/build-issue-blocker-report.mjs",
  "scripts/build-content-readiness-report.mjs",
  "scripts/verify-servicetitan-export-access.mjs",
  "scripts/pull-servicetitan-lead-history.mjs",
  "scripts/probe-servicetitan-attribution-joins.mjs",
  "tests/unit/servicetitan-redacted-import.test.js",
  "data/issue-24-30-completion-audit.csv",
  "data/issue-24-30-acceptance-criteria-audit.csv",
  "data/newreward-cross-repo-evidence.csv",
  "data/content-briefs.csv",
  "data/attribution-email-evidence.csv",
  "data/attribution-work-items.csv",
  "data/google-history/history-pull-status.json",
  "data/newreward-air-express-provider-readonly-recheck.json",
  "data/live-measurement-path-check.json",
  "data/owned-site-delivery-sync-check.json",
  "data/site-file-manifest.json",
  "data/public-claim-register.json",
  "data/issue-evidence-alignment-check.json",
  "data/air-express-evidence-refresh-status.json",
  "data/seo-geo-attribution-audit.json",
  "data/servicetitan-export-access-check.json",
  "data/servicetitan-attribution-join-probe.json",
  "data/servicetitan-api-lead-history-redacted.csv",
  "data/servicetitan-api-lead-history-summary.json",
  "data/servicetitan-lead-history.csv",
  "data/servicetitan-prior-proof-summary.csv",
  "data/servicetitan-redacted-export-template.csv",
  "data/servicetitan-redacted-export-import-status.json",
  "pages/index.html",
  "pages/roadmap-performance.html",
  "pages/air-express-impact-trace.html",
  "pages/issue-24-30-blocker-report.html",
  "pages/content-readiness-report.html",
  "pages/seo-geo-attribution-report.html",
  "pages/new-reward-impact-report.html",
  "output/hermes-seo-geo-audit/audit-run-packet.json",
  "output/hermes-seo-geo-audit/audit-run-prompt.md",
  "output/hermes-seo-geo-audit/latest-brief.md",
];

const REQUIRED_PAGE_LINKS = [
  "roadmap-performance.html",
  "air-express-impact-trace.html",
  "issue-24-30-blocker-report.html",
  "content-readiness-report.html",
  "seo-geo-attribution-report.html",
  "new-reward-impact-report.html",
];

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
  assert(headers?.length, "CSV is missing a header row.");
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""]))
  );
}

function checkRequiredFiles() {
  const missing = REQUIRED_FILES.filter((relativePath) => !fs.existsSync(path.join(rootDir, relativePath)));
  assert(missing.length === 0, `Missing required onboarding evidence files:\n${missing.join("\n")}`);
}

function checkPagesLinks() {
  const pagesDir = path.join(rootDir, "pages");
  const htmlFiles = fs.readdirSync(pagesDir).filter((name) => name.endsWith(".html")).sort();
  assert(htmlFiles.includes("index.html"), "pages/index.html is required as the Pages landing report.");

  const indexSource = readFile("pages/index.html");
  for (const requiredLink of REQUIRED_PAGE_LINKS) {
    assert(indexSource.includes(`href="${requiredLink}"`), `pages/index.html does not link to ${requiredLink}.`);
  }

  const missingLinks = [];
  for (const file of htmlFiles) {
    const source = readFile(path.posix.join("pages", file));
    for (const match of source.matchAll(/href="([^"]+)"/g)) {
      const href = match[1];
      if (/^(https?:|mailto:|#|\.\.)/.test(href)) {
        continue;
      }
      const targetPath = href.split("#")[0].split("?")[0];
      if (!targetPath) {
        continue;
      }
      const absoluteTarget = path.normalize(path.join(pagesDir, targetPath));
      if (!fs.existsSync(absoluteTarget)) {
        missingLinks.push(`${file} -> ${href}`);
      }
    }
  }

  assert(missingLinks.length === 0, `Broken local Pages links:\n${missingLinks.join("\n")}`);
}

function checkIssueMatrix() {
  const rows = parseCsv(readFile("data/issue-24-30-completion-audit.csv"));
  const rowByIssue = new Map(rows.map((row) => [row.issue, row]));
  for (const issue of ["#24", "#25", "#26", "#27", "#28", "#29", "#30"]) {
    assert(rowByIssue.has(issue), `Issue matrix is missing ${issue}.`);
  }
  assert(!rowByIssue.has("#31"), "Issue #31 must stay separate from the #24-#30 blocker matrix.");
  assert(rowByIssue.get("#25").status === "closed", "Issue #25 should be recorded as closed.");
  assert(rowByIssue.get("#25").completion_state === "completed_verified", "Issue #25 should be completed_verified.");

  for (const issue of ["#24", "#26", "#27", "#28", "#29", "#30"]) {
    const row = rowByIssue.get(issue);
    assert(row.status === "open", `${issue} should remain open until external proof is available.`);
    assert(row.remaining_blocker, `${issue} is missing remaining_blocker text.`);
    assert(row.done_proof, `${issue} is missing done_proof text.`);
    assert(row.next_action, `${issue} is missing next_action text.`);
  }

  const report = readFile("pages/issue-24-30-blocker-report.html");
  for (const issue of ["#24", "#25", "#26", "#27", "#28", "#29", "#30"]) {
    assert(report.includes(`issues/${issue.slice(1)}`), `Blocker report does not link ${issue}.`);
  }

  for (const requiredStatus of [
    "partial live www only canonical pending",
    "pending delivery sync",
    "blocked",
    "rows found",
    "api history pulled",
  ]) {
    assert(
      report.includes(requiredStatus),
      `Blocker report is missing current diagnostic status ${requiredStatus}.`
    );
  }

  const packageJson = JSON.parse(readFile("package.json"));
  assert(
    packageJson.scripts?.["build:issue-blocker-report"] === "node scripts/build-issue-blocker-report.mjs",
    "package.json must expose build:issue-blocker-report."
  );
}

function checkIssueEvidenceAlignment() {
  const alignment = JSON.parse(readFile("data/issue-evidence-alignment-check.json"));
  assert(
    alignment.status === "passed",
    `Issue evidence alignment status must be passed, received ${alignment.status}.`
  );
  assert(
    String(alignment.scope || "").includes("No provider mutation"),
    "Issue evidence alignment must preserve no-provider-mutation scope."
  );

  const observed = alignment.observed || {};
  const liveMeasurement = JSON.parse(readFile("data/live-measurement-path-check.json"));
  const deliverySync = JSON.parse(readFile("data/owned-site-delivery-sync-check.json"));
  const historyStatus = JSON.parse(readFile("data/google-history/history-pull-status.json"));
  const mappingStatus = JSON.parse(readFile("data/newreward-air-express-provider-readonly-recheck.json"));
  const serviceTitanStatus = JSON.parse(readFile("data/servicetitan-export-access-check.json"));
  const serviceTitanJoinProbe = JSON.parse(readFile("data/servicetitan-attribution-join-probe.json"));

  assert(
    observed.liveMeasurementStatus === liveMeasurement.status,
    "Issue evidence alignment live measurement snapshot is stale."
  );
  assert(
    observed.deliverySyncStatus === deliverySync.status,
    "Issue evidence alignment delivery sync snapshot is stale."
  );
  assert(
    observed.googleHistoryStatus === historyStatus.status,
    "Issue evidence alignment Google history snapshot is stale."
  );
  assert(observed.gscStatus === historyStatus.gsc?.status, "Issue evidence alignment GSC snapshot is stale.");
  assert(observed.ga4Status === historyStatus.ga4?.status, "Issue evidence alignment GA4 snapshot is stale.");
  assert(observed.gbpStatus === historyStatus.gbp?.status, "Issue evidence alignment GBP snapshot is stale.");
  assert(
    observed.newRewardMappingStatus === mappingStatus.status,
    "Issue evidence alignment New Reward mapping snapshot is stale."
  );
  assert(
    observed.serviceTitanStatus === serviceTitanStatus.status,
    "Issue evidence alignment ServiceTitan snapshot is stale."
  );
  assert(
    observed.serviceTitanJoinProbeStatus === serviceTitanJoinProbe.status,
    "Issue evidence alignment ServiceTitan join probe snapshot is stale."
  );

  const checks = alignment.checks || [];
  for (const requiredCheck of [
    "#26-mapping-json-alignment",
    "#27-google-scope-alignment",
    "#28-live-delivery-alignment",
    "#29-impact-report-alignment",
    "#30-servicetitan-alignment",
  ]) {
    assert(
      checks.some((check) => check.id === requiredCheck && check.status === "passed"),
      `Issue evidence alignment missing passed check ${requiredCheck}.`
    );
  }
}

function checkCrossRepoEvidence() {
  const rows = parseCsv(readFile("data/newreward-cross-repo-evidence.csv"));
  assert(rows.length >= 7, `Expected at least 7 cross-repo evidence rows, received ${rows.length}.`);

  const requiredColumns = [
    "source",
    "scope",
    "issue_or_pr",
    "state",
    "evidence_class",
    "verified_at",
    "evidence",
    "relevance_to_air_express",
    "boundary",
    "next_action",
  ];
  for (const column of requiredColumns) {
    assert(Object.prototype.hasOwnProperty.call(rows[0], column), `Cross-repo evidence missing column ${column}.`);
  }

  const byIssue = new Map(rows.map((row) => [row.issue_or_pr, row]));
  for (const key of [
    "#2876",
    "#2880",
    "#3384",
    "#3429",
    "#3834",
    "Air Express client roster",
    "docs/plans/2026-04-29-contract-client-activation-failsafe.md",
  ]) {
    assert(byIssue.has(key), `Cross-repo evidence missing ${key}.`);
  }

  assert(
    byIssue.get("#3834").state === "merged_live",
    "Cross-repo evidence must preserve #3834 as merged_live."
  );
  assert(
    byIssue.get("#3429").state === "open_blocked",
    "Cross-repo evidence must preserve #3429 as open_blocked."
  );
  assert(
    byIssue.get("#3384").evidence.includes("GA4 connected") &&
      byIssue.get("#3384").evidence.includes("GSC expired"),
    "Cross-repo evidence must preserve the New Reward-owned GA4/GSC split."
  );
  assert(
    byIssue.get("docs/plans/2026-04-29-contract-client-activation-failsafe.md").state ===
      "source_drift_evidence" &&
      byIssue
        .get("docs/plans/2026-04-29-contract-client-activation-failsafe.md")
        .evidence.includes("manually promoted from prospect to client"),
    "Cross-repo evidence must preserve the Air Express activation/source-state drift clue."
  );
  assert(
    rows.every((row) => row.boundary && row.next_action),
    "Every cross-repo evidence row must include boundary and next action."
  );

  const report = readFile("pages/issue-24-30-blocker-report.html");
  assert(
    report.includes("New Reward Cross-Repo Evidence"),
    "Blocker report must include the New Reward Cross-Repo Evidence section."
  );
  assert(
    report.includes("data/newreward-cross-repo-evidence.csv"),
    "Blocker report must point to the cross-repo evidence CSV."
  );
  assert(
    report.includes("Signed contract client activation"),
    "Blocker report must surface the Air Express activation/source-state drift clue."
  );
  assert(
    readFile("pages/index.html").includes("../data/newreward-cross-repo-evidence.csv"),
    "Pages index must link the cross-repo evidence CSV."
  );
}

function checkAcceptanceCriteriaAudit() {
  const rows = parseCsv(readFile("data/issue-24-30-acceptance-criteria-audit.csv"));
  assert(rows.length >= 30, `Expected at least 30 acceptance-criteria rows, received ${rows.length}.`);

  const requiredColumns = [
    "issue",
    "criterion_id",
    "acceptance_criterion",
    "state",
    "evidence",
    "remaining_blocker",
    "next_action",
    "closure_ready",
  ];
  for (const column of requiredColumns) {
    assert(Object.prototype.hasOwnProperty.call(rows[0], column), `Acceptance criteria audit missing column ${column}.`);
  }

  const rowsByIssue = new Map();
  for (const row of rows) {
    assert(row.issue, "Acceptance criteria audit row missing issue.");
    assert(row.criterion_id, `Acceptance criteria audit row for ${row.issue} missing criterion_id.`);
    assert(row.acceptance_criterion, `Acceptance criteria audit row ${row.issue}/${row.criterion_id} missing acceptance criterion.`);
    assert(row.state, `Acceptance criteria audit row ${row.issue}/${row.criterion_id} missing state.`);
    assert(row.evidence, `Acceptance criteria audit row ${row.issue}/${row.criterion_id} missing evidence.`);
    assert(row.next_action, `Acceptance criteria audit row ${row.issue}/${row.criterion_id} missing next action.`);
    assert(["true", "false"].includes(row.closure_ready), `Acceptance criteria audit row ${row.issue}/${row.criterion_id} has invalid closure_ready.`);
    rowsByIssue.set(row.issue, [...(rowsByIssue.get(row.issue) || []), row]);
  }

  for (const issue of ["#24", "#25", "#26", "#27", "#28", "#29", "#30"]) {
    assert(rowsByIssue.has(issue), `Acceptance criteria audit missing ${issue}.`);
  }
  assert(!rowsByIssue.has("#31"), "Acceptance criteria audit must keep #31 separate from #24-#30.");
  assert(
    rowsByIssue.get("#25").every((row) => row.closure_ready === "true"),
    "Issue #25 acceptance rows should all be closure_ready=true."
  );
  for (const issue of ["#24", "#26", "#27", "#28", "#29", "#30"]) {
    assert(
      rowsByIssue.get(issue).some((row) => row.closure_ready === "false"),
      `${issue} must retain at least one non-closure-ready acceptance row.`
    );
  }

  const report = readFile("pages/issue-24-30-blocker-report.html");
  assert(
    report.includes("Acceptance Criteria Audit"),
    "Blocker report must include an Acceptance Criteria Audit section."
  );
  assert(
    report.includes("data/issue-24-30-acceptance-criteria-audit.csv"),
    "Blocker report must point to the acceptance criteria audit CSV."
  );
}

function checkSeoAudit() {
  const audit = JSON.parse(readFile("data/seo-geo-attribution-audit.json"));
  const scores = audit.scores ?? {};
  assert(scores.technical === 100, `Expected technical SEO score 100, received ${scores.technical}.`);
  assert(scores.geo >= 90, `Expected GEO score >= 90, received ${scores.geo}.`);
  assert(scores.messaging === 100, `Expected messaging score 100, received ${scores.messaging}.`);
  assert(scores.accessibility === 100, `Expected accessibility score 100, received ${scores.accessibility}.`);
  assert(scores.attribution >= 25, `Expected attribution score >= 25, received ${scores.attribution}.`);

  const findings = audit.findings ?? {};
  assert(Array.isArray(findings.critical), "Audit findings.critical must be an array.");
  assert(
    findings.critical.some((finding) =>
      String(finding.issue || "").includes("GSC/GA4 attribution source")
    ),
    "Expected critical GSC/GA4 attribution source finding is missing."
  );
  assert(
    audit.attribution?.liveMeasurement?.source === "data/live-measurement-path-check.json",
    "SEO/GEO attribution audit must reference the live measurement diagnostic."
  );
  assert(
    audit.attribution?.liveMeasurement?.approvedGa4Id === "G-JZ7PY32EVX",
    "SEO/GEO attribution audit must carry the approved GA4 id from the live measurement diagnostic."
  );
  assert(
    audit.attribution?.onSiteTag?.status === audit.attribution?.liveMeasurement?.status,
    "On-site tag status must be aligned with the live measurement diagnostic status."
  );
  assert(
    audit.attribution?.deliverySync?.source === "data/owned-site-delivery-sync-check.json",
    "SEO/GEO attribution audit must reference the owned-site delivery sync diagnostic."
  );
  assert(
    audit.attribution?.deliverySync?.approvedGa4Id === "G-JZ7PY32EVX",
    "SEO/GEO attribution audit must carry the approved GA4 id from the owned-site delivery diagnostic."
  );
}

function checkHistoryStatus() {
  const status = JSON.parse(readFile("data/google-history/history-pull-status.json"));
  assert(status.account === "newrewardplatform@gmail.com", `Unexpected Google provider account: ${status.account}`);
  assert(Array.isArray(status.evidenceStates), "History pull status must include an evidenceStates array.");

  const stateNames = new Set(status.evidenceStates.map((state) => state.state));
  for (const requiredState of ["verified", "inferred", "prepared", "blocked", "not_attempted"]) {
    assert(stateNames.has(requiredState), `History pull status is missing evidence state ${requiredState}.`);
  }

  const impactReport = readFile("pages/new-reward-impact-report.html");
  assert(
    impactReport.includes("Evidence State Model"),
    "Impact report must include an Evidence State Model section."
  );
  for (const requiredState of ["verified", "inferred", "prepared", "blocked", "not_attempted"]) {
    assert(
      impactReport.includes(`>${requiredState}<`),
      `Impact report is missing evidence state ${requiredState}.`
    );
  }

  assert(status.serviceTitan, "History pull status must include ServiceTitan lead-proof status.");
  assert(
    status.serviceTitan.priorProofStatus === "api_history_pulled",
    `Expected ServiceTitan lead proof status api_history_pulled, received ${status.serviceTitan.priorProofStatus}.`
  );
  assert(
    status.serviceTitan.status === "auth_ready_no_export",
    `Expected ServiceTitan export status auth_ready_no_export, received ${status.serviceTitan.status}.`
  );
  assert(
    status.serviceTitan.piiExcluded === true,
    "ServiceTitan lead proof status must confirm PII is excluded."
  );
  assert(
    Number(status.serviceTitan.verifiedCount) >= 5,
    "ServiceTitan lead proof status must preserve the prior five-lead count."
  );
  assert(
    Number(status.serviceTitan.apiLeadCount) === 78 &&
      Number(status.serviceTitan.websiteCampaignLeadCount) === 76,
    "ServiceTitan lead proof status must include the pulled API lead counts."
  );
  assert(
    Array.isArray(status.serviceTitan.apiCompleteWeeklyTrend) &&
      status.serviceTitan.apiCompleteWeeklyTrend.some((week) => week.week === "2026-05-25" && Number(week.totalLeads || 0) === 0) &&
      status.serviceTitan.apiCompleteWeeklyTrend.some((week) => week.week === "2026-06-01" && Number(week.totalLeads || 0) === 0),
    "ServiceTitan lead proof status must include zero-filled weekly lead trend through the requested current weeks."
  );
  assert(
    status.serviceTitan.captcha?.date === "2026-06-04" &&
      String(status.serviceTitan.captcha?.liveStatus || "").includes("pending"),
    "ServiceTitan lead proof status must include the June 4 Turnstile source marker without claiming live CAPTCHA proof."
  );
  assert(
    status.serviceTitan.qualityProxyByCaptchaPeriod?.source_captcha_day_or_after?.total === 0,
    "ServiceTitan lead proof status must preserve the current zero post-CAPTCHA-source lead count."
  );
  assert(
    String(status.serviceTitan.blocker || "").includes("Lead history is pulled") &&
      String(status.serviceTitan.blocker || "").includes("Turnstile"),
    "ServiceTitan lead proof status must preserve lead-history and live lead-path blocker state."
  );
  assert(
    Number(status.serviceTitan.apiCountsByServiceType?.ac_repair || 0) > 0,
    "ServiceTitan lead proof status must include service-type buckets from safe fixed-keyword classification."
  );
  assert(
    impactReport.includes("Lead Proof Status"),
    "Impact report must include a Lead Proof Status section."
  );
  assert(
    impactReport.includes("ServiceTitan lead history") && impactReport.includes("api_history_pulled"),
    "Impact report must show ServiceTitan API lead history."
  );
  assert(
    impactReport.includes("ServiceTitan export/history") && impactReport.includes("auth_ready_no_export"),
    "Impact report must show the ServiceTitan auth-ready export state."
  );
  assert(
    impactReport.includes("booking and revenue joins are intentionally out of scope"),
    "Impact report must keep booking/revenue joins outside the current lead-count scope."
  );
  assert(
    impactReport.includes("ServiceTitan redacted export import"),
    "Impact report must show the ServiceTitan redacted export import lane."
  );
  assert(
    impactReport.includes("ServiceTitan Weekly Lead Trend") &&
      impactReport.includes("CAPTCHA") &&
      impactReport.includes("Service-Type Mix"),
    "Impact report must show ServiceTitan weekly trend, CAPTCHA marker, and service-type mix sections."
  );

  if (status.status === "blocked") {
    assert(status.gsc?.status === "blocked_scope", `Expected GSC blocked_scope, received ${status.gsc?.status}.`);
    assert(status.ga4?.status === "blocked_scope", `Expected GA4 blocked_scope, received ${status.ga4?.status}.`);
    assert(status.gbp?.status === "not_included", `Expected GBP not_included for current GSC/GA4 refresh, received ${status.gbp?.status}.`);
    assert(
      status.token?.requiredScopes?.gsc === "https://www.googleapis.com/auth/webmasters.readonly",
      "History pull status must record the required GSC scope."
    );
    assert(
      status.token?.requiredScopes?.ga4 === "https://www.googleapis.com/auth/analytics.readonly",
      "History pull status must record the required GA4 scope."
    );
    assert(
      !status.token?.requiredScopes?.gbp,
      "History pull status must not require the GBP scope when the current refresh is scoped to GSC/GA4."
    );
    assert(
      status.token?.missingRequiredScopes?.includes("https://www.googleapis.com/auth/webmasters.readonly"),
      "History pull status must include the missing GSC scope in missingRequiredScopes."
    );
    assert(
      status.token?.missingRequiredScopes?.includes("https://www.googleapis.com/auth/analytics.readonly"),
      "History pull status must include the missing GA4 scope in missingRequiredScopes."
    );
    assert(
      !status.token?.missingRequiredScopes?.includes("https://www.googleapis.com/auth/business.manage"),
      "History pull status must exclude the GBP scope from missingRequiredScopes for this GSC/GA4-only refresh."
    );
    assert(Array.isArray(status.token?.visibleScopes), "History pull status must include sanitized visibleScopes.");
    assert(
      status.token?.candidates?.every((candidate) => Array.isArray(candidate.visibleScopes)),
      "Each token candidate must include sanitized visibleScopes."
    );
    assert(
      status.blockers?.some((blocker) => String(blocker.evidence || "").includes("webmasters.readonly")),
      "Missing Search Console readonly scope blocker evidence."
    );
    assert(
      status.blockers?.some((blocker) => String(blocker.evidence || "").includes("analytics.readonly")),
      "Missing GA4 readonly scope blocker evidence."
    );
    assert(
      !status.blockers?.some((blocker) => String(blocker.evidence || "").includes("business.manage")),
      "History pull status must not include a GBP business.manage blocker in this GSC/GA4-only refresh."
    );
    return;
  }

  assert(
    ["partial_or_pulled", "pulled"].includes(status.status),
    `Unexpected history pull status: ${status.status}`
  );
}

function checkNoSensitiveKeys(value, pathParts = []) {
  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const keyPath = [...pathParts, key];
    const keyName = key.toLowerCase();
    assert(
      !["accesstoken", "refreshtoken", "encrypteddata", "password", "cookie"].includes(keyName),
      `Sensitive key is present in sanitized evidence: ${keyPath.join(".")}`
    );
    checkNoSensitiveKeys(child, keyPath);
  }
}

function checkNewRewardMappingStatus() {
  const source = readFile("data/newreward-air-express-provider-readonly-recheck.json");
  assert(!/postgres(?:ql)?:\/\//i.test(source), "NewReward mapping evidence must not include database URLs.");
  assert(!/postgres:[^@\s"']+@/i.test(source), "NewReward mapping evidence must not include connection-shaped credential strings.");
  assert(!/db\.[a-z0-9.-]+\.supabase\.co/i.test(source), "NewReward mapping evidence must not include raw database hostnames.");

  const status = JSON.parse(source);
  assert(
    status.evidenceClass === "read_only_newrewards_configured_db_lookup",
    `Unexpected NewReward mapping evidence class: ${status.evidenceClass}`
  );
  assert(
    String(status.secretHandling || "").includes("No database URL"),
    "NewReward mapping evidence must preserve no-secret handling statement."
  );
  assert(
    String(status.queryMode || "").includes("BEGIN READ ONLY"),
    "NewReward mapping evidence must confirm read-only query mode."
  );
  assert(
    status.knownAirExpressIds?.crmClientId === "cmmwe8so000077kqptwysqaem",
    "NewReward mapping evidence missing Air Express CRM client id."
  );
  assert(
    status.knownAirExpressIds?.liveEdgeWebsiteId === "cmorqbs9j001r5nr1h25vosp8",
    "NewReward mapping evidence missing live edge website id."
  );

  checkNoSensitiveKeys(status);

  const rowCounts = status.sourceSummary?.rowCounts || {};
  for (const key of ["Client", "Website", "ProviderCredential", "GscConnection", "Ga4Connection"]) {
    assert(
      Number.isFinite(Number(rowCounts[key])),
      `NewReward mapping source summary missing numeric ${key} row count.`
    );
  }

  const lookup = status.targetedLookup || {};
  for (const key of ["clients", "websites", "providerCredentials", "gscConnections", "ga4Connections"]) {
    assert(Array.isArray(lookup[key]), `NewReward mapping evidence missing array ${key}.`);
  }
}

function checkServiceTitanProof() {
  const rows = parseCsv(readFile("data/servicetitan-lead-history.csv"));
  assert(rows.length >= 2, "ServiceTitan proof should include at least the two prior verified lead rows.");
  for (const leadId of ["84856340", "84856596"]) {
    assert(
      rows.some((row) => row.service_titan_lead_id === leadId),
      `Missing prior ServiceTitan lead ${leadId}.`
    );
  }

  const summaryRows = parseCsv(readFile("data/servicetitan-prior-proof-summary.csv"));
  assert(summaryRows.length >= 1, "ServiceTitan prior proof summary should include the count-only guide evidence.");
  assert(
    summaryRows.some((row) => row.verified_count === "5" && row.campaign_id === "80365413"),
    "ServiceTitan prior proof summary must preserve the five-lead count and campaign id."
  );
  assert(
    summaryRows.every((row) => row.pii_excluded === "true"),
    "ServiceTitan prior proof summary must explicitly exclude PII."
  );
}

function checkServiceTitanExportAccess() {
  const packageJson = JSON.parse(readFile("package.json"));
  assert(
    packageJson.scripts?.["test:servicetitan-redacted-import"] ===
      "node --test tests/unit/servicetitan-redacted-import.test.js",
    "package.json missing test:servicetitan-redacted-import script."
  );
  assert(
    String(packageJson.scripts?.["prevercel-build"] || "").includes("test:servicetitan-redacted-import"),
    "prevercel-build must include the ServiceTitan redacted import regression test."
  );

  const source = readFile("data/servicetitan-export-access-check.json");
  const forbiddenPatterns = [
    /access[_-]?token/i,
    /Bearer\s+[A-Za-z0-9._~+/=-]+/i,
  ];
  for (const pattern of forbiddenPatterns) {
    assert(!pattern.test(source), `ServiceTitan export access evidence contains forbidden sensitive pattern: ${pattern}`);
  }

  const status = JSON.parse(source);
  assert(
    status.evidenceClass === "servicetitan_export_access_readiness_check",
    `Unexpected ServiceTitan evidence class: ${status.evidenceClass}`
  );
  assert(
    ["blocked_env", "blocked_config", "blocked_auth", "auth_ready_no_export", "config_ready_auth_not_attempted"].includes(status.status),
    `Unexpected ServiceTitan export access status: ${status.status}`
  );
  assert(
    String(status.secretHandling || "").includes("Credential values"),
    "ServiceTitan export access evidence must preserve credential no-secret handling."
  );
  assert(
    String(status.mutationBoundary || "").includes("No ServiceTitan lead"),
    "ServiceTitan export access evidence must preserve no-mutation boundary."
  );

  const requiredNames = new Set((status.requiredEnv || []).map((item) => item.name));
  for (const name of [
    "SERVICETITAN_ENV",
    "SERVICETITAN_TENANT_ID",
    "SERVICETITAN_APP_KEY",
    "SERVICETITAN_CLIENT_ID",
    "SERVICETITAN_CLIENT_SECRET",
  ]) {
    assert(requiredNames.has(name), `ServiceTitan export access evidence missing ${name}.`);
  }

  assert(
    status.exportPacketRequirement?.requiredFields?.includes("service_titan_lead_id"),
    "ServiceTitan export packet requirement must include service_titan_lead_id."
  );
  assert(
    status.exportPacketRequirement?.prohibitedFields?.includes("customer_name"),
    "ServiceTitan export packet requirement must prohibit customer_name."
  );

  const importStatusSource = readFile("data/servicetitan-redacted-export-import-status.json");
  for (const pattern of [
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/,
    /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|circle|cir|court|ct|boulevard|blvd)\b/i,
  ]) {
    assert(!pattern.test(importStatusSource), `ServiceTitan redacted import status contains private value pattern: ${pattern}`);
  }
  const importStatus = JSON.parse(importStatusSource);
  assert(
    importStatus.evidenceClass === "servicetitan_redacted_export_import",
    `Unexpected ServiceTitan import evidence class: ${importStatus.evidenceClass}`
  );
  assert(
    ["awaiting_input", "missing_input", "invalid_schema", "rejected_pii", "imported", "imported_empty"].includes(importStatus.status),
    `Unexpected ServiceTitan import status: ${importStatus.status}`
  );
  assert(
    importStatus.piiExcluded === true || importStatus.status === "rejected_pii",
    "ServiceTitan import status must preserve PII exclusion state."
  );
  assert(
    importStatus.derivedFields?.includes("new_reward_impact_period"),
    "ServiceTitan import status must include the derived new_reward_impact_period field."
  );
  assert(
    Array.isArray(importStatus.impactPeriods) && importStatus.impactPeriods.length === 3,
    "ServiceTitan import status must include the three New Reward impact periods."
  );
  if (importStatus.status === "imported") {
    assert(importStatus.impactPeriodCounts, "Imported ServiceTitan status must include impactPeriodCounts.");
  }

  const template = readFile("data/servicetitan-redacted-export-template.csv");
  for (const requiredField of [
    "service_titan_lead_id",
    "created_at",
    "campaign_id_or_source",
    "service_type_or_category",
    "lead_status",
  ]) {
    assert(template.includes(requiredField), `ServiceTitan redacted export template missing ${requiredField}.`);
  }

  const importDoc = readFile("docs/air-express-servicetitan-redacted-export-import.md");
  for (const requiredText of [
    "npm run import:servicetitan-redacted-export",
    "data/servicetitan-redacted-export-template.csv",
    "customer names",
    "phone numbers",
    "email addresses",
    "No ServiceTitan API call",
    "new_reward_impact_period",
    "after_ga4_lead_proof",
  ]) {
    assert(importDoc.includes(requiredText), `ServiceTitan redacted export import doc missing ${requiredText}.`);
  }
}

function checkServiceTitanAttributionJoinProbe() {
  const packageJson = JSON.parse(readFile("package.json"));
  assert(
    packageJson.scripts?.["probe:servicetitan-attribution-joins"] ===
      "node scripts/probe-servicetitan-attribution-joins.mjs",
    "package.json missing probe:servicetitan-attribution-joins script."
  );

  const source = readFile("data/servicetitan-attribution-join-probe.json");
  for (const pattern of [
    /Bearer\s+[A-Za-z0-9._~+/=-]+/i,
    /access[_-]?token[=:]\s*[^,\s"']+/i,
    /refresh[_-]?token[=:]\s*[^,\s"']+/i,
    /client[_-]?secret[=:]\s*[^,\s"']+/i,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/,
  ]) {
    assert(!pattern.test(source), `ServiceTitan join probe contains forbidden sensitive pattern: ${pattern}`);
  }

  const probe = JSON.parse(source);
  assert(
    probe.evidenceClass === "servicetitan_attribution_join_probe",
    `Unexpected ServiceTitan join probe evidence class: ${probe.evidenceClass}`
  );
  assert(
    probe.status === "partial_join_surfaces_readable",
    `Unexpected ServiceTitan join probe status: ${probe.status}`
  );
  assert(
    probe.requested?.from === "2020-01-01",
    "ServiceTitan join probe must preserve the widened 2020 cursor check."
  );
  assert(
    String(probe.secretHandling || "").includes("No credential values") &&
      String(probe.secretHandling || "").includes("customer names"),
    "ServiceTitan join probe must preserve no-secret and no-PII handling."
  );
  assert(
    String(probe.mutationBoundary || "").includes("Read-only GET probes only"),
    "ServiceTitan join probe must preserve read-only mutation boundary."
  );

  const bySurface = new Map((probe.probes || []).map((row) => [row.surface, row]));
  const bookings = bySurface.get("CRM export bookings");
  assert(bookings, "ServiceTitan join probe missing CRM export bookings surface.");
  assert(
    bookings.status === "readable" && Number(bookings.httpStatus) === 200,
    "CRM export bookings surface must be readable."
  );
  assert(
    Number(bookings.rowCount || 0) === 0,
    "CRM export bookings must preserve zero rows for the widened cursor."
  );

  for (const [surface, requiredScope] of [
    ["JPM export jobs", "Job Planning and Management > Jobs (Read)"],
    ["Accounting export invoices", "Accounting > Invoices (Read)"],
    ["Accounting export invoice items", "Accounting > Invoice Items (Read)"],
    ["Accounting export payments", "Accounting > Payments (Read)"],
  ]) {
    const row = bySurface.get(surface);
    assert(row, `ServiceTitan join probe missing ${surface}.`);
    assert(row.status === "blocked", `${surface} should remain blocked until scope is granted.`);
    assert(Number(row.httpStatus) === 403, `${surface} must preserve the 403 scope blocker.`);
    assert(row.requiredScope === requiredScope, `${surface} required scope changed unexpectedly.`);
    assert(
      String(row.blocker || "").includes("Scope validation failed"),
      `${surface} must preserve scope-validation blocker text.`
    );
  }
}

function checkLiveMeasurementPath() {
  const source = readFile("data/live-measurement-path-check.json");
  for (const pattern of [
    /<html/i,
    /<!doctype/i,
    /<script/i,
    /access[_-]?token/i,
    /refresh[_-]?token/i,
    /password/i,
    /set-cookie/i,
  ]) {
    assert(!pattern.test(source), `Live measurement evidence contains forbidden raw or sensitive pattern: ${pattern}`);
  }

  const status = JSON.parse(source);
  assert(
    status.evidenceClass === "live_measurement_path_read_only_check",
    `Unexpected live measurement evidence class: ${status.evidenceClass}`
  );
  assert(status.approvedGa4Id === "G-JZ7PY32EVX", `Unexpected approved GA4 id: ${status.approvedGa4Id}`);
  assert(
    [
      "blocked_local_source",
      "blocked_local_coverage",
      "blocked_live_fetch",
      "blocked_duplicate_or_unverified_live_source",
      "fixed_locally_pending_live",
      "partial_live_www_only_canonical_pending",
      "live_single_source_verified_pending_event_proof",
    ].includes(status.status),
    `Unexpected live measurement status: ${status.status}`
  );
  assert(
    String(status.secretHandling || "").includes("No cookies"),
    "Live measurement evidence must preserve no-cookie/no-token handling."
  );
  assert(
    String(status.mutationBoundary || "").includes("No deploy"),
    "Live measurement evidence must preserve no-deploy boundary."
  );
  assert(
    status.local?.index?.markers?.approvedGa4Present === true,
    "Live measurement evidence must show approved GA4 in local index.html."
  );
  assert(
    status.local?.analyticsJs?.markers?.approvedGa4Present === true,
    "Live measurement evidence must show approved GA4 in local analytics.js."
  );
  assert(
    status.local?.pageCoverage?.totalPages >= 100,
    "Live measurement evidence must include broad local public page coverage."
  );
  assert(
    status.local?.pageCoverage?.pagesWithAnyApprovedSource?.length === status.local?.pageCoverage?.totalPages,
    "Every checked local public page must have an approved measurement source."
  );
  assert(
    status.local?.pageCoverage?.pagesMissingMeasurementSource?.length === 0,
    "Local public pages must not be missing measurement source coverage."
  );
  assert(
    status.local?.pageCoverage?.pagesWithUnapprovedGtmContainers?.length === 0,
    "Local public pages must not include unapproved GTM containers."
  );
  assert(
    status.local?.pageCoverage?.pagesWithDuplicateSources?.length === 0,
    "Local public pages must not include duplicate measurement sources."
  );
  assert(
    status.local?.pageCoverage?.pagesWithApprovedInlineGa4?.includes("index.html"),
    "Local page coverage must show the homepage has approved inline GA4."
  );
  assert(
    Array.isArray(status.local?.pageCoverage?.approvedGtmContainers),
    "Local page coverage must include approved GTM container inventory."
  );
  assert(
    status.leadEvent?.status === "prepared_source_pending_live",
    `Expected prepared lead-event source, received ${status.leadEvent?.status}.`
  );
  const leadPageEvidence = new Map(
    (status.leadEvent?.pageEvidence || []).map((page) => [page.file, page])
  );
  for (const page of ["contact.html", "request-estimate.html", "schedule-service.html"]) {
    const evidence = leadPageEvidence.get(page);
    assert(evidence, `Live measurement evidence missing lead form page evidence for ${page}.`);
    assert(evidence.hasAnalyticsLoader === true, `${page} must load /analytics.js in lead event evidence.`);
    assert(evidence.hasIntakeScript === true, `${page} must load intake-form.js in lead event evidence.`);
    assert(evidence.hasIntakeForm === true, `${page} must expose data-intake-form in lead event evidence.`);
  }
  assert(
    Array.isArray(status.live?.homepage?.markers?.gtmContainers),
    "Live measurement evidence must include live GTM container marker inventory."
  );

  if (status.status === "fixed_locally_pending_live") {
    assert(
      status.live?.homepage?.markers?.approvedGa4Present === false,
      "fixed_locally_pending_live should not claim live homepage GA4 is present."
    );
    assert(
      (status.blockers || []).some((blocker) => String(blocker.nextAction || "").includes("verify:live-measurement")),
      "fixed_locally_pending_live must include rerun next action."
    );
  }
  if (status.status === "partial_live_www_only_canonical_pending") {
    assert(
      status.live?.wwwHomepage?.markers?.approvedGa4Present === true &&
        status.live?.homepage?.markers?.approvedGa4Present === false,
      "partial_live_www_only_canonical_pending must show GA4 live on www but absent from canonical apex."
    );
    assert(
      status.live?.turnstileConfig?.www?.configured === false,
      "partial_live_www_only_canonical_pending must preserve missing live Turnstile config."
    );
  }
}

function checkOwnedSiteDeliverySync() {
  const source = readFile("data/owned-site-delivery-sync-check.json");
  for (const pattern of [
    /<html/i,
    /<!doctype/i,
    /<script/i,
    /access[_-]?token/i,
    /refresh[_-]?token/i,
    /password/i,
    /set-cookie/i,
  ]) {
    assert(!pattern.test(source), `Owned-site delivery sync evidence contains forbidden raw or sensitive pattern: ${pattern}`);
  }

  const status = JSON.parse(source);
  assert(
    status.evidenceClass === "owned_site_delivery_sync_read_only_check",
    `Unexpected owned-site delivery evidence class: ${status.evidenceClass}`
  );
  assert(status.approvedGa4Id === "G-JZ7PY32EVX", `Unexpected owned-site GA4 id: ${status.approvedGa4Id}`);
  assert(
    [
      "blocked_local_or_unapproved_source",
      "pending_delivery_sync",
      "pending_noncritical_delivery_sync",
      "live_drift",
      "synced",
    ].includes(status.status),
    `Unexpected owned-site delivery status: ${status.status}`
  );
  assert(
    String(status.secretHandling || "").includes("No cookies"),
    "Owned-site delivery evidence must preserve no-cookie/no-token handling."
  );
  assert(
    String(status.mutationBoundary || "").includes("No deploy"),
    "Owned-site delivery evidence must preserve no-deploy boundary."
  );

  const artifacts = new Map((status.artifacts || []).map((artifact) => [artifact.name, artifact]));
  for (const requiredArtifact of ["homepage", "analytics_js", "llms_txt", "sitemap_xml", "robots_txt"]) {
    assert(artifacts.has(requiredArtifact), `Owned-site delivery evidence missing ${requiredArtifact}.`);
  }
  assert(
    artifacts.get("homepage")?.local?.markers?.approvedGa4Present === true,
    "Owned-site delivery evidence must show approved GA4 in local homepage."
  );
  assert(
    artifacts.get("analytics_js")?.local?.markers?.approvedGa4Present === true,
    "Owned-site delivery evidence must show approved GA4 in local analytics.js."
  );
  assert(
    artifacts.get("homepage")?.critical === true && artifacts.get("analytics_js")?.critical === true,
    "Homepage and analytics.js must be critical owned-site delivery artifacts."
  );

  if (status.status === "pending_delivery_sync") {
    assert(
      (status.blockers || []).some((blocker) =>
        String(blocker.nextAction || "").includes("verify:owned-site-delivery-sync")
      ),
      "pending_delivery_sync must include rerun next action."
    );
  }
}

function checkOwnedSiteDeliverySyncPacket() {
  const packet = readFile("docs/air-express-owned-site-delivery-sync-packet.md");
  for (const requiredText of [
    "No provider mutation",
    "G-JZ7PY32EVX",
    "cmorqbs9j001r5nr1h25vosp8",
    "homepage",
    "analytics_js",
    "llms_txt",
    "sitemap_xml",
    "robots_txt",
    "Approved Delivery Paths",
    "Stop Gates",
    "approved Air Express GTM container id has been found",
    "npm run verify:owned-site-delivery-sync",
    "npm run verify:live-measurement",
    "npm run audit:seo-geo-attribution",
    "npm run prevercel-build",
    "#28 can close only when",
  ]) {
    assert(packet.includes(requiredText), `Owned-site delivery sync packet missing ${requiredText}.`);
  }
}

function checkSiteFileManifest() {
  const source = readFile("data/site-file-manifest.json");
  const manifest = JSON.parse(source);
  assert(manifest.status === "passed", `Site file manifest status must be passed, received ${manifest.status}.`);
  assert(
    String(manifest.scope || "").includes("No production fetch"),
    "Site file manifest must preserve local-only/no-production-fetch scope."
  );
  assert(manifest.summary?.missingRequiredArtifacts === 0, "Site file manifest has missing required artifacts.");
  assert(manifest.summary?.sitemapMissingLocalCount === 0, "Site file manifest has sitemap URLs without local files.");
  assert(manifest.summary?.localHtmlNotInSitemapCount === 0, "Site file manifest has local public HTML missing from sitemap.");
  assert(manifest.summary?.duplicateSitemapUrlCount === 0, "Site file manifest has duplicate sitemap URLs.");
  assert(manifest.summary?.invalidSitemapLastmodCount === 0, "Site file manifest has invalid sitemap lastmod values.");
  assert(manifest.summary?.draftLeakCount === 0, "Site file manifest found generated draft blog posts.");
  assert(manifest.summary?.missingGeneratedPostCount === 0, "Site file manifest found publishable posts missing generated HTML.");
  assert(manifest.summary?.missingLocalReferenceCount === 0, "Site file manifest found missing local static references.");

  const artifacts = new Map((manifest.requiredArtifacts || []).map((artifact) => [artifact.path, artifact]));
  for (const requiredArtifact of ["index.html", "analytics.js", "intake-form.js", "styles.css", "robots.txt", "sitemap.xml", "llms.txt", "vercel.json"]) {
    assert(artifacts.get(requiredArtifact)?.exists === true, `Site file manifest missing ${requiredArtifact}.`);
    assert(artifacts.get(requiredArtifact)?.sha256, `Site file manifest missing sha256 for ${requiredArtifact}.`);
  }

  const blogSources = new Map((manifest.blogSources || []).map((entry) => [entry.slug, entry]));
  assert(
    blogSources.get("first-hot-week-ac-checklist-utah")?.status === "generated",
    "Site file manifest must show first-hot-week post generated."
  );
  for (const draftSlug of ["wildfire-smoke-hvac-filter-utah", "thermostat-settings-utah-heat-wave"]) {
    assert(
      blogSources.get(draftSlug)?.status === "draft_excluded",
      `Site file manifest must show ${draftSlug} excluded as draft.`
    );
  }
}

function checkPublicClaimRegister() {
  const source = readFile("data/public-claim-register.json");
  const register = JSON.parse(source);
  assert(register.status === "passed", `Public claim register status must be passed, received ${register.status}.`);
  assert(
    String(register.scope || "").includes("No provider mutation"),
    "Public claim register must preserve no-provider-mutation scope."
  );
  assert(register.summary?.forbiddenClaimFailures === 0, "Public claim register has forbidden claim failures.");

  const claims = new Map((register.claims || []).map((claim) => [claim.id, claim]));
  const bbbAccredited = claims.get("bbb_accredited");
  assert(bbbAccredited, "Public claim register missing bbb_accredited claim.");
  assert(bbbAccredited.failIfPresent === true, "BBB Accredited claim must stay fail-if-present.");
  assert(bbbAccredited.occurrenceCount === 0, "BBB Accredited must not appear in local public HTML.");

  const bbbProfile = claims.get("bbb_business_profile");
  assert(bbbProfile, "Public claim register missing bbb_business_profile claim.");
  assert(
    bbbProfile.occurrenceCount >= 1,
    "Local public HTML should preserve at least one verified BBB Business Profile reference."
  );

  const callbackUnderOneHour = claims.get("callback_under_1hr");
  assert(callbackUnderOneHour, "Public claim register missing callback_under_1hr claim.");
  assert(
    callbackUnderOneHour.occurrenceCount === 0,
    "Blog/content source must not include unsupported under-one-hour callback promises."
  );

  for (const proofGatedId of [
    "google_rating_4_9",
    "review_count_280",
    "callback_under_1hr",
    "financing_0_apr",
  ]) {
    const claim = claims.get(proofGatedId);
    assert(claim, `Public claim register missing ${proofGatedId}.`);
    assert(
      String(claim.status || "").includes("proof_gated") ||
        String(claim.expectedStatus || "").includes("proof_gated"),
      `Public claim ${proofGatedId} must remain proof-gated.`
    );
  }

  for (const publicPage of ["index.html", "about.html"]) {
    assert(
      !readFile(publicPage).includes("BBB Accredited"),
      `${publicPage} must not contain unsupported BBB Accredited wording.`
    );
    assert(
      readFile(publicPage).includes("BBB Business Profile"),
      `${publicPage} should use the supported BBB Business Profile wording.`
    );
  }
}

function checkEmailEvidence() {
  const source = readFile("data/attribution-email-evidence.csv");
  const forbiddenPatterns = [
    /password/i,
    /recovery code/i,
    /verification code/i,
    /\b279882\b/,
    /\b560315\b/,
    /capital n/i,
  ];
  for (const pattern of forbiddenPatterns) {
    assert(!pattern.test(source), `Sanitized email evidence contains forbidden sensitive pattern: ${pattern}`);
  }

  const rows = parseCsv(source);
  const rowById = new Map(rows.map((row) => [row.message_id, row]));
  for (const messageId of [
    "19d9d0fbc5316420",
    "19db65ad7da6a0f6",
    "outlook:ga4-tag-source",
    "outlook:ga4-tag-reply",
    "19dc12dbdb55f83d",
    "19dda4374e48b091",
    "outlook:technical-package-link-broken",
    "19e0448ac4747b59",
    "outlook:social-package-link-broken",
    "outlook:client-missing-connections",
    "19e6b6391f63f96d",
    "19e6b91bd425b4c5",
  ]) {
    assert(rowById.has(messageId), `Missing sanitized Gmail evidence row for ${messageId}.`);
    assert(rowById.get(messageId).secrets_excluded === "true", `${messageId} must mark secrets_excluded=true.`);
  }
  assert(rowById.has("search:none"), "Missing sanitized Gmail GTM search result row.");
  assert(rowById.has("search:servicetitan"), "Missing sanitized Gmail ServiceTitan search result row.");
  assert(rowById.has("outlook:gtm-search-none"), "Missing sanitized Outlook GTM search result row.");
  assert(rowById.has("search:gmail-current-recheck"), "Missing current sanitized Gmail recheck row.");
  assert(rowById.has("search:drive-current-recheck"), "Missing current sanitized Google Drive recheck row.");
  assert(
    rowById.get("search:gmail-current-recheck").sanitized_finding.includes("no Air Express GTM container id"),
    "Current Gmail recheck must preserve the no-GTM result."
  );
  assert(
    rowById.get("search:gmail-current-recheck").sanitized_finding.includes("no new property id"),
    "Current Gmail recheck must preserve the no-new-property-proof result."
  );
  assert(
    rowById.get("search:drive-current-recheck").sanitized_finding.includes("no Air Express-specific GA4 property id"),
    "Current Drive recheck must preserve the no-source-proof result."
  );
  assert(
    rows.some((row) => row.sanitized_finding.includes("no GTM container id")),
    "Email evidence should preserve the no-GTM-container finding."
  );
  assert(
    rows.some((row) => row.sanitized_finding.includes("G-JZ7PY32EVX")),
    "Email evidence should preserve the approved GA4 measurement id finding."
  );
  assert(
    rows.some((row) => row.sanitized_finding.includes("link was broken")),
    "Email evidence should preserve the Air Express broken package link finding."
  );
  assert(
    rows.some((row) => row.sanitized_finding.includes("Google Business Profile not connected")),
    "Email evidence should preserve the Google Business Profile not-connected finding."
  );
  assert(
    rows.some((row) => row.sanitized_finding.includes("No full ServiceTitan export")),
    "Email evidence should preserve the no-ServiceTitan-export finding."
  );
}

function checkContentBriefs() {
  const rows = parseCsv(readFile("data/content-briefs.csv"));
  assert(rows.length >= 10, `Expected at least 10 content briefs, received ${rows.length}.`);

  const requiredColumns = [
    "brief_id",
    "status",
    "working_title",
    "target_query",
    "buyer_stage",
    "recommended_slug",
    "outline",
    "internal_links",
    "proof_required",
    "publication_gate",
    "attribution_plan",
  ];
  for (const column of requiredColumns) {
    assert(Object.prototype.hasOwnProperty.call(rows[0], column), `Content briefs missing column ${column}.`);
  }

  for (const row of rows) {
    for (const column of requiredColumns) {
      assert(row[column], `Content brief ${row.brief_id || "(unknown)"} missing ${column}.`);
    }
    assert(
      row.attribution_plan.includes("GSC") || row.attribution_plan.includes("GA4"),
      `Content brief ${row.brief_id} is missing a GSC/GA4 attribution plan.`
    );
  }

  for (const slug of [
    "first-hot-week-ac-checklist-utah",
    "wildfire-smoke-hvac-filter-utah",
    "thermostat-settings-utah-heat-wave",
  ]) {
    assert(
      rows.some((row) => row.recommended_slug === slug),
      `Content briefs missing this-week slug ${slug}.`
    );
  }

  const briefDoc = readFile("docs/air-express-content-briefs.md");
  assert(briefDoc.includes("No public posts"), "Content brief doc must preserve no-public-post boundary.");
  assert(briefDoc.includes("data/content-briefs.csv"), "Content brief doc must link the content brief CSV.");

  const distributionRows = parseCsv(readFile("data/distribution-ledger.csv"));
  for (const assetId of [
    "blog-first-hot-week",
    "blog-wildfire-smoke",
    "blog-thermostat-heat-wave",
    "max-social-access",
    "max-case-study-proof",
  ]) {
    assert(
      distributionRows.some((row) => row.asset_id === assetId),
      `Distribution ledger missing ${assetId}.`
    );
  }

  const scheduleDoc = readFile("docs/air-express-blog-distribution-schedule.md");
  assert(scheduleDoc.includes("No public post"), "Distribution schedule must preserve no-public-post boundary.");
  assert(
    scheduleDoc.includes("first-hot-week-ac-checklist-utah"),
    "Distribution schedule missing first-hot-week post."
  );

  const socialDraft = readFile("docs/max-social-access-request-draft.md");
  assert(socialDraft.includes("Status: draft only"), "Max social access request must remain draft-only.");
  assert(
    socialDraft.includes("James@utlyze.com"),
    "Max social access request must state the default Outlook sender."
  );
  assert(
    socialDraft.includes("Please do not send passwords"),
    "Max social access request must preserve no-password instruction."
  );

  const caseStudyDraft = readFile("docs/max-case-study-outreach-draft.md");
  assert(caseStudyDraft.includes("Status: Draft only"), "Max case-study request must remain draft-only.");
  assert(
    caseStudyDraft.includes("James@utlyze.com"),
    "Max case-study request must state the default Outlook sender."
  );
  assert(
    caseStudyDraft.includes("We do not need customer private information"),
    "Max case-study request must preserve no-PII instruction."
  );

  const accessRequestPacket = readFile("docs/air-express-access-request-packet.md");
  assert(
    accessRequestPacket.includes("James@utlyze.com"),
    "Air Express access request packet must state the default Outlook sender."
  );
  assert(
    accessRequestPacket.includes("create a draft first"),
    "Air Express access request packet must preserve draft-first send boundary."
  );

  const publishReadySlug = "first-hot-week-ac-checklist-utah";
  const draftSlugs = [
    "wildfire-smoke-hvac-filter-utah",
    "thermostat-settings-utah-heat-wave",
  ];
  assert(
    readFile(`content/blog/${publishReadySlug}.md`).includes("draft: false"),
    "First-hot-week post must remain publication-ready in source."
  );
  assert(
    fs.existsSync(path.join(rootDir, `blog/${publishReadySlug}.html`)),
    "First-hot-week post must be generated by the normal blog build."
  );

  const generatedSurfaces = [
    ["blog index", readFile("blog/index.html")],
    ["resources page", readFile("resources.html")],
    ["RSS feed", readFile("blog/rss.xml")],
    ["sitemap", readFile("sitemap.xml")],
  ];
  for (const [surfaceName, source] of generatedSurfaces) {
    assert(
      source.includes(`${publishReadySlug}.html`),
      `${surfaceName} must include the first-hot-week post.`
    );
  }

  for (const slug of draftSlugs) {
    assert(
      readFile(`content/blog/${slug}.md`).includes("draft: true"),
      `${slug} must remain draft-only in source.`
    );
    assert(
      !fs.existsSync(path.join(rootDir, `blog/${slug}.html`)),
      `${slug} must not be generated by the normal blog build.`
    );
    for (const [surfaceName, source] of generatedSurfaces) {
      assert(!source.includes(slug), `${surfaceName} must not include draft post ${slug}.`);
    }
  }

  const report = readFile("pages/content-readiness-report.html");
  for (const requiredText of [
    "Air Express Content Readiness Report",
    "Issue #31 separate from #24-#30",
    "No public distribution attempted",
    "first-hot-week-ac-checklist-utah",
    "wildfire-smoke-hvac-filter-utah",
    "thermostat-settings-utah-heat-wave",
    "max-social-access",
    "max-case-study-proof",
    "docs/max-social-access-request-draft.md",
    "docs/max-case-study-outreach-draft.md",
  ]) {
    assert(report.includes(requiredText), `Content readiness report missing ${requiredText}.`);
  }
  assert(
    readFile("pages/index.html").includes("content-readiness-report.html"),
    "Pages index must link the content readiness report."
  );
  const packageJson = JSON.parse(readFile("package.json"));
  assert(
    packageJson.scripts?.["build:content-readiness-report"] ===
      "node scripts/build-content-readiness-report.mjs",
    "package.json must expose build:content-readiness-report."
  );
}

function checkHermesSeoGeoAuditPacket() {
  const packet = JSON.parse(readFile("output/hermes-seo-geo-audit/audit-run-packet.json"));
  assert(
    packet.status === "ready_for_read_only_agent",
    `Expected Hermes packet ready_for_read_only_agent, received ${packet.status}.`
  );
  assert(packet.target?.domain === "airexpressutah.com", "Hermes packet must target Air Express.");
  assert(packet.competitorPlan?.mode === "hybrid", "Hermes packet must preserve hybrid competitor mode.");
  assert(
    packet.competitorPlan?.autoSelectCompetitors === true,
    "Hermes packet must allow automatic competitor selection."
  );
  assert(
    Array.isArray(packet.outputContract) && packet.outputContract.includes("competitor-comparison.md"),
    "Hermes packet must require the competitor comparison output."
  );

  const inputEvidencePaths = (packet.inputEvidence || []).map((row) => row.path);
  for (const requiredPath of [
    "data/issue-24-30-completion-audit.csv",
    "data/issue-24-30-acceptance-criteria-audit.csv",
    "data/newreward-cross-repo-evidence.csv",
    "data/google-history/history-pull-status.json",
    "data/live-measurement-path-check.json",
    "data/servicetitan-export-access-check.json",
    "data/seo-geo-attribution-audit.json",
    "docs/source-evidence-map.md",
  ]) {
    assert(inputEvidencePaths.includes(requiredPath), `Hermes packet missing input evidence ${requiredPath}.`);
  }

  const prompt = readFile("output/hermes-seo-geo-audit/audit-run-prompt.md");
  assert(prompt.includes("Repo-Local Evidence Inputs"), "Hermes prompt must list repo-local evidence inputs.");
  assert(
    prompt.includes("data/newreward-cross-repo-evidence.csv"),
    "Hermes prompt must include the cross-repo evidence ledger."
  );
  assert(prompt.includes("Hard Stops"), "Hermes prompt must preserve hard stops.");
  assert(
    prompt.includes("Do not mutate DNS"),
    "Hermes prompt must preserve no-provider-mutation boundaries."
  );

  const brief = readFile("output/hermes-seo-geo-audit/latest-brief.md");
  assert(brief.includes("Current Evidence Inputs"), "Hermes latest brief must include current evidence inputs.");
  assert(
    brief.includes("data/newreward-cross-repo-evidence.csv"),
    "Hermes latest brief must include the cross-repo evidence ledger."
  );
}

function checkMappingReconciliationPacket() {
  const packet = readFile("docs/air-express-newreward-mapping-reconciliation-packet.md");

  for (const requiredText of [
    "cmmwe8so000077kqptwysqaem",
    "cmmwe8ri500007kqpd05kb4e5",
    "cmnfh6pi9000dj47kvq1rhqo8",
    "cmorqbs9j001r5nr1h25vosp8",
    "G-JZ7PY32EVX",
    "activation correction",
    "onboardingDayOfWeek",
    "billingOwnerTenantId",
    "BEGIN READ ONLY",
    "ROLLBACK",
    "Pass / Fail Criteria",
    "Fail closed",
    "No database writes or provider mutations performed",
  ]) {
    assert(packet.includes(requiredText), `Mapping reconciliation packet missing ${requiredText}.`);
  }

  assert(
    !packet.includes("cmmwe8ri500007kqptwysqaem"),
    "Mapping reconciliation packet contains a tenant/client id transposition."
  );
  assert(
    packet.includes("Do not paste connection strings"),
    "Mapping reconciliation packet must preserve no-connection-string boundary."
  );
  assert(
    packet.includes("not executed against production"),
    "Mapping reconciliation packet must state it has not executed against production."
  );
}

function checkGoogleReadonlyReconnectPacket() {
  const packet = readFile("docs/air-express-google-readonly-reconnect-packet.md");

  for (const requiredText of [
    "newrewardplatform@gmail.com",
    "james@jamesbrady.org",
    "webmasters.readonly",
    "analytics.readonly",
    "business.manage",
    "G-JZ7PY32EVX",
    "cmorqbs9j001r5nr1h25vosp8",
    "gcloud auth application-default login",
    "npm run pull:gsc-ga4-history",
    "Stop Gates",
    "No OAuth consent",
  ]) {
    assert(packet.includes(requiredText), `Google read-only reconnect packet missing ${requiredText}.`);
  }

  assert(
    packet.includes("Do not print or commit the credential file"),
    "Google read-only reconnect packet must preserve credential-file boundary."
  );
  assert(
    packet.includes("No token, cookie, credential"),
    "Google read-only reconnect packet must preserve no-secret output criteria."
  );
}

function checkDocsPointers() {
  const readme = readFile("README.md");
  const transfer = readFile("AGENT_TRANSFER_PACKET.md");
  for (const requiredText of [
    "npm run build:issue-blocker-report",
    "npm run build:content-readiness-report",
    "npm run verify:issue-evidence-alignment",
    "pages/index.html",
    "pages/air-express-impact-trace.html",
    "pages/issue-24-30-blocker-report.html",
    "pages/content-readiness-report.html",
    "data/issue-24-30-completion-audit.csv",
    "data/issue-24-30-acceptance-criteria-audit.csv",
    "data/issue-evidence-alignment-check.json",
    "data/newreward-cross-repo-evidence.csv",
    "data/attribution-email-evidence.csv",
    "data/content-briefs.csv",
    "data/newreward-air-express-provider-readonly-recheck.json",
    "data/live-measurement-path-check.json",
    "data/owned-site-delivery-sync-check.json",
    "data/public-claim-register.json",
    "data/servicetitan-export-access-check.json",
    "data/servicetitan-api-lead-history-summary.json",
    "data/servicetitan-api-lead-history-redacted.csv",
    "data/servicetitan-attribution-join-probe.json",
    "docs/air-express-content-briefs.md",
    "docs/air-express-blog-distribution-schedule.md",
    "docs/air-express-access-request-packet.md",
    "docs/air-express-owned-site-delivery-sync-packet.md",
    "docs/air-express-servicetitan-redacted-export-import.md",
    "docs/air-express-newreward-mapping-reconciliation-packet.md",
    "docs/air-express-google-readonly-reconnect-packet.md",
    "docs/max-social-access-request-draft.md",
    "docs/max-case-study-outreach-draft.md",
  ]) {
    assert(readme.includes(requiredText), `README.md missing ${requiredText}.`);
    assert(transfer.includes(requiredText), `AGENT_TRANSFER_PACKET.md missing ${requiredText}.`);
  }
}

try {
  checkRequiredFiles();
  checkPagesLinks();
  checkIssueMatrix();
  checkIssueEvidenceAlignment();
  checkCrossRepoEvidence();
  checkAcceptanceCriteriaAudit();
  checkSeoAudit();
  checkHistoryStatus();
  checkNewRewardMappingStatus();
  checkLiveMeasurementPath();
  checkOwnedSiteDeliverySync();
  checkOwnedSiteDeliverySyncPacket();
  checkSiteFileManifest();
  checkPublicClaimRegister();
  checkServiceTitanProof();
  checkServiceTitanExportAccess();
  checkServiceTitanAttributionJoinProbe();
  checkEmailEvidence();
  checkContentBriefs();
  checkHermesSeoGeoAuditPacket();
  checkMappingReconciliationPacket();
  checkGoogleReadonlyReconnectPacket();
  checkDocsPointers();
  console.log("Onboarding evidence verification passed.");
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
}
