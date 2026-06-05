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
import { triggerEquipmentProcEvent } from '../equipment/EquipmentProcSystem.js';
import { blocksAbilities, blocksAttacks, blocksVoluntaryMove, consumeMotionOverride, getMoveSpeedMultiplier } from '../status/StatusMotion.js';
import { getStatusEntry } from '../status/StatusRack.js';
import { getFrameAutoAttackProfile, getFrameMoveMultiplier, tickFrameGameplay } from '../frames/FrameGameplayHooks.js';
import { tickPlayerProgression } from '../progression/ProgressionSystem.js';
import { getAbilityInvestedLevel } from '../progression/AbilityInvestment.js';
import { STATUS_EFFECT_IDS } from '../../../../shared/content/status/StatusEffectIds.js';
import { getEquippedEquipmentDefs } from '../equipment/EquipmentBonuses.js';
import { ITEM_CATEGORY_IDS } from '../../../../shared/content/items/ItemCategoryIds.js';
import { buildRocketAmmoStatusSpecs, consumeRocketAmmo, getActiveRocketAmmoDef } from '../rocket/RocketAmmoRules.js';
import { getBastionDamageMultiplier, getBastionMoveSpeedMultiplier } from '../bastion/BastionBuffs.js';
import { distanceSqToStructureRect } from '../structures/StructureSystem.js';
import { findAccessibleStorageNearPlayer } from '../structures/StructureStorage.js';
import { updatePlayerBaseIntrusion } from '../structures/StructureIntrusion.js';
import { queueAbilityProtocolEvent } from '../events/AbilityProtocolEvents.js';

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
  // During the Net V2 rebuild, auto-attack must remain functional even if the
  // full equipment snapshot is temporarily absent or late. Use the basic pulse
  // weapon as a safe server-side fallback instead of disabling auto-attack.
  return getWeaponDef(player)?.weaponProfile || player?.weaponProfile || WEAPON_PULSE_MK1;
}
function getAutoAttackRange(player, weapon) {
  return (weapon?.range ?? WEAPON_PULSE_MK1.range) * Math.max(0.5, player.progressionBonuses?.autoRangeMult ?? 1);
}

function setMoveNearEntity(player, target, desiredRange) {
  if (!target) return false;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const d = Math.hypot(dx, dy);
  if (d <= Math.max(48, desiredRange)) return false;
  const nx = dx / Math.max(0.001, d);
  const ny = dy / Math.max(0.001, d);
  player.moveTx = target.x - nx * Math.max(60, desiredRange * 0.82);
  player.moveTy = target.y - ny * Math.max(60, desiredRange * 0.82);
  player.hasMoveTarget = true;
  player.holdMoveAllowed = false;
  player.groundMarkerX = player.moveTx;
  player.groundMarkerY = player.moveTy;
  player.groundMarkerTimer = 0.65;
  player.moveIntentSeq = (player.moveIntentSeq | 0) + 1;
  player.moveIntentStartedAt = Date.now();
  return true;
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
  const blockers = [...state.asteroids.values(), ...(state.structures?.values?.() || [])];
  for (const wall of blockers) {
    if (wall?.kind === 'structure' && wall?.type !== 'wall' && wall?.type !== 'door') continue;
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
    const blockers = [...state.asteroids.values(), ...(state.structures?.values?.() || [])];
    for (const wall of blockers) {
      if (wall?.kind === 'structure' && wall?.type !== 'wall' && wall?.type !== 'door') continue;
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

  queueWorldSfx(state, SFX_EVENT_TYPES.AUTO_ATTACK, p.sx, p.sy, p.x, p.y, 0, { frameId: p.frameId, sourceKind: 'player' });
}


function inferTauntSourceKind(state, sourceId) {
  const id = sourceId | 0;
  if (!id) return '';
  if (state.players?.has?.(id)) return 'player';
  if (state.mobs?.has?.(id)) return 'mob';
  if (state.asteroids?.has?.(id)) return 'asteroid';
  if (state.structures?.has?.(id)) return 'structure';
  return '';
}

function getTauntSourceRef(state, p) {
  const taunt = getStatusEntry(p, STATUS_EFFECT_IDS.TAUNT);
  if (!taunt) return null;
  const id = (taunt.meta?.sourceTargetId ?? taunt.sourceId ?? 0) | 0;
  const kind = taunt.meta?.sourceKind || inferTauntSourceKind(state, id);
  return kind && id ? { kind, id } : null;
}

function isForcedTauntAttack(state, p, target) {
  const ref = getTauntSourceRef(state, p);
  if (!ref || !target) return false;
  return ref.kind === target.kind && (ref.id | 0) === (target.id | 0);
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
  queueWorldSfx(state, SFX_EVENT_TYPES.ROCKET, p.sx, p.sy, p.x, p.y, fired, { frameId: p.frameId, sourceKind: 'player' });
  return { ok: true, fired, ammoName: ammoDef.shortName || ammoDef.name || 'Rocket' };
}


function updateForcedTauntTarget(state, p, timeMs = 0) {
  const ref = getTauntSourceRef(state, p);
  if (!ref) return;
  const t = getTargetForPlayer(state, p, ref.kind, ref.id);
  if (!isPlayerAttackable(p, t)) return;

  const sameTarget = p.autoTargetKind === ref.kind && (p.autoTargetId | 0) === (ref.id | 0);
  p.selectedKind = ref.kind;
  p.selectedId = ref.id;
  p.autoTargetKind = ref.kind;
  p.autoTargetId = ref.id;
  p.hasMoveTarget = false;
  p.holdMoveAllowed = false;
  p.stationIntentId = 0;
  p.groundMarkerTimer = 0;
  p.rocketTap = false;
  p.abilityA = false;
  p.abilityZ = false;
  p.abilityE = false;
  p.abilityR = false;
  p.clientAuthoritativeUntil = 0;
  p.clientAppliedAbilityPose = null;
  p._activeClientAppliedAbility = null;
  if (Array.isArray(p.pendingAbilityCasts)) p.pendingAbilityCasts.length = 0;
  if (!sameTarget || !Number.isFinite(p.nextShotAt)) p.nextShotAt = Math.min(p.nextShotAt || timeMs, timeMs + 35);
}

function getAbilityRejectReason(player, slot) {
  if (getAbilityInvestedLevel(player, slot) <= 0) return 'not_unlocked';
  const cooldownLeft = Math.max(0, Number(player?.[`cooldown${slot}Left`] || 0));
  if (cooldownLeft > 0.03) return 'cooldown';
  return 'server_refused';
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
  const pending = Array.isArray(player.pendingAbilityCasts) ? player.pendingAbilityCasts.splice(0, player.pendingAbilityCasts.length) : [];
  const requested = [];
  for (const action of pending) {
    requested.push({
      slot: action.slot,
      clientPoseApplied: !!action.clientPoseApplied,
      clientAppliedDash: !!action.clientAppliedDash,
      localAuthorityMs: action.clientAppliedDash ? (Number(action.localAuthorityMs) || 220) : 0,
      dashLine: action.dashLine || null,
      seq: action.seq | 0,
      aimX: action.aimX,
      aimY: action.aimY
    });
  }
  for (const slot of slots) if (consumeAbilityEdge(player, slot)) requested.push({ slot, clientPoseApplied: false, clientAppliedDash: false, seq: 0 });

  for (const req of requested) {
    const slot = req.slot;
    if (!slots.includes(slot)) continue;
    usedAny = true;
    queueAbilityProtocolEvent(player, 'request', slot, {
      seq: req.seq | 0,
      clientPoseApplied: !!req.clientPoseApplied,
      localAuthorityMs: req.localAuthorityMs,
      aimX: req.aimX,
      aimY: req.aimY,
      frameId: player.frameId
    });
    if (locked) {
      setPlayerHint(player, 'Abilities indisponibles en station', 1.2);
      queueAbilityProtocolEvent(player, 'rejected', slot, {
        seq: req.seq | 0,
        reason: 'station_locked',
        cooldownLeft: player[`cooldown${slot}Left`] || 0,
        energyLeft: player.stats?.energy
      });
      continue;
    }
    if (Number.isFinite(req.aimX) && Number.isFinite(req.aimY)) {
      player.mouseSx = req.aimX - player.x + player.viewportW * 0.5;
      player.mouseSy = req.aimY - player.y + player.viewportH * 0.5;
    }
    if (req.clientPoseApplied && req.clientAppliedDash) {
      const localAuthorityMs = Math.max(120, Math.min(360, Number(req.localAuthorityMs) || 220));
      // A dash may briefly override pose, but it must not permanently break a
      // right-mouse hold. The next primaryHold packet will re-arm move target.
      player.hasMoveTarget = false;
      player.holdMoveAllowed = false;
      player.autoTargetKind = '';
      player.autoTargetId = 0;
      player.stationIntentId = 0;
      player.groundMarkerTimer = 0;
      player._activeClientAppliedAbility = {
        slot,
        seq: req.seq | 0,
        until: timeMs + localAuthorityMs,
        dashAlreadyApplied: true,
        dashLine: req.dashLine || null
      };
      player.clientAuthoritativeUntil = Math.max(player.clientAuthoritativeUntil || 0, timeMs + localAuthorityMs);
    } else {
      // Standard projectile/area/buff spells must not clear voluntary movement.
      // Holding right click before/during/after the spell remains the same input
      // stream and observers keep receiving server-simulated pose packets.
      player._activeClientAppliedAbility = null;
    }
    player._activeAbilityRequest = {
      slot,
      seq: req.seq | 0,
      aimX: req.aimX,
      aimY: req.aimY,
      timeMs
    };
    const ok = tryCastAbility(state, player, slot, timeMs);
    player._activeAbilityRequest = null;
    if (ok) {
      queueAbilityProtocolEvent(player, 'accepted', slot, {
        seq: req.seq | 0,
        accepted: true,
        cooldownLeft: player[`cooldown${slot}Left`] || 0,
        energyLeft: player.stats?.energy,
        clientPoseApplied: !!req.clientPoseApplied,
        localAuthorityMs: req.localAuthorityMs,
        frameId: player.frameId
      });
      queueAbilityProtocolEvent(player, 'cooldown', slot, {
        seq: req.seq | 0,
        cooldownLeft: player[`cooldown${slot}Left`] || 0,
        energyLeft: player.stats?.energy,
        frameId: player.frameId
      });
      triggerEquipmentProcEvent(state, player, player, 'abilityCast', { timeMs, sourceSlot: slot });
      player.forceFullUiSnapshot = false;
      player.forceFullUiSnapshotReason = ''; // owner already applied local ability; avoid ping-correction snapshot
      queueWorldSfx(state, SFX_EVENT_TYPES[`ABILITY_${slot}`] || SFX_EVENT_TYPES.AUTO_ATTACK, player.sx, player.sy, player.x, player.y, 0, { frameId: player.frameId, slot, sourceKind: 'player' });
    } else {
      queueAbilityProtocolEvent(player, 'rejected', slot, {
        seq: req.seq | 0,
        reason: req.clientPoseApplied ? `${getAbilityRejectReason(player, slot)}_after_local_pose` : getAbilityRejectReason(player, slot),
        cooldownLeft: player[`cooldown${slot}Left`] || 0,
        energyLeft: player.stats?.energy,
        clientPoseApplied: !!req.clientPoseApplied,
        frameId: player.frameId
      });
      if (req.clientPoseApplied) {
      // Même en cas de refus serveur, renvoyer vite les cooldowns/énergie réels
      // pour que le HUD local sorte d'un état optimiste faux.
      player.forceFullUiSnapshot = false;
      player.forceFullUiSnapshotReason = ''; // do not rollback local-feel on late refusal in permissive prototype mode
      }
    }
    player._activeClientAppliedAbility = null;
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
  updateForcedTauntTarget(state, p, timeMs);

  if (!p.interactTap) tryUsePortal(state, p, timeMs);

  if (p.interactTap) {
    if (isDockLocked(p)) {
      forceUndock(p);
      setPlayerHint(p, 'Désamarré');
    } else {
      if (tryUsePortal(state, p, timeMs)) {
      } else {
        const storage = findAccessibleStorageNearPlayer(state, p);
        if (storage) {
          p.openStorageId = storage.id | 0;
          p.forceFullUiSnapshot = true;
          setPlayerHint(p, 'Coffre ouvert', 1.3);
        } else if (requestDockAtNearestStation(state, p)) {
          setPlayerHint(p, 'Amarrage…', 1.3);
        } else {
        // V87: D loin d'une station sélectionnée = approche automatique, puis dock
        // dès que la portée est atteinte. L'ancien comportement disait juste "trop loin",
        // ce qui rendait l'usage des stations très sec en ligne.
        const selectedStation = p.selectedKind === 'station' ? getTargetForPlayer(state, p, 'station', p.selectedId) : null;
        if (selectedStation && (selectedStation.sx | 0) === (p.sx | 0) && (selectedStation.sy | 0) === (p.sy | 0)) {
          p.stationIntentId = selectedStation.id | 0;
          setMoveNearEntity(p, selectedStation, Math.max(115, (selectedStation.radius || 46) + 98));
          setPlayerHint(p, 'Approche station…', 1.0);
        } else {
          setPlayerHint(p, 'Trop loin pour interagir');
        }
      }
    }
  }
  }
  p.interactTap = false;

  if (!isDockLocked(p) && (p.stationIntentId | 0)) {
    const st = state.stations.get(p.stationIntentId | 0);
    if (!st || (st.sx | 0) !== (p.sx | 0) || (st.sy | 0) !== (p.sy | 0)) {
      p.stationIntentId = 0;
    } else {
      const dockingRange = Math.max(130, (st.radius || 46) + 105);
      if (distSq(p.x, p.y, st.x, st.y) <= dockingRange * dockingRange) {
        p.stationIntentId = 0;
        requestDockAtNearestStation(state, p);
      }
    }
  }

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
        const aaRange = getAutoAttackRange(p, weapon);
        const targetRadius = Math.max(0, t.radius ?? 0);
        const d2 = t.kind === 'structure' ? distanceSqToStructureRect(t, p.x, p.y) : distSq(p.x, p.y, t.x, t.y);
        const fireRange = aaRange + targetRadius * 0.35;
        if (d2 <= fireRange * fireRange) {
          if (p.hasMoveTarget) {
            p.moveIntentSeq = (p.moveIntentSeq | 0) + 1;
            p.moveIntentEndedAt = Date.now();
          }
          p.hasMoveTarget = false;
          if ((!blocksAttacks(p) || isForcedTauntAttack(state, p, t)) && timeMs >= p.nextShotAt) fireAutoAttack(state, p, t, timeMs);
        } else {
          // Target-click hors portée = approche jusqu'à portée, pas tir magique à distance.
          // Un move-click explicite annule l'autoTarget avant d'arriver ici.
          setMoveNearEntity(p, t, Math.max(80, aaRange * 0.82 + targetRadius * 0.20));
        }
      }
    }
  }

  const clientAuthoritative = Number.isFinite(p.clientAuthoritativeUntil) && timeMs <= p.clientAuthoritativeUntil;
  const motionOverride = clientAuthoritative ? null : consumeMotionOverride(state, p);
  if (motionOverride?.stopVoluntaryMove) p.hasMoveTarget = false;

  if (clientAuthoritative) {
    // Le client a déjà appliqué le mouvement de cette frame. Le serveur garde les
    // cooldowns, dégâts, mobs et projectiles, mais ne double-intègre pas le déplacement.
    mx = 0;
    my = 0;
  } else if (motionOverride?.x != null && motionOverride?.y != null) {
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
      if (p.hasMoveTarget) {
        p.moveIntentSeq = (p.moveIntentSeq | 0) + 1;
        p.moveIntentEndedAt = Date.now();
      }
      p.hasMoveTarget = false;
      p.vx = 0;
      p.vy = 0;
    }
  }

  const moveSpeed = (motionOverride?.speed ?? p.engine) * getMoveSpeedMultiplier(p) * getFrameMoveMultiplier(p) * getBastionMoveSpeedMultiplier(p);
  if (clientAuthoritative) {
    resolvePlayerSolidWalls(state, p);
  } else if ((mx * mx + my * my) > 1e-6) {
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
  updatePlayerBaseIntrusion(state, p, timeMs);

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
