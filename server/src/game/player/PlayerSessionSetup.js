export const DEFAULT_PLAYER_PSEUDO = 'Pilote';
export const MAX_PLAYER_PSEUDO_LENGTH = 18;

export function normalizePlayerPseudo(value) {
  let raw = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return DEFAULT_PLAYER_PSEUDO;
  raw = raw.slice(0, MAX_PLAYER_PSEUDO_LENGTH).trim();
  return raw || DEFAULT_PLAYER_PSEUDO;
}

export function isPlayerSessionPending(player) {
  return !!player?.sessionSetupPending;
}

export function isPlayerSessionReady(player) {
  return !!player && !player.sessionSetupPending;
}
