export function findActivePlayerForAccount(state, accountKey, exceptPlayerId = 0) {
  const key = String(accountKey || '').toLowerCase();
  if (!key) return null;
  for (const p of state?.players?.values?.() || []) {
    if ((p.id | 0) === (exceptPlayerId | 0)) continue;
    if (String(p.accountKey || '').toLowerCase() === key) return p;
  }
  return null;
}

export function rejectIfAccountAlreadyConnected(state, player, auth) {
  if (!auth?.ok || !auth.key) return false;
  const existing = findActivePlayerForAccount(state, auth.key, player?.id | 0);
  if (!existing) return false;
  player.authStatus = { ok: false, message: 'Compte déjà connecté ailleurs' };
  player.uiHint = 'Compte déjà connecté ailleurs';
  player.uiHintTimer = 3.0;
  return true;
}
