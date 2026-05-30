import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { serializePlayerMapState, hydratePlayerMapState } from '../map/PlayerMapState.js';
import { createPlayerPirateState, ensurePlayerPirateState } from '../player/runtime/PlayerPirateState.js';

const ACCOUNT_STORE_VERSION = 2;
const BACKUP_INTERVAL_MS = 10 * 60 * 1000;
const MAX_BACKUPS = 24;

function legacyFilePath() {
  return path.resolve(process.cwd(), 'data', 'accounts.json');
}

function dataRootPath() {
  const explicit = process.env.GRAVITAR_DATA_DIR || process.env.GRAVITAR_SAVE_DIR || process.env.DATA_DIR;
  if (explicit) return path.resolve(explicit);
  return path.resolve(process.cwd(), '..', 'gravitar-persistent-data');
}

function filePath() {
  return path.resolve(dataRootPath(), 'accounts.json');
}

function backupDirPath() {
  return path.resolve(dataRootPath(), 'backups');
}

function normalizeAccountName(name) {
  return String(name || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 18)
    .replace(/[^\p{L}\p{N} _.'’-]/gu, '')
    .trim();
}

function accountKeyFromName(name) {
  return normalizeAccountName(name).toLowerCase();
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password || ''), salt, 120000, 32, 'sha256').toString('hex');
}

function emptyDb() {
  return {
    version: ACCOUNT_STORE_VERSION,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    accounts: {}
  };
}

function safeParseJson(text, fallback = null) {
  try { return JSON.parse(text); } catch { return fallback; }
}

function readJsonFile(f) {
  try {
    const parsed = safeParseJson(fs.readFileSync(f, 'utf8'), null);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeResearch(research) {
  if (!research || typeof research !== 'object') return { completed: [], unlocked: [], active: null };
  if (!Array.isArray(research.completed)) research.completed = [];
  if (!Array.isArray(research.unlocked)) research.unlocked = [];
  research.completed = research.completed.map((v) => String(v || '')).filter((v, i, a) => v && a.indexOf(v) === i);
  research.unlocked = research.unlocked.map((v) => String(v || '')).filter((v, i, a) => v && a.indexOf(v) === i);
  if (research.active && typeof research.active !== 'object') research.active = null;
  if (research.active) {
    research.active = {
      projectId: String(research.active.projectId || ''),
      startedAt: Number(research.active.startedAt || 0),
      totalMs: Math.max(1, Number(research.active.totalMs || 1)),
      remainingMs: Math.max(0, Number(research.active.remainingMs || 0)),
      paused: !!research.active.paused,
      status: String(research.active.status || '')
    };
    if (!research.active.projectId) research.active = null;
  } else research.active = null;
  return research;
}

function normalizeProgression(prog) {
  if (!prog || typeof prog !== 'object') return null;
  if (!prog.abilityLevels || typeof prog.abilityLevels !== 'object') prog.abilityLevels = { A: 0, Z: 0, E: 0, R: 0 };
  prog.level = Math.max(1, prog.level | 0 || 1);
  prog.xp = Math.max(0, Number(prog.xp || 0));
  prog.nextXp = Math.max(1, Number(prog.nextXp || 1));
  prog.skillPoints = Math.max(0, prog.skillPoints | 0 || 0);
  return prog;
}


function normalizePirateState(pirate) {
  const state = pirate && typeof pirate === 'object' ? { ...pirate } : createPlayerPirateState();
  const probe = { pirate: state };
  return ensurePlayerPirateState(probe);
}

function normalizeMapState(map) {
  if (!map || typeof map !== 'object') return null;
  const hydrated = hydratePlayerMapState(map);
  return serializePlayerMapState(hydrated);
}

function normalizeSaveProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  profile.pseudo = normalizeAccountName(profile.pseudo || 'Pilote') || 'Pilote';
  profile.frameId = String(profile.frameId || 'vanguard');
  profile.progression = normalizeProgression(profile.progression);
  if (!profile.inv || typeof profile.inv !== 'object') profile.inv = null;
  if (!profile.equipment || typeof profile.equipment !== 'object') profile.equipment = null;
  profile.research = normalizeResearch(profile.research);
  profile.pirate = normalizePirateState(profile.pirate);
  profile.map = normalizeMapState(profile.map) || { visited: [], order: [] };
  profile.worldSeed = Number.isFinite(Number(profile.worldSeed)) ? (Number(profile.worldSeed) | 0) : 0;
  if (!Array.isArray(profile.completedBastionIds)) profile.completedBastionIds = [];
  profile.completedBastionIds = profile.completedBastionIds.map((v) => v | 0).filter((v, i, a) => Number.isFinite(v) && a.indexOf(v) === i);
  profile.schemaVersion = Math.max(1, profile.schemaVersion | 0 || 1);
  profile.savedAt = Number(profile.savedAt || Date.now());
  return profile;
}

function normalizeProfiles(account) {
  if (!account) return {};
  if (!account.profiles || typeof account.profiles !== 'object') account.profiles = {};
  if (account.endless && !account.profiles.endless) account.profiles.endless = account.endless;
  for (const [key, profile] of Object.entries(account.profiles)) {
    const normalized = normalizeSaveProfile(profile);
    if (normalized) account.profiles[key] = normalized;
    else delete account.profiles[key];
  }
  if (account.profiles.endless) account.endless = account.profiles.endless;
  return account.profiles;
}

function normalizeDb(db) {
  if (!db || typeof db !== 'object') db = emptyDb();
  if (!db.accounts || typeof db.accounts !== 'object') db.accounts = {};
  db.version = Math.max(ACCOUNT_STORE_VERSION, db.version | 0 || 1);
  db.createdAt = Number(db.createdAt || Date.now());
  db.updatedAt = Number(db.updatedAt || Date.now());

  const normalizedAccounts = {};
  for (const [rawKey, rawAccount] of Object.entries(db.accounts)) {
    const account = rawAccount && typeof rawAccount === 'object' ? rawAccount : null;
    if (!account) continue;
    const name = normalizeAccountName(account.name || rawKey);
    const key = accountKeyFromName(name || rawKey);
    if (!key || !account.salt || !account.passwordHash) continue;
    account.key = key;
    account.name = name || key;
    if (!account.battleStats || typeof account.battleStats !== 'object') account.battleStats = { played: 0, wins: 0, kills: 0, deaths: 0 };
    account.battleStats = {
      played: Math.max(0, account.battleStats.played | 0),
      wins: Math.max(0, account.battleStats.wins | 0),
      kills: Math.max(0, account.battleStats.kills | 0),
      deaths: Math.max(0, account.battleStats.deaths | 0)
    };
    normalizeProfiles(account);
    normalizedAccounts[key] = account;
  }
  db.accounts = normalizedAccounts;
  return db;
}

function rotateBackups() {
  try {
    const dir = backupDirPath();
    const files = fs.readdirSync(dir)
      .filter((name) => /^accounts-.*\.json$/.test(name))
      .map((name) => ({ name, full: path.join(dir, name), mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const file of files.slice(MAX_BACKUPS)) fs.rmSync(file.full, { force: true });
  } catch {}
}

function createBackupIfNeeded(sourceFile, lastBackupAtRef) {
  try {
    if (!fs.existsSync(sourceFile)) return lastBackupAtRef.value || 0;
    const now = Date.now();
    if (now - (lastBackupAtRef.value || 0) < BACKUP_INTERVAL_MS) return lastBackupAtRef.value || 0;
    const dir = backupDirPath();
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(sourceFile, path.join(dir, `accounts-${stamp}.json`));
    lastBackupAtRef.value = now;
    rotateBackups();
    return now;
  } catch {
    return lastBackupAtRef.value || 0;
  }
}

function readDb() {
  const f = filePath();
  let db = readJsonFile(f);
  const legacy = legacyFilePath();
  if (!db && legacy !== f) {
    const legacyDb = readJsonFile(legacy);
    if (legacyDb) {
      db = legacyDb;
      console.log(`[accounts] Migration depuis ${legacy} vers ${f}`);
    }
  }
  return normalizeDb(db || emptyDb());
}

function writeDb(db, lastBackupAtRef) {
  const f = filePath();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  createBackupIfNeeded(f, lastBackupAtRef);
  db.version = ACCOUNT_STORE_VERSION;
  db.updatedAt = Date.now();
  const tmp = `${f}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, f);
}

export function getAccountStoreInfo() {
  return {
    version: ACCOUNT_STORE_VERSION,
    dataDir: dataRootPath(),
    file: filePath(),
    legacyFile: legacyFilePath()
  };
}

export function accountProfileKeyForMode(mode) {
  const m = String(mode || '').toLowerCase();
  if (m === 'battle' || m === 'battle_next' || m === 'battle_current' || m === 'battle_server') return 'battle';
  if (m.startsWith('test') || m.includes('test')) return 'test';
  return 'endless';
}

function publicAuth(account, extra = {}) {
  const profiles = normalizeProfiles(account);
  return {
    ...extra,
    ok: true,
    key: account.key,
    name: account.name,
    battleStats: account.battleStats || null,
    profiles,
    endless: profiles.endless || account.endless || null
  };
}

export function getAccountProfileSave(auth, mode) {
  if (!auth) return null;
  const key = accountProfileKeyForMode(mode);
  if (key === 'battle') return null;
  const profiles = auth.profiles && typeof auth.profiles === 'object' ? auth.profiles : {};
  if (profiles[key]) return profiles[key];
  if (key === 'endless') return auth.endless || null;
  return null;
}

export function shouldPersistProfileMode(mode) {
  return accountProfileKeyForMode(mode) === 'endless';
}

export function createAccountStore() {
  const db = readDb();
  const lastBackupAtRef = { value: 0 };
  function save() { writeDb(db, lastBackupAtRef); }
  console.log(`[accounts] Sauvegarde persistante: ${filePath()}`);
  return {
    info: getAccountStoreInfo(),
    registerOrLogin(nameRaw, passwordRaw, action = 'login') {
      const name = normalizeAccountName(nameRaw);
      const key = accountKeyFromName(name);
      const password = String(passwordRaw || '');
      if (!key || name.length < 2) return { ok: false, error: 'Pseudo invalide' };
      if (password.length < 4) return { ok: false, error: 'Mot de passe trop court' };
      let account = db.accounts[key];
      if (!account) {
        if (action === 'login') return { ok: false, error: 'Compte introuvable' };
        const salt = crypto.randomBytes(16).toString('hex');
        account = {
          key,
          name,
          salt,
          passwordHash: hashPassword(password, salt),
          createdAt: Date.now(),
          lastLoginAt: Date.now(),
          endless: null,
          profiles: {},
          battleStats: { played: 0, wins: 0, kills: 0, deaths: 0 }
        };
        db.accounts[key] = account;
        save();
        return publicAuth(account, { created: true, message: 'Compte créé' });
      }
      normalizeProfiles(account);
      if (action === 'register') return { ok: false, error: 'Pseudo déjà utilisé' };
      if (account.passwordHash !== hashPassword(password, account.salt)) {
        return { ok: false, error: 'Mot de passe incorrect' };
      }
      account.lastLoginAt = Date.now();
      save();
      return publicAuth(account, { created: false, message: 'Connexion réussie' });
    },
    saveProfile(key, mode, snapshot) {
      const accountKey = accountKeyFromName(key);
      const account = db.accounts[accountKey];
      if (!account) return;
      const profileKey = accountProfileKeyForMode(mode);
      if (!shouldPersistProfileMode(profileKey)) return;
      const profiles = normalizeProfiles(account);
      const normalized = normalizeSaveProfile({ ...(snapshot || {}), savedAt: Date.now(), schemaVersion: 1 });
      if (!normalized) return;
      profiles[profileKey] = normalized;
      if (profileKey === 'endless') account.endless = normalized;
      account.updatedAt = Date.now();
      save();
    },
    saveEndless(key, snapshot) {
      this.saveProfile(key, 'endless', snapshot);
    },
    saveBattleStats(key, stats) {
      const accountKey = accountKeyFromName(key);
      const account = db.accounts[accountKey];
      if (!account || !stats) return;
      account.battleStats = { played: stats.played | 0, wins: stats.wins | 0, kills: stats.kills | 0, deaths: stats.deaths | 0 };
      account.updatedAt = Date.now();
      save();
    },
    flush() { save(); }
  };
}

export function buildEndlessSave(player) {
  if (!player) return null;
  return {
    pseudo: player.pseudo || '',
    frameId: player.frameId || 'vanguard',
    progression: player.progression || null,
    inv: player.inv || null,
    equipment: player.equipment || null,
    completedBastionIds: player.completedBastionIds || [],
    research: player.research || { completed: [], unlocked: [], active: null },
    pirate: normalizePirateState(player.pirate),
    map: serializePlayerMapState(player.map),
    worldSeed: player.worldSeed | 0 || 0,
    savedAt: Date.now(),
    schemaVersion: 1
  };
}

export function applyEndlessSave(player, save) {
  const normalized = normalizeSaveProfile(save);
  if (!player || !normalized) return false;
  if (normalized.pseudo) player.pseudo = String(normalized.pseudo).slice(0, 18);
  if (normalized.progression) player.progression = normalized.progression;
  if (normalized.inv) player.inv = normalized.inv;
  if (normalized.equipment) player.equipment = normalized.equipment;
  player.research = normalizeResearch(normalized.research);
  player.pirate = normalizePirateState(normalized.pirate);
  player.map = hydratePlayerMapState(normalized.map);
  player.worldSeed = normalized.worldSeed | 0 || player.worldSeed | 0 || 0;
  if (Array.isArray(normalized.completedBastionIds)) player.completedBastionIds = normalized.completedBastionIds.map((v) => v | 0);
  return true;
}
