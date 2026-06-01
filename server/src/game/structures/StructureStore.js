import fs from 'fs';
import path from 'path';
import { hydrateStructure, serializeStructure } from './StructureFactory.js';

const STORE_VERSION = 1;
const MAX_BACKUPS = 16;
const BACKUP_INTERVAL_MS = 10 * 60 * 1000;

function dataRootPath() {
  const explicit = process.env.GRAVITAR_DATA_DIR || process.env.GRAVITAR_SAVE_DIR || process.env.DATA_DIR;
  if (explicit) return path.resolve(explicit);
  return path.resolve(process.cwd(), '..', 'gravitar-persistent-data');
}

function filePath() {
  return path.resolve(dataRootPath(), 'structures.json');
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
      .filter((name) => /^structures-.*\.json$/.test(name))
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
    fs.copyFileSync(file, path.join(dir, `structures-${stamp}.json`));
    ref.value = now;
    rotateBackups();
  } catch {}
}

function emptyDb() {
  return { version: STORE_VERSION, updatedAt: Date.now(), structures: [] };
}

export function createStructureStore() {
  const lastBackupAtRef = { value: 0 };
  const f = filePath();
  let db = safeReadJson(f) || emptyDb();
  if (!Array.isArray(db.structures)) db.structures = [];
  console.log(`[structures] Sauvegarde persistante: ${f}`);

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
      console.error('[structures] save failed', err?.stack || err);
      return false;
    }
  }

  return {
    info: { file: f, dataDir: dataRootPath() },
    loadIntoState(state) {
      if (!state?.structures) return 0;
      let count = 0;
      let researchStationsRestored = 0;
      let researchInputsRestored = 0;
      let researchJobsRestored = 0;
      let maxId = state.ids?.nextEntityId || 10000;
      for (const saved of db.structures || []) {
        if (String(saved?.worldId || 'endless') !== 'endless') continue;
        const hadResearchInput = String(saved?.type || '').toLowerCase() === 'research_station'
          && saved?.scienceInput
          && typeof saved.scienceInput === 'object'
          && Object.values(saved.scienceInput).some((amount) => (amount | 0) > 0);
        const hadResearchJob = String(saved?.type || '').toLowerCase() === 'research_station'
          && !!saved?.researchJob?.projectId;
        const st = hydrateStructure(state, saved);
        if (!st || (st.damageable !== false && st.stats.hp <= 0)) continue;
        state.structures.set(st.id, st);
        maxId = Math.max(maxId, (st.id | 0) + 1);
        count += 1;
        if (String(st.type || '').toLowerCase() === 'research_station') {
          researchStationsRestored += 1;
          if (hadResearchInput) researchInputsRestored += 1;
          if (hadResearchJob) researchJobsRestored += 1;
        }
      }
      if (state.ids) state.ids.nextEntityId = Math.max(state.ids.nextEntityId | 0, maxId | 0);
      if (researchStationsRestored > 0) {
        console.log(`[structures] Research station restored: ${researchStationsRestored}`);
        if (researchInputsRestored > 0) console.log(`[structures] Research input restored: ${researchInputsRestored}`);
        if (researchJobsRestored > 0) console.log(`[structures] Research progress resumed: ${researchJobsRestored}`);
      }
      return count;
    },
    saveFromState(state) {
      if (!state?.structures) return false;
      const structures = [...state.structures.values()]
        .filter((st) => String(st.worldId || 'endless') === 'endless')
        .filter((st) => st.damageable === false || st.stats?.hp > 0)
        .map(serializeStructure)
        .filter(Boolean);
      return write({ version: STORE_VERSION, updatedAt: Date.now(), structures });
    }
  };
}
