import { STRUCTURE_TYPES, getStructureDef } from './StructureDefs.js';
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

export function getStorageCapacity(structure) {
  const def = getStructureDef(structure?.type);
  return Math.max(0, Number(structure?.storage?.capacity ?? def?.storageCapacity ?? 0) || 0);
}

export function getStorageUsed(structure) {
  const resources = structure?.storage?.resources || {};
  let used = 0;
  for (const [key, amount] of Object.entries(resources)) {
    const def = RESOURCE_DEFS[key];
    if (!def) continue;
    used += (Number(def.cargoPerUnit) || 1) * Math.max(0, amount | 0);
  }
  return Math.max(0, Math.round(used * 100) / 100);
}

function getStorageRemaining(structure) {
  const capacity = getStorageCapacity(structure);
  if (capacity <= 0) return Infinity;
  return Math.max(0, capacity - getStorageUsed(structure));
}

export function canPlayerAccessStorage(state, player, structure) {
  if (!player || !isStorageStructure(structure)) return false;
  if (String(player.worldId || 'endless') !== String(structure.worldId || 'endless')) return false;
  if ((player.sx | 0) !== (structure.sx | 0) || (player.sy | 0) !== (structure.sy | 0)) return false;
  if (distanceSqToStructureRect(structure, player.x || 0, player.y || 0) > STORAGE_RANGE * STORAGE_RANGE) return false;
  if (isStructureOwner(player, structure)) return true;
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
      cargoPerUnit: def?.cargoPerUnit || 1,
      colorHex: def?.colorHex || '#d0d7e4'
    };
  }).filter((e) => e.amount > 0);
  const capacity = getStorageCapacity(st);
  const used = getStorageUsed(st);
  return {
    id: st.id | 0,
    name: st.name || 'Coffre',
    owned: isStructureOwner(player, st),
    unclaimed: !findAliveCoreForStructure(state, st),
    capacity,
    used,
    fill01: capacity > 0 ? Math.max(0, Math.min(1, used / capacity)) : 0,
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
  const def = RESOURCE_DEFS[key];
  if (!def) return { ok: false, error: 'invalid_resource' };
  let qty = Math.max(1, Math.min(999999, Math.floor(Number(amount) || 0)));
  st.storage ??= { resources: {} };
  st.storage.resources ??= {};
  if (direction === 'deposit') {
    const unit = Number(def.cargoPerUnit) || 1;
    const freeUnits = Math.floor(getStorageRemaining(st) / Math.max(0.0001, unit));
    qty = Math.min(qty, Math.max(0, freeUnits));
    if (qty <= 0) return { ok: false, error: 'storage_full' };
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
