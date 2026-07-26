import fs from 'fs';
import path from 'path';

const STORE_VERSION = 1;
const MAX_BACKUPS = 16;
const BACKUP_INTERVAL_MS = 10 * 60 * 1000;

function dataRootPath() {
  const explicit = process.env.GRAVITAR_DATA_DIR || process.env.GRAVITAR_SAVE_DIR || process.env.DATA_DIR;
  if (explicit) return path.resolve(explicit);
  return path.resolve(process.cwd(), '..', 'gravitar-persistent-data');
}

function filePath() {
  return path.resolve(dataRootPath(), 'clans.json');
}

function backupDirPath() {
  return path.resolve(dataRootPath(), 'backups');
}

function createBackupIfNeeded(file, ref) {
  try {
    if (!fs.existsSync(file)) return;
    const now = Date.now();
    if (now - (ref.value || 0) < BACKUP_INTERVAL_MS) return;
    const dir = backupDirPath();
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(file, path.join(dir, `clans-${stamp}.json`));
    ref.value = now;
    const files = fs.readdirSync(dir)
      .filter((name) => /^clans-.*\.json$/.test(name))
      .map((name) => ({ full: path.join(dir, name), mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const entry of files.slice(MAX_BACKUPS)) fs.rmSync(entry.full, { force: true });
  } catch {}
}

export function createClanStore() {
  const file = filePath();
  const lastBackupAtRef = { value: 0 };
  return {
    info: { file, dataDir: dataRootPath() },
    loadIntoState(state) {
      try {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        const clans = Array.isArray(raw?.clans) ? raw.clans : [];
        state.clans ??= new Map();
        for (const clan of clans) {
          if (!clan?.id || !clan?.name || !Array.isArray(clan.members)) continue;
          state.clans.set(String(clan.id), {
            id: String(clan.id),
            name: String(clan.name).slice(0, 24),
            tag: String(clan.tag || '').toUpperCase().slice(0, 5),
            leaderKey: String(clan.leaderKey || '').toLowerCase(),
            members: [...new Set(clan.members.map((key) => String(key || '').toLowerCase()).filter(Boolean))],
            createdAt: Number(clan.createdAt || Date.now()),
            raidWins: Math.max(0, clan.raidWins | 0 || 0)
          });
        }
        return state.clans.size;
      } catch {
        return 0;
      }
    },
    saveFromState(state) {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        createBackupIfNeeded(file, lastBackupAtRef);
        const clans = [...(state?.clans?.values?.() || [])].map((clan) => ({
          id: clan.id,
          name: clan.name,
          tag: clan.tag,
          leaderKey: clan.leaderKey,
          members: clan.members,
          createdAt: clan.createdAt,
          raidWins: clan.raidWins | 0 || 0
        }));
        const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
        fs.writeFileSync(tmp, JSON.stringify({ version: STORE_VERSION, updatedAt: Date.now(), clans }, null, 2));
        fs.renameSync(tmp, file);
        return true;
      } catch (error) {
        console.error('[clans] save failed', error?.stack || error);
        return false;
      }
    }
  };
}
