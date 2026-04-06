import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import url from 'node:url';

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.split('=');
    return [key.replace(/^--/, ''), value ?? 'true'];
  })
);

const PORT = Number(args.get('port') || process.env.PORT || 4173);
const root = path.resolve(process.cwd(), 'option-c');
const vercelConfigPath = path.join(root, 'vercel.json');

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml']
]);

let redirectMap = new Map();
try {
  const config = JSON.parse(readFileSync(vercelConfigPath, 'utf8'));
  redirectMap = new Map((config.redirects || []).map((entry) => [entry.source, entry.destination]));
} catch {
  redirectMap = new Map();
}

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(url.parse(requestUrl).pathname || '/');
  const rawPath = pathname === '/' ? '/index.html' : pathname;
  const normalized = path.normalize(rawPath).replace(/^(\.\.[/\\])+/, '');
  const candidate = path.join(root, normalized);

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  if (!path.extname(candidate)) {
    const htmlCandidate = `${candidate}.html`;
    if (existsSync(htmlCandidate) && statSync(htmlCandidate).isFile()) {
      return htmlCandidate;
    }
  }

  return path.join(root, '404.html');
}

createServer((req, res) => {
  const parsedUrl = url.parse(req.url || '/');
  const redirectTarget = redirectMap.get(parsedUrl.pathname || '/');
  if (redirectTarget) {
    const location = `${redirectTarget}${parsedUrl.search || ''}`;
    res.writeHead(308, { Location: location, 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  const filePath = resolveRequestPath(req.url || '/');
  const ext = path.extname(filePath).toLowerCase();
  const contentType = contentTypes.get(ext) || 'application/octet-stream';
  const statusCode = path.basename(filePath) === '404.html' && req.url !== '/404.html' ? 404 : 200;

  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });

  createReadStream(filePath).pipe(res);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Serving option-c from ${root} on http://127.0.0.1:${PORT}`);
});
