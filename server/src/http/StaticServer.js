import http from 'http';
import fs from 'fs';
import path from 'path';

const MUSIC_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav']);

function listMusicFiles(rootDir) {
  const musicDir = path.join(rootDir, 'client', 'assets', 'music');
  try {
    const entries = fs.readdirSync(musicDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => MUSIC_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .map((name) => ({
        id: name,
        title: path.basename(name, path.extname(name)),
        src: `/client/assets/music/${encodeURIComponent(name)}`
      }));
  } catch {
    return [];
  }
}

export function createStaticServer(rootDir, mime) {
  const ROOT_DIR = path.resolve(rootDir);
  const MIME = mime;

  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    let pathname = url.pathname;

    if (pathname === '/client/assets/music/index.json') {
      const payload = JSON.stringify({ tracks: listMusicFiles(ROOT_DIR) });
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(payload);
      return;
    }

    if (pathname === '/') {
      res.writeHead(302, { Location: '/client/index.html' });
      res.end();
      return;
    }

    const normalizedUrlPath = path.posix.normalize(pathname).replace(/^\/+/, '');
    const isAllowed = normalizedUrlPath.startsWith('client/') || normalizedUrlPath.startsWith('shared/');
    if (!isAllowed) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const relativeFsPath = normalizedUrlPath.split('/').join(path.sep);
    const abs = path.resolve(ROOT_DIR, relativeFsPath);
    const relativeFromRoot = path.relative(ROOT_DIR, abs);
    if (relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(abs, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(abs).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] ?? 'application/octet-stream',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(data);
    });
  });
}
