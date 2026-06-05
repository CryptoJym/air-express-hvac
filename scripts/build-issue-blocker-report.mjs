#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

const completionPath = "data/issue-24-30-completion-audit.csv";
const acceptancePath = "data/issue-24-30-acceptance-criteria-audit.csv";
const crossRepoPath = "data/newreward-cross-repo-evidence.csv";
const outputPath = "pages/issue-24-30-blocker-report.html";

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function statusClass(completionState) {
  if (/completed|closed/.test(completionState)) return "complete";
  if (/partial/.test(completionState)) return "partial";
  if (/pending|prepared|local/.test(completionState)) return "prepared";
  return "blocked-state";
}

function statusLabel(value) {
  return escapeHtml(String(value || "").replaceAll("_", " "));
}

function summarizeAcceptance(rows) {
  const byIssue = new Map();
  for (const row of rows) {
    const summary = byIssue.get(row.issue) || { ready: 0, total: 0, gates: [] };
    summary.total += 1;
    if (row.closure_ready === "true") {
      summary.ready += 1;
    } else if (row.remaining_blocker) {
      summary.gates.push(row.remaining_blocker);
    }
    byIssue.set(row.issue, summary);
  }
  return byIssue;
}

function firstText(values) {
  return values.find((value) => value && String(value).trim()) || "";
}

const completionRows = parseCsv(read(completionPath));
const acceptanceRows = parseCsv(read(acceptancePath));
const crossRepoRows = parseCsv(read(crossRepoPath));
const acceptanceByIssue = summarizeAcceptance(acceptanceRows);

const seoAudit = readJson("data/seo-geo-attribution-audit.json");
const liveMeasurement = readJson("data/live-measurement-path-check.json");
const deliverySync = readJson("data/owned-site-delivery-sync-check.json");
const historyStatus = readJson("data/google-history/history-pull-status.json");
const mappingStatus = readJson("data/newreward-air-express-provider-readonly-recheck.json");
const serviceTitanStatus = readJson("data/servicetitan-export-access-check.json");
const siteManifest = readJson("data/site-file-manifest.json");
const publicClaims = readJson("data/public-claim-register.json");

const closedCount = completionRows.filter((row) => row.status === "closed").length;
const openCount = completionRows.filter((row) => row.status === "open").length;

const diagnosticCards = [
  ["Live Measurement", liveMeasurement.status, "data/live-measurement-path-check.json"],
  ["Delivery Sync", deliverySync.status, "data/owned-site-delivery-sync-check.json"],
  ["Google History", historyStatus.status, "data/google-history/history-pull-status.json"],
  ["New Reward Mapping", mappingStatus.status, "data/newreward-air-express-provider-readonly-recheck.json"],
  ["ServiceTitan Export", serviceTitanStatus.status, "data/servicetitan-export-access-check.json"],
  ["Site Manifest", siteManifest.status, "data/site-file-manifest.json"],
  ["Public Claims", publicClaims.status, "data/public-claim-register.json"],
];

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Air Express Issue 24-30 Blocker Report</title>
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
    .meta { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); margin-top: 18px; }
    .grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .card { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: var(--white); min-height: 120px; }
    .pill { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 5px 9px; font-size: 12px; font-weight: 700; background: var(--white); }
    .metric { font-size: 34px; font-weight: 750; margin: 2px 0 4px; }
    .good { color: var(--good); }
    .warn { color: var(--warn); }
    .bad { color: var(--bad); }
    .blocked { padding: 12px 14px; border-left: 4px solid var(--bad); background: #fff1f1; color: var(--ink); max-width: 980px; }
    .scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; border: 1px solid var(--line); background: var(--white); }
    th, td { border-bottom: 1px solid var(--line); padding: 10px; text-align: left; vertical-align: top; font-size: 14px; }
    th { background: var(--panel); font-size: 13px; }
    .state { display: inline-block; border-radius: 999px; padding: 4px 8px; color: var(--white); font-size: 12px; font-weight: 750; white-space: nowrap; }
    .complete { background: var(--good); }
    .prepared { background: var(--blue); }
    .blocked-state { background: var(--bad); }
    .partial { background: var(--warn); }
  </style>
</head>
<body>
  <header>
    <h1>Air Express Issue 24-30 Blocker Report</h1>
    <p>Current completion audit for attribution, provider access, live tag delivery, reporting, and ServiceTitan proof lanes.</p>
    <div class="meta">
      <span class="pill">Generated ${escapeHtml(new Date().toISOString())}</span>
      <span class="pill">Repo: CryptoJym/air-express-hvac</span>
      <span class="pill">No provider mutations attempted</span>
      <span class="pill">No Air Express production deploy attempted</span>
    </div>
  </header>

  <main>
    <section class="blocked">
      <strong>Goal state is not complete.</strong>
      Issue #25 is complete, and local source/report fixes are prepared, but #24 and #26-#30 still require external access, mapping, live sync, or ServiceTitan proof before they can close.
    </section>

    <h2>Issue Summary</h2>
    <section class="grid">
      <article class="card"><h3>Closed</h3><div class="metric good">${closedCount}</div><p>#25 NewRewards provider resolver repair.</p></article>
      <article class="card"><h3>Open</h3><div class="metric bad">${openCount}</div><p>#24 and #26-#30 remain open with documented blockers.</p></article>
      <article class="card"><h3>Technical SEO</h3><div class="metric good">${escapeHtml(seoAudit.scores?.technical)}</div><p>Current local SEO/GEO attribution audit.</p></article>
      <article class="card"><h3>Attribution</h3><div class="metric bad">${escapeHtml(seoAudit.scores?.attribution)}</div><p>Blocked by Google scopes, New Reward mapping, live tag sync, and ServiceTitan booking/revenue proof.</p></article>
    </section>

    <h2>Current Diagnostics</h2>
    <div class="scroll">
      <table>
        <thead><tr><th>Surface</th><th>Status</th><th>Evidence File</th></tr></thead>
        <tbody>
          ${diagnosticCards.map(([surface, status, evidence]) => `<tr><td>${escapeHtml(surface)}</td><td><span class="state ${statusClass(status)}">${statusLabel(status)}</span></td><td><code>${escapeHtml(evidence)}</code></td></tr>`).join("\n          ")}
        </tbody>
      </table>
    </div>

    <h2>Issue 24-30 Matrix</h2>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>Issue</th><th>State</th><th>Completion State</th><th>Current Evidence</th><th>Safe Workaround Attempted</th><th>Remaining Blocker</th><th>Done Proof</th><th>Next Action</th>
          </tr>
        </thead>
        <tbody>
          ${completionRows.map((row) => `<tr>
            <td><a href="https://github.com/CryptoJym/air-express-hvac/issues/${escapeHtml(row.issue.replace("#", ""))}">${escapeHtml(row.issue)}</a></td>
            <td>${escapeHtml(row.status)}</td>
            <td><span class="state ${statusClass(row.completion_state)}">${statusLabel(row.completion_state)}</span></td>
            <td>${escapeHtml(row.current_evidence)}</td>
            <td>${escapeHtml(row.safe_workaround_attempted)}</td>
            <td>${escapeHtml(row.remaining_blocker)}</td>
            <td>${escapeHtml(row.done_proof)}</td>
            <td>${escapeHtml(row.next_action)}</td>
          </tr>`).join("\n          ")}
        </tbody>
      </table>
    </div>

    <h2>Acceptance Criteria Audit</h2>
    <p>Detailed criterion-level evidence is recorded in <code>${escapeHtml(acceptancePath)}</code>. An issue stays open when any required criterion remains false.</p>
    <div class="scroll">
      <table>
        <thead><tr><th>Issue</th><th>Closure-Ready Criteria</th><th>Still Not Ready</th><th>Current Gate</th></tr></thead>
        <tbody>
          ${[...acceptanceByIssue.entries()].map(([issue, summary]) => {
            const notReady = summary.total - summary.ready;
            return `<tr><td>${escapeHtml(issue)}</td><td>${summary.ready} / ${summary.total}</td><td>${notReady}</td><td>${escapeHtml(firstText(summary.gates))}</td></tr>`;
          }).join("\n          ")}
        </tbody>
      </table>
    </div>

    <h2>New Reward Cross-Repo Evidence</h2>
    <p>Cross-repo evidence is recorded in <code>${escapeHtml(crossRepoPath)}</code> so paid-run work, New Reward owned-site attribution work, and the Air Express resolver repair are not mistaken for Air Express GSC/GA4/GBP access proof.</p>
    <div class="scroll">
      <table>
        <thead><tr><th>Surface</th><th>State</th><th>Evidence</th><th>Relevance</th><th>Next Action</th></tr></thead>
        <tbody>
          ${crossRepoRows.map((row) => `<tr>
            <td>${escapeHtml(row.scope || row.source)}</td>
            <td><span class="state ${statusClass(row.state)}">${statusLabel(row.state)}</span></td>
            <td>${escapeHtml(row.evidence)}</td>
            <td>${escapeHtml(row.relevance_to_air_express)}</td>
            <td>${escapeHtml(row.next_action)}</td>
          </tr>`).join("\n          ")}
        </tbody>
      </table>
    </div>

    <h2>Evidence Files</h2>
    <p>
      Source CSVs: <code>${escapeHtml(completionPath)}</code>, <code>${escapeHtml(acceptancePath)}</code>, <code>${escapeHtml(crossRepoPath)}</code>.
      Diagnostic reports: <code>pages/new-reward-impact-report.html</code> and <code>pages/seo-geo-attribution-report.html</code>.
    </p>
  </main>
</body>
</html>
`;

fs.mkdirSync(path.join(rootDir, "pages"), { recursive: true });
fs.writeFileSync(path.join(rootDir, outputPath), html);
console.log(`Wrote ${path.join(rootDir, outputPath)}`);
