import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function filePath() {
  return path.resolve(process.cwd(), 'data', 'accounts.json');
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

function readDb() {
  const f = filePath();
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return { accounts: {} }; }
}

function writeDb(db) {
  const f = filePath();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(db, null, 2));
}

export function accountProfileKeyForMode(mode) {
  const m = String(mode || '').toLowerCase();
  if (m === 'test' || m === 'test_server') return 'test';
  if (m === 'battle' || m === 'battle_next' || m === 'battle_current' || m === 'battle_server') return 'battle';
  return 'endless';
}

function normalizeProfiles(account) {
  if (!account) return {};
  if (!account.profiles || typeof account.profiles !== 'object') account.profiles = {};
  if (account.endless && !account.profiles.endless) account.profiles.endless = account.endless;
  return account.profiles;
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
  function save() { writeDb(db); }
  return {
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
      profiles[profileKey] = snapshot;
      if (profileKey === 'endless') account.endless = snapshot;
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
    }
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
    completedBastionIds: player.completedBastionIds || []
  };
}

export function applyEndlessSave(player, save) {
  if (!player || !save) return false;
  if (save.pseudo) player.pseudo = String(save.pseudo).slice(0, 18);
  if (save.progression) player.progression = save.progression;
  if (save.inv) player.inv = save.inv;
  if (save.equipment) player.equipment = save.equipment;
  if (Array.isArray(save.completedBastionIds)) player.completedBastionIds = save.completedBastionIds.map((v) => v | 0);
  return true;
}
