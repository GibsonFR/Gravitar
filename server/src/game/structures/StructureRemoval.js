import { STRUCTURE_TYPES } from './StructureDefs.js';
import { hasStorageItems } from './StructureStorage.js';
import { hasStructuresProtectedByCore } from './StructureSystem.js';

function ownerKey(player) {
  return String(player.accountKey || player.accountName || player.pseudo || `guest-${player.id | 0}`).toLowerCase();
}

function inSameWorld(st, player) {
  return String(st.worldId || 'endless') === String(player.worldId || 'endless');
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
  if ((st.sx | 0) !== (player.sx | 0) || (st.sy | 0) !== (player.sy | 0)) return { ok: false, error: 'wrong_sector' };
  const owned = String(st.worldId || 'endless') === 'endless'
    ? String(st.ownerKey || '').toLowerCase() === ownerKey(player)
    : (st.ownerId | 0) === (player.id | 0);
  if (!owned) return { ok: false, error: 'not_owner' };
  if (st.type === STRUCTURE_TYPES.STORAGE && hasStorageItems(st)) return { ok: false, error: 'storage_not_empty' };
  if (st.type === STRUCTURE_TYPES.BASE_CORE && hasStructuresProtectedByCore(state, st)) return { ok: false, error: 'core_not_empty' };
  const d = Math.hypot((st.x || 0) - (player.x || 0), (st.y || 0) - (player.y || 0));
  if (d > 1400) return { ok: false, error: 'too_far' };
  state.structures.delete(id);
  if (!isTestPlayer(player) && String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true, removed: st };
}
