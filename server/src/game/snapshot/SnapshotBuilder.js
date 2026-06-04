import { WORLD } from '../constants.js';
import { SPECIAL_SECTORS } from '../sector/SpecialSectors.js';
import { attachSnapshotNetMetrics, pruneUndefinedSnapshotFields } from './SnapshotSlimmer.js';
import { peekWorldSfx } from '../audio/WorldSfxState.js';
import { drainPlayerSfx } from '../audio/PlayerSfxState.js';
import { buildNetworkEventsFromLegacy } from '../events/NetworkEventStream.js';
import { drainAbilityProtocolEvents } from '../events/AbilityProtocolEvents.js';
import { peekStatusEventsForPlayer, peekPassiveEventsForPlayer } from '../events/StatusPassiveEvents.js';
import { peekCombatFx } from '../combat/CombatFxState.js';
import { peekProjectileEventsForPlayer } from '../events/ProjectileEvents.js';
import { peekLogisticTransferEventsForPlayer } from '../events/LogisticTransferEvents.js';
import { getSimulationTick } from '../util/Time.js';
import { buildMeSnapshot, buildMeLiteSnapshot } from './builders/BuildMeSnapshot.js';
import { buildPlayerDirectorySnapshot } from './builders/BuildPlayerDirectory.js';
import { getSessionElapsedMs, getSessionRemainingMs } from '../bastion/BastionSession.js';
import { buildPlayerSnapshots } from './builders/BuildPlayerSnapshots.js';
import { buildModeSnapshot } from '../modes/GameModes.js';
import { isCamouflaged, canSeeCamouflaged } from '../status/StatusRack.js';
import {
  buildAreaEffectSnapshots,
  buildAsteroidSnapshots,
  buildAsteroidCombatSnapshots,
  buildMobSnapshots,
  buildLootSnapshots,
  buildPortalSnapshots,
  buildProjectileSnapshots,
  buildStationSnapshots,
  buildStructureAutomationSnapshots,
  buildStructureAutomationCombatSnapshots,
  buildStructureCombatSnapshots,
  buildStructureSnapshots,
  buildLogisticDroneSnapshots
} from './builders/BuildWorldEntitySnapshots.js';


function isProjectileLabSnapshot(player) {
  return !!player
    && (player.sx | 0) === (SPECIAL_SECTORS.TEST_PROJECTILE_LAB.sx | 0)
    && (player.sy | 0) === (SPECIAL_SECTORS.TEST_PROJECTILE_LAB.sy | 0);
}

function sameSector(entity, sx, sy) {
  return ((entity.sx | 0) === sx && (entity.sy | 0) === sy);
}

function sameWorld(entity, worldId) {
  return String(entity.worldId || 'endless') === String(worldId);
}

function canObserveCamouflagedEntity(me, entity) {
  if (!entity) return false;
  if (!isCamouflaged(entity)) return true;
  if (me && entity.kind === 'player' && entity.id === me.id) return true;
  if (!me) return false;
  return canSeeCamouflaged(me, entity);
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
  const sectorEntity = (entity) => inMySector(entity) && canObserveCamouflagedEntity(me, entity);
  const staticEntity = (entity) => inMySector(entity);
  const playerInMyWorldAndSector = (entity) => inMyWorldAndSector(entity) && canObserveCamouflagedEntity(me, entity);
  return { inMySector, nearDynamic: sectorEntity, nearStatic: staticEntity, playerInMyWorldAndSector };
}

export function buildSnapshot(state, playerId, timeMs, options = {}) {
  const me = state.players.get(playerId) ?? null;
  const { inMySector, nearDynamic, nearStatic, playerInMyWorldAndSector } = buildVisibilityPredicates(me);
  const fullUi = options.fullUi !== false;
  const staticWorld = options.staticWorld !== false;
  const legacyEvents = !!options.legacyEvents;
  const projectileLabSnapshot = isProjectileLabSnapshot(me);
  const includeLegacyPlayerSfx = !!options.legacyEvents;
  // Important: being docked must NOT force a full station snapshot every network tick.
  // Full station/UI data is heavy (inventory, equipment, shop, map). GameServer decides
  // when to send it: periodically, and immediately after a station command. Sending it
  // at 60 Hz while docked was the source of Render heap growth/OOM and clunky station UI.
  const visibleWorldSfx = peekWorldSfx(state).filter(nearDynamic);
  const visibleCombatFx = peekCombatFx(state).filter(nearDynamic);
  const playerSfx = drainPlayerSfx(me);
  const abilityProtocolEvents = drainAbilityProtocolEvents(me);
  const statusEvents = peekStatusEventsForPlayer(state, me);
  const passiveEvents = peekPassiveEventsForPlayer(state, me);
  const events = buildNetworkEventsFromLegacy(state, playerId, timeMs, visibleWorldSfx, visibleCombatFx, playerSfx, abilityProtocolEvents, statusEvents, passiveEvents);
  const logisticTransferEvents = peekLogisticTransferEventsForPlayer(state, me);
  const projectileEvents = peekProjectileEventsForPlayer(state, me);
  const includeProjectileSnapshots = projectileLabSnapshot ? false : (staticWorld || fullUi || !!options.includeProjectileSnapshots);

  const snapshot = {
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
    modes: projectileLabSnapshot ? undefined : buildModeSnapshot(state, me, timeMs),
    world: WORLD,
    events,
    logisticTransferEvents,
    projectileEvents,
    worldSfx: legacyEvents ? visibleWorldSfx : undefined,
    combatFx: legacyEvents ? visibleCombatFx : undefined,
    me: fullUi ? buildMeSnapshot(me, timeMs, state, { includeSfx: includeLegacyPlayerSfx }) : buildMeLiteSnapshot(me, timeMs, state, { includeSfx: includeLegacyPlayerSfx }),
    players: buildPlayerSnapshots(state.players, playerInMyWorldAndSector, timeMs),
    playerDirectory: projectileLabSnapshot ? undefined : buildPlayerDirectorySnapshot(state, me),
    mobs: projectileLabSnapshot ? [] : buildMobSnapshots(state.mobs, nearDynamic, { compact: !staticWorld }),
    asteroids: projectileLabSnapshot ? (staticWorld || fullUi ? buildAsteroidSnapshots(state.asteroids, nearStatic) : undefined) : (staticWorld ? buildAsteroidSnapshots(state.asteroids, nearStatic) : buildAsteroidCombatSnapshots(state.asteroids, nearStatic)),
    stations: projectileLabSnapshot ? undefined : (staticWorld ? buildStationSnapshots(state.stations, nearStatic) : undefined),
    structures: projectileLabSnapshot ? undefined : (staticWorld ? buildStructureSnapshots(state.structures, nearStatic, me) : buildStructureCombatSnapshots(state.structures, nearDynamic, me)),
    structureAutomation: projectileLabSnapshot ? undefined : (staticWorld ? buildStructureAutomationSnapshots(state.structures, nearStatic) : buildStructureAutomationCombatSnapshots(state.structures, nearDynamic)),
    portals: staticWorld ? buildPortalSnapshots(state.portals, nearStatic, state, me, timeMs) : undefined,
    staticWorld,
    projectiles: includeProjectileSnapshots ? buildProjectileSnapshots(state.projectiles, nearDynamic) : undefined,
    logisticDrones: projectileLabSnapshot ? undefined : buildLogisticDroneSnapshots(state.structures, nearDynamic, timeMs),
    areaEffects: projectileLabSnapshot ? undefined : [
      ...buildAreaEffectSnapshots(state.areaEffects, nearDynamic),
      ...buildAreaEffectSnapshots(state.testEffectZones, nearDynamic)
    ],
    loots: projectileLabSnapshot ? undefined : buildLootSnapshots(state.loots, nearDynamic)
  };
  snapshot.net = { ...(snapshot.net || {}), projectileLabSnapshot, projectileLabMinimal: projectileLabSnapshot };
  pruneUndefinedSnapshotFields(snapshot);
  attachSnapshotNetMetrics(snapshot, { legacyEvents });
  return snapshot;
}
