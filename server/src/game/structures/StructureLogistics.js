import { STRUCTURE_TYPES, getStructureDef } from './StructureDefs.js';
import { distanceSqToStructureRect, isStructureOwner } from './StructureSystem.js';
import { getStorageCapacity, getStorageUsed } from './StructureStorage.js';
import { RESOURCE_DEFS, RESOURCE_KEYS_ORDER } from '../inventory/ResourceDefs.js';
import { addResource, removeResource } from '../inventory/InventorySystem.js';

const ACCESS_RANGE = 280;
const DRONE_KEY = 'logisticDroneBasic';
const DRONE_CARGO = 5;
const LOGISTIC_TICK_MS = 2600;
const MISSION_LOG_MAX = 10;
const DRONE_DELIVERIES_BEFORE_RECHARGE = 5;
const LOGISTIC_FLIGHT_MAX = 32;
const LOGISTIC_DRONE_SPEED = 260;
const SECTOR_EDGE = 1880;

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

function requestMap(st) {
  if (!st.logisticRequests || typeof st.logisticRequests !== 'object') st.logisticRequests = {};
  for (const key of Object.keys(st.logisticRequests)) {
    if (!RESOURCE_DEFS[key] || (st.logisticRequests[key] | 0) <= 0) delete st.logisticRequests[key];
  }
  return st.logisticRequests;
}

function resourceEntry(key, amount, extra = {}) {
  const def = RESOURCE_DEFS[key] || null;
  return {
    key,
    name: def?.name || key,
    amount: Math.max(0, amount | 0),
    colorHex: def?.colorHex || '#d0d7e4',
    cargoPerUnit: def?.cargoPerUnit || 1,
    ...extra
  };
}

function buildResourceEntries(map = {}) {
  return Object.entries(map)
    .filter(([, amount]) => (amount | 0) > 0)
    .map(([key, amount]) => resourceEntry(key, amount | 0))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function ownerKeyOf(st) {
  return String(st?.ownerKey || '').toLowerCase();
}

function sameOwner(a, b) {
  return ownerKeyOf(a) && ownerKeyOf(a) === ownerKeyOf(b);
}

function sameWorld(a, b) {
  return String(a?.worldId || 'endless') === String(b?.worldId || 'endless');
}

function sameWorldSector(a, b) {
  return sameWorld(a, b) && (a?.sx | 0) === (b?.sx | 0) && (a?.sy | 0) === (b?.sy | 0);
}

function sectorDistance(a, b) {
  return Math.max(Math.abs((a?.sx | 0) - (b?.sx | 0)), Math.abs((a?.sy | 0) - (b?.sy | 0)));
}

function hasDroneStationInSector(state, station, sx, sy) {
  for (const st of state?.structures?.values?.() || []) {
    if (!isDroneStationStructure(st)) continue;
    if (!sameOwner(station, st)) continue;
    if (!sameWorld(station, st)) continue;
    if ((st.sx | 0) === (sx | 0) && (st.sy | 0) === (sy | 0)) return true;
  }
  return false;
}

function isSectorInDroneNetwork(state, station, sx, sy) {
  if (!sameWorld(station, { worldId: station.worldId })) return false;
  if (sectorDistance(station, { sx, sy }) > 1) return false;
  return (sx | 0) === (station.sx | 0) && (sy | 0) === (station.sy | 0)
    ? true
    : hasDroneStationInSector(state, station, sx, sy);
}

function localLogisticChests(state, station) {
  const out = [];
  for (const st of state?.structures?.values?.() || []) {
    if (!isLogisticChestStructure(st)) continue;
    if (!sameOwner(station, st)) continue;
    if (!sameWorldSector(station, st)) continue;
    out.push(st);
  }
  return out;
}

function networkLogisticChests(state, station) {
  const out = [];
  for (const st of state?.structures?.values?.() || []) {
    if (!isLogisticChestStructure(st)) continue;
    if (!sameOwner(station, st)) continue;
    if (!sameWorld(station, st)) continue;
    if (!isSectorInDroneNetwork(state, station, st.sx | 0, st.sy | 0)) continue;
    out.push(st);
  }
  return out;
}

function countDroneStations(state, player, center) {
  const out = [];
  for (const st of state?.structures?.values?.() || []) {
    if (!isDroneStationStructure(st)) continue;
    if (!isStructureOwner(player, st)) continue;
    if ((st.worldId || 'endless') !== (center.worldId || 'endless')) continue;
    const dx = Math.abs((st.sx | 0) - (center.sx | 0));
    const dy = Math.abs((st.sy | 0) - (center.sy | 0));
    if (Math.max(dx, dy) > 1) continue;
    out.push({ id: st.id | 0, sx: st.sx | 0, sy: st.sy | 0, name: st.name || 'Station de drones', drones: Math.max(0, st.storage?.resources?.[DRONE_KEY] | 0), current: (st.id | 0) === (center.id | 0) });
  }
  return out.sort((a, b) => (a.current ? -1 : b.current ? 1 : 0) || a.sx - b.sx || a.sy - b.sy);
}

function countLogisticChests(state, player, center) {
  const counts = { provider: 0, requester: 0, buffer: 0, sectors: 0 };
  const sectors = new Set();
  for (const st of state?.structures?.values?.() || []) {
    if (!isLogisticChestStructure(st)) continue;
    if (!isStructureOwner(player, st)) continue;
    if ((st.worldId || 'endless') !== (center.worldId || 'endless')) continue;
    if (!isSectorInDroneNetwork(state, center, st.sx | 0, st.sy | 0)) continue;
    sectors.add(`${st.sx | 0},${st.sy | 0}`);
    if (st.type === STRUCTURE_TYPES.LOGISTIC_CHEST_PROVIDER) counts.provider += 1;
    else if (st.type === STRUCTURE_TYPES.LOGISTIC_CHEST_REQUESTER) counts.requester += 1;
    else if (st.type === STRUCTURE_TYPES.LOGISTIC_CHEST_BUFFER) counts.buffer += 1;
  }
  counts.sectors = sectors.size;
  return counts;
}

function missionLog(st) {
  if (!Array.isArray(st.logisticMissionLog)) st.logisticMissionLog = [];
  return st.logisticMissionLog;
}

function pushMissionLog(st, entry) {
  const log = missionLog(st);
  log.unshift({ at: Date.now(), ...entry });
  while (log.length > MISSION_LOG_MAX) log.pop();
}

function installedDrones(st) {
  return Math.max(0, st?.storage?.resources?.[DRONE_KEY] | 0);
}

function droneChargeCapacity(st) {
  return installedDrones(st) * DRONE_DELIVERIES_BEFORE_RECHARGE;
}

function normalizeDroneCharge(st) {
  const maxCharge = droneChargeCapacity(st);
  if (!Number.isFinite(Number(st.logisticDroneCharge))) st.logisticDroneCharge = maxCharge;
  st.logisticDroneCharge = Math.max(0, Math.min(maxCharge, Math.floor(Number(st.logisticDroneCharge) || 0)));
  if (!Number.isFinite(Number(st.logisticDroneRechargeMs))) st.logisticDroneRechargeMs = 0;
  if (maxCharge <= 0) st.logisticDroneRechargeMs = 0;
  return st.logisticDroneCharge;
}

function rechargeDroneStation(st, dtMs, timeMs) {
  if (!isDroneStationStructure(st)) return false;
  const maxCharge = droneChargeCapacity(st);
  normalizeDroneCharge(st);
  if (maxCharge <= 0 || st.logisticDroneCharge >= maxCharge) return false;
  if (!st.powered) return false;
  const def = getStructureDef(st.type) || {};
  const rechargeMs = Math.max(1000, (Number(def.droneRechargeSeconds) || 20) * 1000);
  st.logisticDroneRechargeMs = Math.max(0, Number(st.logisticDroneRechargeMs) || 0) + Math.max(0, Number(dtMs) || 0);
  let changed = false;
  while (st.logisticDroneRechargeMs >= rechargeMs && st.logisticDroneCharge < maxCharge) {
    st.logisticDroneRechargeMs -= rechargeMs;
    st.logisticDroneCharge += 1;
    changed = true;
  }
  if (st.logisticDroneCharge >= maxCharge) st.logisticDroneRechargeMs = 0;
  if (changed) st.updatedAt = timeMs;
  return changed;
}

function consumeDroneCharge(st) {
  normalizeDroneCharge(st);
  if ((st.logisticDroneCharge | 0) <= 0) return false;
  st.logisticDroneCharge = Math.max(0, (st.logisticDroneCharge | 0) - 1);
  return true;
}

function storageRemainingUnits(st, key) {
  const def = RESOURCE_DEFS[key];
  if (!def) return 0;
  const unit = Number(def.cargoPerUnit) || 1;
  const capacity = getStorageCapacity(st);
  if (capacity <= 0) return 999999;
  return Math.max(0, Math.floor((capacity - getStorageUsed(st)) / Math.max(0.0001, unit)));
}

function requesterNeed(st, key) {
  const target = requestMap(st)[key] | 0;
  if (target <= 0) return 0;
  return Math.max(0, target - (storageResources(st)[key] | 0));
}

function chestLabel(st) {
  if (!st) return 'coffre';
  if (st.type === STRUCTURE_TYPES.LOGISTIC_CHEST_PROVIDER) return 'chargement';
  if (st.type === STRUCTURE_TYPES.LOGISTIC_CHEST_REQUESTER) return 'demandeur';
  return 'tampon';
}

function requestEntries(st) {
  const req = requestMap(st);
  const res = storageResources(st);
  return Object.entries(req)
    .filter(([key, target]) => RESOURCE_DEFS[key] && (target | 0) > 0)
    .map(([key, target]) => {
      const have = res[key] | 0;
      return resourceEntry(key, target | 0, { target: target | 0, stored: have, missing: Math.max(0, (target | 0) - have) });
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function requestCandidates(state, player, st) {
  const keys = new Set();
  for (const key of Object.keys(requestMap(st))) keys.add(key);
  for (const key of Object.keys(player?.inv?.resources || {})) if ((player.inv.resources[key] | 0) > 0) keys.add(key);
  for (const other of state?.structures?.values?.() || []) {
    if (!isLogisticChestStructure(other)) continue;
    if (!isStructureOwner(player, other)) continue;
    if (!sameWorld(st, other)) continue;
    if (!isSectorInDroneNetwork(state, st, other.sx | 0, other.sy | 0)) continue;
    for (const [key, amount] of Object.entries(storageResources(other))) if ((amount | 0) > 0) keys.add(key);
  }
  const fallback = ['ironOre', 'copper', 'steelPlate', 'copperWire', 'controlCircuit', 'propellant', 'logisticDroneBasic'];
  for (const key of fallback) keys.add(key);
  return [...keys]
    .filter((key) => RESOURCE_DEFS[key])
    .sort((a, b) => {
      const ia = RESOURCE_KEYS_ORDER.indexOf(a);
      const ib = RESOURCE_KEYS_ORDER.indexOf(b);
      return (ia < 0 ? 9999 : ia) - (ib < 0 ? 9999 : ib) || a.localeCompare(b);
    })
    .map((key) => resourceEntry(key, player?.inv?.resources?.[key] | 0, { target: requestMap(st)[key] | 0 }));
}

function resourceName(key) {
  return RESOURCE_DEFS[key]?.name || key;
}


function flights(st) {
  if (!Array.isArray(st.logisticDroneFlights)) st.logisticDroneFlights = [];
  st.logisticDroneFlights = st.logisticDroneFlights.filter((flight) => flight && typeof flight === 'object' && flight.id);
  while (st.logisticDroneFlights.length > LOGISTIC_FLIGHT_MAX) st.logisticDroneFlights.shift();
  return st.logisticDroneFlights;
}

function activeFlightCount(st) {
  return flights(st).filter((flight) => String(flight.state || 'traveling') === 'traveling').length;
}

function nextFlightId(st, timeMs) {
  st.nextLogisticFlightSeq = Math.max(0, st.nextLogisticFlightSeq | 0) + 1;
  return `${st.id | 0}-${timeMs}-${st.nextLogisticFlightSeq}`;
}

function flightDurationMs(provider, requester) {
  const inter = ((provider.sx | 0) !== (requester.sx | 0)) || ((provider.sy | 0) !== (requester.sy | 0));
  if (inter) {
    const sectorSteps = Math.max(1, sectorDistance(provider, requester));
    return Math.max(6500, 5200 + sectorSteps * 4200);
  }
  const dx = (requester.x || 0) - (provider.x || 0);
  const dy = (requester.y || 0) - (provider.y || 0);
  return Math.max(2200, Math.min(9000, Math.round(Math.hypot(dx, dy) / LOGISTIC_DRONE_SPEED * 1000)));
}

function createFlight(state, station, provider, requester, key, amount, timeMs) {
  const durationMs = flightDurationMs(provider, requester);
  const flight = {
    id: nextFlightId(station, timeMs),
    state: 'traveling',
    stationId: station.id | 0,
    ownerKey: station.ownerKey || '',
    ownerName: station.ownerName || '',
    worldId: station.worldId || 'endless',
    resourceKey: key,
    resourceName: resourceName(key),
    amount: amount | 0,
    startedAt: timeMs,
    arriveAt: timeMs + durationMs,
    durationMs,
    fromId: provider.id | 0,
    toId: requester.id | 0,
    fromSx: provider.sx | 0,
    fromSy: provider.sy | 0,
    toSx: requester.sx | 0,
    toSy: requester.sy | 0,
    fromX: Number(provider.x) || 0,
    fromY: Number(provider.y) || 0,
    toX: Number(requester.x) || 0,
    toY: Number(requester.y) || 0,
    interSector: (provider.sx | 0) !== (requester.sx | 0) || (provider.sy | 0) !== (requester.sy | 0),
    fromLabel: `${chestLabel(provider)} [${provider.sx | 0},${provider.sy | 0}]`,
    toLabel: `${chestLabel(requester)} [${requester.sx | 0},${requester.sy | 0}]`
  };
  flights(station).push(flight);
  pushMissionLog(station, {
    kind: 'flight_start',
    resourceKey: key,
    resourceName: resourceName(key),
    amount,
    fromId: provider.id | 0,
    toId: requester.id | 0,
    fromSx: provider.sx | 0,
    fromSy: provider.sy | 0,
    toSx: requester.sx | 0,
    toSy: requester.sy | 0,
    interSector: flight.interSector,
    fromLabel: flight.fromLabel,
    toLabel: flight.toLabel
  });
  return flight;
}

function completeFlight(state, station, flight, timeMs) {
  const requester = state?.structures?.get?.(flight.toId | 0) || null;
  const provider = state?.structures?.get?.(flight.fromId | 0) || null;
  const key = String(flight.resourceKey || '');
  const amount = Math.max(0, flight.amount | 0);
  let delivered = 0;
  if (requester && isLogisticChestStructure(requester) && sameOwner(station, requester) && RESOURCE_DEFS[key]) {
    const fit = storageRemainingUnits(requester, key);
    delivered = Math.min(amount, fit);
    if (delivered > 0) {
      storageResources(requester)[key] = (storageResources(requester)[key] | 0) + delivered;
      requester.updatedAt = timeMs;
    }
  }
  const remainder = amount - delivered;
  if (remainder > 0 && provider && isLogisticChestStructure(provider) && sameOwner(station, provider) && RESOURCE_DEFS[key]) {
    const fitBack = Math.min(remainder, storageRemainingUnits(provider, key));
    if (fitBack > 0) {
      storageResources(provider)[key] = (storageResources(provider)[key] | 0) + fitBack;
      provider.updatedAt = timeMs;
    }
  }
  pushMissionLog(station, {
    kind: delivered > 0 ? 'delivery' : 'delivery_failed',
    resourceKey: key,
    resourceName: flight.resourceName || resourceName(key),
    amount: delivered || amount,
    fromId: flight.fromId | 0,
    toId: flight.toId | 0,
    fromSx: flight.fromSx | 0,
    fromSy: flight.fromSy | 0,
    toSx: flight.toSx | 0,
    toSy: flight.toSy | 0,
    interSector: !!flight.interSector,
    fromLabel: flight.fromLabel || 'source',
    toLabel: flight.toLabel || 'destination'
  });
  station.updatedAt = timeMs;
  return true;
}

function updateFlights(state, station, timeMs) {
  const list = flights(station);
  if (!list.length) return false;
  let changed = false;
  for (const flight of list) {
    if (String(flight.state || 'traveling') !== 'traveling') continue;
    if (timeMs >= (Number(flight.arriveAt) || 0)) {
      completeFlight(state, station, flight, timeMs);
      flight.state = 'complete';
      changed = true;
    }
  }
  const before = list.length;
  station.logisticDroneFlights = list.filter((flight) => String(flight.state || 'traveling') === 'traveling');
  if (station.logisticDroneFlights.length !== before) changed = true;
  return changed;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

function q(v, decimals = 1) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const m = 10 ** decimals;
  return Math.round(n * m) / m;
}

function flightSnapshot(flight, timeMs) {
  const total = Math.max(1, Number(flight.durationMs) || Math.max(1, (Number(flight.arriveAt) || 0) - (Number(flight.startedAt) || 0)));
  const progress = clamp01((timeMs - (Number(flight.startedAt) || 0)) / total);
  let sx = flight.fromSx | 0;
  let sy = flight.fromSy | 0;
  let x = Number(flight.fromX) || 0;
  let y = Number(flight.fromY) || 0;
  const fromX = Number(flight.fromX) || 0;
  const fromY = Number(flight.fromY) || 0;
  const toX = Number(flight.toX) || 0;
  const toY = Number(flight.toY) || 0;
  if (!flight.interSector) {
    x = lerp(fromX, toX, progress);
    y = lerp(fromY, toY, progress);
  } else {
    const dx = Math.sign((flight.toSx | 0) - (flight.fromSx | 0));
    const dy = Math.sign((flight.toSy | 0) - (flight.fromSy | 0));
    const exitX = dx === 0 ? fromX : dx * SECTOR_EDGE;
    const exitY = dy === 0 ? fromY : dy * SECTOR_EDGE;
    const enterX = dx === 0 ? toX : -dx * SECTOR_EDGE;
    const enterY = dy === 0 ? toY : -dy * SECTOR_EDGE;
    if (progress < 0.5) {
      const p = progress / 0.5;
      sx = flight.fromSx | 0;
      sy = flight.fromSy | 0;
      x = lerp(fromX, exitX, p);
      y = lerp(fromY, exitY, p);
    } else {
      const p = (progress - 0.5) / 0.5;
      sx = flight.toSx | 0;
      sy = flight.toSy | 0;
      x = lerp(enterX, toX, p);
      y = lerp(enterY, toY, p);
    }
  }
  return {
    id: `logistic-drone-${flight.id}`,
    kind: 'logistic_drone',
    sx,
    sy,
    x: q(x),
    y: q(y),
    radius: 16,
    progress: q(progress, 3),
    resourceKey: flight.resourceKey || '',
    resourceName: flight.resourceName || resourceName(flight.resourceKey),
    amount: flight.amount | 0,
    fromLabel: flight.fromLabel || '',
    toLabel: flight.toLabel || '',
    interSector: !!flight.interSector,
    ownerName: flight.ownerName || '',
    tint: RESOURCE_DEFS[flight.resourceKey]?.colorHex || '#9edcff'
  };
}

export function buildLogisticDroneSnapshots(structures, inSector, timeMs = Date.now()) {
  const out = [];
  for (const station of structures?.values?.() || []) {
    if (!isDroneStationStructure(station)) continue;
    for (const flight of flights(station)) {
      if (String(flight.state || 'traveling') !== 'traveling') continue;
      const snap = flightSnapshot(flight, timeMs);
      if (inSector(snap)) out.push(snap);
    }
  }
  return out;
}

function tryRunOneMission(state, station, timeMs) {
  if (!station.powered) return false;
  const installed = installedDrones(station);
  if (installed <= 0) return false;
  if ((normalizeDroneCharge(station) | 0) <= 0) return false;
  if (activeFlightCount(station) >= installed) return false;
  const chests = networkLogisticChests(state, station);
  const requesters = chests.filter((st) => st.type === STRUCTURE_TYPES.LOGISTIC_CHEST_REQUESTER);
  const providers = chests.filter((st) => st.type === STRUCTURE_TYPES.LOGISTIC_CHEST_PROVIDER || st.type === STRUCTURE_TYPES.LOGISTIC_CHEST_BUFFER);
  for (const requester of requesters) {
    const reqs = requestEntries(requester).filter((r) => r.missing > 0);
    for (const req of reqs) {
      const key = req.key;
      const fit = storageRemainingUnits(requester, key);
      if (fit <= 0) continue;
      for (const provider of providers) {
        if ((provider.id | 0) === (requester.id | 0)) continue;
        const available = storageResources(provider)[key] | 0;
        if (available <= 0) continue;
        const amount = Math.max(0, Math.min(DRONE_CARGO, available, req.missing, fit));
        if (amount <= 0) continue;
        if (!consumeDroneCharge(station)) return false;
        storageResources(provider)[key] = (storageResources(provider)[key] | 0) - amount;
        if ((storageResources(provider)[key] | 0) <= 0) delete storageResources(provider)[key];
        createFlight(state, station, provider, requester, key, amount, timeMs);
        provider.updatedAt = timeMs;
        station.updatedAt = timeMs;
        return true;
      }
    }
  }
  return false;
}

export function updateLogisticDroneStations(state, dt, timeMs = Date.now()) {
  if (!state?.structures) return false;
  const stepMs = Math.max(0, Number(dt) || 0) * 1000;
  let shouldSave = false;
  for (const st of state.structures.values()) {
    if (!isDroneStationStructure(st)) continue;
    if (updateFlights(state, st, timeMs)) shouldSave ||= String(st.worldId || 'endless') === 'endless';
    if (rechargeDroneStation(st, stepMs, timeMs)) shouldSave ||= String(st.worldId || 'endless') === 'endless';
    if (timeMs < (st.nextLogisticMissionAt || 0)) continue;
    const installed = installedDrones(st);
    const interval = Math.max(900, LOGISTIC_TICK_MS / Math.max(1, Math.min(6, installed)));
    st.nextLogisticMissionAt = timeMs + interval;
    if (tryRunOneMission(state, st, timeMs)) shouldSave ||= String(st.worldId || 'endless') === 'endless';
  }
  if (shouldSave) state.structureStore?.saveFromState?.(state);
  return shouldSave;
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
  const installed = installedDrones(st);
  const capacity = Math.max(1, def.droneCapacity | 0 || 8);
  const chargeMax = droneChargeCapacity(st);
  const charge = normalizeDroneCharge(st);
  const rechargeMs = Math.max(1000, (Number(def.droneRechargeSeconds) || 20) * 1000);
  const rechargeProgress = chargeMax > 0 && charge < chargeMax ? Math.max(0, Math.min(1, (Number(st.logisticDroneRechargeMs) || 0) / rechargeMs)) : 1;
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
    droneCargo: DRONE_CARGO,
    rangeSectors: Math.max(1, def.droneRangeSectors | 0 || 1),
    rechargeSeconds: Math.max(1, def.droneRechargeSeconds | 0 || 20),
    deliveriesPerCharge: DRONE_DELIVERIES_BEFORE_RECHARGE,
    droneCharge: charge,
    droneChargeMax: chargeMax,
    chargedDrones: chargeMax > 0 ? Math.floor(charge / DRONE_DELIVERIES_BEFORE_RECHARGE) : 0,
    partialDroneCharge: chargeMax > 0 ? charge % DRONE_DELIVERIES_BEFORE_RECHARGE : 0,
    activeFlights: activeFlightCount(st),
    maxActiveFlights: installed,
    rechargeProgress,
    rechargeProgressPct: Math.round(rechargeProgress * 100),
    nextMissionSeconds: Math.max(0, Math.round(((st.nextLogisticMissionAt || 0) - Date.now()) / 100) / 10),
    connectedStations: countDroneStations(state, player, st),
    localChests: countLogisticChests(state, player, st),
    routeMode: 'inter_sector_v1',
    missions: (st.logisticMissionLog || []).slice(0, MISSION_LOG_MAX)
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
    used: getStorageUsed(st),
    resources: buildResourceEntries(resources),
    modeLabel: type === 'provider' ? 'Fournisseur' : type === 'requester' ? 'Demandeur' : 'Tampon',
    description: def.description || '',
    requests: requestEntries(st),
    requestCandidates: type === 'requester' ? requestCandidates(state, player, st) : []
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
    normalizeDroneCharge(st);
  } else {
    const free = Math.max(0, cap - (resources[DRONE_KEY] | 0));
    const take = Math.min(player?.inv?.resources?.[DRONE_KEY] | 0, n, free);
    if (take <= 0) return false;
    const moved = removeResource(player.inv, DRONE_KEY, take);
    if (moved <= 0) return false;
    resources[DRONE_KEY] = (resources[DRONE_KEY] | 0) + moved;
    st.logisticDroneCharge = Math.min(droneChargeCapacity(st), (normalizeDroneCharge(st) | 0) + moved * DRONE_DELIVERIES_BEFORE_RECHARGE);
  }
  if ((resources[DRONE_KEY] | 0) <= 0) delete resources[DRONE_KEY];
  normalizeDroneCharge(st);
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return true;
}

export function setLogisticChestRequest(state, player, structureId, resourceKey, delta = 0, setTarget = null, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canPlayerAccessLogisticsStructure(state, player, st) || st.type !== STRUCTURE_TYPES.LOGISTIC_CHEST_REQUESTER) return false;
  const key = String(resourceKey || '');
  if (!RESOURCE_DEFS[key]) return false;
  const req = requestMap(st);
  const current = req[key] | 0;
  const next = setTarget !== null && setTarget !== undefined
    ? Math.max(0, Math.min(9999, setTarget | 0))
    : Math.max(0, Math.min(9999, current + (delta | 0)));
  if (next > 0) req[key] = next;
  else delete req[key];
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return true;
}
