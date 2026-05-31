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
const LOGISTIC_DRONE_HP = 35;
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


function buildNetworkDiagnostics(state, station) {
  const chests = networkLogisticChests(state, station);
  const providers = chests.filter((st) => st.type === STRUCTURE_TYPES.LOGISTIC_CHEST_PROVIDER || st.type === STRUCTURE_TYPES.LOGISTIC_CHEST_BUFFER);
  const requesters = chests.filter((st) => st.type === STRUCTURE_TYPES.LOGISTIC_CHEST_REQUESTER);
  const active = flights(station).filter((flight) => isActiveFlightState(flight.state));
  const lines = [];

  for (const requester of requesters) {
    for (const req of requestEntries(requester).filter((entry) => entry.missing > 0)) {
      const key = req.key;
      const sourceUnits = providers.reduce((sum, provider) => sum + Math.max(0, storageResources(provider)[key] | 0), 0);
      const incoming = active
        .filter((flight) => (flight.toId | 0) === (requester.id | 0) && String(flight.resourceKey || '') === key && !flight.delivered)
        .reduce((sum, flight) => sum + Math.max(0, flight.amount | 0), 0);
      const remainingAfterIncoming = Math.max(0, (req.missing | 0) - incoming);
      const status = remainingAfterIncoming <= 0 ? 'incoming' : sourceUnits > 0 ? 'ready' : 'missing_source';
      lines.push({
        requesterId: requester.id | 0,
        requesterLabel: `${chestLabel(requester)} [${requester.sx | 0},${requester.sy | 0}]`,
        resourceKey: key,
        resourceName: resourceName(key),
        target: req.target | 0,
        current: req.current | 0,
        missing: req.missing | 0,
        incoming,
        sourceUnits,
        remainingAfterIncoming,
        status
      });
    }
  }

  const diagnostics = [];
  if (!station.powered) diagnostics.push({ level: 'warn', text: 'Station non alimentée : départs et recharges interrompus.' });
  if (installedDrones(station) <= 0) diagnostics.push({ level: 'warn', text: 'Aucun drone installé dans la station.' });
  if (!requesters.length) diagnostics.push({ level: 'info', text: 'Aucun coffre demandeur dans le réseau couvert.' });
  if (!providers.length) diagnostics.push({ level: 'info', text: 'Aucun coffre de chargement ou tampon dans le réseau couvert.' });
  if (requesters.length && providers.length && !lines.length) diagnostics.push({ level: 'ok', text: 'Aucune demande en manque pour le moment.' });
  const missingSources = lines.filter((line) => line.status === 'missing_source').length;
  const ready = lines.filter((line) => line.status === 'ready').length;
  const incoming = lines.filter((line) => line.status === 'incoming').length;
  if (missingSources) diagnostics.push({ level: 'warn', text: `${missingSources} demande(s) sans source disponible.` });
  if (ready) diagnostics.push({ level: 'ok', text: `${ready} demande(s) prêtes à être livrées.` });
  if (incoming) diagnostics.push({ level: 'ok', text: `${incoming} demande(s) déjà couvertes par des drones en vol.` });

  return {
    status: !station.powered || installedDrones(station) <= 0 || missingSources ? 'warn' : 'ok',
    requestCount: lines.length,
    readyCount: ready,
    incomingCount: incoming,
    missingSourceCount: missingSources,
    diagnostics,
    lines: lines.slice(0, 12)
  };
}

function activeStationFlights(station, timeMs = Date.now()) {
  return flights(station)
    .filter((flight) => isActiveFlightState(flight.state))
    .map((flight) => {
      const snap = flightSnapshot(flight, timeMs);
      const remainingMs = Math.max(0, Number(flight.returnArriveAt || flight.arriveAt || 0) - timeMs);
      return {
        id: String(flight.id || ''),
        phase: snap.phase,
        resourceKey: flight.resourceKey || '',
        resourceName: flight.resourceName || resourceName(flight.resourceKey),
        amount: flight.amount | 0,
        progressPct: Math.round((snap.progress || 0) * 100),
        remainingSeconds: Math.round(remainingMs / 100) / 10,
        interSector: !!flight.interSector,
        fromLabel: flight.fromLabel || 'source',
        toLabel: flight.toLabel || 'destination',
        stationLabel: flight.stationLabel || 'station',
        hp: Math.max(0, Math.round(Number(flight.hp ?? LOGISTIC_DRONE_HP))),
        maxHp: Math.max(1, Math.round(Number(flight.maxHp || LOGISTIC_DRONE_HP)))
      };
    })
    .slice(0, 16);
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

function droneSlotId(st, index) {
  return `${st.id | 0}:${index | 0}`;
}

function activeDroneIds(st) {
  const ids = new Set();
  for (const flight of flights(st)) {
    const state = String(flight.state || 'to_source');
    if (state !== 'complete' && state !== 'cancelled' && flight.droneSlotId) ids.add(String(flight.droneSlotId));
  }
  return ids;
}

function normalizeDroneSlots(st) {
  const installed = installedDrones(st);
  const activeIds = activeDroneIds(st);
  let raw = Array.isArray(st.logisticDroneSlots) ? st.logisticDroneSlots.filter(Boolean).map((slot, index) => ({
    id: String(slot.id || droneSlotId(st, index)),
    charge: Math.max(0, Math.min(DRONE_DELIVERIES_BEFORE_RECHARGE, Number(slot.charge ?? DRONE_DELIVERIES_BEFORE_RECHARGE) | 0)),
    rechargeMs: Math.max(0, Number(slot.rechargeMs || 0) || 0)
  })) : [];

  if (!raw.length && installed > 0 && Number.isFinite(Number(st.logisticDroneCharge))) {
    let remaining = Math.max(0, Math.min(installed * DRONE_DELIVERIES_BEFORE_RECHARGE, Number(st.logisticDroneCharge) | 0));
    raw = Array.from({ length: installed }, (_, index) => {
      const charge = Math.min(DRONE_DELIVERIES_BEFORE_RECHARGE, remaining);
      remaining -= charge;
      return { id: droneSlotId(st, index), charge, rechargeMs: 0 };
    });
  }

  while (raw.length < installed) raw.push({ id: droneSlotId(st, raw.length), charge: DRONE_DELIVERIES_BEFORE_RECHARGE, rechargeMs: 0 });
  if (raw.length > installed) {
    const idle = raw.filter((slot) => !activeIds.has(slot.id));
    const active = raw.filter((slot) => activeIds.has(slot.id));
    raw = [...active, ...idle].slice(0, installed);
  }

  raw.forEach((slot, index) => {
    slot.id ||= droneSlotId(st, index);
    slot.charge = Math.max(0, Math.min(DRONE_DELIVERIES_BEFORE_RECHARGE, slot.charge | 0));
    if (slot.charge >= DRONE_DELIVERIES_BEFORE_RECHARGE) slot.rechargeMs = 0;
    slot.rechargeMs = Math.max(0, Number(slot.rechargeMs || 0) || 0);
  });

  st.logisticDroneSlots = raw;
  st.logisticDroneCharge = raw.reduce((sum, slot) => sum + Math.max(0, slot.charge | 0), 0);
  const charging = raw.filter((slot) => !activeIds.has(slot.id) && (slot.charge | 0) <= 0);
  st.logisticDroneRechargeMs = charging.length ? Math.max(...charging.map((slot) => Number(slot.rechargeMs || 0) || 0)) : 0;
  return raw;
}

function droneChargeCapacity(st) {
  return installedDrones(st) * DRONE_DELIVERIES_BEFORE_RECHARGE;
}

function rechargeDroneStation(st, dtMs, timeMs) {
  if (!isDroneStationStructure(st)) return false;
  const slots = normalizeDroneSlots(st);
  if (!slots.length || !st.powered) return false;
  const activeIds = activeDroneIds(st);
  const def = getStructureDef(st.type) || {};
  const rechargeMs = Math.max(1000, (Number(def.droneRechargeSeconds) || 20) * 1000);
  let changed = false;
  for (const slot of slots) {
    if (activeIds.has(slot.id)) continue;
    if ((slot.charge | 0) > 0) continue;
    slot.rechargeMs = Math.min(rechargeMs, Math.max(0, Number(slot.rechargeMs || 0) || 0) + Math.max(0, Number(dtMs) || 0));
    if (slot.rechargeMs >= rechargeMs) {
      slot.charge = DRONE_DELIVERIES_BEFORE_RECHARGE;
      slot.rechargeMs = 0;
    }
    changed = true;
  }
  if (changed) {
    normalizeDroneSlots(st);
    st.updatedAt = timeMs;
  }
  return changed;
}

function availableDroneSlot(st) {
  const activeIds = activeDroneIds(st);
  return normalizeDroneSlots(st).find((slot) => !activeIds.has(slot.id) && (slot.charge | 0) > 0) || null;
}

function claimDroneForMission(st) {
  const slot = availableDroneSlot(st);
  if (!slot) return null;
  slot.charge = Math.max(0, (slot.charge | 0) - 1);
  if ((slot.charge | 0) <= 0) slot.rechargeMs = 0;
  normalizeDroneSlots(st);
  return slot;
}

function finishDroneMission(st, flight, timeMs) {
  const slots = normalizeDroneSlots(st);
  const slot = slots.find((entry) => entry.id === String(flight.droneSlotId || ''));
  if (slot && (slot.charge | 0) <= 0) slot.rechargeMs = 0;
  normalizeDroneSlots(st);
  st.updatedAt = timeMs;
}

function stationDroneStatus(st) {
  const slots = normalizeDroneSlots(st);
  const activeIds = activeDroneIds(st);
  const active = slots.filter((slot) => activeIds.has(slot.id)).length;
  const charging = slots.filter((slot) => !activeIds.has(slot.id) && (slot.charge | 0) <= 0).length;
  const available = slots.filter((slot) => !activeIds.has(slot.id) && (slot.charge | 0) > 0).length;
  const full = slots.filter((slot) => (slot.charge | 0) >= DRONE_DELIVERIES_BEFORE_RECHARGE).length;
  const charge = slots.reduce((sum, slot) => sum + Math.max(0, slot.charge | 0), 0);
  return { active, charging, available, full, charge, maxCharge: slots.length * DRONE_DELIVERIES_BEFORE_RECHARGE, slots };
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

function isActiveFlightState(state) {
  const value = String(state || 'to_source');
  return value !== 'complete' && value !== 'cancelled';
}

function activeFlightCount(st) {
  return flights(st).filter((flight) => isActiveFlightState(flight.state)).length;
}

function nextFlightId(st, timeMs) {
  st.nextLogisticFlightSeq = Math.max(0, st.nextLogisticFlightSeq | 0) + 1;
  return `${st.id | 0}-${timeMs}-${st.nextLogisticFlightSeq}`;
}


function pointFromStructure(st, label = '') {
  return {
    id: st?.id | 0,
    sx: st?.sx | 0,
    sy: st?.sy | 0,
    x: Number(st?.x) || 0,
    y: Number(st?.y) || 0,
    label: label || `${chestLabel(st)} [${st?.sx | 0},${st?.sy | 0}]`
  };
}

function legDurationMs(a, b) {
  const inter = ((a.sx | 0) !== (b.sx | 0)) || ((a.sy | 0) !== (b.sy | 0));
  if (inter) {
    const sectorSteps = Math.max(1, Math.max(Math.abs((a.sx | 0) - (b.sx | 0)), Math.abs((a.sy | 0) - (b.sy | 0))));
    return Math.max(3400, 2600 + sectorSteps * 2400);
  }
  return Math.max(900, Math.min(5200, Math.round(Math.hypot((b.x || 0) - (a.x || 0), (b.y || 0) - (a.y || 0)) / LOGISTIC_DRONE_SPEED * 1000)));
}

function createFlight(state, station, droneSlot, provider, requester, key, amount, timeMs) {
  const home = pointFromStructure(station, `station [${station.sx | 0},${station.sy | 0}]`);
  const source = pointFromStructure(provider, `${chestLabel(provider)} [${provider.sx | 0},${provider.sy | 0}]`);
  const destination = pointFromStructure(requester, `${chestLabel(requester)} [${requester.sx | 0},${requester.sy | 0}]`);
  const sourceDurationMs = legDurationMs(home, source);
  const deliveryDurationMs = legDurationMs(source, destination);
  const returnDurationMs = legDurationMs(destination, home);
  const sourceArriveAt = timeMs + sourceDurationMs;
  const destArriveAt = sourceArriveAt + deliveryDurationMs;
  const returnArriveAt = destArriveAt + returnDurationMs;
  const flight = {
    id: nextFlightId(station, timeMs),
    state: 'to_source',
    droneSlotId: String(droneSlot?.id || ''),
    stationId: station.id | 0,
    ownerKey: station.ownerKey || '',
    ownerName: station.ownerName || '',
    worldId: station.worldId || 'endless',
    resourceKey: key,
    resourceName: resourceName(key),
    amount: amount | 0,
    startedAt: timeMs,
    sourceArriveAt,
    destArriveAt,
    returnArriveAt,
    arriveAt: returnArriveAt,
    durationMs: returnArriveAt - timeMs,
    hp: LOGISTIC_DRONE_HP,
    maxHp: LOGISTIC_DRONE_HP,
    fromId: provider.id | 0,
    toId: requester.id | 0,
    fromSx: provider.sx | 0,
    fromSy: provider.sy | 0,
    toSx: requester.sx | 0,
    toSy: requester.sy | 0,
    sourceDurationMs,
    deliveryDurationMs,
    returnDurationMs,
    home,
    source,
    destination,
    fromX: home.x,
    fromY: home.y,
    toX: destination.x,
    toY: destination.y,
    interSector: (provider.sx | 0) !== (requester.sx | 0) || (provider.sy | 0) !== (requester.sy | 0),
    stationLabel: home.label,
    fromLabel: source.label,
    toLabel: destination.label,
    delivered: false
  };
  flights(station).push(flight);
  pushMissionLog(station, {
    kind: 'flight_start',
    phase: 'depart_station',
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
    stationLabel: flight.stationLabel,
    fromLabel: flight.fromLabel,
    toLabel: flight.toLabel
  });
  return flight;
}

function deliverFlightCargo(state, station, flight, timeMs) {
  if (flight.delivered) return true;
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
  flight.delivered = true;
  pushMissionLog(station, {
    kind: delivered > 0 ? 'delivery' : 'delivery_failed',
    phase: 'delivered_returning',
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
    stationLabel: flight.stationLabel || 'station',
    fromLabel: flight.fromLabel || 'source',
    toLabel: flight.toLabel || 'destination'
  });
  station.updatedAt = timeMs;
  return delivered > 0;
}

function updateFlights(state, station, timeMs) {
  const list = flights(station);
  if (!list.length) return false;
  let changed = false;
  for (const flight of list) {
    const stateName = String(flight.state || 'to_source');
    if (stateName === 'complete' || stateName === 'cancelled') continue;
    if (stateName === 'to_source' && timeMs >= (Number(flight.sourceArriveAt) || 0)) {
      flight.state = 'to_destination';
      changed = true;
    }
    if (String(flight.state || '') === 'to_destination' && timeMs >= (Number(flight.destArriveAt) || 0)) {
      deliverFlightCargo(state, station, flight, timeMs);
      flight.state = 'returning';
      changed = true;
    }
    if (String(flight.state || '') === 'returning' && timeMs >= (Number(flight.returnArriveAt || flight.arriveAt) || 0)) {
      finishDroneMission(station, flight, timeMs);
      flight.state = 'complete';
      pushMissionLog(station, {
        kind: 'drone_return',
        phase: 'return_station',
        resourceKey: flight.resourceKey || '',
        resourceName: flight.resourceName || resourceName(flight.resourceKey),
        amount: flight.amount | 0,
        fromLabel: flight.toLabel || 'destination',
        toLabel: flight.stationLabel || 'station'
      });
      changed = true;
    }
  }
  const before = list.length;
  station.logisticDroneFlights = list.filter((flight) => {
    const stateName = String(flight.state || 'to_source');
    return stateName !== 'complete' && stateName !== 'cancelled';
  });
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

function distPointToSegmentSq(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq <= 0.000001) {
    const dx = px - bx;
    const dy = py - by;
    return dx * dx + dy * dy;
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
  const x = ax + abx * t;
  const y = ay + aby * t;
  const dx = px - x;
  const dy = py - y;
  return dx * dx + dy * dy;
}

function playerOwnerKey(player) {
  return String(player?.accountKey || player?.accountName || player?.pseudo || `guest-${player?.id | 0}`).toLowerCase();
}


function interpolateSegment(a, b, progress) {
  let sx = a.sx | 0;
  let sy = a.sy | 0;
  let x = Number(a.x) || 0;
  let y = Number(a.y) || 0;
  const inter = ((a.sx | 0) !== (b.sx | 0)) || ((a.sy | 0) !== (b.sy | 0));
  if (!inter) {
    return { sx, sy, x: lerp(a.x || 0, b.x || 0, progress), y: lerp(a.y || 0, b.y || 0, progress) };
  }
  const dx = Math.sign((b.sx | 0) - (a.sx | 0));
  const dy = Math.sign((b.sy | 0) - (a.sy | 0));
  const exitX = dx === 0 ? a.x : dx * SECTOR_EDGE;
  const exitY = dy === 0 ? a.y : dy * SECTOR_EDGE;
  const enterX = dx === 0 ? b.x : -dx * SECTOR_EDGE;
  const enterY = dy === 0 ? b.y : -dy * SECTOR_EDGE;
  if (progress < 0.5) {
    const p = progress / 0.5;
    return { sx: a.sx | 0, sy: a.sy | 0, x: lerp(a.x || 0, exitX, p), y: lerp(a.y || 0, exitY, p) };
  }
  const p = (progress - 0.5) / 0.5;
  return { sx: b.sx | 0, sy: b.sy | 0, x: lerp(enterX, b.x || 0, p), y: lerp(enterY, b.y || 0, p) };
}

function flightSnapshot(flight, timeMs) {
  const home = flight.home || { sx: flight.fromSx | 0, sy: flight.fromSy | 0, x: Number(flight.fromX) || 0, y: Number(flight.fromY) || 0, label: flight.stationLabel || 'station' };
  const source = flight.source || { sx: flight.fromSx | 0, sy: flight.fromSy | 0, x: Number(flight.fromX) || 0, y: Number(flight.fromY) || 0, label: flight.fromLabel || 'source' };
  const destination = flight.destination || { sx: flight.toSx | 0, sy: flight.toSy | 0, x: Number(flight.toX) || 0, y: Number(flight.toY) || 0, label: flight.toLabel || 'destination' };
  const sourceArriveAt = Number(flight.sourceArriveAt || 0) || ((Number(flight.startedAt) || 0) + Math.max(1, Number(flight.durationMs || 1) * 0.25));
  const destArriveAt = Number(flight.destArriveAt || 0) || ((Number(flight.startedAt) || 0) + Math.max(1, Number(flight.durationMs || 1) * 0.75));
  const returnArriveAt = Number(flight.returnArriveAt || flight.arriveAt || 0) || ((Number(flight.startedAt) || 0) + Math.max(1, Number(flight.durationMs || 1)));
  let a = home;
  let b = source;
  let segmentStart = Number(flight.startedAt) || 0;
  let segmentEnd = sourceArriveAt;
  let phase = 'station → chargement';
  if (timeMs >= destArriveAt) {
    a = destination;
    b = home;
    segmentStart = destArriveAt;
    segmentEnd = returnArriveAt;
    phase = 'retour station';
  } else if (timeMs >= sourceArriveAt) {
    a = source;
    b = destination;
    segmentStart = sourceArriveAt;
    segmentEnd = destArriveAt;
    phase = 'livraison';
  }
  const segmentProgress = clamp01((timeMs - segmentStart) / Math.max(1, segmentEnd - segmentStart));
  const p = interpolateSegment(a, b, segmentProgress);
  const total = Math.max(1, returnArriveAt - (Number(flight.startedAt) || 0));
  const progress = clamp01((timeMs - (Number(flight.startedAt) || 0)) / total);
  return {
    id: `logistic-drone-${flight.id}`,
    kind: 'logistic_drone',
    sx: p.sx | 0,
    sy: p.sy | 0,
    x: q(p.x),
    y: q(p.y),
    radius: 16,
    progress: q(progress, 3),
    phase,
    resourceKey: flight.resourceKey || '',
    resourceName: flight.resourceName || resourceName(flight.resourceKey),
    amount: flight.amount | 0,
    fromLabel: flight.fromLabel || source.label || '',
    toLabel: flight.toLabel || destination.label || '',
    stationLabel: flight.stationLabel || home.label || '',
    interSector: !!flight.interSector,
    ownerName: flight.ownerName || '',
    vitals: { hp: q(flight.hp ?? LOGISTIC_DRONE_HP, 0), maxHp: q(flight.maxHp ?? LOGISTIC_DRONE_HP, 0) },
    tint: RESOURCE_DEFS[flight.resourceKey]?.colorHex || '#9edcff'
  };
}

export function damageLogisticDroneByProjectile(state, proj, oldX, oldY, sourcePlayer, timeMs = Date.now()) {
  if (!state?.structures || !proj || !sourcePlayer) return null;
  const attackerKey = playerOwnerKey(sourcePlayer);
  if (!attackerKey) return null;
  for (const station of state.structures.values()) {
    if (!isDroneStationStructure(station)) continue;
    if (String(station.worldId || 'endless') !== String(sourcePlayer.worldId || 'endless')) continue;
    if (ownerKeyOf(station) === attackerKey) continue;
    for (const flight of flights(station)) {
      if (!isActiveFlightState(flight.state)) continue;
      const snap = flightSnapshot(flight, timeMs);
      if ((snap.sx | 0) !== (proj.sx | 0) || (snap.sy | 0) !== (proj.sy | 0)) continue;
      const radius = Math.max(8, Number(snap.radius || 16)) + Math.max(0, Number(proj.radius || 0));
      if (distPointToSegmentSq(snap.x || 0, snap.y || 0, oldX || proj.x || 0, oldY || proj.y || 0, proj.x || 0, proj.y || 0) > radius * radius) continue;
      flight.hp = Math.max(0, Number(flight.hp ?? LOGISTIC_DRONE_HP) - Math.max(1, Number(proj.damage || 0)));
      flight.maxHp = Math.max(1, Number(flight.maxHp || LOGISTIC_DRONE_HP));
      station.updatedAt = timeMs;
      if (flight.hp <= 0) {
        flight.state = 'cancelled';
        pushMissionLog(station, {
          kind: 'drone_destroyed',
          phase: 'destroyed',
          resourceKey: flight.resourceKey || '',
          resourceName: flight.resourceName || resourceName(flight.resourceKey),
          amount: flight.amount | 0,
          fromId: flight.fromId | 0,
          toId: flight.toId | 0,
          fromSx: flight.fromSx | 0,
          fromSy: flight.fromSy | 0,
          toSx: flight.toSx | 0,
          toSy: flight.toSy | 0,
          interSector: !!flight.interSector,
          attackerName: sourcePlayer.pseudo || sourcePlayer.name || 'joueur',
          stationLabel: flight.stationLabel || 'station',
          fromLabel: flight.fromLabel || 'source',
          toLabel: flight.toLabel || 'destination'
        });
      }
      if (String(station.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
      return { id: snap.id, kind: 'logistic_drone', sx: snap.sx | 0, sy: snap.sy | 0, x: snap.x || 0, y: snap.y || 0, radius: snap.radius || 16, stats: { hp: Math.max(0, flight.hp | 0), maxHp: LOGISTIC_DRONE_HP } };
    }
  }
  return null;
}

export function buildLogisticDroneSnapshots(structures, inSector, timeMs = Date.now()) {
  const out = [];
  for (const station of structures?.values?.() || []) {
    if (!isDroneStationStructure(station)) continue;
    for (const flight of flights(station)) {
      if (!isActiveFlightState(flight.state)) continue;
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
  const droneSlot = availableDroneSlot(station);
  if (!droneSlot) return false;
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
        const claimed = claimDroneForMission(station);
        if (!claimed) return false;
        storageResources(provider)[key] = (storageResources(provider)[key] | 0) - amount;
        if ((storageResources(provider)[key] | 0) <= 0) delete storageResources(provider)[key];
        createFlight(state, station, claimed, provider, requester, key, amount, timeMs);
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
  const droneStatus = stationDroneStatus(st);
  const chargeMax = droneStatus.maxCharge;
  const charge = droneStatus.charge;
  const rechargeMs = Math.max(1000, (Number(def.droneRechargeSeconds) || 20) * 1000);
  const chargingSlots = droneStatus.slots.filter((slot) => !activeDroneIds(st).has(slot.id) && (slot.charge | 0) <= 0);
  const rechargeProgress = chargingSlots.length
    ? Math.max(0, Math.min(1, chargingSlots.reduce((sum, slot) => sum + Math.max(0, Number(slot.rechargeMs || 0) || 0), 0) / Math.max(1, chargingSlots.length * rechargeMs)))
    : 1;
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
    availableDrones: droneStatus.available,
    chargingDrones: droneStatus.charging,
    fullDrones: droneStatus.full,
    chargedDrones: droneStatus.available,
    partialDroneCharge: chargeMax > 0 ? charge % DRONE_DELIVERIES_BEFORE_RECHARGE : 0,
    droneSlots: droneStatus.slots.map((slot) => ({ id: slot.id, charge: slot.charge | 0, rechargeProgress: (slot.charge | 0) > 0 ? 1 : Math.max(0, Math.min(1, Number(slot.rechargeMs || 0) / rechargeMs)) })),
    activeFlights: activeFlightCount(st),
    maxActiveFlights: installed,
    rechargeProgress,
    rechargeProgressPct: Math.round(rechargeProgress * 100),
    nextMissionSeconds: Math.max(0, Math.round(((st.nextLogisticMissionAt || 0) - Date.now()) / 100) / 10),
    connectedStations: countDroneStations(state, player, st),
    localChests: countLogisticChests(state, player, st),
    routeMode: 'inter_sector_v1',
    diagnostics: buildNetworkDiagnostics(state, st),
    activeRoutes: activeStationFlights(st, Date.now()),
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
    const activeIds = activeDroneIds(st);
    const slots = normalizeDroneSlots(st);
    const removable = slots.filter((slot) => !activeIds.has(slot.id));
    const take = Math.min(resources[DRONE_KEY] | 0, removable.length, n);
    if (take <= 0) return false;
    const added = addResource(player.inv, DRONE_KEY, take);
    if (added <= 0) return false;
    const removeIds = new Set(removable.slice(-added).map((slot) => slot.id));
    st.logisticDroneSlots = slots.filter((slot) => !removeIds.has(slot.id));
    resources[DRONE_KEY] = (resources[DRONE_KEY] | 0) - added;
  } else {
    const free = Math.max(0, cap - (resources[DRONE_KEY] | 0));
    const take = Math.min(player?.inv?.resources?.[DRONE_KEY] | 0, n, free);
    if (take <= 0) return false;
    const moved = removeResource(player.inv, DRONE_KEY, take);
    if (moved <= 0) return false;
    resources[DRONE_KEY] = (resources[DRONE_KEY] | 0) + moved;
    normalizeDroneSlots(st);
    while ((st.logisticDroneSlots?.length || 0) < (resources[DRONE_KEY] | 0)) {
      st.logisticDroneSlots.push({ id: droneSlotId(st, st.logisticDroneSlots.length), charge: DRONE_DELIVERIES_BEFORE_RECHARGE, rechargeMs: 0 });
    }
  }
  if ((resources[DRONE_KEY] | 0) <= 0) delete resources[DRONE_KEY];
  normalizeDroneSlots(st);
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
