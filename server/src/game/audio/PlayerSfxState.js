export function createPlayerSfxState() {
  return {
    pending: []
  };
}

export function queuePlayerSfx(player, type, variant = 0) {
  if (!player?.sfx?.pending) return;
  player.sfx.pending.push({ type, variant });
}

export function drainPlayerSfx(player) {
  if (!player?.sfx?.pending?.length) return [];
  const out = player.sfx.pending;
  player.sfx.pending = [];
  return out;
}
