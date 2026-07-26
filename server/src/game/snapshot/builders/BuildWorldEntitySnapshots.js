import { buildStatBlockSnapshot } from '../../stats/StatBlockSnapshot.js';
import { buildStatusSnapshot } from '../../status/StatusView.js';
import { isStructureProtectedByCore, canPlayerDamageStructure } from '../../structures/StructureSystem.js';
import { RESOURCE_DEFS } from '../../inventory/ResourceDefs.js';
import { getStructureDef } from '../../structures/StructureDefs.js';
import { buildLogisticDroneSnapshots } from '../../structures/StructureLogistics.js';

function q(value, decimals = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const m = 10 ** decimals;
  return Math.round(n * m) / m;
}

function qv(stats) {
  const v = buildStatBlockSnapshot(stats);
  if (!v) return null;
  return { hp: q(v.hp, 0), maxHp: q(v.maxHp, 0), shield: q(v.shield, 0), maxShield: q(v.maxShield, 0), energy: q(v.energy, 0), maxEnergy: q(v.maxEnergy, 0) };
}

export function buildMobSnapshots(mobs, inSector, options = {}) {
  const compact = !!options.compact;
  return [...mobs.values()]
    .filter((mob) => mob.stats.hp > 0)
    .filter(inSector)
    .map((mob) => compact ? ({
      id: mob.id,
      sx: mob.sx | 0,
      sy: mob.sy | 0,
      typeId: mob.typeId ?? 0,
      name: mob.name,
      shortName: mob.shortName || mob.name,
      x: q(mob.x),
      y: q(mob.y),
      vx: q(mob.vx || 0, 2),
      vy: q(mob.vy || 0, 2),
      rot: q(mob.rot ?? 0, 3),
      radius: q(mob.radius),
      vitals: qv(mob.stats),
      color: mob.color,
      threat: mob.threat ?? 1,
      elite: !!mob.elite,
      mutated: !!mob.mutated,
      specialCue: mob.specialCue || '',
      specialCueLeft: q(mob.specialCueLeft || 0, 2),
      statuses: buildStatusSnapshot(mob, 6)
    }) : ({
      id: mob.id,
      sx: mob.sx | 0,
      sy: mob.sy | 0,
      mobId: mob.mobId,
      typeId: mob.typeId ?? 0,
      name: mob.name,
      shortName: mob.shortName || mob.name,
      role: mob.role || '',
      variantFamily: mob.variantFamily || '',
      kit: mob.kit || '',
      abilities: mob.abilities || [],
      demoVariantLabel: mob.demoVariantLabel || '',
      summonGeneration: mob.summonGeneration | 0,
      summonKind: mob.summonKind || '',
      summonOwnerId: mob.summonOwnerId || 0,
      x: q(mob.x),
      y: q(mob.y),
      vx: q(mob.vx, 2),
      vy: q(mob.vy, 2),
      rot: q(mob.rot ?? 0, 3),
      radius: q(mob.radius),
      vitals: qv(mob.stats),
      color: mob.color,
      behaviorId: mob.behaviorId,
      threat: mob.threat ?? 1,
      elite: !!mob.elite,
      mutated: !!mob.mutated,
      demoMob: !!mob.demoMob,
      demoCageRadius: mob.demoCageRadius || 0,
      demoCageX: mob.demoCageX ?? mob.homeX ?? mob.x,
      demoCageY: mob.demoCageY ?? mob.homeY ?? mob.y,
      specialCue: mob.specialCue || '',
      specialCueLeft: q(mob.specialCueLeft || 0, 2),
      statuses: buildStatusSnapshot(mob, 6)
    }));
}

export function buildAsteroidSnapshots(asteroids, inSector) {
  return [...asteroids.values()]
    .filter((asteroid) => asteroid.stats.hp > 0)
    .filter(inSector)
    .map((asteroid) => ({
      id: asteroid.id,
      kind: 'asteroid',
      sx: asteroid.sx | 0,
      sy: asteroid.sy | 0,
      x: q(asteroid.x),
      y: q(asteroid.y),
      radius: q(asteroid.radius),
      w: q(asteroid.w || 0),
      h: q(asteroid.h || 0),
      bastionWall: !!asteroid.bastionWall,
      solid: !!asteroid.solid,
      borderColor: asteroid.borderColor || null,
      vitals: qv(asteroid.stats),
      resource: asteroid.resource,
      resourceName: asteroid.resourceName,
      resourceColorHex: asteroid.resourceColorHex,
      color: asteroid.color,
      rot: q(asteroid.rot ?? 0, 4),
      spin: q(asteroid.spin ?? 0, 4),
      shapeSeed: asteroid.shapeSeed,
      secret: asteroid.secret,
      testCore: !!asteroid.testCore,
      demoDummy: !!asteroid.demoDummy,
      demoLabel: asteroid.demoLabel || '',
      testStatusId: asteroid.testStatusId || '',
      statuses: buildStatusSnapshot(asteroid, 4)
    }));
}

export function buildAsteroidCombatSnapshots(asteroids, inSector) {
  return [...asteroids.values()]
    .filter((asteroid) => asteroid.stats.hp > 0)
    .filter(inSector)
    .map((asteroid) => ({
      id: asteroid.id,
      kind: 'asteroid',
      sx: asteroid.sx | 0,
      sy: asteroid.sy | 0,
      x: q(asteroid.x),
      y: q(asteroid.y),
      radius: q(asteroid.radius),
      w: q(asteroid.w || 0),
      h: q(asteroid.h || 0),
      bastionWall: !!asteroid.bastionWall,
      solid: !!asteroid.solid,
      borderColor: asteroid.borderColor || null,
      vitals: qv(asteroid.stats),
      resource: asteroid.resource,
      resourceName: asteroid.resourceName,
      resourceColorHex: asteroid.resourceColorHex,
      color: asteroid.color,
      spin: q(asteroid.spin ?? 0, 4),
      shapeSeed: asteroid.shapeSeed,
      secret: asteroid.secret,
      testCore: !!asteroid.testCore,
      demoDummy: !!asteroid.demoDummy,
      demoLabel: asteroid.demoLabel || '',
      testStatusId: asteroid.testStatusId || '',
      statuses: buildStatusSnapshot(asteroid, 4),
      combatLite: true
    }));
}



function firstStructureResourcePreview(structure) {
  const maps = [];
  if (structure?.storage?.resources) maps.push(structure.storage.resources);
  if (structure?.machineInput) maps.push(structure.machineInput);
  if (structure?.machineOutput) maps.push(structure.machineOutput);
  if (structure?.scienceInput) maps.push(structure.scienceInput);
  for (const map of maps) {
    const entries = Object.entries(map || {}).filter(([, amount]) => (amount | 0) > 0);
    if (!entries.length) continue;
    entries.sort(([a], [b]) => String(a).localeCompare(String(b)));
    const [key, amount] = entries[0];
    const def = RESOURCE_DEFS[key] || {};
    return { key, name: def.name || key, colorHex: def.colorHex || '#d7e5ff', amount: amount | 0 };
  }
  return null;
}


function isLogisticBeltOrArm(structure) {
  const kind = getAutomationKindSnapshot(structure);
  return kind === 'conveyor' || kind === 'robot_arm';
}

function logisticSnapshotStatusOnly(structure) {
  return {
    id: structure.id,
    automationKind: getAutomationKindSnapshot(structure),
    automationPulse: structure.automationPulse || 0,
    automationStatus: getAutomationStatusSnapshot(structure)
  };
}

function getAutomationKindSnapshot(structure) {
  return getStructureDef(structure?.type)?.automationKind || '';
}

function getAutomationStatusSnapshot(structure) {
  const status = String(structure?.automationStatus || '');
  if (status) return status;
  const phase = String(structure?.automationItem?.phase || '');
  if (phase.includes('blocked')) return 'blocked';
  return '';
}


export function buildStructureAutomationSnapshots(structures, inSector) {
  return [...structures.values()]
    .filter(inSector)
    .filter((structure) => getAutomationKindSnapshot(structure))
    .map((structure) => {
      if (isLogisticBeltOrArm(structure)) return logisticSnapshotStatusOnly(structure);
      return {
        id: structure.id,
        storageUsed: structure.storage?.resources ? Object.values(structure.storage.resources).reduce((a, b) => a + (b | 0), 0) : 0,
        storagePreview: firstStructureResourcePreview(structure),
        automationItem: structure.automationItem || null,
        automationKind: getAutomationKindSnapshot(structure),
        automationPulse: structure.automationPulse || 0,
        automationStatus: getAutomationStatusSnapshot(structure),
        automationFilterMode: structure.automationFilterMode || 'all',
        automationFilterKey: structure.automationFilterKey || '',
        automationOutputPriority: structure.automationOutputPriority || 'round_robin',
        depositResourceKey: structure.depositResourceKey || '',
        depositQuality: Number(structure.depositQuality || 1),
        depositLabel: structure.depositLabel || RESOURCE_DEFS[structure.depositResourceKey]?.name || structure.depositResourceKey || '',
        depositColorHex: structure.depositColorHex || RESOURCE_DEFS[structure.depositResourceKey]?.colorHex || structure.borderColor || '',
        depositInfinite: structure.type === 'resource_deposit',
        depositRemaining: structure.depositRemaining | 0 || 0,
        depositMax: structure.depositMax | 0 || 0,
        depositId: structure.depositId | 0 || 0,
        extractionProgress: Math.max(0, Math.min(1, Number(structure.extractionProgress || 0)))
      };
    });
}

export function buildStructureAutomationCombatSnapshots(structures, inSector) {
  return [...structures.values()]
    .filter(inSector)
    .filter((structure) => getAutomationKindSnapshot(structure))
    .map((structure) => {
      if (isLogisticBeltOrArm(structure)) return logisticSnapshotStatusOnly(structure);
      return {
        id: structure.id,
        automationKind: getAutomationKindSnapshot(structure),
        automationPulse: structure.automationPulse || 0,
        automationStatus: getAutomationStatusSnapshot(structure),
        depositResourceKey: structure.depositResourceKey || '',
        depositRemaining: structure.depositRemaining | 0 || 0,
        depositInfinite: structure.type === 'resource_deposit'
      };
    });
}

export function buildStructureCombatSnapshots(structures, inSector, player = null) {
  const playerOwner = String(player?.accountKey || player?.accountName || player?.pseudo || `guest-${player?.id | 0}`).toLowerCase();
  const playerWorld = String(player?.worldId || 'endless');
  return [...(structures?.values?.() || [])]
    .filter((structure) => structure && (structure.damageable === false || structure.stats?.hp > 0))
    .filter((structure) => String(structure.worldId || 'endless') === playerWorld)
    .filter(inSector)
    .map((structure) => ({
      id: structure.id,
      kind: 'structure',
      type: structure.type,
      sx: structure.sx | 0,
      sy: structure.sy | 0,
      x: q(structure.x),
      y: q(structure.y),
      radius: q(structure.radius),
      w: q(structure.w || 0),
      h: q(structure.h || 0),
      orientation: structure.orientation || 'h',
      updatedAt: Number(structure.updatedAt || 0),
      open: !!structure.open,
      solid: !!structure.solid,
      damageable: structure.damageable !== false,
      vitals: structure.damageable === false ? null : qv(structure.stats),
      ownerKey: structure.ownerKey || '',
      ownedByMe: String(structure.ownerKey || '').toLowerCase() === playerOwner,
      automationPulse: structure.automationPulse || 0,
      automationKind: getAutomationKindSnapshot(structure),
      automationStatus: getAutomationStatusSnapshot(structure),
      combatLite: true
    }));
}

export function buildStructureSnapshots(structures, inSector, player = null) {
  const playerOwner = String(player?.accountKey || player?.accountName || player?.pseudo || `guest-${player?.id | 0}`).toLowerCase();
  const playerWorld = String(player?.worldId || 'endless');
  return [...(structures?.values?.() || [])]
    .filter((structure) => structure && (structure.damageable === false || structure.stats?.hp > 0))
    .filter((structure) => String(structure.worldId || 'endless') === playerWorld)
    .filter(inSector)
    .map((structure) => ({
      id: structure.id,
      kind: 'structure',
      type: structure.type,
      name: structure.name,
      sx: structure.sx | 0,
      sy: structure.sy | 0,
      x: q(structure.x),
      y: q(structure.y),
      radius: q(structure.radius),
      w: q(structure.w || 0),
      h: q(structure.h || 0),
      orientation: structure.orientation || 'h',
      updatedAt: Number(structure.updatedAt || 0),
      open: !!structure.open,
      solid: !!structure.solid,
      damageable: structure.damageable !== false,
      vitals: structure.damageable === false ? null : qv(structure.stats),
      color: structure.color || '#526274',
      borderColor: structure.borderColor || '#9fcfff',
      ownerName: structure.ownerName || '',
      owned: String(structure.worldId || 'endless') === 'endless'
        ? String(structure.ownerKey || '').toLowerCase() === playerOwner
        : (structure.ownerId | 0) === (player?.id | 0),
      clanId: structure.clanId || '',
      clanShared: !!structure.clanShared,
      claimRadius: q(structure.claimRadius || 0),
      coreTier: structure.coreTier | 0 || 0,
      structureLimit: structure.structureLimit | 0 || 0,
      industrialSignal: q(structure.industrialSignal || 0),
      industrialSignalLevel: structure.industrialSignalLevel || '',
      powered: !!structure.powered,
      energy: structure.energyState || null,
      machineEnabled: structure.machineEnabled !== false,
      machineJob: structure.machineJob ? {
        progress: Math.max(0, Math.min(1, 1 - ((Number(structure.machineJob.remainingMs) || 0) / Math.max(1, Number(structure.machineJob.totalMs) || 1)))),
        paused: !!structure.machineJob.paused
      } : null,
      storageUsed: structure.storage?.resources ? Object.values(structure.storage.resources).reduce((a, b) => a + (b | 0), 0) : 0,
      storagePreview: firstStructureResourcePreview(structure),
      automationItem: structure.automationItem || null,
      automationKind: getAutomationKindSnapshot(structure),
      automationPulse: structure.automationPulse || 0,
      automationStatus: getAutomationStatusSnapshot(structure),
      automationFilterMode: structure.automationFilterMode || 'all',
      automationFilterKey: structure.automationFilterKey || '',
      automationOutputPriority: structure.automationOutputPriority || 'round_robin',
      depositResourceKey: structure.depositResourceKey || '',
      depositQuality: Number(structure.depositQuality || 1),
      depositLabel: structure.depositLabel || RESOURCE_DEFS[structure.depositResourceKey]?.name || structure.depositResourceKey || '',
      depositColorHex: structure.depositColorHex || RESOURCE_DEFS[structure.depositResourceKey]?.colorHex || structure.borderColor || '',
      depositInfinite: structure.type === 'resource_deposit',
      depositRemaining: structure.depositRemaining | 0 || 0,
      depositMax: structure.depositMax | 0 || 0,
      depositId: structure.depositId | 0 || 0,
      extractionProgress: Math.max(0, Math.min(1, Number(structure.extractionProgress || 0))),
      researchProgress: structure.researchJob ? Math.max(0, Math.min(1, 1 - ((Number(structure.researchJob.remainingMs) || 0) / Math.max(1, Number(structure.researchJob.totalMs) || 1)))) : 0,
      baseCoreId: structure.baseCoreId | 0 || 0,
      protectedByCore: isStructureProtectedByCore({ structures }, structure),
      attackable: player ? canPlayerDamageStructure({ structures }, player, structure) : false,
      turretStatus: structure.turretStatus || '',
      turretTargetId: structure.turretTargetId | 0 || 0,
      turretEnabled: structure.turretEnabled !== false,
      turretMode: structure.turretMode || 'auto'
    }));
}

export function buildStationSnapshots(stations, inSector) {
  return [...stations.values()]
    .filter(inSector)
    .map((station) => ({
      id: station.id,
      sx: station.sx | 0,
      sy: station.sy | 0,
      x: q(station.x),
      y: q(station.y),
      radius: q(station.radius),
      tech: station.tech,
      specialtyId: station.specialtyId || '',
      specialtyName: station.specialtyName || '',
      pirate: !!station.pirate || station.specialtyId === 'pirate',
      pirateTier: station.pirateTier | 0 || 0,
      name: station.name,
      pulse: station.pulse
    }));
}

import { getBastionUnlockText, isBastionUnlockedForPlayer } from '../../bastion/BastionSession.js';

export function buildPortalSnapshots(portals, inSector, state = null, player = null, timeMs = 0) {
  return [...portals.values()]
    .filter(inSector)
    .map((portal) => {
      const bastion = portal.bastionId != null && portal.bastionId >= 0 ? state?.bastionsById?.get?.(portal.bastionId | 0) : null;
      const unlocked = bastion ? isBastionUnlockedForPlayer(player, bastion, timeMs, state) : true;
      const unlockText = bastion ? getBastionUnlockText(player, bastion, timeMs, state) : '';
      return ({
      id: portal.id,
      sx: portal.sx | 0,
      sy: portal.sy | 0,
      x: q(portal.x),
      y: q(portal.y),
      radius: q(portal.radius),
      targetSx: portal.targetSx,
      targetSy: portal.targetSy,
      glyph: portal.glyph,
      label: portal.label || '',
      mode: portal.mode || '',
      bastionId: portal.bastionId ?? -1,
      bastionType: portal.bastionType || '',
      bastionTier: portal.bastionTier || 0,
      bastionColor: portal.bastionColor || null,
      unlocked,
      unlockText,
      autoTrigger: !!portal.autoTrigger
    });
    });
}

export function buildProjectileSnapshots(projectiles, inSector) {
  return [...projectiles.values()]
    .filter(inSector)
    .map((projectile) => ({
      id: projectile.id,
      sx: projectile.sx | 0,
      sy: projectile.sy | 0,
      x: q(projectile.x),
      y: q(projectile.y),
      radius: q(projectile.radius),
      tint: projectile.tint,
      splashRadius: q(projectile.splashRadius || 0),
      vx: q(projectile.vx || 0, 2),
      vy: q(projectile.vy || 0, 2),
      bornAt: projectile.bornAt || 0,
      visualKind: projectile.visualKind || 'auto',
      sourceKind: projectile.sourceKind || '',
      visualSlot: projectile.visualSlot || '',
      visualAmmoEffect: projectile.visualAmmoEffect || '',
      visualAmmoId: projectile.visualAmmoId || '',
      sourceAbilitySlot: projectile.sourceAbilitySlot || '',
      sourceFrameId: projectile.sourceFrameId || '',
      crit: !!projectile.crit,
      empoweredAutoUsed: !!projectile.empoweredAutoUsed,
      ultAutoUsed: !!projectile.ultAutoUsed
    }));
}

export function buildAreaEffectSnapshots(areaEffects, inSector) {
  return [...areaEffects.values()]
    .filter(inSector)
    .map((effect) => ({
      id: effect.id,
      sx: effect.sx | 0,
      sy: effect.sy | 0,
      x: q(effect.x),
      y: q(effect.y),
      radius: q(effect.radius),
      durationLeft: q(effect.durationLeft, 2),
      slot: effect.slot,
      frameId: effect.frameId,
      color: effect.color,
      visualStyle: effect.visualStyle || '',
      innerRadius: q(effect.innerRadius || 0),
      pulseEvery: q(effect.pulseEvery || effect.tickEvery || 0, 2),
      kind: effect.kind || 'area_effect',
      label: effect.label || '',
      statusId: effect.statusId || '',
      phase: effect.phase || 'ready',
      cooldownLeft: q(effect.cooldownLeft || 0, 2),
      activeSeconds: q(effect.activeSeconds || 0, 2),
      dormantSeconds: q(effect.dormantSeconds || 0, 2)
    }));
}

export function buildLootSnapshots(loots, inSector) {
  return [...loots.values()]
    .filter(inSector)
    .map((loot) => ({
      id: loot.id,
      sx: loot.sx | 0,
      sy: loot.sy | 0,
      x: q(loot.x),
      y: q(loot.y),
      radius: q(loot.radius),
      resource: loot.resource,
      amount: loot.amount,
      itemId: loot.itemId || '',
      itemName: loot.itemName || '',
      itemCategoryId: loot.itemCategoryId || '',
      bastionReward: !!loot.bastionReward,
      color: loot.color
    }));
}

export { buildLogisticDroneSnapshots };
