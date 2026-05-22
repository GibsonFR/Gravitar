import { buildStatBlockSnapshot } from '../../stats/StatBlockSnapshot.js';
import { buildStatusSnapshot } from '../../status/StatusView.js';

export function buildMobSnapshots(mobs, inSector) {
  return [...mobs.values()]
    .filter((mob) => mob.stats.hp > 0)
    .filter(inSector)
    .map((mob) => ({
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
      x: mob.x,
      y: mob.y,
      vx: mob.vx,
      vy: mob.vy,
      rot: mob.rot ?? 0,
      radius: mob.radius,
      vitals: buildStatBlockSnapshot(mob.stats),
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
      specialCueLeft: mob.specialCueLeft || 0,
      statuses: buildStatusSnapshot(mob, 6)
    }));
}

export function buildAsteroidSnapshots(asteroids, inSector) {
  return [...asteroids.values()]
    .filter((asteroid) => asteroid.stats.hp > 0)
    .filter(inSector)
    .map((asteroid) => ({
      id: asteroid.id,
      sx: asteroid.sx | 0,
      sy: asteroid.sy | 0,
      x: asteroid.x,
      y: asteroid.y,
      radius: asteroid.radius,
      w: asteroid.w || 0,
      h: asteroid.h || 0,
      bastionWall: !!asteroid.bastionWall,
      solid: !!asteroid.solid,
      borderColor: asteroid.borderColor || null,
      vitals: buildStatBlockSnapshot(asteroid.stats),
      resource: asteroid.resource,
      resourceName: asteroid.resourceName,
      resourceColorHex: asteroid.resourceColorHex,
      color: asteroid.color,
      rot: asteroid.rot,
      shapeSeed: asteroid.shapeSeed,
      secret: asteroid.secret,
      testCore: !!asteroid.testCore,
      demoDummy: !!asteroid.demoDummy,
      demoLabel: asteroid.demoLabel || '',
      testStatusId: asteroid.testStatusId || '',
      statuses: buildStatusSnapshot(asteroid, 4)
    }));
}

export function buildStationSnapshots(stations, inSector) {
  return [...stations.values()]
    .filter(inSector)
    .map((station) => ({
      id: station.id,
      sx: station.sx | 0,
      sy: station.sy | 0,
      x: station.x,
      y: station.y,
      radius: station.radius,
      tech: station.tech,
      specialtyId: station.specialtyId || '',
      specialtyName: station.specialtyName || '',
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
      x: portal.x,
      y: portal.y,
      radius: portal.radius,
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
      unlockText
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
      x: projectile.x,
      y: projectile.y,
      radius: projectile.radius,
      tint: projectile.tint,
      splashRadius: projectile.splashRadius,
      vx: projectile.vx || 0,
      vy: projectile.vy || 0,
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
      x: effect.x,
      y: effect.y,
      radius: effect.radius,
      durationLeft: effect.durationLeft,
      slot: effect.slot,
      frameId: effect.frameId,
      color: effect.color,
      kind: effect.kind || 'area_effect',
      label: effect.label || '',
      statusId: effect.statusId || '',
      phase: effect.phase || 'ready',
      cooldownLeft: effect.cooldownLeft || 0,
      activeSeconds: effect.activeSeconds || 0,
      dormantSeconds: effect.dormantSeconds || 0
    }));
}

export function buildLootSnapshots(loots, inSector) {
  return [...loots.values()]
    .filter(inSector)
    .map((loot) => ({
      id: loot.id,
      sx: loot.sx | 0,
      sy: loot.sy | 0,
      x: loot.x,
      y: loot.y,
      radius: loot.radius,
      resource: loot.resource,
      amount: loot.amount,
      itemId: loot.itemId || '',
      itemName: loot.itemName || '',
      itemCategoryId: loot.itemCategoryId || '',
      bastionReward: !!loot.bastionReward,
      color: loot.color
    }));
}
