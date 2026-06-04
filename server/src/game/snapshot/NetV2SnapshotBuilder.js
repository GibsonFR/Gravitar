import { WORLD } from '../constants.js';
import { getSimulationTick } from '../util/Time.js';
import {
  buildAsteroidSnapshots,
  buildMobSnapshots,
  buildPortalSnapshots,
  buildStationSnapshots,
  buildStructureSnapshots,
  buildLootSnapshots
} from './builders/BuildWorldEntitySnapshots.js';

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
    statuses: Array.isArray(player.statuses) ? player.statuses.slice(0, 8) : [],
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
      a: q(player.cooldownALeft || 0),
      z: q(player.cooldownZLeft || 0),
      e: q(player.cooldownELeft || 0),
      r: q(player.cooldownRLeft || 0)
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
      a: q(player.cooldownALeft || 0),
      z: q(player.cooldownZLeft || 0),
      e: q(player.cooldownELeft || 0),
      r: q(player.cooldownRLeft || 0)
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
    selectedKind: player.selectedKind || '',
    selectedId: player.selectedId | 0,
    autoTargetKind: player.autoTargetKind || '',
    autoTargetId: player.autoTargetId | 0,
    isSelf: (player.id | 0) === (selfId | 0)
  };
}

function playerStatusCompact(player, selfId = 0) {
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
      a: q(player.cooldownALeft || 0),
      z: q(player.cooldownZLeft || 0),
      e: q(player.cooldownELeft || 0),
      r: q(player.cooldownRLeft || 0)
    },
    rocketCooldownLeft: q(player.rocketCooldownLeft || 0),
    statuses: Array.isArray(player.statuses) ? player.statuses : [],
    selectedKind: player.selectedKind || '',
    selectedId: player.selectedId | 0,
    autoTargetKind: player.autoTargetKind || '',
    autoTargetId: player.autoTargetId | 0
  };
}

function playerSessionCompact(player, selfId = 0) {
  if (!player) return null;
  return {
    id: player.id | 0,
    pseudo: player.pseudo || `Pilote ${player.id | 0}`,
    isSelf: (player.id | 0) === (selfId | 0),
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
    dockPhase: player.dockPhase || 'none'
  };
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
    asteroids: buildAsteroidSnapshots(state.asteroids, inSector),
    mobs: buildMobSnapshots(state.mobs, inSector, { compact: false }),
    stations: buildStationSnapshots(state.stations, inSector),
    structures: buildStructureSnapshots(state.structures, inWorldSector, me),
    portals: buildPortalSnapshots(state.portals, inSector, state, me, timeMs),
    loots: buildLootSnapshots(state.loots, inSector)
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
    me: playerLite(me, playerId),
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
    .map((p) => playerStatusCompact(p, playerId))
    .filter(Boolean);

  return {
    t: 'player_status_v2',
    protocol: 'net_v2_reset',
    time: timeMs,
    tick: getSimulationTick(state),
    me: playerStatusCompact(me, playerId),
    players,
    ackInputSeq: me.lastInputSeq | 0,
    net: {
      netV2Reset: true,
      packet: 'player_status_v2'
    }
  };
}

export function buildNetV2PlayerSessionPacket(state, playerId, timeMs) {
  const me = state.players.get(playerId) || null;
  if (!me) return null;
  const players = [...state.players.values()]
    .filter((p) => sameWorldSector(p, me))
    .map((p) => playerSessionCompact(p, playerId))
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
      packet: 'player_session_v2'
    }
  };
}
