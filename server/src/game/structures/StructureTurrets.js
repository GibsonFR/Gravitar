import { STRUCTURE_TYPES, getStructureDef } from './StructureDefs.js';
import { isStructureAlive } from './StructureSystem.js';
import { spawnProjectile } from '../projectile/ProjectileSystem.js';
import { distSq } from '../util/Math.js';
import { getItemDef } from '../../../../shared/content/items/ItemDefs.js';
import { ITEM_CATEGORY_IDS } from '../../../../shared/content/items/ItemCategoryIds.js';
import { buildRocketAmmoStatusSpecs } from '../rocket/RocketAmmoRules.js';
import { isSafeNoPvpSector } from '../sector/SpecialSectors.js';
import { queueWorldSfx } from '../audio/WorldSfxState.js';
import { SFX_EVENT_TYPES } from '../audio/SfxEventTypes.js';

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
  return structure?.type === STRUCTURE_TYPES.DEFENSE_TURRET;
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
    const def = getItemDef(String(itemId || '').toLowerCase());
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

function validTargetForTurret(turret, player, rangeSq) {
  if (!player || (player.stats?.hp ?? 0) <= 0) return false;
  if (!sameWorld(turret, player)) return false;
  if ((player.sx | 0) !== (turret.sx | 0) || (player.sy | 0) !== (turret.sy | 0)) return false;
  if (isSafeNoPvpSector(player.sx | 0, player.sy | 0)) return false;
  const turretOwner = ownerKeyOf(turret);
  if (turretOwner && ownerKeyOf(player) === turretOwner) return false;
  return distSq(turret.x || 0, turret.y || 0, player.x || 0, player.y || 0) <= rangeSq;
}

function findTurretTarget(state, turret, range) {
  let best = null;
  let bestD2 = Infinity;
  const rangeSq = range * range;
  for (const player of state.players?.values?.() || []) {
    if (!validTargetForTurret(turret, player, rangeSq)) continue;
    const d2 = distSq(turret.x || 0, turret.y || 0, player.x || 0, player.y || 0);
    if (d2 < bestD2) { best = player; bestD2 = d2; }
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
  const damage = Math.max(1, Number(profile.damage ?? DEFAULT_DAMAGE) || DEFAULT_DAMAGE);
  const splash = Math.max(8, Number(profile.splashRadius ?? DEFAULT_SPLASH) || DEFAULT_SPLASH);
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
      visualKind: 'rocket',
      visualAmmoId: ammoDef.id,
      visualAmmoEffect: profile.effectType || 'explosive'
    }
  );
  queueWorldSfx(state, SFX_EVENT_TYPES.ROCKET, turret.sx | 0, turret.sy | 0, turret.x || 0, turret.y || 0, 1);
}

export function updateDefenseTurrets(state, dt, timeMs = Date.now()) {
  if (!state?.structures) return;
  let shouldSave = false;
  for (const turret of state.structures.values()) {
    if (!isTurret(turret)) continue;
    if (!isStructureAlive(turret)) continue;
    const def = getStructureDef(turret.type) || {};
    if (turret.turretEnabled === false || turret.turretMode === 'off') {
      if (setTurretStatus(turret, 'off', timeMs)) shouldSave = true;
      continue;
    }
    if ((Number(def.energyUse) || 0) > 0 && !turret.powered) {
      if (setTurretStatus(turret, 'no_power', timeMs)) shouldSave = true;
      continue;
    }
    const ammo = chooseAmmo(turret);
    if (!ammo) {
      if (setTurretStatus(turret, 'no_ammo', timeMs)) shouldSave = true;
      continue;
    }
    const range = Math.max(160, Number(def.turretRange || DEFAULT_RANGE) || DEFAULT_RANGE);
    const target = findTurretTarget(state, turret, range);
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
    if (!consumeTurretAmmo(turret, ammo.itemId)) {
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
