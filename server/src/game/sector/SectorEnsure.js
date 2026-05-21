import { sectorKey } from './SectorKey.js';
import { generateSectorContent } from './SectorGenerator.js';

export function ensureSectorLoaded(state, sx, sy, timeMs) {
  const key = sectorKey(sx, sy);
  let s = state.sectors.get(key);
  if (!s) {
    s = { sx, sy, loaded: false, lastActiveAt: timeMs };
    state.sectors.set(key, s);
  }
  s.lastActiveAt = timeMs;
  if (!s.loaded) {
    generateSectorContent(state, sx, sy, timeMs);
    s.loaded = true;
  }
  return s;
}
