export function createWorldSfxState() {
  return {
    pending: []
  };
}

export function queueWorldSfx(state, type, sx, sy, x, y, variant = 0) {
  if (!state?.audio?.pending) return;
  state.audio.pending.push({ type, sx: sx | 0, sy: sy | 0, x, y, variant });
}

export function peekWorldSfx(state) {
  return state?.audio?.pending ?? [];
}

export function clearWorldSfx(state) {
  if (!state?.audio?.pending) return;
  state.audio.pending = [];
}
