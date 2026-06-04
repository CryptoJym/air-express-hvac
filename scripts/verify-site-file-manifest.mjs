#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const baseUrl = "https://airexpressutah.com";
const outPath = path.join(rootDir, "data", "site-file-manifest.json");

const REQUIRED_ARTIFACTS = [
  "index.html",
  "analytics.js",
  "intake-form.js",
  "styles.css",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "vercel.json",
];

const STATIC_EXTENSIONS = new Set([
  ".css",
  ".gif",
  ".html",
  ".ico",
  ".jpeg",
  ".jpg",
  ".js",
  ".json",
  ".png",
  ".svg",
  ".txt",
  ".webp",
  ".xml",
]);

const EXCLUDED_DIRS = new Set([
  ".git",
  "admin",
  "data",
  "node_modules",
  "output",
  "pages",
  "templates",
]);

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function sha256(source = "") {
  return createHash("sha256").update(source).digest("hex");
}

function walkFiles(directory = rootDir, files = []) {
  for (const dirent of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, dirent.name);
    const relative = path.relative(rootDir, absolute).replaceAll(path.sep, "/");
    if (dirent.isDirectory()) {
      if (EXCLUDED_DIRS.has(relative.split("/")[0]) || dirent.name.startsWith(".")) {
        continue;
      }
      walkFiles(absolute, files);
      continue;
    }
    files.push(relative);
  }
  return files;
}

function isPublicHtml(relativePath) {
  if (!relativePath.endsWith(".html")) return false;
  if (relativePath === "404.html") return false;
  if (relativePath.split("/").some((part) => part.startsWith("."))) return false;
  return ![...EXCLUDED_DIRS].some((dir) => relativePath === dir || relativePath.startsWith(`${dir}/`));
}

function localPathFromUrl(url) {
  const parsed = new URL(url);
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname === "/") pathname = "/index.html";
  if (pathname.endsWith("/")) pathname += "index.html";
  return pathname.slice(1);
}

function parseSitemap() {
  const xml = readFile("sitemap.xml");
  const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => {
    const block = match[1];
    return {
      loc: /<loc>([^<]+)<\/loc>/.exec(block)?.[1]?.trim() || "",
      lastmod: /<lastmod>([^<]+)<\/lastmod>/.exec(block)?.[1]?.trim() || "",
    };
  }).filter((entry) => entry.loc);
  return urls.map((entry) => ({
    ...entry,
    localPath: localPathFromUrl(entry.loc),
    sameOrigin: entry.loc.startsWith(`${baseUrl}/`) || entry.loc === baseUrl,
    validLastmod: /^\d{4}-\d{2}-\d{2}(?:T[\d:.+-]+Z?)?$/.test(entry.lastmod),
  }));
}

function parseFrontMatter(source) {
  const match = /^---\n([\s\S]*?)\n---/.exec(source);
  const result = {};
  if (!match) return result;
  for (const rawLine of match[1].split(/\r?\n/)) {
    const separator = rawLine.indexOf(":");
    if (separator === -1) continue;
    const key = rawLine.slice(0, separator).trim();
    let value = rawLine.slice(separator + 1).trim();
    value = value.replace(/^["']|["']$/g, "");
    result[key] = value;
  }
  return result;
}

function blogSourceManifest() {
  const blogSourceDir = path.join(rootDir, "content", "blog");
  const sourceFiles = fs.readdirSync(blogSourceDir)
    .filter((file) => file.endsWith(".md"))
    .sort();

  return sourceFiles.map((file) => {
    const relativePath = `content/blog/${file}`;
    const source = readFile(relativePath);
    const frontMatter = parseFrontMatter(source);
    const slug = frontMatter.slug || file.replace(/\.md$/, "");
    const generatedPath = `blog/${slug}.html`;
    const generatedExists = fs.existsSync(path.join(rootDir, generatedPath));
    const isDraft = String(frontMatter.draft).toLowerCase() === "true";
    return {
      sourcePath: relativePath,
      slug,
      draft: isDraft,
      generatedPath,
      generatedExists,
      status: isDraft
        ? generatedExists ? "draft_leaked" : "draft_excluded"
        : generatedExists ? "generated" : "missing_generated_html",
    };
  });
}

function normalizeLocalReference(rawHref) {
  if (!rawHref || rawHref.startsWith("#")) return null;
  if (/^(mailto|tel|sms|geo|javascript):/i.test(rawHref)) return null;

  let parsed;
  if (/^https?:\/\//i.test(rawHref)) {
    parsed = new URL(rawHref);
    if (parsed.origin !== baseUrl) return null;
  } else {
    parsed = new URL(rawHref, baseUrl);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) return null;
  if (parsed.pathname.startsWith("/api/")) return null;

  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname === "/") pathname = "/index.html";
  if (pathname.endsWith("/")) pathname += "index.html";

  const extension = path.posix.extname(pathname);
  if (!STATIC_EXTENSIONS.has(extension)) return null;
  return pathname.slice(1);
}

function localReferenceManifest(publicHtmlFiles) {
  const missing = [];
  const checked = [];
  for (const htmlPath of publicHtmlFiles) {
    const html = readFile(htmlPath);
    for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
      const target = normalizeLocalReference(match[1]);
      if (!target) continue;
      checked.push({ from: htmlPath, target });
      if (!fs.existsSync(path.join(rootDir, target))) {
        missing.push({ from: htmlPath, target });
      }
    }
  }
  return { checkedCount: checked.length, missing };
}

function main() {
  const files = walkFiles().sort();
  const publicHtmlFiles = files.filter(isPublicHtml);
  const publicSet = new Set(publicHtmlFiles);
  const sitemapEntries = parseSitemap();
  const sitemapPaths = sitemapEntries.map((entry) => entry.localPath);
  const sitemapSet = new Set(sitemapPaths);
  const duplicatedSitemapPaths = [...new Set(sitemapPaths.filter((entry, index) => sitemapPaths.indexOf(entry) !== index))];
  const sitemapMissingLocal = sitemapPaths.filter((entry) => !publicSet.has(entry));
  const localHtmlNotInSitemap = publicHtmlFiles.filter((entry) => !sitemapSet.has(entry));
  const invalidLastmods = sitemapEntries.filter((entry) => !entry.validLastmod);
  const requiredArtifacts = REQUIRED_ARTIFACTS.map((artifactPath) => ({
    path: artifactPath,
    exists: fs.existsSync(path.join(rootDir, artifactPath)),
    sha256: fs.existsSync(path.join(rootDir, artifactPath))
      ? sha256(fs.readFileSync(path.join(rootDir, artifactPath)))
      : "",
  }));
  const blogSources = blogSourceManifest();
  const draftLeaks = blogSources.filter((entry) => entry.status === "draft_leaked");
  const missingGeneratedPosts = blogSources.filter((entry) => entry.status === "missing_generated_html");
  const localReferences = localReferenceManifest(publicHtmlFiles);

  const failures = [
    ...requiredArtifacts.filter((entry) => !entry.exists).map((entry) => `missing required artifact ${entry.path}`),
    ...sitemapMissingLocal.map((entry) => `sitemap URL missing local file ${entry}`),
    ...localHtmlNotInSitemap.map((entry) => `public HTML missing from sitemap ${entry}`),
    ...duplicatedSitemapPaths.map((entry) => `duplicate sitemap URL ${entry}`),
    ...invalidLastmods.map((entry) => `invalid sitemap lastmod ${entry.localPath}: ${entry.lastmod}`),
    ...draftLeaks.map((entry) => `draft post generated ${entry.generatedPath}`),
    ...missingGeneratedPosts.map((entry) => `publishable post missing generated HTML ${entry.generatedPath}`),
    ...localReferences.missing.map((entry) => `missing local reference ${entry.from} -> ${entry.target}`),
  ];

  const manifest = {
    generatedAt: new Date().toISOString(),
    status: failures.length ? "failed" : "passed",
    scope:
      "Local source and generated artifact manifest only. No production fetch, provider access, deploy, or public channel mutation.",
    summary: {
      requiredArtifacts: requiredArtifacts.length,
      missingRequiredArtifacts: requiredArtifacts.filter((entry) => !entry.exists).length,
      sitemapUrlCount: sitemapEntries.length,
      publicHtmlCount: publicHtmlFiles.length,
      sitemapMissingLocalCount: sitemapMissingLocal.length,
      localHtmlNotInSitemapCount: localHtmlNotInSitemap.length,
      duplicateSitemapUrlCount: duplicatedSitemapPaths.length,
      invalidSitemapLastmodCount: invalidLastmods.length,
      blogSourceCount: blogSources.length,
      draftLeakCount: draftLeaks.length,
      missingGeneratedPostCount: missingGeneratedPosts.length,
      checkedLocalReferenceCount: localReferences.checkedCount,
      missingLocalReferenceCount: localReferences.missing.length,
    },
    requiredArtifacts,
    sitemap: {
      missingLocal: sitemapMissingLocal,
      localHtmlNotInSitemap,
      duplicatedSitemapPaths,
      invalidLastmods,
    },
    blogSources,
    localReferences,
    failures,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
  console.log(`Status: ${manifest.status}`);
  if (failures.length) {
    for (const failure of failures.slice(0, 20)) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }
}

main();
