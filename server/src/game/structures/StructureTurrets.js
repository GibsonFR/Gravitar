import { STRUCTURE_TYPES, getStructureDef } from './StructureDefs.js';
import { isStructureAlive } from './StructureSystem.js';
import { spawnProjectile } from '../projectile/ProjectileSystem.js';
import { distSq } from '../util/Math.js';
import { getItemDef } from '../../../../shared/content/items/ItemDefs.js';
import { ITEM_CATEGORY_IDS } from '../../../../shared/content/items/ItemCategoryIds.js';
import { buildRocketAmmoStatusSpecs } from '../rocket/RocketAmmoRules.js';
import { isSafeNoPvpSector } from '../sector/SpecialSectors.js';
import { TURRET_MODES, normalizeTurretMode, isTurretModeEnabled } from './StructureTurretModes.js';
import { queueWorldSfx } from '../audio/WorldSfxState.js';
import { SFX_EVENT_TYPES } from '../audio/SfxEventTypes.js';
import { applyDamage } from '../combat/DamageSystem.js';
import { destroyStructure } from './StructureSystem.js';

const DEFAULT_RANGE = 820;
const DEFAULT_COOLDOWN_MS = 2400;
const DEFAULT_SPEED = 720;
const DEFAULT_DAMAGE = 28;
const DEFAULT_SPLASH = 88;
const DEFAULT_TINT = '#ffb66e';
const SAVE_INTERVAL_MS = 4500;

function sameWorld(a, b) {
  return String(a?.worldId || 'endless') === String(b?.worldId || 'endless');
}

function ownerKeyOf(entity) {
  return String(entity?.accountKey || entity?.ownerKey || entity?.accountName || entity?.pseudo || '').toLowerCase();
}

function isTurret(structure) {
  return !!getStructureDef(structure?.type)?.turret;
}

function turretNeedsAmmo(turret) {
  return String(getStructureDef(turret?.type)?.turretWeapon || 'missile') === 'missile';
}

function getAmmoStorage(turret) {
  turret.storage ??= { kind: 'ammo', ammo: {}, ammoCapacity: getStructureDef(turret.type)?.ammoCapacity || 0 };
  turret.storage.kind = 'ammo';
  turret.storage.ammo ??= {};
  return turret.storage.ammo;
}

function chooseAmmo(turret) {
  const ammo = getAmmoStorage(turret);
  for (const [itemId, amount] of Object.entries(ammo)) {
    const qty = Math.max(0, amount | 0);
    if (qty <= 0) continue;
    const id = String(itemId || '').toLowerCase();
    const def = turret.storage?.customItemDefs?.[id] || getItemDef(id);
    if (!def || def.categoryId !== ITEM_CATEGORY_IDS.AMMO || !def.ammoProfile) continue;
    return { itemId: def.id, def, amount: qty };
  }
  return null;
}

function consumeTurretAmmo(turret, itemId) {
  const ammo = getAmmoStorage(turret);
  const id = String(itemId || '').toLowerCase();
  const cur = Math.max(0, ammo[id] | 0);
  if (cur <= 0) return false;
  ammo[id] = cur - 1;
  if (ammo[id] <= 0) delete ammo[id];
  return true;
}

function isTargetInsideOwnedClaim(state, turret, player) {
  const owner = ownerKeyOf(turret);
  if (!owner) return false;
  for (const core of state?.structures?.values?.() || []) {
    if (!core || !isStructureAlive(core)) continue;
    if (core.type !== STRUCTURE_TYPES.BASE_CORE && core.type !== STRUCTURE_TYPES.OUTPOST_CORE) continue;
    if (!sameWorld(core, player)) continue;
    if ((core.sx | 0) !== (player.sx | 0) || (core.sy | 0) !== (player.sy | 0)) continue;
    if (ownerKeyOf(core) !== owner) continue;
    const claimRadius = Math.max(0, Number(core.claimRadius || 0) || 0);
    if (claimRadius <= 0) continue;
    if (distSq(core.x || 0, core.y || 0, player.x || 0, player.y || 0) <= claimRadius * claimRadius) return true;
  }
  return false;
}

function validTargetForTurret(state, turret, target, rangeSq, mode = TURRET_MODES.AUTO) {
  if (!target || (target.stats?.hp ?? 0) <= 0) return false;
  if (!sameWorld(turret, target)) return false;
  if ((target.sx | 0) !== (turret.sx | 0) || (target.sy | 0) !== (turret.sy | 0)) return false;
  if (target.kind === 'player' && isSafeNoPvpSector(target.sx | 0, target.sy | 0)) return false;
  const turretOwner = ownerKeyOf(turret);
  if (turretOwner && ownerKeyOf(target) === turretOwner) return false;
  if (target.kind === 'player' && turret.clanShared && turret.clanId) {
    const clan = state?.clans?.get?.(turret.clanId);
    if (clan?.members?.includes?.(ownerKeyOf(target))) return false;
  }
  if (distSq(turret.x || 0, turret.y || 0, target.x || 0, target.y || 0) > rangeSq) return false;
  if (target.kind === 'player' && mode === TURRET_MODES.INTRUSION && !isTargetInsideOwnedClaim(state, turret, target)) return false;
  return true;
}

function findTurretTarget(state, turret, range, mode = TURRET_MODES.AUTO) {
  let best = null;
  let bestD2 = Infinity;
  const rangeSq = range * range;
  for (const player of state.players?.values?.() || []) {
    if (!validTargetForTurret(state, turret, player, rangeSq, mode)) continue;
    const d2 = distSq(turret.x || 0, turret.y || 0, player.x || 0, player.y || 0);
    if (d2 < bestD2) { best = player; bestD2 = d2; }
  }
  for (const mob of state.mobs?.values?.() || []) {
    if (!validTargetForTurret(state, turret, mob, rangeSq, mode)) continue;
    const d2 = distSq(turret.x || 0, turret.y || 0, mob.x || 0, mob.y || 0);
    if (d2 < bestD2) { best = mob; bestD2 = d2; }
  }
  return best;
}

function setTurretStatus(turret, status, timeMs) {
  if (turret.turretStatus === status) return false;
  turret.turretStatus = status;
  turret.updatedAt = timeMs;
  return true;
}

function fireTurretAt(state, turret, target, ammoDef, timeMs) {
  const def = getStructureDef(turret.type) || {};
  const profile = ammoDef?.ammoProfile || {};
  const damage = Math.max(1, Number(profile.damage ?? def.turretDamage ?? DEFAULT_DAMAGE) || DEFAULT_DAMAGE);
  const splash = Math.max(0, Number(profile.splashRadius ?? def.turretSplash ?? DEFAULT_SPLASH) || 0);
  const speed = Math.max(120, Number(def.turretProjectileSpeed || DEFAULT_SPEED) || DEFAULT_SPEED);
  const tint = profile.tint || def.borderColor || DEFAULT_TINT;
  const statusSpecs = buildRocketAmmoStatusSpecs(ammoDef);
  const shooter = {
    ...turret,
    kind: 'structure',
    radius: Math.max(20, Number(turret.radius || 44) || 44),
    vx: 0,
    vy: 0
  };
  spawnProjectile(
    state,
    shooter,
    target.x || 0,
    target.y || 0,
    tint,
    damage,
    Math.max(4, Number(def.turretProjectileRadius || 6) || 6),
    speed,
    Math.max(300, Number(def.turretRange || DEFAULT_RANGE) || DEFAULT_RANGE),
    splash,
    timeMs,
    {
      sourceKind: 'structure',
      sourceOwnerKey: ownerKeyOf(turret),
      onHitStatuses: statusSpecs.onHitStatuses,
      onSplashStatuses: statusSpecs.onSplashStatuses,
      visualKind: profile.raidKind ? `${def.turretVisual || 'rocket'}_${profile.raidKind}` : (def.turretVisual || 'rocket'),
      visualAmmoId: ammoDef?.id || '',
      visualAmmoEffect: profile.effectType || def.turretWeapon || '',
      intendedTargetKind: target.kind || '',
      intendedTargetId: target.id | 0,
      lockTarget: true
    }
  );
  queueWorldSfx(state, def.turretVisual === 'rocket' ? SFX_EVENT_TYPES.ROCKET : SFX_EVENT_TYPES.AUTO_ATTACK, turret.sx | 0, turret.sy | 0, turret.x || 0, turret.y || 0, 1);
}

function updateAntiMissile(state, structure, timeMs) {
  const def = getStructureDef(structure.type) || {};
  if (!structure.powered || timeMs < Number(structure.turretCooldownUntil || 0)) return false;
  const rangeSq = Math.max(100, Number(def.turretRange || 680)) ** 2;
  for (const projectile of state.projectiles?.values?.() || []) {
    if (projectile.sourceKind !== 'player' && projectile.sourceKind !== 'mob') continue;
    if ((projectile.sx | 0) !== (structure.sx | 0) || (projectile.sy | 0) !== (structure.sy | 0)) continue;
    if (projectile.sourceKind === 'player') {
      const sourcePlayer = state.players?.get?.(projectile.sourceId) || null;
      const sourceKey = String(
        projectile.sourceOwnerKey
          || sourcePlayer?.accountKey
          || sourcePlayer?.accountName
          || sourcePlayer?.pseudo
          || ''
      ).toLowerCase();
      if (sourceKey && sourceKey === ownerKeyOf(structure)) continue;
    }
    if (distSq(structure.x, structure.y, projectile.x, projectile.y) > rangeSq) continue;
    state.projectiles.delete(projectile.id);
    structure.turretCooldownUntil = timeMs + Math.max(300, Number(def.turretCooldownMs || 950));
    structure.turretStatus = 'intercept';
    structure.updatedAt = timeMs;
    queueWorldSfx(state, SFX_EVENT_TYPES.AUTO_ATTACK, structure.sx, structure.sy, projectile.x, projectile.y, 1);
    return true;
  }
  structure.turretStatus = 'idle';
  return false;
}

function updateDefenseMine(state, mine, timeMs) {
  const def = getStructureDef(mine.type) || {};
  const rangeSq = Math.max(20, Number(def.mineRange || 115)) ** 2;
  const targets = [...(state.mobs?.values?.() || []), ...(state.players?.values?.() || [])];
  for (const target of targets) {
    if (!validTargetForTurret(state, mine, target, rangeSq, TURRET_MODES.AUTO)) continue;
    applyDamage(state, target, Math.max(1, Number(def.mineDamage || 90)), mine, { timeMs, visualKind: 'defense_mine', bypassShield: false });
    queueWorldSfx(state, SFX_EVENT_TYPES.ROCKET, mine.sx, mine.sy, mine.x, mine.y, 1);
    destroyStructure(state, mine, timeMs);
    return true;
  }
  return false;
}

export function updateDefenseTurrets(state, dt, timeMs = Date.now()) {
  if (!state?.structures) return;
  let shouldSave = false;
  for (const turret of state.structures.values()) {
    if (turret.type === STRUCTURE_TYPES.ANTI_MISSILE) {
      shouldSave = updateAntiMissile(state, turret, timeMs) || shouldSave;
      continue;
    }
    if (turret.type === STRUCTURE_TYPES.DEFENSE_MINE) {
      shouldSave = updateDefenseMine(state, turret, timeMs) || shouldSave;
      continue;
    }
    if (!isTurret(turret)) continue;
    if (!isStructureAlive(turret)) continue;
    const def = getStructureDef(turret.type) || {};
    const mode = normalizeTurretMode(turret.turretMode);
    turret.turretMode = mode;
    turret.turretEnabled = isTurretModeEnabled(mode);
    if (!turret.turretEnabled) {
      if (setTurretStatus(turret, 'off', timeMs)) shouldSave = true;
      continue;
    }
    if ((Number(def.energyUse) || 0) > 0 && !turret.powered) {
      if (setTurretStatus(turret, 'no_power', timeMs)) shouldSave = true;
      continue;
    }
    const ammo = turretNeedsAmmo(turret) ? chooseAmmo(turret) : { itemId: '', def: null, amount: 1 };
    if (!ammo) {
      if (setTurretStatus(turret, 'no_ammo', timeMs)) shouldSave = true;
      continue;
    }
    const range = Math.max(160, Number(def.turretRange || DEFAULT_RANGE) || DEFAULT_RANGE);
    const target = findTurretTarget(state, turret, range, mode);
    if (!target) {
      turret.turretTargetId = 0;
      if (setTurretStatus(turret, 'idle', timeMs)) shouldSave = true;
      continue;
    }
    turret.turretTargetId = target.id | 0;
    if (timeMs < Number(turret.turretCooldownUntil || 0)) {
      if (setTurretStatus(turret, 'cooldown', timeMs)) shouldSave = true;
      continue;
    }
    if (turretNeedsAmmo(turret) && !consumeTurretAmmo(turret, ammo.itemId)) {
      if (setTurretStatus(turret, 'no_ammo', timeMs)) shouldSave = true;
      continue;
    }
    fireTurretAt(state, turret, target, ammo.def, timeMs);
    turret.turretCooldownUntil = timeMs + Math.max(300, Number(def.turretCooldownMs || DEFAULT_COOLDOWN_MS) || DEFAULT_COOLDOWN_MS);
    turret.turretStatus = 'firing';
    turret.updatedAt = timeMs;
    if (String(turret.worldId || 'endless') === 'endless' || timeMs - (turret.lastTurretSaveAt || 0) > SAVE_INTERVAL_MS) {
      turret.lastTurretSaveAt = timeMs;
      shouldSave = true;
    }
  }
  if (shouldSave) state.structureStore?.saveFromState?.(state);
}
