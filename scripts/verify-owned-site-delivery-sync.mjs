#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "data", "owned-site-delivery-sync-check.json");

const CANONICAL_ORIGIN = "https://airexpressutah.com";
const APPROVED_GA4_ID = "G-JZ7PY32EVX";
const APPROVED_GTM_CONTAINERS = [];

const ARTIFACTS = [
  {
    name: "homepage",
    localPath: "index.html",
    liveUrl: `${CANONICAL_ORIGIN}/`,
    critical: true,
    expectedMarkers: ["approvedGa4Present"],
  },
  {
    name: "analytics_js",
    localPath: "analytics.js",
    liveUrl: `${CANONICAL_ORIGIN}/analytics.js`,
    critical: true,
    expectedMarkers: ["approvedGa4Present", "gtagLoaderPresent", "gtagCallPresent"],
  },
  {
    name: "llms_txt",
    localPath: "llms.txt",
    liveUrl: `${CANONICAL_ORIGIN}/llms.txt`,
    critical: false,
    expectedMarkers: [],
  },
  {
    name: "agent_json",
    localPath: "agent.json",
    liveUrl: `${CANONICAL_ORIGIN}/agent.json`,
    critical: false,
    expectedMarkers: [],
  },
  {
    name: "well_known_agent_json",
    localPath: ".well-known/agent.json",
    liveUrl: `${CANONICAL_ORIGIN}/.well-known/agent.json`,
    critical: false,
    expectedMarkers: [],
  },
  {
    name: "catalog_json",
    localPath: "catalog.json",
    liveUrl: `${CANONICAL_ORIGIN}/catalog.json`,
    critical: false,
    expectedMarkers: [],
  },
  {
    name: "sitemap_xml",
    localPath: "sitemap.xml",
    liveUrl: `${CANONICAL_ORIGIN}/sitemap.xml`,
    critical: false,
    expectedMarkers: [],
  },
  {
    name: "robots_txt",
    localPath: "robots.txt",
    liveUrl: `${CANONICAL_ORIGIN}/robots.txt`,
    critical: false,
    expectedMarkers: [],
  },
];

function sha256(source = "") {
  return createHash("sha256").update(source).digest("hex");
}

function readLocal(relativePath) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) {
    return {
      exists: false,
      bytes: 0,
      sha256: "",
      markers: markerSummary(""),
      text: "",
    };
  }

  const text = readFileSync(absolutePath, "utf8");
  return {
    exists: true,
    bytes: Buffer.byteLength(text),
    sha256: sha256(text),
    markers: markerSummary(text),
    text,
  };
}

function gtmContainers(source = "") {
  return [...new Set([...source.matchAll(/\bGTM-[A-Z0-9]+\b/g)].map((match) => match[0]))].sort();
}

function markerSummary(source = "") {
  return {
    approvedGa4Present: source.includes(APPROVED_GA4_ID),
    gtagLoaderPresent: /googletagmanager\.com\/gtag\/js/i.test(source),
    gtagCallPresent: /\bgtag\s*\(/i.test(source),
    dataLayerPresent: /\bdataLayer\b/i.test(source),
    analyticsJsReferencePresent: /\/analytics\.js|["']analytics\.js["']/i.test(source),
    gtmContainers: gtmContainers(source),
  };
}

async function fetchLive(url) {
  try {
    const response = await fetch(url, { redirect: "follow" });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      bytes: Buffer.byteLength(text),
      sha256: response.ok ? sha256(text) : "",
      headers: {
        xNewRewardsEdgeWebsiteId: response.headers.get("x-newrewards-edge-website-id") || "",
        xNewRewardsEdgeActiveVersion: response.headers.get("x-newrewards-edge-active-version") || "",
        xNewRewardsEdgeRouteMode: response.headers.get("x-newrewards-edge-route-mode") || "",
        contentType: response.headers.get("content-type") || "",
      },
      markers: markerSummary(text),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      bytes: 0,
      sha256: "",
      headers: {},
      markers: markerSummary(""),
      error: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
    };
  }
}

function markerStatus(artifact, local, live) {
  const missingLocalMarkers = artifact.expectedMarkers.filter((marker) => !local.markers[marker]);
  const missingLiveMarkers = artifact.expectedMarkers.filter((marker) => !live.markers[marker]);
  const unapprovedLocalGtm = local.markers.gtmContainers.filter(
    (containerId) => !APPROVED_GTM_CONTAINERS.includes(containerId)
  );
  const unapprovedLiveGtm = live.markers.gtmContainers.filter(
    (containerId) => !APPROVED_GTM_CONTAINERS.includes(containerId)
  );

  return {
    missingLocalMarkers,
    missingLiveMarkers,
    unapprovedLocalGtm,
    unapprovedLiveGtm,
  };
}

function classifyArtifact(artifact, local, live, markerCheck) {
  if (!local.exists) return "blocked_missing_local_source";
  if (markerCheck.unapprovedLocalGtm.length > 0 || markerCheck.unapprovedLiveGtm.length > 0) {
    return "blocked_unapproved_gtm";
  }
  if (markerCheck.missingLocalMarkers.length > 0) return "blocked_local_marker_missing";
  if (!live.ok) return "pending_delivery_sync";
  if (markerCheck.missingLiveMarkers.length > 0) return "pending_delivery_sync";
  if (local.sha256 && live.sha256 && local.sha256 !== live.sha256) return "live_drift";
  return "synced";
}

function classifyOverall(artifacts) {
  if (artifacts.some((artifact) => artifact.status.startsWith("blocked"))) {
    return "blocked_local_or_unapproved_source";
  }
  if (artifacts.some((artifact) => artifact.critical && artifact.status === "pending_delivery_sync")) {
    return "pending_delivery_sync";
  }
  if (artifacts.some((artifact) => artifact.status === "pending_delivery_sync")) {
    return "pending_noncritical_delivery_sync";
  }
  if (artifacts.some((artifact) => artifact.status === "live_drift")) {
    return "live_drift";
  }
  return "synced";
}

async function main() {
  const artifactResults = [];

  for (const artifact of ARTIFACTS) {
    const local = readLocal(artifact.localPath);
    const live = await fetchLive(artifact.liveUrl);
    const markerCheck = markerStatus(artifact, local, live);
    const status = classifyArtifact(artifact, local, live, markerCheck);

    artifactResults.push({
      name: artifact.name,
      status,
      critical: artifact.critical,
      localPath: artifact.localPath,
      liveUrl: artifact.liveUrl,
      expectedMarkers: artifact.expectedMarkers,
      local: {
        exists: local.exists,
        bytes: local.bytes,
        sha256: local.sha256,
        markers: local.markers,
      },
      live,
      markerCheck,
    });
  }

  const status = classifyOverall(artifactResults);
  const payload = {
    generatedAt: new Date().toISOString(),
    evidenceClass: "owned_site_delivery_sync_read_only_check",
    status,
    canonicalOrigin: CANONICAL_ORIGIN,
    approvedGa4Id: APPROVED_GA4_ID,
    approvedGtmContainers: APPROVED_GTM_CONTAINERS,
    secretHandling:
      "Stores public HTTP status, response headers, marker booleans, byte counts, and sha256 hashes only. No cookies, tokens, provider credentials, form submissions, customer data, or raw live HTML are written.",
    mutationBoundary:
      "Read-only local source inspection and public HTTP fetches only. No deploy, edge sync, provider change, GTM publish, GA4 change, ServiceTitan lead, DNS change, or production mutation is performed.",
    artifacts: artifactResults,
    blockers: artifactResults
      .filter((artifact) => artifact.status !== "synced")
      .map((artifact) => ({
        artifact: artifact.name,
        status: artifact.status,
        evidence:
          artifact.status === "pending_delivery_sync"
            ? `${artifact.localPath} is prepared locally, but ${artifact.liveUrl} is missing, stale, or lacks expected live markers.`
            : `${artifact.localPath} and ${artifact.liveUrl} differ or have a local/source marker problem.`,
        nextAction:
          artifact.critical
            ? "Approve the Air Express delivery path through deploy, New Reward edge sync, or manual artifact sync; then rerun npm run verify:owned-site-delivery-sync and npm run verify:live-measurement."
            : "After the critical measurement path is live, sync this artifact or record the approved edge-managed exception.",
      })),
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
  console.log(`Status: ${status}`);

  if (status.startsWith("blocked")) {
    process.exitCode = 1;
  }
}

main();
