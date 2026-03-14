import http from 'node:http';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = Number(process.env.REVIEW_UI_PORT || 4173);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jsonl': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4'
};

function safeResolve(urlPath) {
  const cleaned = decodeURIComponent(urlPath.split('?')[0]);
  const relative = cleaned === '/' ? '/review/index.html' : cleaned;
  const abs = path.resolve(ROOT_DIR, `.${relative}`);
  if (!abs.startsWith(ROOT_DIR)) return null;
  return abs;
}

const server = http.createServer(async (req, res) => {
  const absPath = safeResolve(req.url || '/');
  if (!absPath) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const stat = await fs.stat(absPath);
    const filePath = stat.isDirectory() ? path.join(absPath, 'index.html') : absPath;
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Review UI: http://localhost:${PORT}/review/`);
});