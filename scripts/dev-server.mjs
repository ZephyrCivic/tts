#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const argv = process.argv.slice(2);
const get = (k, d) => {
  const i = argv.findIndex(a => a === `--${k}` || a === `-${k[0]}`);
  return i >= 0 ? argv[i + 1] : d;
};
const port = Number(process.env.PORT || get('port', get('p', 5173)));
const root = process.cwd();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon'
};

function send(res, code, headers, body) {
  res.writeHead(code, { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || '/');
  let pathname = decodeURIComponent(parsed.pathname || '/');
  if (pathname === '/') pathname = '/index.html';
  const file = path.join(root, pathname);
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback to index.html
      const indexPath = path.join(root, 'index.html');
      fs.readFile(indexPath, (e2, buf2) => {
        if (e2) return send(res, 404, { 'Content-Type': 'text/plain' }, 'Not Found');
        send(res, 200, { 'Content-Type': MIME['.html'] }, buf2);
      });
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    fs.readFile(file, (e, buf) => {
      if (e) return send(res, 500, { 'Content-Type': 'text/plain' }, 'Internal Server Error');
      send(res, 200, { 'Content-Type': type }, buf);
    });
  });
});

server.listen(port, () => {
  console.log(`Static server running: http://localhost:${port}`);
});

