#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const outputPath = "pages/air-express-pulse-report.html";

function read(relativePath, fallback = "") {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) return fallback;
  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath, fallback = {}) {
  const source = read(relativePath, "");
  if (!source) return fallback;
  return JSON.parse(source);
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
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.length > 0)) rows.push(row);

  const [headers, ...records] = rows;
  if (!headers?.length) return [];
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""]))
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function formatInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "pending";
  return number.toLocaleString("en-US");
}

function formatDecimal(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "pending";
  return number.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatPercent(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "pending";
  return `${(number * 100).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

function labelize(value) {
  return String(value || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMix(object = {}) {
  const entries = Object.entries(object)
    .filter(([, value]) => Number(value || 0) > 0)
    .sort(([, a], [, b]) => Number(b || 0) - Number(a || 0));
  if (!entries.length) return "none observed";
  return entries.map(([key, value]) => `${labelize(key)}: ${formatInteger(value)}`).join("; ");
}

function statusClass(value) {
  const text = String(value || "").toLowerCase();
  if (/verified|ready_in_source|public_baseline_seeded|saved_snapshot|complete|available|no_db_blocker|rows_found|live/.test(text)) {
    return "good-state";
  }
  if (/prepared|review|brief|pending|partial|needs_public_verification|needs_owner/.test(text)) {
    return "prepared-state";
  }
  if (/blocked|gated|high_risk|missing|revoked|error/.test(text)) {
    return "blocked-state";
  }
  return "neutral-state";
}

function statePill(value) {
  return `<span class="state ${statusClass(value)}">${escapeHtml(value || "unknown")}</span>`;
}

function table(headers, rows) {
  return `<div class="scroll"><table>
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>
      ${rows.join("\n      ")}
    </tbody>
  </table></div>`;
}

function publicCheckDisplayUrl(row) {
  const sourceUrl = String(row.url || "");
  let hostname = "";
  try {
    hostname = new URL(sourceUrl).hostname;
  } catch {
    hostname = "";
  }
  if (hostname === "airexpresshvac.net") return "legacy apex redirect";
  if (hostname === "www.airexpresshvac.net") return "legacy www redirect";
  return sourceUrl;
}

function publicCheckHref(row) {
  return row.final_url || row.url || "";
}

const snapshotHistory = readJson("data/google-history/newreward-snapshot-history.json");
const seoAudit = readJson("data/seo-geo-deep-dive-audit.json");
const historyStatus = readJson("data/google-history/history-pull-status.json");
const serviceTitanStatus = readJson("data/servicetitan-export-access-check.json");
const serviceTitanLeadSummary = readJson("data/servicetitan-api-lead-history-summary.json");
const providerMapping = readJson("data/newreward-air-express-provider-readonly-recheck.json");

const pulseItems = parseCsv(read("data/air-express-pulse-items.csv"));
const hypotheses = parseCsv(read("data/air-express-visibility-revenue-hypotheses.csv"));
const weeklyMetrics = parseCsv(read("data/air-express-weekly-pulse-metrics.csv"));
const competitors = parseCsv(read("data/air-express-competitor-baseline-ledger.csv"));
const contentBriefs = parseCsv(read("data/content-briefs.csv"));
const issueMap = parseCsv(read("data/air-express-next-action-issue-map.csv"));
const publicChecks = parseCsv(read("data/air-express-public-http-checks.csv"));

const latestGsc = snapshotHistory.gscSnapshotSummary?.latest || {};
const aiByEngine = Array.isArray(snapshotHistory.aiByEngine) ? snapshotHistory.aiByEngine : [];
const aiByWeek = Array.isArray(snapshotHistory.aiByWeek) ? snapshotHistory.aiByWeek : [];
const latestAiWeek = aiByWeek.at(-1) || {};
const totalAiMentions = aiByEngine.reduce((total, row) => total + Number(row.mentions || 0), 0);
const attributionScore = seoAudit.scores?.attribution ?? "pending";
const geoScore = seoAudit.scores?.geo ?? "pending";
const technicalScore = seoAudit.scores?.technical ?? "pending";
const messagingScore = seoAudit.scores?.messaging ?? "pending";
const readyBriefs = contentBriefs.filter((row) => /ready/.test(row.status || "")).length;
const blockedHypotheses = hypotheses.filter((row) => /blocked/.test(row.validation_status || row.blocker || "")).length;
const competitorSeeds = competitors.filter((row) => row.entity_type === "competitor").length;
const generatedAt = new Date().toISOString();
const serviceTitanWeeklyRows = Array.isArray(serviceTitanLeadSummary.completeWeeklyTrend)
  ? serviceTitanLeadSummary.completeWeeklyTrend
  : Object.entries(serviceTitanLeadSummary.countsByWeek || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({
      week,
      totalLeads: count,
      websiteCampaignLeads: serviceTitanLeadSummary.websiteCampaignCountsByWeek?.[week] || 0,
      serviceTypes: serviceTitanLeadSummary.countsByWeekServiceType?.[week] || {},
      statuses: serviceTitanLeadSummary.countsByWeekStatus?.[week] || {},
      captchaPeriod: "not_recorded",
    }));
const serviceTitanServiceRows = Object.entries(serviceTitanLeadSummary.countsByServiceType || {})
  .sort(([, a], [, b]) => Number(b || 0) - Number(a || 0))
  .map(([serviceType, count]) => ({
    serviceType,
    count,
    websiteCount: serviceTitanLeadSummary.websiteCampaignCountsByServiceType?.[serviceType] || 0,
  }));
const captchaSummary = serviceTitanLeadSummary.captcha || {};
const captchaCounts = serviceTitanLeadSummary.countsByCaptchaPeriod || {};
const captchaQuality = serviceTitanLeadSummary.qualityProxyByCaptchaPeriod || {};
const edgeDelivery = providerMapping.rootCauseSummary?.edgeDelivery || {};

const providerRows = [
  {
    surface: "GSC",
    status: historyStatus.gsc?.status || providerMapping.rootCauseSummary?.gsc?.connectionStatus || "blocked_or_pending",
    evidence: historyStatus.gsc?.evidence || providerMapping.rootCauseSummary?.gsc?.credentialStatus || "Direct provider proof pending.",
    nextAction: "Reconnect or repair GSC for the canonical Air Express website id, then rerun history pulls.",
  },
  {
    surface: "GA4",
    status: historyStatus.ga4?.status || (providerMapping.rootCauseSummary?.ga4?.propertyId ? "property_selected" : "property_pending"),
    evidence: providerMapping.rootCauseSummary?.ga4?.propertyId
      ? `Property ${providerMapping.rootCauseSummary.ga4.propertyId} selected.`
      : `GA4 provider evidence is ${providerMapping.rootCauseSummary?.ga4?.credentialStatus || "pending"} / ${providerMapping.rootCauseSummary?.ga4?.connectionStatus || "pending"} and propertyId remains blank or scope-gated.`,
    nextAction: "Select the GA4 property/web stream containing G-JZ7PY32EVX and verify live delivery.",
  },
  {
    surface: "New Reward Edge",
    status: edgeDelivery.status || "edge_state_pending",
    evidence: edgeDelivery.activeVersionId
      ? `${edgeDelivery.accessStatus || "unknown"} / ${edgeDelivery.deploymentStatus || "unknown"}; active version ${edgeDelivery.activeVersionId}; latest verification ${edgeDelivery.latestVerification?.status || "unknown"}.`
      : "Read-only edge delivery evidence is pending.",
    nextAction: edgeDelivery.nextAction || "Verify the canonical apex after any approved edge publish or delivery sync.",
  },
  {
    surface: "GBP",
    status: "not_included_current_pass",
    evidence: "Google Business Profile is intentionally excluded from this refresh; James scoped the immediate expectation to GSC and GA4.",
    nextAction: "Handle GBP separately after GSC/GA4 attribution and live measurement are repaired.",
  },
  {
    surface: "ServiceTitan",
    status: serviceTitanLeadSummary.status || serviceTitanStatus.status || "blocked_env",
    evidence: serviceTitanLeadSummary.status === "api_history_pulled"
      ? `${serviceTitanLeadSummary.rows || 0} redacted lead row(s) pulled; ${serviceTitanLeadSummary.websiteCampaignLeadCount || 0} match the configured website campaign; booking and revenue joins are intentionally out of scope.`
      : serviceTitanStatus.status === "blocked_env"
        ? "Local ServiceTitan export/API keys are not present in the approved env sources."
        : "ServiceTitan export status needs review.",
    nextAction: serviceTitanLeadSummary.status === "api_history_pulled"
      ? "Use lead counts for trend comparison and repair live CAPTCHA/canonical delivery before claiming lead-system impact."
      : "Import an approved redacted export or enable read-only export/API access.",
  },
];

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Air Express Pulse And Revenue Visibility Report</title>
  <style>
    :root {
      --ink: #162231;
      --muted: #5e6b78;
      --line: #d9e2ea;
      --panel: #f6f9fb;
      --good: #287549;
      --warn: #9f5d00;
      --bad: #b33434;
      --blue: #0d66a2;
      --white: #fff;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--white); line-height: 1.45; }
    header { padding: 34px clamp(18px, 5vw, 58px) 24px; background: #eef6fb; border-bottom: 1px solid var(--line); }
    main { padding: 24px clamp(18px, 5vw, 58px) 56px; }
    h1 { margin: 0 0 8px; font-size: clamp(28px, 4vw, 44px); letter-spacing: 0; }
    h2 { margin: 30px 0 12px; font-size: 20px; letter-spacing: 0; }
    h3 { margin: 0 0 8px; font-size: 16px; letter-spacing: 0; }
    p { margin: 0 0 12px; color: var(--muted); max-width: 980px; overflow-wrap: anywhere; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; white-space: normal; overflow-wrap: anywhere; }
    a { color: var(--blue); }
    .meta, .grid { display: grid; gap: 12px; }
    .meta { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-top: 18px; }
    .grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .card { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: var(--white); min-height: 120px; min-width: 0; overflow-wrap: anywhere; }
    .metric { font-size: 34px; font-weight: 750; margin: 2px 0 4px; }
    .pill, .state { display: inline-block; border-radius: 999px; padding: 5px 9px; font-size: 12px; font-weight: 750; white-space: nowrap; }
    .pill { border: 1px solid var(--line); background: var(--white); }
    .good { color: var(--good); }
    .warn { color: var(--warn); }
    .bad { color: var(--bad); }
    .good-state { background: var(--good); color: var(--white); }
    .prepared-state { background: var(--blue); color: var(--white); }
    .blocked-state { background: var(--bad); color: var(--white); }
    .neutral-state { background: var(--muted); color: var(--white); }
    .note { padding: 12px 14px; border-left: 4px solid var(--warn); background: #fff8ec; color: var(--ink); max-width: 980px; overflow-wrap: anywhere; }
    .decision { padding: 14px; border: 1px solid var(--line); background: var(--panel); border-radius: 8px; max-width: 980px; overflow-wrap: anywhere; }
    .muted { color: var(--muted); }
    .scroll { overflow-x: auto; max-width: 100%; }
    table { width: 100%; border-collapse: collapse; border: 1px solid var(--line); background: var(--white); }
    th, td { border-bottom: 1px solid var(--line); padding: 10px; text-align: left; vertical-align: top; font-size: 14px; overflow-wrap: anywhere; word-break: break-word; }
    th { background: var(--panel); font-size: 13px; }
  </style>
</head>
<body>
  <header>
    <h1>Air Express Pulse And Revenue Visibility Report</h1>
    <p>Pages-only weekly control surface for local HVAC signals, SEO/GEO strategy, competitor/entity baseline, visibility metrics, revenue hypotheses, and proof gates.</p>
    <div class="meta">
      <span class="pill">Generated ${escapeHtml(generatedAt)}</span>
      <span class="pill">Issue #36 growth lane</span>
      <span class="pill">No public publish or provider mutation</span>
      <span class="pill">Directional until attribution joins are restored</span>
    </div>
  </header>
  <main>
    <section class="note">
      This report is local evidence only. It does not claim live publication, live provider access, or revenue impact. Saved New Reward visibility snapshots are useful directional proof, while direct GSC/GA4 read scopes, canonical live GA4 delivery, and live lead-path health remain required for hard attribution. Google Business Profile is not included in this pass.
    </section>

    <h2>Strategy Decision</h2>
    <section class="decision">
      <p><strong>Use a weekly Utah County Home Comfort Pulse first.</strong> Feed it into the summer blog series, service-area proof pages, and case-study pipeline. Do not lead with a generic news hub until entity cleanup and proof-led content are stronger.</p>
      <p>First cleanup priority: reconcile Air Express, One Hour, old-domain, review/listing, and BBB/trust signals so AI and local search surfaces receive one clear entity story.</p>
    </section>

    <h2>Current Visibility Spine</h2>
    <section class="grid">
      <article class="card"><h3>Saved GSC Impressions</h3><div class="metric good">${formatInteger(latestGsc.total_impressions)}</div><p>${escapeHtml(latestGsc.dateRange?.start || "pending")} to ${escapeHtml(latestGsc.dateRange?.end || "pending")} from saved New Reward snapshots.</p></article>
      <article class="card"><h3>Saved GSC Clicks</h3><div class="metric good">${formatInteger(latestGsc.total_clicks)}</div><p>CTR ${formatPercent(latestGsc.average_ctr, 1)}; average position ${formatDecimal(latestGsc.average_position, 1)}.</p></article>
      <article class="card"><h3>Saved AI Mentions</h3><div class="metric warn">${formatInteger(totalAiMentions)}</div><p>Latest weekly saved row: ${formatInteger(latestAiWeek.mentions)} mentions and ${formatInteger(latestAiWeek.citations)} citations.</p></article>
      <article class="card"><h3>Attribution Score</h3><div class="metric bad">${escapeHtml(attributionScore)}</div><p>Blocked until direct GSC/GA4 scopes, GA4 property/live tag, and live lead-path health are restored.</p></article>
    </section>

    <h2>CAPTCHA / Lead Quality Marker</h2>
    <section class="decision">
      <p><strong>Cloudflare Turnstile source was added on ${escapeHtml(captchaSummary.date || "pending")}.</strong> Git evidence: ${escapeHtml(captchaSummary.commit || "pending")} at ${escapeHtml(captchaSummary.timestamp || "pending")}.</p>
      <p>Current live check still shows the public forms serving older assets and <code>/api/turnstile/config</code> returning 404, so this is a source-ready marker, not verified live CAPTCHA impact.</p>
    </section>
    ${table(["Period", "Lead Count", "Dismissed", "Open", "Converted", "Dismissed Rate", "Interpretation"], [
      "before_source_captcha",
      "source_captcha_day_or_after",
    ].map((period) => {
      const quality = captchaQuality[period] || {};
      return `<tr>
        <td>${labelize(period)}</td>
        <td>${formatInteger(captchaCounts[period] || quality.total || 0)}</td>
        <td>${formatInteger(quality.dismissed || 0)}</td>
        <td>${formatInteger(quality.open || 0)}</td>
        <td>${formatInteger(quality.converted || 0)}</td>
        <td>${formatPercent(quality.dismissedRate || 0)}</td>
        <td>${escapeHtml(quality.interpretation || "Pending ServiceTitan lead evidence.")}</td>
      </tr>`;
    }))}

    <h2>SEO/GEO Scores</h2>
    <section class="grid">
      <article class="card"><h3>Technical SEO</h3><div class="metric good">${escapeHtml(technicalScore)}</div><p>Latest local SEO/GEO deep-dive score.</p></article>
      <article class="card"><h3>GEO Readiness</h3><div class="metric good">${escapeHtml(geoScore)}</div><p>Remaining work is mainly entity/citation cleanup and content extractability.</p></article>
      <article class="card"><h3>Messaging</h3><div class="metric good">${escapeHtml(messagingScore)}</div><p>Local message consistency is strong, with proof gates still enforced.</p></article>
      <article class="card"><h3>Ready Briefs</h3><div class="metric warn">${formatInteger(readyBriefs)}</div><p>Prepared assets still need delivery and proof-state separation.</p></article>
    </section>

    <h2>Weekly Pulse Items</h2>
    ${table(["Date", "Type", "Status", "Title", "Evidence", "Next Action"], pulseItems.map((row) => `<tr>
      <td>${escapeHtml(row.date)}</td>
      <td>${escapeHtml(row.type)}</td>
      <td>${statePill(row.status)}</td>
      <td>${escapeHtml(row.title)}<br><span class="muted">${escapeHtml(row.summary)}</span></td>
      <td><code>${escapeHtml(row.source_path)}</code><br>${statePill(row.evidence_state)}</td>
      <td>${escapeHtml(row.next_action)}</td>
    </tr>`))}

    <h2>Visibility And Revenue Hypotheses</h2>
    <p>${formatInteger(blockedHypotheses)} hypothesis row(s) still depend on blocked or proof-gated data. Use these as attribution candidates, not claims.</p>
    ${table(["ID", "Category", "Hypothesis", "Leading Metric", "Lagging Metric", "Status", "Blocker"], hypotheses.map((row) => `<tr>
      <td><code>${escapeHtml(row.id)}</code></td>
      <td>${escapeHtml(row.category)}</td>
      <td>${escapeHtml(row.hypothesis)}</td>
      <td>${escapeHtml(row.leading_metric)}</td>
      <td>${escapeHtml(row.lagging_metric)}</td>
      <td>${statePill(row.validation_status)}</td>
      <td>${escapeHtml(row.blocker)}</td>
    </tr>`))}

    <h2>Weekly Metrics</h2>
    ${table(["Week", "GSC", "AI Visibility", "GA4", "ServiceTitan", "Coverage"], weeklyMetrics.map((row) => `<tr>
      <td>${escapeHtml(row.week_start)}</td>
      <td>${formatInteger(row.gsc_impressions)} impressions / ${formatInteger(row.gsc_clicks)} clicks / avg position ${escapeHtml(row.avg_position)}</td>
      <td>${formatInteger(row.ai_snapshots)} snapshots / ${formatInteger(row.ai_mentions)} mentions / ${formatInteger(row.ai_citations)} citations</td>
      <td>${escapeHtml(row.ga4_sessions)} sessions; forms ${escapeHtml(row.lead_form_submissions)}</td>
      <td>${escapeHtml(row.servicetitan_leads)}; booked ${escapeHtml(row.booked_count)}; revenue ${escapeHtml(row.revenue_amount)}</td>
      <td>${statePill(row.coverage_status)}<br>${escapeHtml(row.notes)}</td>
    </tr>`))}

    <h2>ServiceTitan Lead Trend</h2>
    ${table(["Week", "Redacted Leads", "Configured Website Campaign", "Service Mix", "Status Mix", "CAPTCHA Marker", "Read"], serviceTitanWeeklyRows.length ? serviceTitanWeeklyRows.map((row) => `<tr>
      <td>${escapeHtml(row.week)}</td>
      <td>${formatInteger(row.totalLeads ?? row.count)}</td>
      <td>${formatInteger(row.websiteCampaignLeads ?? row.websiteCount)}</td>
      <td>${escapeHtml(formatMix(row.serviceTypes))}</td>
      <td>${escapeHtml(formatMix(row.statuses))}</td>
      <td>${statePill(row.captchaPeriod)}</td>
      <td>Lead-count trend only; booking and revenue joins are outside this report scope.</td>
    </tr>`) : [`<tr><td>pending</td><td>0</td><td>0</td><td>none observed</td><td>none observed</td><td>${statePill("not_pulled")}</td><td>ServiceTitan API lead history has not been pulled.</td></tr>`])}

    <h2>ServiceTitan Service-Type Mix</h2>
    ${table(["Service Type", "Redacted Leads", "Configured Website Campaign", "Read"], serviceTitanServiceRows.length ? serviceTitanServiceRows.map((row) => `<tr>
      <td>${escapeHtml(labelize(row.serviceType))}</td>
      <td>${formatInteger(row.count)}</td>
      <td>${formatInteger(row.websiteCount)}</td>
      <td>Derived from fixed keyword classification and safe ServiceTitan IDs only; raw lead summary/customer data is not stored.</td>
    </tr>`) : [`<tr><td>pending</td><td>0</td><td>0</td><td>ServiceTitan API lead history has not been pulled.</td></tr>`])}

    <h2>Competitor And Entity Baseline</h2>
    <p>${formatInteger(competitorSeeds)} competitor seed row(s) are ready for read-only geolocated local-pack and AI-answer tracking. Current rows are baseline seeds, not rank proof.</p>
    ${table(["Brand", "Type", "Confidence", "Domain", "Focus", "Issue / Gap", "State", "Next Action"], competitors.map((row) => `<tr>
      <td>${escapeHtml(row.brand)}</td>
      <td>${escapeHtml(row.entity_type)}</td>
      <td>${escapeHtml(row.confidence)}</td>
      <td><a href="${escapeHtml(row.public_url)}">${escapeHtml(row.canonical_domain)}</a></td>
      <td>${escapeHtml(row.service_area_focus)}<br>${escapeHtml(row.service_lines)}</td>
      <td>${escapeHtml(row.observed_entity_issue_or_gap)}</td>
      <td>${statePill(row.evidence_state)}</td>
      <td>${escapeHtml(row.next_action)}</td>
    </tr>`))}

    <h2>AI Engine Split</h2>
    ${table(["Engine", "Snapshots", "Mentions", "Citations", "Current Meaning"], aiByEngine.map((row) => `<tr>
      <td>${escapeHtml(row.engine)}</td>
      <td>${formatInteger(row.snapshots)}</td>
      <td>${formatInteger(row.mentions)}</td>
      <td>${formatInteger(row.citations)}</td>
      <td>${Number(row.mentions || 0) > 0 ? "Observed visibility exists here." : "No observed saved mentions yet; prompt/content/entity cleanup should target this gap."}</td>
    </tr>`))}

    <h2>Provider And Attribution Gates</h2>
    ${table(["Surface", "Status", "Evidence", "Next Action"], providerRows.map((row) => `<tr>
      <td>${escapeHtml(row.surface)}</td>
      <td>${statePill(row.status)}</td>
      <td>${escapeHtml(row.evidence)}</td>
      <td>${escapeHtml(row.nextAction)}</td>
    </tr>`))}

    <h2>Public HTTP Checks</h2>
    ${table(["Checked", "URL", "Status", "Evidence", "Next Action", "Issue"], publicChecks.map((row) => `<tr>
      <td>${escapeHtml(row.checked_at)}</td>
      <td><a href="${escapeHtml(publicCheckHref(row))}">${escapeHtml(publicCheckDisplayUrl(row))}</a></td>
      <td>${statePill(row.status)}</td>
      <td>${escapeHtml(row.evidence)}</td>
      <td>${escapeHtml(row.next_action)}</td>
      <td><a href="https://github.com/CryptoJym/air-express-hvac/issues/${escapeHtml(row.issue)}">#${escapeHtml(row.issue)}</a></td>
    </tr>`))}

    <h2>Issue Map And Closeout State</h2>
    ${table(["Issue", "Lane", "Status", "Private Evidence", "Blocker", "Next Action"], issueMap.map((row) => `<tr>
      <td><a href="https://github.com/CryptoJym/air-express-hvac/issues/${escapeHtml(row.issue_number)}">#${escapeHtml(row.issue_number)}</a><br>${escapeHtml(row.title)}</td>
      <td>${escapeHtml(row.lane)}</td>
      <td>${statePill(row.status)}<br>${escapeHtml(row.completion_state)}</td>
      <td>${escapeHtml(row.private_pages_evidence)}</td>
      <td>${escapeHtml(row.current_blocker)}</td>
      <td>${escapeHtml(row.next_action)}</td>
    </tr>`))}

    <h2>Proof Gates Before Public Claims</h2>
    <table>
      <thead><tr><th>Claim Area</th><th>Gate</th></tr></thead>
      <tbody>
        <tr><td>BBB / review / best-company claims</td><td>Verify current live source and update public claim register before reuse.</td></tr>
        <tr><td>Rebate, tax-credit, utility, or savings claims</td><td>Check official source on publish date; do not imply 2026 federal credit availability without current support.</td></tr>
        <tr><td>Health outcomes from IAQ or filters</td><td>Use official IAQ guidance only; no medical or health-outcome promises.</td></tr>
        <tr><td>Case studies and revenue impact</td><td>Require Max-approved story, permission status, redacted source proof, and ServiceTitan/GA4 join evidence where applicable.</td></tr>
      </tbody>
    </table>
  </main>
</body>
</html>
`;

fs.mkdirSync(path.dirname(path.join(rootDir, outputPath)), { recursive: true });
fs.writeFileSync(path.join(rootDir, outputPath), html);
console.log(`Wrote ${path.join(rootDir, outputPath)}`);
