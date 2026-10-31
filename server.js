import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || 8080);
const pagePath = new URL('./index.html', import.meta.url);
const page = await readFile(fileURLToPath(pagePath));
const assetRoutes = new Map([
  ['/calendar.js', { file: './calendar.js', type: 'text/javascript; charset=utf-8' }],
  ['/calendar.css', { file: './calendar.css', type: 'text/css; charset=utf-8' }],
  ['/visits.js', { file: './visits.js', type: 'text/javascript; charset=utf-8' }],
  ['/visits.css', { file: './visits.css', type: 'text/css; charset=utf-8' }]
]);

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  let content;
  let contentType;
  if (pathname === '/' || pathname === '/index.html') {
    content = page;
    contentType = 'text/html; charset=utf-8';
  } else if (assetRoutes.has(pathname)) {
    const asset = assetRoutes.get(pathname);
    content = await readFile(fileURLToPath(new URL(asset.file, import.meta.url)));
    contentType = asset.type;
  } else {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  });

  response.end(request.method === 'HEAD' ? undefined : content);
});

server.listen(port, '0.0.0.0');
