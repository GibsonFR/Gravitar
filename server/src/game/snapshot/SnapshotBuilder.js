import { WORLD } from '../constants.js';
import { attachSnapshotNetMetrics, pruneUndefinedSnapshotFields } from './SnapshotSlimmer.js';
import { buildSnapshotPriorityPlan } from './SnapshotPriority.js';
import { peekWorldSfx } from '../audio/WorldSfxState.js';
import { drainPlayerSfx } from '../audio/PlayerSfxState.js';
import { buildNetworkEventsFromLegacy } from '../events/NetworkEventStream.js';
import { drainAbilityProtocolEvents } from '../events/AbilityProtocolEvents.js';
import { peekStatusEventsForPlayer, peekPassiveEventsForPlayer } from '../events/StatusPassiveEvents.js';
import { peekCombatFx } from '../combat/CombatFxState.js';
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
  const priorityPlan = buildSnapshotPriorityPlan(state, me, { nearDynamic, nearStatic }, { staticWorld });

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
    modes: buildModeSnapshot(state, me, timeMs),
    world: WORLD,
    events,
    worldSfx: legacyEvents ? visibleWorldSfx : undefined,
    combatFx: legacyEvents ? visibleCombatFx : undefined,
    me: fullUi ? buildMeSnapshot(me, timeMs, state, { includeSfx: includeLegacyPlayerSfx }) : buildMeLiteSnapshot(me, timeMs, state, { includeSfx: includeLegacyPlayerSfx }),
    players: buildPlayerSnapshots(state.players, playerInMyWorldAndSector, timeMs),
    playerDirectory: buildPlayerDirectorySnapshot(state, me),
    mobs: buildMobSnapshots(state.mobs, nearDynamic, { compact: !staticWorld }),
    asteroids: staticWorld ? buildAsteroidSnapshots(state.asteroids, nearStatic) : buildAsteroidCombatSnapshots(state.asteroids, priorityPlan.predicates.asteroids),
    stations: staticWorld ? buildStationSnapshots(state.stations, nearStatic) : undefined,
    structures: staticWorld ? buildStructureSnapshots(state.structures, nearStatic, me) : buildStructureCombatSnapshots(state.structures, priorityPlan.predicates.structures, me),
    structureAutomation: staticWorld ? buildStructureAutomationSnapshots(state.structures, nearStatic) : buildStructureAutomationCombatSnapshots(state.structures, priorityPlan.predicates.structureAutomation),
    portals: staticWorld ? buildPortalSnapshots(state.portals, nearStatic, state, me, timeMs) : undefined,
    staticWorld,
    projectiles: buildProjectileSnapshots(state.projectiles, nearDynamic),
    logisticDrones: buildLogisticDroneSnapshots(state.structures, nearDynamic, timeMs),
    areaEffects: [
      ...buildAreaEffectSnapshots(state.areaEffects, nearDynamic),
      ...buildAreaEffectSnapshots(state.testEffectZones, nearDynamic)
    ],
    loots: buildLootSnapshots(state.loots, nearDynamic)
  };
  pruneUndefinedSnapshotFields(snapshot);
  attachSnapshotNetMetrics(snapshot, { legacyEvents, partialSections: priorityPlan.partialSections, priorityLimits: priorityPlan.limits });
  return snapshot;
}
