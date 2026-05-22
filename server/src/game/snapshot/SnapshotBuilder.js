import { WORLD } from '../constants.js';
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

function buildVisibilityPredicates(me) {
  const sx = me ? (me.sx | 0) : 0;
  const sy = me ? (me.sy | 0) : 0;
  const worldId = me?.worldId || 'endless';
  const inMySector = (entity) => sameSector(entity, sx, sy);
  const inMyWorldAndSector = (entity) => inMySector(entity) && sameWorld(entity, worldId);

  // Vaisseau sélectionné/déployé : on envoie maintenant tout le secteur courant,
  // pas seulement une bulle autour du joueur. Le contenu procédural du secteur est
  // déjà créé par ensureSectorLoaded(); le problème visible venait surtout du
  // culling snapshot qui masquait les astéroïdes/mobs/stations lointains.
  const sectorEntity = (entity) => inMySector(entity);
  const playerInMyWorldAndSector = (entity) => inMyWorldAndSector(entity);
  return { inMySector, nearDynamic: sectorEntity, nearStatic: sectorEntity, playerInMyWorldAndSector };
}

export function buildSnapshot(state, playerId, timeMs, options = {}) {
  const me = state.players.get(playerId) ?? null;
  const { inMySector, nearDynamic, nearStatic, playerInMyWorldAndSector } = buildVisibilityPredicates(me);
  const fullUi = options.fullUi !== false;
  const staticWorld = options.staticWorld !== false;
  // Important: being docked must NOT force a full station snapshot every network tick.
  // Full station/UI data is heavy (inventory, equipment, shop, map). GameServer decides
  // when to send it: periodically, and immediately after a station command. Sending it
  // at 60 Hz while docked was the source of Render heap growth/OOM and clunky station UI.

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
    mobs: buildMobSnapshots(state.mobs, nearDynamic, { compact: !staticWorld }),
    asteroids: staticWorld ? buildAsteroidSnapshots(state.asteroids, nearStatic) : undefined,
    stations: staticWorld ? buildStationSnapshots(state.stations, nearStatic) : undefined,
    portals: staticWorld ? buildPortalSnapshots(state.portals, nearStatic, state, me, timeMs) : undefined,
    staticWorld,
    projectiles: buildProjectileSnapshots(state.projectiles, nearDynamic),
    areaEffects: [
      ...buildAreaEffectSnapshots(state.areaEffects, nearDynamic),
      ...buildAreaEffectSnapshots(state.testEffectZones, nearDynamic)
    ],
    loots: buildLootSnapshots(state.loots, nearDynamic)
  };
}
