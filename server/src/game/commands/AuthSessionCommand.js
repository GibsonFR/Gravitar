import { normalizePlayerPseudo } from '../player/PlayerSessionSetup.js';

export function handleAuthSessionAccount(state, player, msg) {
  if (!player?.sessionSetupPending) return false;
  const accountAction = String(msg?.accountAction || '').toLowerCase();
  if (accountAction !== 'login' && accountAction !== 'register') return false;
  if (!state.accounts) return false;

  const accountName = normalizePlayerPseudo(msg?.accountName || msg?.pseudo);
  const auth = state.accounts.registerOrLogin(accountName, msg?.accountPassword, accountAction);
  if (!auth.ok) {
    player.accountKey = '';
    player.accountName = '';
    player.authStatus = { ok: false, message: auth.error || 'Connexion impossible' };
    player.uiHint = auth.error || 'Connexion impossible';
    player.uiHintTimer = 2.5;
    return true;
  }

  player.accountKey = auth.key;
  player.accountName = auth.name;
  player.pseudo = normalizePlayerPseudo(auth.name || accountName);
  player.authStatus = { ok: true, message: auth.message || (accountAction === 'register' ? 'Compte créé' : 'Connexion réussie') };
  if (auth.battleStats) state.modes?.battleStats?.set?.(auth.key, { ...auth.battleStats });
  return true;
}
