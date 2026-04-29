#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const runbookPath = "docs/air-express-launch-runbook.md";
const tomorrowChecklistPath = "docs/air-express-tomorrow-checklist.md";
const selfPath = "scripts/verify-host-normalization.mjs";
const allowedTokenByFile = new Map([
  [runbookPath, new Set(["https://airexpresshvac.net"])],
  [tomorrowChecklistPath, new Set(["https://airexpresshvac.net", "https://www.airexpresshvac.net"])],
  ["scripts/verify-cutover.mjs", new Set(["https://airexpresshvac.net"])],
  ["tests/unit/cutover-verification.test.js", new Set(["https://airexpresshvac.net"])],
]);
const blockedHostPattern =
  /https:\/\/(?:www\.)?airexpresshvac\.net|https:\/\/option-c-nine\.vercel\.app|https:\/\/airexpresshvac\.com/g;
const excludedDirectories = new Set([
  ".backup",
  ".git",
  ".vercel",
  "audit",
  "memory",
  "node_modules",
  "output",
  "playwright-report",
  "test-results",
]);
const excludedFiles = new Set(["TECHNICAL_SEO_AUDIT_REPORT.txt"]);
const allowedExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".txt",
  ".xml",
  ".yml",
  ".yaml",
]);

function walkFiles(currentDir, relativeDir = "") {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = relativeDir
      ? path.posix.join(relativeDir, entry.name)
      : entry.name;
    const absolutePath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) {
        files.push(...walkFiles(absolutePath, relativePath));
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (relativePath === selfPath) {
      continue;
    }
    if (excludedFiles.has(relativePath)) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (allowedExtensions.has(extension)) {
      files.push(relativePath);
    }
  }

  return files;
}

function collectOffenders(relativeFilePath) {
  const absoluteFilePath = path.join(rootDir, relativeFilePath);
  const content = fs.readFileSync(absoluteFilePath, "utf8");
  const offenders = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const matches = line.match(blockedHostPattern);
    if (!matches) {
      return;
    }

    matches.forEach((token) => {
      const allowedTokens = allowedTokenByFile.get(relativeFilePath);
      const isAllowedToken = allowedTokens?.has(token) ?? false;

      if (!isAllowedToken) {
        offenders.push(`${relativeFilePath}:${index + 1}:${token}`);
      }
    });
  });

  return offenders;
}

try {
  const offenders = walkFiles(rootDir).flatMap(collectOffenders);

  if (offenders.length > 0) {
    console.error("Stale host references found:");
    console.error(offenders.join("\n"));
    process.exit(1);
  }

  console.log("Host normalization check passed.");
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(2);
}
