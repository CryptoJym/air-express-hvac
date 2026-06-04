#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const DEFAULT_ENV_FILES = [
  "/Users/jamesbrady/.config/newrewards/.env",
  "/Users/jamesbrady/Projects/NewRewards/.env",
  "/Users/jamesbrady/Projects/NewRewards/.env.local",
  "/Users/jamesbrady/Projects/NewRewards/.env.vercel",
  "/Users/jamesbrady/Projects/NewRewards/.vercel/.env.production.local",
  "/Users/jamesbrady/Projects/NewRewards/.vercel/.env.development.local",
];
const CONNECTION_KEYS = [
  "DIRECT_URL",
  "DEDICATED_DIRECT_URL",
  "DATABASE_URL",
  "DEDICATED_DATABASE_URL",
  "DATABASE_PUBLIC_URL",
];
const PSQL_SUPPORTED_URI_PARAMS = new Set([
  "application_name",
  "channel_binding",
  "client_encoding",
  "connect_timeout",
  "fallback_application_name",
  "gssencmode",
  "gsslib",
  "keepalives",
  "keepalives_count",
  "keepalives_idle",
  "keepalives_interval",
  "krbsrvname",
  "load_balance_hosts",
  "options",
  "passfile",
  "replication",
  "requirepeer",
  "requiressl",
  "service",
  "sslcert",
  "sslcompression",
  "sslcrl",
  "sslcrldir",
  "sslkey",
  "sslmode",
  "sslpassword",
  "sslrootcert",
  "sslsni",
  "target_session_attrs",
  "tcp_user_timeout",
]);

const KNOWN = {
  crmClientId: "cmmwe8so000077kqptwysqaem",
  tenantId: "cmmwe8ri500007kqpd05kb4e5",
  websiteIds: [
    "cmorqbs9j001r5nr1h25vosp8",
    "cmokaztm100065nqotpggbvwp",
    "cmnfh6pi9000dj47kvq1rhqo8",
  ],
};

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const next = process.argv[index + 1];
  return next && !next.startsWith("--") ? next : fallback;
}

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const result = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

function redactSensitive(value = "") {
  return String(value)
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[redacted-db-url]")
    .replace(/postgres:[^@\s"']+@[^\s"']+/gi, "[redacted-db-url]")
    .replace(/(access[_-]?token["']?\s*[:=]\s*["']?)[^"',\s]+/gi, "$1[redacted]")
    .replace(/(refresh[_-]?token["']?\s*[:=]\s*["']?)[^"',\s]+/gi, "$1[redacted]")
    .slice(0, 1000);
}

function psqlSafeVariant(connection) {
  let parsed;
  try {
    parsed = new URL(connection.value);
  } catch {
    return null;
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) return null;

  const removedUriParams = [];
  for (const key of new Set(parsed.searchParams.keys())) {
    if (PSQL_SUPPORTED_URI_PARAMS.has(key)) continue;
    removedUriParams.push(key);
    parsed.searchParams.delete(key);
  }
  if (!removedUriParams.length) return null;
  return {
    ...connection,
    value: parsed.toString(),
    variant: "psql_safe_uri",
    removedUriParams: removedUriParams.sort(),
  };
}

function connectionCandidates(envFiles) {
  const candidates = [];
  for (const envFile of envFiles) {
    const env = parseEnvFile(envFile);
    for (const key of CONNECTION_KEYS) {
      if (!env[key]) continue;
      const candidate = {
        key,
        value: env[key],
        envFile,
        source: "env_file",
        variant: "original",
        removedUriParams: [],
      };
      candidates.push(candidate);
      const safe = psqlSafeVariant(candidate);
      if (safe) candidates.push(safe);
    }
  }
  return candidates;
}

function sqlArray(values) {
  return `ARRAY[${values.map((value) => `'${String(value).replaceAll("'", "''")}'`).join(",")}]`;
}

function buildSql() {
  const websites = sqlArray(KNOWN.websiteIds);
  const client = KNOWN.crmClientId.replaceAll("'", "''");
  const tenant = KNOWN.tenantId.replaceAll("'", "''");
  return `
WITH target AS (SELECT unnest(${websites}) AS website_id),
gsc_snapshots AS (
  SELECT
    id,
    "websiteId",
    date,
    "dateRange",
    "connectionStatus",
    ("snapshotData"->>'rowCount')::int AS row_count,
    ("snapshotData"->>'totalClicks')::int AS total_clicks,
    ("snapshotData"->>'totalImpressions')::int AS total_impressions,
    ("snapshotData"->>'averageCtr')::float AS average_ctr,
    ("snapshotData"->>'averagePosition')::float AS average_position,
    "createdAt"
  FROM "GscSnapshot"
  WHERE "websiteId" IN (SELECT website_id FROM target)
),
gsc_connections AS (
  SELECT id
  FROM "GscConnection"
  WHERE "websiteId" IN (SELECT website_id FROM target)
),
gsc_ranking_summary AS (
  SELECT
    count(*)::int AS rows,
    min("dataDate") AS first_date,
    max("dataDate") AS last_date,
    count(distinct "dataDate")::int AS days,
    coalesce(sum(clicks), 0)::int AS clicks,
    coalesce(sum(impressions), 0)::int AS impressions,
    avg(position)::float AS avg_position
  FROM "GscRankingSnapshot"
  WHERE "connectionId" IN (SELECT id FROM gsc_connections)
),
gsc_ranking_top_queries AS (
  SELECT
    query,
    sum(clicks)::int AS clicks,
    sum(impressions)::int AS impressions,
    avg(position)::float AS avg_position,
    min("dataDate") AS first_date,
    max("dataDate") AS last_date
  FROM "GscRankingSnapshot"
  WHERE "connectionId" IN (SELECT id FROM gsc_connections)
    AND coalesce(query, '') <> ''
  GROUP BY query
  ORDER BY sum(clicks) DESC, sum(impressions) DESC
  LIMIT 12
),
gsc_ranking_daily AS (
  SELECT
    "dataDate" AS date,
    sum(clicks)::int AS clicks,
    sum(impressions)::int AS impressions,
    avg(position)::float AS avg_position
  FROM "GscRankingSnapshot"
  WHERE "connectionId" IN (SELECT id FROM gsc_connections)
  GROUP BY "dataDate"
  ORDER BY "dataDate"
),
gsc_latest AS (
  SELECT * FROM gsc_snapshots ORDER BY "createdAt" DESC LIMIT 1
),
ga4_snapshots AS (
  SELECT
    count(*)::int AS rows,
    min(date) AS first_date,
    max(date) AS last_date,
    count(distinct date)::int AS days,
    max("createdAt") AS last_created_at,
    jsonb_agg(DISTINCT "reportType") FILTER (WHERE "reportType" IS NOT NULL) AS report_types
  FROM "Ga4Snapshot"
  WHERE "websiteId" IN (SELECT website_id FROM target)
),
ga4_realtime AS (
  SELECT
    count(*)::int AS rows,
    min("capturedAt") AS first_captured_at,
    max("capturedAt") AS last_captured_at,
    max("activeUsers") AS max_active_users,
    coalesce(sum("eventCount"), 0)::int AS event_count,
    coalesce(sum(conversions), 0)::int AS conversions
  FROM "Ga4RealtimeMetric"
  WHERE "websiteId" IN (SELECT website_id FROM target)
),
ai_runs AS (
  SELECT
    count(*)::int AS rows,
    min("createdAt") AS first_created_at,
    max("createdAt") AS last_created_at,
    jsonb_agg(DISTINCT status) FILTER (WHERE status IS NOT NULL) AS statuses,
    jsonb_agg(DISTINCT engine) FILTER (WHERE engine IS NOT NULL) AS engines,
    coalesce(sum("queryCount"), 0)::int AS query_count
  FROM "AiVisibilityRun"
  WHERE "websiteId" IN (SELECT website_id FROM target)
     OR "clientId" = '${client}'
     OR "tenantId" = '${tenant}'
),
ai_snapshots AS (
  SELECT
    count(*)::int AS rows,
    count(distinct query)::int AS unique_queries,
    count(distinct engine)::int AS engine_count,
    min("snapshotAt") AS first_snapshot_at,
    max("snapshotAt") AS last_snapshot_at,
    coalesce(sum(CASE WHEN "mentionsBrand" THEN 1 ELSE 0 END), 0)::int AS mentions,
    coalesce(sum(CASE WHEN "isCited" THEN 1 ELSE 0 END), 0)::int AS citations
  FROM "AiVisibilitySnapshot"
  WHERE "websiteId" IN (SELECT website_id FROM target)
     OR "clientId" = '${client}'
     OR "tenantId" = '${tenant}'
),
ai_by_engine AS (
  SELECT
    engine,
    count(*)::int AS snapshots,
    coalesce(sum(CASE WHEN "mentionsBrand" THEN 1 ELSE 0 END), 0)::int AS mentions,
    coalesce(sum(CASE WHEN "isCited" THEN 1 ELSE 0 END), 0)::int AS citations
  FROM "AiVisibilitySnapshot"
  WHERE "websiteId" IN (SELECT website_id FROM target)
     OR "clientId" = '${client}'
     OR "tenantId" = '${tenant}'
  GROUP BY engine
  ORDER BY snapshots DESC
),
ai_by_day AS (
  SELECT
    date_trunc('day', "snapshotAt")::date AS date,
    count(*)::int AS snapshots,
    count(distinct query)::int AS unique_queries,
    coalesce(sum(CASE WHEN "mentionsBrand" THEN 1 ELSE 0 END), 0)::int AS mentions,
    coalesce(sum(CASE WHEN "isCited" THEN 1 ELSE 0 END), 0)::int AS citations
  FROM "AiVisibilitySnapshot"
  WHERE "websiteId" IN (SELECT website_id FROM target)
     OR "clientId" = '${client}'
     OR "tenantId" = '${tenant}'
  GROUP BY date_trunc('day', "snapshotAt")::date
  ORDER BY date
),
ai_by_week AS (
  SELECT
    date_trunc('week', "snapshotAt")::date AS week,
    count(*)::int AS snapshots,
    count(distinct query)::int AS unique_queries,
    coalesce(sum(CASE WHEN "mentionsBrand" THEN 1 ELSE 0 END), 0)::int AS mentions,
    coalesce(sum(CASE WHEN "isCited" THEN 1 ELSE 0 END), 0)::int AS citations
  FROM "AiVisibilitySnapshot"
  WHERE "websiteId" IN (SELECT website_id FROM target)
     OR "clientId" = '${client}'
     OR "tenantId" = '${tenant}'
  GROUP BY date_trunc('week', "snapshotAt")::date
  ORDER BY week
),
ai_by_run AS (
  SELECT
    r.id AS run_id,
    r.status,
    r.engine AS run_engine,
    r."queryCount" AS declared_query_count,
    r."createdAt",
    r."startedAt",
    r."completedAt",
    count(s.id)::int AS snapshots,
    count(distinct s.query)::int AS unique_queries,
    count(distinct s.engine)::int AS engine_count,
    coalesce(sum(CASE WHEN s."mentionsBrand" THEN 1 ELSE 0 END), 0)::int AS mentions,
    coalesce(sum(CASE WHEN s."isCited" THEN 1 ELSE 0 END), 0)::int AS citations
  FROM "AiVisibilityRun" r
  LEFT JOIN "AiVisibilitySnapshot" s ON s."runId" = r.id
  WHERE r."websiteId" IN (SELECT website_id FROM target)
     OR r."clientId" = '${client}'
     OR r."tenantId" = '${tenant}'
  GROUP BY r.id, r.status, r.engine, r."queryCount", r."createdAt", r."startedAt", r."completedAt"
  ORDER BY r."createdAt"
),
ai_latest_completed_run AS (
  SELECT *
  FROM ai_by_run
  WHERE status = 'completed'
  ORDER BY coalesce("completedAt", "createdAt") DESC
  LIMIT 1
),
ai_top_mentioned_questions AS (
  SELECT
    query,
    count(*)::int AS snapshots,
    coalesce(sum(CASE WHEN "mentionsBrand" THEN 1 ELSE 0 END), 0)::int AS mentions,
    coalesce(sum(CASE WHEN "isCited" THEN 1 ELSE 0 END), 0)::int AS citations,
    min("snapshotAt") AS first_seen,
    max("snapshotAt") AS last_seen
  FROM "AiVisibilitySnapshot"
  WHERE ("websiteId" IN (SELECT website_id FROM target)
     OR "clientId" = '${client}'
     OR "tenantId" = '${tenant}')
    AND coalesce(query, '') <> ''
  GROUP BY query
  HAVING coalesce(sum(CASE WHEN "mentionsBrand" THEN 1 ELSE 0 END), 0) > 0
      OR coalesce(sum(CASE WHEN "isCited" THEN 1 ELSE 0 END), 0) > 0
  ORDER BY mentions DESC, citations DESC, snapshots DESC
  LIMIT 12
),
ai_metrics AS (
  SELECT
    count(*)::int AS rows,
    min("periodStart") AS first_period,
    max("periodEnd") AS last_period,
    max("calculatedAt") AS last_calculated_at,
    avg("visibilityScore")::float AS avg_visibility_score,
    avg("citationRate")::float AS avg_citation_rate
  FROM "AiVisibilityMetrics"
  WHERE "websiteId" IN (SELECT website_id FROM target)
     OR "clientId" = '${client}'
     OR "tenantId" = '${tenant}'
),
quick_scans AS (
  SELECT
    count(*)::int AS rows,
    min("createdAt") AS first_created_at,
    max("createdAt") AS last_created_at
  FROM "PublicQuickScanRun"
  WHERE lower(coalesce(domain, '')) LIKE '%airexpress%'
     OR lower(coalesce("canonicalUrl", '')) LIKE '%airexpress%'
),
ai_traffic AS (
  SELECT
    count(*)::int AS rows,
    min(date) AS first_date,
    max(date) AS last_date,
    coalesce(sum("observedHits"), 0)::int AS observed_hits,
    coalesce(sum("verifiedHits"), 0)::int AS verified_hits,
    coalesce(sum("matchedHits"), 0)::int AS matched_hits
  FROM "AiTrafficRoiDailyRollup"
  WHERE "websiteId" IN (SELECT website_id FROM target)
     OR "clientId" = '${client}'
     OR "tenantId" = '${tenant}'
),
lead_join_counts AS (
  SELECT 'LeadTouchpoint' AS table_name, count(*)::int AS rows, min("occurredAt") AS first_at, max("occurredAt") AS last_at
  FROM "LeadTouchpoint"
  WHERE "websiteId" IN (SELECT website_id FROM target)
     OR "tenantId" = '${tenant}'
  UNION ALL
  SELECT 'LeadFormSubmission', count(*)::int, min("createdAt"), max("createdAt")
  FROM "LeadFormSubmission"
  WHERE "tenantId" = '${tenant}'
  UNION ALL
  SELECT 'LeadOpportunity', count(*)::int, min("createdAt"), max("createdAt")
  FROM "LeadOpportunity"
  WHERE "tenantId" = '${tenant}'
  UNION ALL
  SELECT 'LeadRevenueEvent', count(*)::int, min("createdAt"), max("createdAt")
  FROM "LeadRevenueEvent"
  WHERE "tenantId" = '${tenant}'
  UNION ALL
  SELECT 'AiTrafficLog', count(*)::int, min("occurredAt"), max("occurredAt")
  FROM "AiTrafficLog"
  WHERE "websiteId" IN (SELECT website_id FROM target)
     OR "clientId" = '${client}'
     OR "tenantId" = '${tenant}'
  UNION ALL
  SELECT 'CloudflareAiTrafficSnapshot', count(*)::int, min("windowStart"), max("windowEnd")
  FROM "CloudflareAiTrafficSnapshot"
  WHERE "websiteId" IN (SELECT website_id FROM target)
     OR "clientId" = '${client}'
     OR "tenantId" = '${tenant}'
  UNION ALL
  SELECT 'GscQueryMetric', count(*)::int, min("dataDate"), max("dataDate")
  FROM "GscQueryMetric"
  WHERE "websiteId" IN (SELECT website_id FROM target)
),
lead_touchpoints_by_source AS (
  SELECT
    coalesce(channel, '') AS channel,
    coalesce(source, '') AS source,
    coalesce(medium, '') AS medium,
    count(*)::int AS rows,
    min("occurredAt") AS first_at,
    max("occurredAt") AS last_at
  FROM "LeadTouchpoint"
  WHERE "websiteId" IN (SELECT website_id FROM target)
     OR "tenantId" = '${tenant}'
  GROUP BY coalesce(channel, ''), coalesce(source, ''), coalesce(medium, '')
  ORDER BY count(*) DESC
  LIMIT 20
),
lead_form_submission_summary AS (
  SELECT
    coalesce(source, '') AS source,
    coalesce(status, '') AS status,
    count(*)::int AS rows,
    min("createdAt") AS first_at,
    max("createdAt") AS last_at
  FROM "LeadFormSubmission"
  WHERE "tenantId" = '${tenant}'
  GROUP BY coalesce(source, ''), coalesce(status, '')
  ORDER BY count(*) DESC
  LIMIT 20
),
lead_revenue_summary AS (
  SELECT
    coalesce(type, '') AS type,
    coalesce(currency, '') AS currency,
    count(*)::int AS rows,
    sum(coalesce(amount, 0))::float AS amount,
    min("occurredAt") AS first_at,
    max("occurredAt") AS last_at
  FROM "LeadRevenueEvent"
  WHERE "tenantId" = '${tenant}'
  GROUP BY coalesce(type, ''), coalesce(currency, '')
  ORDER BY count(*) DESC
  LIMIT 20
),
cloudflare_ai_traffic_summary AS (
  SELECT
    coalesce("zoneName", '') AS zone_name,
    coalesce("metricSource", '') AS metric_source,
    count(*)::int AS snapshots,
    sum(coalesce("totalRequests", 0))::int AS total_requests,
    sum(coalesce("allowedRequests", 0))::int AS allowed_requests,
    sum(coalesce("successfulRequests", 0))::int AS successful_requests,
    sum(coalesce("unsuccessfulRequests", 0))::int AS unsuccessful_requests,
    sum(coalesce("totalDataTransferBytes", 0))::bigint AS total_data_transfer_bytes,
    min("windowStart") AS first_window_start,
    max("windowEnd") AS last_window_end
  FROM "CloudflareAiTrafficSnapshot"
  WHERE "websiteId" IN (SELECT website_id FROM target)
     OR "clientId" = '${client}'
     OR "tenantId" = '${tenant}'
  GROUP BY coalesce("zoneName", ''), coalesce("metricSource", '')
  ORDER BY sum(coalesce("totalRequests", 0)) DESC
  LIMIT 20
),
gsc_query_metric_summary AS (
  SELECT
    count(*)::int AS rows,
    min("dataDate") AS first_date,
    max("dataDate") AS last_date,
    count(distinct "dataDate")::int AS days,
    coalesce(sum(clicks), 0)::int AS clicks,
    coalesce(sum(impressions), 0)::int AS impressions,
    avg(position)::float AS avg_position
  FROM "GscQueryMetric"
  WHERE "websiteId" IN (SELECT website_id FROM target)
),
gsc_query_metric_top_queries AS (
  SELECT
    query,
    sum(clicks)::int AS clicks,
    sum(impressions)::int AS impressions,
    avg(position)::float AS avg_position,
    min("dataDate") AS first_date,
    max("dataDate") AS last_date
  FROM "GscQueryMetric"
  WHERE "websiteId" IN (SELECT website_id FROM target)
    AND coalesce(query, '') <> ''
  GROUP BY query
  ORDER BY sum(clicks) DESC, sum(impressions) DESC
  LIMIT 20
)
SELECT jsonb_build_object(
  'gscSnapshotSummary', (
    SELECT jsonb_build_object(
      'rows', count(*)::int,
      'firstDate', min(date),
      'lastDate', max(date),
      'lastCreatedAt', max("createdAt"),
      'latest', (SELECT to_jsonb(gsc_latest) FROM gsc_latest),
      'connectionStatuses', jsonb_agg(DISTINCT "connectionStatus")
    )
    FROM gsc_snapshots
  ),
  'gscSnapshotTrend', (SELECT coalesce(jsonb_agg(to_jsonb(gsc_snapshots) ORDER BY "createdAt"), '[]'::jsonb) FROM gsc_snapshots),
  'gscRankingSummary', (SELECT to_jsonb(gsc_ranking_summary) FROM gsc_ranking_summary),
  'gscRankingTopQueries', (SELECT coalesce(jsonb_agg(to_jsonb(gsc_ranking_top_queries)), '[]'::jsonb) FROM gsc_ranking_top_queries),
  'gscRankingDaily', (SELECT coalesce(jsonb_agg(to_jsonb(gsc_ranking_daily)), '[]'::jsonb) FROM gsc_ranking_daily),
  'ga4Snapshots', (SELECT to_jsonb(ga4_snapshots) FROM ga4_snapshots),
  'ga4Realtime', (SELECT to_jsonb(ga4_realtime) FROM ga4_realtime),
  'aiRuns', (SELECT to_jsonb(ai_runs) FROM ai_runs),
  'aiSnapshots', (SELECT to_jsonb(ai_snapshots) FROM ai_snapshots),
  'aiByEngine', (SELECT coalesce(jsonb_agg(to_jsonb(ai_by_engine)), '[]'::jsonb) FROM ai_by_engine),
  'aiByDay', (SELECT coalesce(jsonb_agg(to_jsonb(ai_by_day)), '[]'::jsonb) FROM ai_by_day),
  'aiByWeek', (SELECT coalesce(jsonb_agg(to_jsonb(ai_by_week)), '[]'::jsonb) FROM ai_by_week),
  'aiByRun', (SELECT coalesce(jsonb_agg(to_jsonb(ai_by_run)), '[]'::jsonb) FROM ai_by_run),
  'aiLatestCompletedRun', (SELECT to_jsonb(ai_latest_completed_run) FROM ai_latest_completed_run),
  'aiTopMentionedQuestions', (SELECT coalesce(jsonb_agg(to_jsonb(ai_top_mentioned_questions)), '[]'::jsonb) FROM ai_top_mentioned_questions),
  'aiMetrics', (SELECT to_jsonb(ai_metrics) FROM ai_metrics),
  'publicQuickScanRuns', (SELECT to_jsonb(quick_scans) FROM quick_scans),
  'aiTrafficRoiDailyRollup', (SELECT to_jsonb(ai_traffic) FROM ai_traffic),
  'leadJoinCounts', (SELECT coalesce(jsonb_agg(to_jsonb(lead_join_counts) ORDER BY table_name), '[]'::jsonb) FROM lead_join_counts),
  'leadTouchpointsBySource', (SELECT coalesce(jsonb_agg(to_jsonb(lead_touchpoints_by_source)), '[]'::jsonb) FROM lead_touchpoints_by_source),
  'leadFormSubmissionSummary', (SELECT coalesce(jsonb_agg(to_jsonb(lead_form_submission_summary)), '[]'::jsonb) FROM lead_form_submission_summary),
  'leadRevenueSummary', (SELECT coalesce(jsonb_agg(to_jsonb(lead_revenue_summary)), '[]'::jsonb) FROM lead_revenue_summary),
  'cloudflareAiTrafficSummary', (SELECT coalesce(jsonb_agg(to_jsonb(cloudflare_ai_traffic_summary)), '[]'::jsonb) FROM cloudflare_ai_traffic_summary),
  'gscQueryMetricSummary', (SELECT to_jsonb(gsc_query_metric_summary) FROM gsc_query_metric_summary),
  'gscQueryMetricTopQueries', (SELECT coalesce(jsonb_agg(to_jsonb(gsc_query_metric_top_queries)), '[]'::jsonb) FROM gsc_query_metric_top_queries)
)::text;
`;
}

function runPsql(candidate, sql) {
  const result = spawnSync(
    "psql",
    [candidate.value, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    return {
      ok: false,
      error: redactSensitive(result.stderr || result.error?.message || "psql failed"),
    };
  }
  const line = result.stdout.split(/\r?\n/).find((item) => item.trim().startsWith("{"));
  if (!line) return { ok: false, error: "No JSON row returned by read-only query." };
  return { ok: true, data: JSON.parse(line) };
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(path, rows, headers) {
  writeFileSync(
    path,
    `${[
      headers.join(","),
      ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
    ].join("\n")}\n`,
  );
}

function safeRate(numerator, denominator) {
  const total = Number(denominator || 0);
  return total ? Number(numerator || 0) / total : 0;
}

function withAiRates(row) {
  return {
    ...row,
    mention_rate: safeRate(row.mentions, row.snapshots),
    citation_rate: safeRate(row.citations, row.snapshots),
  };
}

function main() {
  const outDir = join(root, argValue("--out-dir", "data/google-history"));
  mkdirSync(outDir, { recursive: true });
  const candidates = connectionCandidates(DEFAULT_ENV_FILES);
  const attempts = [];
  let selected = null;
  let payload = null;

  for (const candidate of candidates) {
    const result = runPsql(candidate, buildSql());
    attempts.push({
      envFile: candidate.envFile,
      envKey: candidate.key,
      variant: candidate.variant,
      removedUriParams: candidate.removedUriParams,
      status: result.ok ? "ok" : "blocked",
      error: result.ok ? "" : result.error,
      gscSnapshotRows: result.ok ? Number(result.data?.gscSnapshotSummary?.rows || 0) : 0,
      aiSnapshotRows: result.ok ? Number(result.data?.aiSnapshots?.rows || 0) : 0,
    });
    if (result.ok && (result.data?.gscSnapshotSummary?.rows || result.data?.aiSnapshots?.rows)) {
      selected = candidate;
      payload = result.data;
      break;
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    status: payload ? "saved_snapshot_history_available" : "blocked_no_snapshot_history",
    evidenceClass: "read_only_newreward_saved_snapshot_history",
    secretHandling:
      "No database URL, OAuth token, encrypted credential, customer PII, or full AI response text is printed or stored.",
    known: KNOWN,
    selectedSource: selected
      ? {
        envFile: selected.envFile,
        envKey: selected.key,
        variant: selected.variant,
      }
      : null,
    attempts,
    ...(payload || {}),
  };

  writeFileSync(join(outDir, "newreward-snapshot-history.json"), `${JSON.stringify(output, null, 2)}\n`);
  if (payload?.gscSnapshotTrend) {
    writeCsv(join(outDir, "newreward-gsc-snapshot-trend.csv"), payload.gscSnapshotTrend, [
      "createdAt",
      "websiteId",
      "date",
      "connectionStatus",
      "row_count",
      "total_clicks",
      "total_impressions",
      "average_ctr",
      "average_position",
    ]);
  }
  if (payload?.aiByEngine) {
    writeCsv(join(outDir, "newreward-ai-visibility-engine-summary.csv"), payload.aiByEngine.map(withAiRates), [
      "engine",
      "snapshots",
      "mentions",
      "citations",
      "mention_rate",
      "citation_rate",
    ]);
  }
  if (payload?.aiByDay) {
    writeCsv(join(outDir, "newreward-ai-visibility-daily-summary.csv"), payload.aiByDay.map(withAiRates), [
      "date",
      "snapshots",
      "unique_queries",
      "mentions",
      "citations",
      "mention_rate",
      "citation_rate",
    ]);
  }
  if (payload?.aiByWeek) {
    writeCsv(join(outDir, "newreward-ai-visibility-weekly-summary.csv"), payload.aiByWeek.map(withAiRates), [
      "week",
      "snapshots",
      "unique_queries",
      "mentions",
      "citations",
      "mention_rate",
      "citation_rate",
    ]);
  }
  if (payload?.aiByRun) {
    writeCsv(join(outDir, "newreward-ai-visibility-run-summary.csv"), payload.aiByRun.map(withAiRates), [
      "createdAt",
      "completedAt",
      "status",
      "run_engine",
      "declared_query_count",
      "snapshots",
      "unique_queries",
      "engine_count",
      "mentions",
      "citations",
      "mention_rate",
      "citation_rate",
    ]);
  }
  if (payload?.aiTopMentionedQuestions) {
    writeCsv(join(outDir, "newreward-ai-visibility-question-summary.csv"), payload.aiTopMentionedQuestions.map(withAiRates), [
      "query",
      "snapshots",
      "mentions",
      "citations",
      "mention_rate",
      "citation_rate",
      "first_seen",
      "last_seen",
    ]);
  }
  if (payload?.gscRankingDaily) {
    writeCsv(join(outDir, "newreward-gsc-ranking-daily.csv"), payload.gscRankingDaily, [
      "date",
      "clicks",
      "impressions",
      "avg_position",
    ]);
  }
  if (payload?.leadJoinCounts) {
    writeCsv(join(outDir, "newreward-lead-join-counts.csv"), payload.leadJoinCounts, [
      "table_name",
      "rows",
      "first_at",
      "last_at",
    ]);
  }
  if (payload?.leadTouchpointsBySource) {
    writeCsv(join(outDir, "newreward-lead-touchpoints-by-source.csv"), payload.leadTouchpointsBySource, [
      "channel",
      "source",
      "medium",
      "rows",
      "first_at",
      "last_at",
    ]);
  }
  if (payload?.leadFormSubmissionSummary) {
    writeCsv(join(outDir, "newreward-lead-form-submission-summary.csv"), payload.leadFormSubmissionSummary, [
      "source",
      "status",
      "rows",
      "first_at",
      "last_at",
    ]);
  }
  if (payload?.leadRevenueSummary) {
    writeCsv(join(outDir, "newreward-lead-revenue-summary.csv"), payload.leadRevenueSummary, [
      "type",
      "currency",
      "rows",
      "amount",
      "first_at",
      "last_at",
    ]);
  }
  if (payload?.cloudflareAiTrafficSummary) {
    writeCsv(join(outDir, "newreward-cloudflare-ai-traffic-summary.csv"), payload.cloudflareAiTrafficSummary, [
      "zone_name",
      "metric_source",
      "snapshots",
      "total_requests",
      "allowed_requests",
      "successful_requests",
      "unsuccessful_requests",
      "total_data_transfer_bytes",
      "first_window_start",
      "last_window_end",
    ]);
  }
  if (payload?.gscQueryMetricTopQueries) {
    writeCsv(join(outDir, "newreward-gsc-query-metric-top-queries.csv"), payload.gscQueryMetricTopQueries, [
      "query",
      "clicks",
      "impressions",
      "avg_position",
      "first_date",
      "last_date",
    ]);
  }

  process.stdout.write(
    `${JSON.stringify({
      status: output.status,
      gscSnapshots: output.gscSnapshotSummary?.rows || 0,
      aiSnapshots: output.aiSnapshots?.rows || 0,
      aiRuns: output.aiRuns?.rows || 0,
      aiWeeklyRows: output.aiByWeek?.length || 0,
      ga4Snapshots: output.ga4Snapshots?.rows || 0,
      gscRankingRows: output.gscRankingSummary?.rows || 0,
      gscQueryMetricRows: output.gscQueryMetricSummary?.rows || 0,
      leadJoinRows: (output.leadJoinCounts || []).reduce((total, row) => total + Number(row.rows || 0), 0),
      cloudflareAiTrafficRows: (output.cloudflareAiTrafficSummary || []).reduce((total, row) => total + Number(row.snapshots || 0), 0),
      outPath: join(outDir, "newreward-snapshot-history.json"),
    }, null, 2)}\n`,
  );
}

main();
