import fs from 'fs';
import path from 'path';
import { ensureAsteroidRespawnState } from './AsteroidRespawnState.js';

const STORE_VERSION = 1;
const MAX_BACKUPS = 8;
const BACKUP_INTERVAL_MS = 10 * 60 * 1000;

function dataRootPath() {
  const explicit = process.env.GRAVITAR_DATA_DIR || process.env.GRAVITAR_SAVE_DIR || process.env.DATA_DIR;
  if (explicit) return path.resolve(explicit);
  return path.resolve(process.cwd(), '..', 'gravitar-persistent-data');
}

function filePath() {
  return path.resolve(dataRootPath(), 'asteroid-respawns.json');
}

function backupDirPath() {
  return path.resolve(dataRootPath(), 'backups');
}

function safeReadJson(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function rotateBackups() {
  try {
    const dir = backupDirPath();
    const files = fs.readdirSync(dir)
      .filter((name) => /^asteroid-respawns-.*\.json$/.test(name))
      .map((name) => ({ name, full: path.join(dir, name), mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const file of files.slice(MAX_BACKUPS)) fs.rmSync(file.full, { force: true });
  } catch {}
}

function createBackupIfNeeded(file, ref) {
  try {
    if (!fs.existsSync(file)) return;
    const now = Date.now();
    if (now - (ref.value || 0) < BACKUP_INTERVAL_MS) return;
    const dir = backupDirPath();
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(file, path.join(dir, `asteroid-respawns-${stamp}.json`));
    ref.value = now;
    rotateBackups();
  } catch {}
}

function emptyDb() {
  return { version: STORE_VERSION, updatedAt: Date.now(), asteroids: [] };
}

function normalizeRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const sig = String(raw.sig || '').trim();
  if (!sig) return null;
  return {
    sig,
    sx: raw.sx | 0,
    sy: raw.sy | 0,
    x: Number(raw.x) || 0,
    y: Number(raw.y) || 0,
    radius: Math.max(1, Number(raw.radius) || 24),
    resource: String(raw.resource || ''),
    destroyedAt: Math.max(0, Number(raw.destroyedAt) || 0),
    respawnAt: Math.max(0, Number(raw.respawnAt) || 0)
  };
}

export function createAsteroidRespawnStore() {
  const lastBackupAtRef = { value: 0 };
  const f = filePath();
  let db = safeReadJson(f) || emptyDb();
  if (!Array.isArray(db.asteroids)) db.asteroids = [];
  console.log(`[asteroids] Sauvegarde respawn: ${f}`);

  function write(nextDb = db) {
    try {
      fs.mkdirSync(path.dirname(f), { recursive: true });
      createBackupIfNeeded(f, lastBackupAtRef);
      nextDb.version = STORE_VERSION;
      nextDb.updatedAt = Date.now();
      const tmp = `${f}.tmp-${process.pid}-${Date.now()}`;
      fs.writeFileSync(tmp, JSON.stringify(nextDb, null, 2));
      fs.renameSync(tmp, f);
      db = nextDb;
      return true;
    } catch (err) {
      console.error('[asteroids] respawn save failed', err?.stack || err);
      return false;
    }
  }

  return {
    info: { file: f, dataDir: dataRootPath() },
    loadIntoState(state) {
      ensureAsteroidRespawnState(state);
      let count = 0;
      const now = Date.now();
      for (const raw of db.asteroids || []) {
        const record = normalizeRecord(raw);
        if (!record) continue;
        if (record.respawnAt > 0 && record.respawnAt <= now) continue;
        state.destroyedAsteroidSigs.add(record.sig);
        state.destroyedAsteroidRespawnAt.set(record.sig, record.respawnAt || now);
        state.destroyedAsteroids.set(record.sig, record);
        count += 1;
      }
      if (count > 0) console.log(`[asteroids] Respawn différé restauré: ${count}`);
      return count;
    },
    saveFromState(state) {
      ensureAsteroidRespawnState(state);
      const now = Date.now();
      const asteroids = [...state.destroyedAsteroids.values()]
        .map(normalizeRecord)
        .filter(Boolean)
        .filter((record) => record.respawnAt > now)
        .sort((a, b) => a.respawnAt - b.respawnAt);
      return write({ version: STORE_VERSION, updatedAt: Date.now(), asteroids });
    }
  };
}
