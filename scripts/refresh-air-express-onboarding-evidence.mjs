#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "data", "air-express-evidence-refresh-status.json");

const REFRESH_COMMANDS = [
  {
    script: "build:blog",
    purpose: "Regenerate local blog artifacts before site-file and claim checks.",
  },
  {
    script: "verify:site-file-manifest",
    purpose: "Verify local publish artifact completeness and draft exclusion.",
  },
  {
    script: "verify:public-claims",
    purpose: "Verify proof-gated public marketing claims.",
  },
  {
    script: "verify:live-measurement",
    purpose: "Check local GA4 coverage and live homepage/analytics marker state.",
  },
  {
    script: "verify:owned-site-delivery-sync",
    purpose: "Compare local owned-site artifacts against the live New Reward edge.",
  },
  {
    script: "prepare:delivery-sync-packet",
    purpose: "Refresh the owned-site delivery handoff packet.",
  },
  {
    script: "verify:newreward-mapping",
    purpose: "Run the sanitized read-only New Reward source-mapping recheck.",
  },
  {
    script: "pull:gsc-ga4-history",
    purpose: "Refresh Google history pull state and impact report.",
  },
  {
    script: "verify:servicetitan-export",
    purpose: "Refresh ServiceTitan export/API readiness without provider mutation.",
  },
  {
    script: "build:content-readiness-report",
    purpose: "Refresh the separate #31 content readiness report.",
  },
  {
    script: "verify:issue-evidence-alignment",
    purpose: "Verify issue #24-#30 matrix alignment with current evidence JSON.",
  },
  {
    script: "build:issue-blocker-report",
    purpose: "Refresh the GitHub Pages blocker report.",
  },
  {
    script: "audit:seo-geo-attribution",
    purpose: "Refresh SEO/GEO/messaging/attribution scores.",
  },
  {
    script: "verify:onboarding-evidence",
    purpose: "Run the final onboarding evidence gate.",
  },
];

function sanitizeOutput(value = "") {
  return String(value)
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[redacted-db-url]")
    .replace(/postgres:[^@\s"']+@[^\s"']+/gi, "[redacted-db-url]")
    .replace(/(access[_-]?token["']?\s*[:=]\s*["']?)[^"',\s]+/gi, "$1[redacted]")
    .replace(/(refresh[_-]?token["']?\s*[:=]\s*["']?)[^"',\s]+/gi, "$1[redacted]")
    .replace(/(password["']?\s*[:=]\s*["']?)[^"',\s]+/gi, "$1[redacted]")
    .replace(/(secret["']?\s*[:=]\s*["']?)[^"',\s]+/gi, "$1[redacted]");
}

function tailLines(value = "", count = 5) {
  return sanitizeOutput(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-count);
}

function runNpmScript(script) {
  const startedAt = new Date();
  const startedMs = Date.now();
  const result = spawnSync("npm", ["run", script], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });

  return {
    script,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startedMs,
    exitCode: result.status,
    signal: result.signal || "",
    status: result.status === 0 ? "passed" : "failed",
    stdoutTail: tailLines(result.stdout, 3),
    stderrTail: tailLines(result.stderr || result.error?.message || "", 5),
  };
}

function readJson(relativePath) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) return null;
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch {
    return null;
  }
}

function observedStatus() {
  const liveMeasurement = readJson("data/live-measurement-path-check.json");
  const deliverySync = readJson("data/owned-site-delivery-sync-check.json");
  const googleHistory = readJson("data/google-history/history-pull-status.json");
  const mapping = readJson("data/newreward-air-express-provider-readonly-recheck.json");
  const serviceTitan = readJson("data/servicetitan-export-access-check.json");
  const siteFileManifest = readJson("data/site-file-manifest.json");
  const publicClaims = readJson("data/public-claim-register.json");
  const issueAlignment = readJson("data/issue-evidence-alignment-check.json");
  const seoAudit = readJson("data/seo-geo-attribution-audit.json");

  return {
    liveMeasurementStatus: liveMeasurement?.status || "",
    deliverySyncStatus: deliverySync?.status || "",
    googleHistoryStatus: googleHistory?.status || "",
    gscStatus: googleHistory?.gsc?.status || "",
    ga4Status: googleHistory?.ga4?.status || "",
    gbpStatus: googleHistory?.gbp?.status || "",
    newRewardMappingStatus: mapping?.status || "",
    serviceTitanStatus: serviceTitan?.status || "",
    siteFileManifestStatus: siteFileManifest?.status || "",
    publicClaimsStatus: publicClaims?.status || "",
    issueEvidenceAlignmentStatus: issueAlignment?.status || "",
    seoScores: seoAudit?.scores || {},
  };
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      evidenceClass: "air_express_onboarding_evidence_refresh",
      status: "running",
      scope:
        "Repo-local evidence refresh only. No DNS, Vercel, Cloudflare, Turnstile, ServiceTitan, Google OAuth consent/provider reconnect, GTM publish, New Reward provider mutation, public send, public post, or production deploy.",
      secretHandling:
        "Stores command names, statuses, timings, sanitized output tails, and existing diagnostic statuses only. No access tokens, refresh tokens, provider credentials, database URLs, passwords, login codes, cookies, customer PII, or raw provider payloads are stored.",
      plannedCommands: REFRESH_COMMANDS.map(({ script, purpose }) => ({ script, purpose })),
    },
    null,
    2,
  )}\n`,
);

const commandResults = REFRESH_COMMANDS.map(({ script }) => runNpmScript(script));
const failedCommands = commandResults.filter((result) => result.status !== "passed");
const observed = observedStatus();

const payload = {
  generatedAt: new Date().toISOString(),
  evidenceClass: "air_express_onboarding_evidence_refresh",
  status: failedCommands.length ? "failed" : "refreshed_with_recorded_blockers",
  scope:
    "Repo-local evidence refresh only. No DNS, Vercel, Cloudflare, Turnstile, ServiceTitan, Google OAuth consent/provider reconnect, GTM publish, New Reward provider mutation, public send, public post, or production deploy.",
  secretHandling:
    "Stores command names, statuses, timings, sanitized output tails, and existing diagnostic statuses only. No access tokens, refresh tokens, provider credentials, database URLs, passwords, login codes, cookies, customer PII, or raw provider payloads are stored.",
  commands: REFRESH_COMMANDS.map((command) => ({
    ...command,
    ...commandResults.find((result) => result.script === command.script),
  })),
  summary: {
    totalCommands: commandResults.length,
    failedCommands: failedCommands.length,
    failedCommandNames: failedCommands.map((result) => result.script),
  },
  observed,
  nextAction:
    "Use the observed statuses to update #24-#30. Current expected blockers are expired New Reward Google provider rows plus Google read scopes/property visibility, live owned-site delivery sync, and ServiceTitan export proof.",
};

writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);

console.log(`Wrote ${outPath}`);
console.log(`Status: ${payload.status}`);
for (const [key, value] of Object.entries(observed)) {
  if (value && typeof value !== "object") {
    console.log(`${key}: ${value}`);
  }
}

if (failedCommands.length) {
  for (const command of failedCommands) {
    console.error(`Failed: ${command.script}`);
  }
  process.exit(1);
}
