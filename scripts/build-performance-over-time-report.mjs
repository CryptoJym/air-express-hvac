#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outJson = "data/air-express-performance-over-time.json";
const outHtml = "pages/performance-over-time-report.html";

function readJson(relativePath, fallback = {}) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return fallback;
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pct(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "pending";
  return `${(number * 100).toFixed(digits)}%`;
}

function signed(value, digits = 0) {
  const number = Number(value || 0);
  const fixed = digits ? number.toFixed(digits) : String(Math.round(number));
  return number > 0 ? `+${fixed}` : fixed;
}

function fmt(value) {
  const number = Number(value);
  if (Number.isFinite(number)) return number.toLocaleString("en-US");
  return value ?? "pending";
}

function distinctGscSnapshots(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = [
      row.dateRange?.start || "",
      row.dateRange?.end || "",
      row.total_clicks,
      row.total_impressions,
      row.row_count,
      row.average_position,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function firstToLatestGsc(rows = []) {
  const distinct = distinctGscSnapshots(rows);
  const first = distinct[0] || null;
  const latest = distinct.at(-1) || null;
  const previous = distinct.length > 1 ? distinct.at(-2) : null;
  return {
    distinctWindows: distinct.length,
    first,
    previous,
    latest,
    firstToLatest: first && latest ? {
      impressions: Number(latest.total_impressions || 0) - Number(first.total_impressions || 0),
      clicks: Number(latest.total_clicks || 0) - Number(first.total_clicks || 0),
      rows: Number(latest.row_count || 0) - Number(first.row_count || 0),
      ctr: Number(latest.average_ctr || 0) - Number(first.average_ctr || 0),
      averagePosition: Number(latest.average_position || 0) - Number(first.average_position || 0),
    } : null,
    previousToLatest: previous && latest ? {
      impressions: Number(latest.total_impressions || 0) - Number(previous.total_impressions || 0),
      clicks: Number(latest.total_clicks || 0) - Number(previous.total_clicks || 0),
      rows: Number(latest.row_count || 0) - Number(previous.row_count || 0),
      ctr: Number(latest.average_ctr || 0) - Number(previous.average_ctr || 0),
      averagePosition: Number(latest.average_position || 0) - Number(previous.average_position || 0),
    } : null,
  };
}

function table(headers, rows) {
  return `<div class="scroll"><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.join("\n")}</tbody></table></div>`;
}

function row(cells) {
  return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
}

const newReward = readJson("data/google-history/newreward-snapshot-history.json");
const googleStatus = readJson("data/google-history/history-pull-status.json");
const serviceTitan = readJson("data/servicetitan-api-lead-history-summary.json");
const live = readJson("data/live-measurement-path-check.json");
const seoAudit = readJson("data/seo-geo-attribution-audit.json");
const deepDive = readJson("data/seo-geo-deep-dive-audit.json");

const gsc = firstToLatestGsc(newReward.gscSnapshotTrend || []);
const aiByEngine = newReward.aiByEngine || [];
const aiByWeek = newReward.aiByWeek || [];
const weeklyLeads = serviceTitan.completeWeeklyTrend || [];

const generatedAt = new Date().toISOString();
const report = {
  generatedAt,
  evidenceClass: "air_express_performance_over_time_report",
  secretHandling:
    "Only aggregate saved visibility metrics, redacted ServiceTitan counts, public marker booleans, and audit statuses are stored. No tokens, credentials, customer PII, raw lead notes, cookies, or raw HTML are stored.",
  status: "prepared_with_provider_and_delivery_blockers",
  trackedSources: [
    "New Reward saved GSC aggregate snapshots",
    "New Reward saved AI visibility snapshots",
    "New Reward Cloudflare AI traffic rollups",
    "ServiceTitan redacted lead-count history",
    "Repo-local and public live measurement checks",
    "Repo-local SEO/GEO/AEO audit outputs",
  ],
  directGoogleStatus: {
    gsc: googleStatus.gsc || null,
    ga4: googleStatus.ga4 || null,
    gbp: googleStatus.gbp || null,
    status: googleStatus.status || "unknown",
  },
  gsc,
  ai: {
    summary: newReward.aiSnapshots || null,
    byEngine: aiByEngine,
    byWeek: aiByWeek,
    topMentionedQuestions: newReward.aiTopMentionedQuestions || [],
    traffic: newReward.cloudflareAiTrafficSummary || [],
  },
  serviceTitan: {
    status: serviceTitan.status || "unknown",
    rows: serviceTitan.rows || 0,
    websiteCampaignLeadCount: serviceTitan.websiteCampaignLeadCount || 0,
    bookedLeadCount: serviceTitan.bookedLeadCount || 0,
    countsByMonth: serviceTitan.countsByMonth || {},
    countsByWeek: serviceTitan.countsByWeek || {},
    countsByImpactPeriod: serviceTitan.countsByImpactPeriod || {},
    countsByStatus: serviceTitan.countsByStatus || {},
    countsByServiceType: serviceTitan.countsByServiceType || {},
    qualityProxyByCaptchaPeriod: serviceTitan.qualityProxyByCaptchaPeriod || {},
    weeklyTrend: weeklyLeads,
    captcha: serviceTitan.captcha || null,
  },
  liveMeasurement: {
    status: live.status || "unknown",
    canonicalHasGa4: Boolean(live.live?.homepage?.markers?.approvedGa4Present),
    wwwHasGa4: Boolean(live.live?.wwwHomepage?.markers?.approvedGa4Present),
    apexAnalyticsJsStatus: live.live?.analyticsJs?.status || null,
    wwwAnalyticsJsStatus: live.live?.wwwAnalyticsJs?.status || null,
    turnstile: live.live?.turnstileConfig || null,
  },
  audit: {
    scores: seoAudit.scores || {},
    blockerRootCauses: seoAudit.blockerRootCauses || [],
    deepDiveIssues: deepDive.recommendedIssues || [],
  },
  interpretation: [
    {
      finding: "Visibility expanded in saved Search Console snapshots.",
      evidence: gsc.firstToLatest
        ? `First saved window to latest saved window: impressions ${signed(gsc.firstToLatest.impressions)}, clicks ${signed(gsc.firstToLatest.clicks)}, captured rows ${signed(gsc.firstToLatest.rows)}, CTR ${pct(gsc.first?.average_ctr)} to ${pct(gsc.latest?.average_ctr)}, average position ${Number(gsc.first?.average_position || 0).toFixed(1)} to ${Number(gsc.latest?.average_position || 0).toFixed(1)}.`
        : "No saved GSC movement available.",
      attributionRead: "This is visibility proof from saved New Reward snapshots, not full direct GSC query/page history until provider scopes are repaired.",
    },
    {
      finding: "AI visibility exists, but all observed mentions and citations are concentrated in Perplexity.",
      evidence: `${fmt(newReward.aiSnapshots?.rows || 0)} snapshots, ${fmt(newReward.aiSnapshots?.mentions || 0)} mentions, ${fmt(newReward.aiSnapshots?.citations || 0)} citations, ${fmt(newReward.aiSnapshots?.unique_queries || 0)} unique questions.`,
      attributionRead: "Improve engine diversity by strengthening answer-ready service pages, blog Q&A headings, citations, and competitor prompt sets.",
    },
    {
      finding: "Lead volume appears in a tight April/May window and then drops to zero in the latest tracked weeks.",
      evidence: `${fmt(serviceTitan.rows || 0)} redacted ServiceTitan leads from January 1 to June 5; weeks of May 25 and June 1 both show 0 leads.`,
      attributionRead: "Do not claim CAPTCHA caused the drop or quality improvement yet. Source CAPTCHA was added June 4, but live Turnstile config and canonical delivery are still unhealthy.",
    },
    {
      finding: "Attribution is the weak score, not base SEO.",
      evidence: `Latest audit scores: technical ${seoAudit.scores?.technical ?? "pending"}, GEO ${seoAudit.scores?.geo ?? "pending"}, messaging ${seoAudit.scores?.messaging ?? "pending"}, attribution ${seoAudit.scores?.attribution ?? "pending"}.`,
      attributionRead: "The next revenue-proof step is provider scope/property repair plus canonical delivery sync, not more local-only SEO cleanup.",
    },
  ],
  recommendedActions: [
    {
      priority: "P0",
      action: "Repair canonical delivery so apex serves the same approved GA4 and /analytics.js source as www.",
      state: live.status || "unknown",
      proof: "Rerun npm run verify:live-measurement and require canonical homepage GA4=true and apex /analytics.js HTTP 200.",
    },
    {
      priority: "P0",
      action: "Restore read-only GSC/GA4 scopes or reconnect through the New Reward app for website cmorqbs9j001r5nr1h25vosp8.",
      state: googleStatus.status || "unknown",
      proof: "Rerun npm run pull:gsc-ga4-history and require direct GSC/GA4 histories or exact provider/property blocker output.",
    },
    {
      priority: "P0",
      action: "Configure Turnstile on the active production delivery path before interpreting lead-quality changes.",
      state: live.live?.turnstileConfig?.www?.configured ? "configured_www" : "blocked_turnstile_env_or_delivery",
      proof: "Canonical /api/turnstile/config returns configured=true; then perform an approved, non-duplicating live lead-path proof.",
    },
    {
      priority: "P1",
      action: "Improve GEO/AEO extractability and prompt coverage across service pages and weekly blog reporting.",
      state: "source_updates_prepared",
      proof: "Rerun npm run audit:seo-geo-deep-dive and require fewer metadata/blog extractability issues.",
    },
  ],
};

fs.mkdirSync(path.join(root, "data"), { recursive: true });
fs.mkdirSync(path.join(root, "pages"), { recursive: true });
fs.writeFileSync(path.join(root, outJson), `${JSON.stringify(report, null, 2)}\n`);

const gscRows = [gsc.first, gsc.previous, gsc.latest]
  .filter(Boolean)
  .map((snapshot, index) => row([
    escapeHtml(index === 0 ? "First saved" : index === 1 ? "Previous saved" : "Latest saved"),
    escapeHtml(`${snapshot.dateRange?.start || ""} to ${snapshot.dateRange?.end || ""}`),
    fmt(snapshot.total_impressions),
    fmt(snapshot.total_clicks),
    pct(snapshot.average_ctr),
    Number(snapshot.average_position || 0).toFixed(1),
    fmt(snapshot.row_count),
  ]));

const aiEngineRows = aiByEngine.map((engine) => row([
  escapeHtml(engine.engine || "unknown"),
  fmt(engine.snapshots),
  fmt(engine.mentions),
  fmt(engine.citations),
  pct((engine.mentions || 0) / Math.max(engine.snapshots || 0, 1)),
  pct((engine.citations || 0) / Math.max(engine.snapshots || 0, 1)),
]));

const aiWeekRows = aiByWeek.map((week) => row([
  escapeHtml(week.week),
  fmt(week.snapshots),
  fmt(week.unique_queries),
  fmt(week.mentions),
  fmt(week.citations),
]));

const leadRows = weeklyLeads.map((week) => row([
  escapeHtml(week.week),
  fmt(week.totalLeads),
  fmt(week.websiteCampaignLeads),
  escapeHtml(Object.entries(week.statuses || {}).map(([key, value]) => `${key}: ${value}`).join(", ") || "none"),
  escapeHtml(Object.entries(week.serviceTypes || {}).map(([key, value]) => `${key}: ${value}`).join(", ") || "none"),
  escapeHtml(week.captchaPeriod || ""),
]));

const issueRows = (deepDive.recommendedIssues || []).map((item) => row([
  escapeHtml(item.severity || ""),
  escapeHtml(item.bucket || ""),
  escapeHtml(item.title || ""),
  escapeHtml(item.evidence || ""),
  escapeHtml(item.acceptance || ""),
]));

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Air Express Performance Over Time</title>
  <style>
    :root { --ink:#162231; --muted:#5e6b78; --line:#d9e2ea; --panel:#f6f9fb; --good:#287549; --warn:#9f5d00; --bad:#b33434; --blue:#0d66a2; --white:#fff; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--white); line-height: 1.45; }
    header { padding: 34px clamp(18px, 5vw, 58px) 24px; background: #eef6fb; border-bottom: 1px solid var(--line); }
    main { padding: 24px clamp(18px, 5vw, 58px) 56px; }
    h1 { margin: 0 0 8px; font-size: clamp(28px, 4vw, 44px); letter-spacing: 0; }
    h2 { margin: 30px 0 12px; font-size: 20px; letter-spacing: 0; }
    h3 { margin: 0 0 8px; font-size: 16px; letter-spacing: 0; }
    p { margin: 0 0 12px; color: var(--muted); max-width: 1040px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    a { color: var(--blue); }
    .meta, .grid { display: grid; gap: 12px; }
    .meta { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); margin-top: 18px; }
    .grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .card { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: var(--white); min-height: 120px; }
    .pill { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 5px 9px; font-size: 12px; font-weight: 700; background: var(--white); }
    .metric { font-size: 34px; font-weight: 750; margin: 2px 0 4px; }
    .good { color: var(--good); } .warn { color: var(--warn); } .bad { color: var(--bad); }
    .note { padding: 12px 14px; border-left: 4px solid var(--warn); background: #fff8ec; color: var(--ink); max-width: 1040px; }
    .scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; border: 1px solid var(--line); background: var(--white); }
    th, td { border-bottom: 1px solid var(--line); padding: 10px; text-align: left; vertical-align: top; font-size: 14px; }
    th { background: var(--panel); font-size: 13px; }
  </style>
</head>
<body>
  <header>
    <h1>Air Express Performance Over Time</h1>
    <p>Private Pages report for visibility, leads, attribution readiness, and GEO/AEO optimization evidence. This is a reporting/control page, not a public site page.</p>
    <div class="meta">
      <span class="pill">Generated ${escapeHtml(generatedAt)}</span>
      <span class="pill">No secrets or customer PII</span>
      <span class="pill">Direct GSC/GA4: ${escapeHtml(googleStatus.status || "unknown")}</span>
      <span class="pill">Live measurement: ${escapeHtml(live.status || "unknown")}</span>
    </div>
  </header>
  <main>
    <section class="note">The current evidence supports a clear trend story, but not full revenue attribution yet. Saved visibility improved, ServiceTitan lead counts are available, and the weak point is still live/provider attribution: direct Google scopes, canonical GA4 delivery, Turnstile config, and outcome joins.</section>

    <h2>Executive Read</h2>
    <section class="grid">
      <article class="card"><h3>Saved Google Appearances</h3><div class="metric good">${fmt(gsc.latest?.total_impressions || 0)}</div><p>${gsc.firstToLatest ? `${signed(gsc.firstToLatest.impressions)} from first saved window.` : "No saved movement."}</p></article>
      <article class="card"><h3>ServiceTitan Leads</h3><div class="metric good">${fmt(serviceTitan.rows || 0)}</div><p>${fmt(serviceTitan.websiteCampaignLeadCount || 0)} website campaign rows; ${fmt(serviceTitan.bookedLeadCount || 0)} booked lead ids available.</p></article>
      <article class="card"><h3>AI Mentions</h3><div class="metric warn">${fmt(newReward.aiSnapshots?.mentions || 0)}</div><p>${fmt(newReward.aiSnapshots?.citations || 0)} citations from ${fmt(newReward.aiSnapshots?.rows || 0)} saved AI snapshots.</p></article>
      <article class="card"><h3>Attribution Score</h3><div class="metric bad">${escapeHtml(seoAudit.scores?.attribution ?? "pending")}</div><p>Base SEO is strong; proof-quality attribution is the constraint.</p></article>
    </section>

    <h2>What Changed</h2>
    ${table(["Finding", "Evidence", "Attribution read"], report.interpretation.map((item) => row([
      escapeHtml(item.finding),
      escapeHtml(item.evidence),
      escapeHtml(item.attributionRead),
    ])))}

    <h2>Saved GSC Trend</h2>
    <p>These are saved New Reward aggregate Search Console snapshots. Query/page/device history remains blocked until the Google provider path is repaired.</p>
    ${table(["Window", "Date range", "Appearances", "Clicks", "CTR", "Avg position", "Rows"], gscRows)}

    <h2>AI Visibility By Engine</h2>
    <p>Observed mentions and citations are still concentrated in Perplexity. Other engines need better entity, service-area, answer, and citation signals.</p>
    ${table(["Engine", "Snapshots", "Mentions", "Citations", "Mention rate", "Citation rate"], aiEngineRows)}

    <h2>AI Visibility By Week</h2>
    ${table(["Week", "Snapshots", "Unique questions", "Mentions", "Citations"], aiWeekRows)}

    <h2>Lead Counts By Week</h2>
    <p>CAPTCHA source was added June 4, 2026. Since live Turnstile config is still unhealthy and there are zero leads after the source marker, the report should not claim quality improvement from CAPTCHA yet.</p>
    ${table(["Week", "Total leads", "Website campaign", "Status mix", "Service mix", "CAPTCHA period"], leadRows)}

    <h2>Why Leads Changed</h2>
    <section class="grid">
      <article class="card"><h3>Likely Demand Window</h3><p>April and May concentrate the observed ServiceTitan lead volume, which lines up with the first cooling demand window in Utah County.</p></article>
      <article class="card"><h3>Attribution Gap</h3><p>Direct GA4 and normalized GSC rows are still missing, so we cannot cleanly separate organic, paid, direct, AI, and referral effects.</p></article>
      <article class="card"><h3>Lead Path Risk</h3><p>Canonical apex is missing approved GA4 and /analytics.js; Turnstile config is missing/404/503 on live paths.</p></article>
      <article class="card"><h3>Quality Caveat</h3><p>Status mix is a proxy only: ${escapeHtml(Object.entries(serviceTitan.countsByStatus || {}).map(([key, value]) => `${key}: ${value}`).join(", "))}.</p></article>
    </section>

    <h2>GEO/AEO Audit Actions</h2>
    ${table(["Severity", "Bucket", "Issue", "Evidence", "Acceptance"], issueRows)}

    <h2>Next Actions</h2>
    ${table(["Priority", "Action", "State", "Proof"], report.recommendedActions.map((item) => row([
      escapeHtml(item.priority),
      escapeHtml(item.action),
      escapeHtml(item.state),
      escapeHtml(item.proof),
    ])))}
  </main>
</body>
</html>
`;

fs.writeFileSync(path.join(root, outHtml), html);

console.log(`Wrote ${path.join(root, outJson)}`);
console.log(`Wrote ${path.join(root, outHtml)}`);
