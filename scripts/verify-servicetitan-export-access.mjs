import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createServiceTitanClient, loadServiceTitanConfig } from "../api/_lib/servicetitan-client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "data", "servicetitan-export-access-check.json");
const DEFAULT_ENV_FILES = [
  join(root, ".env"),
  join(root, ".env.local"),
  join(root, ".env.production"),
  "/Users/jamesbrady/.config/newrewards/.env",
  "/Users/jamesbrady/.env",
  "/Users/jamesbrady/Projects/NewRewards/.env",
  "/Users/jamesbrady/Projects/NewRewards/.env.local",
  "/Users/jamesbrady/Projects/NewRewards/.env.vercel",
  "/Users/jamesbrady/Projects/NewRewards/.vercel/.env.production.local",
  "/Users/jamesbrady/Projects/NewRewards/.vercel/.env.development.local",
  "/Users/jamesbrady/Projects/NewRewards-air-express-resolver/.env",
  "/Users/jamesbrady/Projects/NewRewards-air-express-resolver/.env.local",
];

const REQUIRED_ENV = [
  "SERVICETITAN_ENV",
  "SERVICETITAN_TENANT_ID",
  "SERVICETITAN_APP_KEY",
  "SERVICETITAN_CLIENT_ID",
  "SERVICETITAN_CLIENT_SECRET",
];

const OPTIONAL_ENV = [
  "SERVICETITAN_API_BASE_URL",
  "SERVICETITAN_AUTH_URL",
  "SERVICETITAN_LEAD_CAMPAIGN_ID",
  "SERVICETITAN_LEAD_CALL_REASON_ID",
  "SERVICETITAN_LEAD_BUSINESS_UNIT_ID",
  "SERVICETITAN_LEAD_JOB_TYPE_ID",
];

function hasFlag(name) {
  return process.argv.includes(name);
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name) {
      const next = process.argv[index + 1];
      if (next && !next.startsWith("--")) values.push(next);
    }
  }
  return values;
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const parsed = {};
  const source = readFileSync(filePath, "utf8");
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith("\"") && value.endsWith("\"")) {
      value = value
        .slice(1, -1)
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, "\"")
        .replace(/\\\\/g, "\\");
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    value = value.trim();
    parsed[match[1]] = value;
  }
  return parsed;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function envPresence(names, sourceEnv = process.env) {
  return names.map((name) => ({
    name,
    present: Boolean(sourceEnv[name]?.trim()),
  }));
}

function buildEnvSources(envFiles) {
  const sources = [{
    label: "process.env",
    type: "process_env",
    path: "",
    exists: true,
    env: process.env,
  }];

  for (const filePath of envFiles) {
    const exists = existsSync(filePath);
    sources.push({
      label: filePath,
      type: "env_file",
      path: filePath,
      exists,
      env: exists ? parseEnvFile(filePath) : {},
    });
  }

  return sources;
}

function sourcePresenceReport(source) {
  return {
    label: source.label,
    type: source.type,
    path: source.path,
    exists: source.exists,
    requiredEnv: envPresence(REQUIRED_ENV, source.env),
    optionalEnv: envPresence(OPTIONAL_ENV, source.env),
  };
}

function mergeEnvSources(sources) {
  const merged = { ...process.env };
  const keySources = {};

  for (const source of sources) {
    for (const key of [...REQUIRED_ENV, ...OPTIONAL_ENV]) {
      const value = source.env[key];
      if (typeof value === "string" && value.trim() && !merged[key]) {
        merged[key] = value;
        keySources[key] = source.label;
      } else if (typeof value === "string" && value.trim() && source.type === "process_env") {
        keySources[key] = source.label;
      }
    }
  }

  return { merged, keySources };
}

function safeErrorMessage(error) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/access[_-]?token[=:]\s*[^,\s]+/gi, "access_token=[redacted]")
    .slice(0, 300);
}

function classify({ required, configError, authError, authAttempted, authOk }) {
  const missing = required.filter((item) => !item.present).map((item) => item.name);
  if (missing.length) return "blocked_env";
  if (configError) return "blocked_config";
  if (authAttempted && authOk) return "auth_ready_no_export";
  if (authAttempted && authError) return "blocked_auth";
  return "config_ready_auth_not_attempted";
}

async function main() {
  mkdirSync(dirname(outPath), { recursive: true });

  const envFiles = unique([...argValues("--env-file"), ...DEFAULT_ENV_FILES]);
  const envSources = buildEnvSources(envFiles);
  const { merged, keySources } = mergeEnvSources(envSources);
  const required = envPresence(REQUIRED_ENV, merged);
  const optional = envPresence(OPTIONAL_ENV, merged);
  const missingRequired = required.filter((item) => !item.present).map((item) => item.name);
  const authAllowed = !hasFlag("--no-auth");

  let publicConfig = null;
  let configError = "";
  let authAttempted = false;
  let authOk = false;
  let authError = "";

  if (!missingRequired.length) {
    try {
      const config = loadServiceTitanConfig(merged);
      publicConfig = {
        env: config.env,
        tenantId: config.tenantId,
        apiBaseUrl: config.apiBaseUrl,
        authUrl: config.authUrl,
        appKeyPresent: Boolean(config.appKey),
        clientIdPresent: Boolean(config.clientId),
      };

      if (authAllowed) {
        authAttempted = true;
        const client = createServiceTitanClient({ env: merged });
        await client.getAccessToken({ forceRefresh: true });
        authOk = true;
      }
    } catch (error) {
      if (authAttempted) {
        authError = safeErrorMessage(error);
      } else {
        configError = safeErrorMessage(error);
      }
    }
  }

  const status = classify({
    required,
    configError,
    authError,
    authAttempted,
    authOk,
  });

  const evidence = {
    generatedAt: new Date().toISOString(),
    evidenceClass: "servicetitan_export_access_readiness_check",
    status,
    secretHandling:
      "Only environment variable presence, local source labels, public endpoint names, and sanitized error text are stored. Credential values, access tokens, customer names, phones, emails, addresses, and raw lead payloads are not printed or written.",
    mutationBoundary:
      "No ServiceTitan lead, customer, job, campaign, booking, note, or revenue data is created, updated, deleted, exported, or stored by this diagnostic.",
    authCheck:
      missingRequired.length || configError
        ? "not_attempted"
        : authAttempted
          ? authOk
            ? "token_request_succeeded_no_token_stored"
            : "token_request_failed_sanitized"
          : "not_attempted_by_flag",
    requiredEnv: required,
    optionalEnv: optional,
    envSourceSearch: {
      scannedFiles: envFiles.map((filePath) => ({
        path: filePath,
        exists: existsSync(filePath),
      })),
      sourcePresence: envSources.map(sourcePresenceReport),
      keySources: Object.fromEntries(
        Object.entries(keySources).map(([key, source]) => [key, source === "process.env" ? "process.env" : source])
      ),
    },
    publicConfig,
    blockers: [
      ...(missingRequired.length
        ? [{
          surface: "ServiceTitan environment",
          status: "blocked_env",
          evidence: `Missing required env vars: ${missingRequired.join(", ")}.`,
          nextAction:
            "Provide approved read-only ServiceTitan export/API access or a redacted screenshot/export packet. Do not store credential values in repo files.",
        }]
        : []),
      ...(configError
        ? [{
          surface: "ServiceTitan config",
          status: "blocked_config",
          evidence: configError,
          nextAction: "Correct the ServiceTitan environment configuration without exposing credential values.",
        }]
        : []),
      ...(authError
        ? [{
          surface: "ServiceTitan auth",
          status: "blocked_auth",
          evidence: authError,
          nextAction:
            "Confirm app key, client id, secret, tenant id, environment, and API entitlement with Air Express/ServiceTitan owner approval.",
        }]
        : []),
    ],
    exportPacketRequirement: {
      acceptedSources: [
        "approved read-only ServiceTitan lead export",
        "redacted screenshot packet",
        "approved API export with customer PII stripped before repo storage",
      ],
      requiredFields: [
        "service_titan_lead_id",
        "created_at",
        "campaign_id_or_source",
        "service_type_or_category",
        "lead_status",
        "booked_job_id_if_available",
        "sold_or_revenue_marker_if_approved",
      ],
      prohibitedFields: [
        "customer_name",
        "phone",
        "email",
        "street_address",
        "raw_notes_with_private_details",
        "payment_data",
      ],
      localImportCommand:
        "npm run import:servicetitan-redacted-export -- --input <path-to-redacted-csv>",
      localTemplatePath: "data/servicetitan-redacted-export-template.csv",
    },
  };

  if (!existsSync(dirname(outPath))) {
    mkdirSync(dirname(outPath), { recursive: true });
  }
  writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`);

  process.stdout.write(`Wrote ${outPath}\nStatus: ${status}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
