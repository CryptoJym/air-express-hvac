import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const CANONICAL_URL = "https://airexpressutah.com/";
const LIVE_ANALYTICS_URL = "https://airexpressutah.com/analytics.js";
const APPROVED_GA4_ID = "G-JZ7PY32EVX";
const APPROVED_GTM_CONTAINERS = [];
const OUT_PATH = join(root, "data", "live-measurement-path-check.json");
const PUBLIC_HTML_EXCLUDED_DIRS = new Set([
  ".git",
  ".backup",
  "admin",
  "data",
  "node_modules",
  "output",
  "pages",
  "templates",
]);

const LEAD_FORM_PAGES = [
  "contact.html",
  "request-estimate.html",
  "schedule-service.html",
];

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function includesApprovedGa4(source = "") {
  return source.includes(APPROVED_GA4_ID);
}

function gtmContainers(source = "") {
  return [...new Set([...source.matchAll(/\bGTM-[A-Z0-9]+\b/g)].map((match) => match[0]))].sort();
}

function markerSummary(source = "") {
  return {
    approvedGa4Present: includesApprovedGa4(source),
    gtagLoaderPresent: /googletagmanager\.com\/gtag\/js/i.test(source),
    gtagCallPresent: /\bgtag\s*\(/i.test(source),
    dataLayerPresent: /\bdataLayer\b/i.test(source),
    googleAnalyticsTextPresent: /google-analytics|googleanalytics/i.test(source),
    analyticsJsReferencePresent: /\/analytics\.js|["']analytics\.js["']/i.test(source),
    gtmContainers: gtmContainers(source),
  };
}

function sourceCount(markers) {
  let count = 0;
  if (markers.approvedGa4Present && (markers.gtagLoaderPresent || markers.gtagCallPresent)) count += 1;
  count += markers.gtmContainers.length;
  return count;
}

function toPosix(relativePath) {
  return relativePath.split(sep).join("/");
}

function listPublicHtmlFiles(startDir = root) {
  const files = [];

  for (const entry of readdirSync(startDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (PUBLIC_HTML_EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }
      files.push(...listPublicHtmlFiles(join(startDir, entry.name)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(toPosix(relative(root, join(startDir, entry.name))));
    }
  }

  return files.sort();
}

function checkPublicPageCoverage() {
  const checkedPublicPages = listPublicHtmlFiles();
  const pageDetails = checkedPublicPages.map((file) => {
    const markers = markerSummary(read(file));
    const approvedInlineGa4 =
      markers.approvedGa4Present && (markers.gtagLoaderPresent || markers.gtagCallPresent);
    const analyticsJsReference = markers.analyticsJsReferencePresent;
    const unapprovedGtmContainers = markers.gtmContainers
      .filter((containerId) => !APPROVED_GTM_CONTAINERS.includes(containerId));
    const approvedSourceCount = Number(approvedInlineGa4) + Number(analyticsJsReference);
    const totalMeasurementSourceCount = approvedSourceCount + markers.gtmContainers.length;

    return {
      file,
      approvedInlineGa4,
      analyticsJsReference,
      approvedSourcePresent: approvedInlineGa4 || analyticsJsReference,
      gtmContainers: markers.gtmContainers,
      unapprovedGtmContainers,
      totalMeasurementSourceCount,
    };
  });

  return {
    totalPages: pageDetails.length,
    approvedGtmContainers: APPROVED_GTM_CONTAINERS,
    checkedPublicPages,
    pagesWithAnalyticsJs: pageDetails
      .filter((page) => page.analyticsJsReference)
      .map((page) => page.file),
    pagesWithApprovedInlineGa4: pageDetails
      .filter((page) => page.approvedInlineGa4)
      .map((page) => page.file),
    pagesWithAnyApprovedSource: pageDetails
      .filter((page) => page.approvedSourcePresent)
      .map((page) => page.file),
    pagesMissingMeasurementSource: pageDetails
      .filter((page) => !page.approvedSourcePresent)
      .map((page) => page.file),
    pagesWithUnapprovedGtmContainers: pageDetails
      .filter((page) => page.unapprovedGtmContainers.length > 0)
      .map((page) => ({
        file: page.file,
        gtmContainers: page.unapprovedGtmContainers,
      })),
    pagesWithDuplicateSources: pageDetails
      .filter((page) => page.totalMeasurementSourceCount > 1)
      .map((page) => ({
        file: page.file,
        sourceCount: page.totalMeasurementSourceCount,
      })),
  };
}

async function fetchText(url) {
  try {
    const response = await fetch(url, { redirect: "follow" });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      headers: {
        xNewRewardsEdgeWebsiteId: response.headers.get("x-newrewards-edge-website-id") || "",
        xNewRewardsEdgeActiveVersion: response.headers.get("x-newrewards-edge-active-version") || "",
        xNewRewardsEdgeRouteMode: response.headers.get("x-newrewards-edge-route-mode") || "",
        contentType: response.headers.get("content-type") || "",
      },
      text,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      headers: {},
      error: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      text: "",
    };
  }
}

function checkLeadEventSource() {
  const intakeSource = existsSync(join(root, "intake-form.js")) ? read("intake-form.js") : "";
  const pageEvidence = LEAD_FORM_PAGES.map((file) => {
    const html = existsSync(join(root, file)) ? read(file) : "";
    return {
      file,
      hasAnalyticsLoader: /<script\s+src=["']\/analytics\.js["']\s+defer><\/script>/i.test(html),
      hasIntakeScript: /<script\s+src=["']intake-form\.js["']\s+defer><\/script>/i.test(html),
      hasIntakeForm: /data-intake-form=/i.test(html),
    };
  });

  const prepared =
    /window\.gtag\("event",\s*"generate_lead"/.test(intakeSource)
    && /sessionStorage/.test(intakeSource)
    && pageEvidence.every((page) => page.hasAnalyticsLoader && page.hasIntakeScript && page.hasIntakeForm);

  return {
    status: prepared ? "prepared_source_pending_live" : "missing_source",
    evidence: [
      /window\.gtag\("event",\s*"generate_lead"/.test(intakeSource) ? "intake-form.js:generate_lead" : "",
      /sessionStorage/.test(intakeSource) ? "intake-form.js:sessionStorage_guard" : "",
      ...pageEvidence
        .filter((page) => page.hasAnalyticsLoader && page.hasIntakeScript && page.hasIntakeForm)
        .map((page) => `${page.file}:analytics+intake`),
    ].filter(Boolean),
    pageEvidence,
  };
}

function classify({ local, live, leadEvent }) {
  if (!local.index.markers.approvedGa4Present || !local.analyticsJs.markers.approvedGa4Present) {
    return "blocked_local_source";
  }
  if (
    local.pageCoverage.pagesMissingMeasurementSource.length > 0
    || local.pageCoverage.pagesWithUnapprovedGtmContainers.length > 0
    || local.pageCoverage.pagesWithDuplicateSources.length > 0
  ) {
    return "blocked_local_coverage";
  }
  if (!live.homepage.ok) {
    return "blocked_live_fetch";
  }
  if (live.homepage.sourceCount > 1 || live.homepage.markers.gtmContainers.length > 0) {
    return "blocked_duplicate_or_unverified_live_source";
  }
  if (live.homepage.markers.approvedGa4Present && live.homepage.sourceCount === 1 && leadEvent.status === "prepared_source_pending_live") {
    return "live_single_source_verified_pending_event_proof";
  }
  return "fixed_locally_pending_live";
}

async function main() {
  const localIndex = read("index.html");
  const localAnalytics = read("analytics.js");
  const leadEvent = checkLeadEventSource();

  const liveHomepage = await fetchText(CANONICAL_URL);
  const liveAnalytics = await fetchText(LIVE_ANALYTICS_URL);

  const local = {
    index: {
      file: "index.html",
      markers: markerSummary(localIndex),
    },
    analyticsJs: {
      file: "analytics.js",
      markers: markerSummary(localAnalytics),
    },
    pageCoverage: checkPublicPageCoverage(),
  };

  const live = {
    homepage: {
      url: CANONICAL_URL,
      finalUrl: liveHomepage.url,
      ok: liveHomepage.ok,
      status: liveHomepage.status,
      headers: liveHomepage.headers,
      markers: markerSummary(liveHomepage.text),
    },
    analyticsJs: {
      url: LIVE_ANALYTICS_URL,
      finalUrl: liveAnalytics.url,
      ok: liveAnalytics.ok,
      status: liveAnalytics.status,
      headers: liveAnalytics.headers,
      markers: markerSummary(liveAnalytics.text),
    },
  };
  live.homepage.sourceCount = sourceCount(live.homepage.markers);
  live.analyticsJs.sourceCount = sourceCount(live.analyticsJs.markers);

  const status = classify({ local, live, leadEvent });
  const evidence = {
    generatedAt: new Date().toISOString(),
    evidenceClass: "live_measurement_path_read_only_check",
    status,
    canonicalUrl: CANONICAL_URL,
    approvedGa4Id: APPROVED_GA4_ID,
    secretHandling:
      "Only public page status, public response headers, marker booleans, and verified measurement ids/container ids are stored. No cookies, tokens, provider credentials, form submissions, customer data, or raw HTML are written.",
    mutationBoundary:
      "Read-only public HTTP fetches and local source inspection only. No deploy, provider change, GTM publish, GA4 change, ServiceTitan lead, or production mutation is performed.",
    local,
    live,
    leadEvent,
    blockers: [
      ...(status === "fixed_locally_pending_live"
        ? [{
          surface: "Live Air Express measurement source",
          status,
          evidence:
            `Local source contains ${APPROVED_GA4_ID}, but live homepage source does not expose the approved GA4 marker and /analytics.js returned HTTP ${live.analyticsJs.status}.`,
          nextAction:
            "Approve the Air Express deploy, New Reward edge sync, or manual delivery path; then rerun npm run verify:live-measurement.",
        }]
        : []),
      ...(status === "blocked_local_coverage"
        ? [{
          surface: "Local public page measurement coverage",
          status,
          evidence:
            `${local.pageCoverage.pagesMissingMeasurementSource.length} public pages missing an approved measurement source; ${local.pageCoverage.pagesWithDuplicateSources.length} public pages have duplicate measurement sources; ${local.pageCoverage.pagesWithUnapprovedGtmContainers.length} public pages have unapproved GTM containers.`,
          nextAction:
            "Repair local source coverage, verify any GTM container id from owner/provider evidence, then rerun npm run verify:live-measurement.",
        }]
        : []),
      ...(live.homepage.markers.gtmContainers.length
        ? [{
          surface: "GTM container",
          status: "blocked_unverified_gtm",
          evidence: `Live homepage exposes GTM containers: ${live.homepage.markers.gtmContainers.join(", ")}.`,
          nextAction: "Verify the exact approved Air Express GTM container id before treating this as a valid measurement source.",
        }]
        : []),
    ],
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(evidence, null, 2)}\n`);

  process.stdout.write(`Wrote ${OUT_PATH}\nStatus: ${status}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
