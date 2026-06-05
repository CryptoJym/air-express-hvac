#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const outJson = "data/seo-geo-deep-dive-audit.json";
const outCsv = "data/seo-geo-deep-dive-issues.csv";
const outCitationCsv = "data/air-express-citation-cleanup-ledger.csv";
const outHtml = "pages/seo-geo-deep-dive-report.html";

const PUBLIC_CITATION_OBSERVATIONS = [
  {
    surface: "Cylex",
    url: "https://www.cylex.us.com/company/air-express-heating-and-air-conditioning-5877278.html",
    status: "legacy_domain",
    observedWebsite: "https://www.airexpresshvac.net/",
    observedPhoneStatus: "not_checked",
    claimStatus: "unknown",
    owner: "New Reward / Air Express",
    evidence: "Public listing shows Air Express in Lehi and links to https://www.airexpresshvac.net/.",
    action: "Claim or update listing to canonical https://airexpressutah.com and verify NAP.",
  },
  {
    surface: "ContractorsUp",
    url: "https://www.contractorsup.com/87980",
    status: "legacy_domain",
    observedWebsite: "https://www.airexpresshvac.net/",
    observedPhoneStatus: "not_checked",
    claimStatus: "unknown",
    owner: "New Reward / Air Express",
    evidence: "Public listing shows airexpresshvac.net plus Facebook profile and a 4.0/5 review snapshot.",
    action: "Update website to canonical domain and record whether profile is claimable.",
  },
  {
    surface: "Bryant dealer locator",
    url: "https://www.bryant.com/en/us/dealers/ut/lehi/628-e-state-st-bry-16112-loc",
    status: "nap_review",
    observedWebsite: "not_checked",
    observedPhoneStatus: "alternate_phone_observed",
    claimStatus: "dealer_profile",
    owner: "Air Express / Bryant dealer channel",
    evidence: "Public dealer profile uses Air Express name/address but displays a phone number that differs from the canonical site phone.",
    action: "Confirm whether the number is an approved tracking/dealer number; update or document if not.",
  },
  {
    surface: "Angi",
    url: "https://www.angi.com/companylist/us/ut/lehi/air-express-heating-and-air-conditioning-inc-reviews-3641163.htm/",
    status: "reputation_risk",
    observedWebsite: "not_checked",
    observedPhoneStatus: "not_checked",
    claimStatus: "unknown",
    owner: "Air Express",
    evidence: "Public profile shows a low rating snapshot and long negative review content.",
    action: "Prepare an owner-approved profile response/monitoring strategy and avoid stronger reputation claims until current proof is supplied.",
  },
  {
    surface: "The Blue Book / ProView",
    url: "https://www.thebluebook.com/iProView/1630726/air-express-heating-air-conditioning/subcontractors/",
    status: "nap_review",
    observedWebsite: "not_checked",
    observedPhoneStatus: "alternate_phone_observed",
    claimStatus: "unknown",
    owner: "New Reward / Air Express",
    evidence: "Public profile has business history and trade categories but shows alternate phone data.",
    action: "Confirm phone/website details and add to citation cleanup ledger.",
  },
  {
    surface: "City to City Market",
    url: "https://citytocitymarket.com/air-express-heating-air-conditioning-lehi",
    status: "claim_opportunity",
    observedWebsite: "not_checked",
    observedPhoneStatus: "canonical_phone_observed",
    claimStatus: "claimable",
    owner: "New Reward / Air Express",
    evidence: "Public listing is claimable and includes address, canonical phone, 1996 history, and license/bond language.",
    action: "Verify claim status and proof before using license/bond wording in public claims.",
  },
  {
    surface: "homeyou",
    url: "https://www.homeyou.com/air-express-heating-air-conditioning-specialist-lehi-ut",
    status: "nap_review",
    observedWebsite: "not_checked",
    observedPhoneStatus: "masked_phone_observed",
    claimStatus: "unknown",
    owner: "New Reward / Air Express",
    evidence: "Public profile uses masked phone and unusual rating fields.",
    action: "Review for duplicate, stale, or malformed listing data.",
  },
  {
    surface: "Utah construction directory",
    url: "https://utah.construction-us.org/947699-air_express_heating_air_conditioning.htm",
    status: "missing_website",
    observedWebsite: "unknown_or_missing",
    observedPhoneStatus: "canonical_phone_observed",
    claimStatus: "unknown",
    owner: "New Reward / Air Express",
    evidence: "Public listing shows Air Express name, address, phone, owner, and website unknown.",
    action: "If claimable, add canonical website and verify category/NAP.",
  },
  {
    surface: "HVAC USA / Nears",
    url: "https://hvac-usa.nears.me/hvac-contractor/united-states/utah/lehi/air-express-heating-and-air-conditioning-lehi-ut/",
    status: "nap_review",
    observedWebsite: "not_checked",
    observedPhoneStatus: "alternate_phone_observed",
    claimStatus: "unknown",
    owner: "New Reward / Air Express",
    evidence: "Public profile shows a phone number and hours that differ from canonical site evidence.",
    action: "Confirm whether data is autogenerated and whether profile can be corrected.",
  },
  {
    surface: "PacifiCorp / Utah efficiency trade ally documents",
    url: "https://www.pacificorp.com/content/dam/pcorp/documents/en/pacificorp/environment/dsm/utah/UT_Energy_Efficiency_and_Peak_Reduction_Report_Appendices.pdf",
    status: "authority_opportunity",
    observedWebsite: "not_applicable",
    observedPhoneStatus: "not_applicable",
    claimStatus: "dated_public_source",
    owner: "New Reward / Air Express",
    evidence: "Public utility/regulatory appendices mention Air Express Heating and Air Conditioning Inc in Lehi.",
    action: "Use only as dated authority context after verifying current program participation and client approval.",
  },
];

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

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

function csvEscape(value) {
  const string = String(value ?? "");
  return /[",\n]/.test(string) ? `"${string.replaceAll("\"", "\"\"")}"` : string;
}

function writeCsv(relativePath, rows, headers) {
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];
  fs.writeFileSync(path.join(rootDir, relativePath), `${lines.join("\n")}\n`);
}

function publicHtmlFiles() {
  const rootHtml = fs.readdirSync(rootDir)
    .filter((file) => file.endsWith(".html") && file !== "404.html");
  const blogHtml = fs.existsSync(path.join(rootDir, "blog"))
    ? fs.readdirSync(path.join(rootDir, "blog"))
      .filter((file) => file.endsWith(".html"))
      .map((file) => `blog/${file}`)
    : [];
  return [...rootHtml, ...blogHtml].sort();
}

function extractAttr(tag, name) {
  const quoted = new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(tag);
  if (quoted) return quoted[2];
  const bare = new RegExp(`${name}\\s*=\\s*([^\\s>]+)`, "i").exec(tag);
  return bare?.[1] ?? "";
}

function metaContent(html, name) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  const tag = tags.find((item) => extractAttr(item, "name").toLowerCase() === name.toLowerCase());
  return tag ? extractAttr(tag, "content").trim() : "";
}

function propertyContent(html, property) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  const tag = tags.find((item) => extractAttr(item, "property").toLowerCase() === property.toLowerCase());
  return tag ? extractAttr(tag, "content").trim() : "";
}

function titleContent(html) {
  return (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalHref(html) {
  return (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] || "").trim();
}

function schemaTypes(html, file) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const types = [];
  const errors = [];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1]);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        const graph = Array.isArray(node?.["@graph"]) ? node["@graph"] : [node];
        for (const graphNode of graph) {
          const rawType = graphNode?.["@type"] ?? "unknown";
          for (const type of Array.isArray(rawType) ? rawType : [rawType]) types.push(type);
        }
      }
    } catch (error) {
      errors.push({ file, error: error.message });
    }
  }
  return { types, errors };
}

function parseFrontmatter(relativePath) {
  const source = read(relativePath);
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  const fields = {};
  if (match) {
    for (const line of match[1].split(/\r?\n/)) {
      const fieldMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!fieldMatch) continue;
      fields[fieldMatch[1]] = fieldMatch[2].replace(/^"|"$/g, "");
    }
  }
  const body = source.replace(/^---\n[\s\S]*?\n---/, "").trim();
  return { fields, body };
}

function summarizePages(files) {
  const pages = files.map((file) => {
    const html = read(file);
    const schema = schemaTypes(html, file);
    const h1Count = [...html.matchAll(/<h1\b/gi)].length;
    const description = metaContent(html, "description");
    return {
      file,
      title: titleContent(html),
      titleLength: titleContent(html).length,
      description,
      descriptionLength: description.length,
      canonical: canonicalHref(html),
      ogTitle: propertyContent(html, "og:title"),
      ogDescription: propertyContent(html, "og:description"),
      twitterCard: metaContent(html, "twitter:card"),
      h1Count,
      schemaTypes: schema.types,
      schemaErrors: schema.errors,
    };
  });

  return {
    total: pages.length,
    missingTitle: pages.filter((page) => !page.title).map((page) => page.file),
    longTitle: pages.filter((page) => page.titleLength > 65).map((page) => ({
      file: page.file,
      length: page.titleLength,
      title: page.title,
    })),
    missingDescription: pages.filter((page) => !page.description).map((page) => page.file),
    shortDescription: pages.filter((page) => page.description && page.descriptionLength < 100).map((page) => ({
      file: page.file,
      length: page.descriptionLength,
      description: page.description,
    })),
    missingCanonical: pages.filter((page) => !page.canonical).map((page) => page.file),
    missingSchema: pages.filter((page) => page.schemaTypes.length === 0).map((page) => page.file),
    missingTwitterCard: pages.filter((page) => !page.twitterCard).map((page) => page.file),
    h1Issues: pages.filter((page) => page.h1Count !== 1).map((page) => ({
      file: page.file,
      h1Count: page.h1Count,
    })),
    schemaErrors: pages.flatMap((page) => page.schemaErrors),
    schemaTypeCounts: pages.reduce((counts, page) => {
      for (const type of page.schemaTypes) counts[type] = (counts[type] || 0) + 1;
      return counts;
    }, {}),
  };
}

function summarizeBlog() {
  const blogDir = path.join(rootDir, "content/blog");
  if (!fs.existsSync(blogDir)) return { total: 0, posts: [] };
  const posts = fs.readdirSync(blogDir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => {
      const { fields, body } = parseFrontmatter(`content/blog/${file}`);
      const links = [...body.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
      const internalLinks = links.filter((link) => !/^https?:/i.test(link));
      const externalLinks = links.filter((link) => /^https?:/i.test(link));
      const questionHeadings = [...body.matchAll(/^#{2,4}\s+(.+\?)/gm)];
      const tableLines = [...body.matchAll(/^\|.+\|$/gm)];
      const wordCount = body.split(/\s+/).filter(Boolean).length;
      return {
        file,
        title: fields.title || "",
        draft: fields.draft || "",
        date: fields.date || "",
        wordCount,
        questionHeadingCount: questionHeadings.length,
        tableLineCount: tableLines.length,
        internalLinkCount: internalLinks.length,
        externalLinkCount: externalLinks.length,
        generated: fs.existsSync(path.join(rootDir, "blog", file.replace(/\.md$/, ".html"))),
      };
    });
  return {
    total: posts.length,
    published: posts.filter((post) => post.draft === "false").length,
    drafts: posts.filter((post) => post.draft === "true").length,
    posts,
    weakExtractability: posts.filter((post) =>
      post.questionHeadingCount === 0 ||
      post.internalLinkCount === 0 ||
      post.externalLinkCount === 0,
    ),
    weakPublishedExtractability: posts.filter((post) =>
      post.draft !== "true" &&
      (post.questionHeadingCount === 0 ||
        post.internalLinkCount === 0 ||
        post.externalLinkCount === 0),
    ),
    weakDraftExtractability: posts.filter((post) =>
      post.draft === "true" &&
      (post.questionHeadingCount === 0 ||
        post.internalLinkCount === 0 ||
        post.externalLinkCount === 0),
    ),
  };
}

function issueRows({ metadata, blog, attribution }) {
  const rows = [];
  const metadataIssueCount =
    metadata.shortDescription.length +
    metadata.missingSchema.length +
    metadata.missingTwitterCard.length;
  const weakPublished = blog.weakPublishedExtractability || [];
  const weakDrafts = blog.weakDraftExtractability || [];
  const attributionScore = readJson("data/seo-geo-attribution-audit.json").scores?.attribution ?? "pending";

  if (metadataIssueCount > 0) {
    rows.push({
      key: "metadata-descriptions-social-tags",
      bucket: "metadata",
      severity: "medium",
      title: "Tighten Air Express metadata descriptions, schema coverage, and social tags",
      evidence: `${metadata.shortDescription.length} pages have short or truncated descriptions; ${metadata.missingSchema.length} pages have no JSON-LD schema; ${metadata.missingTwitterCard.length} pages have no Twitter card tag.`,
      acceptance: "Descriptions are complete for flagged pages; resources/blog index schema is added or explicitly excluded; Twitter card tags are normalized or intentionally omitted with evidence.",
      trackingIssue: "https://github.com/CryptoJym/air-express-hvac/issues/32",
    });
  }

  if (weakPublished.length > 0) {
    rows.push({
      key: "blog-geo-extractability",
      bucket: "blogging",
      severity: "high",
      title: "Upgrade Air Express blog posts for GEO extractability and internal-link authority",
      evidence: `${weakPublished.length} published content/blog posts lack at least one extractability signal: question headings, internal links, or external citations.`,
      acceptance: "Priority posts include natural-language answer headings, useful internal links, appropriate external/official citations, and article schema remains valid after rebuild.",
      trackingIssue: "https://github.com/CryptoJym/air-express-hvac/issues/33",
    });
  } else if (weakDrafts.length > 0) {
    rows.push({
      key: "draft-blog-geo-extractability",
      bucket: "blogging",
      severity: "low",
      title: "Prepare draft Air Express posts for GEO extractability before publishing",
      evidence: `${weakDrafts.length} draft/future content/blog posts still need question headings, internal links, or external citations before release.`,
      acceptance: "Draft posts are upgraded before publication; current published posts keep question headings, internal links, external citations, and valid article schema.",
      trackingIssue: "Future content prep",
    });
  }

  rows.push(
    {
      key: "citation-backlink-cleanup",
      bucket: "backlinks",
      severity: "high",
      title: "Create Air Express backlink and local citation cleanup ledger",
      evidence: `${PUBLIC_CITATION_OBSERVATIONS.length} public citation surfaces were observed; several show legacy domain, alternate phone, reputation, missing website, or claim-status risks.`,
      acceptance: "Citation ledger records surface, URL, observed NAP/website/rating state, owner/claim status, requested fix, proof date, and whether a backlink/citation is usable for reporting.",
      trackingIssue: "https://github.com/CryptoJym/air-express-hvac/issues/34",
    },
    {
      key: "tagging-live-attribution",
      bucket: "tagging",
      severity: "high",
      title: "Restore live tagging and attribution joins after source access is repaired",
      evidence: `Current direct Google status is GSC=${attribution.gsc?.status || "unknown"}, GA4=${attribution.ga4?.status || "unknown"}, GBP=${attribution.gbp?.status || "unknown"}; attribution score remains blocked at ${attributionScore}.`,
      acceptance: "Live page exposes the approved single GA4 path, direct GSC/GA4/GBP history or exact provider blockers are visible in reports, and ServiceTitan joins are added or blocked with exact proof.",
      trackingIssue: "Existing: #24, #27, #28, #29, #30",
    },
    {
      key: "authority-proof-pages",
      bucket: "geo",
      severity: "medium",
      title: "Build proof-backed authority surfaces for AI and local-service citations",
      evidence: "Public sources include dealer, directory, trade, and utility/regulatory mentions, but current site content does not convert those into approved proof pages or dated authority references.",
      acceptance: "At least two proof-backed pages or sections are prepared with approved client evidence, dated source links, claim-safe wording, and inclusion rules for llms.txt/sitemap after live verification.",
      trackingIssue: "https://github.com/CryptoJym/air-express-hvac/issues/35",
    },
  );

  return rows;
}

const htmlFiles = publicHtmlFiles();
const metadata = summarizePages(htmlFiles);
const blog = summarizeBlog();
const seoAudit = readJson("data/seo-geo-attribution-audit.json");
const historyStatus = readJson("data/google-history/history-pull-status.json");
const snapshotHistory = readJson("data/google-history/newreward-snapshot-history.json");
const rows = issueRows({ metadata, blog, attribution: historyStatus });

const audit = {
  generatedAt: new Date().toISOString(),
  evidenceClass: "seo_geo_deep_dive",
  scope: [
    "metadata",
    "backlinks_public_citations",
    "tagging_attribution",
    "blogging_geo_extractability",
  ],
  caveats: [
    "Public citation observations are search-result/public-page evidence, not full Ahrefs/Semrush backlink totals.",
    "Saved New Reward GSC and AI snapshots are visibility evidence, not direct Google API history or lead/revenue proof.",
    "Provider mutations, public sends, and ServiceTitan actions should still record proof before being marked verified.",
  ],
  scores: seoAudit.scores || {},
  visibility: {
    latestSavedGsc: snapshotHistory.gscSnapshotSummary?.latest || null,
    aiSnapshots: snapshotHistory.aiSnapshots || null,
    directGoogle: {
      gsc: historyStatus.gsc || null,
      ga4: historyStatus.ga4 || null,
      gbp: historyStatus.gbp || null,
    },
    attributionStatus: historyStatus.status || "unknown",
  },
  metadata,
  blog,
  publicCitationObservations: PUBLIC_CITATION_OBSERVATIONS,
  recommendedIssues: rows,
};

fs.mkdirSync(path.join(rootDir, "data"), { recursive: true });
fs.mkdirSync(path.join(rootDir, "pages"), { recursive: true });
fs.writeFileSync(path.join(rootDir, outJson), `${JSON.stringify(audit, null, 2)}\n`);
writeCsv(outCsv, rows, ["key", "bucket", "severity", "title", "evidence", "acceptance", "trackingIssue"]);
writeCsv(
  outCitationCsv,
  PUBLIC_CITATION_OBSERVATIONS.map((row) => ({
    surface: row.surface,
    url: row.url,
    status: row.status,
    observedWebsite: row.observedWebsite,
    observedPhoneStatus: row.observedPhoneStatus,
    claimStatus: row.claimStatus,
    owner: row.owner,
    evidence: row.evidence,
    requestedAction: row.action,
    proofDate: audit.generatedAt.slice(0, 10),
    reportableAsBacklink: ["legacy_domain", "missing_website"].includes(row.status)
      ? "not_until_canonicalized"
      : row.status === "authority_opportunity"
        ? "proof_gated"
        : "review_required",
  })),
  [
    "surface",
    "url",
    "status",
    "observedWebsite",
    "observedPhoneStatus",
    "claimStatus",
    "owner",
    "evidence",
    "requestedAction",
    "proofDate",
    "reportableAsBacklink",
  ],
);

const issueTable = rows.map((row) => `<tr>
  <td>${escapeHtml(row.bucket)}</td>
  <td><strong>${escapeHtml(row.title)}</strong></td>
  <td>${escapeHtml(row.severity)}</td>
  <td>${escapeHtml(row.evidence)}</td>
  <td>${escapeHtml(row.acceptance)}</td>
  <td>${/^https?:/i.test(row.trackingIssue || "") ? `<a href="${escapeHtml(row.trackingIssue)}">${escapeHtml(row.trackingIssue)}</a>` : escapeHtml(row.trackingIssue || "")}</td>
</tr>`).join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Air Express SEO/GEO Deep Dive</title>
  <style>
    :root { --ink:#162231; --muted:#5e6b78; --line:#d9e2ea; --panel:#f6f9fb; --good:#287549; --warn:#9f5d00; --bad:#b33434; --blue:#0d66a2; --white:#fff; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--white); line-height: 1.45; }
    header { padding: 34px clamp(18px, 5vw, 58px) 24px; background: #eef6fb; border-bottom: 1px solid var(--line); }
    main { padding: 24px clamp(18px, 5vw, 58px) 56px; }
    h1 { margin: 0 0 8px; font-size: clamp(28px, 4vw, 44px); letter-spacing: 0; }
    h2 { margin: 30px 0 12px; font-size: 20px; letter-spacing: 0; }
    h3 { margin: 0 0 8px; font-size: 16px; letter-spacing: 0; }
    p { margin: 0 0 12px; color: var(--muted); max-width: 980px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    a { color: var(--blue); }
    .meta, .grid { display: grid; gap: 12px; }
    .meta { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); margin-top: 18px; }
    .grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .card { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: var(--white); min-height: 120px; }
    .pill { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 5px 9px; font-size: 12px; font-weight: 700; background: var(--white); }
    .metric { font-size: 34px; font-weight: 750; margin: 2px 0 4px; }
    .good { color: var(--good); } .warn { color: var(--warn); } .bad { color: var(--bad); }
    .note { padding: 12px 14px; border-left: 4px solid var(--warn); background: #fff8ec; color: var(--ink); max-width: 980px; }
    .scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; border: 1px solid var(--line); background: var(--white); }
    th, td { border-bottom: 1px solid var(--line); padding: 10px; text-align: left; vertical-align: top; font-size: 14px; }
    th { background: var(--panel); font-size: 13px; }
  </style>
</head>
<body>
  <header>
    <h1>Air Express SEO/GEO Deep Dive</h1>
    <p>Metadata, backlinks/public citations, tagging/attribution, and blogging extractability audit for the repo-local Pages reporting lane.</p>
    <div class="meta">
      <span class="pill">Generated ${escapeHtml(audit.generatedAt)}</span>
      <span class="pill">GitHub Pages report only</span>
      <span class="pill">No secrets or customer PII</span>
      <span class="pill">Backlink data is public-citation evidence, not full link-index totals</span>
      <span class="pill">Ledger: <a href="../data/air-express-citation-cleanup-ledger.csv">citation cleanup CSV</a></span>
    </div>
  </header>
  <main>
    <section class="note">Traditional local source SEO is mostly healthy, but GEO and attribution need stronger extractable content, source-backed authority, live tagging, and public citation cleanup.</section>

    <h2>Audit Summary</h2>
    <section class="grid">
      <article class="card"><h3>Technical SEO</h3><div class="metric good">${escapeHtml(audit.scores.technical ?? "pending")}</div><p>Existing local audit score.</p></article>
      <article class="card"><h3>GEO</h3><div class="metric good">${escapeHtml(audit.scores.geo ?? "pending")}</div><p>Good base, but blog extractability and authority citations need work.</p></article>
      <article class="card"><h3>Attribution</h3><div class="metric bad">${escapeHtml(audit.scores.attribution ?? "pending")}</div><p>Direct Google and lead joins remain blocked.</p></article>
      <article class="card"><h3>Public Citations</h3><div class="metric warn">${PUBLIC_CITATION_OBSERVATIONS.length}</div><p>Observed public citation surfaces needing cleanup or proof review.</p></article>
    </section>

    <h2>Metadata And Schema</h2>
    <section class="grid">
      <article class="card"><h3>Short Descriptions</h3><div class="metric warn">${metadata.shortDescription.length}</div><p>Pages with descriptions under 100 characters.</p></article>
      <article class="card"><h3>No Schema</h3><div class="metric warn">${metadata.missingSchema.length}</div><p>${escapeHtml(metadata.missingSchema.join(", ") || "None")}</p></article>
      <article class="card"><h3>Missing Twitter Card</h3><div class="metric warn">${metadata.missingTwitterCard.length}</div><p>Social preview tags are inconsistent.</p></article>
      <article class="card"><h3>Schema Errors</h3><div class="metric good">${metadata.schemaErrors.length}</div><p>JSON-LD parse errors found.</p></article>
    </section>

    <h2>Recommended Issues</h2>
    <div class="scroll">
      <table>
        <thead><tr><th>Bucket</th><th>Issue</th><th>Severity</th><th>Evidence</th><th>Acceptance</th><th>Tracking</th></tr></thead>
        <tbody>${issueTable}</tbody>
      </table>
    </div>

    <h2>Public Citation / Backlink Observations</h2>
    <div class="scroll">
      <table>
        <thead><tr><th>Surface</th><th>Status</th><th>Evidence</th><th>Action</th><th>URL</th></tr></thead>
        <tbody>${PUBLIC_CITATION_OBSERVATIONS.map((row) => `<tr>
          <td>${escapeHtml(row.surface)}</td>
          <td>${escapeHtml(row.status)}</td>
          <td>${escapeHtml(row.evidence)}</td>
          <td>${escapeHtml(row.action)}</td>
          <td><a href="${escapeHtml(row.url)}">${escapeHtml(row.url)}</a></td>
        </tr>`).join("\n")}</tbody>
      </table>
    </div>

    <h2>Blog Extractability</h2>
    <div class="scroll">
      <table>
        <thead><tr><th>Post</th><th>Draft</th><th>Words</th><th>Question headings</th><th>Internal links</th><th>External links</th><th>Generated</th></tr></thead>
        <tbody>${blog.posts.map((post) => `<tr>
          <td><code>${escapeHtml(post.file)}</code><br>${escapeHtml(post.title)}</td>
          <td>${escapeHtml(post.draft)}</td>
          <td>${escapeHtml(post.wordCount)}</td>
          <td>${escapeHtml(post.questionHeadingCount)}</td>
          <td>${escapeHtml(post.internalLinkCount)}</td>
          <td>${escapeHtml(post.externalLinkCount)}</td>
          <td>${escapeHtml(post.generated)}</td>
        </tr>`).join("\n")}</tbody>
      </table>
    </div>
  </main>
</body>
</html>
`;

fs.writeFileSync(path.join(rootDir, outHtml), html);

console.log(`Wrote ${path.join(rootDir, outJson)}`);
console.log(`Wrote ${path.join(rootDir, outCsv)}`);
console.log(`Wrote ${path.join(rootDir, outCitationCsv)}`);
console.log(`Wrote ${path.join(rootDir, outHtml)}`);
