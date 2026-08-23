/**
 * Local dev server mirroring the Vercel layout: serves ./public statically
 * and mounts the serverless handler at POST /api/pipeline.
 *
 * Run: npm run build:site && npm run dev   (http://localhost:3000)
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import handler from '../api/pipeline.js';
import intentHandler from '../api/intent.js';

const publicDir = join(process.cwd(), 'public');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.dxf': 'application/dxf',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/api/pipeline' || url.pathname === '/api/intent') {
    const route = url.pathname === '/api/intent' ? intentHandler : handler;
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    let body: unknown = {};
    try {
      body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid JSON body' }));
      return;
    }
    await route(
      { method: req.method, body },
      {
        setHeader: (k, v) => res.setHeader(k, v),
        status: (code) => ({
          json: (data) => {
            res.writeHead(code, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
          },
        }),
      },
    );
    return;
  }

  const rel = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = join(publicDir, normalize(rel).replace(/^([.][.][/\\])+/, ''));
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Beyond Style UAE dev server: http://localhost:${port}`));
