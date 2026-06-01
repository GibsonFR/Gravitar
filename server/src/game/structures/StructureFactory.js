import { FACTIONS } from '../constants.js';
import { createStatBlock } from '../stats/StatBlockFactory.js';
import { newEntityId } from '../state/GameState.js';
import { getStructureDef } from './StructureDefs.js';


function buildStructureStorage(def, saved = null) {
  const kind = def?.storageKind || '';
  if (!kind) return saved || { resources: {} };
  if (kind === 'conveyor') {
    const resources = saved?.resources && typeof saved.resources === 'object' ? { ...saved.resources } : {};
    return { kind, resources, capacity: saved?.capacity || def.storageCapacity || 0 };
  }
  if (kind === 'fuel') {
    const resources = saved?.resources && typeof saved.resources === 'object' ? { ...saved.resources } : {};
    return { kind, resources, capacity: saved?.capacity || def.fuelCapacity || 0 };
  }
  if (kind === 'equipment') {
    const items = Array.isArray(saved?.items) ? saved.items.map((id) => String(id || '')).filter(Boolean) : [];
    return { kind, items, itemCapacity: def.itemCapacity || 0 };
  }
  if (kind === 'ammo') {
    const ammo = saved?.ammo && typeof saved.ammo === 'object' ? { ...saved.ammo } : {};
    return { kind, ammo, ammoCapacity: def.ammoCapacity || 0 };
  }
  const resources = saved?.resources && typeof saved.resources === 'object' ? { ...saved.resources } : {};
  return { kind: 'resources', resources, capacity: saved?.capacity || def.storageCapacity || 0 };
}

function q(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

function clonePositiveResourceMap(map = {}) {
  const out = {};
  if (!map || typeof map !== 'object') return out;
  for (const [key, amount] of Object.entries(map)) {
    const n = Math.max(0, Number(amount) | 0);
    if (key && n > 0) out[String(key)] = n;
  }
  return out;
}

function clonePlainObject(value, fallback = null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  return { ...value };
}

function cloneJsonValue(value, fallback = null) {
  if (value === undefined || value === null) return fallback;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function cloneJsonArray(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  const cloned = cloneJsonValue(value, fallback);
  return Array.isArray(cloned) ? cloned : fallback;
}

export function createStructure(state, type, sx, sy, x, y, options = {}) {
  const def = getStructureDef(type);
  if (!def) return null;
  const rawOrientation = String(options.orientation || 'h').toLowerCase();
  const orientation = ['h', 'v', 'r', 'd', 'l', 'u'].includes(rawOrientation) ? rawOrientation : 'h';
  const verticalOrientation = orientation === 'v' || orientation === 'u' || orientation === 'd';
  const swap = verticalOrientation && (Number(def.w) !== Number(def.h) || Number(def.tilesX || 0) !== Number(def.tilesY || 0));
  const id = Number.isFinite(options.id) ? (options.id | 0) : newEntityId(state);
  const damageable = def.damageable !== false;
  const maxHp = damageable ? Math.max(1, options.maxHp || def.maxHp || 100) : 0;
  return {
    kind: 'structure',
    id,
    type: def.id,
    name: def.name,
    faction: FACTIONS.NEUTRAL ?? 0,
    ownerId: options.ownerId | 0 || 0,
    ownerKey: String(options.ownerKey || ''),
    ownerName: String(options.ownerName || '').slice(0, 24),
    worldId: String(options.worldId || 'endless'),
    sx: sx | 0,
    sy: sy | 0,
    x: q(x),
    y: q(y),
    radius: q(def.radius, 42),
    w: swap ? q(def.h, 48) : q(def.w, def.radius * 2),
    h: swap ? q(def.w, 190) : q(def.h, def.radius * 2),
    orientation,
    stats: createStatBlock({ maxHp }),
    damageable,
    open: !!options.open,
    openable: !!def.openable,
    solid: !!def.solid && !options.open,
    claimRadius: def.claimRadius || 0,
    storage: buildStructureStorage(def, options.storage),
    logisticRequests: options.logisticRequests && typeof options.logisticRequests === 'object' ? { ...options.logisticRequests } : {},
    logisticMissionLog: Array.isArray(options.logisticMissionLog) ? options.logisticMissionLog.slice(0, 10) : [],
    logisticDroneFlights: Array.isArray(options.logisticDroneFlights) ? options.logisticDroneFlights.slice(0, 32).map((f) => ({ ...f })) : [],
    logisticDroneSlots: Array.isArray(options.logisticDroneSlots) ? options.logisticDroneSlots.map((slot) => ({ ...slot })) : [],
    nextLogisticFlightSeq: Math.max(0, options.nextLogisticFlightSeq | 0 || 0),
    nextLogisticMissionAt: Number(options.nextLogisticMissionAt || 0) || 0,
    turretEnabled: options.turretEnabled !== false,
    turretMode: String(options.turretMode || 'auto'),
    turretCooldownUntil: Number(options.turretCooldownUntil || 0) || 0,
    turretTargetId: options.turretTargetId | 0 || 0,
    turretStatus: String(options.turretStatus || ''),
    logisticDroneCharge: Number.isFinite(Number(options.logisticDroneCharge)) ? Math.max(0, Number(options.logisticDroneCharge) | 0) : undefined,
    logisticDroneRechargeMs: Number.isFinite(Number(options.logisticDroneRechargeMs)) ? Math.max(0, Number(options.logisticDroneRechargeMs)) : 0,
    machineInput: options.machineInput && typeof options.machineInput === 'object' ? { ...options.machineInput } : {},
    rocketWorkshopInput: options.rocketWorkshopInput && typeof options.rocketWorkshopInput === 'object' ? { ...options.rocketWorkshopInput } : {},
    rocketWorkshopOutput: options.rocketWorkshopOutput && typeof options.rocketWorkshopOutput === 'object' ? { ...options.rocketWorkshopOutput } : {},
    rocketWorkshopCustomAmmoDefs: cloneJsonValue(options.rocketWorkshopCustomAmmoDefs, {}),
    rocketWorkshopEnabled: options.rocketWorkshopEnabled !== false,
    rocketWorkshopJob: cloneJsonValue(options.rocketWorkshopJob, null),
    lastRocketWorkshopProduced: cloneJsonValue(options.lastRocketWorkshopProduced, null),
    machineOutput: options.machineOutput && typeof options.machineOutput === 'object' ? { ...options.machineOutput } : {},
    scienceInput: clonePositiveResourceMap(options.scienceInput),
    researchJob: cloneJsonValue(options.researchJob, null),
    researchEnabled: options.researchEnabled !== false,
    researchStatus: String(options.researchStatus || ''),
    machineRecipeId: String(options.machineRecipeId || ''),
    machineEnabled: options.machineEnabled !== false,
    machineJob: cloneJsonValue(options.machineJob, null),
    lastMachineProduced: cloneJsonValue(options.lastMachineProduced, null),
    equipmentOutputItems: cloneJsonArray(options.equipmentOutputItems),
    rdInputItem: cloneJsonValue(options.rdInputItem, null),
    rdOutputItem: cloneJsonValue(options.rdOutputItem, null),
    rdJob: cloneJsonValue(options.rdJob, null),
    color: def.color || '#526274',
    borderColor: def.borderColor || '#9fcfff',
    powered: false,
    energyOutput: Number(def.energyOutput) || 0,
    energyUse: Number(def.energyUse) || 0,
    fuelUsePerSecond: Number(def.fuelUsePerSecond) || 0,
    fuelBufferSeconds: Number(options.fuelBufferSeconds ?? options.energyBuffer ?? 0) || 0,
    energyState: options.energyState || null,
    automationJob: options.automationJob && typeof options.automationJob === 'object' ? { ...options.automationJob } : null,
    automationMoving: options.automationMoving && typeof options.automationMoving === 'object' ? { ...options.automationMoving } : null,
    automationItem: options.automationItem && typeof options.automationItem === 'object' ? { ...options.automationItem } : null,
    automationOutputIndex: options.automationOutputIndex | 0 || 0,
    automationStatus: String(options.automationStatus || ''),
    depositResourceKey: String(options.depositResourceKey || options.resourceKey || ''),
    depositRemaining: Number.isFinite(Number(options.depositRemaining)) ? (Number(options.depositRemaining) < 0 ? -1 : Math.max(0, Number(options.depositRemaining) | 0)) : -1,
    depositMax: Number.isFinite(Number(options.depositMax)) ? (Number(options.depositMax) < 0 ? -1 : Math.max(0, Number(options.depositMax) | 0)) : -1,
    depositLabel: String(options.depositLabel || ''),
    depositColorHex: String(options.depositColorHex || ''),
    depositId: options.depositId | 0 || 0,
    extractionProgress: Math.max(0, Math.min(1, Number(options.extractionProgress || 0) || 0)),
    lastExtractionAt: Number(options.lastExtractionAt || 0) || 0,
    createdAt: options.createdAt || Date.now(),
    updatedAt: options.updatedAt || Date.now()
  };
}

export function serializeStructure(structure) {
  if (!structure) return null;
  return {
    id: structure.id | 0,
    type: structure.type,
    ownerId: structure.ownerId | 0,
    ownerKey: structure.ownerKey || '',
    ownerName: structure.ownerName || '',
    worldId: structure.worldId || 'endless',
    sx: structure.sx | 0,
    sy: structure.sy | 0,
    x: Math.round((structure.x || 0) * 10) / 10,
    y: Math.round((structure.y || 0) * 10) / 10,
    orientation: structure.orientation || 'h',
    hp: Math.max(0, Math.round(structure.stats?.hp ?? structure.stats?.maxHp ?? 0)),
    maxHp: Math.max(0, Math.round(structure.stats?.maxHp ?? 0)),
    storage: structure.storage || { resources: {} },
    logisticRequests: structure.logisticRequests || {},
    logisticMissionLog: Array.isArray(structure.logisticMissionLog) ? structure.logisticMissionLog.slice(0, 10) : [],
    logisticDroneFlights: Array.isArray(structure.logisticDroneFlights) ? structure.logisticDroneFlights.slice(0, 32).map((f) => ({ ...f })) : [],
    logisticDroneSlots: Array.isArray(structure.logisticDroneSlots) ? structure.logisticDroneSlots.map((slot) => ({ ...slot })) : [],
    nextLogisticFlightSeq: Math.max(0, structure.nextLogisticFlightSeq | 0 || 0),
    nextLogisticMissionAt: Number(structure.nextLogisticMissionAt || 0) || 0,
    turretEnabled: structure.turretEnabled !== false,
    turretMode: structure.turretMode || 'auto',
    logisticDroneCharge: Number.isFinite(Number(structure.logisticDroneCharge)) ? Math.max(0, Number(structure.logisticDroneCharge) | 0) : undefined,
    logisticDroneRechargeMs: Math.max(0, Number(structure.logisticDroneRechargeMs || 0) || 0),
    machineInput: structure.machineInput || {},
    rocketWorkshopInput: structure.rocketWorkshopInput || {},
    rocketWorkshopOutput: structure.rocketWorkshopOutput || {},
    rocketWorkshopCustomAmmoDefs: cloneJsonValue(structure.rocketWorkshopCustomAmmoDefs, {}),
    rocketWorkshopEnabled: structure.rocketWorkshopEnabled !== false,
    rocketWorkshopJob: cloneJsonValue(structure.rocketWorkshopJob, null),
    lastRocketWorkshopProduced: cloneJsonValue(structure.lastRocketWorkshopProduced, null),
    machineOutput: structure.machineOutput || {},
    scienceInput: clonePositiveResourceMap(structure.scienceInput),
    researchJob: cloneJsonValue(structure.researchJob, null),
    researchEnabled: structure.researchEnabled !== false,
    researchStatus: String(structure.researchStatus || ''),
    machineRecipeId: structure.machineRecipeId || '',
    machineEnabled: structure.machineEnabled !== false,
    machineJob: cloneJsonValue(structure.machineJob, null),
    lastMachineProduced: cloneJsonValue(structure.lastMachineProduced, null),
    equipmentOutputItems: cloneJsonArray(structure.equipmentOutputItems),
    rdInputItem: cloneJsonValue(structure.rdInputItem, null),
    rdOutputItem: cloneJsonValue(structure.rdOutputItem, null),
    rdJob: cloneJsonValue(structure.rdJob, null),
    open: !!structure.open,
    fuelBufferSeconds: Math.max(0, Math.round((Number(structure.fuelBufferSeconds) || 0) * 10) / 10),
    energyState: structure.energyState || null,
    automationJob: structure.automationJob || null,
    automationMoving: structure.automationMoving || null,
    automationItem: structure.automationItem || null,
    automationOutputIndex: structure.automationOutputIndex | 0 || 0,
    automationStatus: structure.automationStatus || '',
    depositResourceKey: structure.depositResourceKey || '',
    depositRemaining: (structure.depositRemaining | 0) < 0 ? -1 : Math.max(0, structure.depositRemaining | 0 || 0),
    depositMax: (structure.depositMax | 0) < 0 ? -1 : Math.max(0, structure.depositMax | 0 || 0),
    depositLabel: structure.depositLabel || '',
    depositColorHex: structure.depositColorHex || '',
    depositId: structure.depositId | 0 || 0,
    extractionProgress: Math.max(0, Math.min(1, Number(structure.extractionProgress || 0) || 0)),
    lastExtractionAt: Number(structure.lastExtractionAt || 0) || 0,
    createdAt: structure.createdAt || Date.now(),
    updatedAt: Date.now()
  };
}

export function hydrateStructure(state, saved) {
  const s = saved && typeof saved === 'object' ? saved : null;
  if (!s) return null;
  const st = createStructure(state, s.type, s.sx, s.sy, s.x, s.y, {
    id: s.id,
    ownerId: s.ownerId,
    ownerKey: s.ownerKey,
    ownerName: s.ownerName,
    worldId: s.worldId || 'endless',
    orientation: s.orientation,
    maxHp: s.maxHp,
    storage: s.storage,
    logisticRequests: s.logisticRequests || {},
    logisticMissionLog: Array.isArray(s.logisticMissionLog) ? s.logisticMissionLog : [],
    logisticDroneFlights: Array.isArray(s.logisticDroneFlights) ? s.logisticDroneFlights : [],
    logisticDroneSlots: Array.isArray(s.logisticDroneSlots) ? s.logisticDroneSlots : [],
    nextLogisticFlightSeq: s.nextLogisticFlightSeq | 0 || 0,
    nextLogisticMissionAt: s.nextLogisticMissionAt || 0,
    turretEnabled: s.turretEnabled !== false,
    turretMode: s.turretMode || 'auto',
    logisticDroneCharge: s.logisticDroneCharge,
    logisticDroneRechargeMs: s.logisticDroneRechargeMs || 0,
    machineInput: s.machineInput || {},
    rocketWorkshopInput: s.rocketWorkshopInput || {},
    rocketWorkshopOutput: s.rocketWorkshopOutput || {},
    rocketWorkshopCustomAmmoDefs: s.rocketWorkshopCustomAmmoDefs || {},
    rocketWorkshopEnabled: s.rocketWorkshopEnabled !== false,
    rocketWorkshopJob: s.rocketWorkshopJob || null,
    lastRocketWorkshopProduced: s.lastRocketWorkshopProduced || null,
    machineOutput: s.machineOutput || {},
    scienceInput: s.scienceInput || {},
    researchJob: s.researchJob || null,
    researchEnabled: s.researchEnabled !== false,
    researchStatus: s.researchStatus || '',
    machineRecipeId: s.machineRecipeId || '',
    machineEnabled: s.machineEnabled !== false,
    machineJob: s.machineJob || null,
    lastMachineProduced: s.lastMachineProduced || null,
    equipmentOutputItems: Array.isArray(s.equipmentOutputItems) ? s.equipmentOutputItems : [],
    rdInputItem: s.rdInputItem || null,
    rdOutputItem: s.rdOutputItem || null,
    rdJob: s.rdJob || null,
    open: !!s.open,
    fuelBufferSeconds: s.fuelBufferSeconds ?? s.energyBuffer ?? 0,
    energyState: s.energyState || null,
    automationJob: s.automationJob || null,
    automationMoving: s.automationMoving || null,
    automationItem: s.automationItem || null,
    automationOutputIndex: s.automationOutputIndex | 0 || 0,
    automationStatus: s.automationStatus || '',
    depositResourceKey: s.depositResourceKey || '',
    depositRemaining: (s.depositRemaining | 0) < 0 ? -1 : (s.depositRemaining | 0 || 0),
    depositMax: (s.depositMax | 0) < 0 ? -1 : (s.depositMax | 0 || 0),
    depositLabel: s.depositLabel || '',
    depositColorHex: s.depositColorHex || '',
    depositId: s.depositId | 0 || 0,
    extractionProgress: s.extractionProgress || 0,
    lastExtractionAt: s.lastExtractionAt || 0,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt
  });
  if (!st) return null;
  const hp = Number(s.hp);
  if (Number.isFinite(hp)) st.stats.hp = Math.max(0, Math.min(st.stats.maxHp, hp));
  return st;
}
