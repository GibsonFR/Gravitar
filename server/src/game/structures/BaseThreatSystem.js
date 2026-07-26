import { listMobDefs } from '../../../../shared/content/mobs/MobDefs.js';
import { queueWorldSfx } from '../audio/WorldSfxState.js';
import { SFX_EVENT_TYPES } from '../audio/SfxEventTypes.js';
import { getSectorSummary } from '../map/SectorSummary.js';
import { spawnMob } from '../mob/MobFactory.js';
import { createStructure } from './StructureFactory.js';
import { STRUCTURE_TYPES, getStructureDef } from './StructureDefs.js';
import { isStructureAlive } from './StructureSystem.js';

const UPDATE_INTERVAL_MS = 1000;
const MAX_RAID_MOBS_PER_CORE = 14;

function ownerKeyOf(entity) {
  return String(entity?.accountKey || entity?.ownerKey || entity?.accountName || entity?.pseudo || '').toLowerCase();
}

function threatLevel(signal) {
  if (signal >= 58) return 'critical';
  if (signal >= 34) return 'high';
  if (signal >= 16) return 'medium';
  return 'low';
}

function signalForStructure(structure) {
  const def = getStructureDef(structure?.type) || {};
  let signal = Math.max(0, Number(def.industrialSignal || 0));
  if (def.automationKind === 'extractor' && structure.machineEnabled !== false) signal += structure.powered ? 7 : 2;
  if (def.machineType && structure.machineEnabled !== false) signal += structure.machineJob ? 5 : 1;
  if (structure.type === STRUCTURE_TYPES.FUEL_GENERATOR && (structure.fuelBufferSeconds || 0) > 0) signal += 5;
  if (def.turret && structure.turretStatus === 'firing') signal += 7;
  if (def.energyOutput > 20) signal += 3;
  return signal;
}

function structuresInsideCore(state, core) {
  const half = Math.max(1, Number(core.claimRadius || 0));
  const sharedClanId = core.clanShared ? String(core.clanId || '') : '';
  return [...(state?.structures?.values?.() || [])].filter((structure) =>
    structure
      && isStructureAlive(structure)
      && String(structure.worldId || 'endless') === String(core.worldId || 'endless')
      && (structure.sx | 0) === (core.sx | 0)
      && (structure.sy | 0) === (core.sy | 0)
      && (
        ownerKeyOf(structure) === ownerKeyOf(core)
        || (!!sharedClanId && structure.clanShared && String(structure.clanId || '') === sharedClanId)
      )
      && Math.abs((structure.x || 0) - (core.x || 0)) <= half
      && Math.abs((structure.y || 0) - (core.y || 0)) <= half
  );
}

function findRaidTarget(state, core) {
  const candidates = structuresInsideCore(state, core)
    .filter((structure) => structure.type === STRUCTURE_TYPES.WALL || structure.type === STRUCTURE_TYPES.DOOR)
    .sort((a, b) => Math.hypot(a.x - core.x, a.y - core.y) - Math.hypot(b.x - core.x, b.y - core.y));
  return candidates[0] || core;
}

function ownerOnline(state, core) {
  const clan = core?.clanShared && core?.clanId ? state?.clans?.get?.(core.clanId) : null;
  return [...(state?.players?.values?.() || [])].find((player) =>
    !player.sessionSetupPending
      && (ownerKeyOf(player) === ownerKeyOf(core) || clan?.members?.includes?.(String(player.accountKey || '').toLowerCase()))
      && String(player.worldId || 'endless') === String(core.worldId || 'endless')
  ) || null;
}

function raidMobCount(state, coreId) {
  let count = 0;
  for (const mob of state?.mobs?.values?.() || []) if ((mob.baseRaidCoreId | 0) === (coreId | 0)) count += 1;
  return count;
}

function pickRaidMobId(state, core, signal, serial) {
  const defs = listMobDefs().slice().sort((a, b) => (a.typeId | 0) - (b.typeId | 0));
  const biomeId = getSectorSummary(state.seed | 0, core.sx | 0, core.sy | 0)?.biomeId || '';
  const preferred = {
    metallic: [1, 2, 6],
    silicate: [3, 4, 5],
    organic: [1, 7, 9],
    volatile: [2, 3, 8],
    nuclear: [5, 6, 7],
    anomaly: [4, 8, 9, 10]
  }[biomeId] || [1, 2, 3];
  const maxType = Math.max(2, Math.min(10, 2 + Math.floor(signal / 12)));
  const pool = defs.filter((def) => preferred.includes(def.typeId | 0) && (def.typeId | 0) <= maxType);
  const usable = pool.length ? pool : defs.filter((def) => (def.typeId | 0) <= maxType);
  return usable[Math.abs((serial | 0) + (core.id | 0)) % Math.max(1, usable.length)]?.id || defs[0]?.id;
}

function spawnRaidWave(state, core, threat, timeMs) {
  const target = findRaidTarget(state, core);
  const existing = raidMobCount(state, core.id);
  const wanted = Math.min(MAX_RAID_MOBS_PER_CORE - existing, threat.level === 'critical' ? 4 : 2);
  for (let i = 0; i < wanted; i += 1) {
    const angle = ((core.id * 0.73 + threat.wave * 1.91 + i * 2.17) % (Math.PI * 2));
    const distance = Math.max(720, Math.min(1250, Number(core.claimRadius || 512) + 300));
    const x = Math.max(-1760, Math.min(1760, core.x + Math.cos(angle) * distance));
    const y = Math.max(-1760, Math.min(1760, core.y + Math.sin(angle) * distance));
    const mob = spawnMob(state, core.sx, core.sy, pickRaidMobId(state, core, threat.signal, threat.wave + i), x, y, {
      seed: (core.id * 8191) ^ (threat.wave * 131 + i),
      mapLevel: Math.max(1, Math.round(threat.signal / 3)),
      mutated: threat.level === 'critical' && i === 0,
      spawnTimeMs: timeMs,
      noLoot: false
    });
    mob.worldId = String(core.worldId || 'endless');
    mob.baseRaidCoreId = core.id | 0;
    mob.baseRaidTargetId = target.id | 0;
    mob.leashRange = Math.max(1800, mob.leashRange || 0);
    mob.homeX = core.x;
    mob.homeY = core.y;
  }
  threat.wave += 1;
}

function createThreatSource(state, core, threat, timeMs) {
  if (threat.sourceId && state.structures.has(threat.sourceId)) return;
  const type = threat.level === 'critical' ? STRUCTURE_TYPES.EVENT_RIFT : STRUCTURE_TYPES.ORGANIC_NEST;
  const angle = ((core.id * 1.37 + threat.wave) % (Math.PI * 2));
  const distance = Math.max(900, Number(core.claimRadius || 512) + 420);
  const x = Math.max(-1700, Math.min(1700, core.x + Math.cos(angle) * distance));
  const y = Math.max(-1700, Math.min(1700, core.y + Math.sin(angle) * distance));
  const source = createStructure(state, type, core.sx, core.sy, x, y, {
    ownerKey: 'world',
    ownerName: 'Hostile',
    worldId: core.worldId,
    createdAt: timeMs,
    updatedAt: timeMs
  });
  if (!source) return;
  source.transient = true;
  source.eventOwnerCoreId = core.id | 0;
  source.expireAt = timeMs + (type === STRUCTURE_TYPES.EVENT_RIFT ? 8 : 14) * 60 * 1000;
  state.structures.set(source.id, source);
  threat.sourceId = source.id | 0;
}

function notifyThreat(state, core, threat, player, timeMs) {
  if (!player || timeMs - (threat.lastAlertAt || 0) < 30000) return;
  threat.lastAlertAt = timeMs;
  player.uiHint = threat.level === 'critical' ? 'Alerte base — signal critique' : 'Activité hostile détectée près de la base';
  player.uiHintTimer = 4;
  player.forceFullUiSnapshot = true;
  queueWorldSfx(state, SFX_EVENT_TYPES.BASE_ALERT, core.sx, core.sy, core.x, core.y, threat.level === 'critical' ? 2 : 1);
}

function pruneTransientSources(state, timeMs) {
  for (const [id, structure] of state?.structures?.entries?.() || []) {
    if (!structure?.transient || !structure.expireAt || timeMs < structure.expireAt) continue;
    state.structures.delete(id);
  }
}

export function updateBaseThreats(state, _dt, timeMs = Date.now()) {
  state.baseThreats ??= new Map();
  if (timeMs - (state.lastBaseThreatUpdateAt || 0) < UPDATE_INTERVAL_MS) return;
  state.lastBaseThreatUpdateAt = timeMs;
  pruneTransientSources(state, timeMs);

  for (const core of state?.structures?.values?.() || []) {
    if (core.type !== STRUCTURE_TYPES.BASE_CORE || !isStructureAlive(core)) continue;
    const structures = structuresInsideCore(state, core);
    const rawSignal = structures.reduce((sum, structure) => sum + signalForStructure(structure), 0) + Math.max(0, structures.length - 8) * 0.45;
    const signal = Math.max(0, Math.min(100, Math.round(rawSignal * 10) / 10));
    const level = threatLevel(signal);
    const threat = state.baseThreats.get(core.id) || { coreId: core.id | 0, signal: 0, level: 'low', wave: 0, nextWaveAt: 0, sourceId: 0, lastAlertAt: 0 };
    threat.signal = signal;
    threat.level = level;
    threat.updatedAt = timeMs;
    state.baseThreats.set(core.id, threat);
    core.industrialSignal = signal;
    core.industrialSignalLevel = level;

    const online = ownerOnline(state, core);
    if (!online || signal < 34) continue;
    if (signal >= 46) createThreatSource(state, core, threat, timeMs);
    if (timeMs >= (threat.nextWaveAt || 0) && raidMobCount(state, core.id) < MAX_RAID_MOBS_PER_CORE) {
      spawnRaidWave(state, core, threat, timeMs);
      threat.nextWaveAt = timeMs + (level === 'critical' ? 65000 : 110000);
      notifyThreat(state, core, threat, online, timeMs);
    }
  }
}

export function buildPlayerBaseThreatSnapshot(state, player) {
  if (!player) return null;
  let best = null;
  for (const core of state?.structures?.values?.() || []) {
    if (core.type !== STRUCTURE_TYPES.BASE_CORE || ownerKeyOf(core) !== ownerKeyOf(player)) continue;
    if (String(core.worldId || 'endless') !== String(player.worldId || 'endless')) continue;
    best = state.baseThreats?.get?.(core.id) || { coreId: core.id | 0, signal: core.industrialSignal || 0, level: core.industrialSignalLevel || 'low', wave: 0 };
    break;
  }
  if (!best) return null;
  return {
    coreId: best.coreId | 0,
    signal: Number(best.signal || 0),
    level: best.level || 'low',
    wave: best.wave | 0,
    activeAttackers: raidMobCount(state, best.coreId),
    nextWaveInMs: Math.max(0, Number(best.nextWaveAt || 0) - Date.now())
  };
}

export function buildWorldEventMapSnapshot(state, player) {
  return [...(state?.structures?.values?.() || [])]
    .filter((structure) => structure?.transient && (structure.type === STRUCTURE_TYPES.ORGANIC_NEST || structure.type === STRUCTURE_TYPES.EVENT_RIFT))
    .filter((structure) => String(structure.worldId || 'endless') === String(player?.worldId || 'endless'))
    .map((structure) => ({
      id: structure.id | 0,
      type: structure.type,
      name: structure.name,
      sx: structure.sx | 0,
      sy: structure.sy | 0,
      x: Math.round(structure.x || 0),
      y: Math.round(structure.y || 0),
      expiresInMs: Math.max(0, Number(structure.expireAt || 0) - Date.now())
    }));
}
