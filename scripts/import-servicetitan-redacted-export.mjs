import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const defaultTemplatePath = resolve(root, "data/servicetitan-redacted-export-template.csv");
const defaultOutPath = resolve(root, "data/servicetitan-redacted-export-import.csv");
const defaultStatusPath = resolve(root, "data/servicetitan-redacted-export-import-status.json");

const CANONICAL_FIELDS = [
  "service_titan_lead_id",
  "created_at",
  "campaign_id_or_source",
  "service_type_or_category",
  "lead_status",
  "booked_job_id_if_available",
  "sold_or_revenue_marker_if_approved",
];

const OUTPUT_FIELDS = [
  "source_date",
  "evidence_class",
  "service_titan_lead_id",
  "created_at",
  "new_reward_impact_period",
  "campaign_id_or_source",
  "service_type_or_category",
  "lead_status",
  "booked_job_id_if_available",
  "sold_or_revenue_marker_if_approved",
  "pii_excluded",
  "source_evidence",
  "blocker",
  "next_action",
];

const IMPACT_PERIODS = [
  {
    id: "before_new_reward_target_brief",
    label: "Before New Reward target brief",
    startDate: "",
    endDate: "2026-03-11",
  },
  {
    id: "target_brief_to_ga4_lead_proof",
    label: "Target brief to GA4/lead proof",
    startDate: "2026-03-12",
    endDate: "2026-04-23",
  },
  {
    id: "after_ga4_lead_proof",
    label: "After GA4/lead proof",
    startDate: "2026-04-24",
    endDate: "",
  },
];

const FIELD_ALIASES = new Map([
  ["service_titan_lead_id", "service_titan_lead_id"],
  ["servicetitan_lead_id", "service_titan_lead_id"],
  ["service_titan_id", "service_titan_lead_id"],
  ["lead_id", "service_titan_lead_id"],
  ["id", "service_titan_lead_id"],
  ["created_at", "created_at"],
  ["created_at_mdt", "created_at"],
  ["created", "created_at"],
  ["date", "created_at"],
  ["lead_date", "created_at"],
  ["campaign_id_or_source", "campaign_id_or_source"],
  ["campaign_id", "campaign_id_or_source"],
  ["campaign", "campaign_id_or_source"],
  ["source", "campaign_id_or_source"],
  ["source_channel", "campaign_id_or_source"],
  ["lead_source", "campaign_id_or_source"],
  ["service_type_or_category", "service_type_or_category"],
  ["service_type", "service_type_or_category"],
  ["service", "service_type_or_category"],
  ["category", "service_type_or_category"],
  ["lead_label", "service_type_or_category"],
  ["lead_status", "lead_status"],
  ["status", "lead_status"],
  ["booked_job_id_if_available", "booked_job_id_if_available"],
  ["booked_job_id", "booked_job_id_if_available"],
  ["job_id", "booked_job_id_if_available"],
  ["booking_id", "booked_job_id_if_available"],
  ["sold_or_revenue_marker_if_approved", "sold_or_revenue_marker_if_approved"],
  ["sold", "sold_or_revenue_marker_if_approved"],
  ["sold_status", "sold_or_revenue_marker_if_approved"],
  ["revenue_marker", "sold_or_revenue_marker_if_approved"],
  ["revenue_if_approved", "sold_or_revenue_marker_if_approved"],
]);

const PROHIBITED_FIELD_PATTERNS = [
  /customer/i,
  /(^|_)name($|_)/i,
  /first.*name/i,
  /last.*name/i,
  /phone/i,
  /email/i,
  /address/i,
  /street/i,
  /city/i,
  /zip/i,
  /postal/i,
  /note/i,
  /description/i,
  /payment/i,
  /card/i,
  /invoice/i,
];

const PROHIBITED_VALUE_PATTERNS = [
  {
    label: "email_address",
    pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  },
  {
    label: "phone_number",
    pattern: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/,
  },
  {
    label: "street_address",
    pattern:
      /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|circle|cir|court|ct|boulevard|blvd)\b/i,
  },
];

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const next = process.argv[index + 1];
  return next && !next.startsWith("--") ? next : fallback;
}

function normalizeHeader(value = "") {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const string = String(value);
  return /[",\n\r]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
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
  if (!rows.length) return { headers: [], records: [] };

  const [headers, ...records] = rows;
  return {
    headers,
    records: records.map((record) =>
      Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""]))
    ),
  };
}

function writeCsv(path, rows, headers) {
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${lines.join("\n")}\n`);
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function ensureTemplate(path) {
  if (!existsSync(path)) {
    writeCsv(path, [], CANONICAL_FIELDS);
  }
}

function safeRelative(path) {
  return path.startsWith(root) ? path.slice(root.length + 1) : path;
}

function buildRejectedStatus({ inputPath, status, reason, rejectedColumns = [], rejectedValues = [], rowCount = 0 }) {
  return {
    generatedAt: new Date().toISOString(),
    evidenceClass: "servicetitan_redacted_export_import",
    status,
    inputPath: inputPath ? safeRelative(inputPath) : "",
    rowCount,
    importedRows: 0,
    piiExcluded: false,
    mutationBoundary:
      "Local CSV validation only. No ServiceTitan API call, CRM mutation, live test lead, customer edit, booking edit, revenue edit, or production mutation is performed.",
    secretHandling:
      "Rejected evidence stores only column names, row numbers, and pattern labels. Raw private values, customer names, phones, emails, addresses, notes, payment data, and credential values are not written.",
    blockers: [
      {
        surface: "ServiceTitan redacted export import",
        status,
        evidence: reason,
        rejectedColumns,
        rejectedValues,
        nextAction:
          "Provide a redacted export using data/servicetitan-redacted-export-template.csv. Remove customer names, phones, emails, street addresses, raw notes, payment data, and credential material before import.",
      },
    ],
  };
}

function detectProhibitedColumns(headers) {
  return headers
    .map((header) => ({ original: header, normalized: normalizeHeader(header) }))
    .filter(({ normalized }) => PROHIBITED_FIELD_PATTERNS.some((pattern) => pattern.test(normalized)))
    .map(({ original }) => original);
}

function buildHeaderMap(headers) {
  const mapped = new Map();
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    const canonical = FIELD_ALIASES.get(normalized);
    if (canonical && !mapped.has(canonical)) {
      mapped.set(canonical, header);
    }
  }
  return mapped;
}

function detectProhibitedValues(records, headers) {
  const findings = [];
  records.forEach((record, rowIndex) => {
    for (const header of headers) {
      const value = String(record[header] || "");
      if (!value.trim()) continue;
      for (const { label, pattern } of PROHIBITED_VALUE_PATTERNS) {
        if (pattern.test(value)) {
          findings.push({
            row: rowIndex + 2,
            column: header,
            pattern: label,
          });
        }
      }
    }
  });
  return findings;
}

function importRows(records, headerMap, inputPath) {
  const today = new Date().toISOString().slice(0, 10);
  return records
    .map((record) => {
      const row = {
        source_date: today,
        evidence_class: "redacted_servicetitan_export_import",
        pii_excluded: "true",
        source_evidence: safeRelative(inputPath),
        blocker: "Owner-supplied redacted export imported locally; verify source approval and join to impact periods after GSC/GA4/GBP history is available.",
        next_action:
          "Use safe fields only for period joining; do not reintroduce customer names, phones, emails, addresses, raw notes, payment data, or credential values.",
      };
      for (const canonical of CANONICAL_FIELDS) {
        row[canonical] = String(record[headerMap.get(canonical)] || "").trim();
      }
      row.new_reward_impact_period = classifyImpactPeriod(row.created_at);
      return row;
    })
    .filter((row) => row.service_titan_lead_id || row.created_at || row.campaign_id_or_source);
}

function isoDateFromValue(value = "") {
  const match = String(value).trim().match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function classifyImpactPeriod(createdAt = "") {
  const isoDate = isoDateFromValue(createdAt);
  if (!isoDate) return "unclassified_date";

  const period = IMPACT_PERIODS.find((candidate) => {
    const afterStart = !candidate.startDate || isoDate >= candidate.startDate;
    const beforeEnd = !candidate.endDate || isoDate <= candidate.endDate;
    return afterStart && beforeEnd;
  });

  return period?.id || "unclassified_date";
}

function impactPeriodCounts(rows) {
  return rows.reduce((counts, row) => {
    const period = row.new_reward_impact_period || "unclassified_date";
    counts[period] = (counts[period] || 0) + 1;
    return counts;
  }, {});
}

function main() {
  const inputArg = argValue("--input");
  const inputPath = inputArg ? resolve(inputArg) : "";
  const templatePath = resolve(argValue("--template", defaultTemplatePath));
  const outPath = resolve(argValue("--out", defaultOutPath));
  const statusPath = resolve(argValue("--status", defaultStatusPath));

  ensureTemplate(templatePath);

  if (!inputPath) {
    writeJson(statusPath, {
      generatedAt: new Date().toISOString(),
      evidenceClass: "servicetitan_redacted_export_import",
      status: "awaiting_input",
      templatePath: safeRelative(templatePath),
      outputPath: safeRelative(outPath),
      requiredFields: CANONICAL_FIELDS,
      derivedFields: ["new_reward_impact_period"],
      impactPeriods: IMPACT_PERIODS,
      prohibitedFields: [
        "customer_name",
        "first_name",
        "last_name",
        "phone",
        "email",
        "street_address",
        "raw_notes_with_private_details",
        "payment_data",
        "credential_values",
      ],
      piiExcluded: true,
      mutationBoundary:
        "No ServiceTitan API call, CRM mutation, live test lead, customer edit, booking edit, revenue edit, provider change, or production mutation is performed.",
      nextAction:
        "Import an approved redacted export with npm run import:servicetitan-redacted-export -- --input <csv>. Use the template columns and remove customer PII before import.",
    });
    process.stdout.write(`Wrote ${templatePath}\nWrote ${statusPath}\nStatus: awaiting_input\n`);
    return;
  }

  if (!existsSync(inputPath)) {
    writeJson(statusPath, buildRejectedStatus({
      inputPath,
      status: "missing_input",
      reason: "Input CSV was not found.",
    }));
    process.stdout.write(`Wrote ${statusPath}\nStatus: missing_input\n`);
    process.exitCode = 1;
    return;
  }

  const source = readFileSync(inputPath, "utf8");
  const { headers, records } = parseCsv(source);
  const rejectedColumns = detectProhibitedColumns(headers);
  const rejectedValues = detectProhibitedValues(records, headers);

  if (!headers.length || !records.length) {
    writeJson(statusPath, buildRejectedStatus({
      inputPath,
      status: "invalid_schema",
      reason: "Input CSV must include a header row and at least one data row.",
      rowCount: records.length,
    }));
    process.stdout.write(`Wrote ${statusPath}\nStatus: invalid_schema\n`);
    process.exitCode = 1;
    return;
  }

  if (rejectedColumns.length || rejectedValues.length) {
    writeJson(statusPath, buildRejectedStatus({
      inputPath,
      status: "rejected_pii",
      reason:
        "Input CSV includes prohibited PII columns or values. Raw values were not persisted in repo-local evidence.",
      rejectedColumns,
      rejectedValues,
      rowCount: records.length,
    }));
    process.stdout.write(`Wrote ${statusPath}\nStatus: rejected_pii\n`);
    process.exitCode = 1;
    return;
  }

  const headerMap = buildHeaderMap(headers);
  const missingRequired = ["service_titan_lead_id", "created_at", "campaign_id_or_source", "lead_status"].filter(
    (field) => !headerMap.has(field)
  );
  if (missingRequired.length) {
    writeJson(statusPath, buildRejectedStatus({
      inputPath,
      status: "invalid_schema",
      reason: `Input CSV is missing required safe fields: ${missingRequired.join(", ")}.`,
      rowCount: records.length,
    }));
    process.stdout.write(`Wrote ${statusPath}\nStatus: invalid_schema\n`);
    process.exitCode = 1;
    return;
  }

  const rows = importRows(records, headerMap, inputPath);
  writeCsv(outPath, rows, OUTPUT_FIELDS);
  writeJson(statusPath, {
    generatedAt: new Date().toISOString(),
    evidenceClass: "servicetitan_redacted_export_import",
    status: rows.length ? "imported" : "imported_empty",
    inputPath: safeRelative(inputPath),
    templatePath: safeRelative(templatePath),
    outputPath: safeRelative(outPath),
    rowCount: records.length,
    importedRows: rows.length,
    impactPeriodCounts: impactPeriodCounts(rows),
    impactPeriods: IMPACT_PERIODS,
    piiExcluded: true,
    acceptedFields: CANONICAL_FIELDS,
    derivedFields: ["new_reward_impact_period"],
    mutationBoundary:
      "Local CSV import only. No ServiceTitan API call, CRM mutation, live test lead, customer edit, booking edit, revenue edit, provider change, or production mutation was performed.",
    secretHandling:
      "Only normalized lead ids, dates, campaign/source, service category, status, optional booking id, and approved sold/revenue marker are stored. Customer names, phones, emails, addresses, raw notes, payment data, and credential values are excluded.",
    nextAction:
      "Join imported safe fields to New Reward impact periods after GSC/GA4/GBP history is available. Keep customer PII out of repo-local reports.",
  });

  process.stdout.write(`Wrote ${outPath}\nWrote ${statusPath}\nStatus: ${rows.length ? "imported" : "imported_empty"}\n`);
}

main();
