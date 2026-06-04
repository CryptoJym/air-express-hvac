import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = resolve(new URL("../..", import.meta.url).pathname);
const importer = join(root, "scripts/import-servicetitan-redacted-export.mjs");

function runImporter(args = []) {
  return spawnSync(process.execPath, [importer, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "air-express-st-import-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("ServiceTitan redacted importer writes awaiting-input status without a source export", () => {
  withTempDir((dir) => {
    const templatePath = join(dir, "template.csv");
    const outPath = join(dir, "import.csv");
    const statusPath = join(dir, "status.json");
    const result = runImporter(["--template", templatePath, "--out", outPath, "--status", statusPath]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(templatePath), true);
    assert.equal(existsSync(statusPath), true);
    assert.equal(existsSync(outPath), false);

    const status = JSON.parse(readFileSync(statusPath, "utf8"));
    assert.equal(status.status, "awaiting_input");
    assert.equal(status.piiExcluded, true);
    assert.deepEqual(status.derivedFields, ["new_reward_impact_period"]);
    assert.equal(status.impactPeriods.length, 3);
    assert.match(status.mutationBoundary, /No ServiceTitan API call/);
  });
});

test("ServiceTitan redacted importer accepts safe alias fields and normalizes output", () => {
  withTempDir((dir) => {
    const inputPath = join(dir, "safe-export.csv");
    const templatePath = join(dir, "template.csv");
    const outPath = join(dir, "import.csv");
    const statusPath = join(dir, "status.json");
    writeFileSync(
      inputPath,
      [
        "lead_id,date,source,service_type,status,job_id,revenue_marker",
        "9001,2026-04-24,80365413,AC Repair,Open,J-100,approved_sold",
      ].join("\n")
    );

    const result = runImporter([
      "--input",
      inputPath,
      "--template",
      templatePath,
      "--out",
      outPath,
      "--status",
      statusPath,
    ]);

    assert.equal(result.status, 0, result.stderr);
    const status = JSON.parse(readFileSync(statusPath, "utf8"));
    const output = readFileSync(outPath, "utf8");
    assert.equal(status.status, "imported");
    assert.equal(status.importedRows, 1);
    assert.equal(status.piiExcluded, true);
    assert.deepEqual(status.derivedFields, ["new_reward_impact_period"]);
    assert.equal(status.impactPeriodCounts.after_ga4_lead_proof, 1);
    assert.match(output, /service_titan_lead_id/);
    assert.match(output, /new_reward_impact_period/);
    assert.match(output, /9001/);
    assert.match(output, /80365413/);
    assert.match(output, /after_ga4_lead_proof/);
    assert.doesNotMatch(output, /@/);
    assert.doesNotMatch(output, /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/);
  });
});

test("ServiceTitan redacted importer classifies New Reward impact periods by lead date", () => {
  withTempDir((dir) => {
    const inputPath = join(dir, "period-export.csv");
    const templatePath = join(dir, "template.csv");
    const outPath = join(dir, "import.csv");
    const statusPath = join(dir, "status.json");
    writeFileSync(
      inputPath,
      [
        "lead_id,date,source,status",
        "8001,2026-03-11,Website,Open",
        "8002,2026-03-12,Website,Open",
        "8003,2026-04-24,80365413,Open",
      ].join("\n")
    );

    const result = runImporter([
      "--input",
      inputPath,
      "--template",
      templatePath,
      "--out",
      outPath,
      "--status",
      statusPath,
    ]);

    assert.equal(result.status, 0, result.stderr);
    const status = JSON.parse(readFileSync(statusPath, "utf8"));
    const output = readFileSync(outPath, "utf8");
    assert.equal(status.impactPeriodCounts.before_new_reward_target_brief, 1);
    assert.equal(status.impactPeriodCounts.target_brief_to_ga4_lead_proof, 1);
    assert.equal(status.impactPeriodCounts.after_ga4_lead_proof, 1);
    assert.match(output, /before_new_reward_target_brief/);
    assert.match(output, /target_brief_to_ga4_lead_proof/);
    assert.match(output, /after_ga4_lead_proof/);
  });
});

test("ServiceTitan redacted importer rejects PII columns and values without persisting raw private values", () => {
  withTempDir((dir) => {
    const inputPath = join(dir, "private-export.csv");
    const templatePath = join(dir, "template.csv");
    const outPath = join(dir, "import.csv");
    const statusPath = join(dir, "status.json");
    writeFileSync(
      inputPath,
      [
        "lead_id,date,source,status,customer_name,email",
        "9002,2026-04-24,80365413,Open,Private Person,private@example.com",
      ].join("\n")
    );

    const result = runImporter([
      "--input",
      inputPath,
      "--template",
      templatePath,
      "--out",
      outPath,
      "--status",
      statusPath,
    ]);

    assert.notEqual(result.status, 0);
    assert.equal(existsSync(outPath), false);
    const statusSource = readFileSync(statusPath, "utf8");
    const status = JSON.parse(statusSource);
    assert.equal(status.status, "rejected_pii");
    assert.equal(status.piiExcluded, false);
    assert.deepEqual(status.blockers[0].rejectedColumns.sort(), ["customer_name", "email"]);
    assert.deepEqual(status.blockers[0].rejectedValues, [
      {
        row: 2,
        column: "email",
        pattern: "email_address",
      },
    ]);
    assert.doesNotMatch(statusSource, /Private Person/);
    assert.doesNotMatch(statusSource, /private@example\.com/);
  });
});
