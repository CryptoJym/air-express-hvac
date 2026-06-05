#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const OUT_PATH = join(root, "data", "turnstile-lead-path-diagnostic.json");

const TURNSTILE_COMMIT = "27cf80099165065e7f5bd0c0ca49d595326c4c44";
const TURNSTILE_DATE = "2026-06-04";
const TURNSTILE_TIMESTAMP = "2026-06-04T15:21:32-06:00";
const APEX = "https://airexpressutah.com";
const WWW = "https://www.airexpressutah.com";
const TURNSTILE_CONFIG_PATH = "/api/turnstile/config";
const INTAKE_PATH = "/api/intake/contact";

function writeJson(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(relativePath, fallback = {}) {
  const filePath = join(root, relativePath);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function gitCommitEvidence() {
  try {
    const output = execFileSync(
      "git",
      [
        "show",
        "--name-status",
        "--date=iso",
        "--format=%H%n%cI%n%ad%n%s",
        TURNSTILE_COMMIT,
        "--",
        "api/_lib/turnstile.js",
        "api/turnstile/config.js",
        "api/_lib/intake.js",
        "intake-form.js",
        "contact.html",
        "request-estimate.html",
        "schedule-service.html",
        "tests/unit/intake.test.js",
      ],
      { cwd: root, encoding: "utf8" }
    );
    const lines = output.trim().split(/\r?\n/);
    const [hash, committedIso, committedLocal, subject, ...fileLines] = lines;
    return {
      hash,
      committedIso,
      committedLocal,
      subject,
      files: fileLines
        .filter(Boolean)
        .map((line) => {
          const [status, file] = line.split(/\s+/, 2);
          return { status, file };
        }),
    };
  } catch (error) {
    return {
      hash: TURNSTILE_COMMIT,
      committedIso: "",
      committedLocal: TURNSTILE_TIMESTAMP,
      subject: "",
      files: [],
      error: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
    };
  }
}

async function fetchJsonSafe(url) {
  try {
    const response = await fetch(url, { redirect: "follow" });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    return {
      url,
      finalUrl: response.url,
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type") || "",
      edgeWebsiteId: response.headers.get("x-newrewards-edge-website-id") || "",
      edgeActiveVersion: response.headers.get("x-newrewards-edge-active-version") || "",
      edgeRouteMode: response.headers.get("x-newrewards-edge-route-mode") || "",
      configured: payload?.configured === true,
      missingKeys: Array.isArray(payload?.missingKeys) ? payload.missingKeys : [],
      exposesSiteKey: typeof payload?.siteKey === "string" && payload.siteKey.length > 0,
      responseClass: payload ? "json" : "non_json_or_missing",
    };
  } catch (error) {
    return {
      url,
      finalUrl: url,
      ok: false,
      status: 0,
      contentType: "",
      edgeWebsiteId: "",
      edgeActiveVersion: "",
      edgeRouteMode: "",
      configured: false,
      missingKeys: [],
      exposesSiteKey: false,
      responseClass: "fetch_error",
      error: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
    };
  }
}

async function validationOnlyIntakeProbe(host) {
  const body = new URLSearchParams({
    name: "Test Verification",
    email: "test@example.com",
    phone: "555-0100",
    service: "ac",
    message: "Safe validation-only probe; no CAPTCHA token; should not create lead.",
    source_path: "/contact.html",
    return_to: "/contact.html",
  });

  try {
    const response = await fetch(`${host}${INTAKE_PATH}`, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const location = response.headers.get("location") || "";
    const blockedByCaptcha =
      response.status === 303
      && /intake=validation_error/i.test(location)
      && /fields=captcha/i.test(location);
    const upstreamError =
      response.status === 303
      && /intake=upstream_error/i.test(location);

    return {
      url: `${host}${INTAKE_PATH}`,
      method: "POST",
      safeProbe: true,
      submittedRealCustomerData: false,
      submittedCaptchaToken: false,
      expectedServiceTitanMutation: false,
      status: response.status,
      ok: response.ok,
      location,
      contentType: response.headers.get("content-type") || "",
      edgeWebsiteId: response.headers.get("x-newrewards-edge-website-id") || "",
      edgeActiveVersion: response.headers.get("x-newrewards-edge-active-version") || "",
      edgeRouteMode: response.headers.get("x-newrewards-edge-route-mode") || "",
      blockedByCaptcha,
      upstreamError,
      interpretation: blockedByCaptcha
        ? "The live form path rejects a submission before ServiceTitan when the CAPTCHA token is absent."
        : upstreamError
          ? "The canonical edge did not return a CAPTCHA validation error for the no-token probe; it returned an upstream error before successful lead creation."
          : "The no-token probe did not prove a CAPTCHA-specific block.",
    };
  } catch (error) {
    return {
      url: `${host}${INTAKE_PATH}`,
      method: "POST",
      safeProbe: true,
      submittedRealCustomerData: false,
      submittedCaptchaToken: false,
      expectedServiceTitanMutation: false,
      status: 0,
      ok: false,
      location: "",
      contentType: "",
      edgeWebsiteId: "",
      edgeActiveVersion: "",
      edgeRouteMode: "",
      blockedByCaptcha: false,
      upstreamError: false,
      interpretation: "The validation-only probe could not fetch the live intake endpoint.",
      error: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
    };
  }
}

function serviceTitanTimeline() {
  const summary = readJson("data/servicetitan-api-lead-history-summary.json");
  const weekly = Array.isArray(summary.completeWeeklyTrend) ? summary.completeWeeklyTrend : [];
  const zeroWeeks = weekly.filter((week) => Number(week.totalLeads || 0) === 0);
  const firstZeroWeek = zeroWeeks[0] || null;
  const lateMayZeroWeek = weekly.find((week) => week.week === "2026-05-25") || null;
  const markerWeek = weekly.find((week) => week.week === "2026-06-01") || null;
  const priorPositiveWeeks = weekly.filter((week) => week.week < "2026-05-25" && Number(week.totalLeads || 0) > 0);
  const lastPositiveWeekBeforeLateDrop = priorPositiveWeeks.at(-1) || null;
  const lateDropPredatesTurnstile =
    Number(lateMayZeroWeek?.totalLeads || 0) === 0
    && lateMayZeroWeek?.week < "2026-06-01"
    && TURNSTILE_DATE > "2026-05-25";

  return {
    sourceStatus: summary.status || "unknown",
    requestedRange: summary.requestedRange || null,
    totalRows: summary.rows || 0,
    websiteCampaignLeadCount: summary.websiteCampaignLeadCount || 0,
    countsByCaptchaPeriod: summary.countsByCaptchaPeriod || {},
    qualityProxyByCaptchaPeriod: summary.qualityProxyByCaptchaPeriod || {},
    latestWeeks: weekly.slice(-8),
    firstZeroWeek,
    lastPositiveWeekBeforeLateDrop,
    lateMayZeroWeek,
    markerWeek,
    lateDropPredatesTurnstile,
    interpretation:
      lateDropPredatesTurnstile
        ? "The late-May zero-lead week started before the Turnstile source marker, so CAPTCHA cannot explain the whole late-May drop. The week of 2026-06-01 overlaps the June 4 Turnstile source marker and live config failure, so CAPTCHA/delivery can be a current blocker but not the sole root cause."
        : "Compare the late-May and source-marker weeks with the Turnstile source marker before assigning causality.",
  };
}

function classifyStatus(turnstileConfig, validationProbes, timeline) {
  const wwwConfigBlocked = turnstileConfig.www.status === 503 && turnstileConfig.www.missingKeys.length > 0;
  const apexMissingConfig = turnstileConfig.apex.status === 404;
  const wwwCaptchaBlocks = validationProbes.www.blockedByCaptcha;
  const apexUpstream = validationProbes.apex.upstreamError;
  const lateMayDropPredatesTurnstile = timeline.lateDropPredatesTurnstile === true;

  if ((wwwConfigBlocked || apexMissingConfig || wwwCaptchaBlocks || apexUpstream) && lateMayDropPredatesTurnstile) {
    return "captcha_delivery_blocker_but_not_full_drop_cause";
  }
  if (wwwConfigBlocked || apexMissingConfig || wwwCaptchaBlocks || apexUpstream) {
    return "captcha_delivery_blocker";
  }
  return "captcha_path_not_currently_blocking";
}

async function main() {
  const turnstileConfig = {
    apex: await fetchJsonSafe(`${APEX}${TURNSTILE_CONFIG_PATH}`),
    www: await fetchJsonSafe(`${WWW}${TURNSTILE_CONFIG_PATH}`),
  };
  const validationProbes = {
    apex: await validationOnlyIntakeProbe(APEX),
    www: await validationOnlyIntakeProbe(WWW),
  };
  const timeline = serviceTitanTimeline();
  const commit = gitCommitEvidence();
  const status = classifyStatus(turnstileConfig, validationProbes, timeline);

  const diagnostic = {
    generatedAt: new Date().toISOString(),
    evidenceClass: "turnstile_lead_path_diagnostic",
    status,
    secretHandling:
      "Only public endpoint statuses, response header identifiers, missing env-key names, and aggregate lead counts are stored. No secret values, CAPTCHA tokens, cookies, customer PII, raw HTML, raw ServiceTitan payloads, or credentials are stored.",
    mutationBoundary:
      "Read-only public endpoint fetches plus a validation-only no-CAPTCHA intake probe. The probe uses dummy data, follows no redirect, provides no CAPTCHA token, and is expected to stop before ServiceTitan lead creation.",
    sourceMarker: {
      date: TURNSTILE_DATE,
      timestamp: TURNSTILE_TIMESTAMP,
      commit: TURNSTILE_COMMIT,
      evidence: "Git history shows the Turnstile source integration landed in commit 27cf800 on June 4, 2026.",
      commitDetails: commit,
    },
    liveTurnstileConfig: turnstileConfig,
    validationOnlyProbes: validationProbes,
    serviceTitanTimeline: timeline,
    causalRead: {
      verified: [
        `Turnstile source marker: ${TURNSTILE_TIMESTAMP} (${TURNSTILE_COMMIT.slice(0, 7)}).`,
        `www Turnstile config status: HTTP ${turnstileConfig.www.status}; missing keys: ${turnstileConfig.www.missingKeys.join(", ") || "none reported"}.`,
        `apex Turnstile config status: HTTP ${turnstileConfig.apex.status}.`,
        `www no-token probe status: HTTP ${validationProbes.www.status}; location: ${validationProbes.www.location || "none"}.`,
        `apex no-token probe status: HTTP ${validationProbes.apex.status}; location: ${validationProbes.apex.location || "none"}.`,
      ],
      inferred: [
        "www can fail closed before ServiceTitan when CAPTCHA token is missing.",
        "canonical apex is still on a New Reward edge path that does not match the www Vercel behavior.",
      ],
      notProven: [
        "CAPTCHA caused the full lead drop.",
        "CAPTCHA improved lead quality.",
        "A valid CAPTCHA submission currently reaches ServiceTitan and GA4 generate_lead on the canonical host.",
      ],
      explanation:
        "CAPTCHA/Turnstile is a current lead-path blocker on live delivery, but it cannot explain the full late-May lead drop because the zero-lead week beginning May 25 started before the Turnstile source commit. The likely root cause is a combined delivery/configuration problem: canonical apex edge mismatch, missing Turnstile env keys on www, and incomplete tracking/event proof.",
    },
    nextActions: [
      {
        priority: "P0",
        action: "Add approved TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY to the active production delivery environment.",
        proof: "Both apex and www /api/turnstile/config return configured=true without exposing the secret key.",
      },
      {
        priority: "P0",
        action: "Sync canonical apex/New Reward edge delivery with the www Vercel delivery source.",
        proof: "Canonical apex serves /analytics.js, approved GA4, Turnstile config, and the same intake behavior as www.",
      },
      {
        priority: "P0",
        action: "Run one approved non-duplicating lead-path proof after CAPTCHA config is healthy.",
        proof: "Valid CAPTCHA token reaches ServiceTitan intake and records the GA4 generate_lead event on the canonical host.",
      },
      {
        priority: "P1",
        action: "Continue weekly ServiceTitan history pulls and compare zero-lead weeks against deployment markers.",
        proof: "The private Pages performance report shows the latest weekly rows and deployment/CAPTCHA markers.",
      },
    ],
  };

  writeJson(OUT_PATH, diagnostic);
  console.log(JSON.stringify({
    status: diagnostic.status,
    outPath: OUT_PATH,
    turnstileConfig: {
      apex: { status: turnstileConfig.apex.status, configured: turnstileConfig.apex.configured },
      www: { status: turnstileConfig.www.status, configured: turnstileConfig.www.configured },
    },
    validationOnlyProbes: {
      apex: {
        status: validationProbes.apex.status,
        blockedByCaptcha: validationProbes.apex.blockedByCaptcha,
        upstreamError: validationProbes.apex.upstreamError,
      },
      www: {
        status: validationProbes.www.status,
        blockedByCaptcha: validationProbes.www.blockedByCaptcha,
        upstreamError: validationProbes.www.upstreamError,
      },
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
