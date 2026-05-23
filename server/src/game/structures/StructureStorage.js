import { STRUCTURE_TYPES } from './StructureDefs.js';
import { findAliveCoreForStructure, isStructureOwner, distanceSqToStructureRect } from './StructureSystem.js';
import { addResource, removeResource } from '../inventory/InventorySystem.js';
import { RESOURCE_DEFS, RESOURCE_KEYS_ORDER } from '../inventory/ResourceDefs.js';

const STORAGE_RANGE = 260;

export function isStorageStructure(structure) {
  return !!structure && structure.type === STRUCTURE_TYPES.STORAGE;
}

export function hasStorageItems(structure) {
  const resources = structure?.storage?.resources || {};
  return Object.values(resources).some((v) => (v | 0) > 0);
}

export function canPlayerAccessStorage(state, player, structure) {
  if (!player || !isStorageStructure(structure)) return false;
  if (String(player.worldId || 'endless') !== String(structure.worldId || 'endless')) return false;
  if ((player.sx | 0) !== (structure.sx | 0) || (player.sy | 0) !== (structure.sy | 0)) return false;
  if (distanceSqToStructureRect(structure, player.x || 0, player.y || 0) > STORAGE_RANGE * STORAGE_RANGE) return false;
  if (isStructureOwner(player, structure)) return true;
  // Un coffre devient pillable/utilisable si son noyau propriétaire n'est plus vivant.
  return !findAliveCoreForStructure(state, structure);
}

export function buildStorageSnapshot(state, player) {
  const id = player?.openStorageId | 0;
  if (!id) return null;
  const st = state?.structures?.get?.(id);
  if (!canPlayerAccessStorage(state, player, st)) {
    if (player) player.openStorageId = 0;
    return null;
  }
  const resources = RESOURCE_KEYS_ORDER.map((key) => {
    const def = RESOURCE_DEFS[key];
    return {
      key,
      name: def?.name || key,
      amount: Math.max(0, st.storage?.resources?.[key] | 0),
      colorHex: def?.colorHex || '#d0d7e4'
    };
  }).filter((e) => e.amount > 0);
  return {
    id: st.id | 0,
    name: st.name || 'Coffre',
    owned: isStructureOwner(player, st),
    unclaimed: !findAliveCoreForStructure(state, st),
    resources
  };
}

export function findAccessibleStorageNearPlayer(state, player) {
  let best = null;
  let bestD2 = Infinity;
  for (const st of state?.structures?.values?.() || []) {
    if (!isStorageStructure(st)) continue;
    if (!canPlayerAccessStorage(state, player, st)) continue;
    const d2 = distanceSqToStructureRect(st, player.x || 0, player.y || 0);
    if (d2 < bestD2) { best = st; bestD2 = d2; }
  }
  return best;
}

export function transferStorageResource(state, player, structureId, resourceKey, amount, direction, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canPlayerAccessStorage(state, player, st)) return { ok: false, error: 'storage_locked' };
  const key = String(resourceKey || '');
  if (!RESOURCE_DEFS[key]) return { ok: false, error: 'invalid_resource' };
  const qty = Math.max(1, Math.min(999999, Math.floor(Number(amount) || 0)));
  st.storage ??= { resources: {} };
  st.storage.resources ??= {};
  if (direction === 'deposit') {
    const moved = removeResource(player.inv, key, qty);
    if (moved <= 0) return { ok: false, error: 'empty_cargo' };
    st.storage.resources[key] = (st.storage.resources[key] || 0) + moved;
  } else if (direction === 'withdraw') {
    const cur = st.storage.resources[key] | 0;
    const take = Math.max(0, Math.min(cur, qty));
    if (take <= 0) return { ok: false, error: 'empty_storage' };
    const added = addResource(player.inv, key, take);
    if (added <= 0) return { ok: false, error: 'cargo_full' };
    st.storage.resources[key] = cur - added;
  } else {
    return { ok: false, error: 'invalid_direction' };
  }
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true };
}
