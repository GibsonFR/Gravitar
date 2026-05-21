import { WORLD, SNAP_VIEW_RADIUS, SNAP_VIEW_RADIUS_STATIC } from '../constants.js';
import { peekWorldSfx } from '../audio/WorldSfxState.js';
import { peekCombatFx } from '../combat/CombatFxState.js';
import { getSimulationTick } from '../util/Time.js';
import { buildMeSnapshot, buildMeLiteSnapshot } from './builders/BuildMeSnapshot.js';
import { buildPlayerDirectorySnapshot } from './builders/BuildPlayerDirectory.js';
import { getSessionElapsedMs, getSessionRemainingMs } from '../bastion/BastionSession.js';
import { buildPlayerSnapshots } from './builders/BuildPlayerSnapshots.js';
import { buildModeSnapshot } from '../modes/GameModes.js';
import {
  buildAreaEffectSnapshots,
  buildAsteroidSnapshots,
  buildMobSnapshots,
  buildLootSnapshots,
  buildPortalSnapshots,
  buildProjectileSnapshots,
  buildStationSnapshots
} from './builders/BuildWorldEntitySnapshots.js';

function sameSector(entity, sx, sy) {
  return ((entity.sx | 0) === sx && (entity.sy | 0) === sy);
}

function sameWorld(entity, worldId) {
  return String(entity.worldId || 'endless') === String(worldId);
}

function nearPlayer(entity, me, radius) {
  if (!me || !Number.isFinite(entity?.x) || !Number.isFinite(entity?.y)) return true;
  const dx = (entity.x ?? 0) - (me.x ?? 0);
  const dy = (entity.y ?? 0) - (me.y ?? 0);
  const extra = Math.max(0, entity.radius ?? entity.w ?? entity.h ?? 0);
  const r = radius + extra;
  return dx * dx + dy * dy <= r * r;
}

function buildVisibilityPredicates(me) {
  const sx = me ? (me.sx | 0) : 0;
  const sy = me ? (me.sy | 0) : 0;
  const worldId = me?.worldId || 'endless';
  const inMySector = (entity) => sameSector(entity, sx, sy);
  const inMyWorldAndSector = (entity) => inMySector(entity) && sameWorld(entity, worldId);
  const nearDynamic = (entity) => inMySector(entity) && nearPlayer(entity, me, SNAP_VIEW_RADIUS);
  const nearStatic = (entity) => inMySector(entity) && nearPlayer(entity, me, SNAP_VIEW_RADIUS_STATIC);
  const playerInMyWorldAndSector = (entity) => inMyWorldAndSector(entity) && nearPlayer(entity, me, SNAP_VIEW_RADIUS);
  return { inMySector, nearDynamic, nearStatic, playerInMyWorldAndSector };
}

export function buildSnapshot(state, playerId, timeMs, options = {}) {
  const me = state.players.get(playerId) ?? null;
  const { inMySector, nearDynamic, nearStatic, playerInMyWorldAndSector } = buildVisibilityPredicates(me);
  const fullUi = options.fullUi !== false || !!me?.sessionSetupPending || !!me?.dockedStationId;

  return {
    t: 'snap',
    fullUi,
    time: timeMs,
    tick: getSimulationTick(state),
    seed: state.seed | 0,
    session: {
      durationMs: state.sessionDurationMs ?? 60 * 60 * 1000,
      elapsedMs: getSessionElapsedMs(state, timeMs),
      remainingMs: getSessionRemainingMs(state, timeMs)
    },
    modes: buildModeSnapshot(state, me, timeMs),
    world: WORLD,
    worldSfx: peekWorldSfx(state).filter(nearDynamic),
    combatFx: peekCombatFx(state).filter(nearDynamic),
    me: fullUi ? buildMeSnapshot(me, timeMs, state) : buildMeLiteSnapshot(me, timeMs, state),
    players: buildPlayerSnapshots(state.players, playerInMyWorldAndSector, timeMs),
    playerDirectory: buildPlayerDirectorySnapshot(state, me),
    mobs: buildMobSnapshots(state.mobs, nearDynamic),
    asteroids: buildAsteroidSnapshots(state.asteroids, nearStatic),
    stations: buildStationSnapshots(state.stations, nearStatic),
    portals: buildPortalSnapshots(state.portals, nearStatic, state, me, timeMs),
    projectiles: buildProjectileSnapshots(state.projectiles, nearDynamic),
    areaEffects: [
      ...buildAreaEffectSnapshots(state.areaEffects, nearDynamic),
      ...buildAreaEffectSnapshots(state.testEffectZones, nearDynamic)
    ],
    loots: buildLootSnapshots(state.loots, nearDynamic)
  };
}
