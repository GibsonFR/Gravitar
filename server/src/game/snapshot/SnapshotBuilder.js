import { WORLD } from '../constants.js';
import { peekWorldSfx } from '../audio/WorldSfxState.js';
import { peekCombatFx } from '../combat/CombatFxState.js';
import { getSimulationTick } from '../util/Time.js';
import { buildMeSnapshot } from './builders/BuildMeSnapshot.js';
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

export function buildSnapshot(state, playerId, timeMs) {
  const me = state.players.get(playerId) ?? null;
  const sx = me ? (me.sx | 0) : 0;
  const sy = me ? (me.sy | 0) : 0;
  const worldId = me?.worldId || 'endless';
  const inMySector = (entity) => ((entity.sx | 0) === sx && (entity.sy | 0) === sy);
  const playerInMyWorldAndSector = (entity) => inMySector(entity) && String(entity.worldId || 'endless') === String(worldId);

  return {
    t: 'snap',
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
    worldSfx: peekWorldSfx(state).filter(inMySector),
    combatFx: peekCombatFx(state).filter(inMySector),
    me: buildMeSnapshot(me, timeMs, state),
    players: buildPlayerSnapshots(state.players, playerInMyWorldAndSector, timeMs),
    playerDirectory: buildPlayerDirectorySnapshot(state, me),
    mobs: buildMobSnapshots(state.mobs, inMySector),
    asteroids: buildAsteroidSnapshots(state.asteroids, inMySector),
    stations: buildStationSnapshots(state.stations, inMySector),
    portals: buildPortalSnapshots(state.portals, inMySector, state, me, timeMs),
    projectiles: buildProjectileSnapshots(state.projectiles, inMySector),
    areaEffects: [
      ...buildAreaEffectSnapshots(state.areaEffects, inMySector),
      ...buildAreaEffectSnapshots(state.testEffectZones, inMySector)
    ],
    loots: buildLootSnapshots(state.loots, inMySector)
  };
}
