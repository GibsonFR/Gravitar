import { STRUCTURE_TYPES } from './StructureDefs.js';

const CORE_REGEN_HP_PER_SEC = 8;
const CORE_REGEN_SAVE_INTERVAL_MS = 5000;

function rectOf(entity) {
  const w = Number(entity?.w) || (Number(entity?.radius) || 0) * 2;
  const h = Number(entity?.h) || (Number(entity?.radius) || 0) * 2;
  return {
    left: (Number(entity?.x) || 0) - w * 0.5,
    right: (Number(entity?.x) || 0) + w * 0.5,
    top: (Number(entity?.y) || 0) - h * 0.5,
    bottom: (Number(entity?.y) || 0) + h * 0.5,
    w,
    h
  };
}

function rectInside(inner, outer) {
  const eps = 0.001;
  return inner.left >= outer.left - eps && inner.right <= outer.right + eps && inner.top >= outer.top - eps && inner.bottom <= outer.bottom + eps;
}

function sameStructureWorld(a, b) {
  return String(a?.worldId || 'endless') === String(b?.worldId || 'endless');
}

function samePlayerWorld(player, structure) {
  return String(player?.worldId || 'endless') === String(structure?.worldId || 'endless');
}

export function getPlayerOwnerKey(player) {
  return String(player?.accountKey || player?.accountName || player?.pseudo || `guest-${player?.id | 0}`).toLowerCase();
}

export function isStructureAlive(structure) {
  if (!structure) return false;
  if (structure.damageable === false) return true;
  return (structure.stats?.hp ?? 0) > 0;
}

export function isStructureDamageable(structure) {
  return !!structure && structure.damageable !== false && (structure.stats?.maxHp ?? 0) > 0;
}

export function isStructureOwner(player, structure) {
  if (!player || !structure) return false;
  const worldId = String(structure.worldId || player.worldId || 'endless');
  if (worldId !== 'endless') return (structure.ownerId | 0) === (player.id | 0);
  return getPlayerOwnerKey(player) === String(structure.ownerKey || '').toLowerCase();
}

export function getStructureRect(structure) {
  return rectOf(structure);
}

export function pointInsideStructureRect(structure, x, y, pad = 0) {
  const r = rectOf(structure);
  return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
}

export function distanceSqToStructureRect(structure, x, y) {
  const r = rectOf(structure);
  const px = Math.max(r.left, Math.min(Number(x) || 0, r.right));
  const py = Math.max(r.top, Math.min(Number(y) || 0, r.bottom));
  const dx = (Number(x) || 0) - px;
  const dy = (Number(y) || 0) - py;
  return dx * dx + dy * dy;
}

export function getStructureClaimRect(core) {
  const half = Math.max(1, Number(core?.claimRadius) || 0);
  return {
    left: (Number(core?.x) || 0) - half,
    right: (Number(core?.x) || 0) + half,
    top: (Number(core?.y) || 0) - half,
    bottom: (Number(core?.y) || 0) + half
  };
}

export function findAliveCoreForStructure(state, structure) {
  if (!state?.structures || !structure || !structure.ownerKey) return null;
  if (structure.type === STRUCTURE_TYPES.BASE_CORE && isStructureAlive(structure)) return structure;
  const rect = rectOf(structure);
  for (const core of state.structures.values()) {
    if (core.type !== STRUCTURE_TYPES.BASE_CORE) continue;
    if (!isStructureAlive(core)) continue;
    if (!sameStructureWorld(core, structure)) continue;
    if ((core.sx | 0) !== (structure.sx | 0) || (core.sy | 0) !== (structure.sy | 0)) continue;
    if (String(core.ownerKey || '').toLowerCase() !== String(structure.ownerKey || '').toLowerCase()) continue;
    if (rectInside(rect, getStructureClaimRect(core))) return core;
  }
  return null;
}

export function isStructureProtectedByCore(state, structure) {
  if (!isStructureAlive(structure)) return false;
  if (structure.type === STRUCTURE_TYPES.BASE_CORE) return false;
  if (structure.type === STRUCTURE_TYPES.WALL || structure.type === STRUCTURE_TYPES.DOOR) return false;
  return !!findAliveCoreForStructure(state, structure);
}

export function canPlayerDamageStructure(state, player, structure) {
  if (!player || !isStructureAlive(structure) || !isStructureDamageable(structure)) return false;
  if (!samePlayerWorld(player, structure)) return false;
  if ((player.sx | 0) !== (structure.sx | 0) || (player.sy | 0) !== (structure.sy | 0)) return false;
  if (isStructureOwner(player, structure)) return false;
  if (structure.type === STRUCTURE_TYPES.WALL || structure.type === STRUCTURE_TYPES.DOOR) return true;
  if (structure.type === STRUCTURE_TYPES.BASE_CORE) return true;
  return !isStructureProtectedByCore(state, structure);
}

export function canPlayerRepairStructure(player, structure) {
  if (!player || !isStructureAlive(structure) || !isStructureDamageable(structure)) return false;
  if (!samePlayerWorld(player, structure)) return false;
  if ((player.sx | 0) !== (structure.sx | 0) || (player.sy | 0) !== (structure.sy | 0)) return false;
  if (!isStructureOwner(player, structure)) return false;
  if (structure.type === STRUCTURE_TYPES.BASE_CORE) return false;
  const hp = Number(structure.stats?.hp) || 0;
  const maxHp = Number(structure.stats?.maxHp) || 0;
  return maxHp > 0 && hp > 0 && hp < maxHp;
}

export function destroyStructure(state, structure, timeMs = Date.now()) {
  if (!state?.structures || !structure) return false;
  state.structures.delete(structure.id);
  structure.destroyedAt = timeMs;
  if (String(structure.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return true;
}

export function updateStructures(state, dt, timeMs = Date.now()) {
  if (!state?.structures) return;
  let shouldSave = false;
  const regen = Math.max(0, Number(dt) || 0) * CORE_REGEN_HP_PER_SEC;
  if (regen <= 0) return;
  for (const st of state.structures.values()) {
    if (st.type !== STRUCTURE_TYPES.BASE_CORE) continue;
    if (!isStructureAlive(st)) continue;
    const hp = Number(st.stats?.hp) || 0;
    const maxHp = Number(st.stats?.maxHp) || 0;
    if (maxHp <= 0 || hp >= maxHp) continue;
    st.stats.hp = Math.min(maxHp, hp + regen);
    st.updatedAt = timeMs;
    if (String(st.worldId || 'endless') === 'endless' && timeMs - (st.lastRegenSaveAt || 0) > CORE_REGEN_SAVE_INTERVAL_MS) {
      st.lastRegenSaveAt = timeMs;
      shouldSave = true;
    }
  }
  if (shouldSave) state.structureStore?.saveFromState?.(state);
}
