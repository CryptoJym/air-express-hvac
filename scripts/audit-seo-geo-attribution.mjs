import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const baseUrl = "https://airexpressutah.com";
const legacyUrl = "https://airexpresshvac.net";
const now = new Date();
const reportDate = now.toISOString().slice(0, 10);

const outJson = join(root, "data", "seo-geo-attribution-audit.json");
const outHtml = join(root, "pages", "seo-geo-attribution-report.html");
const newRewardAttributionCheckPath = join(root, "data", "newreward-attribution-source-check.json");
const liveMeasurementCheckPath = join(root, "data", "live-measurement-path-check.json");
const ownedSiteDeliverySyncCheckPath = join(root, "data", "owned-site-delivery-sync-check.json");
const publicClaimRegisterPath = join(root, "data", "public-claim-register.json");

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function readOptionalJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function walk(dir, files = []) {
  const excludedDirs = ["node_modules", ".git", "output"].map((name) => join(dir, name));
  const args = [
    dir,
    "(",
    ...excludedDirs.flatMap((path, index) => index === 0 ? ["-path", path] : ["-o", "-path", path]),
    ")",
    "-prune",
    "-o",
    "-type",
    "f",
    "-print",
  ];
  for (const entry of execFileSync("find", args, { encoding: "utf8", maxBuffer: 1024 * 1024 * 10 }).trim().split("\n").filter(Boolean)) {
    files.push(entry);
  }
  return files;
}

function stripTags(value = "") {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function attr(tag, name) {
  const quoted = new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(tag);
  if (quoted) return quoted[2];
  const bare = new RegExp(`${name}\\s*=\\s*([^\\s>]+)`, "i").exec(tag);
  return bare?.[1] ?? "";
}

function hasAttr(tag, name) {
  return new RegExp(`\\s${name}(?:\\s*=|\\s|>)`, "i").test(tag);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sha256(value = "") {
  return createHash("sha256").update(value).digest("hex");
}

function matchContent(html, pattern) {
  return pattern.exec(html)?.[1]?.trim() ?? "";
}

function canonicalFor(relPath) {
  const normalized = relPath === "index.html" ? "" : relPath;
  return `${baseUrl}/${normalized}`;
}

function localPathFromUrl(url) {
  const parsed = new URL(url);
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname === "/") pathname = "/index.html";
  if (pathname.endsWith("/")) pathname += "index.html";
  return pathname.slice(1);
}

function isPublicHtml(relPath) {
  if (!relPath.endsWith(".html")) return false;
  if (relPath.split("/").some((part) => part.startsWith("."))) return false;
  if (relPath.startsWith("admin/")) return false;
  if (relPath.startsWith("templates/")) return false;
  if (relPath.startsWith("output/")) return false;
  if (relPath.startsWith("pages/")) return false;
  if (relPath.startsWith("node_modules/")) return false;
  return !["404.html"].includes(relPath);
}

function parseJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const parsed = [];
  for (const block of blocks) {
    const raw = block[1].trim();
    try {
      const json = JSON.parse(raw);
      const nodes = Array.isArray(json) ? json : [json];
      for (const node of nodes) {
        const graph = Array.isArray(node?.["@graph"]) ? node["@graph"] : [node];
        for (const graphNode of graph) {
          parsed.push({ ok: true, type: graphNode?.["@type"] ?? "unknown" });
        }
      }
    } catch (error) {
      parsed.push({ ok: false, type: "parse_error", error: error.message });
    }
  }
  return parsed;
}

function scanAccessibility(html, relPath) {
  const findings = [];
  const add = (type, severity, evidence, fix) => findings.push({ type, severity, evidence, fix });

  if (!/<html\b[^>]*\slang=["'][^"']+["'][^>]*>/i.test(html)) {
    add("html_lang_missing", "High", "The root <html> element does not declare a language.", "Add lang=\"en\" to the root <html> element.");
  }

  if (!/<main\b/i.test(html)) {
    add("main_landmark_missing", "High", "No <main> landmark was found.", "Wrap the primary page content in a single <main> landmark.");
  }

  if (!/<a\b[^>]+href=["']#(?:main|content|main-content)["'][^>]*>/i.test(html)) {
    add("skip_link_missing", "Medium", "No skip link to the main content landmark was found.", "Add a visible-on-focus skip link before the site header.");
  }

  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((m) => m[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicateIds.length) {
    add("duplicate_ids", "High", `Duplicate id values: ${duplicateIds.slice(0, 6).join(", ")}.`, "Make id values unique so labels, anchors, and ARIA references resolve predictably.");
  }

  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((m) => ({ level: Number(m[1]), text: stripTags(m[2]) }));
  let previousHeading = 0;
  for (const heading of headings) {
    if (previousHeading && heading.level - previousHeading > 1) {
      add("heading_order_jump", "Medium", `Heading jumps from h${previousHeading} to h${heading.level} before "${heading.text.slice(0, 80)}".`, "Use sequential heading levels so screen reader users can navigate the outline.");
      break;
    }
    previousHeading = heading.level;
  }

  const controls = [...html.matchAll(/<(input|select|textarea)\b[^>]*>/gi)];
  const unlabeledControls = [];
  for (const match of controls) {
    const tag = match[0];
    const tagName = match[1].toLowerCase();
    const type = attr(tag, "type").toLowerCase();
    if (["hidden", "submit", "button", "reset", "image"].includes(type)) continue;
    const id = attr(tag, "id");
    const hasExplicitLabel = id
      ? new RegExp(`<label\\b[^>]*\\sfor=["']${escapeRegExp(id)}["'][^>]*>`, "i").test(html)
      : false;
    const hasProgrammaticName = hasAttr(tag, "aria-label") || hasAttr(tag, "aria-labelledby");
    if (!hasExplicitLabel && !hasProgrammaticName) {
      unlabeledControls.push(id ? `${tagName}#${id}` : tagName);
    }
  }
  if (unlabeledControls.length) {
    add("form_control_missing_label", "High", `${unlabeledControls.length} form controls lack a label or ARIA name: ${unlabeledControls.slice(0, 6).join(", ")}.`, "Associate each input/select/textarea with a <label for> or an aria-labelledby value.");
  }

  const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)];
  const unnamedButtons = buttons.filter((match) => {
    const tag = `<button${match[1]}>`;
    const name = attr(tag, "aria-label") || attr(tag, "title") || stripTags(match[2]);
    return !name.trim();
  });
  if (unnamedButtons.length) {
    add("button_missing_accessible_name", "High", `${unnamedButtons.length} buttons have no visible text or ARIA label.`, "Give every icon-only button an aria-label or visible text.");
  }

  const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  const unnamedLinks = links.filter((match) => {
    const tag = `<a${match[1]}>`;
    if (attr(tag, "aria-hidden").toLowerCase() === "true") return false;
    const name = attr(tag, "aria-label") || attr(tag, "title") || stripTags(match[2]);
    const hasNamedImage = /<img\b[^>]*\salt=["'][^"']+["'][^>]*>/i.test(match[2]);
    return !name.trim() && !hasNamedImage;
  });
  if (unnamedLinks.length) {
    add("link_missing_accessible_name", "High", `${unnamedLinks.length} links have no accessible name.`, "Give image/icon links visible text, alt text, or aria-label values.");
  }

  const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imagesWithoutAlt = imageTags.filter((tag) => !hasAttr(tag, "alt"));
  if (imagesWithoutAlt.length) {
    add("image_alt_attribute_missing", "High", `${imagesWithoutAlt.length} images do not include an alt attribute.`, "Add descriptive alt text for informative images and alt=\"\" for decorative images.");
  }

  return findings;
}

function parsePage(relPath) {
  const html = read(relPath);
  const title = matchContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaTags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const descriptionTag = metaTags.find((tag) => attr(tag, "name").toLowerCase() === "description");
  const description = descriptionTag ? attr(descriptionTag, "content") : "";
  const canonical = matchContent(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  const ogUrl = matchContent(html, /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => stripTags(m[1]));
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => stripTags(m[1]));
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => ({
    src: attr(m[0], "src"),
    alt: attr(m[0], "alt"),
    altPresent: hasAttr(m[0], "alt"),
  }));
  const links = [...html.matchAll(/<a\b[^>]*>/gi)].map((m) => attr(m[0], "href")).filter(Boolean);
  const forms = [...html.matchAll(/<form\b[^>]*>/gi)].map((m) => ({
    action: attr(m[0], "action") || "(none)",
    method: attr(m[0], "method") || "get",
  }));
  const jsonLd = parseJsonLd(html);
  const visibleText = stripTags(html);
  const accessibilityIssues = scanAccessibility(html, relPath);

  const issues = [];
  if (!title) issues.push("missing_title");
  if (title && (title.length < 20 || title.length > 65)) issues.push("title_length");
  if (!description) issues.push("missing_meta_description");
  if (description && (description.length < 80 || description.length > 170)) issues.push("meta_description_length");
  if (!canonical) issues.push("missing_canonical");
  if (canonical && canonical !== canonicalFor(relPath)) issues.push("canonical_mismatch");
  if (!ogUrl) issues.push("missing_og_url");
  if (ogUrl && canonical && ogUrl !== canonical) issues.push("og_url_mismatch");
  if (h1s.length !== 1) issues.push(`h1_count_${h1s.length}`);
  if (jsonLd.some((s) => !s.ok)) issues.push("jsonld_parse_error");
  if (images.some((img) => img.src && !img.altPresent)) issues.push("image_alt_missing");
  if (/https?:\/\/(?:www\.)?airexpresshvac\.net/i.test(html)) issues.push("legacy_web_domain_reference");

  return {
    relPath,
    url: canonicalFor(relPath),
    title,
    titleLength: title.length,
    description,
    descriptionLength: description.length,
    canonical,
    ogUrl,
    h1s,
    h2Count: h2s.length,
    images,
    imageCount: images.length,
    missingAltCount: images.filter((img) => img.src && !img.altPresent).length,
    decorativeAltCount: images.filter((img) => img.src && img.altPresent && !img.alt.trim()).length,
    links,
    forms,
    accessibilityIssues,
    emailDomainReferences: [...new Set((visibleText.match(/[A-Z0-9._%+-]+@airexpresshvac\.net/gi) || []))],
    schemaTypes: jsonLd.map((s) => s.type),
    schemaParseErrors: jsonLd.filter((s) => !s.ok).map((s) => s.error),
    issues,
  };
}

function linkTargetExists(href, fromPath) {
  if (/^(https?:|mailto:|tel:|sms:|#|javascript:)/i.test(href)) return true;
  const clean = href.split("#")[0].split("?")[0];
  if (!clean) return true;
  const fromDir = posix.dirname(fromPath);
  const target = clean.startsWith("/")
    ? clean.slice(1)
    : posix.normalize(posix.join(fromDir === "." ? "" : fromDir, clean));
  if (target.endsWith("/")) return existsSync(join(root, target, "index.html"));
  return existsSync(join(root, target)) || existsSync(join(root, `${target}.html`));
}

function vercelRedirectSources() {
  try {
    const config = JSON.parse(read("vercel.json"));
    return new Set((config.redirects || []).flatMap((redirect) => {
      const source = redirect.source || "";
      const values = [source];
      if (source.endsWith(".html")) values.push(source.replace(/\.html$/, ""));
      return values.map((item) => item.replace(/^\//, ""));
    }));
  } catch {
    return new Set();
  }
}

function parseFrontmatterDate(file) {
  const text = readFileSync(join(root, file), "utf8");
  const date = /^date:\s*"?([^"\n]+)"?/m.exec(text)?.[1]?.trim();
  const draft = /^draft:\s*true\s*$/m.test(text);
  return date ? { file, date, draft } : null;
}

async function fetchStatus(url) {
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
      return {
        url,
        ok: response.ok,
        status: response.status,
        finalUrl: response.url,
        contentType: response.headers.get("content-type") || "",
        newRewardsEdge: response.headers.get("x-newrewards-edge-active-version") || "",
        attempts: attempt,
      };
    } catch (error) {
      lastError = error.message;
    } finally {
      clearTimeout(timeout);
    }
  }
  return { url, ok: false, status: 0, finalUrl: "", error: lastError, contentType: "", newRewardsEdge: "", attempts: 2 };
}

async function fetchTextArtifact(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    const text = await response.text();
    return {
      url,
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get("content-type") || "",
      newRewardsEdge: response.headers.get("x-newrewards-edge-active-version") || "",
      managedPath: response.headers.get("x-newrewards-edge-managed-path") || "",
      routeMode: response.headers.get("x-newrewards-edge-route-mode") || "",
      servedBy: response.headers.get("x-newrewards-edge-served-by") || "",
      websiteId: response.headers.get("x-newrewards-edge-website-id") || "",
      hash: sha256(text),
      byteLength: Buffer.byteLength(text),
      text,
    };
  } catch (error) {
    return { url, ok: false, status: 0, finalUrl: "", error: error.message, contentType: "", hash: "", byteLength: 0, text: "" };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapLimit(items, limit, fn) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function gcloudToken() {
  const activeAccount = spawnSync("gcloud", ["auth", "list", "--filter=status:ACTIVE", "--format=value(account)"], { encoding: "utf8" });
  const project = spawnSync("gcloud", ["config", "list", "--format=value(core.project)"], { encoding: "utf8" });
  const token = spawnSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" });
  if (token.status !== 0) {
    return {
      ok: false,
      account: activeAccount.stdout.trim(),
      project: project.stdout.trim(),
      blocker: token.stderr.trim().split("\n")[0] || "gcloud token unavailable",
    };
  }
  return { ok: true, account: activeAccount.stdout.trim(), project: project.stdout.trim(), token: token.stdout.trim() };
}

async function googleJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { status: response.status, ok: response.ok, json };
}

function isoDateDaysAgo(days) {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function pullGoogleData() {
  const auth = gcloudToken();
  const base = {
    auth: auth.ok ? { ok: true, account: auth.account, project: auth.project } : auth,
    gsc: { status: "blocked", rows: [], sites: [] },
    ga4: { status: "blocked", rows: [], accounts: [] },
    gbp: { status: "blocked", rows: [], locations: [] },
  };

  if (!auth.ok) return base;

  const sites = await googleJson("https://www.googleapis.com/webmasters/v3/sites", auth.token);
  if (!sites.ok || sites.json.error) {
    base.gsc = {
      status: "blocked",
      blocker: sites.json.error?.message || `Search Console sites request failed with ${sites.status}`,
      sites: [],
      rows: [],
    };
  } else {
    const siteEntries = sites.json.siteEntry || [];
    const candidates = ["sc-domain:airexpressutah.com", "https://airexpressutah.com/", "https://www.airexpressutah.com/"];
    const selected = siteEntries.find((s) => candidates.includes(s.siteUrl));
    base.gsc.sites = siteEntries.map((s) => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel }));
    if (!selected) {
      base.gsc.status = "blocked";
      base.gsc.blocker = "No matching Search Console property found for airexpressutah.com.";
    } else {
      const body = {
        startDate: isoDateDaysAgo(486),
        endDate: isoDateDaysAgo(3),
        dimensions: ["date"],
        rowLimit: 25000,
      };
      const encoded = encodeURIComponent(selected.siteUrl);
      const data = await googleJson(`https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`, auth.token, {
        method: "POST",
        body: JSON.stringify(body),
      });
      base.gsc.status = data.ok ? "pulled" : "blocked";
      base.gsc.property = selected.siteUrl;
      base.gsc.blocker = data.ok ? "" : data.json.error?.message || `Search Analytics query failed with ${data.status}`;
      base.gsc.rows = data.json.rows || [];
    }
  }

  const accounts = await googleJson("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", auth.token);
  if (!accounts.ok || accounts.json.error) {
    base.ga4 = {
      status: "blocked",
      blocker: accounts.json.error?.message || `Analytics Admin request failed with ${accounts.status}`,
      accounts: [],
      rows: [],
    };
  } else {
    const summaries = accounts.json.accountSummaries || [];
    const flatProperties = summaries.flatMap((a) => (a.propertySummaries || []).map((p) => ({
      account: a.account,
      accountDisplayName: a.displayName,
      property: p.property,
      displayName: p.displayName,
      propertyType: p.propertyType,
    })));
    const selected = flatProperties.find((p) => /air\s*express|airexpress|air-express/i.test(`${p.displayName} ${p.accountDisplayName}`));
    base.ga4.accounts = flatProperties;
    if (!selected) {
      base.ga4.status = "blocked";
      base.ga4.blocker = "No matching GA4 property found by display name. Set GA4_PROPERTY_ID or grant property access.";
    } else {
      const propertyId = selected.property.split("/").pop();
      const body = {
        dateRanges: [{ startDate: isoDateDaysAgo(486), endDate: isoDateDaysAgo(1) }],
        dimensions: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "eventCount" }, { name: "conversions" }],
        limit: "100000",
      };
      const data = await googleJson(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, auth.token, {
        method: "POST",
        body: JSON.stringify(body),
      });
      base.ga4.status = data.ok ? "pulled" : "blocked";
      base.ga4.property = selected;
      base.ga4.blocker = data.ok ? "" : data.json.error?.message || `GA4 runReport failed with ${data.status}`;
      base.ga4.rows = data.json.rows || [];
    }
  }
  const historyStatus = readOptionalJson(join(root, "data/google-history/history-pull-status.json"));
  if (historyStatus?.gbp) {
    base.gbp = {
      status: historyStatus.gbp.status || "blocked",
      blocker: historyStatus.gbp.evidence || "",
      rows: [],
      locations: [],
    };
  }
  return base;
}

function scoreFromIssues(count, total, severity = 1) {
  if (total === 0) return 100;
  return Math.max(0, Math.round(100 - (count / total) * 100 * severity));
}

function aggregateGoogleRows(gscRows, gaRows) {
  const byDate = new Map();
  for (const row of gscRows || []) {
    const date = row.keys?.[0];
    if (!date) continue;
    const item = byDate.get(date) || { date, clicks: 0, impressions: 0, ctr: 0, position: 0, sessions: 0, users: 0, conversions: 0, eventCount: 0 };
    item.clicks += row.clicks || 0;
    item.impressions += row.impressions || 0;
    item.ctr = row.ctr || item.ctr;
    item.position = row.position || item.position;
    byDate.set(date, item);
  }
  for (const row of gaRows || []) {
    const date = row.dimensionValues?.[0]?.value;
    if (!date) continue;
    const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    const item = byDate.get(iso) || { date: iso, clicks: 0, impressions: 0, ctr: 0, position: 0, sessions: 0, users: 0, conversions: 0, eventCount: 0 };
    const metrics = row.metricValues || [];
    item.sessions += Number(metrics[0]?.value || 0);
    item.users += Number(metrics[1]?.value || 0);
    item.eventCount += Number(metrics[2]?.value || 0);
    item.conversions += Number(metrics[3]?.value || 0);
    byDate.set(iso, item);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function applyNewRewardAttributionCheck(google, newRewardCheck) {
  if (!newRewardCheck) return google;
  const result = structuredClone(google);
  result.newRewardSystem = newRewardCheck;

  if (newRewardCheck.status === "blocked") {
    const blocker = newRewardCheck.blocker || "Air Express attribution source is not available in the reachable New Reward control-plane records.";
    if (result.gsc.status !== "pulled") {
      result.gsc = { ...result.gsc, status: "blocked", blocker };
    }
    if (result.ga4.status !== "pulled") {
      result.ga4 = { ...result.ga4, status: "blocked", blocker };
    }
    if (result.gbp.status !== "pulled") {
      result.gbp = { ...result.gbp, status: "blocked", blocker };
    }
  }

  return result;
}

function htmlEscape(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function row(cells) {
  return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
}

function groupByType(findings) {
  const grouped = new Map();
  for (const finding of findings) {
    const current = grouped.get(finding.type) || {
      type: finding.type,
      severity: finding.severity,
      count: 0,
      pages: [],
      evidence: finding.evidence,
      fix: finding.fix,
    };
    current.count += 1;
    if (finding.page && current.pages.length < 12) current.pages.push(finding.page);
    grouped.set(finding.type, current);
  }
  return [...grouped.values()].sort((a, b) => {
    const weight = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return (weight[a.severity] ?? 9) - (weight[b.severity] ?? 9) || b.count - a.count;
  });
}

function liveMeasurementEvidenceSummary(check) {
  if (!check) {
    return "";
  }

  const liveHomepage = check.live?.homepage || {};
  const liveAnalytics = check.live?.analyticsJs || {};
  const localIndex = check.local?.index?.markers || {};
  const localAnalytics = check.local?.analyticsJs?.markers || {};
  const localCoverage = check.local?.pageCoverage || {};
  const liveMarkers = liveHomepage.markers || {};
  const liveContainers = Array.isArray(liveMarkers.gtmContainers)
    ? liveMarkers.gtmContainers.join(", ") || "none"
    : "unknown";

  return [
    `measurement diagnostic=${check.status}`,
    `approved GA4=${check.approvedGa4Id || "unknown"}`,
    `local index GA4=${localIndex.approvedGa4Present ? "yes" : "no"}`,
    `local analytics.js GA4=${localAnalytics.approvedGa4Present ? "yes" : "no"}`,
    localCoverage.totalPages
      ? `local public page coverage=${localCoverage.pagesWithAnyApprovedSource?.length || 0}/${localCoverage.totalPages}`
      : "",
    localCoverage.pagesWithUnapprovedGtmContainers
      ? `local unapproved GTM containers=${localCoverage.pagesWithUnapprovedGtmContainers.length}`
      : "",
    `live homepage HTTP=${liveHomepage.status ?? "unknown"}`,
    `live homepage GA4=${liveMarkers.approvedGa4Present ? "yes" : "no"}`,
    `live GTM containers=${liveContainers}`,
    `live /analytics.js HTTP=${liveAnalytics.status ?? "unknown"}`,
    liveHomepage.headers?.xNewRewardsEdgeWebsiteId
      ? `edge website=${liveHomepage.headers.xNewRewardsEdgeWebsiteId}`
      : "",
  ].filter(Boolean).join("; ");
}

function ownedSiteDeliverySyncEvidenceSummary(check) {
  if (!check) {
    return "";
  }

  const artifacts = Array.isArray(check.artifacts) ? check.artifacts : [];
  const artifactSummary = artifacts
    .map((artifact) => `${artifact.name}:${artifact.status}`)
    .join(", ");

  return [
    `delivery diagnostic=${check.status}`,
    `approved GA4=${check.approvedGa4Id || "unknown"}`,
    artifactSummary ? `artifacts=${artifactSummary}` : "",
    `source=data/owned-site-delivery-sync-check.json`,
  ].filter(Boolean).join("; ");
}

function publicClaimRegisterSummary(register) {
  if (!register) {
    return "";
  }

  const claims = Array.isArray(register.claims) ? register.claims : [];
  const bbbAccredited = claims.find((claim) => claim.id === "bbb_accredited");
  const bbbProfile = claims.find((claim) => claim.id === "bbb_business_profile");
  return [
    `claim diagnostic=${register.status || "unknown"}`,
    `forbidden failures=${register.summary?.forbiddenClaimFailures ?? "unknown"}`,
    bbbAccredited ? `BBB Accredited occurrences=${bbbAccredited.occurrenceCount}` : "",
    bbbProfile ? `BBB Business Profile occurrences=${bbbProfile.occurrenceCount}` : "",
    `source=data/public-claim-register.json`,
  ].filter(Boolean).join("; ");
}

function liveMeasurementNarrative(check) {
  if (!check) {
    return "";
  }

  if (check.status === "fixed_locally_pending_live") {
    return `The approved GA4 measurement ID ${check.approvedGa4Id || "G-JZ7PY32EVX"} is restored in repo-local source, but the dedicated live measurement diagnostic still shows no approved GA4/GTM source on the live homepage and live /analytics.js is not available.`;
  }
  if (check.status === "live_single_source_verified_pending_event_proof") {
    return "The live homepage exposes one approved measurement source; conversion-event proof still needs GA4 DebugView/Realtime or an approved non-duplicating test lead.";
  }
  if (check.status === "blocked_duplicate_or_unverified_live_source") {
    return "The live homepage exposes duplicate or unverified measurement sources, so attribution should not be trusted until the exact approved GA4/GTM source is verified.";
  }
  if (check.status === "blocked_local_source") {
    return "The dedicated measurement diagnostic cannot verify the approved GA4 source in local homepage/analytics source.";
  }
  if (check.status === "blocked_live_fetch") {
    return "The dedicated measurement diagnostic could not fetch the live homepage, so live measurement status is blocked.";
  }
  return `The dedicated live measurement diagnostic status is ${check.status}.`;
}

function buildRootCauseMap(context) {
  const {
    newRewardAttributionCheck,
    liveMeasurementCheck,
    onSiteTagEvidence,
    liveOnSiteTagEvidence,
    sitemapRedirectOnly,
    brokenInternalLinks,
    invalidSitemapLastmods,
    futureContent,
    metaIssuePages,
    accessibilityGrouped,
    liveArtifacts,
    llmsTxt,
    localLlmsHash,
    localRobotsHash,
    publicClaimRegister,
  } = context;

  const blockers = [];
  const add = (item) => blockers.push(item);

  if (newRewardAttributionCheck?.status === "blocked") {
    add({
      severity: "Critical",
      area: "Attribution / New Reward",
      status: "blocked",
      issue: "Air Express GSC/GA4/GBP source cannot be pulled through New Reward",
      rootCause: newRewardAttributionCheck.rootCause
        || "Reachable New Reward control-plane records and saved credential metadata do not contain an Air Express client, tenant, website, GSC connection, GA4 connection, or stored snapshot source.",
      evidence: newRewardAttributionCheck.blocker,
      workaround: "Checks used the authenticated Air Express New Reward setup, settings, and SEO workspace pages; repo-local source; prior reachable credential metadata; and public live-edge artifact checks. No provider connection, deploy, DNS, CRM, OAuth, or public mutation was completed.",
      nextAction: newRewardAttributionCheck.nextAction
        || "Create or repair the Air Express New Reward source mapping, connect the correct GSC/GA4 properties and GBP location, then rerun this audit.",
    });
  }

  if (liveMeasurementCheck?.status === "fixed_locally_pending_live") {
    add({
      severity: "High",
      area: "Attribution / Website",
      status: "fixed_locally_pending_live",
      issue: "GA4 tag is restored in repo-local source but not detected on the live homepage",
      rootCause: "The current repo source contains the approved Air Express GA4 measurement ID, but production is served through the existing deployment/New Reward edge path and has not been synced or redeployed from this lane.",
      evidence: liveMeasurementEvidenceSummary(liveMeasurementCheck),
      workaround: "Ran the dedicated live measurement diagnostic with public HTTP fetches and local source inspection only. No raw HTML, cookies, tokens, provider credentials, form submissions, or customer data were stored.",
      nextAction: "Approve the Air Express deploy, New Reward edge sync, or manual delivery path; then rerun npm run verify:live-measurement and confirm exactly one approved GA4/GTM source.",
    });
  } else if (liveMeasurementCheck?.status === "blocked_duplicate_or_unverified_live_source") {
    add({
      severity: "Critical",
      area: "Attribution / Website",
      status: "blocked_duplicate_or_unverified_live_source",
      issue: "Live measurement source is duplicate or unverified",
      rootCause: "The live homepage exposes more than one measurement source or an unverified GTM container, so attribution would risk duplicate or wrong-source events.",
      evidence: liveMeasurementEvidenceSummary(liveMeasurementCheck),
      workaround: "Recorded public marker booleans and container ids only; no GTM publish, GA4 change, deploy, or provider mutation was attempted.",
      nextAction: "Verify the exact approved Air Express GTM/GA4 source before treating live measurement as valid.",
    });
  } else if (liveMeasurementCheck?.status === "live_single_source_verified_pending_event_proof") {
    add({
      severity: "Medium",
      area: "Attribution / Website",
      status: "live_single_source_verified_pending_event_proof",
      issue: "Live measurement source is present; lead event proof is still pending",
      rootCause: "The live homepage exposes one approved measurement source, but conversion-event proof still needs GA4 DebugView/Realtime or an approved non-duplicating test lead.",
      evidence: liveMeasurementEvidenceSummary(liveMeasurementCheck),
      workaround: "Verified marker state read-only without creating ServiceTitan leads.",
      nextAction: "Use GA4 DebugView/Realtime evidence or one approved test lead to prove generate_lead without duplicate ServiceTitan records.",
    });
  } else if (!liveMeasurementCheck && !onSiteTagEvidence.length && !liveOnSiteTagEvidence.length) {
    add({
      severity: "Critical",
      area: "Attribution / Website",
      status: "blocked",
      issue: "GA4 tag previously reported live is not detected in current source or live homepage checks",
      rootCause: "The New Reward PM task history says GA4 measurement ID G-JZ7PY32EVX was installed and verified on April 24, 2026. Current repo and live-domain checks do not detect that measurement ID, GTM, gtag(), googletagmanager, or google-analytics markers, so the tag either regressed out of the current delivery path or is being injected through a surface this static/live homepage crawl cannot observe.",
      evidence: "Current checks found no G-JZ7PY32EVX, G-, GTM-, gtag(), googletagmanager, or google-analytics marker in repo source, https://airexpressutah.com/, or https://airexpresshvac.net/.",
      workaround: "Validated repo source and both live homepages read-only. Did not add or restore tags because measurement/provider changes need an approved source of truth.",
      nextAction: "Restore or verify the approved GA4/GTM implementation, confirm whether G-JZ7PY32EVX remains the canonical Air Express measurement ID, and document conversion events before public reporting.",
    });
  } else if (!liveMeasurementCheck && onSiteTagEvidence.length && !liveOnSiteTagEvidence.length) {
    add({
      severity: "High",
      area: "Attribution / Website",
      status: "fixed_locally_pending_live",
      issue: "GA4 tag is restored in repo-local source but not detected on the live homepage",
      rootCause: "The current repo source now contains the approved Air Express GA4 measurement ID, but production is served through the existing deployment/New Reward edge path and has not been synced or redeployed from this lane.",
      evidence: `Local source evidence: ${onSiteTagEvidence.slice(0, 8).join(", ")}. Live homepage check did not detect G-JZ7PY32EVX, GA4, GTM, gtag(), googletagmanager, or google-analytics markers.`,
      workaround: "Restored the tag locally and verified live read-only. No production deploy, edge sync, provider mutation, or DNS change was attempted.",
      nextAction: "Approve the deployment or New Reward edge sync path, then recheck the live homepage and confirm no duplicate GA4/GTM source is firing.",
    });
  }

  if (publicClaimRegister?.status === "failed") {
    add({
      severity: "High",
      area: "Messaging / Public claims",
      status: "needs_fix",
      issue: "Unsupported public claim wording is present in local source",
      rootCause: "A registered fail-if-present claim appeared in public HTML without current proof.",
      evidence: publicClaimRegisterSummary(publicClaimRegister),
      workaround: "Captured a local-only claim register without editing public profiles, fetching provider dashboards, sending messages, or deploying.",
      nextAction: "Remove or weaken unsupported public claims, or attach current owner/provider proof and update the claim register.",
    });
  }

  const liveLlms = liveArtifacts?.llms;
  if (llmsTxt && liveLlms?.ok && liveLlms.hash !== localLlmsHash) {
    add({
      severity: "High",
      area: "GEO / AI artifacts",
      status: "blocked_by_source_split",
      issue: "Live /llms.txt does not match the repo-local llms.txt",
      rootCause: "Production /llms.txt is served by the New Reward edge managed path, so the local repo artifact is prepared but not the live source of truth.",
      evidence: `Live /llms.txt status ${liveLlms.status}; ${liveLlms.edgeSummary || "edge evidence unavailable"}.`,
      workaround: "Fetched live /llms.txt and compared content hashes without changing the edge artifact.",
      nextAction: "Sync the Air Express llms.txt through the New Reward edge source or route production to the repo artifact.",
    });
  }

  const liveRobots = liveArtifacts?.robots;
  if (liveRobots?.ok && liveRobots.hash !== localRobotsHash) {
    add({
      severity: "Medium",
      area: "GEO / Robots",
      status: "prepared_with_live_difference",
      issue: "Live robots.txt differs from repo-local robots.txt",
      rootCause: "Production robots.txt appears to be managed by the New Reward edge/workspace platform while the repo has a simpler local file.",
      evidence: `Live robots.txt status ${liveRobots.status}, edge=${liveRobots.newRewardsEdge ? "yes" : "no"}.`,
      workaround: "Fetched live robots.txt read-only and compared content hashes.",
      nextAction: "Decide whether the edge robots policy or repo robots file is canonical, then document/sync the chosen source.",
    });
  }

  const liveSitemap = liveArtifacts?.sitemap;
  if (liveSitemap?.ok && liveSitemap.invalidLastmodCount > 0) {
    add({
      severity: "High",
      area: "Technical SEO / Live sitemap",
      status: "fixed_locally_pending_deploy",
      issue: "Live sitemap still contains non-ISO blog lastmod values",
      rootCause: "Production is serving a previously generated sitemap; local generator fixes do not affect production until an approved deploy or edge sync.",
      evidence: `${liveSitemap.invalidLastmodCount} live lastmod values are invalid; sample: ${liveSitemap.invalidLastmodSamples.slice(0, 3).join(" | ")}.`,
      workaround: "Verified live sitemap read-only and left production unchanged.",
      nextAction: "After review, deploy/sync the regenerated sitemap through the approved launch path and recheck live sitemap.xml.",
    });
  }

  if (sitemapRedirectOnly.length) {
    add({
      severity: "High",
      area: "Technical SEO / Sitemap",
      status: "needs_fix",
      issue: "Sitemap includes redirect-only legacy URLs",
      rootCause: "Legacy root-level blog aliases remain in sitemap.xml while vercel.json redirects those URLs to canonical /blog/ pages.",
      evidence: `${sitemapRedirectOnly.length} redirect-only sitemap paths: ${sitemapRedirectOnly.slice(0, 5).join(", ")}.`,
      workaround: "Mapped sitemap paths against local files and Vercel redirect sources.",
      nextAction: "Remove redirect-only URLs from sitemap.xml or replace them with final /blog/ canonicals.",
    });
  }

  if (brokenInternalLinks.length) {
    add({
      severity: "High",
      area: "Accessibility / Navigation",
      status: "needs_fix",
      issue: "Broken internal /community links",
      rootCause: "Three older manually maintained pages include a Community nav link, but no /community route or community.html page exists in the repo.",
      evidence: brokenInternalLinks.map((item) => `${item.from} -> ${item.href}`).join("; "),
      workaround: "Validated link targets locally without adding a speculative destination.",
      nextAction: "Choose the intended destination, likely an existing about/service-area/community-proof page, and update the three hrefs.",
    });
  }

  if (invalidSitemapLastmods.length) {
    add({
      severity: "High",
      area: "Technical SEO / Build",
      status: "fixed_in_generator",
      issue: "Sitemap blog lastmod values were generated as JavaScript Date strings",
      rootCause: "gray-matter parses YAML dates into Date objects, and the blog builder interpolated post.date directly into sitemap.xml.",
      evidence: `${invalidSitemapLastmods.length} non-ISO lastmod values were present before the generator fix.`,
      workaround: "Updated the blog builder to normalize dates to YYYY-MM-DD for sitemap output.",
      nextAction: "Regenerate blog/sitemap and verify all lastmod values are ISO dates.",
    });
  }

  if (futureContent.length) {
    add({
      severity: "High",
      area: "Content / Publishing",
      status: "blocked_by_policy",
      issue: "Future-dated blog posts are publishable",
      rootCause: "Four future-dated posts are not marked draft, and the build script only excludes drafts when NODE_ENV=production; future dates alone are not a publish gate.",
      evidence: futureContent.map((item) => `${item.file} (${item.date})`).join("; "),
      workaround: "Flagged the posts and left publication decisions unchanged.",
      nextAction: "Confirm whether these are scheduled assets; if not intended live, mark them draft or change dates to actual publish dates.",
    });
  }

  if (metaIssuePages.length) {
    add({
      severity: "High",
      area: "SEO / Page metadata",
      status: "needs_fix",
      issue: "Page metadata, canonical, OG URL, or H1 issues remain",
      rootCause: "The site is a broad static HTML surface with mixed manual pages and generated blog pages, so metadata is not fully controlled by one template.",
      evidence: `${metaIssuePages.length} pages have title, description, canonical, OG URL, or H1 findings.`,
      workaround: "Mapped affected pages in the audit JSON and report.",
      nextAction: "Normalize shared templates and fix high-value service/service-area pages first.",
    });
  }

  const highA11y = accessibilityGrouped.filter((item) => item.severity === "High");
  if (highA11y.length) {
    add({
      severity: "High",
      area: "Accessibility",
      status: "needs_fix",
      issue: "Automated accessibility blockers found",
      rootCause: "Repeated static page chrome/content lacks consistent landmarks, skip links, label checks, or heading discipline across the generated and manual page set.",
      evidence: highA11y.map((item) => `${item.type}: ${item.count}`).join("; "),
      workaround: "Added repeatable local scanner coverage to the SEO/GEO audit instead of relying on manual spot checks.",
      nextAction: "Fix shared chrome/template issues first, then handle page-specific form labels and heading-order exceptions.",
    });
  }

  return blockers;
}

function renderReport(audit) {
  const topIssues = audit.findings.critical.concat(audit.findings.high).slice(0, 12);
  const issueRows = topIssues.map((i) => row([
    `<strong>${htmlEscape(i.priority)}</strong>`,
    htmlEscape(i.issue),
    htmlEscape(i.evidence),
    htmlEscape(i.fix),
  ])).join("");

  const blockerRows = audit.blockerRootCauses.map((item) => row([
    `<strong>${htmlEscape(item.severity)}</strong>`,
    htmlEscape(item.area),
    htmlEscape(item.status),
    htmlEscape(item.issue),
    htmlEscape(item.rootCause),
    htmlEscape(item.workaround),
    htmlEscape(item.nextAction),
  ])).join("");

  const accessibilityRows = audit.accessibility.grouped.map((item) => row([
    `<strong>${htmlEscape(item.severity)}</strong>`,
    htmlEscape(item.type),
    String(item.count),
    htmlEscape(item.pages.join(", ") || "(sitewide/manual)"),
    htmlEscape(item.evidence),
    htmlEscape(item.fix),
  ])).join("");

  const liveArtifactRows = Object.values(audit.liveArtifacts).map((artifact) => row([
    htmlEscape(artifact.name),
    artifact.ok ? "live" : "blocked",
    htmlEscape(String(artifact.status || 0)),
    htmlEscape(artifact.contentType || ""),
    htmlEscape(artifact.matchesLocal === null ? "not_applicable" : artifact.matchesLocal ? "matches_repo" : "differs_from_repo"),
    htmlEscape(artifact.invalidLastmodCount ? `${artifact.invalidLastmodCount} invalid lastmods` : "-"),
    htmlEscape(artifact.edgeSummary || artifact.error || ""),
  ])).join("");

  const sitemapRows = audit.fileCompleteness.samples.map((i) => row([
    htmlEscape(i.type),
    htmlEscape(i.path),
    htmlEscape(i.note),
  ])).join("");

  const metadataRows = audit.pages
    .filter((p) => p.issues.length)
    .slice(0, 40)
    .map((p) => row([
      `<code>${htmlEscape(p.relPath)}</code>`,
      htmlEscape(p.issues.join(", ")),
      htmlEscape(p.title || "(missing)"),
    ])).join("");

  const timeline = audit.attribution.timeline.slice(-90);
  const chartPoints = timeline.map((d) => ({
    date: d.date,
    clicks: d.clicks,
    impressions: d.impressions,
    sessions: d.sessions,
    conversions: d.conversions,
  }));
  const tagNarrative = audit.attribution.onSiteTag.narrative;
  const liveMeasurementRow = audit.attribution.liveMeasurement
    ? row([
        "Live measurement diagnostic",
        htmlEscape(audit.attribution.liveMeasurement.status),
        htmlEscape(audit.attribution.liveMeasurement.evidence),
        "Rerun npm run verify:live-measurement after any approved deploy or New Reward edge sync.",
      ])
    : "";
  const deliverySyncRow = audit.attribution.deliverySync
    ? row([
        "Owned-site delivery sync",
        htmlEscape(audit.attribution.deliverySync.status),
        htmlEscape(audit.attribution.deliverySync.evidence),
        "Rerun npm run verify:owned-site-delivery-sync after approved deploy, edge sync, or manual artifact sync.",
      ])
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Air Express SEO/GEO Attribution Audit</title>
  <style>
    :root {
      --ink: #15202b;
      --muted: #5f6d7a;
      --line: #dce4ec;
      --panel: #f6f9fb;
      --good: #27764a;
      --warn: #a45d00;
      --bad: #b52f2f;
      --blue: #0b68a6;
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
    .meta, .grid { display: grid; gap: 12px; }
    .meta { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); margin-top: 18px; }
    .grid { grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
    .card { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: var(--white); min-height: 120px; }
    .metric { font-size: 34px; font-weight: 750; margin: 2px 0 4px; }
    .good { color: var(--good); }
    .warn { color: var(--warn); }
    .bad { color: var(--bad); }
    .pill { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 5px 9px; font-size: 12px; font-weight: 700; background: var(--white); }
    .blocked { background: #fff1f1; border-left: 4px solid var(--bad); padding: 12px 14px; color: var(--ink); max-width: 980px; }
    table { width: 100%; border-collapse: collapse; border: 1px solid var(--line); background: var(--white); }
    th, td { border-bottom: 1px solid var(--line); padding: 10px; text-align: left; vertical-align: top; font-size: 14px; }
    th { background: var(--panel); font-size: 13px; }
    .scroll { overflow-x: auto; }
    canvas { width: 100%; height: 280px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
    a { color: var(--blue); }
  </style>
</head>
<body>
  <header>
    <h1>Air Express SEO/GEO Attribution Audit</h1>
    <p>Technical SEO, AI/GEO readiness, implementation completeness, messaging consistency, and attribution traceability for <code>airexpressutah.com</code>.</p>
    <div class="meta">
      <span class="pill">Generated ${htmlEscape(audit.generatedAt)}</span>
      <span class="pill">${audit.pages.length} public HTML files audited</span>
      <span class="pill">${audit.liveStatus.okCount}/${audit.liveStatus.total} sitemap URLs live</span>
      <span class="pill">A11y: ${audit.accessibility.totalFindings} findings</span>
      <span class="pill">GSC: ${htmlEscape(audit.attribution.gsc.status)}</span>
      <span class="pill">GA4: ${htmlEscape(audit.attribution.ga4.status)}</span>
      <span class="pill">GBP: ${htmlEscape(audit.attribution.gbp.status)}</span>
    </div>
  </header>
  <main>
    <section class="grid">
      <article class="card"><h3>Technical SEO</h3><div class="metric ${audit.scores.technical >= 85 ? "good" : audit.scores.technical >= 70 ? "warn" : "bad"}">${audit.scores.technical}</div><p>Metadata, canonicals, sitemap, links, live statuses, and crawl basics.</p></article>
      <article class="card"><h3>GEO Readiness</h3><div class="metric ${audit.scores.geo >= 85 ? "good" : audit.scores.geo >= 70 ? "warn" : "bad"}">${audit.scores.geo}</div><p>AI crawler access, llms.txt, schema, extractability, and authority signals.</p></article>
      <article class="card"><h3>Messaging Consistency</h3><div class="metric ${audit.scores.messaging >= 85 ? "good" : audit.scores.messaging >= 70 ? "warn" : "bad"}">${audit.scores.messaging}</div><p>Brand, domain, phone, local-service message, and legacy references.</p></article>
      <article class="card"><h3>Attribution Readiness</h3><div class="metric ${audit.scores.attribution >= 85 ? "good" : audit.scores.attribution >= 70 ? "warn" : "bad"}">${audit.scores.attribution}</div><p>GSC, GA4, on-site tags, conversion events, and source-to-lead traceability.</p></article>
      <article class="card"><h3>Accessibility</h3><div class="metric ${audit.scores.accessibility >= 85 ? "good" : audit.scores.accessibility >= 70 ? "warn" : "bad"}">${audit.scores.accessibility}</div><p>Automated checks for page language, landmarks, labels, headings, links, buttons, and image alternatives.</p></article>
    </section>

    ${audit.attribution.status === "blocked" ? `<h2>Attribution Pull Blocked</h2><div class="blocked"><strong>GSC/GA4/GBP data was not pulled.</strong> ${htmlEscape(audit.attribution.blocker)} Resolve the listed source/access gap, then rerun <code>npm run audit:seo-geo-attribution</code> to populate this report with time-series data.</div>` : ""}

    <h2>Top Fixes</h2>
    <div class="scroll">
      <table>
        <thead><tr><th>Priority</th><th>Issue</th><th>Evidence</th><th>Fix</th></tr></thead>
        <tbody>${issueRows || row(["-", "No critical/high issues found", "-", "-"])}</tbody>
      </table>
    </div>

    <h2>True Blocker Root Causes</h2>
    <p>Statuses distinguish verified, prepared, fixed in source, blocked by access, blocked by policy, and not attempted. Provider mutations, production deploys, DNS changes, and public sends were not attempted.</p>
    <div class="scroll">
      <table>
        <thead><tr><th>Severity</th><th>Area</th><th>Status</th><th>Issue</th><th>Root cause</th><th>Workaround used</th><th>Next action</th></tr></thead>
        <tbody>${blockerRows || row(["-", "-", "verified", "No root-cause blockers found", "-", "-", "-"])}</tbody>
      </table>
    </div>

    <h2>Attribution Traceability</h2>
    <canvas id="timeline" width="1100" height="280" aria-label="GSC, GA4, and GBP timeline"></canvas>
    <p>Traceability should connect Search Console impressions/clicks, GA4 landing-page sessions and conversion events, and Google Business Profile location activity to ServiceTitan lead IDs/campaign notes. ${htmlEscape(tagNarrative)} New Reward attribution remains blocked until the New Reward app session under james@jamesbrady.org can connect or verify the Air Express Google provider records using newrewardplatform@gmail.com.</p>
    <div class="scroll">
      <table>
        <thead><tr><th>Layer</th><th>Status</th><th>Evidence</th><th>Next action</th></tr></thead>
        <tbody>
          ${audit.attribution.newRewardSystem ? row(["New Reward control plane", htmlEscape(audit.attribution.newRewardSystem.status), htmlEscape(audit.attribution.newRewardSystem.summary || audit.attribution.newRewardSystem.blocker || "Checked."), htmlEscape(audit.attribution.newRewardSystem.nextAction || "Create/repair the Air Express client, tenant, website, GSC, and GA4 source mapping in New Reward.")]) : ""}
          ${row(["Search Console", htmlEscape(audit.attribution.gsc.status), htmlEscape(audit.attribution.gsc.blocker || `${audit.attribution.gsc.rows.length} rows pulled`), "Sign into New Reward as james@jamesbrady.org, select newrewardplatform@gmail.com in the Google provider flow, then connect/select the Air Express Search Console property."])}
          ${row(["GA4", htmlEscape(audit.attribution.ga4.status), htmlEscape(audit.attribution.ga4.blocker || `${audit.attribution.ga4.rows.length} rows pulled`), "Sign into New Reward as james@jamesbrady.org, select newrewardplatform@gmail.com in the Google provider flow, verify measurement ID G-JZ7PY32EVX, then connect/select the property."])}
          ${row(["Google Business Profile", htmlEscape(audit.attribution.gbp.status), htmlEscape(audit.attribution.gbp.blocker || `${audit.attribution.gbp.rows.length} rows pulled`), "Sign into New Reward as james@jamesbrady.org, select newrewardplatform@gmail.com in the Google provider flow, then confirm the Air Express Business Profile location before pulling performance history."])}
          ${liveMeasurementRow}
          ${deliverySyncRow}
          ${row(["On-site tag", htmlEscape(audit.attribution.onSiteTag.status), htmlEscape(audit.attribution.onSiteTag.evidence), "Deploy/sync the approved GA4 source and verify the live homepage without duplicating events."])}
          ${row(["Lead conversion event", htmlEscape(audit.attribution.conversionTracking.status), htmlEscape(audit.attribution.conversionTracking.evidence), "After deploy/sync, submit only an approved test lead or use GA4 DebugView/Realtime evidence to verify generate_lead without duplicating ServiceTitan records."])}
          ${row(["CRM lead", "partial_prior_proof", "ServiceTitan guide has April 24 lead IDs; current dashboard access unknown. Local intake source now passes Trace ID and UTM fields into ServiceTitan notes.", "After deploy/sync, verify Trace ID and UTM fields in an approved test lead or redacted export, then join safe lead fields to the impact periods."])}
        </tbody>
      </table>
    </div>

    <h2>Accessibility Blocker Report</h2>
    <div class="scroll">
      <table>
        <thead><tr><th>Severity</th><th>Finding</th><th>Count</th><th>Sample pages</th><th>Evidence</th><th>Fix</th></tr></thead>
        <tbody>${accessibilityRows || row(["verified", "No automated accessibility findings", "0", "-", "-", "-"])}</tbody>
      </table>
    </div>

    <h2>File Completeness</h2>
    <div class="grid">
      <article class="card"><h3>Sitemap URLs</h3><div class="metric">${audit.fileCompleteness.sitemapUrlCount}</div><p>${audit.fileCompleteness.sitemapMissingLocal.length} sitemap URLs missing local files.</p></article>
      <article class="card"><h3>Public HTML Files</h3><div class="metric">${audit.fileCompleteness.publicHtmlCount}</div><p>${audit.fileCompleteness.localNotInSitemap.length} local public HTML files are not in the sitemap.</p></article>
      <article class="card"><h3>Broken Internal Links</h3><div class="metric ${audit.fileCompleteness.brokenInternalLinks.length ? "bad" : "good"}">${audit.fileCompleteness.brokenInternalLinks.length}</div><p>Checked local internal HTML and asset href targets.</p></article>
    </div>
    <div class="scroll">
      <table>
        <thead><tr><th>Type</th><th>Path</th><th>Note</th></tr></thead>
        <tbody>${sitemapRows || row(["verified", "Sitemap/local file map", "No sample gaps found"])}</tbody>
      </table>
    </div>

    <h2>Live Artifact Source Map</h2>
    <p>This compares repo-local artifacts with live production artifacts that may be served by the New Reward edge.</p>
    <div class="scroll">
      <table>
        <thead><tr><th>Artifact</th><th>Status</th><th>HTTP</th><th>Content type</th><th>Repo match</th><th>Live parse</th><th>Edge evidence</th></tr></thead>
        <tbody>${liveArtifactRows || row(["-", "not_checked", "-", "-", "-", "-", "-"])}</tbody>
      </table>
    </div>

    <h2>Metadata And Schema Issues</h2>
    <div class="scroll">
      <table>
        <thead><tr><th>Page</th><th>Issues</th><th>Title</th></tr></thead>
        <tbody>${metadataRows || row(["-", "No page-level metadata issues found", "-"])}</tbody>
      </table>
    </div>

    <h2>GEO Notes</h2>
    <div class="grid">
      <article class="card"><h3>Robots</h3><p>${htmlEscape(audit.geo.robotsSummary)}</p></article>
      <article class="card"><h3>llms.txt</h3><p>${audit.geo.llmsTxt.exists ? "Present." : "Missing. Add a concise llms.txt for AI crawler guidance and key service pages."}</p></article>
      <article class="card"><h3>Schema</h3><p>${htmlEscape(audit.schema.summary)}</p></article>
      <article class="card"><h3>Content Extractability</h3><p>${htmlEscape(audit.geo.extractabilitySummary)}</p></article>
    </div>

    <h2>Source Files</h2>
    <p>Raw audit JSON: <a href="../data/seo-geo-attribution-audit.json">data/seo-geo-attribution-audit.json</a>. Local ledgers: <a href="../data/channel-access-status.csv">channel access</a>, <a href="../data/distribution-ledger.csv">distribution</a>, <a href="../data/benchmark-queries.csv">benchmark queries</a>, and <a href="../data/public-claim-register.json">public claim register</a>.</p>
  </main>
  <script>
    const points = ${JSON.stringify(chartPoints)};
    const canvas = document.getElementById("timeline");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#5f6d7a";
    ctx.font = "16px system-ui, sans-serif";
    if (!points.length) {
      ctx.fillText("No GSC/GA4/GBP time-series data available yet. Connect the Air Express New Reward Google provider records and rerun.", 32, 140);
    } else {
      const pad = 38;
      const max = Math.max(...points.map(p => Math.max(p.clicks, p.sessions, 1)));
      const x = i => pad + (i / Math.max(points.length - 1, 1)) * (canvas.width - pad * 2);
      const y = v => canvas.height - pad - (v / max) * (canvas.height - pad * 2);
      function line(key, color) {
        ctx.beginPath();
        points.forEach((p, i) => {
          const px = x(i), py = y(p[key] || 0);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      line("clicks", "#0b68a6");
      line("sessions", "#27764a");
      ctx.fillStyle = "#0b68a6"; ctx.fillText("GSC clicks", pad, 24);
      ctx.fillStyle = "#27764a"; ctx.fillText("GA4 sessions", pad + 110, 24);
    }
  </script>
</body>
</html>`;
}

async function main() {
  mkdirSync(join(root, "data"), { recursive: true });
  mkdirSync(join(root, "pages"), { recursive: true });

  const allFiles = walk(root).map((file) => relative(root, file).replaceAll("\\", "/"));
  const publicHtml = allFiles.filter(isPublicHtml).sort();
  const pages = publicHtml.map(parsePage);
  const accessibilityFindings = pages.flatMap((page) => page.accessibilityIssues.map((issue) => ({
    ...issue,
    page: page.relPath,
  })));
  const accessibilityGrouped = groupByType(accessibilityFindings);
  const sitemapXml = read("sitemap.xml");
  const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const sitemapLastmods = [...sitemapXml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1].trim());
  const invalidSitemapLastmods = sitemapLastmods.filter((value) => !/^\d{4}-\d{2}-\d{2}(T[\d:.+-]+Z?)?$/.test(value));
  const sitemapPaths = sitemapUrls.map(localPathFromUrl);
  const sitemapSet = new Set(sitemapPaths);
  const localSet = new Set(publicHtml);
  const redirectSources = vercelRedirectSources();
  const sitemapMissingLocal = sitemapPaths.filter((path) => !localSet.has(path) && !redirectSources.has(path));
  const sitemapRedirectOnly = sitemapPaths.filter((path) => !localSet.has(path) && redirectSources.has(path));
  const localNotInSitemap = publicHtml.filter((path) => !sitemapSet.has(path));
  const brokenInternalLinks = [];
  for (const page of pages) {
    for (const href of page.links) {
      if (!linkTargetExists(href, page.relPath)) {
        brokenInternalLinks.push({ from: page.relPath, href });
      }
    }
  }

  const robots = read("robots.txt");
  const llmsTxt = existsSync(join(root, "llms.txt"));
  const localLlmsText = llmsTxt ? read("llms.txt") : "";
  const liveResults = await mapLimit(sitemapUrls, 8, fetchStatus);
  const liveArtifactResults = await mapLimit([
    { name: "robots.txt", url: `${baseUrl}/robots.txt`, localText: robots },
    { name: "llms.txt", url: `${baseUrl}/llms.txt`, localText: localLlmsText },
    { name: "sitemap.xml", url: `${baseUrl}/sitemap.xml`, localText: sitemapXml },
  ], 2, async (artifact) => ({ ...artifact, result: await fetchTextArtifact(artifact.url) }));
  const liveArtifacts = Object.fromEntries(liveArtifactResults.map(({ name, localText, result }) => {
    const localHash = localText ? sha256(localText) : "";
    const matchesLocal = localHash && result.hash ? localHash === result.hash : null;
    const key = name === "robots.txt" ? "robots" : name === "llms.txt" ? "llms" : "sitemap";
    const liveLastmods = [...(result.text || "").matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1].trim());
    const liveInvalidLastmods = liveLastmods.filter((value) => !/^\d{4}-\d{2}-\d{2}(T[\d:.+-]+Z?)?$/.test(value));
    return [key, {
      name,
      url: result.url,
      ok: result.ok,
      status: result.status,
      finalUrl: result.finalUrl,
      contentType: result.contentType,
      hash: result.hash,
      localHash,
      byteLength: result.byteLength,
      matchesLocal,
      invalidLastmodCount: name === "sitemap.xml" ? liveInvalidLastmods.length : 0,
      invalidLastmodSamples: name === "sitemap.xml" ? liveInvalidLastmods.slice(0, 8) : [],
      edgeSummary: result.newRewardsEdge
        ? `edge=${result.newRewardsEdge}; servedBy=${result.servedBy || "unknown"}; managedPath=${result.managedPath || "none"}; websiteId=${result.websiteId || "unknown"}`
        : result.servedBy
        ? `servedBy=${result.servedBy}`
        : "",
      error: result.error || "",
    }];
  }));
  const legacyReferences = pages.filter((p) => p.issues.includes("legacy_web_domain_reference")).map((p) => p.relPath);
  const emailDomainReferences = pages
    .filter((p) => p.emailDomainReferences.length)
    .map((p) => ({ relPath: p.relPath, emails: p.emailDomainReferences }));
  const titleDuplicates = new Map();
  const descDuplicates = new Map();
  for (const page of pages) {
    if (page.title) titleDuplicates.set(page.title, [...(titleDuplicates.get(page.title) || []), page.relPath]);
    if (page.description) descDuplicates.set(page.description, [...(descDuplicates.get(page.description) || []), page.relPath]);
  }
  const duplicateTitles = [...titleDuplicates.entries()].filter(([, paths]) => paths.length > 1);
  const duplicateDescriptions = [...descDuplicates.entries()].filter(([, paths]) => paths.length > 1);
  const schemaPages = pages.filter((p) => p.schemaTypes.length);
  const schemaTypes = [...new Set(pages.flatMap((p) => p.schemaTypes))].sort();
  const futureContent = allFiles
    .filter((file) => file.startsWith("content/blog/") && file.endsWith(".md"))
    .map(parseFrontmatterDate)
    .filter(Boolean)
    .filter((item) => !item.draft && item.date > reportDate);

  const publicHtmlSet = new Set(publicHtml);
  const tagScannable = new Set([
    ...publicHtml,
    ...allFiles.filter((file) => /\.(js|mjs)$/i.test(file)
      && !file.includes("/")
      && !file.startsWith("tests/")
      && !file.startsWith("scripts/")
      && !file.startsWith("node_modules/")
      && !file.startsWith("output/")),
  ]);
  const onSiteTagPattern = /\bGTM-[A-Z0-9]{4,}\b|\bG-[A-Z0-9]{6,}\b|googletagmanager\.com|google-analytics\.com/;
  const onSiteTagEvidence = [...tagScannable]
    .filter((file) => publicHtmlSet.has(file) || !file.includes("/"))
    .map((file) => ({ file, text: existsSync(join(root, file)) ? readFileSync(join(root, file), "utf8") : "" }))
    .filter(({ text }) => onSiteTagPattern.test(text))
    .map(({ file }) => file);
  const liveHomepageCheck = await fetchTextArtifact(baseUrl);
  const liveOnSiteTagEvidence = onSiteTagPattern.test(liveHomepageCheck.text) ? [baseUrl] : [];
  const measurementTagEvidence = [...onSiteTagEvidence, ...liveOnSiteTagEvidence];
  const intakeScript = existsSync(join(root, "intake-form.js")) ? read("intake-form.js") : "";
  const leadFormPages = ["contact.html", "request-estimate.html", "schedule-service.html"];
  const leadFormPageEvidence = leadFormPages.map((file) => {
    const html = existsSync(join(root, file)) ? read(file) : "";
    return {
      file,
      hasAnalyticsLoader: /<script\s+src=["']\/analytics\.js["']\s+defer><\/script>/i.test(html),
      hasIntakeScript: /<script\s+src=["']intake-form\.js["']\s+defer><\/script>/i.test(html),
      hasIntakeForm: /data-intake-form=/i.test(html),
    };
  });
  const conversionTrackingEvidence = {
    detected: /window\.gtag\("event",\s*"generate_lead"/.test(intakeScript)
      && /event_category:\s*"lead"/.test(intakeScript)
      && /sessionStorage/.test(intakeScript)
      && leadFormPageEvidence.every((page) => page.hasAnalyticsLoader && page.hasIntakeScript && page.hasIntakeForm),
    sourceEvidence: [
      /window\.gtag\("event",\s*"generate_lead"/.test(intakeScript) ? "intake-form.js:generate_lead" : "",
      ...leadFormPageEvidence
        .filter((page) => page.hasAnalyticsLoader && page.hasIntakeScript && page.hasIntakeForm)
        .map((page) => `${page.file}:analytics+intake`),
    ].filter(Boolean),
    pageEvidence: leadFormPageEvidence,
  };

  const newRewardAttributionCheck = readOptionalJson(newRewardAttributionCheckPath);
  const liveMeasurementCheck = readOptionalJson(liveMeasurementCheckPath);
  const ownedSiteDeliverySyncCheck = readOptionalJson(ownedSiteDeliverySyncCheckPath);
  const publicClaimRegister = readOptionalJson(publicClaimRegisterPath);
  const google = applyNewRewardAttributionCheck(await pullGoogleData(), newRewardAttributionCheck);
  const timeline = aggregateGoogleRows(google.gsc.rows, google.ga4.rows);

  const critical = [];
  const high = [];
  const medium = [];

  if (newRewardAttributionCheck?.status === "blocked") {
    critical.push({
      priority: "Critical",
      issue: "Air Express GSC/GA4/GBP attribution source not found in reachable New Reward systems",
      evidence: newRewardAttributionCheck.blocker,
      fix: "Use the New Reward app session under james@jamesbrady.org, repair the Air Express client/tenant/website credential mapping, connect the Google provider as newrewardplatform@gmail.com, then rerun this audit from that source.",
    });
  } else if (google.auth.ok === false) {
    critical.push({
      priority: "Critical",
      issue: "GSC/GA4/GBP pull blocked by expired Google CLI auth",
      evidence: google.auth.blocker,
      fix: "Run interactive Google re-auth for an account with Search Console, GA4, and GBP access, then rerun the audit.",
    });
  }
  if (liveMeasurementCheck?.status === "fixed_locally_pending_live") {
    high.push({
      priority: "High",
      issue: "GA4 tag restored locally but not verified live",
      evidence: liveMeasurementEvidenceSummary(liveMeasurementCheck),
      fix: "Deploy or sync the approved source path, then rerun npm run verify:live-measurement and verify GA4 Realtime/debug evidence.",
    });
  } else if (liveMeasurementCheck?.status === "blocked_duplicate_or_unverified_live_source") {
    critical.push({
      priority: "Critical",
      issue: "Live measurement source is duplicate or unverified",
      evidence: liveMeasurementEvidenceSummary(liveMeasurementCheck),
      fix: "Verify the exact approved Air Express GA4/GTM source before treating live measurement as valid.",
    });
  } else if (liveMeasurementCheck?.status === "blocked_local_source" || liveMeasurementCheck?.status === "blocked_live_fetch") {
    critical.push({
      priority: "Critical",
      issue: "Live measurement diagnostic is blocked",
      evidence: liveMeasurementEvidenceSummary(liveMeasurementCheck),
      fix: "Repair the blocked local or live measurement check before relying on attribution evidence.",
    });
  } else if (!liveMeasurementCheck && !measurementTagEvidence.length) {
    critical.push({
      priority: "Critical",
      issue: "Previously verified GA4 tag is absent from current source/live checks",
      evidence: "New Reward PM history reports G-JZ7PY32EVX was installed and verified on April 24, 2026, but current checks found no G-JZ7PY32EVX, G-, GTM-, gtag, googletagmanager, or google-analytics marker in public site files or live homepages.",
      fix: "Restore or verify the approved GA4/GTM implementation and document conversion events.",
    });
  } else if (!liveMeasurementCheck && onSiteTagEvidence.length && !liveOnSiteTagEvidence.length) {
    high.push({
      priority: "High",
      issue: "GA4 tag restored locally but not verified live",
      evidence: `Local source contains the approved GA4 marker in ${onSiteTagEvidence.slice(0, 8).join(", ")}, but the live homepage still does not expose GA4/GTM markers.`,
      fix: "Deploy or sync the approved source path, then recheck the live homepage and GA4 Realtime/debug evidence.",
    });
  }
  if (ownedSiteDeliverySyncCheck?.status === "pending_delivery_sync") {
    high.push({
      priority: "High",
      issue: "Owned-site delivery sync is pending for critical measurement artifacts",
      evidence: ownedSiteDeliverySyncEvidenceSummary(ownedSiteDeliverySyncCheck),
      fix: "Approve the Air Express deploy, New Reward edge sync, or manual artifact sync; then rerun npm run verify:owned-site-delivery-sync and npm run verify:live-measurement.",
    });
  }
  if (publicClaimRegister?.status === "failed") {
    high.push({
      priority: "High",
      issue: "Unsupported public claim wording found",
      evidence: publicClaimRegisterSummary(publicClaimRegister),
      fix: "Remove or weaken unsupported claims, or attach current owner/provider proof and update the public claim register.",
    });
  }
  if (sitemapMissingLocal.length) {
    critical.push({
      priority: "Critical",
      issue: "Sitemap claims URLs with no local file",
      evidence: `${sitemapMissingLocal.length} sitemap paths missing locally.`,
      fix: "Add missing pages or remove stale sitemap URLs.",
    });
  }
  if (sitemapRedirectOnly.length) {
    high.push({
      priority: "High",
      issue: "Sitemap includes redirect-only URLs",
      evidence: `${sitemapRedirectOnly.length} sitemap paths are implemented as Vercel redirects rather than canonical local files.`,
      fix: "Replace redirected sitemap URLs with their final canonical /blog/ URLs.",
    });
  }
  const liveFailures = liveResults
    .filter((r) => !r.ok)
    .map((failure) => {
      const localPath = localPathFromUrl(failure.url);
      const localFileExists = localSet.has(localPath);
      return {
        ...failure,
        localPath,
        localFileExists,
        pendingDeploy: localFileExists,
      };
    });
  const livePendingDeployFailures = liveFailures.filter((failure) => failure.pendingDeploy);
  const liveBrokenFailures = liveFailures.filter((failure) => !failure.pendingDeploy);
  if (liveBrokenFailures.length) {
    critical.push({
      priority: "Critical",
      issue: "Live sitemap URLs failed",
      evidence: `${liveBrokenFailures.length} of ${liveResults.length} sitemap URLs returned non-2xx or request errors and do not have a matching local public HTML file.`,
      fix: "Repair routes, redirects, or sitemap entries.",
    });
  }
  if (livePendingDeployFailures.length) {
    high.push({
      priority: "High",
      issue: "Prepared sitemap URLs are not live yet",
      evidence: `${livePendingDeployFailures.length} sitemap URLs have matching local public HTML files but currently return non-2xx on production.`,
      fix: "Deploy or sync the prepared Air Express source, then recheck the live sitemap URLs.",
    });
  }
  if (brokenInternalLinks.length) {
    high.push({
      priority: "High",
      issue: "Broken internal links found",
      evidence: `${brokenInternalLinks.length} local internal links point to missing targets.`,
      fix: "Update hrefs or add the missing target pages/assets.",
    });
  }
  if (invalidSitemapLastmods.length) {
    high.push({
      priority: "High",
      issue: "Sitemap contains non-ISO lastmod values",
      evidence: `${invalidSitemapLastmods.length} lastmod values are not ISO dates/datetimes.`,
      fix: "Update the blog build step to emit YYYY-MM-DD lastmod values and regenerate sitemap.xml.",
    });
  }
  if (liveArtifacts.sitemap?.invalidLastmodCount) {
    high.push({
      priority: "High",
      issue: "Live sitemap contains non-ISO lastmod values",
      evidence: `${liveArtifacts.sitemap.invalidLastmodCount} production sitemap lastmod values are still invalid.`,
      fix: "Deploy or sync the regenerated sitemap after review, then verify live sitemap.xml.",
    });
  }
  if (futureContent.length) {
    high.push({
      priority: "High",
      issue: "Published blog content is future-dated",
      evidence: `${futureContent.length} non-draft blog posts have dates after ${reportDate}.`,
      fix: "Mark future posts as draft until publication or update dates to the actual publish date.",
    });
  }
  const metaIssuePages = pages.filter((p) => p.issues.some((issue) => /title|description|canonical|og_url|h1/.test(issue)));
  if (metaIssuePages.length) {
    high.push({
      priority: "High",
      issue: "Page-level metadata/canonical/H1 issues",
      evidence: `${metaIssuePages.length} pages have title, description, canonical, OG URL, or H1 issues.`,
      fix: "Normalize metadata templates and review the listed pages.",
    });
  }
  if (!llmsTxt) {
    high.push({
      priority: "High",
      issue: "No llms.txt present",
      evidence: "/llms.txt is missing from the repo.",
      fix: "Add an llms.txt that lists canonical service, area, proof, and blog pages for AI crawlers.",
    });
  }
  if (llmsTxt && liveArtifacts.llms?.ok && liveArtifacts.llms.matchesLocal === false) {
    high.push({
      priority: "High",
      issue: "Live llms.txt differs from repo-local llms.txt",
      evidence: "Production /llms.txt is served from a New Reward edge managed path and does not match the repo artifact.",
      fix: "Sync the prepared repo llms.txt through the New Reward edge source or make the repo file the production source of truth.",
    });
  }
  if (liveArtifacts.robots?.ok && liveArtifacts.robots.matchesLocal === false) {
    medium.push({
      priority: "Medium",
      issue: "Live robots.txt differs from repo-local robots.txt",
      evidence: "Production robots.txt appears edge-managed and includes AI crawler policy that is not present in the repo file.",
      fix: "Document which source is canonical and sync the other layer.",
    });
  }
  if (accessibilityFindings.length) {
    const highA11yCount = accessibilityFindings.filter((item) => item.severity === "High").length;
    high.push({
      priority: "High",
      issue: "Automated accessibility blockers found",
      evidence: `${accessibilityFindings.length} accessibility findings across ${accessibilityGrouped.length} finding types; ${highA11yCount} are high severity.`,
      fix: "Fix shared landmark/skip-link/template issues first, then page-specific labels/headings/buttons/links.",
    });
  }
  if (duplicateTitles.length || duplicateDescriptions.length) {
    medium.push({
      priority: "Medium",
      issue: "Duplicate metadata detected",
      evidence: `${duplicateTitles.length} duplicate title groups and ${duplicateDescriptions.length} duplicate description groups.`,
      fix: "Make service-area and service-page titles/descriptions distinct.",
    });
  }
  if (legacyReferences.length) {
    medium.push({
      priority: "Medium",
      issue: "Legacy domain references in public HTML",
      evidence: legacyReferences.slice(0, 8).join(", "),
      fix: "Use canonical .com for public web references unless intentionally documenting legacy redirect.",
    });
  }

  const technicalScore = Math.round((scoreFromIssues(metaIssuePages.length + brokenInternalLinks.length + sitemapMissingLocal.length + liveBrokenFailures.length, pages.length + 10) + (liveBrokenFailures.length ? 70 : 100)) / 2);
  const geoScore = Math.round((schemaPages.length / Math.max(pages.length, 1)) * 25 + (llmsTxt ? 25 : 0) + (/User-agent:\s*\*/i.test(robots) ? 25 : 0) + 15);
  const messagingScore = Math.max(0, 100 - legacyReferences.length * 5 - duplicateTitles.length * 2);
  const tagScore = liveOnSiteTagEvidence.length ? 35 : onSiteTagEvidence.length ? 20 : 0;
  const liveMeasurementHasLiveSource =
    liveMeasurementCheck?.status === "live_single_source_verified_pending_event_proof";
  const liveMeasurementHasLocalSource =
    liveMeasurementCheck?.local?.index?.markers?.approvedGa4Present === true
    || liveMeasurementCheck?.local?.analyticsJs?.markers?.approvedGa4Present === true;
  const effectiveTagScore = liveMeasurementCheck
    ? liveMeasurementHasLiveSource
      ? 35
      : liveMeasurementHasLocalSource
      ? 20
      : 0
    : tagScore;
  const conversionTrackingScore = conversionTrackingEvidence.detected ? 5 : 0;
  const attributionScore = Math.max(0,
    effectiveTagScore
    + (google.gsc.status === "pulled" ? 25 : 0)
    + (google.ga4.status === "pulled" ? 25 : 0)
    + (google.gbp.status === "pulled" ? 10 : 0)
    + conversionTrackingScore,
  );
  const accessibilityScore = Math.max(0, 100
    - accessibilityFindings.filter((item) => item.severity === "High").length * 2
    - accessibilityFindings.filter((item) => item.severity === "Medium").length);
  const blockerRootCauses = buildRootCauseMap({
    newRewardAttributionCheck,
    liveMeasurementCheck,
    onSiteTagEvidence,
    liveOnSiteTagEvidence,
    sitemapRedirectOnly,
    brokenInternalLinks,
    invalidSitemapLastmods,
    futureContent,
    metaIssuePages,
    accessibilityGrouped,
    liveArtifacts,
    llmsTxt,
    localLlmsHash: liveArtifacts.llms?.localHash || "",
    localRobotsHash: liveArtifacts.robots?.localHash || "",
    publicClaimRegister,
  });

  const audit = {
    generatedAt: now.toISOString(),
    site: baseUrl,
    legacySite: legacyUrl,
    skillsUsed: ["client-seo-geo-evidence", "ai-seo", "a11y-auditor", "accessibility-pass", "analytics-tracking"],
    scores: {
      technical: technicalScore,
      geo: Math.min(100, Math.round(geoScore)),
      messaging: messagingScore,
      attribution: attributionScore,
      accessibility: accessibilityScore,
    },
    blockerRootCauses,
    fileCompleteness: {
      sitemapUrlCount: sitemapUrls.length,
      publicHtmlCount: publicHtml.length,
      sitemapMissingLocal,
      sitemapRedirectOnly,
      localNotInSitemap,
      brokenInternalLinks,
      invalidSitemapLastmods,
      futureContent,
      samples: [
        ...sitemapMissingLocal.slice(0, 12).map((path) => ({ type: "sitemap_missing_local", path, note: "Sitemap URL has no matching local HTML file." })),
        ...sitemapRedirectOnly.slice(0, 12).map((path) => ({ type: "sitemap_redirect_only", path, note: "Sitemap URL is served through a Vercel redirect; prefer final canonical URL in sitemap." })),
        ...localNotInSitemap.slice(0, 12).map((path) => ({ type: "local_not_in_sitemap", path, note: "Local public HTML file is not listed in sitemap." })),
        ...brokenInternalLinks.slice(0, 12).map((item) => ({ type: "broken_internal_link", path: item.from, note: item.href })),
        ...invalidSitemapLastmods.slice(0, 12).map((value) => ({ type: "invalid_sitemap_lastmod", path: "sitemap.xml", note: value })),
        ...futureContent.slice(0, 12).map((item) => ({ type: "future_dated_content", path: item.file, note: item.date })),
      ],
    },
    liveStatus: {
      total: liveResults.length,
      okCount: liveResults.filter((r) => r.ok).length,
      failures: liveFailures,
      pendingDeployFailures: livePendingDeployFailures,
      brokenFailures: liveBrokenFailures,
      newRewardsEdgeSeen: liveResults.some((r) => r.newRewardsEdge),
    },
    liveArtifacts,
    pages,
    metadata: {
      duplicateTitles: duplicateTitles.map(([title, paths]) => ({ title, paths })),
      duplicateDescriptions: duplicateDescriptions.map(([description, paths]) => ({ description, paths })),
    },
    schema: {
      pagesWithSchema: schemaPages.length,
      schemaTypes,
      summary: `${schemaPages.length}/${pages.length} public HTML files include JSON-LD. Types seen: ${schemaTypes.join(", ") || "none"}.`,
    },
    geo: {
      robotsSummary: robots.includes("Disallow: /admin/") && robots.includes("Disallow: /api/")
        ? "Important content is allowed via User-agent: *, while admin and API paths are blocked. No explicit AI crawler allow/block policy is present."
        : "Robots policy needs manual review.",
      llmsTxt: {
        exists: llmsTxt,
        liveMatchesLocal: liveArtifacts.llms?.matchesLocal ?? null,
        liveEdgeSummary: liveArtifacts.llms?.edgeSummary || "",
      },
      extractabilitySummary: "The site has broad service and service-area coverage. GEO improvements should focus on llms.txt, clearer answer blocks, stronger proof/authority signals, and measurement links.",
    },
    messaging: {
      legacyReferences,
      emailDomainReferences,
      canonicalDomain: baseUrl,
      phoneTarget: "(801) 766-8585",
      emailDomainNote: "office@airexpresshvac.net is documented in launch runbooks as the intended sender/contact mailbox pending email-auth verification; it is not treated as a legacy web URL issue.",
      publicClaimRegister: publicClaimRegister
        ? {
            status: publicClaimRegister.status,
            source: "data/public-claim-register.json",
            evidence: publicClaimRegisterSummary(publicClaimRegister),
            proofGatedClaimTypes: publicClaimRegister.summary?.proofGatedClaimTypes ?? null,
          }
        : null,
    },
    accessibility: {
      totalFindings: accessibilityFindings.length,
      grouped: accessibilityGrouped,
      findings: accessibilityFindings,
    },
    attribution: {
      status: google.gsc.status === "pulled" || google.ga4.status === "pulled" || google.gbp.status === "pulled" ? "partial_or_pulled" : "blocked",
      blocker: newRewardAttributionCheck?.status === "blocked"
        ? newRewardAttributionCheck.blocker
        : google.auth.ok === false
        ? `${google.auth.blocker} Active account: ${google.auth.account || "unknown"}.`
        : [google.gsc.blocker, google.ga4.blocker, google.gbp.blocker].filter(Boolean).join(" "),
      auth: newRewardAttributionCheck?.status === "blocked"
        ? {
            ok: false,
            source: "local_gcloud",
            ignored: true,
            reason: "Local Google CLI auth was not used because the requested source of truth is the New Reward Air Express control-plane mapping.",
          }
        : google.auth,
      newRewardSystem: newRewardAttributionCheck,
      gsc: google.gsc,
      ga4: google.ga4,
      gbp: google.gbp,
      liveMeasurement: liveMeasurementCheck
        ? {
            status: liveMeasurementCheck.status,
            evidence: liveMeasurementEvidenceSummary(liveMeasurementCheck),
            source: "data/live-measurement-path-check.json",
            approvedGa4Id: liveMeasurementCheck.approvedGa4Id || "",
            mutationBoundary: liveMeasurementCheck.mutationBoundary || "",
            secretHandling: liveMeasurementCheck.secretHandling || "",
          }
        : null,
      deliverySync: ownedSiteDeliverySyncCheck
        ? {
            status: ownedSiteDeliverySyncCheck.status,
            evidence: ownedSiteDeliverySyncEvidenceSummary(ownedSiteDeliverySyncCheck),
            source: "data/owned-site-delivery-sync-check.json",
            approvedGa4Id: ownedSiteDeliverySyncCheck.approvedGa4Id || "",
            mutationBoundary: ownedSiteDeliverySyncCheck.mutationBoundary || "",
            secretHandling: ownedSiteDeliverySyncCheck.secretHandling || "",
          }
        : null,
      onSiteTag: {
        detected: liveMeasurementCheck
          ? liveMeasurementHasLiveSource || liveMeasurementHasLocalSource
          : Boolean(measurementTagEvidence.length),
        status: liveMeasurementCheck
          ? liveMeasurementCheck.status
          : liveOnSiteTagEvidence.length
          ? "live_detected"
          : onSiteTagEvidence.length
          ? "fixed_locally_pending_live"
          : "not_detected",
        evidence: liveMeasurementCheck
          ? liveMeasurementEvidenceSummary(liveMeasurementCheck)
          : measurementTagEvidence.length
          ? liveOnSiteTagEvidence.length
            ? measurementTagEvidence.join(", ")
            : `${onSiteTagEvidence.join(", ")} (source only; live homepage still pending)`
          : "New Reward PM history reports GA4 measurement ID G-JZ7PY32EVX was installed and verified on April 24, 2026, but current repo and live homepage checks do not detect G-JZ7PY32EVX, GA4, GTM, gtag(), googletagmanager, or google-analytics markers.",
        narrative: liveMeasurementCheck
          ? liveMeasurementNarrative(liveMeasurementCheck)
          : liveOnSiteTagEvidence.length
          ? "The approved GA4 tag is detected on the live homepage."
          : onSiteTagEvidence.length
          ? "The approved GA4 measurement ID G-JZ7PY32EVX is restored in repo-local source, but the live homepage does not yet expose GA4/GTM markers."
          : "A prior New Reward PM task says GA4 measurement ID G-JZ7PY32EVX was installed and verified on April 24, 2026, but current source and live homepage checks do not detect it.",
        sourceEvidence: onSiteTagEvidence,
        liveHomepageEvidence: liveOnSiteTagEvidence,
        liveHomepage: {
          ok: liveHomepageCheck.ok,
          status: liveHomepageCheck.status,
          finalUrl: liveHomepageCheck.finalUrl,
          contentType: liveHomepageCheck.contentType,
          edgeSummary: liveHomepageCheck.newRewardsEdge
            ? `edge=${liveHomepageCheck.newRewardsEdge}; servedBy=${liveHomepageCheck.servedBy || "unknown"}; managedPath=${liveHomepageCheck.managedPath || "none"}; websiteId=${liveHomepageCheck.websiteId || "unknown"}`
            : liveHomepageCheck.error || "",
        },
      },
      conversionTracking: {
        detected: conversionTrackingEvidence.detected,
        status: (liveMeasurementCheck ? liveMeasurementHasLiveSource : liveOnSiteTagEvidence.length) && conversionTrackingEvidence.detected
          ? "live_ready"
          : conversionTrackingEvidence.detected
          ? "prepared_source_pending_live"
          : "not_detected",
        evidence: conversionTrackingEvidence.detected
          ? `${conversionTrackingEvidence.sourceEvidence.join(", ")}; emits GA4 generate_lead only when window.gtag is available and guards repeat firing with sessionStorage.`
          : "No guarded GA4 generate_lead event was detected for successful intake returns.",
        sourceEvidence: conversionTrackingEvidence.sourceEvidence,
        pageEvidence: conversionTrackingEvidence.pageEvidence,
      },
      timeline,
      officialApiDocs: [
        "https://developers.google.com/webmaster-tools/v1/searchanalytics/query",
        "https://developers.google.com/analytics/devguides/reporting/data/v1/basics",
      ],
    },
    findings: { critical, high, medium },
  };

  writeFileSync(outJson, `${JSON.stringify(audit, null, 2)}\n`);
  writeFileSync(outHtml, renderReport(audit));
  console.log(`Wrote ${relative(root, outJson)}`);
  console.log(`Wrote ${relative(root, outHtml)}`);
  console.log(`Scores: technical=${audit.scores.technical}, geo=${audit.scores.geo}, messaging=${audit.scores.messaging}, attribution=${audit.scores.attribution}`);
  if (critical.length || high.length) {
    console.log(`Open issues: critical=${critical.length}, high=${high.length}, medium=${medium.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
