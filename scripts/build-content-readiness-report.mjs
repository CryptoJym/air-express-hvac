#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const outputPath = "pages/content-readiness-report.html";

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
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

function statusClass(value) {
  if (/ready|generated|passed/.test(value)) return "good-state";
  if (/draft|review|prepared|pending/.test(value)) return "prepared-state";
  return "blocked-state";
}

function readFrontmatter(relativePath) {
  const source = read(relativePath);
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const fieldMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!fieldMatch) continue;
    fields[fieldMatch[1]] = fieldMatch[2].replace(/^"|"$/g, "");
  }
  return fields;
}

const contentBriefs = parseCsv(read("data/content-briefs.csv"));
const distributionRows = parseCsv(read("data/distribution-ledger.csv")).filter(
  (row) => row.lane === "content" || row.asset_id.startsWith("max-")
);

const thisWeekSlugs = [
  "first-hot-week-ac-checklist-utah",
  "wildfire-smoke-hvac-filter-utah",
  "thermostat-settings-utah-heat-wave",
];

const postRows = thisWeekSlugs.map((slug) => {
  const frontmatter = readFrontmatter(`content/blog/${slug}.md`);
  const generatedPath = `blog/${slug}.html`;
  const generated = fs.existsSync(path.join(rootDir, generatedPath));
  const brief = contentBriefs.find((row) => row.recommended_slug === slug) || {};
  return {
    slug,
    title: frontmatter.title,
    draft: frontmatter.draft,
    date: frontmatter.date,
    generated,
    generatedPath,
    briefStatus: brief.status,
    gate: brief.publication_gate,
    proof: brief.proof_required,
    attribution: brief.attribution_plan,
  };
});

const statusCounts = contentBriefs.reduce((counts, row) => {
  counts[row.status] = (counts[row.status] || 0) + 1;
  return counts;
}, {});

const readyPostCount = postRows.filter((row) => row.draft === "false" && row.generated).length;
const draftPostCount = postRows.filter((row) => row.draft === "true" && !row.generated).length;

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Air Express Content Readiness Report</title>
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
    .metric { font-size: 34px; font-weight: 750; margin: 2px 0 4px; }
    .pill, .state { display: inline-block; border-radius: 999px; padding: 5px 9px; font-size: 12px; font-weight: 750; white-space: nowrap; }
    .pill { border: 1px solid var(--line); background: var(--white); }
    .good { color: var(--good); }
    .warn { color: var(--warn); }
    .bad { color: var(--bad); }
    .good-state { background: var(--good); color: var(--white); }
    .prepared-state { background: var(--blue); color: var(--white); }
    .blocked-state { background: var(--bad); color: var(--white); }
    .note { padding: 12px 14px; border-left: 4px solid var(--warn); background: #fff8ec; color: var(--ink); max-width: 980px; }
    .scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; border: 1px solid var(--line); background: var(--white); }
    th, td { border-bottom: 1px solid var(--line); padding: 10px; text-align: left; vertical-align: top; font-size: 14px; }
    th { background: var(--panel); font-size: 13px; }
  </style>
</head>
<body>
  <header>
    <h1>Air Express Content Readiness Report</h1>
    <p>Repo-local status for the blog, distribution, sub-agent, and Max outreach lane. Prepared only; no public send, post, schedule, provider mutation, or production deploy occurred.</p>
    <div class="meta">
      <span class="pill">Generated ${escapeHtml(new Date().toISOString())}</span>
      <span class="pill">Issue #31 separate from #24-#30</span>
      <span class="pill">No public distribution attempted</span>
      <span class="pill">No customer PII stored</span>
    </div>
  </header>
  <main>
    <section class="note">
      One seasonal blog post is ready in local source and generated locally. Two this-week posts remain draft-only pending Max/New Reward approval. Social access and case-study outreach are drafted locally only.
    </section>

    <h2>Content Summary</h2>
    <section class="grid">
      <article class="card"><h3>Total Briefs</h3><div class="metric good">${contentBriefs.length}</div><p>Structured in <code>data/content-briefs.csv</code>.</p></article>
      <article class="card"><h3>Ready Local Posts</h3><div class="metric good">${readyPostCount}</div><p>Ready in source and generated locally, pending approved live delivery.</p></article>
      <article class="card"><h3>Draft Posts</h3><div class="metric warn">${draftPostCount}</div><p>Excluded from generated blog outputs until approved.</p></article>
      <article class="card"><h3>External Sends</h3><div class="metric bad">0</div><p>Max/social/case-study requests remain draft-only.</p></article>
    </section>

    <h2>This Week</h2>
    <div class="scroll">
      <table>
        <thead><tr><th>Slug</th><th>Title</th><th>Draft</th><th>Generated</th><th>Brief State</th><th>Gate</th><th>Proof Required</th></tr></thead>
        <tbody>
          ${postRows.map((row) => `<tr>
            <td><code>${escapeHtml(row.slug)}</code></td>
            <td>${escapeHtml(row.title)}</td>
            <td><span class="state ${row.draft === "false" ? "good-state" : "prepared-state"}">${escapeHtml(row.draft)}</span></td>
            <td>${row.generated ? `<code>${escapeHtml(row.generatedPath)}</code>` : "not generated"}</td>
            <td><span class="state ${statusClass(row.briefStatus)}">${escapeHtml(row.briefStatus)}</span></td>
            <td>${escapeHtml(row.gate)}</td>
            <td>${escapeHtml(row.proof)}</td>
          </tr>`).join("\n          ")}
        </tbody>
      </table>
    </div>

    <h2>Brief Backlog</h2>
    <div class="scroll">
      <table>
        <thead><tr><th>ID</th><th>Status</th><th>Working Title</th><th>Target Query</th><th>Slug</th><th>Internal Links</th><th>Attribution Plan</th></tr></thead>
        <tbody>
          ${contentBriefs.map((row) => `<tr>
            <td>${escapeHtml(row.brief_id)}</td>
            <td><span class="state ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
            <td>${escapeHtml(row.working_title)}</td>
            <td>${escapeHtml(row.target_query)}</td>
            <td><code>${escapeHtml(row.recommended_slug)}</code></td>
            <td>${escapeHtml(row.internal_links)}</td>
            <td>${escapeHtml(row.attribution_plan)}</td>
          </tr>`).join("\n          ")}
        </tbody>
      </table>
    </div>

    <h2>Distribution And Max Follow-Up</h2>
    <div class="scroll">
      <table>
        <thead><tr><th>Asset</th><th>Lane</th><th>State</th><th>Destination</th><th>Next Action</th><th>Blocker</th></tr></thead>
        <tbody>
          ${distributionRows.map((row) => `<tr>
            <td>${escapeHtml(row.asset_id)}</td>
            <td>${escapeHtml(row.lane)}</td>
            <td><span class="state ${statusClass(row.state)}">${escapeHtml(row.state)}</span></td>
            <td>${escapeHtml(row.destination)}</td>
            <td>${escapeHtml(row.next_action)}</td>
            <td>${escapeHtml(row.blocker)}</td>
          </tr>`).join("\n          ")}
        </tbody>
      </table>
    </div>

    <h2>Source Files</h2>
    <p>
      Content briefs: <code>data/content-briefs.csv</code> and <code>docs/air-express-content-briefs.md</code>.
      Distribution schedule: <code>docs/air-express-blog-distribution-schedule.md</code>.
      Max drafts: <code>docs/max-social-access-request-draft.md</code> and <code>docs/max-case-study-outreach-draft.md</code>.
    </p>
    <p>
      Refresh command: <code>npm run build:content-readiness-report</code>. Verification command:
      <code>npm run verify:onboarding-evidence</code>.
    </p>
  </main>
</body>
</html>
`;

fs.mkdirSync(path.join(rootDir, "pages"), { recursive: true });
fs.writeFileSync(path.join(rootDir, outputPath), html);
console.log(`Wrote ${path.join(rootDir, outputPath)}`);
