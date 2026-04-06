import fs from 'node:fs/promises';
import path from 'node:path';
import { buildRedirectPlan, optionFilesFromEntries } from './legacy-route-rules.mjs';

const repoRoot = process.cwd();
const targetRoot = path.join(repoRoot, 'option-c');
const auditRoot = path.join(repoRoot, 'audit');
const liveInventoryPath = path.join(auditRoot, 'live-page-inventory.json');
const vercelConfigPath = path.join(targetRoot, 'vercel.json');
const redirectPlanCsvPath = path.join(auditRoot, 'redirect-plan.csv');
const redirectPlanJsonPath = path.join(auditRoot, 'redirect-plan.json');

const DEFAULT_HEADERS = [
  {
    source: '/sitemap.xml',
    headers: [{ key: 'Content-Type', value: 'application/xml' }]
  },
  {
    source: '/robots.txt',
    headers: [{ key: 'Content-Type', value: 'text/plain' }]
  }
];

const DEFAULT_REWRITES = [{ source: '/404', destination: '/404.html' }];

const toCsv = (rows) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    const stringValue = String(value ?? '');
    return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
  };

  return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
};

const liveInventory = JSON.parse(await fs.readFile(liveInventoryPath, 'utf8'));
const liveUrls = liveInventory.map((page) => page.url).filter(Boolean);
const optionFiles = optionFilesFromEntries((await fs.readdir(targetRoot)).filter((entry) => entry.endsWith('.html')));
const redirectPlan = buildRedirectPlan({ liveUrls, optionFiles });

const existingConfigText = await fs.readFile(vercelConfigPath, 'utf8').catch(() => '');
let existingConfig = {};
if (existingConfigText) {
  try {
    existingConfig = JSON.parse(existingConfigText);
  } catch {
    existingConfig = {};
  }
}

const nextConfig = {
  headers: existingConfig.headers || DEFAULT_HEADERS,
  redirects: redirectPlan.map(({ source, destination, permanent }) => ({ source, destination, permanent })),
  rewrites: existingConfig.rewrites || DEFAULT_REWRITES,
  cleanUrls: false
};

await fs.writeFile(vercelConfigPath, `${JSON.stringify(nextConfig, null, 2)}\n`);
await fs.writeFile(
  redirectPlanJsonPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), redirects: redirectPlan }, null, 2)}\n`
);
await fs.writeFile(
  redirectPlanCsvPath,
  `${toCsv(redirectPlan.map(({ source, destination, permanent, reason }) => ({ source, destination, permanent, reason })))}\n`
);

console.log(`Synced ${redirectPlan.length} redirects into ${vercelConfigPath}`);
