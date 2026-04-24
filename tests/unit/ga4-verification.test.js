import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const MEASUREMENT_ID = 'G-JZ7PY32EVX';
const SCRIPT_URL = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
const CONFIG_SNIPPET = `gtag('config', '${MEASUREMENT_ID}');`;

function collectHtmlFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(ROOT, fullPath);

    if (
      relPath.startsWith('.git') ||
      relPath.startsWith('.backup') ||
      relPath.startsWith('.vercel') ||
      relPath.startsWith('node_modules') ||
      relPath.startsWith('admin')
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      collectHtmlFiles(fullPath, results);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }

  return results;
}

test('public HTML pages include the Air Express GA4 snippet', () => {
  const htmlFiles = collectHtmlFiles(ROOT);

  assert.ok(htmlFiles.length > 0, 'expected at least one public HTML file');

  for (const filePath of htmlFiles) {
    const html = fs.readFileSync(filePath, 'utf8');
    const relPath = path.relative(ROOT, filePath);

    assert.match(
      html,
      new RegExp(SCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `${relPath} is missing the GA4 script URL`
    );
    assert.match(
      html,
      new RegExp(CONFIG_SNIPPET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `${relPath} is missing the GA4 config call`
    );
  }
});
