#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "data", "newreward-air-express-provider-readonly-recheck.json");

const DEFAULT_ENV_FILE = "/Users/jamesbrady/.config/newrewards/.env";
const DEFAULT_ENV_FILES = [
  DEFAULT_ENV_FILE,
  "/Users/jamesbrady/Projects/NewRewards/.env",
  "/Users/jamesbrady/Projects/NewRewards/.env.local",
  "/Users/jamesbrady/Projects/NewRewards/.env.vercel",
  "/Users/jamesbrady/Projects/NewRewards/.vercel/.env.production.local",
  "/Users/jamesbrady/Projects/NewRewards/.vercel/.env.development.local",
  "/Users/jamesbrady/Projects/NewRewards-air-express-resolver/.env",
  "/Users/jamesbrady/Projects/NewRewards-air-express-resolver/.env.local",
];
const CONNECTION_KEYS = [
  "DIRECT_URL",
  "DEDICATED_DIRECT_URL",
  "DATABASE_URL",
  "DEDICATED_DATABASE_URL",
  "UI_REFACTOR_DATABASE_URL",
  "NEWREWARDS_DIRECT_URL",
  "NEWREWARD_DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
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
  crmIntegrationWebsiteId: "cmnfh6pi9000dj47kvq1rhqo8",
  liveEdgeWebsiteId: "cmorqbs9j001r5nr1h25vosp8",
  domain: "airexpressutah.com",
  legacyDomain: "airexpresshvac.net",
  ga4MeasurementId: "G-JZ7PY32EVX",
};

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const next = process.argv[index + 1];
  return next && !next.startsWith("--") ? next : fallback;
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] !== name) continue;
    const next = process.argv[index + 1];
    if (next && !next.startsWith("--")) values.push(next);
  }
  return values;
}

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const result = {};
  const source = readFileSync(path, "utf8");
  for (const line of source.split(/\r?\n/)) {
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
    .replace(/db\.[a-z0-9.-]+\.supabase\.co(?::\d+)?\/[^\s"']+/gi, "db.[redacted].supabase.co/[redacted]")
    .replace(/(password=)[^\s"']+/gi, "$1[redacted]")
    .replace(/(access[_-]?token["']?\s*[:=]\s*["']?)[^"',\s]+/gi, "$1[redacted]")
    .replace(/(refresh[_-]?token["']?\s*[:=]\s*["']?)[^"',\s]+/gi, "$1[redacted]")
    .replace(/(encryptedData["']?\s*[:=]\s*["']?)[^"',\s]+/gi, "$1[redacted]")
    .slice(0, 1000);
}

function envFilesFromArgs() {
  const explicit = argValues("--env-file");
  return explicit.length > 0 ? explicit : DEFAULT_ENV_FILES;
}

function describeEnvFiles(envFiles) {
  return envFiles.map((envFile) => {
    const fileEnv = parseEnvFile(envFile);
    return {
      path: envFile,
      exists: existsSync(envFile),
      connectionKeys: CONNECTION_KEYS.filter((key) => Boolean(fileEnv[key])),
    };
  });
}

function findConnectionCandidates(envFiles) {
  const candidates = [];
  for (const key of CONNECTION_KEYS) {
    const value = process.env[key];
    if (!value) continue;
    candidates.push({
      key,
      value,
      envFile: "",
      source: "process.env",
    });
  }

  for (const envFile of envFiles) {
    const fileEnv = parseEnvFile(envFile);
    for (const key of CONNECTION_KEYS) {
      const value = fileEnv[key];
      if (!value) continue;
      candidates.push({
        key,
        value,
        envFile,
        source: "env_file",
      });
    }
  }
  return candidates;
}

function buildPsqlSafeUriVariant(connection) {
  let parsed;
  try {
    parsed = new URL(connection.value);
  } catch {
    return null;
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    return null;
  }

  const removedParams = [];
  for (const key of new Set(parsed.searchParams.keys())) {
    if (!PSQL_SUPPORTED_URI_PARAMS.has(key)) {
      removedParams.push(key);
      parsed.searchParams.delete(key);
    }
  }

  if (removedParams.length === 0) {
    return null;
  }

  return {
    ...connection,
    value: parsed.toString(),
    variant: "psql_safe_uri",
    normalization: "removed_unsupported_uri_params",
    removedUriParams: removedParams.sort(),
  };
}

function expandConnectionCandidates(connectionCandidates) {
  const expanded = [];
  for (const connection of connectionCandidates) {
    expanded.push({
      ...connection,
      variant: "original",
      normalization: "none",
      removedUriParams: [],
    });
    const safeVariant = buildPsqlSafeUriVariant(connection);
    if (safeVariant) {
      expanded.push(safeVariant);
    }
  }
  return expanded;
}

function psqlAvailable() {
  const result = spawnSync("psql", ["--version"], { encoding: "utf8" });
  return {
    ok: result.status === 0,
    version: result.status === 0 ? result.stdout.trim() : "",
    error: result.status === 0 ? "" : redactSensitive(result.stderr || result.error?.message || "psql unavailable"),
  };
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function buildSql() {
  const websiteIds = [KNOWN.crmIntegrationWebsiteId, KNOWN.liveEdgeWebsiteId]
    .map(sqlString)
    .join(", ");
  const domainPattern = sqlString(`%${KNOWN.domain}%`);
  const legacyPattern = sqlString(`%${KNOWN.legacyDomain}%`);
  const airExpressPattern = sqlString("%air express%");
  const measurementPattern = sqlString(`%${KNOWN.ga4MeasurementId}%`);

  return `
\\pset tuples_only on
\\pset format unaligned
BEGIN READ ONLY;
WITH table_availability AS (
  SELECT jsonb_build_object(
    'Client', to_regclass('"Client"') IS NOT NULL,
    'Website', to_regclass('"Website"') IS NOT NULL,
    'ProviderCredential', to_regclass('"ProviderCredential"') IS NOT NULL,
    'GscConnection', to_regclass('"GscConnection"') IS NOT NULL,
    'Ga4Connection', to_regclass('"Ga4Connection"') IS NOT NULL
  ) AS data
),
source_summary AS (
  SELECT jsonb_build_object(
    'rowCounts', jsonb_build_object(
      'Client', (SELECT count(*) FROM "Client"),
      'Website', (SELECT count(*) FROM "Website"),
      'ProviderCredential', (SELECT count(*) FROM "ProviderCredential"),
      'GscConnection', (SELECT count(*) FROM "GscConnection"),
      'Ga4Connection', (SELECT count(*) FROM "Ga4Connection")
    ),
    'latestUpdatedAt', jsonb_build_object(
      'Client', (SELECT max("updatedAt") FROM "Client"),
      'Website', (SELECT max("updatedAt") FROM "Website"),
      'ProviderCredential', (SELECT max("updatedAt") FROM "ProviderCredential"),
      'GscConnection', (SELECT max("updatedAt") FROM "GscConnection"),
      'Ga4Connection', (SELECT max("updatedAt") FROM "Ga4Connection")
    )
  ) AS data
),
clients AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'tenantId', c."tenantId",
    'companyName', c."companyName",
    'website', c.website,
    'status', c.status,
    'primaryWebsiteId', c."primaryWebsiteId",
    'clientActivatedAt', c."clientActivatedAt",
    'updatedAt', c."updatedAt"
  ) ORDER BY c."updatedAt" DESC), '[]'::jsonb) AS data
  FROM "Client" c
  WHERE c.id = ${sqlString(KNOWN.crmClientId)}
     OR c."tenantId" = ${sqlString(KNOWN.tenantId)}
     OR lower(coalesce(c."companyName", '')) LIKE ${airExpressPattern}
     OR lower(coalesce(c.website, '')) LIKE ${domainPattern}
     OR lower(coalesce(c.website, '')) LIKE ${legacyPattern}
),
websites AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', w.id,
    'tenantId', w."tenantId",
    'clientId', w."clientId",
    'brandId', w."brandId",
    'name', w.name,
    'domain', w.domain,
    'canonicalUrl', w."canonicalUrl",
    'gscProperty', w."gscProperty",
    'gaPropertyId', w."gaPropertyId",
    'status', w.status,
    'isPrimary', w."isPrimary",
    'updatedAt', w."updatedAt"
  ) ORDER BY w."updatedAt" DESC), '[]'::jsonb) AS data
  FROM "Website" w
  WHERE w.id IN (${websiteIds})
     OR w."tenantId" = ${sqlString(KNOWN.tenantId)}
     OR w."clientId" = ${sqlString(KNOWN.crmClientId)}
     OR lower(coalesce(w.domain, '')) LIKE ${domainPattern}
     OR lower(coalesce(w."canonicalUrl", '')) LIKE ${domainPattern}
     OR lower(coalesce(w.domain, '')) LIKE ${legacyPattern}
     OR lower(coalesce(w."canonicalUrl", '')) LIKE ${legacyPattern}
),
provider_credentials AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', pc.id,
    'tenantId', pc."tenantId",
    'websiteId', pc."websiteId",
    'provider', pc.provider,
    'credentialType', pc."credentialType",
    'validationStatus', pc."validationStatus",
    'tokenExpiresAt', pc."tokenExpiresAt",
    'lastValidatedAt', pc."lastValidatedAt",
    'hasLastError', pc."lastError" IS NOT NULL,
    'providerEmail', pc."providerMetadata"->>'email',
    'providerSiteUrl', pc."providerMetadata"->>'siteUrl',
    'providerPropertyId', pc."providerMetadata"->>'propertyId',
    'metadataKeys', (
      SELECT COALESCE(jsonb_agg(key ORDER BY key), '[]'::jsonb)
      FROM jsonb_object_keys(COALESCE(pc."providerMetadata", '{}'::jsonb)) AS key
    ),
    'createdAt', pc."createdAt",
    'updatedAt', pc."updatedAt"
  ) ORDER BY pc."updatedAt" DESC), '[]'::jsonb) AS data
  FROM "ProviderCredential" pc
  WHERE pc."tenantId" = ${sqlString(KNOWN.tenantId)}
     OR pc."websiteId" IN (${websiteIds})
     OR (
       lower(pc.provider) IN ('gsc', 'google_search_console', 'ga4', 'google_analytics', 'google_business_profile', 'gbp')
       AND (
         lower(coalesce(pc."providerMetadata"::text, '')) LIKE ${domainPattern}
         OR lower(coalesce(pc."providerMetadata"::text, '')) LIKE ${legacyPattern}
         OR coalesce(pc."providerMetadata"::text, '') LIKE ${measurementPattern}
       )
     )
),
gsc_connections AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', g.id,
    'tenantId', g."tenantId",
    'websiteId', g."websiteId",
    'siteUrl', g."siteUrl",
    'email', g.email,
    'connectionStatus', g."connectionStatus",
    'lastSyncAt', g."lastSyncAt",
    'hasLastError', g."lastError" IS NOT NULL,
    'createdAt', g."createdAt",
    'updatedAt', g."updatedAt"
  ) ORDER BY g."updatedAt" DESC), '[]'::jsonb) AS data
  FROM "GscConnection" g
  WHERE g."tenantId" = ${sqlString(KNOWN.tenantId)}
     OR g."websiteId" IN (${websiteIds})
     OR lower(coalesce(g."siteUrl", '')) LIKE ${domainPattern}
     OR lower(coalesce(g."siteUrl", '')) LIKE ${legacyPattern}
),
ga4_connections AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ga.id,
    'tenantId', ga."tenantId",
    'websiteId', ga."websiteId",
    'propertyId', ga."propertyId",
    'email', ga.email,
    'status', ga.status::text,
    'lastSyncAt', ga."lastSyncAt",
    'hasLastError', ga."lastError" IS NOT NULL,
    'createdAt', ga."createdAt",
    'updatedAt', ga."updatedAt"
  ) ORDER BY ga."updatedAt" DESC), '[]'::jsonb) AS data
  FROM "Ga4Connection" ga
  WHERE ga."tenantId" = ${sqlString(KNOWN.tenantId)}
     OR ga."websiteId" IN (${websiteIds})
     OR ga."propertyId" = ${sqlString(KNOWN.ga4MeasurementId)}
)
SELECT jsonb_pretty(jsonb_build_object(
  'tableAvailability', (SELECT data FROM table_availability),
  'sourceSummary', (SELECT data FROM source_summary),
  'targetedLookup', jsonb_build_object(
    'clients', (SELECT data FROM clients),
    'websites', (SELECT data FROM websites),
    'providerCredentials', (SELECT data FROM provider_credentials),
    'gscConnections', (SELECT data FROM gsc_connections),
    'ga4Connections', (SELECT data FROM ga4_connections)
  )
));
ROLLBACK;
`;
}

function writeReport(payload) {
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function summarizeLookup(lookup = {}) {
  const clients = lookup.clients || [];
  const websites = lookup.websites || [];
  const providerCredentials = lookup.providerCredentials || [];
  const gscConnections = lookup.gscConnections || [];
  const ga4Connections = lookup.ga4Connections || [];
  return {
    clientsFound: clients.length,
    websitesFound: websites.length,
    providerCredentialsFound: providerCredentials.length,
    gscConnectionsFound: gscConnections.length,
    ga4ConnectionsFound: ga4Connections.length,
    airExpressRowsFound:
      clients.length + websites.length + providerCredentials.length + gscConnections.length + ga4Connections.length,
  };
}

function totalSourceRows(sourceSummary = {}) {
  const rowCounts = sourceSummary.rowCounts || {};
  return Object.values(rowCounts).reduce((sum, value) => sum + Number(value || 0), 0);
}

function conclusionFor(status, summary, connectionAttempts = [], sourceSummary = {}) {
  if (status === "rows_found" || summary.airExpressRowsFound > 0) {
    return "At least one configured NewRewards database candidate contains Air Express-related rows. Reconcile the returned client, website, provider credential, GSC, and GA4 rows before reconnecting providers or deploying.";
  }
  const sourceRowCount = totalSourceRows(sourceSummary);
  const attemptedKeys = connectionAttempts
    .filter((attempt) => attempt.status !== "skipped_duplicate")
    .map((attempt) =>
      attempt.variant && attempt.variant !== "original"
        ? `${attempt.envKey} (${attempt.variant})`
        : attempt.envKey
    )
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(", ");
  if (attemptedKeys) {
    if (sourceRowCount > 0) {
      return `The configured NewRewards database candidates tested read-only (${attemptedKeys}) are populated but do not contain the known Air Express client, websites, GSC provider credentials, GA4 provider credentials, legacy GSC connections, or legacy GA4 connections. This narrows the blocker to missing Air Express rows in that source, another production source/read replica, or app-level source mapping outside the checked candidates; it is not the deployed resolver code path.`;
    }
    return `The configured NewRewards database candidates tested read-only (${attemptedKeys}) do not contain the known Air Express client, websites, GSC provider credentials, GA4 provider credentials, legacy GSC connections, or legacy GA4 connections. This confirms the remaining blocker is source-of-truth/database mapping or environment selection, not the deployed resolver code path.`;
  }
  if (sourceRowCount > 0) {
    return "The locally configured NewRewards database path is populated but does not contain the known Air Express client, websites, GSC provider credentials, GA4 provider credentials, legacy GSC connections, or legacy GA4 connections. This narrows the blocker to missing Air Express rows in that source, another production source/read replica, or app-level source mapping outside the checked candidates; it is not the deployed resolver code path.";
  }
  return "The locally configured NewRewards database path is reachable but does not contain the known Air Express client, websites, GSC provider credentials, GA4 provider credentials, legacy GSC connections, or legacy GA4 connections. This confirms the remaining blocker is source-of-truth/database mapping or environment selection, not the deployed resolver code path.";
}

function firstByProvider(credentials = [], provider) {
  return credentials.find((credential) => String(credential.provider || "").toLowerCase() === provider) || null;
}

function providerHealth(lookup = emptyLookup()) {
  const primaryWebsite =
    (lookup.websites || []).find((website) => website.id === KNOWN.liveEdgeWebsiteId) ||
    (lookup.websites || []).find((website) => website.isPrimary) ||
    null;
  const gscCredential = firstByProvider(lookup.providerCredentials || [], "gsc");
  const ga4Credential = firstByProvider(lookup.providerCredentials || [], "ga4");
  const gscConnection = (lookup.gscConnections || [])[0] || null;
  const ga4Connection = (lookup.ga4Connections || [])[0] || null;
  const blockers = [];

  if (!primaryWebsite) {
    blockers.push({
      surface: "canonical_website",
      status: "blocked_missing_primary_website",
      evidence: `No primary/canonical website row matched ${KNOWN.liveEdgeWebsiteId}.`,
      nextAction: "Reconcile the Air Express website id before any Google provider reconnect or delivery sync.",
    });
  }

  if (!gscCredential || !gscConnection) {
    blockers.push({
      surface: "gsc_provider",
      status: "blocked_missing_row",
      evidence: "No GSC ProviderCredential and GscConnection pair was found for the canonical Air Express website.",
      nextAction: "Use the New Reward app session to connect or repair Search Console for the canonical website id.",
    });
  } else if (
    String(gscCredential.validationStatus || "").toLowerCase() !== "valid" ||
    String(gscConnection.connectionStatus || "").toLowerCase() !== "connected"
  ) {
    blockers.push({
      surface: "gsc_provider",
      status: "provider_expired",
      evidence: `GSC credential ${gscCredential.id} is ${gscCredential.validationStatus}; connection ${gscConnection.id} is ${gscConnection.connectionStatus}; siteUrl=${gscConnection.siteUrl || gscCredential.providerSiteUrl || "unknown"}.`,
      nextAction: "Refresh/reconnect Search Console as newrewardplatform@gmail.com after the UI confirms website id cmorqbs9j001r5nr1h25vosp8.",
    });
  }

  if (!ga4Credential || !ga4Connection) {
    blockers.push({
      surface: "ga4_provider",
      status: "blocked_missing_row",
      evidence: "No GA4 ProviderCredential and Ga4Connection pair was found for the canonical Air Express website.",
      nextAction: "Use the New Reward app session to connect or repair GA4 for the canonical website id.",
    });
  } else {
    if (
      String(ga4Credential.validationStatus || "").toLowerCase() !== "valid" ||
      String(ga4Connection.status || "").toLowerCase() !== "connected"
    ) {
      blockers.push({
        surface: "ga4_provider",
        status: "provider_expired",
        evidence: `GA4 credential ${ga4Credential.id} is ${ga4Credential.validationStatus}; connection ${ga4Connection.id} is ${ga4Connection.status}.`,
        nextAction: "Refresh/reconnect GA4 as newrewardplatform@gmail.com after the UI confirms website id cmorqbs9j001r5nr1h25vosp8.",
      });
    }
    if (!ga4Connection.propertyId && !ga4Credential.providerPropertyId) {
      blockers.push({
        surface: "ga4_property",
        status: "blocked_missing_property_id",
        evidence: `GA4 connection ${ga4Connection.id} has no propertyId and the provider credential has no providerPropertyId.`,
        nextAction: `Select the GA4 property/web stream containing measurement id ${KNOWN.ga4MeasurementId}.`,
      });
    }
  }

  return {
    canonicalWebsiteId: primaryWebsite?.id || "",
    canonicalWebsiteStatus:
      primaryWebsite?.id === KNOWN.liveEdgeWebsiteId ? "verified" : primaryWebsite ? "ambiguous" : "missing",
    providerEmail:
      gscCredential?.providerEmail ||
      gscConnection?.email ||
      ga4Credential?.providerEmail ||
      ga4Connection?.email ||
      "",
    gsc: gscCredential || gscConnection
      ? {
        credentialId: gscCredential?.id || "",
        connectionId: gscConnection?.id || "",
        credentialStatus: gscCredential?.validationStatus || "",
        connectionStatus: gscConnection?.connectionStatus || "",
        siteUrl: gscConnection?.siteUrl || gscCredential?.providerSiteUrl || "",
        tokenExpiresAt: gscCredential?.tokenExpiresAt || "",
      }
      : null,
    ga4: ga4Credential || ga4Connection
      ? {
        credentialId: ga4Credential?.id || "",
        connectionId: ga4Connection?.id || "",
        credentialStatus: ga4Credential?.validationStatus || "",
        connectionStatus: ga4Connection?.status || "",
        propertyId: ga4Connection?.propertyId || ga4Credential?.providerPropertyId || "",
        tokenExpiresAt: ga4Credential?.tokenExpiresAt || "",
      }
      : null,
    blockers,
    nextAction: blockers.length
      ? "Use james@jamesbrady.org to recheck the Air Express New Reward UI, confirm canonical website id cmorqbs9j001r5nr1h25vosp8, then refresh/reconnect GSC and GA4 as newrewardplatform@gmail.com within the read-only stop gates."
      : "Provider rows look connected in the read-only lookup; rerun Google history pull and live measurement verification before closing attribution issues.",
  };
}

function emptyLookup() {
  return {
    clients: [],
    websites: [],
    providerCredentials: [],
    gscConnections: [],
    ga4Connections: [],
  };
}

function mergeLookups(left = emptyLookup(), right = emptyLookup()) {
  const merged = emptyLookup();
  for (const key of Object.keys(merged)) {
    merged[key] = [...(left[key] || []), ...(right[key] || [])];
  }
  return merged;
}

function runLookup(connection, sqlPath) {
  const result = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", connection.value, "-f", sqlPath], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
  });

  const attemptBase = {
    envKey: connection.key,
    source: connection.source,
    envFile: connection.envFile || "",
    variant: connection.variant || "original",
    normalization: connection.normalization || "none",
    removedUriParams: connection.removedUriParams || [],
  };

  if (result.status !== 0) {
    return {
      ...attemptBase,
      status: "blocked_psql_error",
      blocker: redactSensitive(result.stderr || result.stdout || "psql read-only lookup failed."),
      targetedLookup: emptyLookup(),
      summary: summarizeLookup(emptyLookup()),
    };
  }

  const jsonStart = result.stdout.indexOf("{");
  const jsonEnd = result.stdout.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    return {
      ...attemptBase,
      status: "blocked_parse_error",
      blocker: "psql completed but did not return a JSON object.",
      targetedLookup: emptyLookup(),
      summary: summarizeLookup(emptyLookup()),
    };
  }

  try {
    const parsed = JSON.parse(result.stdout.slice(jsonStart, jsonEnd + 1));
    const targetedLookup = parsed.targetedLookup || emptyLookup();
    const summary = summarizeLookup(targetedLookup);
    return {
      ...attemptBase,
      status: summary.airExpressRowsFound > 0 ? "rows_found" : "no_rows_found",
      tableAvailability: parsed.tableAvailability || {},
      sourceSummary: parsed.sourceSummary || {},
      targetedLookup,
      summary,
    };
  } catch (error) {
    return {
      ...attemptBase,
      status: "blocked_parse_error",
      blocker: redactSensitive(error instanceof Error ? error.message : String(error)),
      targetedLookup: emptyLookup(),
      summary: summarizeLookup(emptyLookup()),
    };
  }
}

function main() {
  const envFiles = envFilesFromArgs();
  const psql = psqlAvailable();
  const connectionCandidates = findConnectionCandidates(envFiles);
  const psqlConnectionCandidates = expandConnectionCandidates(connectionCandidates);
  const base = {
    generatedAt: new Date().toISOString(),
    evidenceClass: "read_only_newrewards_configured_db_lookup",
    envFiles,
    scannedEnvFiles: describeEnvFiles(envFiles),
    secretHandling:
      "No database URL, token, encrypted credential blob, provider token, or session material was printed or stored.",
    queryMode:
      "BEGIN READ ONLY; targeted Client, Website, ProviderCredential, GscConnection, and Ga4Connection lookups; ROLLBACK for each unique configured database candidate.",
    knownAirExpressIds: KNOWN,
    tooling: {
      psqlAvailable: psql.ok,
      psqlVersion: psql.version,
      connectionCandidateKeys: connectionCandidates.map((candidate) => candidate.key),
      connectionCandidateSources: connectionCandidates.map((candidate) => ({
        envKey: candidate.key,
        source: candidate.source,
        envFile: candidate.envFile || "",
      })),
      psqlConnectionVariantCount: psqlConnectionCandidates.length,
    },
  };

  if (!psql.ok || connectionCandidates.length === 0) {
    writeReport({
      ...base,
      status: !psql.ok ? "blocked_no_psql" : "blocked_missing_db_url",
      blocker: !psql.ok
        ? psql.error || "psql is not available on PATH."
        : `No configured database URL found in process.env or scanned env files.`,
      connectionAttempts: [],
      targetedLookup: emptyLookup(),
      conclusion: !psql.ok
        ? "Read-only NewRewards mapping lookup could not run because psql is unavailable."
        : "Read-only NewRewards mapping lookup could not run because no database URL candidate was configured.",
      nextAction: !psql.ok
        ? "Install psql or run this script in an environment with psql and the authorized read-only NewRewards database URL."
        : "Provide an authorized read-only NewRewards database URL candidate, then rerun npm run verify:newreward-mapping.",
    });
    console.log(`Wrote ${outPath}`);
    return;
  }

  const tempDir = mkdtempSync(join(tmpdir(), "air-express-newreward-map-"));
  const sqlPath = join(tempDir, "lookup.sql");
  writeFileSync(sqlPath, buildSql());

  try {
    const seenConnectionValues = new Map();
    const connectionAttempts = [];
    let combinedLookup = emptyLookup();
    let bestAttempt = null;

    for (const connection of psqlConnectionCandidates) {
      const duplicateOf = seenConnectionValues.get(connection.value);
      if (duplicateOf) {
        connectionAttempts.push({
          envKey: connection.key,
          source: connection.source,
          envFile: connection.envFile || "",
          variant: connection.variant,
          normalization: connection.normalization,
          removedUriParams: connection.removedUriParams,
          status: "skipped_duplicate",
          duplicateOf,
        });
        continue;
      }
      seenConnectionValues.set(connection.value, connection.key);
      const attempt = runLookup(connection, sqlPath);
      connectionAttempts.push(attempt);
      if (attempt.status === "rows_found") {
        combinedLookup = mergeLookups(combinedLookup, attempt.targetedLookup);
      }
      if (
        !bestAttempt ||
        (attempt.status === "rows_found" && bestAttempt.status !== "rows_found") ||
        (attempt.status === "no_rows_found" && !["rows_found", "no_rows_found"].includes(bestAttempt.status))
      ) {
        bestAttempt = attempt;
      }
    }

    const rowsFoundAttempts = connectionAttempts.filter((attempt) => attempt.status === "rows_found");
    const noRowsAttempts = connectionAttempts.filter((attempt) => attempt.status === "no_rows_found");
    const status = rowsFoundAttempts.length > 0
      ? "rows_found"
      : noRowsAttempts.length > 0
        ? "no_rows_found"
        : "blocked_psql_error";
    const targetedLookup = rowsFoundAttempts.length > 0
      ? combinedLookup
      : bestAttempt?.targetedLookup || emptyLookup();
    const summary = summarizeLookup(targetedLookup);
    const rootCauseSummary = status === "rows_found" ? providerHealth(targetedLookup) : null;
    writeReport({
      ...base,
      status,
      tooling: {
        ...base.tooling,
        connectionEnvKey: bestAttempt?.envKey || "",
        connectionSource: bestAttempt?.source || "",
        connectionAttemptCount: connectionAttempts.length,
        successfulConnectionKeys: connectionAttempts
          .filter((attempt) => ["rows_found", "no_rows_found"].includes(attempt.status))
          .map((attempt) => attempt.envKey),
      },
      tableAvailability: bestAttempt?.tableAvailability || {},
      sourceSummary: bestAttempt?.sourceSummary || {},
      connectionAttempts: connectionAttempts.map((attempt) => ({
        envKey: attempt.envKey,
        source: attempt.source,
        envFile: attempt.envFile,
        variant: attempt.variant,
        normalization: attempt.normalization,
        removedUriParams: attempt.removedUriParams,
        status: attempt.status,
        duplicateOf: attempt.duplicateOf,
        tableAvailability: attempt.tableAvailability,
        sourceSummary: attempt.sourceSummary,
        summary: attempt.summary,
        blocker: attempt.blocker,
      })),
      targetedLookup,
      summary,
      rootCauseSummary,
      remainingBlockers: rootCauseSummary?.blockers || [],
      conclusion: conclusionFor(status, summary, connectionAttempts, bestAttempt?.sourceSummary || {}),
      nextAction:
        status === "rows_found"
          ? rootCauseSummary.nextAction
          : "Use an authorized New Reward app session or the correct production database/read replica for the Air Express tenant to reconcile CRM client cmmwe8so000077kqptwysqaem, tenant cmmwe8ri500007kqpd05kb4e5, website ids cmnfh6pi9000dj47kvq1rhqo8 and cmorqbs9j001r5nr1h25vosp8, and provider credential rows before any Google reconnect.",
    });
    console.log(`Wrote ${outPath}`);
    console.log(`Status: ${status}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  writeReport({
    generatedAt: new Date().toISOString(),
    evidenceClass: "read_only_newrewards_configured_db_lookup",
    envFiles: envFilesFromArgs(),
    secretHandling:
      "No database URL, token, encrypted credential blob, provider token, or session material was printed or stored.",
    status: "blocked_script_error",
    blocker: redactSensitive(error instanceof Error ? error.message : String(error)),
    knownAirExpressIds: KNOWN,
    targetedLookup: emptyLookup(),
    conclusion: "Read-only NewRewards mapping lookup could not complete.",
    nextAction: "Review the sanitized blocker and rerun after correcting the local read-only setup.",
  });
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
