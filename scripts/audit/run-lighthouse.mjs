import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const repoRoot = process.cwd();
const auditRoot = path.join(repoRoot, 'audit');
const pages = [
  'index.html',
  'contact.html',
  'request-estimate.html',
  'schedule-service.html',
  'reviews.html',
  'financing.html',
  'privacy-policy.html',
  'terms-of-service.html',
  '404.html'
];

const port = process.env.PORT || '4173';
const server = spawn('node', ['scripts/audit/serve-option-c.mjs', `--port=${port}`], {
  cwd: repoRoot,
  stdio: 'inherit'
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await wait(2_000);

const results = [];

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `Command failed with code ${code}`));
      }
    });
  });

for (const file of pages) {
  const url = `http://127.0.0.1:${port}/${file === 'index.html' ? '' : file}`;
  try {
    const { stdout } = await run('npx', [
      'lighthouse',
      url,
      '--output=json',
      '--output-path=stdout',
      '--quiet',
      '--chrome-flags=--headless --no-sandbox'
    ]);
    const report = JSON.parse(stdout);
    results.push({
      file,
      url,
      status: 'measured',
      metrics: {
        performance: Math.round((report.categories.performance?.score || 0) * 100),
        accessibility: Math.round((report.categories.accessibility?.score || 0) * 100),
        seo: Math.round((report.categories.seo?.score || 0) * 100),
        lcp: report.audits['largest-contentful-paint']?.numericValue ?? null,
        cls: report.audits['cumulative-layout-shift']?.numericValue ?? null,
        inp: report.audits['interaction-to-next-paint']?.numericValue ?? null
      }
    });
  } catch (error) {
    results.push({
      file,
      url,
      status: 'unavailable',
      notes: error instanceof Error ? error.message : String(error)
    });
  }
}

server.kill('SIGTERM');

await fs.mkdir(auditRoot, { recursive: true });
await fs.writeFile(
  path.join(auditRoot, 'lighthouse-baseline.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), status: 'complete', pages: results }, null, 2)}\n`
);

console.log('Updated audit/lighthouse-baseline.json');
