import { WORLD } from '../constants.js';
import { getSimulationTick } from '../util/Time.js';
import {
  buildAsteroidSnapshots,
  buildMobSnapshots,
  buildPortalSnapshots,
  buildStationSnapshots,
  buildStructureSnapshots,
  buildLootSnapshots,
  buildAreaEffectSnapshots
} from './builders/BuildWorldEntitySnapshots.js';
import { buildMeSnapshot, buildMeLiteSnapshot } from './builders/BuildMeSnapshot.js';
import { buildStatusSnapshot } from '../status/StatusView.js';
import { buildFrameUiState } from '../frames/FrameGameplayHooks.js';
import { buildInventorySnapshot } from '../inventory/InventorySnapshot.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';

function q(v, decimals = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const m = 10 ** decimals;
  return Math.round(n * m) / m;
}

function playerLite(player, selfId = 0) {
  if (!player) return null;
  return {
    id: player.id | 0,
    pseudo: player.pseudo || `Pilote ${player.id | 0}`,
    kind: 'player',
    worldId: String(player.worldId || 'endless'),
    sx: player.sx | 0,
    sy: player.sy | 0,
    x: q(player.x),
    y: q(player.y),
    vx: q(player.vx || 0, 3),
    vy: q(player.vy || 0, 3),
    rot: q(player.visualRot ?? player.rot ?? 0, 4),
    aimRot: q(player.aimRot ?? player.rot ?? 0, 4),
    radius: q(player.radius || 22),
    engine: q(player.engine || 250),
    frameId: player.frameId || '',
    frameName: player.frameName || '',
    gameMode: player.gameMode || '',
    testWorldId: player.testWorldId || '',
    battleSessionId: player.battleSessionId || '',
    sessionSetup: {
      pending: !!player.sessionSetupPending,
      step: player.sessionSetupStep || '',
      authStatus: player.authStatus || null
    },
    dockedStationId: player.dockedStationId | 0 || 0,
    dockPhase: player.dockPhase || 'none',
    selectedKind: player.selectedKind || '',
    selectedId: player.selectedId | 0,
    autoTargetKind: player.autoTargetKind || '',
    autoTargetId: player.autoTargetId | 0,
    isSelf: (player.id | 0) === (selfId | 0),
    stats: {
      hp: q(player.stats?.hp ?? player.hp ?? 0),
      maxHp: q(player.stats?.maxHp ?? player.maxHp ?? 0),
      shield: q(player.stats?.shield ?? 0),
      maxShield: q(player.stats?.maxShield ?? 0),
      energy: q(player.stats?.energy ?? 0),
      maxEnergy: q(player.stats?.maxEnergy ?? 0)
    },
    vitals: {
      hp: q(player.stats?.hp ?? player.hp ?? 0),
      maxHp: q(player.stats?.maxHp ?? player.maxHp ?? 0),
      shield: q(player.stats?.shield ?? 0),
      maxShield: q(player.stats?.maxShield ?? 0),
      energy: q(player.stats?.energy ?? 0),
      maxEnergy: q(player.stats?.maxEnergy ?? 0)
    },
    statuses: buildStatusSnapshot(player, 8),
    frameState: buildFrameUiState(player, Date.now()) || player.frameState || {},
    abilityA: player.abilityA || null,
    abilityZ: player.abilityZ || null,
    abilityE: player.abilityE || null,
    abilityR: player.abilityR || null,
    rocketCooldownLeft: q(player.rocketCooldownLeft || 0),
    groundMarkerX: q(player.groundMarkerX || 0),
    groundMarkerY: q(player.groundMarkerY || 0),
    groundMarkerTimer: q(player.groundMarkerTimer || 0),
    level: player.progression?.level ?? 1,
    frameState: player.frameState || {},
    cooldowns: {
      A: q(player.cooldownALeft || 0),
      Z: q(player.cooldownZLeft || 0),
      E: q(player.cooldownELeft || 0),
      R: q(player.cooldownRLeft || 0)
    }
  };
}

function playerStateCompact(player, selfId = 0) {
  if (!player) return null;
  return {
    id: player.id | 0,
    pseudo: player.pseudo || `Pilote ${player.id | 0}`,
    kind: 'player',
    worldId: String(player.worldId || 'endless'),
    sx: player.sx | 0,
    sy: player.sy | 0,
    x: q(player.x),
    y: q(player.y),
    vx: q(player.vx || 0, 3),
    vy: q(player.vy || 0, 3),
    rot: q(player.visualRot ?? player.rot ?? 0, 4),
    aimRot: q(player.aimRot ?? player.rot ?? 0, 4),
    radius: q(player.radius || 22),
    engine: q(player.engine || 250),
    frameId: player.frameId || '',
    frameName: player.frameName || '',
    gameMode: player.gameMode || '',
    testWorldId: player.testWorldId || '',
    battleSessionId: player.battleSessionId || '',
    sessionSetup: {
      pending: !!player.sessionSetupPending,
      step: player.sessionSetupStep || '',
      authStatus: player.authStatus || null
    },
    authStatus: player.authStatus || null,
    dockedStationId: player.dockedStationId | 0 || 0,
    dockPhase: player.dockPhase || 'none',
    selectedKind: player.selectedKind || '',
    selectedId: player.selectedId | 0,
    autoTargetKind: player.autoTargetKind || '',
    autoTargetId: player.autoTargetId | 0,
    isSelf: (player.id | 0) === (selfId | 0),
    stats: {
      hp: q(player.stats?.hp ?? player.hp ?? 0),
      maxHp: q(player.stats?.maxHp ?? player.maxHp ?? 0),
      shield: q(player.stats?.shield ?? 0),
      maxShield: q(player.stats?.maxShield ?? 0),
      energy: q(player.stats?.energy ?? 0),
      maxEnergy: q(player.stats?.maxEnergy ?? 0)
    },
    vitals: {
      hp: q(player.stats?.hp ?? player.hp ?? 0),
      maxHp: q(player.stats?.maxHp ?? player.maxHp ?? 0),
      shield: q(player.stats?.shield ?? 0),
      maxShield: q(player.stats?.maxShield ?? 0),
      energy: q(player.stats?.energy ?? 0),
      maxEnergy: q(player.stats?.maxEnergy ?? 0)
    },
    cooldowns: {
      A: q(player.cooldownALeft || 0),
      Z: q(player.cooldownZLeft || 0),
      E: q(player.cooldownELeft || 0),
      R: q(player.cooldownRLeft || 0)
    },
    rocketCooldownLeft: q(player.rocketCooldownLeft || 0),
    groundMarkerX: q(player.groundMarkerX || 0),
    groundMarkerY: q(player.groundMarkerY || 0),
    groundMarkerTimer: q(player.groundMarkerTimer || 0)
  };
}

function playerPoseCompact(player, selfId = 0) {
  if (!player) return null;
  return {
    id: player.id | 0,
    kind: 'player',
    worldId: String(player.worldId || 'endless'),
    sx: player.sx | 0,
    sy: player.sy | 0,
    x: q(player.x),
    y: q(player.y),
    vx: q(player.vx || 0, 3),
    vy: q(player.vy || 0, 3),
    rot: q(player.visualRot ?? player.rot ?? 0, 4),
    aimRot: q(player.aimRot ?? player.rot ?? 0, 4),
    radius: q(player.radius || 22),
    engine: q(player.engine || 250),
    frameId: player.frameId || '',
    hasMoveTarget: !!player.hasMoveTarget,
    moveTx: q(player.moveTx || 0),
    moveTy: q(player.moveTy || 0),
    moveIntentSeq: player.moveIntentSeq | 0,
    moveIntentStartedAt: player.moveIntentStartedAt || 0,
    clientAuthorityLeftMs: Math.max(0, Math.round((Number(player.clientAuthoritativeUntil || 0) - Date.now()))),
    lastAbilityFreshAt: player.lastAbilityFreshAt || 0,
    holdMoveAllowed: !!player.holdMoveAllowed,
    lastPrimaryHoldMoveAt: player.lastPrimaryHoldMoveAt || 0,
    selectedKind: player.selectedKind || '',
    selectedId: player.selectedId | 0,
    autoTargetKind: player.autoTargetKind || '',
    autoTargetId: player.autoTargetId | 0,
    isSelf: (player.id | 0) === (selfId | 0)
  };
}

function playerStatusCompact(player, selfId = 0, state = null) {
  if (!player) return null;
  return {
    id: player.id | 0,
    isSelf: (player.id | 0) === (selfId | 0),
    vitals: {
      hp: q(player.stats?.hp ?? player.hp ?? 0),
      maxHp: q(player.stats?.maxHp ?? player.maxHp ?? 0),
      shield: q(player.stats?.shield ?? 0),
      maxShield: q(player.stats?.maxShield ?? 0),
      energy: q(player.stats?.energy ?? 0),
      maxEnergy: q(player.stats?.maxEnergy ?? 0)
    },
    cooldowns: {
      A: q(player.cooldownALeft || 0),
      Z: q(player.cooldownZLeft || 0),
      E: q(player.cooldownELeft || 0),
      R: q(player.cooldownRLeft || 0)
    },
    rocketCooldownLeft: q(player.rocketCooldownLeft || 0),
    statuses: buildStatusSnapshot(player, 8),
    frameState: buildFrameUiState(player, Date.now()) || player.frameState || {},
    progression: player.progression ? {
      level: player.progression.level ?? 1,
      xp: q(player.progression.xp ?? 0),
      nextXp: q(player.progression.nextXp ?? 1),
      skillPoints: player.progression.skillPoints ?? 0,
      recentXpGain: q(player.progression.recentXpGain ?? 0),
      recentXpReason: player.progression.recentXpReason || '',
      xpPulseLeft: q(player.progression.xpPulseLeft ?? 0),
      levelUpFlashLeft: q(player.progression.levelUpFlashLeft ?? 0)
    } : undefined,
    combat: {
      inCombat: Number(player.combatUntil || player.lastCombatAt || player.lastHitAt || 0) > Date.now(),
      combatLeft: q(Math.max(0, (Number(player.combatUntil || 0) - Date.now()) / 1000)),
      lastCombatAt: player.lastCombatAt || 0,
      lastHitAt: player.lastHitAt || 0
    },
    selectedKind: player.selectedKind || '',
    selectedId: player.selectedId | 0,
    autoTargetKind: player.autoTargetKind || '',
    autoTargetId: player.autoTargetId | 0
  };
}

function playerSessionCompact(player, selfId = 0, state = null, timeMs = Date.now()) {
  if (!player) return null;
  const isSelf = (player.id | 0) === (selfId | 0);
  const base = {
    id: player.id | 0,
    pseudo: player.pseudo || `Pilote ${player.id | 0}`,
    isSelf,
    worldId: String(player.worldId || 'endless'),
    sx: player.sx | 0,
    sy: player.sy | 0,
    frameId: player.frameId || '',
    frameName: player.frameName || '',
    gameMode: player.gameMode || '',
    testWorldId: player.testWorldId || '',
    battleSessionId: player.battleSessionId || '',
    sessionSetup: {
      pending: !!player.sessionSetupPending,
      step: player.sessionSetupStep || '',
      authStatus: player.authStatus || null
    },
    authStatus: player.authStatus || null,
    dockedStationId: player.dockedStationId | 0 || 0,
    dockPhase: player.dockPhase || 'none',
    dockStationId: player.dockStationId || 0,
    dockProg01: player.dockProg01 || 0,
    abilityA: player.abilityA || null,
    abilityZ: player.abilityZ || null,
    abilityE: player.abilityE || null,
    abilityR: player.abilityR || null,
    frameState: player.frameState || {},
    level: player.progression?.level ?? 1
  };

  // For the local player, session/loadout is the initial big state that the HUD,
  // abilities, auto-attack profile and equipment panel need. This is intentionally
  // not sent every frame; it belongs to session bootstrap/session packet.
  if (isSelf) {
    const full = buildMeSnapshot(player, timeMs, state, { includeSfx: false }) || {};
    return {
      ...base,
      ...full,
      isSelf,
      worldId: base.worldId,
      sx: base.sx,
      sy: base.sy,
      gameMode: base.gameMode,
      testWorldId: base.testWorldId,
      battleSessionId: base.battleSessionId
    };
  }

  return base;
}


function hasStatusId(entity, id) {
  const wanted = String(id || '').toLowerCase();
  return (Array.isArray(entity?.statuses) ? entity.statuses : []).some((s) =>
    String(s?.id || s?.effectId || s?.key || '').toLowerCase() === wanted
  );
}

function canObserverReceivePlayerPose(target, observer) {
  if (!target || !observer) return false;
  if ((target.id | 0) === (observer.id | 0)) return true;
  // Camouflage is a gameplay visibility state: observers should not receive
  // real-time pose updates while it is active. Hits/collisions remain server-side.
  if (hasStatusId(target, 'camouflage')) return false;
  return true;
}

function sameWorldSector(a, b) {
  return !!a && !!b
    && String(a.worldId || 'endless') === String(b.worldId || 'endless')
    && (a.sx | 0) === (b.sx | 0)
    && (a.sy | 0) === (b.sy | 0);
}

function sameSector(entity, sx, sy) {
  return !!entity && (entity.sx | 0) === (sx | 0) && (entity.sy | 0) === (sy | 0);
}

function sameWorld(entity, worldId) {
  return String(entity?.worldId || 'endless') === String(worldId || 'endless');
}

function buildSectorBootstrap(state, me, timeMs) {
  if (!me) return null;
  const sx = me.sx | 0;
  const sy = me.sy | 0;
  const worldId = String(me.worldId || 'endless');
  const inSector = (entity) => sameSector(entity, sx, sy);
  const inWorldSector = (entity) => inSector(entity) && sameWorld(entity, worldId);

  return {
    id: `${worldId}:${sx}:${sy}`,
    worldId,
    sx,
    sy,
    builtAt: timeMs,
    asteroids: buildAsteroidSnapshots(state.asteroids, inWorldSector),
    mobs: buildMobSnapshots(state.mobs, inWorldSector, { compact: false }),
    stations: buildStationSnapshots(state.stations, inSector),
    structures: buildStructureSnapshots(state.structures, inWorldSector, me),
    portals: buildPortalSnapshots(state.portals, inSector, state, me, timeMs),
    loots: buildLootSnapshots(state.loots, inSector),
    areaEffects: buildAreaEffectSnapshots(state.areaEffects, inWorldSector)
  };
}

function shouldIncludeSectorBootstrap(me, options = {}) {
  return !!me && (!!options.sectorBootstrap || !!options.staticWorld || !!options.fullUi);
}

export function buildNetV2BootstrapSnapshot(state, playerId, timeMs, options = {}) {
  const me = state.players.get(playerId) || null;
  const players = [...state.players.values()]
    .filter((p) => sameWorldSector(p, me))
    .map((p) => playerLite(p, playerId))
    .filter(Boolean);

  const includeSectorBootstrap = shouldIncludeSectorBootstrap(me, options);
  return {
    t: 'snap',
    protocol: 'net_v2_reset',
    minimal: !includeSectorBootstrap,
    fullUi: !!options.fullUi,
    staticWorld: !!options.staticWorld,
    sectorBootstrap: includeSectorBootstrap ? buildSectorBootstrap(state, me, timeMs) : undefined,
    time: timeMs,
    tick: getSimulationTick(state),
    seed: state.seed | 0,
    world: WORLD,
    me: me ? { ...playerLite(me, playerId), ...buildMeSnapshot(me, timeMs, state, { includeSfx: false }) } : null,
    players,
    events: [],
    ackInputSeq: me?.lastInputSeq | 0,
    net: {
      netV2Reset: true,
      minimalSnapshot: !includeSectorBootstrap,
      sectorBootstrap: includeSectorBootstrap,
      fullUi: !!options.fullUi,
      staticWorld: !!options.staticWorld,
      serverSnapBuiltAt: timeMs
    }
  };
}

export function buildNetV2StatePacket(state, playerId, timeMs) {
  const me = state.players.get(playerId) || null;
  const players = [...state.players.values()]
    .filter((p) => sameWorldSector(p, me))
    .map((p) => playerStateCompact(p, playerId))
    .filter(Boolean);

  return {
    t: 'state_v2',
    protocol: 'net_v2_reset',
    compact: true,
    time: timeMs,
    tick: getSimulationTick(state),
    me: playerStateCompact(me, playerId),
    players,
    ackInputSeq: me?.lastInputSeq | 0,
    net: {
      netV2Reset: true,
      packet: 'state_v2',
      compact: true
    }
  };
}

export function buildNetV2PlayerPosePacket(state, playerId, timeMs) {
  const me = state.players.get(playerId) || null;
  const players = [...state.players.values()]
    .filter((p) => (p.id | 0) !== (playerId | 0))
    .filter((p) => sameWorldSector(p, me))
    .filter((p) => canObserverReceivePlayerPose(p, me))
    .map((p) => playerPoseCompact(p, playerId))
    .filter(Boolean);

  if (!players.length) return null;

  return {
    t: 'player_pose_v2',
    protocol: 'net_v2_reset',
    time: timeMs,
    tick: getSimulationTick(state),
    players,
    net: {
      netV2Reset: true,
      packet: 'player_pose_v2'
    }
  };
}


export function buildNetV2PlayerEnterPacket(state, observerId, players, timeMs) {
  const me = state.players.get(observerId) || null;
  const list = (Array.isArray(players) ? players : [players])
    .filter(Boolean)
    .filter((p) => (p.id | 0) !== (observerId | 0))
    .filter((p) => sameWorldSector(p, me))
    .map((p) => playerStateCompact(p, observerId))
    .filter(Boolean);

  if (!list.length) return null;

  return {
    t: 'player_enter_sector_v2',
    protocol: 'net_v2_reset',
    time: timeMs,
    tick: getSimulationTick(state),
    players: list,
    net: {
      netV2Reset: true,
      packet: 'player_enter_sector_v2'
    }
  };
}

export function buildNetV2PlayerLeavePacket(state, observerId, playerIds, timeMs, reason = 'leave_sector') {
  const ids = (Array.isArray(playerIds) ? playerIds : [playerIds])
    .map((id) => id | 0)
    .filter((id) => id && id !== (observerId | 0));

  if (!ids.length) return null;

  return {
    t: 'player_leave_sector_v2',
    protocol: 'net_v2_reset',
    time: timeMs,
    tick: getSimulationTick(state),
    ids,
    reason: String(reason || 'leave_sector'),
    net: {
      netV2Reset: true,
      packet: 'player_leave_sector_v2'
    }
  };
}

export function buildNetV2SectorUnloadPacket(state, observerId, previousSectorKey, previousPlayerIds, timeMs, reason = 'sector_changed') {
  const ids = (Array.isArray(previousPlayerIds) ? previousPlayerIds : [...(previousPlayerIds || [])])
    .map((id) => id | 0)
    .filter((id) => id && id !== (observerId | 0));

  return {
    t: 'sector_unload_v2',
    protocol: 'net_v2_reset',
    time: timeMs,
    tick: getSimulationTick(state),
    previousSectorKey: String(previousSectorKey || ''),
    ids,
    reason: String(reason || 'sector_changed'),
    net: {
      netV2Reset: true,
      packet: 'sector_unload_v2'
    }
  };
}


export function buildNetV2InputAckPacket(state, playerId, timeMs) {
  const me = state.players.get(playerId) || null;
  if (!me) return null;
  return {
    t: 'input_ack_v2',
    protocol: 'net_v2_reset',
    time: timeMs,
    tick: getSimulationTick(state),
    ackInputSeq: me.lastInputSeq | 0,
    net: {
      netV2Reset: true,
      packet: 'input_ack_v2'
    }
  };
}

export function buildNetV2PlayerStatusPacket(state, playerId, timeMs) {
  const me = state.players.get(playerId) || null;
  if (!me) return null;
  const players = [...state.players.values()]
    .filter((p) => sameWorldSector(p, me))
    .map((p) => playerStatusCompact(p, playerId, state))
    .filter(Boolean);

  return {
    t: 'player_status_v2',
    protocol: 'net_v2_reset',
    time: timeMs,
    tick: getSimulationTick(state),
    me: playerStatusCompact(me, playerId, state),
    players,
    ackInputSeq: me.lastInputSeq | 0,
    net: {
      netV2Reset: true,
      packet: 'player_status_v2',
      authoritativePlayers: true
    }
  };
}

export function buildNetV2PlayerSessionPacket(state, playerId, timeMs) {
  const me = state.players.get(playerId) || null;
  if (!me) return null;
  const players = [...state.players.values()]
    .filter((p) => sameWorldSector(p, me))
    .map((p) => playerSessionCompact(p, playerId, state, timeMs))
    .filter(Boolean);

  return {
    t: 'player_session_v2',
    protocol: 'net_v2_reset',
    time: timeMs,
    tick: getSimulationTick(state),
    me: playerSessionCompact(me, playerId),
    players,
    net: {
      netV2Reset: true,
      packet: 'player_session_v2',
      authoritativePlayers: true
    }
  };
}


export function buildNetV2ProjectileEventsPacket(state, playerId, events, timeMs) {
  const list = (Array.isArray(events) ? events : []).filter(Boolean);
  if (!list.length) return null;
  return {
    t: 'projectile_events_v2',
    protocol: 'net_v2_reset',
    time: timeMs,
    tick: getSimulationTick(state),
    events: list,
    net: {
      netV2Reset: true,
      packet: 'projectile_events_v2'
    }
  };
}

export function buildNetV2CombatEventsPacket(state, playerId, events, timeMs) {
  const list = (Array.isArray(events) ? events : []).filter(Boolean);
  if (!list.length) return null;
  return {
    t: 'combat_events_v2',
    protocol: 'net_v2_reset',
    time: timeMs,
    tick: getSimulationTick(state),
    events: list,
    net: {
      netV2Reset: true,
      packet: 'combat_events_v2'
    }
  };
}


export function buildNetV2NetworkEventsPacket(state, playerId, events, timeMs) {
  const list = (Array.isArray(events) ? events : []).filter(Boolean);
  if (!list.length) return null;
  return {
    t: 'network_events_v2',
    protocol: 'net_v2_reset',
    time: timeMs,
    tick: getSimulationTick(state),
    events: list,
    net: {
      netV2Reset: true,
      packet: 'network_events_v2'
    }
  };
}


export function buildNetV2CargoPacket(state, playerId, timeMs) {
  const me = state.players.get(playerId) || null;
  if (!me) return null;
  const dockedStation = state?.stations?.get?.(me.dockedStationId || 0) ?? null;
  return {
    t: 'cargo_v2',
    protocol: 'net_v2_reset',
    time: timeMs,
    tick: getSimulationTick(state),
    inv: buildInventorySnapshot(me.inv, dockedStation),
    net: {
      netV2Reset: true,
      packet: 'cargo_v2'
    }
  };
}

function mobPoseCompact(mob) {
  if (!mob) return null;
  return {
    id: mob.id | 0,
    x: q(mob.x || 0, 2),
    y: q(mob.y || 0, 2),
    vx: q(mob.vx || 0, 3),
    vy: q(mob.vy || 0, 3),
    rot: q(mob.rot ?? mob.visualRot ?? 0, 4),
    radius: q(mob.radius || 18),
    sx: mob.sx | 0,
    sy: mob.sy | 0,
    worldId: String(mob.worldId || 'endless')
  };
}

export function buildNetV2MobPosePacket(state, playerId, timeMs) {
  const me = state.players.get(playerId) || null;
  if (!me) return null;
  const sx = me.sx | 0;
  const sy = me.sy | 0;
  const worldId = String(me.worldId || 'endless');
  const mobs = [...state.mobs.values()]
    .filter((m) => sameSector(m, sx, sy) && sameWorld(m, worldId))
    .map(mobPoseCompact)
    .filter(Boolean);
  if (!mobs.length) return null;
  return {
    t: 'mob_pose_v2',
    protocol: 'net_v2_reset',
    time: timeMs,
    tick: getSimulationTick(state),
    worldId,
    sx,
    sy,
    mobs,
    net: {
      netV2Reset: true,
      packet: 'mob_pose_v2'
    }
  };
}


export function buildNetV2WorldEventsPacket(state, playerId, events, timeMs) {
  const list = (Array.isArray(events) ? events : []).filter(Boolean);
  if (!list.length) return null;
  return {
    t: 'world_events_v2',
    protocol: 'net_v2_reset',
    time: timeMs,
    tick: getSimulationTick(state),
    events: list,
    net: {
      netV2Reset: true,
      packet: 'world_events_v2'
    }
  };
}

function summarizeCargo(inv) {
  const resources = inv?.resources || {};
  const entries = Object.entries(resources)
    .filter(([, amount]) => Number(amount) !== 0)
    .map(([resource, amount]) => [resource, Number(amount)]);
  return {
    used: Number(inv?.used ?? inv?.cargoUsed ?? 0),
    resources: entries
  };
}

export function buildNetV2CargoDeltaPacket(state, playerId, previousSummary, timeMs) {
  const me = state.players.get(playerId) || null;
  if (!me?.inv) return null;
  const current = summarizeCargo(me.inv);
  const previous = previousSummary || { used: 0, resources: [] };
  const prevMap = new Map(previous.resources || []);
  const curMap = new Map(current.resources || []);
  const changed = [];
  for (const [resource, amount] of curMap) {
    const prev = Number(prevMap.get(resource) || 0);
    if (Math.abs(amount - prev) > 0.0001) changed.push({ resource, amount, delta: amount - prev });
  }
  for (const [resource, amount] of prevMap) {
    if (!curMap.has(resource)) changed.push({ resource, amount: 0, delta: -Number(amount || 0) });
  }
  for (const ch of changed) {
    const def = RESOURCE_DEFS[ch.resource] || {};
    ch.key = ch.resource;
    ch.name = def.name || ch.resource;
    ch.cargoPerUnit = def.cargoPerUnit || 1;
    ch.colorHex = def.colorHex || '#d0d7e4';
    ch.sellable = def.sellPrice > 0;
    ch.sellUnitPrice = def.sellPrice || 0;
    ch.sellTotalValue = ch.sellable ? ch.amount * ch.sellUnitPrice : 0;
  }
  if (!changed.length && Number(current.used || 0) === Number(previous.used || 0)) return null;
  return {
    t: 'cargo_delta_v2',
    protocol: 'net_v2_reset',
    time: timeMs,
    tick: getSimulationTick(state),
    used: current.used,
    changes: changed,
    summary: current,
    net: {
      netV2Reset: true,
      packet: 'cargo_delta_v2'
    }
  };
}

export function buildNetV2CargoBootstrapPacket(state, playerId, timeMs) {
  const packet = buildNetV2CargoPacket(state, playerId, timeMs);
  if (!packet) return null;
  packet.t = 'cargo_bootstrap_v2';
  packet.net = { ...(packet.net || {}), packet: 'cargo_bootstrap_v2', bootstrap: true };
  return packet;
}

export function buildNetV2CargoSummary(state, playerId) {
  const me = state.players.get(playerId) || null;
  if (!me?.inv) return null;
  return summarizeCargo(me.inv);
}
