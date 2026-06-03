export function createWorldSfxState() {
  return {
    pending: []
  };
}

export function queueWorldSfx(state, type, sx, sy, x, y, variant = 0, meta = null) {
  if (!state?.audio?.pending) return;
  const ev = { type, sx: sx | 0, sy: sy | 0, x, y, variant };
  if (meta && typeof meta === 'object') {
    if (meta.frameId) ev.frameId = String(meta.frameId);
    if (meta.slot) ev.slot = String(meta.slot).toUpperCase();
    if (meta.sourceKind) ev.sourceKind = String(meta.sourceKind);
  }
  state.audio.pending.push(ev);
}

export function peekWorldSfx(state) {
  return state?.audio?.pending ?? [];
}

export function clearWorldSfx(state) {
  if (!state?.audio?.pending) return;
  state.audio.pending = [];
}
