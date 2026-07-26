export function accountProfileKeyForMode(mode) {
  const normalized = String(mode || '').toLowerCase();
  if (normalized === 'battle' || normalized === 'battle_next' || normalized === 'battle_current' || normalized === 'battle_server') return 'battle';
  if (normalized.startsWith('test') || normalized.includes('test')) return 'test';
  return 'endless';
}

export function shouldPersistProfileMode(mode) {
  return accountProfileKeyForMode(mode) === 'endless';
}
