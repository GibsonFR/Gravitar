import { WEAPON_PULSE_MK1, ROCKET_BASIC } from '../constants.js';
import { dist, distSq, norm, screenToWorld } from '../util/Math.js';
import { getSimulationTimeMs } from '../util/Time.js';
import { getTargetForPlayer, isPlayerAttackable, blindAllowsPoint } from '../targeting/Targeting.js';
import { spawnProjectile } from '../projectile/ProjectileSystem.js';
import { queueWorldSfx } from '../audio/WorldSfxState.js';
import { SFX_EVENT_TYPES } from '../audio/SfxEventTypes.js';
import { consumeEnergy, tickStatBlock } from '../stats/StatBlockRuntime.js';
import { updatePlayerFacing } from './PlayerFacing.js';
import { forceUndock, isDockLocked, requestDockAtNearestStation, tickDocking } from '../station/DockingSystem.js';
import { tryUsePortal } from '../portal/PortalSystem.js';
import { setPlayerHint } from './PlayerUiHints.js';
import { tickAbilityCooldowns, consumeAbilityEdge } from '../abilities/AbilityTick.js';
import { tryCastAbility } from '../abilities/AbilityCastSystem.js';
import { blocksAbilities, blocksAttacks, blocksVoluntaryMove, consumeMotionOverride, getMoveSpeedMultiplier } from '../status/StatusMotion.js';
import { getStatusEntry } from '../status/StatusRack.js';
import { getFrameAutoAttackProfile, getFrameMoveMultiplier, tickFrameGameplay } from '../frames/FrameGameplayHooks.js';
import { tickPlayerProgression } from '../progression/ProgressionSystem.js';
import { STATUS_EFFECT_IDS } from '../../../../shared/content/status/StatusEffectIds.js';
import { getEquippedEquipmentDefs } from '../equipment/EquipmentBonuses.js';
import { ITEM_CATEGORY_IDS } from '../../../../shared/content/items/ItemCategoryIds.js';
import { buildRocketAmmoStatusSpecs, consumeRocketAmmo, getActiveRocketAmmoDef } from '../rocket/RocketAmmoRules.js';
import { getBastionDamageMultiplier, getBastionMoveSpeedMultiplier } from '../bastion/BastionBuffs.js';

function getEquippedDefByCategory(player, categoryId) {
  return getEquippedEquipmentDefs(player).find((def) => def?.categoryId === categoryId) || null;
}

function getWeaponDef(player) {
  return getEquippedDefByCategory(player, ITEM_CATEGORY_IDS.WEAPON);
}

function getLauncherDef(player) {
  return getEquippedDefByCategory(player, ITEM_CATEGORY_IDS.LAUNCHER);
}

function getWeaponProfile(player) {
  return getWeaponDef(player)?.weaponProfile || null;
}

function pushPlayerOutOfRect(player, wall) {
  const w = wall.w || wall.radius * 2;
  const h = wall.h || wall.radius * 2;
  const left = wall.x - w * 0.5;
  const right = wall.x + w * 0.5;
  const top = wall.y - h * 0.5;
  const bottom = wall.y + h * 0.5;
  const cx = Math.max(left, Math.min(player.x, right));
  const cy = Math.max(top, Math.min(player.y, bottom));
  let dx = player.x - cx;
  let dy = player.y - cy;
  let d = Math.hypot(dx, dy);

  if (d > 0.0001 && d < player.radius) {
    const push = player.radius - d + 0.8;
    player.x += (dx / d) * push;
    player.y += (dy / d) * push;
    if (Math.abs(dx) > Math.abs(dy)) player.vx = 0;
    else player.vy = 0;
    return true;
  }

  if (player.x > left - player.radius && player.x < right + player.radius && player.y > top - player.radius && player.y < bottom + player.radius) {
    const pushLeft = Math.abs(player.x - (left - player.radius));
    const pushRight = Math.abs((right + player.radius) - player.x);
    const pushTop = Math.abs(player.y - (top - player.radius));
    const pushBottom = Math.abs((bottom + player.radius) - player.y);
    const minPush = Math.min(pushLeft, pushRight, pushTop, pushBottom);
    if (minPush === pushLeft) player.x = left - player.radius - 0.8;
    else if (minPush === pushRight) player.x = right + player.radius + 0.8;
    else if (minPush === pushTop) player.y = top - player.radius - 0.8;
    else player.y = bottom + player.radius + 0.8;
    player.vx = 0;
    player.vy = 0;
    return true;
  }
  return false;
}


function pointInsideExpandedRect(x, y, wall, pad) {
  const w = wall.w || wall.radius * 2;
  const h = wall.h || wall.radius * 2;
  return x >= wall.x - w * 0.5 - pad && x <= wall.x + w * 0.5 + pad && y >= wall.y - h * 0.5 - pad && y <= wall.y + h * 0.5 + pad;
}

function segmentIntersectsExpandedRect(x1, y1, x2, y2, wall, pad) {
  if (pointInsideExpandedRect(x1, y1, wall, pad) || pointInsideExpandedRect(x2, y2, wall, pad)) return true;
  const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / Math.max(8, pad * 0.45)));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (pointInsideExpandedRect(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, wall, pad)) return true;
  }
  return false;
}

function resolveSweptWallMovement(state, player, oldX, oldY) {
  if (Math.abs(player.x - oldX) + Math.abs(player.y - oldY) < 0.001) return;
  for (const wall of state.asteroids.values()) {
    if (!wall.solid && !wall.bastionWall) continue;
    if ((wall.sx | 0) !== (player.sx | 0) || (wall.sy | 0) !== (player.sy | 0)) continue;
    if (!segmentIntersectsExpandedRect(oldX, oldY, player.x, player.y, wall, player.radius + 1.5)) continue;
    player.x = oldX;
    player.y = oldY;
    player.vx = 0;
    player.vy = 0;
    player.hasMoveTarget = false;
    return;
  }
}

function resolvePlayerSolidWalls(state, player) {
  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    for (const wall of state.asteroids.values()) {
      if (!wall.solid && !wall.bastionWall) continue;
      if ((wall.sx | 0) !== (player.sx | 0) || (wall.sy | 0) !== (player.sy | 0)) continue;
      changed = pushPlayerOutOfRect(player, wall) || changed;
    }
    if (!changed) break;
  }
}

function getLauncherProfile(player) {
  return getLauncherDef(player)?.launcherProfile || null;
}

function fireAutoAttack(state, p, target, timeMs) {
  const weapon = getWeaponProfile(p);
  if (!weapon) {
    setPlayerHint(p, 'Aucune arme équipée');
    p.autoTargetKind = '';
    p.autoTargetId = 0;
    return;
  }
  if (!consumeEnergy(p.stats, weapon.energyCost ?? WEAPON_PULSE_MK1.energyCost)) return;
  const frameAuto = getFrameAutoAttackProfile(p);
  const baseAutoCooldown = Math.max(0.08, weapon.cooldown ?? p.progressionBonuses?.autoAttackBaseCooldown ?? WEAPON_PULSE_MK1.cooldown);
  p.nextShotAt = timeMs + (baseAutoCooldown / Math.max(0.05, frameAuto.cooldownMult)) * 1000;

  const distTo = dist(p.x, p.y, target.x, target.y);
  const rangeMult = Math.max(0.5, p.progressionBonuses?.autoRangeMult ?? 1);
  const weaponRange = weapon.range ?? WEAPON_PULSE_MK1.range;
  const rangeLeft = Math.max(weaponRange * 2.2 * rangeMult, distTo + 260);
  const critChance = Math.max(0, Math.min(0.95, p.progressionBonuses?.critChance ?? 0));
  const critDamageMult = Math.max(1, p.progressionBonuses?.critDamageMult ?? 1.5);
  const crit = Math.random() < critChance;
  const frameDamage = Number.isFinite(frameAuto.damage) ? frameAuto.damage : null;
  const weaponDamage = weapon.damage ?? WEAPON_PULSE_MK1.damage;
  const baseDamage = frameDamage != null ? Math.max(weaponDamage, frameDamage) : weaponDamage;
  const damage = baseDamage * (p.progressionBonuses?.damageMult ?? 1) * getBastionDamageMultiplier(p) * (crit ? critDamageMult : 1);
  const burnDuration = Math.max(0, p.progressionBonuses?.autoBurnDuration ?? 0);
  const burnDps = Math.max(0, p.progressionBonuses?.autoBurnDps ?? 0);
  const onHitStatuses = [];
  if (Array.isArray(frameAuto.extras?.onHitStatuses)) onHitStatuses.push(...frameAuto.extras.onHitStatuses);
  else if (frameAuto.extras?.onHitStatuses) onHitStatuses.push(frameAuto.extras.onHitStatuses);
  if (burnDuration > 0 && burnDps > 0) {
    onHitStatuses.push({
      effectId: STATUS_EFFECT_IDS.BURN,
      duration: burnDuration,
      periodicDamage: burnDps,
      tickEvery: 1,
      hostile: true,
      label: 'Item'
    });
  }

  spawnProjectile(
    state,
    p,
    target.x,
    target.y,
    weapon.tint ?? WEAPON_PULSE_MK1.tint,
    damage,
    3.5,
    weapon.projectileSpeed ?? frameAuto.projectileSpeed ?? WEAPON_PULSE_MK1.projectileSpeed,
    rangeLeft,
    0,
    timeMs,
    {
      ...(frameAuto.extras ?? {}),
      onHitStatuses,
      crit,
      visualKind: 'auto'
    }
  );

  queueWorldSfx(state, SFX_EVENT_TYPES.AUTO_ATTACK, p.sx, p.sy, p.x, p.y, 0);
}

function fireRocket(state, p, worldX, worldY, timeMs) {
  const launcher = getLauncherProfile(p);
  if (!launcher) return { ok: false, reason: 'no_launcher' };
  const ammoDef = getActiveRocketAmmoDef(p);
  if (!ammoDef?.ammoProfile) return { ok: false, reason: 'no_ammo' };
  if (p.rocketCooldownLeft > 0) return { ok: false, reason: 'cooldown' };
  if (!consumeEnergy(p.stats, launcher.energyCost ?? ROCKET_BASIC.energyCost)) return { ok: false, reason: 'energy' };

  const volley = Math.max(1, launcher.volley | 0);
  const dispersionDeg = Math.max(0, launcher.dispersionDeg ?? 0);
  const dir = norm(worldX - p.x, worldY - p.y);
  const baseAngle = Math.atan2(dir.y, dir.x);
  const ammo = ammoDef.ammoProfile || {};
  const rocketSpeed = launcher.projectileSpeed ?? ROCKET_BASIC.speed;
  const rocketRange = launcher.range ?? ROCKET_BASIC.range;
  const rocketSplash = Math.max(8, ammo.splashRadius ?? launcher.splashRadius ?? ROCKET_BASIC.splashRadius);
  const rocketDamage = (ammo.damage ?? ROCKET_BASIC.damage) * (launcher.damageMult ?? 1) * Math.max(0.1, p.progressionBonuses?.rocketDamageMult ?? 1) * getBastionDamageMultiplier(p);
  const tint = ammo.tint ?? launcher.tint ?? ROCKET_BASIC.tint;
  const statusSpecs = buildRocketAmmoStatusSpecs(ammoDef);

  let fired = 0;
  for (let i = 0; i < volley; i++) {
    if (!consumeRocketAmmo(p, ammoDef.id, 1, timeMs)) break;
    const t = volley === 1 ? 0 : (i / (volley - 1)) - 0.5;
    const angle = baseAngle + (dispersionDeg * Math.PI / 180) * t;
    const tx = p.x + Math.cos(angle) * 1000;
    const ty = p.y + Math.sin(angle) * 1000;
    spawnProjectile(
      state,
      p,
      tx,
      ty,
      tint,
      rocketDamage,
      6,
      rocketSpeed,
      rocketRange,
      rocketSplash,
      timeMs,
      {
        onHitStatuses: statusSpecs.onHitStatuses,
        onSplashStatuses: statusSpecs.onSplashStatuses,
        visualKind: 'rocket',
        visualAmmoId: ammoDef.id,
        visualAmmoEffect: ammo.effectType || 'explosive'
      }
    );
    fired += 1;
  }

  if (fired <= 0) return { ok: false, reason: 'empty_slot' };
  p.rocketCooldownLeft = Math.max(0.2, launcher.cooldown ?? ROCKET_BASIC.cooldown);
  queueWorldSfx(state, SFX_EVENT_TYPES.ROCKET, p.sx, p.sy, p.x, p.y, fired);
  return { ok: true, fired, ammoName: ammoDef.shortName || ammoDef.name || 'Rocket' };
}


function updateForcedTauntTarget(state, p) {
  const taunt = getStatusEntry(p, STATUS_EFFECT_IDS.TAUNT);
  if (!taunt) return;
  const kind = taunt.meta?.sourceKind || '';
  const id = taunt.meta?.sourceTargetId || taunt.meta?.sourceId || 0;
  if (!kind || !id) return;
  const t = getTargetForPlayer(state, p, kind, id);
  if (!isPlayerAttackable(p, t)) return;
  p.selectedKind = kind;
  p.selectedId = id;
  p.autoTargetKind = kind;
  p.autoTargetId = id;
  p.hasMoveTarget = false;
}

function updateAbilityCasting(state, player, dt, timeMs) {
  tickAbilityCooldowns(player, dt);
  const slots = ['A', 'Z', 'E', 'R'];
  if (blocksAbilities(player)) {
    for (const slot of slots) consumeAbilityEdge(player, slot);
    return false;
  }
  let usedAny = false;
  const locked = !!player.dockedStationId || (player.dockPhase && player.dockPhase !== 'none');
  for (const slot of slots) {
    if (!consumeAbilityEdge(player, slot)) continue;
    usedAny = true;
    if (locked) {
      setPlayerHint(player, 'Abilities indisponibles en station', 1.2);
      continue;
    }
    if (tryCastAbility(state, player, slot, timeMs)) {
      queueWorldSfx(state, SFX_EVENT_TYPES[`ABILITY_${slot}`] || SFX_EVENT_TYPES.AUTO_ATTACK, player.sx, player.sy, player.x, player.y, 0);
    }
  }
  return usedAny;
}

export function updatePlayer(state, p, dt, timeMs = null) {
  let mx = 0;
  let my = 0;
  if (p.uiHintTimer > 0) p.uiHintTimer = Math.max(0, p.uiHintTimer - dt);
  tickPlayerProgression(p, dt);
  if (p.groundMarkerTimer > 0) p.groundMarkerTimer = Math.max(0, p.groundMarkerTimer - dt);
  if (p.rocketCooldownLeft > 0) p.rocketCooldownLeft = Math.max(0, p.rocketCooldownLeft - dt);

  timeMs = getSimulationTimeMs(state, timeMs);

  if (p.sessionSetupPending) {
    p.vx = 0;
    p.vy = 0;
    p.hasMoveTarget = false;
    p.autoTargetKind = '';
    p.autoTargetId = 0;
    p.selectedKind = '';
    p.selectedId = 0;
    p.abilityA = false;
    p.abilityZ = false;
    p.abilityE = false;
    p.abilityR = false;
    p.interactTap = false;
    p.rocketTap = false;
    tickStatBlock(p.stats, dt);
    return;
  }
  tickFrameGameplay(state, p, dt, timeMs);
  updateAbilityCasting(state, p, dt, timeMs);
  updateForcedTauntTarget(state, p);

  if (p.interactTap) {
    if (isDockLocked(p)) {
      forceUndock(p);
      setPlayerHint(p, 'Désamarré');
    } else {
      if (tryUsePortal(state, p, timeMs)) {
      } else if (requestDockAtNearestStation(state, p)) {
        setPlayerHint(p, 'Amarrage…', 1.3);
      } else {
        setPlayerHint(p, 'Trop loin pour interagir');
      }
    }
  }
  p.interactTap = false;

  if (tickDocking(state, p, dt)) {
    updatePlayerFacing(state, p);
    tickStatBlock(p.stats, dt);
    p.rocketTap = false;
    return;
  }

  if (p.autoTargetId) {
    const t = getTargetForPlayer(state, p, p.autoTargetKind, p.autoTargetId);
    if (!isPlayerAttackable(p, t)) {
      p.autoTargetKind = '';
      p.autoTargetId = 0;
    } else {
      const weapon = getWeaponProfile(p);
      if (!weapon) {
        p.autoTargetKind = '';
        p.autoTargetId = 0;
      } else {
        const aaRange = (weapon.range ?? WEAPON_PULSE_MK1.range) * Math.max(0.5, p.progressionBonuses?.autoRangeMult ?? 1);
        const targetRadius = Math.max(0, t.radius ?? 0);
        const d2 = distSq(p.x, p.y, t.x, t.y);
        const fireRange = aaRange + targetRadius * 0.35;
        if (d2 <= fireRange * fireRange) {
          if (p.hasMoveTarget && p.autoTargetId === t.id && p.autoTargetKind === t.kind) p.hasMoveTarget = false;
          if (!blocksAttacks(p) && timeMs >= p.nextShotAt) fireAutoAttack(state, p, t, timeMs);
        } else if (!blocksVoluntaryMove(p)) {
          const d = Math.max(0.001, Math.sqrt(d2));
          const desired = Math.max(80, aaRange * 0.82 - targetRadius * 0.25);
          const nx = (p.x - t.x) / d;
          const ny = (p.y - t.y) / d;
          p.moveTx = t.x + nx * desired;
          p.moveTy = t.y + ny * desired;
          p.hasMoveTarget = true;
          p.holdMoveAllowed = false;
        }
      }
    }
  }

  const motionOverride = consumeMotionOverride(state, p);
  if (motionOverride?.stopVoluntaryMove) p.hasMoveTarget = false;

  if (motionOverride?.x != null && motionOverride?.y != null) {
    mx = motionOverride.x;
    my = motionOverride.y;
  } else if (!blocksVoluntaryMove(p) && p.hasMoveTarget) {
    const dx = p.moveTx - p.x;
    const dy = p.moveTy - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 14) {
      const n = norm(dx, dy);
      mx = n.x;
      my = n.y;
    } else {
      p.hasMoveTarget = false;
      p.vx = 0;
      p.vy = 0;
    }
  }

  const moveSpeed = (motionOverride?.speed ?? p.engine) * getMoveSpeedMultiplier(p) * getFrameMoveMultiplier(p) * getBastionMoveSpeedMultiplier(p);
  if ((mx * mx + my * my) > 1e-6) {
    const n = norm(mx, my);
    p.vx = n.x * moveSpeed;
    p.vy = n.y * moveSpeed;
    const oldX = p.x;
    const oldY = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    resolveSweptWallMovement(state, p, oldX, oldY);
    resolvePlayerSolidWalls(state, p);
  } else {
    p.vx = 0;
    p.vy = 0;
    resolvePlayerSolidWalls(state, p);
  }

  updatePlayerFacing(state, p);
  tickStatBlock(p.stats, dt);

  if (p.rocketTap) {
    const target = screenToWorld(p, p.mouseSx, p.mouseSy);
    if (blocksAttacks(p)) {
      setPlayerHint(p, 'Roquette indisponible');
    } else if (!blindAllowsPoint(p, target.x, target.y)) {
      setPlayerHint(p, 'Cible hors vision');
    } else {
      const rocketResult = fireRocket(state, p, target.x, target.y, timeMs);
      if (!rocketResult?.ok) {
        if (rocketResult?.reason === 'no_launcher') setPlayerHint(p, 'Aucun lance-roquettes équipé');
        else if (rocketResult?.reason === 'no_ammo' || rocketResult?.reason === 'empty_slot') setPlayerHint(p, 'Aucune roquette chargée');
        else if (rocketResult?.reason === 'energy') setPlayerHint(p, 'Énergie insuffisante');
        else setPlayerHint(p, 'Roquette indisponible');
      }
    }
  }

  p.rocketTap = false;
}
