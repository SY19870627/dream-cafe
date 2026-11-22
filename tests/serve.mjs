// 本機靜態伺服器（只用 Node 內建模組，不需要 python）。
// 直接執行：node tests/serve.mjs [埠號]，預設 8000；冒煙測試則 import startServer 用隨機埠。
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.md': 'text/markdown; charset=utf-8',
  '.mp3': 'audio/mpeg', // 【待定】背景音樂（Safari 用 mp3）
  '.ogg': 'audio/ogg', // 【待定】
};

// Range: bytes=a-b（Safari 播音檔常先要一小段）；只處理單一區段，看不懂就回整個檔
export function parseRange(header, size) { // 【待定】
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim()); // 【待定】
  if (!m || (m[1] === '' && m[2] === '')) return null; // 【待定】
  let start = m[1] === '' ? size - Number(m[2]) : Number(m[1]); // 【待定】
  let end = m[1] === '' || m[2] === '' ? size - 1 : Number(m[2]); // 【待定】
  start = Math.max(0, start); // 【待定】
  end = Math.min(size - 1, end); // 【待定】
  return start <= end && start < size ? { start, end } : 'bad'; // 【待定】
} // 【待定】

export function startServer(port = 0) {
  const server = http.createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path.endsWith('/')) path += 'index.html';
      const file = normalize(join(ROOT, path));
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      const body = await readFile(file);
      const type = TYPES[extname(file)] || 'application/octet-stream';
      const range = req.headers.range ? parseRange(req.headers.range, body.length) : null; // 【待定】
      if (range === 'bad') { res.writeHead(416, { 'Content-Range': `bytes */${body.length}` }).end(); return; } // 【待定】
      if (range) { // 【待定】
        res.writeHead(206, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes', // 【待定】
          'Content-Range': `bytes ${range.start}-${range.end}/${body.length}`, 'Content-Length': range.end - range.start + 1 }); // 【待定】
        res.end(body.subarray(range.start, range.end + 1)); // 【待定】
        return; // 【待定】
      } // 【待定】
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes', 'Content-Length': body.length });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r({ server, url: `http://127.0.0.1:${server.address().port}/` })));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { url } = await startServer(Number(process.argv[2]) || 8000);
  console.log(`dream-cafe：${url}（開發者模式：${url}?dev=1）`);
}
