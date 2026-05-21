import { newEntityId } from '../state/GameState.js';

export function spawnPortal(state, sx, sy, x, y, targetSx, targetSy, glyph, options = {}) {
  const id = newEntityId(state);
  state.portals.set(id, {
    id,
    kind: 'portal',
    sx: sx | 0,
    sy: sy | 0,
    x,
    y,
    targetSx: targetSx | 0,
    targetSy: targetSy | 0,
    glyph: String(glyph ?? '?'),
    label: String(options.label ?? ''),
    mode: String(options.mode ?? ''),
    radius: Number.isFinite(options.radius) ? options.radius : 38,
    cooldownMs: Number.isFinite(options.cooldownMs) ? options.cooldownMs : 800,
    bastionId: Number.isFinite(options.bastionId) ? options.bastionId : -1,
    bastionType: String(options.bastionType ?? ''),
    bastionTier: Number.isFinite(options.bastionTier) ? options.bastionTier : 0,
    bastionColor: options.bastionColor ?? null
  });
  return id;
}
