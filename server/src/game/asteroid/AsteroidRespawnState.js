import { isStructureAlive } from '../structures/StructureSystem.js';

export const ASTEROID_RESPAWN_MS = 60 * 60 * 1000;
export const ASTEROID_RESPAWN_RETRY_MS = 5 * 60 * 1000;

export function ensureAsteroidRespawnState(state) {
  if (!state.destroyedAsteroidRespawnAt || typeof state.destroyedAsteroidRespawnAt.get !== 'function') {
    state.destroyedAsteroidRespawnAt = new Map();
  }
  if (!state.destroyedAsteroids || typeof state.destroyedAsteroids.get !== 'function') {
    state.destroyedAsteroids = new Map();
  }
  if (!state.destroyedAsteroidSigs || typeof state.destroyedAsteroidSigs.has !== 'function') {
    state.destroyedAsteroidSigs = new Set();
  }
  return state.destroyedAsteroidRespawnAt;
}

export function markAsteroidDestroyedForRespawn(state, asteroid, timeMs) {
  if (!state || !asteroid?.sig) return null;
  ensureAsteroidRespawnState(state);
  const respawnAt = Math.max(0, Number(timeMs) || Date.now()) + ASTEROID_RESPAWN_MS;
  const sig = String(asteroid.sig);
  const record = {
    sig,
    sx: asteroid.sx | 0,
    sy: asteroid.sy | 0,
    x: Number(asteroid.x) || 0,
    y: Number(asteroid.y) || 0,
    radius: Math.max(1, Number(asteroid.radius) || 24),
    resource: asteroid.resource || '',
    destroyedAt: Math.max(0, Number(timeMs) || Date.now()),
    respawnAt
  };
  state.destroyedAsteroidSigs.add(sig);
  state.destroyedAsteroidRespawnAt.set(sig, respawnAt);
  state.destroyedAsteroids.set(sig, record);
  asteroid.respawnAt = respawnAt;
  state.asteroidRespawnStore?.saveFromState?.(state);
  return record;
}

export function clearAsteroidDestroyedRecord(state, sig) {
  if (!state || !sig) return;
  ensureAsteroidRespawnState(state);
  const key = String(sig);
  state.destroyedAsteroidSigs.delete(key);
  state.destroyedAsteroidRespawnAt.delete(key);
  state.destroyedAsteroids.delete(key);
}

export function deferAsteroidRespawn(state, sig, timeMs, retryMs = ASTEROID_RESPAWN_RETRY_MS) {
  if (!state || !sig) return 0;
  ensureAsteroidRespawnState(state);
  const key = String(sig);
  const nextAt = Math.max(0, Number(timeMs) || Date.now()) + Math.max(10000, Number(retryMs) || ASTEROID_RESPAWN_RETRY_MS);
  state.destroyedAsteroidSigs.add(key);
  state.destroyedAsteroidRespawnAt.set(key, nextAt);
  const record = state.destroyedAsteroids.get(key) || { sig: key };
  record.respawnAt = nextAt;
  state.destroyedAsteroids.set(key, record);
  state.asteroidRespawnStore?.saveFromState?.(state);
  return nextAt;
}

export function getAsteroidRespawnAt(state, sig) {
  if (!state || !sig) return 0;
  ensureAsteroidRespawnState(state);
  return Number(state.destroyedAsteroidRespawnAt.get(String(sig)) || 0);
}

export function canRespawnAsteroidAt(state, asteroidLike) {
  if (!state || !asteroidLike) return false;
  const sx = asteroidLike.sx | 0;
  const sy = asteroidLike.sy | 0;
  if (sx === 0 && sy === 0) return false;
  const x = Number(asteroidLike.x) || 0;
  const y = Number(asteroidLike.y) || 0;
  const r = Math.max(1, Number(asteroidLike.radius) || 24);
  for (const st of state.structures?.values?.() || []) {
    if (!st || !isStructureAlive(st)) continue;
    if ((st.sx | 0) !== sx || (st.sy | 0) !== sy) continue;
    if (String(st.worldId || 'endless') !== 'endless') continue;
    const sr = Math.max(20, Number(st.radius) || Math.max(Number(st.w) || 0, Number(st.h) || 0) * 0.5 || 28);
    const dx = (Number(st.x) || 0) - x;
    const dy = (Number(st.y) || 0) - y;
    const minDist = r + sr + 32;
    if (dx * dx + dy * dy <= minDist * minDist) return false;
  }
  return true;
}

export function applyAsteroidRespawnGate(state, sig, asteroidLike, timeMs) {
  if (!state || !sig) return true;
  ensureAsteroidRespawnState(state);
  const key = String(sig);
  const respawnAt = getAsteroidRespawnAt(state, key);
  if (!state.destroyedAsteroidSigs.has(key) && respawnAt <= 0) return true;
  if (respawnAt > 0 && timeMs < respawnAt) return false;
  if (!canRespawnAsteroidAt(state, asteroidLike)) {
    deferAsteroidRespawn(state, key, timeMs);
    return false;
  }
  clearAsteroidDestroyedRecord(state, key);
  state.asteroidRespawnStore?.saveFromState?.(state);
  return true;
}
