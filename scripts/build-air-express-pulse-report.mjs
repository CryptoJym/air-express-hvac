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

function statusClass(value) {
  const text = String(value || "").toLowerCase();
  if (/verified|ready_in_source|public_baseline_seeded|saved_snapshot|complete|available/.test(text)) {
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

const snapshotHistory = readJson("data/google-history/newreward-snapshot-history.json");
const seoAudit = readJson("data/seo-geo-deep-dive-audit.json");
const historyStatus = readJson("data/google-history/history-pull-status.json");
const serviceTitanStatus = readJson("data/servicetitan-export-access-check.json");
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
    surface: "GBP",
    status: historyStatus.gbp?.status || "proof_pending",
    evidence: historyStatus.gbp?.evidence || "Business Profile location proof is not available locally.",
    nextAction: "Confirm Air Express location visibility after scoped account access.",
  },
  {
    surface: "ServiceTitan",
    status: serviceTitanStatus.status || "blocked_env",
    evidence: serviceTitanStatus.status === "blocked_env"
      ? "Local ServiceTitan export/API keys are not present in the approved env sources."
      : "ServiceTitan export status needs review.",
    nextAction: "Import an approved redacted export or enable read-only export/API access.",
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
    p { margin: 0 0 12px; color: var(--muted); max-width: 980px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; }
    a { color: var(--blue); }
    .meta, .grid { display: grid; gap: 12px; }
    .meta { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-top: 18px; }
    .grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .card { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: var(--white); min-height: 120px; }
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
    .note { padding: 12px 14px; border-left: 4px solid var(--warn); background: #fff8ec; color: var(--ink); max-width: 980px; }
    .decision { padding: 14px; border: 1px solid var(--line); background: var(--panel); border-radius: 8px; max-width: 980px; }
    .muted { color: var(--muted); }
    .scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; border: 1px solid var(--line); background: var(--white); }
    th, td { border-bottom: 1px solid var(--line); padding: 10px; text-align: left; vertical-align: top; font-size: 14px; }
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
      This report is local evidence only. It does not claim live publication, live provider access, or revenue impact. Saved New Reward visibility snapshots are useful directional proof, while GSC/GA4/GBP read scopes, live GA4 delivery, and ServiceTitan joins remain required for hard attribution.
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
      <article class="card"><h3>Attribution Score</h3><div class="metric bad">${escapeHtml(attributionScore)}</div><p>Blocked until direct Google scopes, GA4 property/live tag, GBP proof, and ServiceTitan joins are restored.</p></article>
    </section>

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
      <td><a href="${escapeHtml(row.url)}">${escapeHtml(row.url)}</a></td>
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
