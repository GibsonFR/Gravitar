import { STRUCTURE_TYPES, getStructureDef } from './StructureDefs.js';
import { distanceSqToStructureRect, isStructureOwner } from './StructureSystem.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { addResource, removeResource } from '../inventory/InventorySystem.js';

const ACCESS_RANGE = 280;
const DRONE_KEY = 'logisticDroneBasic';

export function isDroneStationStructure(st) {
  return String(st?.type || '') === STRUCTURE_TYPES.LOGISTIC_DRONE_STATION;
}

export function isLogisticChestStructure(st) {
  const t = String(st?.type || '');
  return t === STRUCTURE_TYPES.LOGISTIC_CHEST_PROVIDER || t === STRUCTURE_TYPES.LOGISTIC_CHEST_REQUESTER || t === STRUCTURE_TYPES.LOGISTIC_CHEST_BUFFER;
}

export function canPlayerAccessLogisticsStructure(state, player, st) {
  if (!player || !st) return false;
  if (!isDroneStationStructure(st) && !isLogisticChestStructure(st)) return false;
  if (String(player.worldId || 'endless') !== String(st.worldId || 'endless')) return false;
  if ((player.sx | 0) !== (st.sx | 0) || (player.sy | 0) !== (st.sy | 0)) return false;
  if (!isStructureOwner(player, st)) return false;
  return distanceSqToStructureRect(st, player.x || 0, player.y || 0) <= ACCESS_RANGE * ACCESS_RANGE;
}

function storageResources(st) {
  st.storage ??= { kind: 'resources', resources: {}, capacity: getStructureDef(st.type)?.storageCapacity || 0 };
  st.storage.resources ??= {};
  return st.storage.resources;
}

function resourceEntry(key, amount) {
  const def = RESOURCE_DEFS[key] || null;
  return {
    key,
    name: def?.name || key,
    amount: Math.max(0, amount | 0),
    colorHex: def?.colorHex || '#d0d7e4',
    cargoPerUnit: def?.cargoPerUnit || 1
  };
}

function buildResourceEntries(map = {}) {
  return Object.entries(map)
    .filter(([, amount]) => (amount | 0) > 0)
    .map(([key, amount]) => resourceEntry(key, amount | 0))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function countDroneStations(state, player, center) {
  const out = [];
  for (const st of state?.structures?.values?.() || []) {
    if (!isDroneStationStructure(st)) continue;
    if (!isStructureOwner(player, st)) continue;
    const dx = Math.abs((st.sx | 0) - (center.sx | 0));
    const dy = Math.abs((st.sy | 0) - (center.sy | 0));
    if (Math.max(dx, dy) > 1) continue;
    out.push({ id: st.id | 0, sx: st.sx | 0, sy: st.sy | 0, name: st.name || 'Station de drones', drones: Math.max(0, st.storage?.resources?.[DRONE_KEY] | 0), current: (st.id | 0) === (center.id | 0) });
  }
  return out.sort((a, b) => (a.current ? -1 : b.current ? 1 : 0) || a.sx - b.sx || a.sy - b.sy);
}

function countLogisticChests(state, player, center) {
  const counts = { provider: 0, requester: 0, buffer: 0 };
  for (const st of state?.structures?.values?.() || []) {
    if (!isLogisticChestStructure(st)) continue;
    if (!isStructureOwner(player, st)) continue;
    if ((st.worldId || 'endless') !== (center.worldId || 'endless')) continue;
    if ((st.sx | 0) !== (center.sx | 0) || (st.sy | 0) !== (center.sy | 0)) continue;
    if (st.type === STRUCTURE_TYPES.LOGISTIC_CHEST_PROVIDER) counts.provider += 1;
    else if (st.type === STRUCTURE_TYPES.LOGISTIC_CHEST_REQUESTER) counts.requester += 1;
    else if (st.type === STRUCTURE_TYPES.LOGISTIC_CHEST_BUFFER) counts.buffer += 1;
  }
  return counts;
}

export function buildDroneStationSnapshot(state, player) {
  const id = player?.openDroneStationId | 0;
  if (!id) return null;
  const st = state?.structures?.get?.(id);
  if (!canPlayerAccessLogisticsStructure(state, player, st)) {
    if (player) player.openDroneStationId = 0;
    return null;
  }
  const def = getStructureDef(st.type) || {};
  const resources = storageResources(st);
  const installed = Math.max(0, resources[DRONE_KEY] | 0);
  const capacity = Math.max(1, def.droneCapacity | 0 || 8);
  const cargoDrones = Math.max(0, player?.inv?.resources?.[DRONE_KEY] | 0);
  return {
    id: st.id | 0,
    type: st.type,
    name: st.name || def.name || 'Station de drones logistiques',
    sx: st.sx | 0,
    sy: st.sy | 0,
    powered: !!st.powered,
    energyUse: Number(def.energyUse || st.energyUse || 0) || 0,
    installedDrones: installed,
    droneCapacity: capacity,
    freeSlots: Math.max(0, capacity - installed),
    cargoDrones,
    rangeSectors: Math.max(1, def.droneRangeSectors | 0 || 1),
    rechargeSeconds: Math.max(1, def.droneRechargeSeconds | 0 || 20),
    connectedStations: countDroneStations(state, player, st),
    localChests: countLogisticChests(state, player, st),
    missions: []
  };
}

export function buildLogisticChestSnapshot(state, player) {
  const id = player?.openLogisticChestId | 0;
  if (!id) return null;
  const st = state?.structures?.get?.(id);
  if (!canPlayerAccessLogisticsStructure(state, player, st)) {
    if (player) player.openLogisticChestId = 0;
    return null;
  }
  const def = getStructureDef(st.type) || {};
  const resources = storageResources(st);
  const type = st.type === STRUCTURE_TYPES.LOGISTIC_CHEST_PROVIDER ? 'provider' : st.type === STRUCTURE_TYPES.LOGISTIC_CHEST_REQUESTER ? 'requester' : 'buffer';
  return {
    id: st.id | 0,
    type: st.type,
    logisticType: type,
    name: st.name || def.name || 'Coffre logistique',
    sx: st.sx | 0,
    sy: st.sy | 0,
    capacity: Math.max(0, Number(st.storage?.capacity ?? def.storageCapacity ?? 0) || 0),
    resources: buildResourceEntries(resources),
    modeLabel: type === 'provider' ? 'Fournisseur' : type === 'requester' ? 'Demandeur' : 'Tampon',
    description: def.description || '',
    requests: st.logisticRequests || {}
  };
}

export function openDroneStation(state, player, structureId) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canPlayerAccessLogisticsStructure(state, player, st) || !isDroneStationStructure(st)) return false;
  player.openDroneStationId = st.id | 0;
  player.openStorageId = 0;
  player.openLogisticChestId = 0;
  player.forceFullUiSnapshot = true;
  return true;
}

export function closeDroneStation(player) {
  if (!player) return false;
  player.openDroneStationId = 0;
  player.forceFullUiSnapshot = true;
  return true;
}

export function openLogisticChest(state, player, structureId) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canPlayerAccessLogisticsStructure(state, player, st) || !isLogisticChestStructure(st)) return false;
  player.openLogisticChestId = st.id | 0;
  player.openStorageId = 0;
  player.openDroneStationId = 0;
  player.forceFullUiSnapshot = true;
  return true;
}

export function closeLogisticChest(player) {
  if (!player) return false;
  player.openLogisticChestId = 0;
  player.forceFullUiSnapshot = true;
  return true;
}

export function transferDroneStationDrone(state, player, structureId, direction = 'deposit', amount = 1, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canPlayerAccessLogisticsStructure(state, player, st) || !isDroneStationStructure(st)) return false;
  const def = getStructureDef(st.type) || {};
  const resources = storageResources(st);
  const cap = Math.max(1, def.droneCapacity | 0 || 8);
  const n = Math.max(1, Math.min(999, amount | 0 || 1));
  if (direction === 'withdraw') {
    const take = Math.min(resources[DRONE_KEY] | 0, n);
    if (take <= 0) return false;
    const added = addResource(player.inv, DRONE_KEY, take);
    if (added <= 0) return false;
    resources[DRONE_KEY] = (resources[DRONE_KEY] | 0) - added;
  } else {
    const free = Math.max(0, cap - (resources[DRONE_KEY] | 0));
    const take = Math.min(player?.inv?.resources?.[DRONE_KEY] | 0, n, free);
    if (take <= 0) return false;
    const moved = removeResource(player.inv, DRONE_KEY, take);
    if (moved <= 0) return false;
    resources[DRONE_KEY] = (resources[DRONE_KEY] | 0) + moved;
  }
  if ((resources[DRONE_KEY] | 0) <= 0) delete resources[DRONE_KEY];
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return true;
}
