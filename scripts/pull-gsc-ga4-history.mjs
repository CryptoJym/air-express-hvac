import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const DEFAULT_ACCOUNT = "newrewardplatform@gmail.com";
const GBP_SCOPE = "https://www.googleapis.com/auth/business.manage";
const DEFAULT_GSC_CANDIDATES = [
  "sc-domain:airexpressutah.com",
  "https://airexpressutah.com/",
  "https://www.airexpressutah.com/",
  "https://airexpresshvac.net/",
  "https://www.airexpresshvac.net/",
];
const DEFAULT_MILESTONES = [
  {
    id: "target_brief",
    date: "2026-03-12",
    label: "New Reward target brief",
    evidence: "NewRewards docs/reports/2026-03-12-airexpress-hvac-target-brief",
  },
  {
    id: "servicetitan_ga4_task",
    date: "2026-04-24",
    label: "ServiceTitan lead proof and GA4 install history",
    evidence: "Repo-local source check and ServiceTitan guide",
  },
  {
    id: "client_activation",
    date: "2026-04-29",
    label: "Air Express client activation correction",
    evidence: "NewRewards docs/plans/2026-04-29-contract-client-activation-failsafe.md",
  },
  {
    id: "edge_live_recheck",
    date: "2026-06-02",
    label: "New Reward edge and onboarding recheck",
    evidence: "Air Express onboarding control hub",
  },
  {
    id: "google_provider_proxy_fix",
    date: "2026-06-05",
    label: "New Reward Google provider bearer-token proxy fix",
    evidence: "NewRewards PR #4105 merged to main at bfa5fc67b2568fc337f1f5f4600a9e51b1525054; Vercel production deployment completed.",
  },
];
const LOCAL_PREPARED_ACTIONS = [
  {
    surface: "NewRewards credential resolver",
    status: "deployed_verified_newrewards",
    evidence:
      "GSC/GA4 services now prefer exact website credentials and then fall back to known aliases or tenant-wide saved credentials. GitHub read-only verification shows h3ro-dev/NewRewards PR #3834 merged to main at c83c2f0e859b8165fa1d191f6ed7d0d53ceda75f on 2026-06-03T13:33:04Z with green targeted QA/preview gates; GitHub deployment 4919441936 for the same SHA reached Production success on Vercel at 2026-06-03T13:36:03Z, and Railway production deployment 4919401175 recorded success states before later inactive lifecycle statuses.",
    nextAction:
      "Recheck Air Express setup/status from the live New Reward app without mutating providers; current local history pull remains blocked by missing Google read scopes, expired GSC/GA4 provider rows, missing GA4 property id, and Air Express live delivery sync.",
  },
  {
    surface: "NewRewards Google provider proxy",
    status: "deployed_verified_newrewards",
    evidence:
      "NewRewards PR #4105 added explicit same-origin /api/gsc, /api/ga4, and /api/gbp proxy routes through the auth bridge after Air Express reconnect attempts reported missing bearer-token behavior. PR #4105 merged to main at bfa5fc67b2568fc337f1f5f4600a9e51b1525054 on 2026-06-05T16:28:13Z; post-merge Vercel status reached success, and Railway statuses reported success/no deployment needed for watched paths.",
    nextAction:
      "Retry Air Express GSC, GA4, and GBP reconnect from an authenticated New Reward app session for website cmorqbs9j001r5nr1h25vosp8. If provider reads still fail, treat the remaining blocker as Google scope/property/provider state, not frontend bearer-token forwarding.",
  },
];
const EVIDENCE_STATE_MODEL = [
  {
    state: "verified",
    meaning: "Directly checked in this pass through local files, public HTTP, GitHub status, sanitized mailbox evidence, or a read-only command output.",
    currentUse:
      "PR #3834 resolver proof, PR #4105 Google provider proxy proof, local GA4 source coverage, sanitized token-scope inventory, and ServiceTitan prior lead proof.",
  },
  {
    state: "inferred",
    meaning: "Likely from multiple sources but not dashboard/API-proven for the current provider surface.",
    currentUse:
      "GSC/GA4 assets likely exist or existed from setup notes, but property visibility is not proven until scoped access is restored.",
  },
  {
    state: "prepared",
    meaning: "Repo-local source, packet, command, or report path is ready but has not been executed against the live/provider surface.",
    currentUse:
      "Google read-only reconnect packet, mapping reconciliation packet, local GA4 source, lead event source, and content/social drafts.",
  },
  {
    state: "blocked",
    meaning: "Cannot complete without access, scope, source mapping, live delivery, or owner/export proof.",
    currentUse:
        "GSC/GA4/GBP history pull, expired Air Express provider reconnect, live measurement sync, and lead-system health verification.",
  },
  {
    state: "not_attempted",
    meaning: "Intentionally skipped because it would mutate providers, publish content, send externally, create real CRM records, or require approval.",
    currentUse:
      "OAuth consent, Google provider reconnect/save, GTM publish, DNS/Vercel/Cloudflare changes, ServiceTitan live test lead/export, public posts, and outbound sends.",
  },
];
const DEFAULT_GBP_METRICS = ["WEBSITE_CLICKS", "CALL_CLICKS"];
const REQUIRED_SCOPES = Object.freeze({
  gsc: "https://www.googleapis.com/auth/webmasters.readonly",
  ga4: "https://www.googleapis.com/auth/analytics.readonly",
  gbp: GBP_SCOPE,
});
const AI_PROMPT_REVIEW_ROWS = [
  {
    area: "Current winning prompts",
    state: "partially_right",
    evidence: "Observed Air Express mentions/citations are concentrated in comparison, trust, qualification, and cooling-provider prompts.",
    recommendation: "Keep these prompts, but rewrite awkward proof phrases into natural consumer language.",
  },
  {
    area: "Natural local intent",
    state: "undercovered",
    evidence: "The current top prompt includes unnatural wording like family owned and locally rooted 1996, which is more like an internal proof fragment than a homeowner question.",
    recommendation: "Ask questions in the way a homeowner would ask: near me, reviews, emergency repair, cost, same day, and which company should I call.",
  },
  {
    area: "High-intent service needs",
    state: "undercovered",
    evidence: "Cooling comparison is represented, but emergency AC repair, furnace repair, AC installation, HVAC maintenance, heat pump, indoor air quality, and thermostat problems need stronger coverage.",
    recommendation: "Maintain a fixed weekly prompt set by service line, urgency, city, and decision stage.",
  },
  {
    area: "Competitor contrast",
    state: "missing_or_thin",
    evidence: "The current saved mention/citation rows do not show competitor-comparison prompts as a first-class test set.",
    recommendation: "Add prompts comparing Air Express against named competitors and auto-selected local competitors, then report share of answer and citation share.",
  },
  {
    area: "Engine diversity",
    state: "needs_improvement",
    evidence: "Perplexity accounts for all observed mentions/citations; ChatGPT, Claude, Google AI, Grok, Google AI Overview, and Copilot currently show zero observed mentions/citations.",
    recommendation: "Keep engine-level reporting and adjust prompts/content so other engines receive cleaner entity, service-area, proof, and review signals.",
  },
];
const RECOMMENDED_AI_PROMPT_ROWS = [
  {
    category: "Emergency near-me",
    prompt: "Who offers same-day AC repair near me in Lehi, Utah?",
    purpose: "Tests urgent local homeowner intent.",
  },
  {
    category: "Repair symptom",
    prompt: "Why is my AC running but not cooling my house in Lehi, Utah, and who should I call?",
    purpose: "Tests symptom-to-provider recommendations.",
  },
  {
    category: "Cost",
    prompt: "How much does AC repair usually cost in Utah County?",
    purpose: "Tests price-sensitive research and citation opportunities.",
  },
  {
    category: "Replacement",
    prompt: "Should I repair or replace an old air conditioner in Lehi, Utah?",
    purpose: "Tests high-value replacement decision support.",
  },
  {
    category: "Reviews",
    prompt: "Which HVAC companies in Lehi have strong reviews for honest service?",
    purpose: "Tests reputation and trust positioning.",
  },
  {
    category: "Brand",
    prompt: "Is Air Express Heating and Air Conditioning a good HVAC company in Lehi?",
    purpose: "Tests direct brand/entity confidence.",
  },
  {
    category: "Competitor",
    prompt: "How does Air Express compare with other HVAC companies in Lehi and Utah County?",
    purpose: "Tests competitive contrast and answer-share.",
  },
  {
    category: "Indoor air quality",
    prompt: "Who can help improve indoor air quality and filtration for a home in Lehi?",
    purpose: "Tests non-breakfix service expansion.",
  },
  {
    category: "Seasonal",
    prompt: "What HVAC maintenance should I do before the first hot week in Utah County?",
    purpose: "Tests blog/newsfeed content impact.",
  },
  {
    category: "Proof",
    prompt: "What proof should I ask for before hiring an HVAC contractor in Utah County?",
    purpose: "Tests licensed, local, family-owned, and trust proof without awkward phrasing.",
  },
];

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const next = process.argv[index + 1];
  return next && !next.startsWith("--") ? next : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function isoDateDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function addMonths(date, months) {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function defaultGscStart() {
  const date = addMonths(new Date(), -16);
  return date.toISOString().slice(0, 10);
}

function defaultGa4Start() {
  return "2020-01-01";
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const string = String(value);
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

function writeCsv(path, rows, headers) {
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];
  writeFileSync(path, `${lines.join("\n")}\n`);
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
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
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.length > 0)) rows.push(row);
  if (!rows.length) return [];

  const [headers, ...records] = rows;
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""]))
  );
}

function readCsv(path) {
  if (!existsSync(path)) return [];
  return parseCsv(readFileSync(path, "utf8"));
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function redactPropertyId(value = "") {
  if (!value) return "";
  return `sha256:${sha256(value).slice(0, 16)}`;
}

function getAccessToken(account, source = "gcloud") {
  const args = source === "adc"
    ? ["auth", "application-default", "print-access-token"]
    : ["auth", "print-access-token", "--account", account];
  const result = spawnSync("gcloud", args, { encoding: "utf8" });
  if (result.status !== 0) {
    return {
      ok: false,
      source,
      blocker: result.stderr.trim().split("\n")[0] || "gcloud token unavailable",
    };
  }
  return { ok: true, source, token: result.stdout.trim() };
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
  return { ok: response.ok, status: response.status, json };
}

async function tokenInfo(token) {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
  );
  const json = await response.json().catch(() => ({}));
  const scopes = String(json.scope || "")
    .split(/\s+/)
    .filter(Boolean);
  return {
    ok: response.ok,
    email: json.email || "",
    scopes,
    error: json.error_description || json.error || "",
  };
}

function scopeState(scopes) {
  const hasGsc = scopes.includes(REQUIRED_SCOPES.gsc);
  const hasGa4 =
    scopes.includes(REQUIRED_SCOPES.ga4) ||
    scopes.includes("https://www.googleapis.com/auth/analytics");
  const hasGbp = scopes.includes(REQUIRED_SCOPES.gbp);
  return { hasGsc, hasGa4, hasGbp };
}

function sanitizeScopes(scopes = []) {
  return scopes
    .filter((scope) => /^https:\/\/www\.googleapis\.com\/auth\/[A-Za-z0-9._/-]+$/.test(scope) || scope === "openid")
    .sort();
}

function missingRequiredScopes(scopeFlags, { includeGbp = true } = {}) {
  return [
    ...(!scopeFlags.hasGsc ? [REQUIRED_SCOPES.gsc] : []),
    ...(!scopeFlags.hasGa4 ? [REQUIRED_SCOPES.ga4] : []),
    ...(includeGbp && !scopeFlags.hasGbp ? [REQUIRED_SCOPES.gbp] : []),
  ];
}

function requiredScopes({ includeGbp = true } = {}) {
  return includeGbp
    ? REQUIRED_SCOPES
    : {
      gsc: REQUIRED_SCOPES.gsc,
      ga4: REQUIRED_SCOPES.ga4,
    };
}

function scopeTextForCurrentPass(value = "", { includeGbp = true } = {}) {
  if (includeGbp) return value;
  return String(value || "")
    .replaceAll("GSC/GA4/GBP", "GSC/GA4")
    .replaceAll("GSC, GA4, and GBP", "GSC and GA4")
    .replaceAll("Search Console, GA4, and Google Business Profile", "Search Console and GA4")
    .replaceAll("GSC, GA4, GBP, ", "GSC, GA4, ")
    .replaceAll("GSC, GA4, and GBP access", "GSC and GA4 access")
    .replaceAll(", GBP location/provider proof is still missing", "")
    .replaceAll("GBP location/provider proof is still missing, ", "")
    .replaceAll(" and GBP", "")
    .replaceAll(", GBP", "")
    .replaceAll("GA4 propertyId is null location/provider proof is still missing, ", "GA4 propertyId is null, ")
    .replaceAll("GA4 propertyId is null location/provider proof is still missing", "GA4 propertyId is null")
    .replaceAll("GBP, ", "");
}

function scopedTokenRepairAttempt(attempt, { includeGbp = true } = {}) {
  if (!attempt || includeGbp) return attempt;
  const scopedAttempt = JSON.parse(JSON.stringify(attempt));
  scopedAttempt.rootCause = scopeTextForCurrentPass(scopedAttempt.rootCause, { includeGbp });
  scopedAttempt.nextAction = scopeTextForCurrentPass(scopedAttempt.nextAction, { includeGbp });
  scopedAttempt.requiredScopes = requiredScopes({ includeGbp });
  if (Array.isArray(scopedAttempt.currentTokenState?.missingRequiredScopes)) {
    scopedAttempt.currentTokenState.missingRequiredScopes =
      scopedAttempt.currentTokenState.missingRequiredScopes.filter((scope) => scope !== REQUIRED_SCOPES.gbp);
  }
  scopedAttempt.safeReconnectCommand = "gcloud auth application-default login newrewardplatform@gmail.com --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/webmasters.readonly,https://www.googleapis.com/auth/analytics.readonly,openid,https://www.googleapis.com/auth/userinfo.email --disable-quota-project";
  scopedAttempt.attempts = Array.isArray(scopedAttempt.attempts)
    ? scopedAttempt.attempts.map((item) => ({
      ...item,
      action: scopeTextForCurrentPass(item.action, { includeGbp }),
      evidence: scopeTextForCurrentPass(item.evidence, { includeGbp }),
      nextAction: scopeTextForCurrentPass(item.nextAction, { includeGbp }),
      scopes: Array.isArray(item.scopes)
        ? item.scopes.filter((scope) => scope !== REQUIRED_SCOPES.gbp)
        : item.scopes,
    }))
    : [];
  return scopedAttempt;
}

function summarizeProviderRecheck(recheck = {}) {
  const rootCause = recheck.rootCauseSummary || {};
  const gsc = rootCause.gsc || {};
  const ga4 = rootCause.ga4 || {};
  return {
    status: recheck.status || "not_checked",
    canonicalWebsiteId: rootCause.canonicalWebsiteId || "",
    canonicalWebsiteStatus: rootCause.canonicalWebsiteStatus || "",
    providerEmail: rootCause.providerEmail || "",
    gsc: {
      credentialStatus: gsc.credentialStatus || "",
      connectionStatus: gsc.connectionStatus || "",
      siteUrl: gsc.siteUrl || "",
      tokenExpiresAt: gsc.tokenExpiresAt || "",
    },
    ga4: {
      credentialStatus: ga4.credentialStatus || "",
      connectionStatus: ga4.connectionStatus || "",
      propertyIdPresent: Boolean(ga4.propertyId),
      tokenExpiresAt: ga4.tokenExpiresAt || "",
    },
    blockers: Array.isArray(rootCause.blockers) ? rootCause.blockers : [],
  };
}

async function getBestToken(account) {
  const candidates = [];
  for (const source of ["gcloud", "adc"]) {
    const token = getAccessToken(account, source);
    if (!token.ok) {
      candidates.push({
        ok: false,
        source,
        blocker: token.blocker,
        info: { scopes: [] },
        scopes: { hasGsc: false, hasGa4: false },
      });
      continue;
    }
    const info = await tokenInfo(token.token);
    const scopes = scopeState(info.scopes);
    candidates.push({ ...token, info, scopes });
  }
  const scoped = candidates.find((candidate) =>
    candidate.scopes.hasGsc || candidate.scopes.hasGa4 || candidate.scopes.hasGbp
  );
  return { selected: scoped || candidates[0], candidates };
}

async function listGscSites(token) {
  const result = await googleJson("https://www.googleapis.com/webmasters/v3/sites", token);
  if (!result.ok || result.json.error) {
    return {
      ok: false,
      blocker: result.json.error?.message || `Search Console sites request failed with ${result.status}`,
      sites: [],
    };
  }
  return {
    ok: true,
    sites: (result.json.siteEntry || []).map((site) => ({
      siteUrl: site.siteUrl,
      permissionLevel: site.permissionLevel,
    })),
  };
}

function selectGscProperty(sites, explicitProperty) {
  if (explicitProperty) return sites.find((site) => site.siteUrl === explicitProperty) || null;
  return DEFAULT_GSC_CANDIDATES.map((candidate) =>
    sites.find((site) => site.siteUrl === candidate),
  ).find(Boolean) || null;
}

async function queryGsc(token, siteUrl, startDate, endDate, dimensions = ["date"]) {
  const rows = [];
  let startRow = 0;
  const rowLimit = 25000;
  while (true) {
    const result = await googleJson(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions,
          rowLimit,
          startRow,
          dataState: "final",
        }),
      },
    );
    if (!result.ok || result.json.error) {
      return {
        ok: false,
        blocker: result.json.error?.message || `Search Analytics query failed with ${result.status}`,
        rows,
      };
    }
    const batch = result.json.rows || [];
    rows.push(...batch);
    if (batch.length < rowLimit) break;
    startRow += rowLimit;
  }
  return { ok: true, rows };
}

function normalizeGscRows(rows, dimensions) {
  return rows.map((row) => {
    const item = {
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    };
    dimensions.forEach((dimension, index) => {
      item[dimension] = row.keys?.[index] || "";
    });
    return item;
  });
}

async function listGa4Properties(token) {
  const result = await googleJson("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", token);
  if (!result.ok || result.json.error) {
    return {
      ok: false,
      blocker: result.json.error?.message || `Analytics Admin request failed with ${result.status}`,
      properties: [],
    };
  }
  const properties = (result.json.accountSummaries || []).flatMap((account) =>
    (account.propertySummaries || []).map((property) => ({
      account: account.account,
      accountDisplayName: account.displayName,
      property: property.property,
      propertyId: property.property?.split("/").pop() || "",
      displayName: property.displayName,
      propertyType: property.propertyType,
    })),
  );
  return { ok: true, properties };
}

async function listGbpAccounts(token) {
  const result = await googleJson("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", token);
  if (!result.ok || result.json.error) {
    return {
      ok: false,
      blocker: result.json.error?.message || `Business Profile accounts request failed with ${result.status}`,
      accounts: [],
    };
  }
  return { ok: true, accounts: result.json.accounts || [] };
}

async function listGbpLocations(token, accountName) {
  const readMask = [
    "name",
    "title",
    "websiteUri",
    "storefrontAddress",
    "phoneNumbers",
    "metadata",
  ].join(",");
  const result = await googleJson(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=${encodeURIComponent(readMask)}`,
    token,
  );
  if (!result.ok || result.json.error) {
    return {
      ok: false,
      blocker: result.json.error?.message || `Business Profile locations request failed with ${result.status}`,
      locations: [],
    };
  }
  return {
    ok: true,
    locations: (result.json.locations || []).map((location) => ({ ...location, accountName })),
  };
}

function selectGbpLocation(locations) {
  return locations.find((location) =>
    /air\s*express|airexpress|air-express/i.test(
      `${location.title || ""} ${location.websiteUri || ""} ${location.metadata?.placeId || ""}`,
    ),
  ) || null;
}

function dateQuery(prefix, isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return [
    [`${prefix}.year`, year],
    [`${prefix}.month`, month],
    [`${prefix}.day`, day],
  ];
}

function gbpPerformanceLocationName(locationName = "") {
  const match = /locations\/([^/]+)$/.exec(locationName);
  return match ? `locations/${match[1]}` : locationName;
}

async function queryGbpPerformance(token, locationName, startDate, endDate) {
  const params = new URLSearchParams();
  for (const metric of DEFAULT_GBP_METRICS) params.append("dailyMetrics", metric);
  for (const [key, value] of [
    ...dateQuery("dailyRange.start_date", startDate),
    ...dateQuery("dailyRange.end_date", endDate),
  ]) {
    params.set(key, String(value));
  }
  const performanceLocation = gbpPerformanceLocationName(locationName);
  const result = await googleJson(
    `https://businessprofileperformance.googleapis.com/v1/${performanceLocation}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`,
    token,
  );
  if (!result.ok || result.json.error) {
    return {
      ok: false,
      blocker: result.json.error?.message || `Business Profile performance request failed with ${result.status}`,
      rows: [],
    };
  }

  const rows = [];
  for (const group of result.json.multiDailyMetricTimeSeries || []) {
    for (const series of group.dailyMetricTimeSeries || []) {
      for (const point of series.timeSeries?.datedValues || []) {
        const date = point.date
          ? `${String(point.date.year).padStart(4, "0")}-${String(point.date.month).padStart(2, "0")}-${String(point.date.day).padStart(2, "0")}`
          : "";
        rows.push({
          date,
          metric: series.dailyMetric || "",
          value: Number(point.value || 0),
        });
      }
    }
  }
  return { ok: true, rows };
}

function selectGa4Property(properties, explicitPropertyId) {
  if (explicitPropertyId) {
    return properties.find((property) => property.propertyId === explicitPropertyId) || {
      property: `properties/${explicitPropertyId}`,
      propertyId: explicitPropertyId,
      displayName: "(explicit property id)",
      accountDisplayName: "",
    };
  }
  return properties.find((property) =>
    /air\s*express|airexpress|air-express/i.test(
      `${property.accountDisplayName} ${property.displayName}`,
    ),
  ) || null;
}

async function queryGa4(token, propertyId, startDate, endDate, dimensions, metrics) {
  const rows = [];
  let offset = 0;
  const limit = 100000;
  while (true) {
    const result = await googleJson(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: dimensions.map((name) => ({ name })),
          metrics: metrics.map((name) => ({ name })),
          limit: String(limit),
          offset: String(offset),
        }),
      },
    );
    if (!result.ok || result.json.error) {
      return {
        ok: false,
        blocker: result.json.error?.message || `GA4 runReport failed with ${result.status}`,
        rows,
      };
    }
    const batch = result.json.rows || [];
    rows.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return { ok: true, rows };
}

function normalizeGa4Rows(rows, dimensions, metrics) {
  return rows.map((row) => {
    const item = {};
    dimensions.forEach((dimension, index) => {
      const value = row.dimensionValues?.[index]?.value || "";
      item[dimension] =
        dimension === "date" && /^\d{8}$/.test(value)
          ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
          : value;
    });
    metrics.forEach((metric, index) => {
      item[metric] = Number(row.metricValues?.[index]?.value || 0);
    });
    return item;
  });
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

function average(rows, field) {
  return rows.length ? sum(rows, field) / rows.length : 0;
}

function inRange(date, start, end) {
  return date >= start && date <= end;
}

function periodSummaries({ gscDaily, ga4Daily, endDate }) {
  const periods = [
    { id: "pre_target", label: "Before target brief", start: "2020-01-01", end: "2026-03-11" },
    { id: "target_to_install", label: "Target brief to GA4/lead proof", start: "2026-03-12", end: "2026-04-23" },
    { id: "post_install", label: "After GA4/lead proof", start: "2026-04-24", end: endDate },
  ];
  return periods.map((period) => {
    const gsc = gscDaily.filter((row) => inRange(row.date, period.start, period.end));
    const ga4 = ga4Daily.filter((row) => inRange(row.date, period.start, period.end));
    return {
      ...period,
      days: new Set([...gsc.map((row) => row.date), ...ga4.map((row) => row.date)]).size,
      gscClicks: sum(gsc, "clicks"),
      gscImpressions: sum(gsc, "impressions"),
      gscAverageCtr: average(gsc, "ctr"),
      gscAveragePosition: average(gsc, "position"),
      ga4Sessions: sum(ga4, "sessions"),
      ga4Users: sum(ga4, "totalUsers"),
      ga4Events: sum(ga4, "eventCount"),
      ga4Conversions: sum(ga4, "conversions"),
      ga4AverageEngagementRate: average(ga4, "engagementRate"),
    };
  });
}

function formatInteger(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDecimal(value, digits = 1) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number(value || 0));
}

function formatPercent(value, digits = 1) {
  return `${formatDecimal(Number(value || 0) * 100, digits)}%`;
}

function safeRate(numerator, denominator) {
  const total = Number(denominator || 0);
  return total ? Number(numerator || 0) / total : 0;
}

function formatSignedInteger(value) {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${formatInteger(number)}`;
}

function formatSignedDecimal(value, digits = 1) {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${formatDecimal(number, digits)}`;
}

function weekStart(date = "") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = new Date(`${date}T00:00:00Z`);
  const offset = (parsed.getUTCDay() + 6) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - offset);
  return parsed.toISOString().slice(0, 10);
}

function weeklyTotals(rows, field) {
  const byWeek = new Map();
  for (const row of rows) {
    const key = weekStart(row.date);
    if (!key) continue;
    byWeek.set(key, (byWeek.get(key) || 0) + Number(row[field] || 0));
  }
  return [...byWeek.entries()]
    .map(([week, value]) => ({ week, value }))
    .sort((left, right) => left.week.localeCompare(right.week));
}

function firstAndLastWeekly(rows, field) {
  const weeks = weeklyTotals(rows, field).filter((item) => item.value > 0);
  return {
    first: weeks[0] || null,
    last: weeks.at(-1) || null,
  };
}

function topRows(rows, metric, limit = 5) {
  return [...rows]
    .sort((left, right) => Number(right[metric] || 0) - Number(left[metric] || 0))
    .slice(0, limit);
}

function distinctGscSnapshots(rows = []) {
  const byKey = new Map();
  for (const row of rows) {
    const key = [
      row.dateRange?.start || "",
      row.dateRange?.end || "",
      row.total_clicks || 0,
      row.total_impressions || 0,
      row.row_count || 0,
      row.average_ctr || 0,
      row.average_position || 0,
    ].join("|");
    byKey.set(key, row);
  }
  return [...byKey.values()].sort((left, right) =>
    String(left.createdAt || "").localeCompare(String(right.createdAt || ""))
  );
}

function signedPercent(value, digits = 1) {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${formatPercent(number, digits)}`;
}

function lowerPositionRead(previous, current) {
  const delta = Number(current || 0) - Number(previous || 0);
  if (!previous || !current) return "Pending stronger query-level sync.";
  if (delta < 0) return "Average position improved; lower is better.";
  if (delta > 0) return "Average position broadened/worsened; inspect query mix before claiming ranking lift.";
  return "Average position held steady.";
}

function buildClientFriendlySummary({
  status,
  gscDaily,
  gscQuery,
  ga4Daily,
  ga4Channel,
  ga4Event,
  summaries,
  serviceTitan,
}) {
  const hasGsc = gscDaily.length > 0;
  const hasGa4 = ga4Daily.length > 0;
  const weeklyClicks = firstAndLastWeekly(gscDaily, "clicks");
  const topQueries = topRows(gscQuery, "clicks", 8)
    .filter((row) => row.query)
    .map((row) => ({
      query: row.query,
      clicks: Number(row.clicks || 0),
      impressions: Number(row.impressions || 0),
      position: Number(row.position || 0),
    }));
  const organicSearchRows = ga4Channel.filter((row) =>
    /organic search/i.test(String(row.sessionDefaultChannelGroup || "")),
  );
  const formOrLeadEvents = ga4Event.filter((row) =>
    /form|lead|submit|conversion|contact|phone|call/i.test(String(row.eventName || "")),
  );
  const latestPeriod = [...summaries].reverse().find((period) =>
    Number(period.gscClicks || 0) || Number(period.ga4Sessions || 0),
  ) || summaries.at(-1) || null;
  const previousPeriod = summaries.find((period) => period !== latestPeriod && (
    Number(period.gscClicks || 0) || Number(period.ga4Sessions || 0)
  )) || null;
  const trendSignals = [];

  if (weeklyClicks.first && weeklyClicks.last) {
    trendSignals.push(
      `Weekly Google clicks moved from ${formatInteger(weeklyClicks.first.value)} in the first stored week (${weeklyClicks.first.week}) to ${formatInteger(weeklyClicks.last.value)} in the latest stored week (${weeklyClicks.last.week}).`,
    );
  }
  if (previousPeriod && latestPeriod) {
    trendSignals.push(
      `Period comparison: ${previousPeriod.label} had ${formatInteger(previousPeriod.gscClicks)} GSC clicks and ${formatInteger(previousPeriod.ga4Sessions)} GA4 sessions; ${latestPeriod.label} has ${formatInteger(latestPeriod.gscClicks)} GSC clicks and ${formatInteger(latestPeriod.ga4Sessions)} GA4 sessions.`,
    );
  }

  const plainEnglish = hasGsc || hasGa4
    ? [
      "Air Express visibility can now be discussed from pulled Google data, with ServiceTitan lead-count history used as the current outcome context.",
      trendSignals.length
        ? trendSignals.join(" ")
        : "The pulled data is available, but the trend window is too thin to make a strong directional statement yet.",
    ].join(" ")
    : "The client-friendly attribution summary is ready, but the Google history is not pulled yet. After reconnect, it will report Google appearances, clicks, weekly click trend, average position, GA4 sessions, organic-search engagement, conversion events, and ServiceTitan lead proof by milestone period.";

  return {
    status: hasGsc || hasGa4 ? "data_available" : "blocked_pending_google_reconnect",
    plainEnglish,
    googleSearch: {
      status: hasGsc ? "pulled" : "blocked_pending_scope",
      clicks: sum(gscDaily, "clicks"),
      impressions: sum(gscDaily, "impressions"),
      averageCtr: average(gscDaily, "ctr"),
      averagePosition: average(gscDaily, "position"),
      firstStoredWeekClicks: weeklyClicks.first,
      latestStoredWeekClicks: weeklyClicks.last,
      topQueries,
    },
    websiteEngagement: {
      status: hasGa4 ? "pulled" : "blocked_pending_scope",
      sessions: sum(ga4Daily, "sessions"),
      users: sum(ga4Daily, "totalUsers"),
      organicSearchSessions: sum(organicSearchRows, "sessions"),
      averageEngagementRate: average(ga4Daily, "engagementRate"),
      conversions: sum(ga4Daily, "conversions"),
      conversionOrLeadEvents: topRows(formOrLeadEvents, "eventCount", 8).map((row) => ({
        eventName: row.eventName,
        eventCount: Number(row.eventCount || 0),
        users: Number(row.totalUsers || 0),
      })),
    },
    aiSearchVisibility: {
      status: "not_pulled_in_this_lane",
      evidence:
        "This Air Express pull currently covers direct Google history, live tag, and ServiceTitan proof. AI mention/citation trend needs New Reward AI visibility run history for Air Express.",
      nextAction:
        "After Google reconnect, pull or export Air Express AI visibility run history with run count, tested questions, engines, mention rate, citation rate, and cited questions.",
    },
    leadProof: {
      status: serviceTitan.priorProofStatus,
      verifiedCount: serviceTitan.verifiedCount,
      listedLeadCount: serviceTitan.listedLeadCount,
      importedLeadCount: serviceTitan.importedLeadCount,
      apiLeadCount: serviceTitan.apiLeadCount,
      websiteCampaignLeadCount: serviceTitan.websiteCampaignLeadCount,
      bookedLeadCount: serviceTitan.bookedLeadCount,
      apiCountsByImpactPeriod: serviceTitan.apiCountsByImpactPeriod,
      apiCountsByWeek: serviceTitan.apiCountsByWeek,
      apiCountsByStatus: serviceTitan.apiCountsByStatus,
      apiCountsByServiceType: serviceTitan.apiCountsByServiceType,
      apiCompleteWeeklyTrend: serviceTitan.apiCompleteWeeklyTrend,
      captcha: serviceTitan.captcha,
      qualityProxyByCaptchaPeriod: serviceTitan.qualityProxyByCaptchaPeriod,
      attributionJoinProbe: serviceTitan.attributionJoinProbe,
      caveat:
        "This report intentionally uses lead-count history only. Booking and revenue joins are out of scope for the current Air Express report.",
    },
  };
}

function loadServiceTitanLeadProof() {
  const exportStatus = readJson(join(root, "data/servicetitan-export-access-check.json"), {});
  const redactedImportStatus = readJson(join(root, "data/servicetitan-redacted-export-import-status.json"), {});
  const priorRows = readCsv(join(root, "data/servicetitan-prior-proof-summary.csv"));
  const leadRows = readCsv(join(root, "data/servicetitan-lead-history.csv"));
  const importedRows = readCsv(join(root, "data/servicetitan-redacted-export-import.csv"));
  const apiRows = readCsv(join(root, "data/servicetitan-api-lead-history-redacted.csv"));
  const apiSummary = readJson(join(root, "data/servicetitan-api-lead-history-summary.json"), {});
  const joinProbe = readJson(join(root, "data/servicetitan-attribution-join-probe.json"), {});
  const prior = priorRows[0] || {};
  const campaignIds = Array.from(
    new Set(
      [...priorRows, ...leadRows, ...importedRows, ...apiRows]
        .map((row) => row.campaign_id || row.campaign_id_or_source || "")
        .filter(Boolean)
    )
  );
  const apiLeadCount = Number(apiSummary.rows || 0) || apiRows.length;
  const websiteCampaignLeadCount = Number(apiSummary.websiteCampaignLeadCount || 0);
  const bookedLeadCount = Number(apiSummary.bookedLeadCount || 0);
  const verifiedCount = apiLeadCount || Number(prior.verified_count || 0) || leadRows.length;
  const listedLeadCount = new Set([...leadRows, ...apiRows].map((row) => row.service_titan_lead_id).filter(Boolean)).size;
  const importedLeadCount = new Set(importedRows.map((row) => row.service_titan_lead_id).filter(Boolean)).size;
  const piiExcluded = [...priorRows, ...leadRows, ...importedRows, ...apiRows].every((row) => row.pii_excluded === "true");
  const firstBlocker = Array.isArray(exportStatus.blockers) ? exportStatus.blockers[0] : null;
  const importStatus = redactedImportStatus.status || "not_attempted";
  const importEvidence = importedRows.length
    ? `Imported ${importedRows.length} approved redacted ServiceTitan lead row(s), with ${importedLeadCount} listed lead id(s), safe campaign/source fields, and customer PII excluded.`
    : `Redacted ServiceTitan export import is ${importStatus}; template ${redactedImportStatus.templatePath || "data/servicetitan-redacted-export-template.csv"} is prepared.`;
  const apiEvidence = apiLeadCount
    ? `Read-only ServiceTitan API pull returned ${apiLeadCount} redacted lead row(s) from ${apiSummary.requestedRange?.startDate || "unknown"} to ${apiSummary.requestedRange?.endDate || "unknown"}; ${websiteCampaignLeadCount} row(s) match configured website campaign ${campaignIds.includes("80365413") ? "80365413" : "unknown"}; customer PII and raw payloads are excluded.`
    : "";
  const joinProbes = Array.isArray(joinProbe.probes) ? joinProbe.probes : [];
  const bookingProbe = joinProbes.find((probe) => probe.surface === "CRM export bookings") || null;
  const blockedJoinSurfaces = joinProbes.filter((probe) => probe.status === "blocked");
  const joinProbeEvidence = joinProbe.status
    ? `Read-only join probe from ${joinProbe.requested?.from || "unknown"} found CRM export bookings readable with ${Number(bookingProbe?.rowCount || 0)} row(s), while ${blockedJoinSurfaces.map((probe) => `${probe.surface} (${probe.httpStatus})`).join(", ") || "no join surfaces"} remain blocked.`
    : "No ServiceTitan booking/revenue join probe is required for this lead-count report.";
  const joinProbeNextAction = joinProbe.status
    ? "Keep booking/revenue joins out of scope unless James re-approves that lane."
    : "Keep booking/revenue joins out of scope unless James re-approves that lane.";

  return {
    status: exportStatus.status || "unknown",
    priorProofStatus: apiLeadCount ? "api_history_pulled" : priorRows.length || leadRows.length ? "partial_prior_proof" : "not_attempted",
    verifiedCount,
    listedLeadCount,
    importedLeadCount,
    apiLeadCount,
    websiteCampaignLeadCount,
    bookedLeadCount,
    apiStatus: apiSummary.status || "not_pulled",
    apiCountsByImpactPeriod: apiSummary.countsByImpactPeriod || {},
    apiCountsByWeek: apiSummary.countsByWeek || {},
    apiCountsByMonth: apiSummary.countsByMonth || {},
    apiCountsByStatus: apiSummary.countsByStatus || {},
    apiCountsByServiceType: apiSummary.countsByServiceType || {},
    apiWebsiteCampaignCountsByServiceType: apiSummary.websiteCampaignCountsByServiceType || {},
    apiCompleteWeeklyTrend: Array.isArray(apiSummary.completeWeeklyTrend) ? apiSummary.completeWeeklyTrend : [],
    captcha: apiSummary.captcha || null,
    qualityProxyByCaptchaPeriod: apiSummary.qualityProxyByCaptchaPeriod || {},
    attributionJoinProbe: {
      status: joinProbe.status || "not_attempted",
      from: joinProbe.requested?.from || "",
      readableSurfaces: joinProbe.summary?.readableSurfaces || [],
      blockedSurfaces: joinProbe.summary?.blockedSurfaces || [],
      bookingRowCount: Number(bookingProbe?.rowCount || 0),
      evidence: joinProbeEvidence,
      nextAction: joinProbeNextAction,
    },
    campaignIds,
    piiExcluded,
    evidence: apiEvidence || (priorRows.length || leadRows.length
      ? `Prior sanitized proof records ${verifiedCount} website lead(s) on 2026-04-24, with ${listedLeadCount} listed lead id(s), campaign ${campaignIds.join(";") || "unknown"}, and customer PII excluded.`
      : "No ServiceTitan lead proof rows are present in repo-local evidence."),
    redactedImportStatus: importStatus,
    redactedImportEvidence: importEvidence,
    redactedImportNextAction:
      redactedImportStatus.nextAction ||
      "Import an approved redacted export with npm run import:servicetitan-redacted-export -- --input <csv>.",
    blocker: apiLeadCount
      ? "Lead history is pulled. Current remaining lead-system questions are the missing post-May-18 lead weeks, missing live Turnstile configuration, and split canonical/www delivery path."
      : firstBlocker?.evidence || "Full ServiceTitan history is not available from current local evidence.",
    nextAction:
      apiLeadCount
        ? "Use lead counts for trend comparison, repair live CAPTCHA/canonical delivery, and keep booking/revenue joins out of scope unless James re-approves that lane."
        : firstBlocker?.nextAction ||
          "Provide approved read-only ServiceTitan export/API access or a redacted screenshot/export packet before joining leads by period.",
    exportEvidenceClass: exportStatus.evidenceClass || "",
    authCheck: exportStatus.authCheck || "not_attempted",
  };
}

function loadNewRewardSnapshotHistory() {
  const snapshotPath = join(root, "data/google-history/newreward-snapshot-history.json");
  const snapshot = readJson(snapshotPath, null);
  if (!snapshot) {
    return {
      status: "not_pulled",
      evidence: "Run npm run pull:newreward-attribution-history to check saved New Reward snapshots.",
      path: snapshotPath,
    };
  }
  return {
    ...snapshot,
    path: snapshotPath,
  };
}

function applySavedSnapshotSummary(clientSummary, snapshotHistory) {
  if (snapshotHistory?.status !== "saved_snapshot_history_available") return clientSummary;

  const latestGsc = snapshotHistory.gscSnapshotSummary?.latest;
  const gscTrend = Array.isArray(snapshotHistory.gscSnapshotTrend)
    ? snapshotHistory.gscSnapshotTrend
    : [];
  const firstGsc = gscTrend[0] || null;
  const aiSnapshots = snapshotHistory.aiSnapshots;
  const aiRuns = snapshotHistory.aiRuns;
  const aiMetrics = snapshotHistory.aiMetrics;
  const latestCompletedAiRun = snapshotHistory.aiLatestCompletedRun || null;
  const hasSavedGsc = latestGsc && Number(snapshotHistory.gscSnapshotSummary?.rows || 0) > 0;
  const hasAi = aiSnapshots && Number(aiSnapshots.rows || 0) > 0;

  if (hasSavedGsc && clientSummary.googleSearch.status !== "pulled") {
    clientSummary.googleSearch = {
      ...clientSummary.googleSearch,
      status: "saved_snapshot_available",
      clicks: Number(latestGsc.total_clicks || 0),
      impressions: Number(latestGsc.total_impressions || 0),
      averageCtr: Number(latestGsc.average_ctr || 0),
      averagePosition: Number(latestGsc.average_position || 0),
      firstSavedSnapshot: firstGsc
        ? {
          clicks: Number(firstGsc.total_clicks || 0),
          impressions: Number(firstGsc.total_impressions || 0),
          averageCtr: Number(firstGsc.average_ctr || 0),
          averagePosition: Number(firstGsc.average_position || 0),
          rowsCaptured: Number(firstGsc.row_count || 0),
          dateRange: firstGsc.dateRange || null,
        }
        : null,
      latestSavedSnapshot: {
        clicks: Number(latestGsc.total_clicks || 0),
        impressions: Number(latestGsc.total_impressions || 0),
        averageCtr: Number(latestGsc.average_ctr || 0),
        averagePosition: Number(latestGsc.average_position || 0),
        rowsCaptured: Number(latestGsc.row_count || 0),
        dateRange: latestGsc.dateRange || null,
      },
      appearanceChange: firstGsc
        ? Number(latestGsc.total_impressions || 0) - Number(firstGsc.total_impressions || 0)
        : null,
      clickChange: firstGsc
        ? Number(latestGsc.total_clicks || 0) - Number(firstGsc.total_clicks || 0)
        : null,
      ctrChange: firstGsc
        ? Number(latestGsc.average_ctr || 0) - Number(firstGsc.average_ctr || 0)
        : null,
      positionChange: firstGsc
        ? Number(latestGsc.average_position || 0) - Number(firstGsc.average_position || 0)
        : null,
      rowCoverageChange: firstGsc
        ? Number(latestGsc.row_count || 0) - Number(firstGsc.row_count || 0)
        : null,
    };
  }

  if (hasAi) {
    const mentionRate = safeRate(aiSnapshots.mentions, aiSnapshots.rows);
    const citationRate = safeRate(aiSnapshots.citations, aiSnapshots.rows);
    const latestRunMentionRate = safeRate(latestCompletedAiRun?.mentions, latestCompletedAiRun?.snapshots);
    const latestRunCitationRate = safeRate(latestCompletedAiRun?.citations, latestCompletedAiRun?.snapshots);
    clientSummary.aiSearchVisibility = {
      status: "saved_snapshot_available",
      evidence:
        `${formatInteger(aiSnapshots.rows)} saved AI visibility snapshot(s), ${formatInteger(aiSnapshots.unique_queries)} unique question(s), ${formatInteger(aiRuns?.rows || 0)} run(s), ${formatInteger(aiSnapshots.mentions)} mention(s), and ${formatInteger(aiSnapshots.citations)} citation(s). Mention rate ${formatPercent(mentionRate)}; citation rate ${formatPercent(citationRate)}.`,
      snapshots: Number(aiSnapshots.rows || 0),
      uniqueQuestions: Number(aiSnapshots.unique_queries || 0),
      runs: Number(aiRuns?.rows || 0),
      engineCount: Number(aiSnapshots.engine_count || 0),
      mentions: Number(aiSnapshots.mentions || 0),
      citations: Number(aiSnapshots.citations || 0),
      mentionRate,
      citationRate,
      latestCompletedRun: latestCompletedAiRun
        ? {
          snapshots: Number(latestCompletedAiRun.snapshots || 0),
          uniqueQuestions: Number(latestCompletedAiRun.unique_queries || 0),
          engines: Number(latestCompletedAiRun.engine_count || 0),
          mentions: Number(latestCompletedAiRun.mentions || 0),
          citations: Number(latestCompletedAiRun.citations || 0),
          mentionRate: latestRunMentionRate,
          citationRate: latestRunCitationRate,
          completedAt: latestCompletedAiRun.completedAt || "",
        }
        : null,
      nextAction:
        aiMetrics?.rows
          ? "Use saved AI visibility snapshots for trend context; keep Google provider and canonical live-measurement caveats until owned analytics is available."
          : "Use saved AI visibility snapshots for trend context; pull score metrics when available.",
    };
  }

  if (hasSavedGsc || hasAi) {
    const savedBits = [];
    if (hasSavedGsc) {
      const range = latestGsc.dateRange
        ? `${latestGsc.dateRange.start} to ${latestGsc.dateRange.end}`
        : "the latest saved window";
      savedBits.push(
        `New Reward saved GSC evidence is available for ${range}: ${formatInteger(latestGsc.total_impressions)} appearances, ${formatInteger(latestGsc.total_clicks)} click(s), ${formatPercent(latestGsc.average_ctr)} CTR, and ${formatInteger(latestGsc.row_count)} captured query/page rows.`,
      );
      if (firstGsc) {
        savedBits.push(
          `Compared with the first saved GSC window, appearances changed ${formatSignedInteger(Number(latestGsc.total_impressions || 0) - Number(firstGsc.total_impressions || 0))}, clicks changed ${formatSignedInteger(Number(latestGsc.total_clicks || 0) - Number(firstGsc.total_clicks || 0))}, and captured row coverage changed ${formatSignedInteger(Number(latestGsc.row_count || 0) - Number(firstGsc.row_count || 0))}.`,
        );
      }
      const distinctTrend = distinctGscSnapshots(gscTrend);
      const previousGsc = distinctTrend.length > 1 ? distinctTrend.at(-2) : null;
      if (previousGsc) {
        savedBits.push(
          `Most recent saved movement is ${formatSignedInteger(Number(latestGsc.total_impressions || 0) - Number(previousGsc.total_impressions || 0))} appearances, ${formatSignedInteger(Number(latestGsc.total_clicks || 0) - Number(previousGsc.total_clicks || 0))} click(s), and average position ${formatDecimal(previousGsc.average_position, 1)} to ${formatDecimal(latestGsc.average_position, 1)}.`,
        );
      }
    }
    if (hasAi) {
      const weeks = Array.isArray(snapshotHistory.aiByWeek) ? snapshotHistory.aiByWeek : [];
      const latestWeek = weeks.at(-1);
      const previousWeek = weeks.length > 1 ? weeks.at(-2) : null;
      savedBits.push(
        `Saved AI visibility evidence includes ${formatInteger(aiSnapshots.rows)} answer snapshot(s), ${formatInteger(aiSnapshots.unique_queries)} unique question(s), ${formatInteger(aiSnapshots.mentions)} mention(s), ${formatInteger(aiSnapshots.citations)} citation(s), ${formatPercent(safeRate(aiSnapshots.mentions, aiSnapshots.rows))} mention rate, and ${formatPercent(safeRate(aiSnapshots.citations, aiSnapshots.rows))} citation rate.`,
      );
      if (latestWeek) {
        savedBits.push(
          `Latest saved AI week ${latestWeek.week} records ${formatInteger(latestWeek.mentions)} mention(s) and ${formatInteger(latestWeek.citations)} citation(s).`,
        );
      }
      if (previousWeek && latestWeek) {
        savedBits.push(
          `Compared with the prior saved AI week, mentions changed ${formatSignedInteger(Number(latestWeek.mentions || 0) - Number(previousWeek.mentions || 0))} and citations changed ${formatSignedInteger(Number(latestWeek.citations || 0) - Number(previousWeek.citations || 0))}; treat the latest week as partial if the run set is still in flight.`,
        );
      }
    }
    const leadOutcomeRows = (snapshotHistory.leadJoinCounts || [])
      .filter((row) => /^Lead/.test(String(row.table_name || "")))
      .reduce((total, row) => total + Number(row.rows || 0), 0);
    const cloudflareAiTraffic = (snapshotHistory.cloudflareAiTrafficSummary || [])
      .reduce((total, row) => total + Number(row.total_requests || 0), 0);
    if (cloudflareAiTraffic) {
      savedBits.push(
        `Cloudflare AI traffic observability shows ${formatInteger(cloudflareAiTraffic)} saved AI-traffic request(s), but this is crawl/traffic context, not lead or revenue proof.`,
      );
    }
    if (!leadOutcomeRows) {
      savedBits.push(
        "No saved New Reward LeadTouchpoint, LeadFormSubmission, LeadOpportunity, or LeadRevenueEvent rows are available for Air Express yet.",
      );
    }
    clientSummary.plainEnglish = [
      "The direct local Google API pull is still blocked by local token scopes, but saved New Reward snapshot evidence is now available.",
      savedBits.join(" "),
      "GA4 trend attribution still needs the Air Express GA4 property selected in New Reward and canonical live measurement repaired. ServiceTitan lead-count history is available; booking and revenue joins are intentionally out of scope for this report.",
    ].join(" ");
  }

  return clientSummary;
}

function htmlEscape(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function labelize(value) {
  return String(value || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMix(object = {}) {
  const entries = Object.entries(object)
    .filter(([, value]) => Number(value || 0) > 0)
    .sort(([, a], [, b]) => Number(b || 0) - Number(a || 0));
  if (!entries.length) return "none observed";
  return entries.map(([key, value]) => `${labelize(key)}: ${formatInteger(value)}`).join("; ");
}

function table(headers, rows) {
  return `<div class="scroll"><table><thead><tr>${headers.map((header) => `<th>${htmlEscape(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function renderReport({
  status,
  generatedAt,
  account,
  source,
  blockers,
  gsc,
  ga4,
  gbp,
  summaries,
  token,
  evidenceStates,
  serviceTitan,
  clientSummary,
  newRewardSnapshots,
  newRewardProvider,
  tokenRepairAttempt,
}) {
  const includeGbpInReport = gbp.status !== "not_included";
  const googleSurfaceLabel = includeGbpInReport
    ? "GSC, GA4, and Google Business Profile"
    : "GSC and GA4";
  const scopedReconnectCommand = includeGbpInReport
    ? tokenRepairAttempt?.safeReconnectCommand || ""
    : "gcloud auth application-default login newrewardplatform@gmail.com --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/webmasters.readonly,https://www.googleapis.com/auth/analytics.readonly,openid,https://www.googleapis.com/auth/userinfo.email --disable-quota-project";
  const sourceEvidence = includeGbpInReport
    ? source.evidence
    : String(source.evidence || "")
      .replaceAll("GSC/GA4/GBP", "GSC/GA4")
      .replaceAll(", GBP location/provider proof is still missing", "")
      .replaceAll("GBP location/provider proof is still missing, ", "")
      .replaceAll("Business Profile location", "Business Profile location (out of this pass)");
  const blockerRows = [
    ...LOCAL_PREPARED_ACTIONS.map((item) => [
      htmlEscape(item.surface),
      htmlEscape(item.status),
      htmlEscape(item.evidence),
      htmlEscape(item.nextAction),
    ]),
    ...(blockers.length
      ? blockers.map((blocker) => [
        htmlEscape(blocker.surface),
        htmlEscape(blocker.status),
        htmlEscape(blocker.evidence),
        htmlEscape(blocker.nextAction),
      ])
      : [[googleSurfaceLabel, "pulled", "History files generated.", "Review impact periods and reconcile with ServiceTitan leads."]]),
  ];
  const summaryRows = summaries.map((period) => [
    htmlEscape(period.label),
    htmlEscape(period.start),
    htmlEscape(period.end),
    htmlEscape(period.days),
    htmlEscape(period.gscClicks),
    htmlEscape(period.gscImpressions),
    htmlEscape(Math.round(period.gscAveragePosition * 100) / 100),
    htmlEscape(period.ga4Sessions),
    htmlEscape(period.ga4Users),
    htmlEscape(period.ga4Conversions),
    htmlEscape(formatPercent(period.ga4AverageEngagementRate || 0)),
  ]);
  const googleSearch = clientSummary.googleSearch || {};
  const aiSearch = clientSummary.aiSearchVisibility || {};
  const firstSavedGoogle = googleSearch.firstSavedSnapshot || null;
  const latestSavedGoogle = googleSearch.latestSavedSnapshot || null;
  const latestAiRun = aiSearch.latestCompletedRun || null;
  const friendlyRows = [
    ["Google clicks", formatInteger(googleSearch.clicks), googleSearch.status],
    ["Google appearances", formatInteger(googleSearch.impressions), googleSearch.status],
    ["Google appearance growth", googleSearch.appearanceChange === null || googleSearch.appearanceChange === undefined ? "pending" : formatSignedInteger(googleSearch.appearanceChange), googleSearch.status],
    ["Google click change", googleSearch.clickChange === null || googleSearch.clickChange === undefined ? "pending" : formatSignedInteger(googleSearch.clickChange), googleSearch.status],
    ["Google CTR", googleSearch.averageCtr ? formatPercent(googleSearch.averageCtr) : "pending", googleSearch.status],
    ["First-to-latest CTR", firstSavedGoogle && latestSavedGoogle ? `${formatPercent(firstSavedGoogle.averageCtr)} to ${formatPercent(latestSavedGoogle.averageCtr)}` : "pending", googleSearch.status],
    ["Captured Google rows", latestSavedGoogle ? formatInteger(latestSavedGoogle.rowsCaptured) : "pending", googleSearch.status],
    ["Average Google position", googleSearch.averagePosition ? formatDecimal(googleSearch.averagePosition, 1) : "pending", googleSearch.status],
    ["GA4 sessions", formatInteger(clientSummary.websiteEngagement.sessions), clientSummary.websiteEngagement.status],
    ["Organic search sessions", formatInteger(clientSummary.websiteEngagement.organicSearchSessions), clientSummary.websiteEngagement.status],
    ["GA4 engagement rate", clientSummary.websiteEngagement.averageEngagementRate ? formatPercent(clientSummary.websiteEngagement.averageEngagementRate) : "pending", clientSummary.websiteEngagement.status],
    ["GA4 conversions", formatInteger(clientSummary.websiteEngagement.conversions), clientSummary.websiteEngagement.status],
    ["ServiceTitan leads", `${formatInteger(clientSummary.leadProof.verifiedCount)} redacted lead row(s); ${formatInteger(clientSummary.leadProof.websiteCampaignLeadCount || 0)} website campaign row(s)`, clientSummary.leadProof.status],
    ["AI answer snapshots", aiSearch.snapshots ? formatInteger(aiSearch.snapshots) : "pending", aiSearch.status],
    ["AI unique questions", aiSearch.uniqueQuestions ? formatInteger(aiSearch.uniqueQuestions) : "pending", aiSearch.status],
    ["AI mentions", aiSearch.mentions !== undefined ? formatInteger(aiSearch.mentions) : "pending", aiSearch.status],
    ["AI citations", aiSearch.citations !== undefined ? formatInteger(aiSearch.citations) : "pending", aiSearch.status],
    ["AI mention rate", aiSearch.mentionRate !== undefined ? formatPercent(aiSearch.mentionRate) : "pending", aiSearch.status],
    ["AI citation rate", aiSearch.citationRate !== undefined ? formatPercent(aiSearch.citationRate) : "pending", aiSearch.status],
    ["Latest AI run", latestAiRun ? `${formatInteger(latestAiRun.mentions)} mentions / ${formatInteger(latestAiRun.citations)} citations from ${formatInteger(latestAiRun.snapshots)} snapshots` : aiSearch.status, aiSearch.nextAction],
  ];
  const queryRows = clientSummary.googleSearch.topQueries.length
    ? clientSummary.googleSearch.topQueries.map((row) => [
      htmlEscape(row.query),
      htmlEscape(formatInteger(row.clicks)),
      htmlEscape(formatInteger(row.impressions)),
      htmlEscape(formatDecimal(row.position, 1)),
    ])
    : [["pending", "0", "0", "pending"]];
  const eventRows = clientSummary.websiteEngagement.conversionOrLeadEvents.length
    ? clientSummary.websiteEngagement.conversionOrLeadEvents.map((row) => [
      htmlEscape(row.eventName),
      htmlEscape(formatInteger(row.eventCount)),
      htmlEscape(formatInteger(row.users)),
    ])
    : [["pending", "0", "0"]];
  const latestSavedGsc = newRewardSnapshots?.gscSnapshotSummary?.latest || null;
  const leadJoinCounts = newRewardSnapshots?.leadJoinCounts || [];
  const leadOutcomeRows = leadJoinCounts
    .filter((row) => /^Lead/.test(String(row.table_name || "")))
    .reduce((total, row) => total + Number(row.rows || 0), 0);
  const observabilityRows = leadJoinCounts
    .filter((row) => !/^Lead/.test(String(row.table_name || "")))
    .reduce((total, row) => total + Number(row.rows || 0), 0);
  const savedSnapshotRows = [
    [
      "GSC saved snapshots",
      newRewardSnapshots?.gscSnapshotSummary?.rows
        ? "saved_snapshot_available"
        : newRewardSnapshots?.status || "not_pulled",
      latestSavedGsc
        ? `${formatInteger(newRewardSnapshots.gscSnapshotSummary.rows)} snapshot(s); latest window ${htmlEscape(latestSavedGsc.dateRange?.start || "unknown")} to ${htmlEscape(latestSavedGsc.dateRange?.end || "unknown")} with ${formatInteger(latestSavedGsc.total_impressions)} appearances, ${formatInteger(latestSavedGsc.total_clicks)} click(s), ${formatPercent(latestSavedGsc.average_ctr)} CTR, ${formatInteger(latestSavedGsc.row_count)} captured row(s), and avg position ${formatDecimal(latestSavedGsc.average_position, 1)}.`
        : htmlEscape(newRewardSnapshots?.evidence || "No saved GSC snapshots pulled yet."),
    ],
    [
      "GA4 saved snapshots",
      newRewardSnapshots?.ga4Snapshots?.rows ? "saved_snapshot_available" : "blocked_provider_property_selection",
      newRewardSnapshots?.ga4Snapshots?.rows
        ? `${formatInteger(newRewardSnapshots.ga4Snapshots.rows)} snapshot(s) from ${htmlEscape(newRewardSnapshots.ga4Snapshots.first_date || "unknown")} to ${htmlEscape(newRewardSnapshots.ga4Snapshots.last_date || "unknown")}.`
        : "No saved GA4 snapshots found for Air Express; current New Reward evidence shows the GA4 provider row is expired and propertyId is still null.",
    ],
    [
      "GSC query metric sync",
      newRewardSnapshots?.gscQueryMetricSummary?.rows ? "saved_query_rows_available" : "blocked_empty_query_sync",
      newRewardSnapshots?.gscQueryMetricSummary?.rows
        ? `${formatInteger(newRewardSnapshots.gscQueryMetricSummary.rows)} query metric row(s), ${formatInteger(newRewardSnapshots.gscQueryMetricSummary.clicks)} click(s), and ${formatInteger(newRewardSnapshots.gscQueryMetricSummary.impressions)} impression(s).`
        : "No GscQueryMetric rows found for the canonical Air Express website ids; aggregate GSC snapshots are available, but query-level sync is empty.",
    ],
    [
      "AI visibility saved snapshots",
      newRewardSnapshots?.aiSnapshots?.rows ? "saved_snapshot_available" : "not_pulled",
      newRewardSnapshots?.aiSnapshots?.rows
        ? `${formatInteger(newRewardSnapshots.aiSnapshots.rows)} snapshot(s), ${formatInteger(newRewardSnapshots.aiSnapshots.unique_queries)} unique question(s), ${formatInteger(newRewardSnapshots.aiRuns?.rows || 0)} run(s), ${formatInteger(newRewardSnapshots.aiSnapshots.mentions)} mention(s), ${formatInteger(newRewardSnapshots.aiSnapshots.citations)} citation(s), ${formatPercent(safeRate(newRewardSnapshots.aiSnapshots.mentions, newRewardSnapshots.aiSnapshots.rows))} mention rate, and ${formatPercent(safeRate(newRewardSnapshots.aiSnapshots.citations, newRewardSnapshots.aiSnapshots.rows))} citation rate across ${formatInteger(newRewardSnapshots.aiSnapshots.engine_count)} engine(s).`
        : "No saved AI visibility snapshots pulled yet.",
    ],
    [
      "AI traffic ROI rollups",
      newRewardSnapshots?.aiTrafficRoiDailyRollup?.rows ? "saved_rollup_available" : "not_pulled",
      newRewardSnapshots?.aiTrafficRoiDailyRollup?.rows
        ? `${formatInteger(newRewardSnapshots.aiTrafficRoiDailyRollup.rows)} daily rollup row(s) from ${htmlEscape(newRewardSnapshots.aiTrafficRoiDailyRollup.first_date || "unknown")} to ${htmlEscape(newRewardSnapshots.aiTrafficRoiDailyRollup.last_date || "unknown")}; observed=${formatInteger(newRewardSnapshots.aiTrafficRoiDailyRollup.observed_hits)}, verified=${formatInteger(newRewardSnapshots.aiTrafficRoiDailyRollup.verified_hits)}, matched=${formatInteger(newRewardSnapshots.aiTrafficRoiDailyRollup.matched_hits)}.`
        : "No AI traffic ROI rollups pulled yet.",
    ],
    [
      "First-party New Reward lead/outcome joins",
      leadOutcomeRows ? "saved_outcome_rows_available" : "blocked_no_saved_outcome_rows",
      leadOutcomeRows
        ? `${formatInteger(leadOutcomeRows)} safe grouped lead/outcome row(s) found in New Reward Lead* tables.`
        : `No New Reward LeadTouchpoint, LeadFormSubmission, LeadOpportunity, or LeadRevenueEvent rows were found for the Air Express tenant/client/website ids. ${formatInteger(observabilityRows)} non-outcome observability row(s) were found, mostly Cloudflare AI traffic snapshots; these do not prove leads.`,
    ],
  ];
  const gscTrend = newRewardSnapshots?.gscSnapshotTrend || [];
  const distinctGscTrend = distinctGscSnapshots(gscTrend);
  const firstSavedGscTrend = distinctGscTrend[0] || null;
  const latestSavedGscTrend = distinctGscTrend.at(-1) || null;
  const previousSavedGscTrend = distinctGscTrend.length > 1 ? distinctGscTrend.at(-2) : null;
  const savedGscChangeRows = firstSavedGscTrend && latestSavedGscTrend
    ? [
      [
        "Appearances",
        formatInteger(firstSavedGscTrend.total_impressions),
        formatInteger(latestSavedGscTrend.total_impressions),
        formatSignedInteger(Number(latestSavedGscTrend.total_impressions || 0) - Number(firstSavedGscTrend.total_impressions || 0)),
      ],
      [
        "Clicks",
        formatInteger(firstSavedGscTrend.total_clicks),
        formatInteger(latestSavedGscTrend.total_clicks),
        formatSignedInteger(Number(latestSavedGscTrend.total_clicks || 0) - Number(firstSavedGscTrend.total_clicks || 0)),
      ],
      [
        "CTR",
        formatPercent(firstSavedGscTrend.average_ctr),
        formatPercent(latestSavedGscTrend.average_ctr),
        formatPercent(Number(latestSavedGscTrend.average_ctr || 0) - Number(firstSavedGscTrend.average_ctr || 0)),
      ],
      [
        "Average position",
        formatDecimal(firstSavedGscTrend.average_position, 1),
        formatDecimal(latestSavedGscTrend.average_position, 1),
        formatSignedDecimal(Number(latestSavedGscTrend.average_position || 0) - Number(firstSavedGscTrend.average_position || 0), 1),
      ],
      [
        "Rows captured",
        formatInteger(firstSavedGscTrend.row_count),
        formatInteger(latestSavedGscTrend.row_count),
        formatSignedInteger(Number(latestSavedGscTrend.row_count || 0) - Number(firstSavedGscTrend.row_count || 0)),
      ],
    ]
    : [];
  const savedGscRecentMovementRows = previousSavedGscTrend && latestSavedGscTrend
    ? [
      [
        "Appearances",
        formatInteger(previousSavedGscTrend.total_impressions),
        formatInteger(latestSavedGscTrend.total_impressions),
        formatSignedInteger(Number(latestSavedGscTrend.total_impressions || 0) - Number(previousSavedGscTrend.total_impressions || 0)),
        "Visibility footprint expanded in the latest saved window.",
      ],
      [
        "Clicks",
        formatInteger(previousSavedGscTrend.total_clicks),
        formatInteger(latestSavedGscTrend.total_clicks),
        formatSignedInteger(Number(latestSavedGscTrend.total_clicks || 0) - Number(previousSavedGscTrend.total_clicks || 0)),
        "Small click lift; still needs stronger CTR and lead attribution.",
      ],
      [
        "CTR",
        formatPercent(previousSavedGscTrend.average_ctr, 2),
        formatPercent(latestSavedGscTrend.average_ctr, 2),
        signedPercent(Number(latestSavedGscTrend.average_ctr || 0) - Number(previousSavedGscTrend.average_ctr || 0), 2),
        "CTR is lower as coverage broadened; improve titles, snippets, and high-intent pages.",
      ],
      [
        "Average position",
        formatDecimal(previousSavedGscTrend.average_position, 1),
        formatDecimal(latestSavedGscTrend.average_position, 1),
        formatSignedDecimal(Number(latestSavedGscTrend.average_position || 0) - Number(previousSavedGscTrend.average_position || 0), 1),
        lowerPositionRead(previousSavedGscTrend.average_position, latestSavedGscTrend.average_position),
      ],
      [
        "Rows captured",
        formatInteger(previousSavedGscTrend.row_count),
        formatInteger(latestSavedGscTrend.row_count),
        formatSignedInteger(Number(latestSavedGscTrend.row_count || 0) - Number(previousSavedGscTrend.row_count || 0)),
        "More query/page coverage is being captured.",
      ],
    ]
    : [];
  const savedGscTrendRows = (newRewardSnapshots?.gscSnapshotTrend || [])
    .slice(-8)
    .map((row) => [
      htmlEscape(row.createdAt || ""),
      htmlEscape(row.dateRange?.start || ""),
      htmlEscape(row.dateRange?.end || ""),
      htmlEscape(formatInteger(row.total_impressions)),
      htmlEscape(formatInteger(row.total_clicks)),
      htmlEscape(formatPercent(row.average_ctr)),
      htmlEscape(formatInteger(row.row_count)),
      htmlEscape(formatDecimal(row.average_position, 1)),
    ]);
  const savedGscRankingRows = (newRewardSnapshots?.gscRankingTopQueries || []).map((row) => [
    htmlEscape(row.query || ""),
    htmlEscape(formatInteger(row.clicks)),
    htmlEscape(formatInteger(row.impressions)),
    htmlEscape(formatDecimal(row.avg_position, 1)),
  ]);
  const savedAiEngineRows = (newRewardSnapshots?.aiByEngine || []).map((row) => [
    htmlEscape(row.engine || "unknown"),
    htmlEscape(formatInteger(row.snapshots)),
    htmlEscape(formatInteger(row.mentions)),
    htmlEscape(formatInteger(row.citations)),
    htmlEscape(formatPercent(safeRate(row.mentions, row.snapshots))),
    htmlEscape(formatPercent(safeRate(row.citations, row.snapshots))),
  ]);
  const savedAiWeekRows = (newRewardSnapshots?.aiByWeek || []).map((row) => [
    htmlEscape(row.week || ""),
    htmlEscape(formatInteger(row.snapshots)),
    htmlEscape(formatInteger(row.unique_queries)),
    htmlEscape(formatInteger(row.mentions)),
    htmlEscape(formatInteger(row.citations)),
    htmlEscape(formatPercent(safeRate(row.mentions, row.snapshots))),
    htmlEscape(formatPercent(safeRate(row.citations, row.snapshots))),
  ]);
  const aiWeeks = newRewardSnapshots?.aiByWeek || [];
  const firstAiWeek = aiWeeks[0] || null;
  const previousAiWeek = aiWeeks.length > 1 ? aiWeeks.at(-2) : null;
  const latestAiWeek = aiWeeks.at(-1) || null;
  const savedAiMovementRows = previousAiWeek && latestAiWeek
    ? [
      [
        "Snapshots tested",
        formatInteger(previousAiWeek.snapshots),
        formatInteger(latestAiWeek.snapshots),
        formatSignedInteger(Number(latestAiWeek.snapshots || 0) - Number(previousAiWeek.snapshots || 0)),
        "Latest week may be partial; compare completed weekly runs before treating volume as a decline.",
      ],
      [
        "Unique questions",
        formatInteger(previousAiWeek.unique_queries),
        formatInteger(latestAiWeek.unique_queries),
        formatSignedInteger(Number(latestAiWeek.unique_queries || 0) - Number(previousAiWeek.unique_queries || 0)),
        "Question coverage changed; keep a stable core set plus a clearly labeled experimental set.",
      ],
      [
        "Mentions",
        formatInteger(previousAiWeek.mentions),
        formatInteger(latestAiWeek.mentions),
        formatSignedInteger(Number(latestAiWeek.mentions || 0) - Number(previousAiWeek.mentions || 0)),
        "Mentions are present but still sparse outside Perplexity.",
      ],
      [
        "Citations",
        formatInteger(previousAiWeek.citations),
        formatInteger(latestAiWeek.citations),
        formatSignedInteger(Number(latestAiWeek.citations || 0) - Number(previousAiWeek.citations || 0)),
        "Citations exist, but answer-engine proof needs broader source support.",
      ],
      [
        "Mention rate",
        formatPercent(safeRate(previousAiWeek.mentions, previousAiWeek.snapshots), 2),
        formatPercent(safeRate(latestAiWeek.mentions, latestAiWeek.snapshots), 2),
        signedPercent(safeRate(latestAiWeek.mentions, latestAiWeek.snapshots) - safeRate(previousAiWeek.mentions, previousAiWeek.snapshots), 2),
        "Rate is the better week-over-week signal when run size changes.",
      ],
      [
        "Citation rate",
        formatPercent(safeRate(previousAiWeek.citations, previousAiWeek.snapshots), 2),
        formatPercent(safeRate(latestAiWeek.citations, latestAiWeek.snapshots), 2),
        signedPercent(safeRate(latestAiWeek.citations, latestAiWeek.snapshots) - safeRate(previousAiWeek.citations, previousAiWeek.snapshots), 2),
        "Citation rate remains low and should be treated as the key GEO growth target.",
      ],
    ]
    : [];
  const savedAiBaselineRows = firstAiWeek && latestAiWeek
    ? [
      ["First saved week", firstAiWeek.week || "", formatInteger(firstAiWeek.snapshots), formatInteger(firstAiWeek.unique_queries), formatInteger(firstAiWeek.mentions), formatInteger(firstAiWeek.citations), formatPercent(safeRate(firstAiWeek.mentions, firstAiWeek.snapshots), 2), formatPercent(safeRate(firstAiWeek.citations, firstAiWeek.snapshots), 2)],
      ["Latest saved week", latestAiWeek.week || "", formatInteger(latestAiWeek.snapshots), formatInteger(latestAiWeek.unique_queries), formatInteger(latestAiWeek.mentions), formatInteger(latestAiWeek.citations), formatPercent(safeRate(latestAiWeek.mentions, latestAiWeek.snapshots), 2), formatPercent(safeRate(latestAiWeek.citations, latestAiWeek.snapshots), 2)],
    ]
    : [];
  const savedAiRunRows = (newRewardSnapshots?.aiByRun || [])
    .slice(-10)
    .map((row) => [
      htmlEscape(row.createdAt || ""),
      htmlEscape(row.status || ""),
      htmlEscape(formatInteger(row.snapshots)),
      htmlEscape(formatInteger(row.unique_queries)),
      htmlEscape(formatInteger(row.engine_count)),
      htmlEscape(formatInteger(row.mentions)),
      htmlEscape(formatInteger(row.citations)),
      htmlEscape(formatPercent(safeRate(row.mentions, row.snapshots))),
      htmlEscape(formatPercent(safeRate(row.citations, row.snapshots))),
    ]);
  const latestRun = newRewardSnapshots?.aiLatestCompletedRun || null;
  const savedAiQuestionRows = (newRewardSnapshots?.aiTopMentionedQuestions || []).map((row) => [
    htmlEscape(row.query || ""),
    htmlEscape(formatInteger(row.snapshots)),
    htmlEscape(formatInteger(row.mentions)),
    htmlEscape(formatInteger(row.citations)),
    htmlEscape(formatPercent(safeRate(row.mentions, row.snapshots))),
    htmlEscape(formatPercent(safeRate(row.citations, row.snapshots))),
    htmlEscape(row.last_seen || ""),
  ]);
  const leadJoinRows = (newRewardSnapshots?.leadJoinCounts || []).map((row) => [
    htmlEscape(row.table_name || ""),
    htmlEscape(formatInteger(row.rows)),
    htmlEscape(row.first_at || ""),
    htmlEscape(row.last_at || ""),
    htmlEscape(/^Lead/.test(String(row.table_name || ""))
      ? (row.rows ? "Safe grouped outcome rows available for future joins." : "No lead/revenue outcome rows found for Air Express target ids.")
      : (row.rows ? "Observability rows only; useful context but not lead/revenue proof." : "No observability rows found for Air Express target ids.")),
  ]);
  const promptReviewRows = AI_PROMPT_REVIEW_ROWS.map((row) => [
    htmlEscape(row.area),
    htmlEscape(row.state),
    htmlEscape(row.evidence),
    htmlEscape(row.recommendation),
  ]);
  const recommendedPromptRows = RECOMMENDED_AI_PROMPT_ROWS.map((row) => [
    htmlEscape(row.category),
    htmlEscape(row.prompt),
    htmlEscape(row.purpose),
  ]);
  const cloudflareAiTrafficRows = (newRewardSnapshots?.cloudflareAiTrafficSummary || []).map((row) => [
    htmlEscape(row.zone_name || ""),
    htmlEscape(row.metric_source || ""),
    htmlEscape(formatInteger(row.snapshots)),
    htmlEscape(formatInteger(row.total_requests)),
    htmlEscape(formatInteger(row.allowed_requests)),
    htmlEscape(formatInteger(row.successful_requests)),
    htmlEscape(formatInteger(row.unsuccessful_requests)),
    htmlEscape(row.first_window_start || ""),
    htmlEscape(row.last_window_end || ""),
  ]);
  const serviceTitanWeeklyRows = (serviceTitan.apiCompleteWeeklyTrend || []).map((row) => [
    htmlEscape(row.week || ""),
    htmlEscape(formatInteger(row.totalLeads || 0)),
    htmlEscape(formatInteger(row.websiteCampaignLeads || 0)),
    htmlEscape(formatMix(row.serviceTypes || {})),
    htmlEscape(formatMix(row.statuses || {})),
    htmlEscape(labelize(row.captchaPeriod || "")),
  ]);
  const serviceTitanServiceRows = Object.entries(serviceTitan.apiCountsByServiceType || {})
    .sort(([, a], [, b]) => Number(b || 0) - Number(a || 0))
    .map(([serviceType, count]) => [
      htmlEscape(labelize(serviceType)),
      htmlEscape(formatInteger(count)),
      htmlEscape(formatInteger(serviceTitan.apiWebsiteCampaignCountsByServiceType?.[serviceType] || 0)),
    ]);
  const captchaQualityRows = ["before_source_captcha", "source_captcha_day_or_after"].map((period) => {
    const quality = serviceTitan.qualityProxyByCaptchaPeriod?.[period] || {};
    return [
      htmlEscape(labelize(period)),
      htmlEscape(formatInteger(quality.total || 0)),
      htmlEscape(formatInteger(quality.dismissed || 0)),
      htmlEscape(formatInteger(quality.open || 0)),
      htmlEscape(formatInteger(quality.converted || 0)),
      htmlEscape(formatPercent(quality.dismissedRate || 0)),
      htmlEscape(quality.interpretation || "Pending ServiceTitan lead evidence."),
    ];
  });
  const tokenRows = token
    ? [
      ["Selected source", htmlEscape(token.source || ""), "Token source selected for this read-only pull attempt."],
      ["Selected email", htmlEscape(token.email || ""), "Google account returned by tokeninfo."],
      ["Visible scopes", htmlEscape((token.visibleScopes || []).join(", ")), "Sanitized OAuth scope names only; no token values are stored."],
      ["Local token missing product scopes", htmlEscape((token.missingRequiredScopes || []).join(", ")), `Product scopes absent from this machine-local token before direct ${googleSurfaceLabel} API history can be pulled. This is not proof that New Reward lacks saved provider rows.`],
    ]
    : [["Token", "not available", "No usable local token was available."]];
  const providerRows = [
    [
      "Canonical website",
      htmlEscape(newRewardProvider?.canonicalWebsiteId || "pending"),
      htmlEscape(newRewardProvider?.canonicalWebsiteStatus || "unknown"),
      "Provider reconnects should target this Air Express website id.",
    ],
    [
      "Provider account",
      htmlEscape(newRewardProvider?.providerEmail || "unknown"),
      "expected Google provider",
      "This is the New Reward saved-provider identity, separate from the local gcloud/ADC token.",
    ],
    [
      "Search Console",
      htmlEscape(newRewardProvider?.gsc?.siteUrl || "unknown property"),
      htmlEscape(`${newRewardProvider?.gsc?.credentialStatus || "unknown"} / ${newRewardProvider?.gsc?.connectionStatus || "unknown"}`),
      "Reconnect or refresh this provider row before expecting normalized GSC query/page/device sync.",
    ],
    [
      "GA4",
      htmlEscape(`propertyId present=${Boolean(newRewardProvider?.ga4?.propertyIdPresent)}`),
      htmlEscape(`${newRewardProvider?.ga4?.credentialStatus || "unknown"} / ${newRewardProvider?.ga4?.connectionStatus || "unknown"}`),
      "Select the GA4 property or web stream containing G-JZ7PY32EVX.",
    ],
  ];
  const tokenRepairSummaryRows = tokenRepairAttempt
    ? [
      ["Status", htmlEscape(tokenRepairAttempt.status || ""), htmlEscape(
        includeGbpInReport
          ? tokenRepairAttempt.rootCause || ""
          : String(tokenRepairAttempt.rootCause || "").replaceAll("GSC, GA4, and GBP", "GSC and GA4").replaceAll("GSC/GA4/GBP", "GSC/GA4")
      ), htmlEscape(
        includeGbpInReport
          ? tokenRepairAttempt.nextAction || ""
          : String(tokenRepairAttempt.nextAction || "").replaceAll("GSC/GA4/GBP", "GSC/GA4")
      )],
      ["Safe command", "prepared", htmlEscape(scopedReconnectCommand), "Run locally only; do not paste OAuth codes or tokens into chat."],
    ]
    : [["Status", "not_recorded", "No scoped token repair attempt artifact was found.", "Use the reconnect packet before rerunning the history pull."]];
  const tokenRepairRows = tokenRepairAttempt?.attempts?.length
    ? tokenRepairAttempt.attempts.map((attempt) => [
      htmlEscape(attempt.action || ""),
      htmlEscape(attempt.result || ""),
      htmlEscape(attempt.evidence || ""),
      htmlEscape(attempt.nextAction || ""),
    ])
    : [["pending", "not_recorded", "No token repair attempt rows are available.", "Follow the reconnect packet."]];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Air Express New Reward Impact Report</title>
  <style>
    :root { color-scheme: light; --ink: #16202a; --muted: #5c6875; --line: #d8e0e8; --blue: #0b679f; --green: #2f734d; --red: #a63a35; --panel: #f6f8fb; --white: #fff; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--white); line-height: 1.48; overflow-x: hidden; }
    header, main { padding-left: clamp(18px, 5vw, 56px); padding-right: clamp(18px, 5vw, 56px); }
    header { padding-top: 34px; padding-bottom: 24px; border-bottom: 1px solid var(--line); background: #eef5f8; }
    main { padding-top: 24px; padding-bottom: 56px; }
    h1 { margin: 0 0 8px; font-size: clamp(30px, 4vw, 48px); letter-spacing: 0; }
    h2 { margin: 30px 0 12px; font-size: 21px; letter-spacing: 0; }
    p { max-width: 980px; color: var(--muted); margin: 0 0 12px; overflow-wrap: anywhere; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .pill { border: 1px solid var(--line); border-radius: 999px; padding: 6px 10px; background: var(--white); font-size: 13px; }
    .blocked { border-left: 4px solid var(--red); background: #fff4f2; padding: 12px 14px; color: var(--ink); }
    .ready { border-left: 4px solid var(--green); background: #f0f8f3; padding: 12px 14px; color: var(--ink); }
    .scroll { overflow-x: auto; max-width: 100%; margin: 14px 0 24px; }
    table { width: 100%; border-collapse: collapse; border: 1px solid var(--line); background: var(--white); table-layout: fixed; }
    th, td { border-bottom: 1px solid var(--line); padding: 10px; text-align: left; vertical-align: top; font-size: 14px; overflow-wrap: anywhere; word-break: break-word; }
    th { background: var(--panel); font-size: 13px; }
    code { background: var(--panel); border: 1px solid var(--line); padding: 1px 4px; white-space: normal; overflow-wrap: anywhere; }
    @media (max-width: 860px) { table { min-width: 680px; table-layout: auto; } }
  </style>
</head>
<body>
  <header>
    <h1>Air Express New Reward Impact Report</h1>
    <p>Read-only ${htmlEscape(googleSurfaceLabel)}, ServiceTitan lead-count trend, and New Reward milestone attribution for Air Express HVAC.</p>
    <div class="meta">
      <span class="pill">Generated ${htmlEscape(generatedAt)}</span>
      <span class="pill">Google provider: ${htmlEscape(account)}</span>
      <span class="pill">Status: ${htmlEscape(status)}</span>
    </div>
  </header>
  <main>
    <section class="${status === "pulled" ? "ready" : "blocked"}">
      ${status === "pulled"
        ? `${htmlEscape(googleSurfaceLabel)} history was pulled from the authorized Google provider account. Use the period table below for directional impact, then reconcile leads in ServiceTitan.`
        : `${htmlEscape(googleSurfaceLabel)} history was not pulled. The local provider account is present, but the accessible token or platform source cannot read the required history yet.`}
    </section>

    <h2>History Coverage</h2>
    ${table(["Source", "State", "Evidence"], [
      ["GSC", htmlEscape(gsc.status), htmlEscape(gsc.evidence)],
      ["GA4", htmlEscape(ga4.status), htmlEscape(ga4.evidence)],
      [includeGbpInReport ? "Google Business Profile" : "Google Business Profile (excluded)", htmlEscape(gbp.status), htmlEscape(gbp.evidence)],
      ["New Reward source", htmlEscape(source.status), htmlEscape(sourceEvidence)],
    ])}

    <h2>Client-Friendly Attribution Summary</h2>
    <p>${htmlEscape(clientSummary.plainEnglish)}</p>
    ${table(["Metric", "Value", "State / Caveat"], friendlyRows.map((row) => row.map((cell) => htmlEscape(cell))))}

    <h2>Strong Search Signals</h2>
    <p>When Search Console access works, this table shows the queries creating the clearest visible demand signals.</p>
    ${table(["Query", "Clicks", "Impressions", "Avg position"], queryRows)}

    <h2>Conversion And Lead Signals</h2>
    <p>Use these as early intent signals only until ServiceTitan lead/export history is joined.</p>
    ${table(["Event", "Event count", "Users"], eventRows)}

    <h2>Saved New Reward Snapshot Evidence</h2>
    <p>This section uses saved New Reward database snapshots only. It does not read or store OAuth tokens, encrypted provider credentials, customer PII, or full AI responses.</p>
    ${table(["Surface", "State", "Evidence"], savedSnapshotRows.map((row) => row.map((cell) => htmlEscape(cell))))}

    <h2>GSC Saved Snapshot Trend</h2>
    <p>These rows are stored Search Console snapshot totals from New Reward. They are useful for directional visibility, but the normalized query table is still empty until provider sync is repaired.</p>
    ${table(["Metric", "First saved", "Latest saved", "Change"], savedGscChangeRows.length ? savedGscChangeRows.map((row) => row.map((cell) => htmlEscape(cell))) : [["pending", "pending", "pending", "pending"]])}

    <h2>Recent Saved GSC Movement</h2>
    <p>This compares the latest distinct saved GSC snapshot against the previous distinct saved snapshot. It is the closest available saved-data proxy for recent movement until direct GSC daily rows are restored.</p>
    ${table(["Metric", "Previous saved", "Latest saved", "Change", "Read"], savedGscRecentMovementRows.length ? savedGscRecentMovementRows.map((row) => row.map((cell) => htmlEscape(cell))) : [["pending", "pending", "pending", "pending", "pending"]])}
    ${table(["Captured", "Start", "End", "Appearances", "Clicks", "CTR", "Rows captured", "Avg position"], savedGscTrendRows.length ? savedGscTrendRows : [["pending", "pending", "pending", "0", "0", "pending", "0", "pending"]])}

    <h2>GSC Normalized Query Rows</h2>
    <p>New Reward has saved aggregate GSC snapshots, but the normalized ranking table currently has ${htmlEscape(formatInteger(newRewardSnapshots?.gscRankingSummary?.rows || 0))} row(s), and the website-keyed GscQueryMetric table currently has ${htmlEscape(formatInteger(newRewardSnapshots?.gscQueryMetricSummary?.rows || 0))} row(s) for Air Express. Top Google search queries remain blocked until GSC provider sync produces normalized query/page/device rows.</p>
    ${table(["Query", "Clicks", "Impressions", "Avg position"], savedGscRankingRows.length ? savedGscRankingRows : [["blocked_pending_provider_sync", "0", "0", "pending"]])}

    <h2>AI Visibility Engine Summary</h2>
    <p>These are aggregate New Reward AI visibility observations for Air Express, grouped by answer engine.</p>
    ${table(["Engine", "Snapshots", "Mentions", "Citations", "Mention rate", "Citation rate"], savedAiEngineRows.length ? savedAiEngineRows : [["pending", "0", "0", "0", "0.0%", "0.0%"]])}

    <h2>AI Traffic Observability</h2>
    <p>These rows are Cloudflare AI traffic observations saved in New Reward. They are useful for crawl/AI traffic context, but they are not lead, booking, revenue, or ROI proof.</p>
    ${table(["Zone", "Metric source", "Snapshots", "Total requests", "Allowed", "Successful", "Unsuccessful", "First window", "Last window"], cloudflareAiTrafficRows.length ? cloudflareAiTrafficRows : [["pending", "pending", "0", "0", "0", "0", "0", "pending", "pending"]])}

    <h2>AI Visibility Weekly Trend</h2>
    <p>Weekly rows show when answer-engine mentions and citations appeared in the saved New Reward visibility runs.</p>
    ${table(["Window", "Week", "Snapshots", "Unique questions", "Mentions", "Citations", "Mention rate", "Citation rate"], savedAiBaselineRows.length ? savedAiBaselineRows.map((row) => row.map((cell) => htmlEscape(cell))) : [["pending", "pending", "0", "0", "0", "0", "0.0%", "0.0%"]])}
    ${table(["Metric", "Previous week", "Latest week", "Change", "Read"], savedAiMovementRows.length ? savedAiMovementRows.map((row) => row.map((cell) => htmlEscape(cell))) : [["pending", "pending", "pending", "pending", "pending"]])}
    ${table(["Week", "Snapshots", "Unique questions", "Mentions", "Citations", "Mention rate", "Citation rate"], savedAiWeekRows.length ? savedAiWeekRows : [["pending", "0", "0", "0", "0", "0.0%", "0.0%"]])}

    <h2>AI Visibility Run Detail</h2>
    <p>${latestRun ? `Latest completed run captured ${htmlEscape(formatInteger(latestRun.snapshots))} snapshot(s), ${htmlEscape(formatInteger(latestRun.unique_queries))} unique question(s), ${htmlEscape(formatInteger(latestRun.mentions))} mention(s), ${htmlEscape(formatInteger(latestRun.citations))} citation(s), ${htmlEscape(formatPercent(safeRate(latestRun.mentions, latestRun.snapshots)))} mention rate, and ${htmlEscape(formatPercent(safeRate(latestRun.citations, latestRun.snapshots)))} citation rate.` : "No completed AI visibility run summary is available."}</p>
    ${table(["Created", "Status", "Snapshots", "Unique questions", "Engines", "Mentions", "Citations", "Mention rate", "Citation rate"], savedAiRunRows.length ? savedAiRunRows : [["pending", "pending", "0", "0", "0", "0", "0", "0.0%", "0.0%"]])}

    <h2>AI Questions With Mentions Or Citations</h2>
    <p>This table lists prompt questions where saved New Reward snapshots observed an Air Express mention or citation. Full AI responses are not stored in this local report.</p>
    ${table(["Question", "Snapshots", "Mentions", "Citations", "Mention rate", "Citation rate", "Last seen"], savedAiQuestionRows.length ? savedAiQuestionRows : [["pending", "0", "0", "0", "0.0%", "0.0%", "pending"]])}

    <h2>Are We Asking The Right AI Questions?</h2>
    <p>Partially. The current set is proving some comparison and trust visibility, especially in Perplexity, but it needs a steadier high-intent local prompt set and cleaner natural phrasing before it can serve as the weekly GEO scorecard.</p>
    ${table(["Area", "State", "Evidence", "Recommendation"], promptReviewRows)}

    <h2>Recommended Weekly AI Prompt Bank</h2>
    <p>Use these as a stable core set. Add a smaller experimental set each week for new content, competitor tests, and seasonal topics so movement is attributable to a known prompt change.</p>
    ${table(["Category", "Prompt", "Purpose"], recommendedPromptRows)}

    <h2>Evidence State Model</h2>
    <p>This report separates checked facts from prepared work and approval-gated actions. A blocker is not treated as evidence that an asset does not exist.</p>
    ${table(["State", "Meaning", "Current Air Express Use"], evidenceStates.map((item) => [
      htmlEscape(item.state),
      htmlEscape(item.meaning),
      htmlEscape(includeGbpInReport ? item.currentUse : String(item.currentUse || "").replaceAll("GSC/GA4/GBP", "GSC/GA4")),
    ]))}

    <h2>Google Token Scope Inventory</h2>
    <p>This table records only token metadata from Google tokeninfo. It does not store access tokens, refresh tokens, cookies, or recovery material.</p>
    ${table(["Field", "Value", "Meaning"], tokenRows)}

    <h2>New Reward Saved Provider Rows</h2>
    <p>This is the separate app-side provider state found by the read-only New Reward recheck. These rows explain why the correct Google account can still need a New Reward reconnect or GA4 property selection.</p>
    ${table(["Surface", "Value", "State", "Read"], providerRows)}

    <h2>Google Token Repair Attempt</h2>
    <p>This section records only sanitized repair evidence. It does not store OAuth URLs, verification codes, token values, credential files, cookies, passwords, or recovery material.</p>
    ${table(["Field", "State", "Evidence", "Next action"], tokenRepairSummaryRows)}
    ${table(["Attempt", "Result", "Evidence", "Next action"], tokenRepairRows)}

    <h2>New Reward Impact Periods</h2>
    <p>Periods are tied to repo-local New Reward milestones. Treat this as firm-performance context, not causal proof, until ServiceTitan lead and revenue data are joined.</p>
    ${table(
      ["Period", "Start", "End", "Days", "GSC clicks", "GSC impressions", "Avg position", "GA4 sessions", "GA4 users", "GA4 conversions", "GA4 engagement rate"],
      summaryRows,
    )}

    <h2>Lead Proof Status</h2>
    <p>ServiceTitan evidence is stored only as sanitized counts, lead IDs where already approved in prior proof, campaign/source fields, and blockers. Customer names, phone numbers, emails, street addresses, raw notes, payment data, and credential values are excluded.</p>
    ${table(["New Reward table", "Rows", "First seen", "Last seen", "Join read"], leadJoinRows.length ? leadJoinRows : [["pending", "0", "", "", "No saved lead/touchpoint outcome rows found."]])}
    ${table(["Source", "State", "Evidence", "Next action"], [
      [
        "ServiceTitan lead history",
        htmlEscape(serviceTitan.priorProofStatus),
        htmlEscape(serviceTitan.evidence),
        serviceTitan.apiLeadCount
          ? "Use for lead-count trend comparison only; booking and revenue joins are intentionally out of scope."
          : "Use this as partial historical proof only; do not treat it as a full export, booking report, or revenue report.",
      ],
      [
        "ServiceTitan export/history",
        htmlEscape(serviceTitan.status),
        htmlEscape(serviceTitan.blocker),
        htmlEscape(serviceTitan.nextAction),
      ],
      [
        "ServiceTitan redacted export import",
        htmlEscape(serviceTitan.redactedImportStatus),
        htmlEscape(serviceTitan.redactedImportEvidence),
        htmlEscape(serviceTitan.redactedImportNextAction),
      ],
    ])}

    <h2>ServiceTitan Weekly Lead Trend</h2>
    <p>Weeks are zero-filled through the requested end date so quiet weeks are visible instead of disappearing from the report.</p>
    ${table(["Week", "Redacted leads", "Website campaign", "Service mix", "Status mix", "CAPTCHA marker"], serviceTitanWeeklyRows.length ? serviceTitanWeeklyRows : [["pending", "0", "0", "none observed", "none observed", "not pulled"]])}

    <h2>ServiceTitan Service-Type Mix</h2>
    <p>Service type is inferred from fixed keyword classification and safe ServiceTitan IDs only. Raw lead summaries and customer data are not stored.</p>
    ${table(["Service type", "Redacted leads", "Website campaign"], serviceTitanServiceRows.length ? serviceTitanServiceRows : [["pending", "0", "0"]])}

    <h2>CAPTCHA / Lead Quality Marker</h2>
    <p>Cloudflare Turnstile source was added on ${htmlEscape(serviceTitan.captcha?.date || "pending")} in commit ${htmlEscape(serviceTitan.captcha?.commit || "pending")}. Current live checks show the public CAPTCHA config is not healthy on the active delivery paths, and the ServiceTitan API has no leads after that source marker, so do not claim CAPTCHA changed lead quality yet.</p>
    ${table(["Period", "Lead count", "Dismissed", "Open", "Converted", "Dismissed rate", "Interpretation"], captchaQualityRows)}

    <h2>Blockers And Next Actions</h2>
    ${table(["Surface", "Status", "Evidence", "Next action"], blockerRows)}

    <h2>Milestones</h2>
    ${table(["Date", "Milestone", "Evidence"], DEFAULT_MILESTONES.map((item) => [
      htmlEscape(item.date),
      htmlEscape(item.label),
      htmlEscape(item.evidence),
    ]))}
  </main>
</body>
</html>
`;
}

async function main() {
  const account = argValue("--account", DEFAULT_ACCOUNT);
  const outDir = join(root, argValue("--out-dir", "data/google-history"));
  const reportPath = join(root, argValue("--report", "pages/new-reward-impact-report.html"));
  const gscStartDate = argValue("--gsc-start-date", defaultGscStart());
  const ga4StartDate = argValue("--ga4-start-date", defaultGa4Start());
  const endDate = argValue("--end-date", isoDateDaysAgo(2));
  const explicitGscProperty = argValue("--gsc-property", "");
  const explicitGa4PropertyId = argValue("--ga4-property-id", process.env.GA4_PROPERTY_ID || "");
  const force = hasFlag("--force");
  const includeGbp = !hasFlag("--skip-gbp");

  mkdirSync(outDir, { recursive: true });
  mkdirSync(dirname(reportPath), { recursive: true });

  const generatedAt = new Date().toISOString();
  const tokenSelection = await getBestToken(account);
  const token = tokenSelection.selected;
  const blockers = [];
  const sourceCheck = readJson(join(root, "data/newreward-attribution-source-check.json"), {});
  const providerRecheck = readJson(join(root, "data/newreward-air-express-provider-readonly-recheck.json"), {});
  const providerSummary = summarizeProviderRecheck(providerRecheck);
  const source = {
    status: sourceCheck.status || "unknown",
    evidence: scopeTextForCurrentPass(
      sourceCheck.blocker || sourceCheck.summary || "No New Reward source-check file found.",
      { includeGbp },
    ),
  };
  const serviceTitan = loadServiceTitanLeadProof();
  const newRewardSnapshots = loadNewRewardSnapshotHistory();
  const tokenRepairAttemptRaw = readJson(
    join(root, "data/google-history/google-readonly-token-repair-attempt.json"),
    null,
  );
  const tokenRepairAttempt = scopedTokenRepairAttempt(tokenRepairAttemptRaw, { includeGbp });

  let gscDaily = [];
  let gscQuery = [];
  let ga4Daily = [];
  let ga4Channel = [];
  let ga4Event = [];
  const status = {
    generatedAt,
    account,
    requested: {
      gscStartDate,
      ga4StartDate,
      gbpStartDate: includeGbp ? gscStartDate : null,
      endDate,
      explicitGscProperty,
      explicitGa4PropertyId: explicitGa4PropertyId ? redactPropertyId(explicitGa4PropertyId) : "",
      includedGoogleSurfaces: includeGbp ? ["gsc", "ga4", "gbp"] : ["gsc", "ga4"],
    },
    evidenceStates: EVIDENCE_STATE_MODEL.map((state) => ({
      ...state,
      currentUse: scopeTextForCurrentPass(state.currentUse, { includeGbp }),
    })),
    gsc: { status: "blocked", evidence: "" },
    ga4: { status: "blocked", evidence: "" },
    gbp: { status: "blocked", evidence: "" },
    source,
    serviceTitan,
    newRewardProvider: providerSummary,
    blockers,
    tokenRepairAttempt,
  };

  if (!token.ok) {
    blockers.push({
      surface: "gcloud",
      status: "blocked",
      evidence: token.blocker,
      nextAction: `Authenticate ${account} locally with read-only GSC/GA4 scopes.`,
    });
  } else {
    const info = token.info;
    const scopes = token.scopes;
    status.token = {
      ok: info.ok,
      source: token.source,
      email: info.email,
      hasGscScope: scopes.hasGsc,
      hasGa4Scope: scopes.hasGa4,
      hasGbpScope: scopes.hasGbp,
      scopeCount: info.scopes.length,
      requiredScopes: requiredScopes({ includeGbp }),
      missingRequiredScopes: missingRequiredScopes(scopes, { includeGbp }),
      visibleScopes: sanitizeScopes(info.scopes),
      error: info.error,
      candidates: tokenSelection.candidates.map((candidate) => ({
        source: candidate.source,
        ok: candidate.ok && candidate.info?.ok !== false,
        email: candidate.info?.email || "",
        hasGscScope: candidate.scopes.hasGsc,
        hasGa4Scope: candidate.scopes.hasGa4,
        hasGbpScope: candidate.scopes.hasGbp,
        scopeCount: candidate.info?.scopes?.length || 0,
        missingRequiredScopes: missingRequiredScopes(candidate.scopes, { includeGbp }),
        visibleScopes: sanitizeScopes(candidate.info?.scopes || []),
        error: candidate.blocker || candidate.info?.error || "",
      })),
    };

    if (!scopes.hasGsc && !force) {
      blockers.push({
        surface: "Search Console local token / New Reward provider",
        status: "blocked_local_token_scope_and_provider_reconnect",
        evidence: `The local ${token.source} token for ${account} lacks https://www.googleapis.com/auth/webmasters.readonly. New Reward rows exist for canonical website ${providerSummary.canonicalWebsiteId || "unknown"}, but the Air Express GSC credential is ${providerSummary.gsc.credentialStatus || "unknown"} and connection is ${providerSummary.gsc.connectionStatus || "unknown"}.`,
        nextAction: `Either re-authorize this machine for direct history pulls, or reconnect Search Console inside New Reward as ${account} for website ${providerSummary.canonicalWebsiteId || "cmorqbs9j001r5nr1h25vosp8"}.`,
      });
      status.gsc = {
        status: "blocked_local_token_scope",
        evidence: `Local ${token.source} token lacks webmasters.readonly; New Reward provider row is ${providerSummary.gsc.credentialStatus || "unknown"} with connection ${providerSummary.gsc.connectionStatus || "unknown"} for ${providerSummary.gsc.siteUrl || "unknown site"}.`,
      };
    } else {
      const sites = await listGscSites(token.token);
      if (!sites.ok) {
        blockers.push({
          surface: "Search Console sites",
          status: "blocked",
          evidence: sites.blocker,
          nextAction: "Confirm Search Console property access for airexpressutah.com.",
        });
        status.gsc = { status: "blocked", evidence: sites.blocker };
      } else {
        const selected = selectGscProperty(sites.sites, explicitGscProperty);
        if (!selected) {
          blockers.push({
            surface: "Search Console property",
            status: "blocked",
            evidence: `No Air Express property found among ${sites.sites.length} visible GSC sites.`,
            nextAction: "Grant/select sc-domain:airexpressutah.com or the canonical URL-prefix property.",
          });
          status.gsc = { status: "blocked_property", evidence: "No matching Air Express property found." };
        } else {
          const daily = await queryGsc(token.token, selected.siteUrl, gscStartDate, endDate, ["date"]);
          if (!daily.ok) {
            blockers.push({
              surface: "Search Console history",
              status: "blocked",
              evidence: daily.blocker,
              nextAction: "Confirm property permission and API quota, then rerun.",
            });
            status.gsc = { status: "blocked_query", evidence: daily.blocker };
          } else {
            gscDaily = normalizeGscRows(daily.rows, ["date"]);
            const byQuery = await queryGsc(token.token, selected.siteUrl, gscStartDate, endDate, ["query"]);
            const byPage = await queryGsc(token.token, selected.siteUrl, gscStartDate, endDate, ["page"]);
            const byDevice = await queryGsc(token.token, selected.siteUrl, gscStartDate, endDate, ["device"]);
            writeCsv(join(outDir, "gsc-daily-history.csv"), gscDaily, ["date", "clicks", "impressions", "ctr", "position"]);
            if (byQuery.ok) {
              gscQuery = normalizeGscRows(byQuery.rows, ["query"]);
              writeCsv(join(outDir, "gsc-query-history.csv"), gscQuery, ["query", "clicks", "impressions", "ctr", "position"]);
            }
            if (byPage.ok) writeCsv(join(outDir, "gsc-page-history.csv"), normalizeGscRows(byPage.rows, ["page"]), ["page", "clicks", "impressions", "ctr", "position"]);
            if (byDevice.ok) writeCsv(join(outDir, "gsc-device-history.csv"), normalizeGscRows(byDevice.rows, ["device"]), ["device", "clicks", "impressions", "ctr", "position"]);
            status.gsc = {
              status: "pulled",
              evidence: `${gscDaily.length} daily rows pulled for ${selected.siteUrl} from ${gscStartDate} to ${endDate}.`,
              property: selected.siteUrl,
              visibleSiteCount: sites.sites.length,
            };
          }
        }
      }
    }

    if (!scopes.hasGa4 && !force) {
      blockers.push({
        surface: "GA4 local token / New Reward provider",
        status: "blocked_local_token_scope_and_provider_reconnect",
        evidence: `The local ${token.source} token for ${account} lacks https://www.googleapis.com/auth/analytics.readonly. New Reward rows exist for canonical website ${providerSummary.canonicalWebsiteId || "unknown"}, but the Air Express GA4 credential is ${providerSummary.ga4.credentialStatus || "unknown"}, connection is ${providerSummary.ga4.connectionStatus || "unknown"}, and propertyId present=${providerSummary.ga4.propertyIdPresent}.`,
        nextAction: `Either re-authorize this machine for direct history pulls, or reconnect GA4 inside New Reward as ${account} and select the property/web stream containing G-JZ7PY32EVX for website ${providerSummary.canonicalWebsiteId || "cmorqbs9j001r5nr1h25vosp8"}.`,
      });
      status.ga4 = {
        status: "blocked_local_token_scope",
        evidence: `Local ${token.source} token lacks analytics.readonly; New Reward GA4 provider row is ${providerSummary.ga4.credentialStatus || "unknown"}, connection ${providerSummary.ga4.connectionStatus || "unknown"}, propertyId present=${providerSummary.ga4.propertyIdPresent}.`,
      };
    } else {
      const properties = await listGa4Properties(token.token);
      if (!properties.ok) {
        blockers.push({
          surface: "GA4 properties",
          status: "blocked",
          evidence: properties.blocker,
          nextAction: "Confirm GA4 property access for Air Express.",
        });
        status.ga4 = { status: "blocked", evidence: properties.blocker };
      } else {
        const selected = selectGa4Property(properties.properties, explicitGa4PropertyId);
        if (!selected) {
          blockers.push({
            surface: "GA4 property",
            status: "blocked",
            evidence: `No Air Express GA4 property found among ${properties.properties.length} visible properties.`,
            nextAction: "Pass --ga4-property-id or grant/select the property containing G-JZ7PY32EVX.",
          });
          status.ga4 = { status: "blocked_property", evidence: "No matching Air Express GA4 property found." };
        } else {
          const metrics = ["sessions", "totalUsers", "activeUsers", "eventCount", "conversions", "engagementRate"];
          const daily = await queryGa4(token.token, selected.propertyId, ga4StartDate, endDate, ["date"], metrics);
          if (!daily.ok) {
            blockers.push({
              surface: "GA4 history",
              status: "blocked",
              evidence: daily.blocker,
              nextAction: "Confirm property permission, property ID, and API quota, then rerun.",
            });
            status.ga4 = { status: "blocked_query", evidence: daily.blocker };
          } else {
            ga4Daily = normalizeGa4Rows(daily.rows, ["date"], metrics);
            const channel = await queryGa4(token.token, selected.propertyId, ga4StartDate, endDate, ["date", "sessionDefaultChannelGroup"], metrics);
            const landing = await queryGa4(token.token, selected.propertyId, ga4StartDate, endDate, ["date", "landingPagePlusQueryString"], metrics);
            const events = await queryGa4(token.token, selected.propertyId, ga4StartDate, endDate, ["date", "eventName"], ["eventCount", "totalUsers"]);
            writeCsv(join(outDir, "ga4-daily-history.csv"), ga4Daily, ["date", ...metrics]);
            if (channel.ok) {
              ga4Channel = normalizeGa4Rows(channel.rows, ["date", "sessionDefaultChannelGroup"], metrics);
              writeCsv(join(outDir, "ga4-channel-history.csv"), ga4Channel, ["date", "sessionDefaultChannelGroup", ...metrics]);
            }
            if (landing.ok) writeCsv(join(outDir, "ga4-landing-page-history.csv"), normalizeGa4Rows(landing.rows, ["date", "landingPagePlusQueryString"], metrics), ["date", "landingPagePlusQueryString", ...metrics]);
            if (events.ok) {
              ga4Event = normalizeGa4Rows(events.rows, ["date", "eventName"], ["eventCount", "totalUsers"]);
              writeCsv(join(outDir, "ga4-event-history.csv"), ga4Event, ["date", "eventName", "eventCount", "totalUsers"]);
            }
            status.ga4 = {
              status: "pulled",
              evidence: `${ga4Daily.length} daily rows pulled for selected GA4 property from ${ga4StartDate} to ${endDate}.`,
              propertyIdHash: redactPropertyId(selected.propertyId),
              displayName: selected.displayName,
              accountDisplayName: selected.accountDisplayName,
              visiblePropertyCount: properties.properties.length,
            };
          }
        }
      }
    }

    if (!includeGbp) {
      status.gbp = {
        status: "not_included",
        evidence: "Google Business Profile was intentionally excluded from this pull; current Air Express attribution refresh is scoped to GSC and GA4.",
      };
    } else if (!scopes.hasGbp && !force) {
      blockers.push({
        surface: "Google Business Profile local token",
        status: "blocked_local_token_scope",
        evidence: `Active gcloud account exists, but token lacks ${GBP_SCOPE}.`,
        nextAction: `Run approved read-only re-auth for ${account} with Business Profile scope, confirm Air Express location visibility, then rerun npm run pull:gsc-ga4-history.`,
      });
      status.gbp = {
        status: "blocked_local_token_scope",
        evidence: "Local token lacks business.manage OAuth scope. This does not prove current Air Express GBP owner/manager access.",
      };
    } else {
      const accounts = await listGbpAccounts(token.token);
      if (!accounts.ok) {
        blockers.push({
          surface: "Google Business Profile accounts",
          status: "blocked",
          evidence: accounts.blocker,
          nextAction: "Confirm Business Profile API access and manager/owner access for Air Express.",
        });
        status.gbp = { status: "blocked", evidence: accounts.blocker };
      } else {
        const locationResults = await Promise.all(
          accounts.accounts.map((gbpAccount) => listGbpLocations(token.token, gbpAccount.name)),
        );
        const failedLocationResult = locationResults.find((result) => !result.ok);
        if (failedLocationResult) {
          blockers.push({
            surface: "Google Business Profile locations",
            status: "blocked",
            evidence: failedLocationResult.blocker,
            nextAction: "Confirm location-list permission for the account that manages Air Express.",
          });
          status.gbp = { status: "blocked_location", evidence: failedLocationResult.blocker };
        } else {
          const locations = locationResults.flatMap((result) => result.locations);
          const selected = selectGbpLocation(locations);
          if (!selected) {
            blockers.push({
              surface: "Google Business Profile location",
              status: "blocked",
              evidence: `No Air Express location found among ${locations.length} visible Business Profile locations.`,
              nextAction: "Invite/select the Air Express Business Profile location before pulling performance history.",
            });
            status.gbp = {
              status: "blocked_location",
              evidence: "No matching Air Express Business Profile location found.",
              visibleLocationCount: locations.length,
            };
          } else {
            const performance = await queryGbpPerformance(token.token, selected.name, gscStartDate, endDate);
            if (!performance.ok) {
              blockers.push({
                surface: "Google Business Profile performance",
                status: "blocked",
                evidence: performance.blocker,
                nextAction: "Confirm location permission, API quota, and Business Profile Performance API access, then rerun.",
              });
              status.gbp = { status: "blocked_query", evidence: performance.blocker };
            } else {
              writeCsv(join(outDir, "gbp-daily-history.csv"), performance.rows, ["date", "metric", "value"]);
              status.gbp = {
                status: "pulled",
                evidence: `${performance.rows.length} Business Profile daily metric rows pulled for selected Air Express location from ${gscStartDate} to ${endDate}.`,
                locationNameHash: redactPropertyId(selected.name),
                title: selected.title || "",
                visibleLocationCount: locations.length,
              };
            }
          }
        }
      }
    }
  }

  status.status = status.gsc.status === "pulled" || status.ga4.status === "pulled" || status.gbp.status === "pulled"
    ? "partial_or_pulled"
    : "blocked";
  status.periodSummaries = periodSummaries({ gscDaily, ga4Daily, endDate });
  status.clientFriendlySummary = buildClientFriendlySummary({
    status: status.status,
    gscDaily,
    gscQuery,
    ga4Daily,
    ga4Channel,
    ga4Event,
    summaries: status.periodSummaries,
    serviceTitan: status.serviceTitan,
  });
  status.clientFriendlySummary = applySavedSnapshotSummary(
    status.clientFriendlySummary,
    newRewardSnapshots,
  );
  status.newRewardSnapshotHistory = newRewardSnapshots;
  writeCsv(join(outDir, "ai-prompt-quality-review.csv"), AI_PROMPT_REVIEW_ROWS, [
    "area",
    "state",
    "evidence",
    "recommendation",
  ]);
  writeCsv(join(outDir, "ai-recommended-weekly-prompts.csv"), RECOMMENDED_AI_PROMPT_ROWS, [
    "category",
    "prompt",
    "purpose",
  ]);
  writeFileSync(join(outDir, "history-pull-status.json"), `${JSON.stringify(status, null, 2)}\n`);
  writeFileSync(
    reportPath,
    renderReport({
      status: status.status === "partial_or_pulled" ? "pulled" : "blocked",
      generatedAt,
      account,
      source,
      blockers,
      gsc: status.gsc,
      ga4: status.ga4,
      gbp: status.gbp,
      summaries: status.periodSummaries,
      token: status.token,
      evidenceStates: status.evidenceStates,
      serviceTitan: status.serviceTitan,
      clientSummary: status.clientFriendlySummary,
      newRewardSnapshots,
      newRewardProvider: providerSummary,
      tokenRepairAttempt,
    }),
  );

  process.stdout.write(
    JSON.stringify(
      {
        status: status.status,
        gsc: status.gsc.status,
        ga4: status.ga4.status,
        gbp: status.gbp.status,
        blockers: blockers.length,
        outDir,
        reportPath,
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
