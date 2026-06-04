import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const publicHtmlExcludedDirs = new Set([
  ".git",
  ".backup",
  "admin",
  "data",
  "node_modules",
  "output",
  "pages",
  "templates",
]);

function listPublicHtmlFiles(startDir = new URL("../../", import.meta.url)) {
  const files = [];

  for (const entry of readdirSync(startDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (publicHtmlExcludedDirs.has(entry.name)) {
        continue;
      }
      files.push(...listPublicHtmlFiles(new URL(`${entry.name}/`, startDir)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".html")) {
      const absolutePath = new URL(entry.name, startDir);
      const relativePath = path
        .relative(new URL("../../", import.meta.url).pathname, absolutePath.pathname)
        .split(path.sep)
        .join("/");
      files.push(relativePath);
    }
  }

  return files.sort();
}

test("intake client emits a guarded GA4 lead event after success", () => {
  const source = read("intake-form.js");

  assert.match(source, /window\.gtag\("event",\s*"generate_lead"/);
  assert.match(source, /event_category:\s*"lead"/);
  assert.match(source, /form_type:\s*formType/);
  assert.match(source, /source_path:/);
  assert.match(source, /page_location:/);
  assert.match(source, /trace_id/);
  assert.match(source, /utm_source/);
  assert.match(source, /utm_medium/);
  assert.match(source, /utm_campaign/);
  assert.match(source, /attributionParameters/);
  assert.match(source, /sessionStorage/);
  assert.match(source, /INTAKE_TRACKING_KEY_PREFIX/);
});

test("lead form pages load both analytics and intake scripts", () => {
  for (const page of ["contact.html", "request-estimate.html", "schedule-service.html"]) {
    const html = read(page);

    assert.match(html, /<script\s+src=["']\/analytics\.js["']\s+defer><\/script>/, `${page} should load analytics.js`);
    assert.match(html, /<script\s+src=["']intake-form\.js["']\s+defer><\/script>/, `${page} should load intake-form.js`);
    assert.match(html, /data-intake-form=/, `${page} should expose an intake form type`);
  }
});

test("public marketing pages have a single approved local measurement source", () => {
  const publicHtmlFiles = listPublicHtmlFiles();

  assert.ok(publicHtmlFiles.length >= 100, "expected broad public HTML coverage");

  for (const page of publicHtmlFiles) {
    const html = read(page);
    const hasAnalyticsJs = /<script\s+src=["']\/analytics\.js["']\s+defer><\/script>/i.test(html);
    const hasApprovedInlineGa4 =
      html.includes("G-JZ7PY32EVX") && /googletagmanager\.com\/gtag\/js/i.test(html);
    const gtmContainers = [...new Set([...html.matchAll(/\bGTM-[A-Z0-9]+\b/g)].map((match) => match[0]))];

    assert.ok(
      hasAnalyticsJs || hasApprovedInlineGa4,
      `${page} should load /analytics.js or the approved inline GA4 source`
    );
    assert.equal(
      Number(hasAnalyticsJs) + Number(hasApprovedInlineGa4) + gtmContainers.length,
      1,
      `${page} should not duplicate analytics sources or include unverified GTM containers`
    );
  }
});
