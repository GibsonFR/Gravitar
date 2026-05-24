import { STRUCTURE_TYPES } from './StructureDefs.js';
import { hasStorageItems, isStorageStructure } from './StructureStorage.js';
import { getStructureClaimRect, getStructureRect } from './StructureSystem.js';

function ownerKey(player) {
  return String(player.accountKey || player.accountName || player.pseudo || `guest-${player.id | 0}`).toLowerCase();
}

function inSameWorld(st, player) {
  return String(st.worldId || 'endless') === String(player.worldId || 'endless');
}


function rectInside(inner, outer) {
  const eps = 0.001;
  return inner.left >= outer.left - eps && inner.right <= outer.right + eps && inner.top >= outer.top - eps && inner.bottom <= outer.bottom + eps;
}

function coreProtectsAnyStructure(state, core) {
  const claim = getStructureClaimRect(core);
  for (const other of state.structures?.values?.() || []) {
    if (!other || (other.id | 0) === (core.id | 0)) continue;
    if (!inSameWorld(other, { worldId: core.worldId || 'endless' })) continue;
    if ((other.sx | 0) !== (core.sx | 0) || (other.sy | 0) !== (core.sy | 0)) continue;
    if (String(other.ownerKey || '').toLowerCase() !== String(core.ownerKey || '').toLowerCase()) continue;
    if (rectInside(getStructureRect(other), claim)) return true;
  }
  return false;
}

function isTestPlayer(player) {
  return String(player.gameMode || '').toLowerCase().includes('test') || String(player.worldId || '').toLowerCase().startsWith('test');
}

export function removeStructure(state, player, structureId, _timeMs = Date.now()) {
  const id = Number(structureId) | 0;
  if (!id) return { ok: false, error: 'invalid_structure' };
  const st = state.structures?.get?.(id);
  if (!st) return { ok: false, error: 'not_found' };
  if (!inSameWorld(st, player)) return { ok: false, error: 'wrong_world' };
  if (st.type === STRUCTURE_TYPES.RESOURCE_DEPOSIT) return { ok: false, error: 'natural_deposit' };
  if ((st.sx | 0) !== (player.sx | 0) || (st.sy | 0) !== (player.sy | 0)) return { ok: false, error: 'wrong_sector' };
  const owned = String(st.worldId || 'endless') === 'endless'
    ? String(st.ownerKey || '').toLowerCase() === ownerKey(player)
    : (st.ownerId | 0) === (player.id | 0);
  if (!owned) return { ok: false, error: 'not_owner' };
  if (isStorageStructure(st) && hasStorageItems(st)) return { ok: false, error: 'storage_not_empty' };
  if (st.type === STRUCTURE_TYPES.BASE_CORE && coreProtectsAnyStructure(state, st)) return { ok: false, error: 'core_has_structures' };
  const d = Math.hypot((st.x || 0) - (player.x || 0), (st.y || 0) - (player.y || 0));
  if (d > 1400) return { ok: false, error: 'too_far' };
  state.structures.delete(id);
  if (!isTestPlayer(player) && String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true, removed: st };
}
