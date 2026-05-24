import { getStructureDef } from './StructureDefs.js';
import { isStructureOwner, distanceSqToStructureRect, findAliveCoreForStructure } from './StructureSystem.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { addResource, canAddResource, removeResource } from '../inventory/InventorySystem.js';
import { getPlayerItemDef, addCustomEquipmentDef } from '../equipment/PlayerEquipmentDefs.js';
import { getItemCategoryName } from '../../../../shared/content/items/ItemCategoryIds.js';
import { EQUIPMENT_RD_ALLOWED_SCIENCES, EQUIPMENT_RD_MAX_SCIENCES, EQUIPMENT_RD_SECONDS, getEquipmentRDQualityBoost, getEquipmentRDScienceScore, getEquipmentRDScienceTier, isEquipmentRDScience } from '../../../../shared/content/equipment/EquipmentCraftingDefs.js';
import { rollRDEquipment } from '../../../../shared/content/equipment/EquipmentRoller.js';

const RD_RANGE = 280;
const RD_SCIENCE_CAPACITY = 24;

function isRDStation(st) {
  return String(st?.type || '').toLowerCase() === 'equipment_rd_station';
}

function canAccess(state, player, st) {
  if (!player || !isRDStation(st)) return false;
  if (String(player.worldId || 'endless') !== String(st.worldId || 'endless')) return false;
  if ((player.sx | 0) !== (st.sx | 0) || (player.sy | 0) !== (st.sy | 0)) return false;
  if (!isStructureOwner(player, st)) return false;
  return distanceSqToStructureRect(st, player.x || 0, player.y || 0) <= RD_RANGE * RD_RANGE;
}

function clean(map = {}) {
  for (const key of Object.keys(map)) if ((map[key] | 0) <= 0) delete map[key];
  return map;
}

function scienceMap(st) {
  if (!st.scienceInput || typeof st.scienceInput !== 'object') st.scienceInput = {};
  return st.scienceInput;
}

function itemInput(st) {
  return st.rdInputItem || null;
}

function setItemInput(st, item) {
  st.rdInputItem = item || null;
}

function itemOutput(st) {
  return st.rdOutputItem || null;
}

function setItemOutput(st, item) {
  st.rdOutputItem = item || null;
}

function usedScienceCapacity(map = {}) {
  return Object.values(map || {}).reduce((sum, amount) => sum + (amount | 0), 0);
}

function resourceEntry(key, amount, player) {
  const def = RESOURCE_DEFS[key] || null;
  const have = Math.max(0, player?.inv?.resources?.[key] | 0);
  return {
    key,
    name: def?.name || key,
    amount: amount | 0,
    have,
    stored: 0,
    missing: 0,
    colorHex: def?.colorHex || '#ffffff',
    tier: getEquipmentRDScienceTier(key)
  };
}

function mapRows(map = {}) {
  return Object.entries(clean(map || {}))
    .filter(([, amount]) => (amount | 0) > 0)
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([key, amount]) => ({
      key,
      amount: amount | 0,
      name: RESOURCE_DEFS[key]?.name || key,
      colorHex: RESOURCE_DEFS[key]?.colorHex || '#fff',
      tier: getEquipmentRDScienceTier(key)
    }));
}

function normalizeSciences(sciences = []) {
  const out = [];
  for (const raw of Array.isArray(sciences) ? sciences : []) {
    const key = String(raw || '');
    if (!isEquipmentRDScience(key)) continue;
    if (out.length >= EQUIPMENT_RD_MAX_SCIENCES) break;
    out.push(key);
  }
  return out;
}

function hasScience(st, sciences = []) {
  const counts = {};
  for (const key of sciences) counts[key] = (counts[key] | 0) + 1;
  const map = scienceMap(st);
  for (const [key, amount] of Object.entries(counts)) {
    if ((map[key] | 0) < (amount | 0)) return false;
  }
  return true;
}

function payScience(st, sciences = []) {
  if (!hasScience(st, sciences)) return false;
  const counts = {};
  for (const key of sciences) counts[key] = (counts[key] | 0) + 1;
  const map = scienceMap(st);
  for (const [key, amount] of Object.entries(counts)) map[key] = (map[key] | 0) - (amount | 0);
  clean(map);
  return true;
}

function ownedNeutralItems(player) {
  const ids = Array.isArray(player?.equipment?.ownedItemIds) ? player.equipment.ownedItemIds : [];
  return ids.map((id) => getPlayerItemDef(player, id)).filter((def) => def?.neutralBase && !def?.rdEnhanced);
}

function itemSnapshot(def) {
  if (!def) return null;
  return {
    itemId: def.id,
    name: def.name,
    shortName: def.shortName || def.name,
    categoryId: def.categoryId,
    categoryName: getItemCategoryName(def.categoryId),
    tier: def.tier || 1,
    mark: def.mark || 1,
    bonuses: def.bonuses || {},
    description: def.description || ''
  };
}

function scienceSnapshot(player, st) {
  const map = scienceMap(st);
  return EQUIPMENT_RD_ALLOWED_SCIENCES.map((key) => ({ ...resourceEntry(key, 1, player), stored: map[key] | 0 }));
}

function activeJobSnapshot(st) {
  const job = st?.rdJob || null;
  if (!job?.itemDef) return null;
  const total = Math.max(1, job.totalMs | 0);
  const remaining = Math.max(0, job.remainingMs | 0);
  return {
    itemName: job.itemDef.name || '',
    sciences: Array.isArray(job.sciences) ? job.sciences : [],
    scienceScore: getEquipmentRDScienceScore(job.sciences || []),
    progress: Math.max(0, Math.min(1, 1 - remaining / total)),
    remainingMs: remaining,
    totalMs: total
  };
}

export function buildEquipmentRDStationSnapshot(state, player) {
  const id = player?.openEquipmentRDStationId | 0;
  if (!id) return null;
  const st = state?.structures?.get?.(id);
  if (!canAccess(state, player, st)) {
    player.openEquipmentRDStationId = 0;
    return null;
  }
  const def = getStructureDef(st.type);
  const core = findAliveCoreForStructure(state, st);
  const map = scienceMap(st);
  return {
    id: st.id | 0,
    type: st.type,
    name: st.name || def?.name || 'Station R&D',
    powered: !!st.powered,
    energyUse: Number(def?.energyUse) || 0,
    baseEnergy: core?.energyState || null,
    maxSciences: EQUIPMENT_RD_MAX_SCIENCES,
    seconds: EQUIPMENT_RD_SECONDS,
    scoreHint: 'Score = somme des tiers de sciences, puis variation RNG ±60%',
    activeJob: activeJobSnapshot(st),
    inputItem: itemSnapshot(itemInput(st)),
    outputItem: itemSnapshot(itemOutput(st)),
    neutralItems: ownedNeutralItems(player).map(itemSnapshot),
    scienceInput: mapRows(map),
    scienceUsed: usedScienceCapacity(map),
    scienceCapacity: RD_SCIENCE_CAPACITY,
    sciences: scienceSnapshot(player, st),
    lastCraftedItemId: player?.equipment?.lastCraftedItemId || ''
  };
}

export function openEquipmentRDStation(state, player, structureId) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canAccess(state, player, st)) return { ok: false, error: 'access' };
  player.openEquipmentRDStationId = st.id | 0;
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function closeEquipmentRDStation(player) {
  if (!player) return false;
  player.openEquipmentRDStationId = 0;
  player.forceFullUiSnapshot = true;
  return true;
}

export function transferEquipmentRDScience(state, player, structureId, resourceKey, direction = 'deposit', amount = 1, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canAccess(state, player, st)) return { ok: false, error: 'access' };
  const key = String(resourceKey || '');
  if (!isEquipmentRDScience(key) || !RESOURCE_DEFS[key]) return { ok: false, error: 'bad_resource' };
  const n = Math.max(1, Math.min(9999, amount | 0 || 1));
  const map = scienceMap(st);
  if (direction === 'withdraw') {
    const take = Math.min(map[key] | 0, n);
    if (take <= 0 || !canAddResource(player.inv, key, take)) return { ok: false, error: 'empty' };
    map[key] = (map[key] | 0) - take;
    clean(map);
    addResource(player.inv, key, take);
  } else {
    const free = Math.max(0, RD_SCIENCE_CAPACITY - usedScienceCapacity(map));
    const put = Math.min(player.inv?.resources?.[key] | 0, n, free);
    if (put <= 0) return { ok: false, error: 'full' };
    removeResource(player.inv, key, put);
    map[key] = (map[key] | 0) + put;
  }
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  state.structureStore?.saveFromState?.(state);
  return { ok: true };
}

export function loadEquipmentRDItem(state, player, structureId, itemId, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canAccess(state, player, st)) return { ok: false, error: 'access' };
  if (st.rdJob?.itemDef || itemInput(st)) return { ok: false, error: 'slot_full' };
  const item = getPlayerItemDef(player, itemId);
  if (!item?.neutralBase || item.rdEnhanced) return { ok: false, error: 'bad_item' };
  player.equipment.ownedItemIds = (player.equipment.ownedItemIds || []).filter((id) => id !== item.id);
  player.equipment.equippedItemIds = (player.equipment.equippedItemIds || []).filter((id) => id !== item.id);
  setItemInput(st, JSON.parse(JSON.stringify(item)));
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  state.structureStore?.saveFromState?.(state);
  return { ok: true };
}

export function unloadEquipmentRDItem(state, player, structureId, slot = 'input', timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canAccess(state, player, st)) return { ok: false, error: 'access' };
  if (slot === 'output') {
    const item = itemOutput(st);
    if (!item) return { ok: false, error: 'empty' };
    addCustomEquipmentDef(player, item);
    player.equipment.ownedItemIds = [...new Set([...(player.equipment.ownedItemIds || []), item.id])].sort();
    setItemOutput(st, null);
  } else {
    const item = itemInput(st);
    if (!item || st.rdJob?.itemDef) return { ok: false, error: 'empty' };
    addCustomEquipmentDef(player, item);
    player.equipment.ownedItemIds = [...new Set([...(player.equipment.ownedItemIds || []), item.id])].sort();
    setItemInput(st, null);
  }
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  state.structureStore?.saveFromState?.(state);
  return { ok: true };
}

export function startEquipmentRDJob(state, player, structureId, itemId, sciences, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canAccess(state, player, st)) return { ok: false, error: 'access' };
  if (!st.powered) return { ok: false, error: 'no_power' };
  if (st.rdJob?.itemDef) return { ok: false, error: 'busy' };
  if (itemOutput(st)) return { ok: false, error: 'output_full' };
  const input = itemInput(st);
  if (!input?.neutralBase || input.rdEnhanced) return { ok: false, error: 'bad_item' };
  const selectedSciences = normalizeSciences(sciences);
  if (!selectedSciences.length) return { ok: false, error: 'missing_science' };
  if (!payScience(st, selectedSciences)) return { ok: false, error: 'missing_resources' };

  setItemInput(st, null);
  st.rdJob = {
    itemDef: JSON.parse(JSON.stringify(input)),
    ownerId: player.id | 0,
    ownerKey: player.accountKey || player.pseudo || player.id || '',
    sciences: selectedSciences,
    qualityBoost: getEquipmentRDQualityBoost(selectedSciences),
    scienceScore: getEquipmentRDScienceScore(selectedSciences),
    startedAt: timeMs,
    totalMs: EQUIPMENT_RD_SECONDS * 1000,
    remainingMs: EQUIPMENT_RD_SECONDS * 1000
  };
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  state.structureStore?.saveFromState?.(state);
  return { ok: true };
}

export function cancelEquipmentRDJob(state, player, structureId, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canAccess(state, player, st)) return { ok: false, error: 'access' };
  const job = st.rdJob;
  if (!job?.itemDef) return { ok: false, error: 'empty' };
  if (itemInput(st)) return { ok: false, error: 'input_full' };
  setItemInput(st, job.itemDef);
  st.rdJob = null;
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  state.structureStore?.saveFromState?.(state);
  return { ok: true };
}

export function updateEquipmentRDStations(state, timeMs, dtMs) {
  if (!state?.structures) return false;
  let changed = false;
  const stepMs = Math.max(0, Number(dtMs) || 0);
  for (const st of state.structures.values()) {
    if (!isRDStation(st)) continue;
    const job = st.rdJob;
    if (!job?.itemDef) continue;
    if (!st.powered) continue;
    if (itemOutput(st)) {
      st.automationStatus = 'output_full';
      continue;
    }
    job.remainingMs = Math.max(0, (job.remainingMs | 0) - stepMs);
    st.updatedAt = timeMs;
    if (job.remainingMs > 0) continue;
    const owner = [...(state.players?.values?.() || [])].find((p) => (p.id | 0) === (job.ownerId | 0) && String(p.worldId || 'endless') === String(st.worldId || 'endless'));
    const ownerKey = job.ownerKey || owner?.accountKey || owner?.pseudo || owner?.id || '';
    const crafted = rollRDEquipment({
      neutralItemDef: job.itemDef,
      programId: `rd_${(job.sciences || []).join('_') || 'science'}`,
      ownerKey,
      craftedIndex: Math.max(0, owner?.equipment?.craftedItemCounter | 0) + 1,
      timeMs,
      qualityBoost: job.qualityBoost | 0
    });
    if (crafted) {
      crafted.usedSciences = Array.isArray(job.sciences) ? [...job.sciences] : [];
      setItemOutput(st, crafted);
      if (owner?.equipment) owner.equipment.craftedItemCounter = Math.max(0, owner.equipment.craftedItemCounter | 0) + 1;
      if (owner) {
        owner.forceFullUiSnapshot = true;
        owner.hint = `Sortie R&D : ${crafted.name}`;
      }
    }
    st.rdJob = null;
    changed = true;
  }
  if (changed) state.structureStore?.saveFromState?.(state);
  return changed;
}
