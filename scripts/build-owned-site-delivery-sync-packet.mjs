#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const outPath = path.join(rootDir, "docs", "air-express-owned-site-delivery-sync-packet.md");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
}

function md(value = "") {
  return String(value)
    .replaceAll("|", "\\|")
    .replace(/\s+/g, " ")
    .trim();
}

function shortHash(value = "") {
  return value ? `${value.slice(0, 12)}...` : "";
}

function artifactRows(delivery) {
  const blockerByArtifact = new Map((delivery.blockers || []).map((blocker) => [blocker.artifact, blocker]));
  return (delivery.artifacts || []).map((artifact) => {
    const blocker = blockerByArtifact.get(artifact.name) || {};
    return [
      artifact.critical ? "P0" : "P1",
      artifact.name,
      artifact.localPath || artifact.local?.path || artifact.name,
      artifact.liveUrl || "",
      artifact.status,
      shortHash(artifact.local?.sha256),
      artifact.live?.status || "",
      shortHash(artifact.live?.sha256),
      artifact.live?.headers?.xNewRewardsEdgeWebsiteId || "",
      blocker.nextAction || "",
    ];
  });
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(md).join(" | ")} |`),
  ].join("\n");
}

function main() {
  const delivery = readJson("data/owned-site-delivery-sync-check.json");
  const measurement = readJson("data/live-measurement-path-check.json");
  const manifest = readJson("data/site-file-manifest.json");
  const audit = readJson("data/seo-geo-attribution-audit.json");
  const now = new Date().toISOString();

  const liveHomepage = measurement.live?.homepage || {};
  const liveAnalytics = measurement.live?.analyticsJs || {};
  const liveWwwHomepage = measurement.live?.wwwHomepage || {};
  const liveWwwAnalytics = measurement.live?.wwwAnalyticsJs || {};
  const turnstileConfig = measurement.live?.turnstileConfig || {};
  const pageCoverage = measurement.local?.pageCoverage || {};
  const pendingDeployFailures = audit.liveStatus?.pendingDeployFailures || [];
  const liveArtifactRows = artifactRows(delivery);

  const body = `# Air Express Owned-Site Delivery Sync Packet

Generated: ${now}

Status: prepared evidence packet. No provider mutation, DNS change, Vercel change, Cloudflare change, New Reward edge sync, ServiceTitan action, OAuth consent, public send, public post, or production deploy is performed by this packet.

## Objective

Move the locally prepared Air Express owned-site artifacts onto the live delivery path only after explicit approval, then verify the live site exposes exactly one approved measurement source for GA4 \`${delivery.approvedGa4Id || measurement.approvedGa4Id || "G-JZ7PY32EVX"}\`.

## Current State

- Owned-site delivery status: \`${delivery.status}\`.
- Live measurement status: \`${measurement.status}\`.
- Site-file manifest status: \`${manifest.status}\`.
- Approved GA4 id: \`${delivery.approvedGa4Id || measurement.approvedGa4Id || "G-JZ7PY32EVX"}\`.
- Live edge website id: \`${liveHomepage.headers?.xNewRewardsEdgeWebsiteId || "unknown"}\`.
- Live edge version: \`${liveHomepage.headers?.xNewRewardsEdgeActiveVersion || "unknown"}\`.
- Local public page measurement coverage: \`${pageCoverage.pagesWithAnyApprovedSource?.length || 0}/${pageCoverage.totalPages || 0}\`.
- Live homepage HTTP: \`${liveHomepage.status || "unknown"}\`; approved GA4 present: \`${Boolean(liveHomepage.markers?.approvedGa4Present)}\`.
- Live \`/analytics.js\` HTTP: \`${liveAnalytics.status || "unknown"}\`; approved GA4 present: \`${Boolean(liveAnalytics.markers?.approvedGa4Present)}\`.
- WWW homepage HTTP: \`${liveWwwHomepage.status || "unknown"}\`; approved GA4 present: \`${Boolean(liveWwwHomepage.markers?.approvedGa4Present)}\`.
- WWW \`/analytics.js\` HTTP: \`${liveWwwAnalytics.status || "unknown"}\`; approved GA4 present: \`${Boolean(liveWwwAnalytics.markers?.approvedGa4Present)}\`.
- Apex Turnstile configured: \`${Boolean(turnstileConfig.apex?.configured)}\`; WWW Turnstile configured: \`${Boolean(turnstileConfig.www?.configured)}\`.
- Approved GTM containers found locally: \`${(pageCoverage.approvedGtmContainers || []).join(", ") || "none"}\`.

## Artifact Sync Matrix

${table(
  ["Priority", "Artifact", "Local path", "Live URL", "Status", "Local SHA", "Live HTTP", "Live SHA", "Live website id", "Next action"],
  liveArtifactRows
)}

## Prepared Sitemap URL Not Yet Live

${pendingDeployFailures.length
  ? table(
      ["URL", "HTTP status", "Local path", "Local file exists"],
      pendingDeployFailures.map((failure) => [
        failure.url,
        failure.status || failure.error || "blocked",
        failure.localPath || "",
        String(Boolean(failure.localFileExists)),
      ])
    )
  : "No pending-deploy sitemap URL failures are recorded in the latest SEO/GEO audit."}

## Approved Delivery Paths

Use exactly one approved path, recorded in the issue or handoff before execution:

1. Connect the New Reward GitHub App and Vercel delivery path for the Air Express website.
2. Use an approved New Reward edge/manual artifact sync for the files in the artifact matrix.
3. Use an explicitly approved Air Express production deploy path.

If the operator chooses an edge-managed exception for \`llms.txt\`, \`sitemap.xml\`, or \`robots.txt\`, record the approved canonical source and keep homepage plus \`analytics.js\` as the P0 measurement artifacts.

## Stop Gates

- Stop if the live website id is not \`cmorqbs9j001r5nr1h25vosp8\`.
- Stop if an unverified \`GTM-...\` container appears; no approved Air Express GTM container id has been found.
- Stop if the sync path requires DNS, Cloudflare, Vercel, New Reward provider, Google, ServiceTitan, OAuth, public post, or public send mutation without explicit approval in the active thread.
- Stop if a provider asks for passwords, recovery codes, verification codes, token files, customer PII, or live test lead creation.

## Pre-Sync Verification

Run before any approved delivery action:

\`\`\`sh
npm run verify:site-file-manifest
npm run verify:public-claims
npm run verify:owned-site-delivery-sync
npm run verify:live-measurement
npm run verify:onboarding-evidence
\`\`\`

Expected pre-sync state from this packet:

- \`verify:site-file-manifest\` status is \`passed\`.
- \`verify:public-claims\` status is \`passed\`.
- \`verify:owned-site-delivery-sync\` status is \`${delivery.status}\`.
- \`verify:live-measurement\` status is \`${measurement.status}\`.

## Post-Sync Verification

Run after the approved delivery action:

\`\`\`sh
npm run verify:owned-site-delivery-sync
npm run verify:live-measurement
npm run audit:seo-geo-attribution
npm run verify:onboarding-evidence
npm run prevercel-build
\`\`\`

Expected post-sync proof for #28:

- Live homepage or live \`/analytics.js\` exposes exactly one approved GA4/GTM source.
- If GA4 is direct, the approved source is \`G-JZ7PY32EVX\`.
- No unapproved GTM container is present.
- \`contact.html\`, \`request-estimate.html\`, and \`schedule-service.html\` remain covered by the guarded \`generate_lead\` source path.
- Any lead-event proof uses GA4 Realtime/DebugView or an explicitly approved non-duplicating test. Do not create duplicate ServiceTitan leads.

## Issue Close Criteria

#28 can close only when:

- \`npm run verify:live-measurement\` reports a canonical live approved measurement source instead of \`${measurement.status}\`.
- \`npm run verify:owned-site-delivery-sync\` no longer reports P0 \`homepage\` or \`analytics_js\` as \`pending_delivery_sync\`.
- \`npm run audit:seo-geo-attribution\` reflects the live measurement state.
- The issue comment includes the exact command outputs, live website id, and any approved edge-managed exceptions for noncritical artifacts.
`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, body);
  console.log(`Wrote ${path.relative(rootDir, outPath)}`);
}

main();
