import { visitSectorOnPlayer } from '../map/PlayerMapState.js';
import { restoreStatBlockFull } from '../stats/StatBlockRuntime.js';
import { syncPlayerFrameStats } from '../frames/FrameStatSync.js';
import { distSq } from '../util/Math.js';
import { enterBastion, exitBastion } from '../bastion/BastionSystem.js';
import { getBastionAtSector, isBastionUnlockedForPlayer } from '../bastion/BastionSession.js';
import { ensureSectorLoaded } from '../sector/SectorEnsure.js';
import { isSpecialDetachedSector } from '../sector/SpecialSectors.js';
import { addResource } from '../inventory/InventorySystem.js';
import { createNeutralCraftedEquipment } from '../../../../shared/content/equipment/EquipmentRoller.js';
import { addCustomEquipmentDef } from '../equipment/PlayerEquipmentDefs.js';
import { ensureTestEquipmentBench } from '../modes/GameModes.js';


function preloadPortalDestination(state, sx, sy, timeMs) {
  const baseSx = sx | 0;
  const baseSy = sy | 0;

  // Les secteurs de test/bastion/arène sont volontairement isolés.
  // Précharger leurs voisins générait des secteurs normaux absurdes autour de
  // coordonnées 9000+ et pouvait faire tomber le serveur au moment du portail.
  if (isSpecialDetachedSector(baseSx, baseSy)) {
    ensureSectorLoaded(state, baseSx, baseSy, timeMs);
    return;
  }

  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      ensureSectorLoaded(state, baseSx + dx, baseSy + dy, timeMs);
    }
  }
}

function beginPortalTransition(player, portal, timeMs) {
  const targetSx = portal.targetSx | 0;
  const targetSy = portal.targetSy | 0;
  const distance = Math.max(Math.abs(targetSx - (portal.sx | 0)), Math.abs(targetSy - (portal.sy | 0)));
  const durationMs = distance > 1 ? 900 : 420;
  const id = ((player.portalTransitionId | 0) + 1) | 0;
  player.portalTransitionId = id;
  player.portalTransition = {
    id,
    type: 'portal',
    label: portal.label || `Saut → [${targetSx},${targetSy}]`,
    targetSx,
    targetSy,
    startedAt: timeMs,
    until: timeMs + durationMs,
    forceServerPose: true
  };
  // Pendant un téléport, ne jamais laisser une vieille pose client écraser la pose serveur.
  player.ignoreClientPoseUntil = timeMs + durationMs + 350;
  player.clientAuthoritativeUntil = 0;
}



function seedTestEquipmentItems(player, timeMs = Date.now()) {
  if (!player?.equipment) return;
  player.equipment.customItemDefs ??= {};
  player.equipment.ownedItemIds = Array.isArray(player.equipment.ownedItemIds) ? player.equipment.ownedItemIds : [];
  const specs = [
    ['vector-thruster-vanes', 'Propulseur Mark III', 3],
    ['needle-array-mk1', 'Arme cinétique Mark III', 3],
    ['siege-barrage-rack', 'Lance-roquettes Mark III', 3],
    ['compact-shield-array', 'Bouclier Mark III', 3],
    ['cargo-overmesh', 'Module soute Mark III', 3],
    ['reaver-gyro-stabilizer', 'Module dégâts Mark III', 3],
    ['surge-capacitor-bank', 'Module énergie Mark III', 3],
    ['siphon-repair-weave', 'Module réparation Mark III', 3],
    ['siege-target-matrix', 'Module ciblage Mark III', 3],
    ['vector-thruster-vanes', 'Propulseur Mark V', 5],
    ['needle-array-mk1', 'Arme cinétique Mark V', 5],
    ['scatterstorm-pod', 'Lance-roquettes Mark V', 5],
    ['compact-shield-array', 'Bouclier Mark V', 5]
  ];
  player.equipment.craftedItemCounter = Math.max(0, player.equipment.craftedItemCounter | 0);
  for (let i = 0; i < specs.length; i += 1) {
    const [baseItemId, name, mark] = specs[i];
    const stableId = `test-neutral-${baseItemId.replace(/[^a-z0-9]+/g, '-')}-mk${mark}`;
    if (player.equipment.customItemDefs[stableId]) continue;
    const crafted = createNeutralCraftedEquipment({
      baseItemId,
      recipeId: stableId,
      recipeName: name,
      mark,
      ownerKey: player.accountKey || player.pseudo || player.id || 'test',
      craftedIndex: 9000 + i,
      timeMs: 100000 + i
    });
    if (!crafted) continue;
    crafted.id = stableId;
    crafted.name = name;
    crafted.shortName = name;
    addCustomEquipmentDef(player, crafted);
    if (!player.equipment.ownedItemIds.includes(stableId)) player.equipment.ownedItemIds.push(stableId);
  }
  player.equipment.ownedItemIds = [...new Set(player.equipment.ownedItemIds)].sort();
  player.equipment.lastChangedAt = timeMs | 0;
}

function grantTestEquipmentPortalLoadout(state, player, timeMs) {
  if (!player?.inv) return;
  player.inv.cargoMax = Math.max(player.inv.cargoMax || 0, 1400);
  const pack = {
    ironOre: 48, copper: 48, aluminiumOre: 32, titaniumOre: 24, quartz: 32, graphite: 24,
    silicon: 32, hydrocarbons: 28, biomass: 24, organicLipids: 16, waterIce: 24, methane: 20, ammonia: 20,
    refinedFuel: 20, biofuel: 12, propellant: 40,
    ironIngot: 30, copperIngot: 20, aluminiumIngot: 20, copperWire: 40, steelPlate: 24,
    siliconWafer: 18, microTransistor: 10, printedCircuit: 8, controlCircuit: 4,
    titaniumPlate: 10, carbonFiber: 8, opticalGlass: 8, lithiumBattery: 8, fuelCell: 8,
    basicSciencePack: 20, automationSciencePack: 10, industrialSciencePack: 10, energySciencePack: 12,
    biologySciencePack: 10, combatSciencePack: 10, advancedSciencePack: 30, anomalySciencePack: 18,
    precursorNanomaterial: 12, unknownTechFragment: 10, titaniumPlate: 36, ancientSuperconductor: 4,
    electricMotor: 12, compositeArmor: 8, laserLens: 8, microprocessor: 12, thermalCeramic: 6,
    fuelInjector: 4, hydrogen: 20, biocarbure: 12
  };
  for (const [key, amount] of Object.entries(pack)) addResource(player.inv, key, amount);
  player.research = player.research || { completed: [], unlocked: [] };
  const completed = new Set([...(player.research.completed || []), 'construction_foundations', 'industry_smelting_control', 'automation_routing', 'energy_distribution', 'advanced_industry', 'electronics_processing', 'resource_scanning', 'bio_processing', 'defense_turrets', 'advanced_research', 'equipment_rd_station', 'equipment_mark_ii', 'equipment_mark_iii', 'equipment_mark_iv', 'equipment_mark_v', 'alien_anomaly_analysis']);
  player.research.completed = [...completed];
  ensureTestEquipmentBench(state, player, timeMs);
  seedTestEquipmentItems(player, timeMs);
}

function prepareTestArenaPlayer(player) {
  if (!player?.progression) return;
  player.progression.level = Math.max(player.progression.level ?? 1, 18);
  player.progression.skillPoints = Math.max(player.progression.skillPoints ?? 0, 20);
  player.progression.abilityLevels = {
    A: Math.max(player.progression.abilityLevels?.A ?? 0, 10),
    Z: Math.max(player.progression.abilityLevels?.Z ?? 0, 10),
    E: Math.max(player.progression.abilityLevels?.E ?? 0, 10),
    R: Math.max(player.progression.abilityLevels?.R ?? 0, 3)
  };
  player.progression.recentXpGain = 0;
  player.progression.recentXpReason = 'arène de test';
  player.progression.levelUpFlashLeft = Math.max(player.progression.levelUpFlashLeft ?? 0, 1.6);
  player.cooldownALeft = 0;
  player.cooldownZLeft = 0;
  player.cooldownELeft = 0;
  player.cooldownRLeft = 0;
  player.rocketCooldownLeft = 0;
  syncPlayerFrameStats(player, { restoreVitals: true, preserveRatios: false });
  restoreStatBlockFull(player.stats);
}

export function tryUsePortal(state, player, timeMs) {
  const manualTap = !!player.interactTap;
  if (!manualTap) {
    // Les portails de navigation des mondes de test doivent être immédiats :
    // ils servent à changer de zone de validation, pas à tester l'interaction station.
    let hasAutoPortalNearby = false;
    for (const portal of state.portals.values()) {
      if (!portal.autoTrigger) continue;
      if ((portal.sx | 0) !== (player.sx | 0) || (portal.sy | 0) !== (player.sy | 0)) continue;
      const r = (player.radius + portal.radius + 16);
      if (distSq(player.x, player.y, portal.x, portal.y) <= r * r) { hasAutoPortalNearby = true; break; }
    }
    if (!hasAutoPortalNearby) return false;
  }
  if (player.dockPhase !== 'none' || (player.dockedStationId | 0) !== 0) return false;

  let best = null;
  let bestD2 = Infinity;
  for (const portal of state.portals.values()) {
    if ((portal.sx | 0) !== (player.sx | 0) || (portal.sy | 0) !== (player.sy | 0)) continue;
    if (!manualTap && !portal.autoTrigger) continue;
    const d2 = distSq(player.x, player.y, portal.x, portal.y);
    const r = (player.radius + portal.radius + 16);
    if (d2 > r * r) continue;
    if (d2 < bestD2) { bestD2 = d2; best = portal; }
  }

  if (!best) return false;

  const nextOk = player.nextPortalAt ?? 0;
  if (timeMs < nextOk) return true;
  player.nextPortalAt = timeMs + (best.cooldownMs ?? 800);

  if (best.mode === 'bastion_entry') {
    const bastion = getBastionAtSector(state, player.sx | 0, player.sy | 0);
    if (!bastion) return true;
    if ((player.completedBastionIds || []).includes(bastion.id | 0)) { player.uiHint = 'Bastion déjà réussi avec ce pilote'; player.uiHintTimer = 1.8; return true; }
    // Endless: les bastions sont ouverts directement. Les anciens timers restent seulement utiles pour d'autres modes spéciaux.
    if (player.gameMode !== 'endless' && !isBastionUnlockedForPlayer(player, bastion, timeMs, state)) { player.uiHint = 'Bastion encore verrouillé'; player.uiHintTimer = 1.8; return true; }
    enterBastion(state, player, bastion, timeMs);
    visitSectorOnPlayer(state, player, player.sx | 0, player.sy | 0, timeMs);
    return true;
  }

  if (best.mode === 'bastion_exit') {
    exitBastion(state, player, timeMs);
    visitSectorOnPlayer(state, player, player.sx | 0, player.sy | 0, timeMs);
    return true;
  }

  // Téléport lointain : on prépare explicitement la destination + voisins puis on
  // impose une courte transition noire côté client. Sans ce gel, le client-authority
  // continuait d'envoyer l'ancienne pose et pouvait rembobiner le joueur.
  const targetSx = best.targetSx | 0;
  const targetSy = best.targetSy | 0;
  preloadPortalDestination(state, targetSx, targetSy, timeMs);
  beginPortalTransition(player, best, timeMs);

  player.sx = targetSx;
  player.sy = targetSy;
  player.x = 0;
  player.y = 0;
  player.vx = 0;
  player.vy = 0;
  player.hasMoveTarget = false;
  player.holdMoveAllowed = false;
  player.moveTx = 0;
  player.moveTy = 0;
  player.groundMarkerTimer = 0;
  player.autoTargetKind = '';
  player.autoTargetId = 0;
  player.selectedKind = '';
  player.selectedId = 0;
  if (best.mode === 'test_arena' || best.mode === 'mob_bestiary' || String(best.mode || '').startsWith('test_biome_')) prepareTestArenaPlayer(player);
  if (best.mode === 'test_equipment') grantTestEquipmentPortalLoadout(state, player, timeMs);
  player.uiHint = best.mode === 'test_arena' ? 'Simulateur activé' : (best.mode === 'mob_bestiary' ? 'Bestiaire activé' : (best.mode === 'test_equipment' ? 'Test équipement chargé' : (String(best.mode || '').startsWith('test_biome_') ? 'Biome de test chargé' : `Saut → [${player.sx},${player.sy}]`)));
  player.uiHintTimer = (best.mode === 'test_arena' || best.mode === 'mob_bestiary' || best.mode === 'test_equipment' || String(best.mode || '').startsWith('test_biome_')) ? 2.8 : 1.2;
  visitSectorOnPlayer(state, player, player.sx | 0, player.sy | 0, timeMs);
  return true;
}
