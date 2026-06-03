export function createPlayerSfxState() {
  return {
    pending: []
  };
}

export function queuePlayerSfx(player, type, variant = 0, meta = null) {
  if (!player?.sfx?.pending) return;
  const ev = { type, variant };
  if (meta && typeof meta === 'object') {
    if (meta.resourceKey) ev.resourceKey = String(meta.resourceKey);
    if (meta.itemId) ev.itemId = String(meta.itemId);
    if (meta.group) ev.group = String(meta.group);
  }
  player.sfx.pending.push(ev);
}

export function drainPlayerSfx(player) {
  if (!player?.sfx?.pending?.length) return [];
  const out = player.sfx.pending;
  player.sfx.pending = [];
  return out;
}
