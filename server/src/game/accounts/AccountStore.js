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
        account = { key, name, salt, passwordHash: hashPassword(password, salt), createdAt: Date.now(), endless: null, battleStats: { played: 0, wins: 0, kills: 0, deaths: 0 } };
        db.accounts[key] = account;
        save();
        return { ok: true, created: true, message: 'Compte créé', key, name: account.name, battleStats: account.battleStats || null, endless: account.endless || null };
      }
      if (action === 'register') return { ok: false, error: 'Pseudo déjà utilisé' };
      if (account.passwordHash !== hashPassword(password, account.salt)) {
        return { ok: false, error: 'Mot de passe incorrect' };
      }
      account.lastLoginAt = Date.now();
      save();
      return { ok: true, created: false, message: 'Connexion réussie', key, name: account.name || name, battleStats: account.battleStats || null, endless: account.endless || null };
    },
    saveEndless(key, snapshot) {
      const accountKey = accountKeyFromName(key);
      const account = db.accounts[accountKey];
      if (!account) return;
      account.endless = snapshot;
      account.updatedAt = Date.now();
      save();
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
