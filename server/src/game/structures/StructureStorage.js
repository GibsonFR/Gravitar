import { STRUCTURE_TYPES, getStructureDef } from './StructureDefs.js';
import { FUEL_RESOURCE_KEYS } from './StructureEnergy.js';
import { findAliveCoreForStructure, isStructureOwner, distanceSqToStructureRect } from './StructureSystem.js';
import { addResource, removeResource } from '../inventory/InventorySystem.js';
import { RESOURCE_DEFS, RESOURCE_KEYS_ORDER } from '../inventory/ResourceDefs.js';
import { ITEM_CATEGORY_IDS, getItemCategoryName } from '../../../../shared/content/items/ItemCategoryIds.js';
import { getItemDef } from '../../../../shared/content/items/ItemDefs.js';

const STORAGE_RANGE = 260;
const STORAGE_TYPES = new Set([
  STRUCTURE_TYPES.STORAGE,
  STRUCTURE_TYPES.EQUIPMENT_STORAGE,
  STRUCTURE_TYPES.AMMO_STORAGE,
  STRUCTURE_TYPES.FUEL_TANK,
  STRUCTURE_TYPES.FUEL_GENERATOR
]);

export function isStorageStructure(structure) {
  return !!structure && STORAGE_TYPES.has(structure.type);
}

export function getStorageKind(structure) {
  const def = getStructureDef(structure?.type);
  return String(structure?.storage?.kind || def?.storageKind || 'resources');
}

export function hasStorageItems(structure) {
  if (!structure) return false;
  const kind = getStorageKind(structure);
  if (kind === 'equipment') return (structure.storage?.items || []).some(Boolean);
  if (kind === 'ammo') return Object.values(structure.storage?.ammo || {}).some((v) => (v | 0) > 0);
  return Object.values(structure.storage?.resources || {}).some((v) => (v | 0) > 0);
}

export function getStorageCapacity(structure) {
  const def = getStructureDef(structure?.type);
  const kind = getStorageKind(structure);
  if (kind === 'equipment') return Math.max(0, Number(structure?.storage?.itemCapacity ?? def?.itemCapacity ?? 0) || 0);
  if (kind === 'fuel') return Math.max(0, Number(structure?.storage?.capacity ?? def?.fuelCapacity ?? 0) || 0);
  if (kind === 'ammo') return Math.max(0, Number(structure?.storage?.ammoCapacity ?? def?.ammoCapacity ?? 0) || 0);
  return Math.max(0, Number(structure?.storage?.capacity ?? def?.storageCapacity ?? 0) || 0);
}

export function getStorageUsed(structure) {
  const kind = getStorageKind(structure);
  if (kind === 'equipment') return (structure?.storage?.items || []).filter(Boolean).length;
  if (kind === 'fuel') return Object.values(structure?.storage?.resources || {}).reduce((sum, v) => sum + Math.max(0, v | 0), 0);
  if (kind === 'ammo') return Object.values(structure?.storage?.ammo || {}).reduce((sum, v) => sum + Math.max(0, v | 0), 0);
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

function itemEntry(itemId, amount = 1) {
  const def = getItemDef(itemId);
  if (!def) return null;
  return {
    itemId: def.id,
    name: def.name || def.id,
    shortName: def.shortName || def.name || def.id,
    categoryId: def.categoryId || '',
    categoryName: getItemCategoryName(def.categoryId),
    tier: def.tier || 1,
    amount: Math.max(1, amount | 0)
  };
}

function buildResourceEntries(resources = {}) {
  return RESOURCE_KEYS_ORDER.map((key) => {
    const def = RESOURCE_DEFS[key];
    return {
      key,
      name: def?.name || key,
      amount: Math.max(0, resources?.[key] | 0),
      cargoPerUnit: def?.cargoPerUnit || 1,
      colorHex: def?.colorHex || '#d0d7e4'
    };
  }).filter((e) => e.amount > 0);
}

function buildCargoEquipment(player) {
  const equipped = new Set(player?.equipment?.equippedItemIds || []);
  const out = [];
  for (const itemId of player?.equipment?.ownedItemIds || []) {
    if (equipped.has(itemId)) continue;
    const def = getItemDef(itemId);
    if (!def || def.categoryId === ITEM_CATEGORY_IDS.AMMO) continue;
    const entry = itemEntry(itemId, 1);
    if (entry) out.push(entry);
  }
  return out.sort((a, b) => (a.tier | 0) - (b.tier | 0) || a.name.localeCompare(b.name));
}

function buildCargoAmmo(player) {
  const out = [];
  const counts = player?.equipment?.rocketAmmoCountsById || {};
  for (const [itemId, amount] of Object.entries(counts)) {
    const qty = Math.max(0, amount | 0);
    if (qty <= 0) continue;
    const def = getItemDef(itemId);
    if (!def || def.categoryId !== ITEM_CATEGORY_IDS.AMMO || !def.ammoProfile) continue;
    const entry = itemEntry(itemId, qty);
    if (entry) out.push(entry);
  }
  return out.sort((a, b) => (a.tier | 0) - (b.tier | 0) || a.name.localeCompare(b.name));
}

function buildStoredEquipment(structure) {
  return (structure?.storage?.items || []).map((itemId) => itemEntry(itemId, 1)).filter(Boolean);
}

function buildStoredAmmo(structure) {
  const out = [];
  for (const [itemId, amount] of Object.entries(structure?.storage?.ammo || {})) {
    if ((amount | 0) <= 0) continue;
    const entry = itemEntry(itemId, amount | 0);
    if (entry) out.push(entry);
  }
  return out.sort((a, b) => (a.tier | 0) - (b.tier | 0) || a.name.localeCompare(b.name));
}

export function buildStorageSnapshot(state, player) {
  const id = player?.openStorageId | 0;
  if (!id) return null;
  const st = state?.structures?.get?.(id);
  if (!canPlayerAccessStorage(state, player, st)) {
    if (player) player.openStorageId = 0;
    return null;
  }
  const kind = getStorageKind(st);
  const capacity = getStorageCapacity(st);
  const used = getStorageUsed(st);
  const base = {
    id: st.id | 0,
    name: st.name || 'Coffre',
    kind,
    owned: isStructureOwner(player, st),
    unclaimed: !findAliveCoreForStructure(state, st),
    capacity,
    used,
    fill01: capacity > 0 ? Math.max(0, Math.min(1, used / capacity)) : 0
  };
  if (kind === 'equipment') {
    return { ...base, cargoItems: buildCargoEquipment(player), items: buildStoredEquipment(st) };
  }
  if (kind === 'ammo') {
    return { ...base, cargoAmmo: buildCargoAmmo(player), ammo: buildStoredAmmo(st) };
  }
  if (kind === 'fuel') {
    const fuelSet = new Set(FUEL_RESOURCE_KEYS);
    const cargoResources = buildResourceEntries(player.inv?.resources || {}).filter((e) => fuelSet.has(e.key));
    const resources = buildResourceEntries(st.storage?.resources || {}).filter((e) => fuelSet.has(e.key));
    return { ...base, fuelBufferSeconds: Math.round((Number(st.fuelBufferSeconds) || 0) * 10) / 10, cargoResources, resources };
  }
  return { ...base, resources: buildResourceEntries(st.storage?.resources || {}) };
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

function saveAfterTransfer(state, player, st) {
  st.updatedAt = Date.now();
  player.forceFullUiSnapshot = true;
  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
}

export function transferStorageResource(state, player, structureId, resourceKey, amount, direction, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canPlayerAccessStorage(state, player, st)) return { ok: false, error: 'storage_locked' };
  const storageKind = getStorageKind(st);
  if (storageKind !== 'resources' && storageKind !== 'fuel') return { ok: false, error: 'wrong_storage_type' };
  const key = String(resourceKey || '');
  const def = RESOURCE_DEFS[key];
  if (!def) return { ok: false, error: 'invalid_resource' };
  if (storageKind === 'fuel' && !FUEL_RESOURCE_KEYS.includes(key)) return { ok: false, error: 'not_fuel' };
  let qty = Math.max(1, Math.min(999999, Math.floor(Number(amount) || 0)));
  st.storage ??= { kind: 'resources', resources: {} };
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
  saveAfterTransfer(state, player, st);
  return { ok: true };
}

export function transferStorageItem(state, player, structureId, itemId, amount, direction, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canPlayerAccessStorage(state, player, st)) return { ok: false, error: 'storage_locked' };
  const kind = getStorageKind(st);
  const id = String(itemId || '').toLowerCase();
  const def = getItemDef(id);
  if (!def) return { ok: false, error: 'invalid_item' };
  const qty = Math.max(1, Math.min(999999, Math.floor(Number(amount) || 1)));
  const eq = player?.equipment;
  if (!eq) return { ok: false, error: 'missing_equipment' };

  if (kind === 'equipment') {
    if (def.categoryId === ITEM_CATEGORY_IDS.AMMO) return { ok: false, error: 'wrong_storage_type' };
    st.storage.items ??= [];
    if (direction === 'deposit') {
      if ((st.storage.items || []).length >= getStorageCapacity(st)) return { ok: false, error: 'storage_full' };
      if (!(eq.ownedItemIds || []).includes(id)) return { ok: false, error: 'item_not_owned' };
      if ((eq.equippedItemIds || []).includes(id)) return { ok: false, error: 'item_equipped' };
      eq.ownedItemIds = (eq.ownedItemIds || []).filter((x) => x !== id);
      st.storage.items.push(id);
    } else if (direction === 'withdraw') {
      const idx = (st.storage.items || []).indexOf(id);
      if (idx < 0) return { ok: false, error: 'empty_storage' };
      if ((eq.ownedItemIds || []).includes(id)) return { ok: false, error: 'already_owned' };
      st.storage.items.splice(idx, 1);
      eq.ownedItemIds = [...(eq.ownedItemIds || []), id];
    } else return { ok: false, error: 'invalid_direction' };
  } else if (kind === 'ammo') {
    if (def.categoryId !== ITEM_CATEGORY_IDS.AMMO || !def.ammoProfile) return { ok: false, error: 'wrong_storage_type' };
    st.storage.ammo ??= {};
    eq.rocketAmmoCountsById ??= {};
    if (direction === 'deposit') {
      const have = Math.max(0, eq.rocketAmmoCountsById[id] | 0);
      const free = Math.max(0, getStorageCapacity(st) - getStorageUsed(st));
      const moved = Math.max(0, Math.min(have, qty, free));
      if (moved <= 0) return { ok: false, error: free <= 0 ? 'storage_full' : 'empty_cargo' };
      eq.rocketAmmoCountsById[id] = have - moved;
      st.storage.ammo[id] = (st.storage.ammo[id] | 0) + moved;
      if (eq.rocketAmmoCountsById[id] <= 0) {
        for (let i = 0; i < (eq.rocketAmmoSlotItemIds || []).length; i += 1) {
          if (eq.rocketAmmoSlotItemIds[i] === id) eq.rocketAmmoSlotItemIds[i] = '';
        }
      }
    } else if (direction === 'withdraw') {
      const have = Math.max(0, st.storage.ammo[id] | 0);
      const moved = Math.max(0, Math.min(have, qty));
      if (moved <= 0) return { ok: false, error: 'empty_storage' };
      st.storage.ammo[id] = have - moved;
      eq.rocketAmmoCountsById[id] = (eq.rocketAmmoCountsById[id] | 0) + moved;
      if (!eq.rocketAmmoSlotItemIds?.[0]) eq.rocketAmmoSlotItemIds[0] = id;
      else if (!eq.rocketAmmoSlotItemIds?.[1] && eq.rocketAmmoSlotItemIds[0] !== id) eq.rocketAmmoSlotItemIds[1] = id;
    } else return { ok: false, error: 'invalid_direction' };
  } else {
    return { ok: false, error: 'wrong_storage_type' };
  }
  eq.lastChangedAt = timeMs | 0;
  saveAfterTransfer(state, player, st);
  return { ok: true };
}
