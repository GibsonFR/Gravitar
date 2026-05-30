import fs from 'fs';
import path from 'path';

export const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

function dataRootPath() {
  const explicit = process.env.GRAVITAR_DATA_DIR || process.env.GRAVITAR_SAVE_DIR || process.env.DATA_DIR;
  if (explicit) return path.resolve(explicit);
  return path.resolve(process.cwd(), '..', 'gravitar-persistent-data');
}

function worldFilePath() {
  return path.resolve(dataRootPath(), 'world.json');
}

function makeNewWorldSeed() {
  return Math.floor((Date.now() ^ (Math.random() * 0x7fffffff)) & 0x7fffffff) | 0;
}

function readPersistentWorldSeed() {
  try {
    const file = worldFilePath();
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const seed = Number(parsed?.seed);
    if (Number.isFinite(seed)) return seed | 0;
  } catch {}
  return null;
}

function writePersistentWorldSeed(seed) {
  try {
    const file = worldFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const next = { version: 1, seed: seed | 0, createdAt: Date.now(), note: 'Persistent endless world seed. Delete this file or set SEED=... to reset the generated map.' };
    fs.writeFileSync(file, JSON.stringify(next, null, 2));
  } catch (err) {
    console.warn('[world] Impossible de sauvegarder world.json:', err?.message || err);
  }
}

function resolveWorldSeed() {
  if (process.env.SEED !== undefined && process.env.SEED !== '') return Number(process.env.SEED) | 0;
  const existing = readPersistentWorldSeed();
  if (existing !== null) return existing | 0;
  const seed = makeNewWorldSeed();
  writePersistentWorldSeed(seed);
  return seed | 0;
}

export const WORLD_SEED = resolveWorldSeed();
console.log(`[world] Endless seed: ${WORLD_SEED} (${process.env.SEED ? 'env SEED' : worldFilePath()})`);

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav'
};
