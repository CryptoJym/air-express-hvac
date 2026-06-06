#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const outputPath = "pages/air-express-impact-trace.html";

function readJson(relativePath, fallback = {}) {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) return fallback;
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString("en-US");
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

function formatDate(value) {
  if (!value) return "pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().replace("T", " ").slice(0, 16);
}

function signedInteger(value) {
  const number = Number(value || 0);
  return `${number >= 0 ? "+" : ""}${formatInteger(number)}`;
}

function slugClass(value) {
  return String(value || "unknown").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
}

function statusClass(value) {
  const text = String(value || "").toLowerCase();
  if (/verified|connected|saved|available|passed|valid|no_db_blocker|rows_found|live/.test(text)) return "good";
  if (/prepared|pending|partial|inferred|selected/.test(text)) return "warn";
  if (/blocked|revoked|error|missing|unproven|expired|null/.test(text)) return "bad";
  return "neutral";
}

function distinctGscSnapshots(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = [
      row.dateRange?.start || "",
      row.dateRange?.end || "",
      row.total_impressions ?? "",
      row.total_clicks ?? "",
      row.row_count ?? "",
      row.average_position ?? "",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pointScale(rows, key, width, height, padX = 20, padY = 18) {
  const values = rows.map((row) => Number(row[key] || 0));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const plotWidth = width - padX * 2;
  const plotHeight = height - padY * 2;
  return rows.map((row, index) => {
    const x = padX + (rows.length <= 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth);
    const y = padY + plotHeight - ((Number(row[key] || 0) - min) / span) * plotHeight;
    return { x, y, row };
  });
}

function polyline(points) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function areaPath(points, height, padY = 18) {
  if (!points.length) return "";
  const first = points[0];
  const last = points.at(-1);
  return [
    `M ${first.x.toFixed(1)} ${(height - padY).toFixed(1)}`,
    ...points.map((point) => `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`),
    `L ${last.x.toFixed(1)} ${(height - padY).toFixed(1)}`,
    "Z",
  ].join(" ");
}

function sparklineSvg(rows, key, label, width = 220, height = 56, accent = "blue") {
  const points = pointScale(rows, key, width, height, 8, 8);
  const color = accent === "green" ? "#287549" : accent === "amber" ? "#9b6300" : "#155ec8";
  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)}">
    <path d="${areaPath(points, height, 8)}" fill="${color}" opacity="0.1"></path>
    <polyline points="${polyline(points)}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></polyline>
    ${points.map((point, index) => index === points.length - 1 ? `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4" fill="${color}"></circle>` : "").join("")}
  </svg>`;
}

function evidencePill(label, state) {
  return `<span class="state-pill ${statusClass(state)}">${escapeHtml(label)}</span>`;
}

const snapshotHistory = readJson("data/google-history/newreward-snapshot-history.json");
const historyStatus = readJson("data/google-history/history-pull-status.json");
const seoAudit = readJson("data/seo-geo-attribution-audit.json");
const mapping = readJson("data/newreward-air-express-provider-readonly-recheck.json");
const serviceTitan = readJson("data/servicetitan-export-access-check.json");
const serviceTitanLeadSummary = readJson("data/servicetitan-api-lead-history-summary.json");
const serviceTitanJoinProbe = readJson("data/servicetitan-attribution-join-probe.json");

const rawGscTrend = Array.isArray(snapshotHistory.gscSnapshotTrend)
  ? snapshotHistory.gscSnapshotTrend
  : [];
const gscTrend = distinctGscSnapshots(rawGscTrend);
const firstGsc = gscTrend[0] || null;
const previousGsc = gscTrend.length > 1 ? gscTrend.at(-2) : null;
const latestGsc = snapshotHistory.gscSnapshotSummary?.latest || gscTrend.at(-1) || null;
const aiByWeek = Array.isArray(snapshotHistory.aiByWeek) ? snapshotHistory.aiByWeek : [];
const aiByEngine = Array.isArray(snapshotHistory.aiByEngine) ? snapshotHistory.aiByEngine : [];
const latestAiWeek = aiByWeek.at(-1) || null;
const previousAiWeek = aiByWeek.length > 1 ? aiByWeek.at(-2) : null;
const rootCause = mapping.rootCauseSummary || {};
const edgeDelivery = rootCause.edgeDelivery || {};
const includeGbpInReport = historyStatus.gbp?.status !== "not_included";
const googleScopeLabel = includeGbpInReport
  ? "direct Google and GBP provider access"
  : "direct GSC/GA4 provider access";
const providerRows = [
  {
    surface: "GSC",
    state: rootCause.gsc?.connectionStatus || historyStatus.gsc?.status || "blocked_local_token_scope",
    evidence: rootCause.gsc
      ? `${rootCause.gsc.credentialStatus || "unknown"} / ${rootCause.gsc.connectionStatus || "unknown"}`
      : historyStatus.gsc?.evidence || "Missing Search Console scope.",
    nextAction: "Reconnect Search Console for the canonical website id after scoped access is approved.",
  },
  {
    surface: "GA4",
    state: rootCause.ga4?.propertyId ? "selected" : "property_pending",
    evidence: rootCause.ga4?.propertyId
      ? "Property selected."
      : "Connected row exists, but propertyId is blank.",
    nextAction: "Select the GA4 property or stream containing G-JZ7PY32EVX.",
  },
  {
    surface: "New Reward Edge",
    state: edgeDelivery.status || "edge_state_pending",
    evidence: edgeDelivery.activeVersionId
      ? `${edgeDelivery.accessStatus || "unknown"} / ${edgeDelivery.deploymentStatus || "unknown"}; active ${edgeDelivery.activeVersionId}; live HTTP still checked separately.`
      : "Read-only edge state is not available.",
    nextAction: edgeDelivery.nextAction || "Recheck New Reward edge delivery before claiming canonical GA4 is live.",
  },
  ...(includeGbpInReport
    ? [{
      surface: "GBP",
      state: historyStatus.gbp?.status || "proof_pending",
      evidence: historyStatus.gbp?.evidence || "Business Profile location proof is not available.",
      nextAction: "Confirm Air Express GBP location visibility after scoped account access.",
    }]
    : [{
      surface: "GBP",
      state: "not_included",
      evidence: historyStatus.gbp?.evidence || "Business Profile is intentionally outside this GSC/GA4 refresh.",
      nextAction: "Handle GBP separately after GSC/GA4 attribution and live measurement are repaired.",
    }]),
  {
    surface: "ServiceTitan",
    state: serviceTitanJoinProbe.status || serviceTitanLeadSummary.status || serviceTitan.status || "blocked_env",
    evidence: serviceTitanLeadSummary.status === "api_history_pulled"
      ? `${formatInteger(serviceTitanLeadSummary.rows)} redacted lead row(s) pulled; ${formatInteger(serviceTitanLeadSummary.websiteCampaignLeadCount)} match the configured website campaign. Booking and revenue joins are intentionally out of scope.`
      : serviceTitan.status === "blocked_env"
        ? "Missing required ServiceTitan export/API env keys."
        : serviceTitan.blockers?.[0]?.evidence || "Lead export/API access is not available locally.",
    nextAction: serviceTitanLeadSummary.status === "api_history_pulled"
      ? "Use lead counts for trend comparison; keep booking and revenue joins out of scope unless re-approved."
      : serviceTitan.blockers?.[0]?.nextAction || "Provide approved redacted export or read-only API access.",
  },
];

const scoreRows = [
  ["Technical", seoAudit.scores?.technical ?? "pending", "good"],
  ["GEO", seoAudit.scores?.geo ?? "pending", "good"],
  ["Messaging", seoAudit.scores?.messaging ?? "pending", "good"],
  ["Attribution", seoAudit.scores?.attribution ?? "pending", "bad"],
];

const directGoogleRows = [
  ["GSC", historyStatus.gsc?.status || "unknown", historyStatus.gsc?.evidence || ""],
  ["GA4", historyStatus.ga4?.status || "unknown", historyStatus.ga4?.evidence || ""],
  [
    includeGbpInReport ? "GBP" : "GBP (separate)",
    historyStatus.gbp?.status || "unknown",
    historyStatus.gbp?.evidence || "",
  ],
];

const mobileWindows = [
  {
    name: "First saved",
    date: firstGsc ? `${firstGsc.dateRange?.start || ""} to ${firstGsc.dateRange?.end || ""}` : "pending",
    gsc: firstGsc,
    ai: aiByWeek[0] || null,
  },
  {
    name: "Previous saved",
    date: previousGsc ? `${previousGsc.dateRange?.start || ""} to ${previousGsc.dateRange?.end || ""}` : "pending",
    gsc: previousGsc,
    ai: previousAiWeek,
  },
  {
    name: "Latest saved",
    date: latestGsc ? `${latestGsc.dateRange?.start || ""} to ${latestGsc.dateRange?.end || ""}` : "pending",
    gsc: latestGsc,
    ai: latestAiWeek,
  },
];

const timelineWidth = 760;
const timelineHeight = 210;
const gscPoints = pointScale(gscTrend, "total_impressions", timelineWidth, timelineHeight, 36, 30);
const clickPoints = pointScale(gscTrend, "total_clicks", timelineWidth, timelineHeight, 36, 30);
const aiWeekMax = Math.max(...aiByWeek.map((row) => Number(row.snapshots || 0)), 1);
const maxEngineSnapshots = Math.max(...aiByEngine.map((row) => Number(row.snapshots || 0)), 1);
const generatedAt = new Date().toISOString();

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Air Express Impact Trace</title>
  <style>
    :root {
      --ink: #162231;
      --muted: #5d6a78;
      --line: #d9e2ea;
      --panel: #f6f9fb;
      --panel-strong: #eef5fa;
      --blue: #155ec8;
      --blue-soft: #eaf2ff;
      --green: #287549;
      --green-soft: #eaf7ef;
      --amber: #9b6300;
      --amber-soft: #fff6e7;
      --red: #b33434;
      --red-soft: #fff1f1;
      --white: #fff;
      --shadow: 0 12px 36px rgba(22, 34, 49, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: #fbfdff;
      line-height: 1.45;
    }
    header {
      padding: 24px clamp(16px, 3vw, 34px);
      background: var(--white);
      border-bottom: 1px solid var(--line);
      position: sticky;
      top: 0;
      z-index: 20;
    }
    main { padding: 20px clamp(16px, 3vw, 34px) 48px; }
    h1 { margin: 0; font-size: clamp(25px, 3vw, 38px); letter-spacing: 0; }
    h2 { margin: 0 0 12px; font-size: 18px; letter-spacing: 0; }
    h3 { margin: 0 0 6px; font-size: 15px; letter-spacing: 0; }
    p { margin: 0; color: var(--muted); }
    button, a { font: inherit; }
    a { color: var(--blue); }
    .top {
      display: grid;
      grid-template-columns: minmax(260px, 1fr) auto;
      gap: 16px;
      align-items: center;
    }
    .subtitle { margin-top: 6px; max-width: 860px; }
    .chips, .controls, .status-grid, .kpis, .legend-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .chip, .mode-button, .icon-button {
      border: 1px solid var(--line);
      background: var(--white);
      border-radius: 8px;
      padding: 7px 10px;
      font-size: 13px;
      font-weight: 750;
      color: var(--ink);
      white-space: nowrap;
    }
    .chip.good { color: var(--green); border-color: #a7d8bb; background: var(--green-soft); }
    .chip.warn { color: var(--amber); border-color: #efc77f; background: var(--amber-soft); }
    .chip.bad { color: var(--red); border-color: #efa5a5; background: var(--red-soft); }
    .mode-button[aria-pressed="true"] { color: var(--white); background: var(--blue); border-color: var(--blue); }
    .layout {
      display: grid;
      grid-template-columns: minmax(170px, 220px) minmax(0, 1fr) minmax(240px, 320px);
      gap: 14px;
      align-items: start;
    }
    .card, .panel, .kpi, .mobile-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--white);
      box-shadow: var(--shadow);
    }
    .panel { padding: 14px; }
    .kpis { flex-direction: column; align-items: stretch; }
    .kpi { padding: 12px; box-shadow: none; }
    .metric {
      margin: 6px 0 2px;
      font-size: clamp(24px, 2.2vw, 32px);
      font-weight: 800;
      letter-spacing: 0;
      color: var(--blue);
    }
    .metric-note { font-size: 12px; color: var(--muted); }
    .score-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin-top: 10px;
    }
    .score {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: var(--panel);
    }
    .score strong { display: block; font-size: 24px; }
    .score.good strong { color: var(--green); }
    .score.bad strong { color: var(--red); }
    .workspace {
      display: grid;
      gap: 14px;
    }
    .controls {
      justify-content: space-between;
      padding: 8px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--white);
    }
    .mode-group { display: flex; gap: 0; }
    .mode-group .mode-button { border-radius: 0; margin-left: -1px; min-width: 105px; }
    .mode-group .mode-button:first-child { border-radius: 8px 0 0 8px; margin-left: 0; }
    .mode-group .mode-button:last-child { border-radius: 0 8px 8px 0; }
    .trace {
      overflow-x: auto;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: linear-gradient(180deg, #fff, #f9fcff);
    }
    .trace-inner { min-width: 780px; padding: 14px; }
    .track-label {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 12px;
      align-items: start;
      border-bottom: 1px solid var(--line);
      padding: 12px 0;
    }
    .track-label:last-child { border-bottom: 0; }
    .track-name { font-weight: 800; }
    .track-help { font-size: 12px; color: var(--muted); margin-top: 3px; }
    svg { max-width: 100%; height: auto; }
    .axis-note {
      display: flex;
      justify-content: space-between;
      color: var(--muted);
      font-size: 12px;
      margin: 4px 36px 0;
    }
    .ai-bars {
      display: grid;
      grid-template-columns: repeat(${Math.max(aiByWeek.length, 1)}, minmax(72px, 1fr));
      gap: 8px;
      align-items: end;
      height: 126px;
      padding: 8px 4px;
    }
    .ai-week {
      display: grid;
      grid-template-rows: 1fr auto;
      gap: 6px;
      height: 100%;
      min-width: 64px;
    }
    .bar-box {
      display: flex;
      gap: 4px;
      align-items: end;
      justify-content: center;
      border-bottom: 1px solid var(--line);
    }
    .bar {
      width: 12px;
      min-height: 3px;
      border-radius: 3px 3px 0 0;
      background: var(--blue);
    }
    .bar.citation { background: var(--green); }
    .week-label { font-size: 11px; color: var(--muted); text-align: center; white-space: nowrap; }
    .provider-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .provider {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: var(--panel);
      min-height: 112px;
    }
    .provider.bad { border-color: #efb0b0; background: var(--red-soft); }
    .provider.warn { border-color: #f0ce8b; background: var(--amber-soft); }
    .provider.good { border-color: #a8d9bc; background: var(--green-soft); }
    .provider strong { display: block; margin-bottom: 4px; }
    .provider p { font-size: 12px; overflow-wrap: anywhere; }
    .milestones {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
    }
    .milestone {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: var(--white);
    }
    .milestone span {
      display: block;
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .inspector {
      display: grid;
      gap: 10px;
    }
    .evidence-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: var(--white);
    }
    .evidence-card.good { border-color: #9fd3b5; background: var(--green-soft); }
    .evidence-card.warn { border-color: #efc77f; background: var(--amber-soft); }
    .evidence-card.bad { border-color: #efa5a5; background: var(--red-soft); }
    .state-pill {
      display: inline-block;
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 800;
      border: 1px solid var(--line);
      background: var(--white);
      white-space: nowrap;
    }
    .state-pill.good { color: var(--green); border-color: #9fd3b5; background: var(--green-soft); }
    .state-pill.warn { color: var(--amber); border-color: #efc77f; background: var(--amber-soft); }
    .state-pill.bad { color: var(--red); border-color: #efa5a5; background: var(--red-soft); }
    .state-pill.neutral { color: var(--muted); }
    .source-ledger {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 14px;
      margin-top: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid var(--line);
      background: var(--white);
    }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 9px;
      text-align: left;
      vertical-align: top;
      font-size: 13px;
    }
    th { background: var(--panel); font-size: 12px; }
    .mobile-sequence { display: none; }
    .footer-note {
      margin-top: 16px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px 12px;
      background: var(--panel);
      color: var(--muted);
      font-size: 13px;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    @media (max-width: 1120px) {
      .layout { grid-template-columns: 1fr; }
      .kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .source-ledger { grid-template-columns: 1fr; }
    }
    @media (max-width: 720px) {
      header { position: static; }
      .top { grid-template-columns: 1fr; }
      .chips { gap: 6px; }
      .layout { display: block; }
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 14px; }
      .metric { font-size: 24px; }
      .score-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .workspace .trace { display: none; }
      .controls { position: sticky; top: 0; z-index: 12; margin-bottom: 12px; }
      .mode-group { width: 100%; }
      .mode-group .mode-button { flex: 1; min-width: 0; }
      .mobile-sequence {
        display: grid;
        gap: 12px;
        margin-bottom: 14px;
      }
      .mobile-card {
        padding: 14px;
        box-shadow: none;
      }
      .mobile-card.selected {
        border-color: var(--blue);
        box-shadow: 0 0 0 2px rgba(21, 94, 200, 0.14);
      }
      .mobile-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 12px;
      }
      .provider-grid, .milestones { grid-template-columns: 1fr; }
      .inspector { margin-top: 14px; }
      .source-ledger { display: block; overflow-x: auto; }
    }
  </style>
</head>
<body>
  <header>
    <div class="top">
      <div>
        <h1>Air Express Impact Trace</h1>
        <p class="subtitle">Saved New Reward visibility signals and ServiceTitan lead-count history are available, but complete attribution remains blocked until ${escapeHtml(googleScopeLabel)} and canonical live measurement are restored.</p>
      </div>
      <div class="chips" aria-label="Current report status">
        <span class="chip good">Saved snapshots</span>
        <span class="chip bad">Google scope blocked</span>
        <span class="chip warn">Lead system under review</span>
        <span class="chip warn">Attribution incomplete</span>
      </div>
    </div>
  </header>

  <main>
    <section class="layout" aria-label="Air Express impact trace visualization">
      <aside class="kpis" aria-label="Key metrics">
        <article class="kpi">
          <h3>Google Appearances</h3>
          <div class="metric">${formatInteger(latestGsc?.total_impressions)}</div>
          <p class="metric-note">Latest saved GSC snapshot window only.</p>
        </article>
        <article class="kpi">
          <h3>Google Clicks</h3>
          <div class="metric">${formatInteger(latestGsc?.total_clicks)}</div>
          <p class="metric-note">Saved snapshot, not direct API history.</p>
        </article>
        <article class="kpi">
          <h3>AI Snapshots</h3>
          <div class="metric">${formatInteger(snapshotHistory.aiSnapshots?.rows)}</div>
          <p class="metric-note">${formatInteger(snapshotHistory.aiSnapshots?.unique_queries)} unique questions.</p>
        </article>
        <article class="kpi">
          <h3>AI Mentions</h3>
          <div class="metric">${formatInteger(snapshotHistory.aiSnapshots?.mentions)}</div>
          <p class="metric-note">${formatInteger(snapshotHistory.aiSnapshots?.citations)} citations observed.</p>
        </article>
        <article class="kpi">
          <h3>Attribution Score</h3>
          <div class="metric">${escapeHtml(seoAudit.scores?.attribution ?? "pending")}</div>
          <p class="metric-note">Low because direct Google and lead joins are blocked.</p>
        </article>
      </aside>

      <section class="workspace">
        <div class="controls" aria-label="Visualization controls">
          <div class="mode-group" role="group" aria-label="View mode">
            <button class="mode-button" type="button" aria-pressed="true" data-mode="evidence">Evidence</button>
            <button class="mode-button" type="button" aria-pressed="false" data-mode="attribution">Attribution</button>
            <button class="mode-button" type="button" aria-pressed="false" data-mode="blockers">Blockers</button>
          </div>
          <div class="chips">
            <span class="chip">${escapeHtml(formatDate(gscTrend[0]?.dateRange?.start))}</span>
            <span class="chip">${escapeHtml(formatDate(latestGsc?.dateRange?.end))}</span>
          </div>
        </div>

        <div class="trace" aria-label="Large-screen evidence spine timeline">
          <div class="trace-inner">
            <div class="track-label">
              <div>
                <div class="track-name">Saved GSC snapshots</div>
                <div class="track-help">Appearances and clicks from New Reward saved snapshots.</div>
              </div>
              <div>
                <svg viewBox="0 0 ${timelineWidth} ${timelineHeight}" role="img" aria-label="Saved GSC appearances and clicks trend">
                  <path d="${areaPath(gscPoints, timelineHeight, 30)}" fill="#155ec8" opacity="0.12"></path>
                  <polyline points="${polyline(gscPoints)}" fill="none" stroke="#155ec8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
                  <polyline points="${polyline(clickPoints)}" fill="none" stroke="#287549" stroke-width="2" stroke-dasharray="5 5" stroke-linecap="round" stroke-linejoin="round"></polyline>
                  ${gscPoints.map((point, index) => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${index === gscPoints.length - 1 ? 5 : 3}" fill="#155ec8"></circle>`).join("")}
                  <text x="38" y="22" fill="#155ec8" font-size="13" font-weight="700">Appearances</text>
                  <text x="160" y="22" fill="#287549" font-size="13" font-weight="700">Clicks</text>
                  <text x="${Math.max(42, timelineWidth - 310)}" y="28" fill="#162231" font-size="13" font-weight="700">Latest saved: ${formatInteger(latestGsc?.total_impressions)} appearances</text>
                </svg>
                <div class="axis-note">
                  <span>${escapeHtml(formatDate(gscTrend[0]?.dateRange?.start))}</span>
                  <span>${escapeHtml(formatDate(latestGsc?.dateRange?.end))}</span>
                </div>
              </div>
            </div>

            <div class="track-label">
              <div>
                <div class="track-name">AI visibility pulses</div>
                <div class="track-help">Mentions and citations by saved weekly runs.</div>
              </div>
              <div class="ai-bars" aria-label="AI visibility weekly trend">
                ${aiByWeek.map((week) => {
                  const mentionHeight = Math.max(4, (Number(week.mentions || 0) / Math.max(...aiByWeek.map((row) => Number(row.mentions || 0)), 1)) * 78);
                  const citationHeight = Math.max(4, (Number(week.citations || 0) / Math.max(...aiByWeek.map((row) => Number(row.citations || 0)), 1)) * 78);
                  const snapshotOpacity = 0.25 + (Number(week.snapshots || 0) / aiWeekMax) * 0.65;
                  return `<div class="ai-week" title="${escapeHtml(week.week)}: ${formatInteger(week.mentions)} mentions, ${formatInteger(week.citations)} citations">
                    <div class="bar-box" style="opacity:${snapshotOpacity.toFixed(2)}">
                      <span class="bar" style="height:${mentionHeight.toFixed(1)}px"></span>
                      <span class="bar citation" style="height:${citationHeight.toFixed(1)}px"></span>
                    </div>
                    <div class="week-label">${escapeHtml(String(week.week || "").slice(5))}</div>
                  </div>`;
                }).join("")}
              </div>
            </div>

            <div class="track-label">
              <div>
                <div class="track-name">Provider state rail</div>
                <div class="track-help">Current access gates that control complete attribution.</div>
              </div>
              <div class="provider-grid">
                ${providerRows.map((row) => `<article class="provider ${statusClass(row.state)}">
                  <strong>${escapeHtml(row.surface)}</strong>
                  ${evidencePill(row.state, row.state)}
                  <p>${escapeHtml(row.evidence)}</p>
                </article>`).join("")}
              </div>
            </div>

            <div class="track-label">
              <div>
                <div class="track-name">Milestones and actions</div>
                <div class="track-help">Traceability markers used to frame the report.</div>
              </div>
              <div class="milestones">
                <article class="milestone"><span>Brief</span><strong>New Reward target brief</strong></article>
                <article class="milestone"><span>Tag source</span><strong>GA4 source prepared locally</strong></article>
                <article class="milestone"><span>Reconnect packet</span><strong>Google read-only packet ready</strong></article>
                <article class="milestone"><span>Token gate</span><strong>OAuth code gate remains</strong></article>
                <article class="milestone"><span>Access restore</span><strong>Next verification run pending</strong></article>
              </div>
            </div>
          </div>
        </div>

        <div class="mobile-sequence" aria-label="Mobile evidence windows">
          ${mobileWindows.map((window, index) => `<article class="mobile-card ${index === mobileWindows.length - 1 ? "selected" : ""}">
            <h3>${escapeHtml(window.name)}</h3>
            <p>${escapeHtml(window.date)}</p>
            <div class="mobile-grid">
              <div>
                <strong>${formatInteger(window.gsc?.total_impressions)}</strong>
                <p>GSC appearances</p>
                ${sparklineSvg(gscTrend.slice(Math.max(0, gscTrend.length - 8)), "total_impressions", "GSC appearances sparkline")}
              </div>
              <div>
                <strong>${formatInteger(window.ai?.mentions)}</strong>
                <p>AI mentions</p>
                ${sparklineSvg(aiByWeek, "mentions", "AI mentions sparkline", 220, 56, "green")}
              </div>
            </div>
            <div class="legend-row" style="margin-top:10px">
              ${evidencePill("GSC blocked", "blocked")}
              ${evidencePill("GA4 pending", "pending")}
              ${evidencePill(includeGbpInReport ? "GBP pending" : "GBP separate", includeGbpInReport ? "pending" : "not_included")}
              ${evidencePill("ST lead counts", "available")}
            </div>
          </article>`).join("")}
        </div>
      </section>

      <aside class="inspector" aria-label="Selected window detail inspector">
        <section class="panel">
          <h2>Selected Window</h2>
          <p>${escapeHtml(latestGsc?.dateRange?.start || "pending")} to ${escapeHtml(latestGsc?.dateRange?.end || "pending")}</p>
        </section>
        <article class="evidence-card good">
          <h3>Verified saved evidence</h3>
          <p>${formatInteger(snapshotHistory.gscSnapshotSummary?.rows)} GSC snapshot(s), ${formatInteger(snapshotHistory.aiSnapshots?.rows)} AI snapshot(s), and ${formatInteger(snapshotHistory.cloudflareAiTrafficSummary?.[0]?.total_requests)} Cloudflare AI request observations.</p>
        </article>
        <article class="evidence-card warn">
          <h3>Inferred visibility signals</h3>
          <p>Saved visibility moved from ${formatInteger(firstGsc?.total_impressions)} to ${formatInteger(latestGsc?.total_impressions)} appearances; this is directional, not causal proof.</p>
        </article>
        <article class="evidence-card warn">
          <h3>Prepared reconnect steps</h3>
          <p>Canonical website id ${escapeHtml(rootCause.canonicalWebsiteId || "pending")} is mapped, and the Google read-only reconnect packet is prepared.</p>
        </article>
        <article class="evidence-card bad">
          <h3>Blocked attribution</h3>
          <p>Direct GSC/GA4 history and canonical live measurement are not available yet. ServiceTitan lead-count history is pulled; booking and revenue joins are intentionally out of scope. Google Business Profile is separate from this refresh.</p>
        </article>
      </aside>
    </section>

    <section class="score-grid" aria-label="SEO and attribution scores">
      ${scoreRows.map(([label, value, state]) => `<article class="score ${state}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </article>`).join("")}
    </section>

    <section class="source-ledger" aria-label="Source and caveat ledger">
      <div>
        <h2>Direct Google Status</h2>
        <table>
          <thead><tr><th>Surface</th><th>Status</th><th>Evidence</th></tr></thead>
          <tbody>
            ${directGoogleRows.map(([surface, state, evidence]) => `<tr>
              <td>${escapeHtml(surface)}</td>
              <td>${evidencePill(state, state)}</td>
              <td>${escapeHtml(evidence)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div>
        <h2>Answer Engine Split</h2>
        <table>
          <thead><tr><th>Engine</th><th>Snapshots</th><th>Mentions</th><th>Citations</th></tr></thead>
          <tbody>
            ${aiByEngine.map((row) => {
              const opacity = 0.35 + (Number(row.snapshots || 0) / maxEngineSnapshots) * 0.65;
              return `<tr style="opacity:${opacity.toFixed(2)}">
                <td>${escapeHtml(row.engine || "unknown")}</td>
                <td>${formatInteger(row.snapshots)}</td>
                <td>${formatInteger(row.mentions)}</td>
                <td>${formatInteger(row.citations)}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="footer-note">
      Generated ${escapeHtml(generatedAt)} from repo-local evidence. Saved snapshots are not direct live Google API history. Direct GSC/GA4 access, GA4 property selection, canonical live tag delivery, and live CAPTCHA/lead-path health remain the current blockers. Read-only New Reward edge rows show access/deployment state, but live HTTP is the proof gate for canonical GA4. The current ServiceTitan API key can pull lead counts; booking and revenue joins are intentionally out of scope for this report. Google Business Profile is outside this refresh. No provider mutation, public send, or untracked production change is performed by this report.
    </section>
  </main>

  <script>
    const modeButtons = Array.from(document.querySelectorAll("[data-mode]"));
    modeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        modeButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
        document.body.dataset.mode = button.dataset.mode;
      });
    });
  </script>
</body>
</html>
`;

fs.mkdirSync(path.join(rootDir, path.dirname(outputPath)), { recursive: true });
fs.writeFileSync(path.join(rootDir, outputPath), html);
console.log(`Wrote ${path.join(rootDir, outputPath)}`);
