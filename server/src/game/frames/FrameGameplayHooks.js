import { SHIP_FRAME_IDS } from '../../../../shared/content/frames/ShipFrameIds.js';
import {
  getVanguardAbilityTuning,
  VANGUARD_PASSIVE
} from '../../../../shared/content/frames/vanguard/VanguardFrameSpec.js';
import {
  getSigilAbilityTuning,
  SIGIL_PASSIVE
} from '../../../../shared/content/frames/sigil/SigilFrameSpec.js';
import {
  getBulwarkAbilityTuning,
  BULWARK_PASSIVE
} from '../../../../shared/content/frames/bulwark/BulwarkFrameSpec.js';
import { WEAPON_PULSE_MK1 } from '../../../../shared/content/combat/WeaponDefs.js';
import { getAbilityInvestedLevel } from '../progression/AbilityInvestment.js';
import { applyStatus, getStatusEntry, hasStatus, removeStatus } from '../status/StatusRack.js';
import { cleanseControlOnly } from '../status/StatusCleanse.js';
import { STATUS_EFFECT_IDS as I } from '../../../../shared/content/status/StatusEffectIds.js';
import { applyDashMove, applyPullMove, blocksDash } from '../status/StatusMotion.js';
import { consumeEnergy, healStatBlock } from '../stats/StatBlockRuntime.js';
import { spawnProjectile } from '../projectile/ProjectileSystem.js';
import { applyDamage } from '../combat/DamageSystem.js';
import { distSq, norm } from '../util/Math.js';
import { getAbilityMouseWorld } from '../abilities/AbilityMouseWorld.js';
import { createAreaEffect } from '../abilities/area/AreaEffectFactory.js';

const VANGUARD_MARK_KEY = 'vanguard_a';
const SIGIL_MARK_KEY = 'sigil_runes';

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function linePointDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 <= 1e-6) return Math.hypot(px - ax, py - ay);
  const t = clamp((apx * abx + apy * aby) / ab2, 0, 1);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

function getFrameStateBag(player) {
  return player?.frameState ?? {};
}

function getVanguardState(player) {
  return getFrameStateBag(player).vanguard ?? null;
}

function getSigilState(player) {
  return getFrameStateBag(player).sigil ?? null;
}

function getBulwarkState(player) {
  return getFrameStateBag(player).bulwark ?? null;
}

function getWeaponReferenceDamage(player) {
  const base = player?.progressionBonuses?.autoAttackBaseDamage ?? WEAPON_PULSE_MK1.damage;
  return base * (player?.progressionBonuses?.damageMult ?? 1);
}

function getCastMouseWorld(player, cast = null) {
  if (cast && Number.isFinite(cast.targetX) && Number.isFinite(cast.targetY)) return { x: cast.targetX, y: cast.targetY };
  return getAbilityMouseWorld(player);
}

function getCooldownKey(slot) {
  return `cooldown${slot}Left`;
}

function beginFrameCast(player, slot, tuning, timeMs) {
  const castTime = Math.max(0, tuning?.castTime ?? 0);
  if (castTime <= 0) return false;
  const key = getCooldownKey(slot);
  if ((player[key] ?? 0) > 0) return true;
  if (!consumeEnergy(player.stats, tuning.energyCost)) return true;
  const world = getAbilityMouseWorld(player);
  player.pendingFrameCast = {
    frameId: player.frameId,
    slot,
    startedAtMs: timeMs,
    resolveAtMs: timeMs + Math.ceil(castTime * 1000),
    targetX: world.x,
    targetY: world.y
  };
  player[key] = tuning.baseCooldown;
  return true;
}

function resolvePendingFrameCast(state, player, timeMs) {
  const cast = player?.pendingFrameCast;
  if (!cast) return;
  if (cast.frameId !== player.frameId || timeMs < (cast.resolveAtMs || 0)) return;
  player.pendingFrameCast = null;
  if (cast.frameId === SHIP_FRAME_IDS.VANGUARD) {
    if (cast.slot === 'A') castVanguardA(state, player, timeMs, { resolvingCast: true, cast });
    else if (cast.slot === 'E') castVanguardE(state, player, timeMs, { resolvingCast: true, cast });
    return;
  }
  if (cast.frameId === SHIP_FRAME_IDS.SIGIL) {
    if (cast.slot === 'A') castSigilA(state, player, timeMs, { resolvingCast: true, cast });
    return;
  }
  if (cast.frameId === SHIP_FRAME_IDS.BULWARK) {
    if (cast.slot === 'Z') castBulwarkZ(state, player, timeMs, { resolvingCast: true, cast });
  }
}

function grantFrameTempShield(player, amount, duration, label = '') {
  if (!player?.stats || amount <= 0 || duration <= 0) return 0;
  if (!Array.isArray(player.frameTempShields)) player.frameTempShields = [];
  player.frameTempShields.push({ amount, left: duration, label });
  return amount;
}

function triggerFramePulse(player, kind, radius = 0, duration = 0.45) {
  const fs = player?.frameState?.[player.frameId];
  if (!fs) return;
  fs.pulseKind = kind || '';
  fs.pulseRadius = Math.max(0, radius || 0);
  fs.pulseLeft = Math.max(fs.pulseLeft || 0, duration);
}

function tickFramePulse(player, dt) {
  const fs = player?.frameState?.[player.frameId];
  if (!fs || (fs.pulseLeft ?? 0) <= 0) return;
  fs.pulseLeft = Math.max(0, fs.pulseLeft - dt);
  if (fs.pulseLeft <= 0) {
    fs.pulseKind = '';
    fs.pulseRadius = 0;
  }
}

function tickFrameTempShields(player, dt) {
  if (!Array.isArray(player.frameTempShields) || player.frameTempShields.length <= 0) return;
  player.frameTempShields = player.frameTempShields
    .map((s) => ({ ...s, left: Math.max(0, (s.left ?? 0) - dt), amount: Math.max(0, s.amount ?? 0) }))
    .filter((s) => s.left > 0 && s.amount > 0);
}

function getBulwarkArmor(player) {
  return Math.max(0, (player?.baseArmor ?? 0) + (player?.frameBonuses?.armorFlat ?? 0));
}

function forEachHostileEntityInSector(state, owner, fn, options = {}) {
  const includeAsteroids = !!options.includeAsteroids;
  for (const target of state.players.values()) {
    if (!target || target.id === owner.id) continue;
    if ((target.sx | 0) !== (owner.sx | 0) || (target.sy | 0) !== (owner.sy | 0)) continue;
    fn(target);
  }
  for (const target of state.mobs.values()) {
    if (!target || (target.stats?.hp ?? 0) <= 0) continue;
    if ((target.sx | 0) !== (owner.sx | 0) || (target.sy | 0) !== (owner.sy | 0)) continue;
    fn(target);
  }
  if (!includeAsteroids) return;
  for (const target of state.asteroids.values()) {
    if (!target || (target.stats?.hp ?? 0) <= 0) continue;
    if ((target.sx | 0) !== (owner.sx | 0) || (target.sy | 0) !== (owner.sy | 0)) continue;
    fn(target);
  }
}

function forEachHostileInRadius(state, owner, x, y, radius, fn, options = {}) {
  const radiusSq = radius * radius;
  forEachHostileEntityInSector(state, owner, (target) => {
    const rr = radius + (target.radius ?? 0);
    if (distSq(x, y, target.x, target.y) <= Math.max(radiusSq, rr * rr)) fn(target);
  }, options);
}

function findClosestHostileInRadius(state, owner, x, y, radius) {
  let best = null;
  let bestD2 = Infinity;
  forEachHostileEntityInSector(state, owner, (target) => {
    const rr = radius + (target.radius ?? 0);
    const d2 = distSq(x, y, target.x, target.y);
    if (d2 > rr * rr) return;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = target;
    }
  });
  return best;
}

function findEntityInStateById(state, id) {
  if (!state || id == null) return null;
  return state.players?.get?.(id) || state.mobs?.get?.(id) || state.asteroids?.get?.(id) || null;
}

function applyFrameArmorPenalty(entity, delta) {
  if (!entity || !Number.isFinite(delta) || delta === 0) return;
  entity.frameArmorPenaltyFlat = Math.max(0, (entity.frameArmorPenaltyFlat || 0) + delta);
}

function ensureBulwarkStormArmorMap(fs) {
  if (!fs.stormArmorById) fs.stormArmorById = Object.create(null);
  return fs.stormArmorById;
}

function getBulwarkStormArmorEntry(fs, targetId) {
  const map = ensureBulwarkStormArmorMap(fs);
  const key = String(targetId);
  if (!map[key]) {
    map[key] = {
      amount: 0,
      outsideLeft: 2.0,
      returnLeft: 0,
      returning: false,
      seenThisTick: false
    };
  }
  return map[key];
}

function normalizeLegacyBulwarkStormArmorMap(fs) {
  if (!fs?.stormArmorById) return;
  for (const [key, value] of Object.entries(fs.stormArmorById)) {
    if (value && typeof value === 'object') continue;
    fs.stormArmorById[key] = {
      amount: Math.max(0, Number(value) || 0),
      outsideLeft: 2.0,
      returnLeft: 0,
      returning: false,
      seenThisTick: false
    };
  }
}

function clearBulwarkStormArmorSteal(state, fs) {
  normalizeLegacyBulwarkStormArmorMap(fs);
  const byId = fs?.stormArmorById || null;
  if (!byId) return;
  for (const [id, entry] of Object.entries(byId)) {
    const amount = typeof entry === 'object' ? entry.amount : entry;
    const target = findEntityInStateById(state, Number(id) || id);
    if (target && amount > 0) applyFrameArmorPenalty(target, -amount);
  }
  fs.stormArmorById = Object.create(null);
  fs.stormArmorStolen = 0;
}

function isTargetInsideBulwarkStorm(owner, target, tuning = null) {
  const fs = getBulwarkState(owner);
  if (!fs || (fs.stormLeft ?? 0) <= 0 || !target) return false;
  const r = tuning || getBulwarkR(owner);
  const radius = Math.max(0, r.stormRadius || 0) + (target.radius ?? 0);
  return distSq(owner.x, owner.y, target.x, target.y) <= radius * radius;
}

function scheduleBulwarkStormArmorReturn(fs) {
  normalizeLegacyBulwarkStormArmorMap(fs);
  const byId = fs?.stormArmorById || null;
  if (!byId) return;
  for (const entry of Object.values(byId)) {
    if (!entry || entry.amount <= 0 || entry.returning) continue;
    entry.seenThisTick = false;
    entry.outsideLeft = Math.min(entry.outsideLeft ?? 2.0, 2.0);
  }
}

function tickBulwarkStormArmorReturns(state, player, fs, dt) {
  normalizeLegacyBulwarkStormArmorMap(fs);
  const byId = fs?.stormArmorById || null;
  if (!byId) return;
  for (const [id, entry] of Object.entries(byId)) {
    if (!entry || entry.amount <= 0) {
      delete byId[id];
      continue;
    }
    if (entry.seenThisTick) {
      entry.seenThisTick = false;
      entry.outsideLeft = 2.0;
      entry.returning = false;
      entry.returnLeft = 0;
      continue;
    }
    if (!entry.returning) {
      entry.outsideLeft = Math.max(0, (entry.outsideLeft ?? 2.0) - dt);
      if (entry.outsideLeft > 0) continue;
      entry.returning = true;
      entry.returnLeft = 2.0;
    }
    const target = findEntityInStateById(state, Number(id) || id);
    const before = entry.amount;
    const release = Math.min(before, before * Math.min(1, dt / Math.max(0.001, entry.returnLeft || 2.0)));
    if (release > 0) {
      if (target) applyFrameArmorPenalty(target, -release);
      entry.amount = Math.max(0, entry.amount - release);
      fs.stormArmorStolen = Math.max(0, (fs.stormArmorStolen || 0) - release);
    }
    entry.returnLeft = Math.max(0, (entry.returnLeft || 0) - dt);
    if (entry.amount <= 0.001 || entry.returnLeft <= 0) {
      if (target && entry.amount > 0) applyFrameArmorPenalty(target, -entry.amount);
      fs.stormArmorStolen = Math.max(0, (fs.stormArmorStolen || 0) - Math.max(0, entry.amount));
      delete byId[id];
    }
  }
}

function getA(player) { return getVanguardAbilityTuning('A', Math.max(1, getAbilityInvestedLevel(player, 'A'))); }
function getZ(player) { return getVanguardAbilityTuning('Z', Math.max(1, getAbilityInvestedLevel(player, 'Z'))); }
function getE(player) { return getVanguardAbilityTuning('E', Math.max(1, getAbilityInvestedLevel(player, 'E'))); }
function getR(player) { return getVanguardAbilityTuning('R', Math.max(1, getAbilityInvestedLevel(player, 'R'))); }
function getSigilA(player) { return getSigilAbilityTuning('A', Math.max(1, getAbilityInvestedLevel(player, 'A'))); }
function getSigilZ(player) { return getSigilAbilityTuning('Z', Math.max(1, getAbilityInvestedLevel(player, 'Z'))); }
function getSigilE(player) { return getSigilAbilityTuning('E', Math.max(1, getAbilityInvestedLevel(player, 'E'))); }
function getSigilR(player) { return getSigilAbilityTuning('R', Math.max(1, getAbilityInvestedLevel(player, 'R'))); }
function getBulwarkA(player) { return getBulwarkAbilityTuning('A', Math.max(1, getAbilityInvestedLevel(player, 'A')), getBulwarkArmor(player)); }
function getBulwarkZ(player) { return getBulwarkAbilityTuning('Z', Math.max(1, getAbilityInvestedLevel(player, 'Z')), getBulwarkArmor(player)); }
function getBulwarkE(player) { return getBulwarkAbilityTuning('E', Math.max(1, getAbilityInvestedLevel(player, 'E')), getBulwarkArmor(player)); }
function getBulwarkR(player) { return getBulwarkAbilityTuning('R', Math.max(1, getAbilityInvestedLevel(player, 'R')), getBulwarkArmor(player)); }

function addVanguardHeat(player, amount, timeMs) {
  const fs = getVanguardState(player);
  if (!fs || amount <= 0) return;
  fs.passiveStacks = clamp(fs.passiveStacks + amount, 0, VANGUARD_PASSIVE.maxStacks);
  fs.passiveLastGainAtMs = timeMs;
  fs.passiveDecayCarry = 0;
}

function hasVanguardMark(target) {
  return !!getStatusEntry(target, I.MARK, { markKey: VANGUARD_MARK_KEY });
}

function applyVanguardMark(source, target, duration, timeMs = Date.now()) {
  return applyStatus(target, I.MARK, duration, {
    sourceId: source.id,
    hostile: true,
    markKey: VANGUARD_MARK_KEY,
    label: 'A',
    timeMs
  });
}

function applyOverheatTenacity(player, tuning, timeMs = Date.now()) {
  const fs = getVanguardState(player);
  if (!fs || fs.passiveStacks < VANGUARD_PASSIVE.maxStacks) return false;
  applyStatus(player, I.TENACITY, tuning.passive.overheatTenacityDuration, {
    sourceId: player.id,
    hostile: false,
    value: tuning.passive.overheatTenacityPct,
    label: 'Surchauffe',
    timeMs
  });
  return true;
}

function getSigilRuneEntry(target) {
  return getStatusEntry(target, I.MARK, { markKey: SIGIL_MARK_KEY });
}

function getSigilRuneCount(target) {
  return getSigilRuneEntry(target)?.stacks ?? 0;
}

function clearSigilRunes(target) {
  removeStatus(target, I.MARK, { markKey: SIGIL_MARK_KEY });
}


function getSigilTargetKey(target) {
  if (!target) return '';
  const kind = target.kind || target.type || 'entity';
  return `${kind}:${target.id ?? target.worldId ?? ''}`;
}

function tickSigilTrailHitCooldowns(fs, dt) {
  const map = fs?.trailHitCooldownById;
  if (!map) return;
  for (const key of Object.keys(map)) {
    map[key] = Math.max(0, (map[key] || 0) - dt);
    if (map[key] <= 0) delete map[key];
  }
}

function canSigilTrailHit(fs, target) {
  const key = getSigilTargetKey(target);
  return key && ((fs?.trailHitCooldownById?.[key] ?? 0) <= 0);
}

function markSigilTrailHit(fs, target, cooldown = 0.35) {
  const key = getSigilTargetKey(target);
  if (!key) return;
  if (!fs.trailHitCooldownById) fs.trailHitCooldownById = Object.create(null);
  fs.trailHitCooldownById[key] = Math.max(0.05, cooldown);
}

function getSigilRuneBonusDamage(owner, tuning, runeCount) {
  const runes = Math.max(0, runeCount | 0);
  if (runes <= 0) return 0;
  return runes * (tuning.passive.runeDamageFlatPerRune + getWeaponReferenceDamage(owner) * tuning.passive.runeDamageWeaponPctPerRune);
}

function applySigilRuneBonusDamage(state, owner, target, tuning, timeMs, sourceSlot = '', runeCountOverride = null) {
  const runeCount = runeCountOverride == null ? getSigilRuneCount(target) : runeCountOverride;
  const bonus = getSigilRuneBonusDamage(owner, tuning, runeCount);
  if (bonus <= 0) return 0;
  applyDamage(state, target, bonus, owner, {
    timeMs,
    sourceSlot,
    visualKind: 'sigil_rune_bonus'
  });
  return bonus;
}

function consumeSigilRunes(target, count) {
  const entry = getSigilRuneEntry(target);
  if (!entry) return 0;
  const current = Math.max(0, entry.stacks ?? 0);
  const spent = Math.min(current, Math.max(0, count | 0));
  const next = current - spent;
  if (next <= 0) clearSigilRunes(target);
  else entry.stacks = next;
  return spent;
}

function applySigilRunes(source, target, tuning, stacks, timeMs) {
  const fs = getSigilState(source);
  const durationMult = fs?.ultLeft > 0 ? (1 + (getSigilR(source).ultRuneDurationBonusPct ?? 0)) : 1;
  const duration = tuning.passive.runeDuration * durationMult;
  applyStatus(target, I.MARK, duration, {
    sourceId: source.id,
    hostile: true,
    markKey: SIGIL_MARK_KEY,
    label: 'Rune',
    stacks,
    maxStacks: tuning.passive.maxRunes,
    timeMs
  });
}

function maybeSlowFromSigilRunes(owner, target, tuning, timeMs) {
  if (getSigilRuneCount(target) < tuning.passive.slowThreshold) return;
  applyStatus(target, I.SLOW, 1.0, {
    sourceId: owner.id,
    hostile: true,
    value: tuning.passive.slowPct,
    label: 'Runes',
    timeMs
  });
}

function maybeDetonateSigilRunes(state, owner, target, timeMs, options = {}) {
  const fs = getSigilState(owner);
  const tuning = getSigilA(owner);
  if (!fs || fs.detonationCooldownLeft > 0) return false;
  const runes = getSigilRuneCount(target);
  if (runes < tuning.passive.detonationThreshold) return false;

  const spent = consumeSigilRunes(target, tuning.passive.detonationConsumeRunes);
  if (spent <= 0) return false;

  const bonus = tuning.passive.detonationBonusFlat
    + getWeaponReferenceDamage(owner) * tuning.passive.detonationBonusWeaponPct
    + Math.max(0, owner.stats?.maxEnergy ?? 0) * tuning.passive.detonationBonusMaxEnergyPct;
  applyDamage(state, target, bonus, owner, { timeMs, sourceSlot: options.sourceSlot || '', visualKind: 'ability' });
  fs.detonationCooldownLeft = tuning.passive.detonationCooldown;

  if (options.applyStasisDuration > 0) {
    applyStatus(target, I.STASIS, options.applyStasisDuration, {
      sourceId: owner.id,
      hostile: true,
      label: 'A',
      timeMs
    });
  }
  if (options.applyStunDuration > 0 && !fs.ultDetonationStunUsed) {
    applyStatus(target, I.STUN, options.applyStunDuration, {
      sourceId: owner.id,
      hostile: true,
      label: 'R',
      timeMs
    });
    fs.ultDetonationStunUsed = true;
  }
  return true;
}

function getBulwarkPlateCount(player) {
  const fs = getBulwarkState(player);
  return fs ? fs.plateDurations.length : 0;
}

function addBulwarkPlate(player) {
  const fs = getBulwarkState(player);
  if (!fs) return false;
  const max = BULWARK_PASSIVE.maxPlates;
  if (fs.plateDurations.length >= max) {
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < fs.plateDurations.length; i += 1) {
      if (fs.plateDurations[i] < best) {
        best = fs.plateDurations[i];
        idx = i;
      }
    }
    fs.plateDurations[idx] = BULWARK_PASSIVE.plateDuration;
    return false;
  }
  fs.plateDurations.push(BULWARK_PASSIVE.plateDuration);
  return true;
}

function grantBulwarkPlateShield(player) {
  if (!player?.stats) return 0;
  const armor = getBulwarkArmor(player);
  const shieldGain = player.stats.maxHp * BULWARK_PASSIVE.plateShieldPctMaxHp + armor * BULWARK_PASSIVE.plateShieldArmorPct;
  return grantFrameTempShield(player, shieldGain, BULWARK_PASSIVE.empoweredDuration, 'Plaques');
}

function consumeBulwarkMaxPlatesForAbility(player) {
  const fs = getBulwarkState(player);
  if (!fs || fs.plateDurations.length < BULWARK_PASSIVE.maxPlates) return false;
  fs.plateDurations = [];
  fs.empoweredLeft = Math.max(fs.empoweredLeft || 0, BULWARK_PASSIVE.empoweredDuration);
  grantBulwarkPlateShield(player);
  return true;
}

function registerBulwarkBurstDamage(player, amount) {
  const fs = getBulwarkState(player);
  if (!fs || amount <= 0 || (fs.breachPlateLockLeft ?? 0) > 0) return false;
  fs.recentDamageWindowLeft = BULWARK_PASSIVE.plateBurstWindow;
  fs.recentDamageTaken = (fs.recentDamageTaken || 0) + amount;
  if (fs.plateGainIcdLeft > 0) return false;
  if (fs.recentDamageTaken < player.stats.maxHp * BULWARK_PASSIVE.plateBurstThresholdPctMaxHp) return false;
  fs.recentDamageTaken = 0;
  fs.plateGainIcdLeft = BULWARK_PASSIVE.plateGainInternalCooldown;
  return addBulwarkPlate(player);
}

function tickBulwarkPlates(player, dt) {
  const fs = getBulwarkState(player);
  if (!fs) return;
  if (fs.plateGainIcdLeft > 0) fs.plateGainIcdLeft = Math.max(0, fs.plateGainIcdLeft - dt);
  if (fs.empoweredLeft > 0) fs.empoweredLeft = Math.max(0, fs.empoweredLeft - dt);
  if (fs.recentDamageWindowLeft > 0) {
    fs.recentDamageWindowLeft = Math.max(0, fs.recentDamageWindowLeft - dt);
    if (fs.recentDamageWindowLeft <= 0) fs.recentDamageTaken = 0;
  }
  if (!fs.plateDurations.length) return;
  fs.plateDurations = fs.plateDurations.map((v) => Math.max(0, v - dt)).filter((v) => v > 0);
}

function updateFrameBonuses(player) {
  if (!player.frameBonuses) player.frameBonuses = {};

  if (player.frameId === SHIP_FRAME_IDS.VANGUARD) {
    const fs = getVanguardState(player);
    const ult = getR(player);
    const z = getZ(player);
    const stacks = fs?.passiveStacks ?? 0;
    player.frameBonuses = {
      moveHaste: stacks * VANGUARD_PASSIVE.moveSpeedPerStack + (fs?.moveBoostLeft > 0 ? z.moveBoostPct : 0) + (fs?.ultLeft > 0 ? ult.ultMoveSpeedPct : 0),
      slowResist: (player.progressionBonuses?.slowResist ?? 0) + stacks * VANGUARD_PASSIVE.slowResistPerStack,
      tenacity: (player.progressionBonuses?.tenacity ?? 0) + (stacks >= 6 ? VANGUARD_PASSIVE.tenacityAtSixPct : 0),
      attackSpeed: stacks * VANGUARD_PASSIVE.attackSpeedPerStack + (fs?.ultLeft > 0 ? ult.ultAttackSpeedPct : 0),
      ultEmpowerPct: 0,
      outgoingDamageMult: fs?.ultLeft > 0 ? (1 + ult.ultEmpowerPct) : 1,
      incomingDamageReductionPct: fs?.phaseLeft > 0 ? getE(player).damageReductionPct : 0,
      armorFlat: 0
    };
    return;
  }

  if (player.frameId === SHIP_FRAME_IDS.SIGIL) {
    player.frameBonuses = {
      moveHaste: 0,
      slowResist: player.progressionBonuses?.slowResist ?? 0,
      tenacity: player.progressionBonuses?.tenacity ?? 0,
      attackSpeed: 0,
      ultEmpowerPct: 0,
      incomingDamageReductionPct: 0,
      outgoingDamageMult: 1,
      armorFlat: 0
    };
    return;
  }

  if (player.frameId === SHIP_FRAME_IDS.BULWARK) {
    const fs = getBulwarkState(player);
    const plates = getBulwarkPlateCount(player);
    const anchor = getBulwarkA(player);
    const meditation = getBulwarkE(player);
    player.frameBonuses = {
      moveHaste: -(fs?.anchorLeft > 0 ? anchor.anchorSelfSlowPct : 0) - (fs?.meditationLeft > 0 ? meditation.meditationSelfSlowPct : 0),
      slowResist: player.progressionBonuses?.slowResist ?? 0,
      tenacity: (player.progressionBonuses?.tenacity ?? 0) + plates * BULWARK_PASSIVE.plateTenacityPerPlate - (fs?.breachLeft > 0 ? 0.50 : 0),
      attackSpeed: 0,
      ultEmpowerPct: 0,
      outgoingDamageMult: 1,
      incomingDamageReductionPct: plates * BULWARK_PASSIVE.plateDamageReductionPerPlate
        + (fs?.anchorLeft > 0 ? anchor.anchorDamageReductionPct : 0)
        + (fs?.meditationLeft > 0 ? meditation.meditationDamageReductionPct : 0),
      armorFlat: plates * BULWARK_PASSIVE.plateArmorPerPlate
        + (fs?.anchorLeft > 0 ? fs.anchorArmorFlat : 0)
        + (fs?.stormArmorStolen ?? 0)
        - (fs?.breachLeft > 0 ? Math.max(0, player.baseArmor ?? 0) * 0.45 : 0)
    };
    return;
  }

  player.frameBonuses = {};
}

function tickVanguardTrail(state, player, dt, timeMs) {
  const fs = getVanguardState(player);
  if (!fs || fs.trailLeft <= 0) return;
  fs.trailLeft = Math.max(0, fs.trailLeft - dt);
  if (fs.trailLeft <= 0 || fs.trailSlowPct <= 0 || fs.trailSlowDuration <= 0) return;

  forEachHostileEntityInSector(state, player, (target) => {
    const rr = 20 + (target.radius ?? 0);
    if (linePointDistance(target.x, target.y, fs.trailStartX, fs.trailStartY, fs.trailEndX, fs.trailEndY) > rr) return;
    applyStatus(target, I.SLOW, fs.trailSlowDuration, {
      sourceId: player.id,
      hostile: true,
      value: fs.trailSlowPct,
      label: 'Z',
      timeMs
    });
  });
}

function handleInertialPhaseExit(state, player, timeMs) {
  const fs = getVanguardState(player);
  if (!fs) return;
  const tuning = getE(player);
  if (tuning.spellShieldDuration > 0) {
    applyStatus(player, I.SPELL_SHIELD, tuning.spellShieldDuration, {
      sourceId: player.id,
      hostile: false,
      label: 'E',
      timeMs
    });
  }
  if (tuning.exitShieldPctMaxShield > 0) {
    grantFrameTempShield(player, player.stats.maxShield * tuning.exitShieldPctMaxShield, 4.0, 'E');
  }
  triggerFramePulse(player, 'vanguard_phase_exit', tuning.exitRadius || 90, 0.42);
  let hits = 0;
  if (tuning.exitRadius > 0 && tuning.groundedDuration > 0) {
    forEachHostileInRadius(state, player, player.x, player.y, tuning.exitRadius, (target) => {
      applyStatus(target, I.GROUNDED, tuning.groundedDuration, {
        sourceId: player.id,
        hostile: true,
        label: 'E',
        timeMs
      });
      hits += 1;
    });
  }
  if (hits > 0) addVanguardHeat(player, hits, timeMs);
  if (tuning.restoreAChargeOnMaxHeat && fs.phaseStartedAtMaxHeat) {
    const a = getA(player);
    fs.empowerPct = a.empowerPct;
    fs.empowerFlat = a.empowerFlat;
    const maxEmpoweredCharges = Math.max(1, Math.min(5, a.empowerCharges | 0));
    fs.empoweredMaxCharges = maxEmpoweredCharges;
    fs.empoweredCharges = Math.min(maxEmpoweredCharges, (fs.empoweredCharges | 0) + 1);
  }
  fs.phaseStartedAtMaxHeat = false;
}

function tickVanguard(state, player, dt, timeMs) {
  const fs = getVanguardState(player);
  if (!fs) return;

  if (fs.moveBoostLeft > 0) fs.moveBoostLeft = Math.max(0, fs.moveBoostLeft - dt);
  if (fs.comboWindowLeft > 0) fs.comboWindowLeft = Math.max(0, fs.comboWindowLeft - dt);
  if (fs.ultLeft > 0) fs.ultLeft = Math.max(0, fs.ultLeft - dt);

  if (fs.phaseLeft > 0) {
    const wasActive = fs.phaseLeft > 0;
    fs.phaseLeft = Math.max(0, fs.phaseLeft - dt);
    if (wasActive && fs.phaseLeft <= 0) handleInertialPhaseExit(state, player, timeMs);
  }

  tickVanguardTrail(state, player, dt, timeMs);

  if (fs.passiveStacks > 0) {
    if ((timeMs - fs.passiveLastGainAtMs) > VANGUARD_PASSIVE.stackDuration * 1000) {
      fs.passiveDecayCarry += dt;
      const lose = Math.floor(fs.passiveDecayCarry / VANGUARD_PASSIVE.decayInterval);
      if (lose > 0) {
        fs.passiveStacks = Math.max(0, fs.passiveStacks - lose);
        fs.passiveDecayCarry -= lose * VANGUARD_PASSIVE.decayInterval;
      }
    } else {
      fs.passiveDecayCarry = 0;
    }
  } else {
    fs.passiveDecayCarry = 0;
  }

  updateFrameBonuses(player);
}

function tickSigilTrail(state, player, dt, timeMs) {
  const fs = getSigilState(player);
  if (!fs) return;
  tickSigilTrailHitCooldowns(fs, dt);

  if (fs.trailLeft <= 0) {
    fs.trailHitCooldownById = Object.create(null);
    return;
  }

  fs.trailLeft = Math.max(0, fs.trailLeft - dt);
  if (fs.trailLeft <= 0) {
    fs.trailHitCooldownById = Object.create(null);
    return;
  }

  const a = getSigilA(player);
  const e = getSigilE(player);
  const r = getSigilR(player);
  const trailWidth = Math.max(24, e.eTrailWidth ?? 34);

  forEachHostileEntityInSector(state, player, (target) => {
    if (!canSigilTrailHit(fs, target)) return;
    const rr = trailWidth + (target.radius ?? 0);
    if (linePointDistance(target.x, target.y, fs.trailStartX, fs.trailStartY, fs.trailEndX, fs.trailEndY) > rr) return;

    const runesBefore = getSigilRuneCount(target);
    applySigilRuneBonusDamage(state, player, target, a, timeMs, 'E', runesBefore);

    if (fs.trailSlowPct > 0 && fs.trailSlowDuration > 0) {
      applyStatus(target, I.SLOW, fs.trailSlowDuration, {
        sourceId: player.id,
        hostile: true,
        value: fs.trailSlowPct,
        label: 'E',
        timeMs
      });
    }

    if (e.eGroundedDurationOnMaxRunes > 0 && runesBefore >= a.passive.maxRunes) {
      applyStatus(target, I.GROUNDED, e.eGroundedDurationOnMaxRunes, {
        sourceId: player.id,
        hostile: true,
        label: 'E',
        timeMs
      });
    }

    applySigilRunes(player, target, a, 1, timeMs);
    maybeSlowFromSigilRunes(player, target, a, timeMs);
    maybeDetonateSigilRunes(state, player, target, timeMs, {
      sourceSlot: 'E',
      applyStunDuration: fs.ultLeft > 0 ? r.ultDetonationStunDuration : 0
    });
    markSigilTrailHit(fs, target, 0.35);
  }, { includeAsteroids: true });
}

function tickSigil(state, player, dt, timeMs) {
  const fs = getSigilState(player);
  if (!fs) return;

  if (fs.detonationCooldownLeft > 0) fs.detonationCooldownLeft = Math.max(0, fs.detonationCooldownLeft - dt);
  if (fs.veilLeft > 0) {
    const was = fs.veilLeft;
    fs.veilLeft = Math.max(0, fs.veilLeft - dt);
    if (was > 0 && fs.veilLeft <= 0) {
      const tuning = getSigilE(player);
      if (tuning.eSpellShieldOnEndDuration > 0) {
        applyStatus(player, I.SPELL_SHIELD, tuning.eSpellShieldOnEndDuration, {
          sourceId: player.id,
          hostile: false,
          label: 'E',
          timeMs
        });
      }
    }
  }
  if (fs.ultLeft > 0) fs.ultLeft = Math.max(0, fs.ultLeft - dt);

  if (fs.zoneEffectId && !state.areaEffects.has(fs.zoneEffectId)) fs.zoneEffectId = 0;
  tickSigilTrail(state, player, dt, timeMs);

  if (fs.zoneCamouflagePulseLeft > 0) fs.zoneCamouflagePulseLeft = Math.max(0, fs.zoneCamouflagePulseLeft - dt);

  updateFrameBonuses(player);
}


function applyBulwarkAnchorPulse(state, player, tuning, timeMs, label = 'A') {
  if (!tuning?.anchorPulseRadius || !tuning?.anchorPulseSlowPct) return;
  triggerFramePulse(player, label === 'A-end' ? 'bulwark_anchor_exit' : 'bulwark_anchor', tuning.anchorPulseRadius, 0.46);
  forEachHostileInRadius(state, player, player.x, player.y, tuning.anchorPulseRadius, (target) => {
    applyStatus(target, I.SLOW, tuning.anchorPulseSlowDuration, {
      sourceId: player.id,
      hostile: true,
      value: tuning.anchorPulseSlowPct,
      label: 'A',
      timeMs
    });
  });
}

function resolveBulwarkStormTick(state, player, timeMs) {
  const fs = getBulwarkState(player);
  if (!fs || fs.stormLeft <= 0) return;
  const tuning = getBulwarkR(player);
  const tickEvery = 0.5;
  normalizeLegacyBulwarkStormArmorMap(fs);
  for (const entry of Object.values(fs.stormArmorById || {})) {
    if (entry) entry.seenThisTick = false;
  }
  const dmgPerSec = tuning.stormBaseDpsFlat + getWeaponReferenceDamage(player) * tuning.stormBaseDpsPct;
  const damage = dmgPerSec * tickEvery;
  forEachHostileInRadius(state, player, player.x, player.y, tuning.stormRadius, (target) => {
    applyDamage(state, target, damage, player, { timeMs });
    applyStatus(target, I.SLOW, tickEvery + 0.2, {
      sourceId: player.id,
      hostile: true,
      value: tuning.stormSlowPct,
      label: 'R',
      timeMs
    });
    if (tuning.stormCentralGroundedDuration > 0) {
      const inner = tuning.stormInnerRadius + (target.radius ?? 0);
      if (distSq(player.x, player.y, target.x, target.y) <= inner * inner) {
        applyStatus(target, I.GROUNDED, tickEvery + 0.15, {
          sourceId: player.id,
          hostile: true,
          label: 'R',
          timeMs
        });
      }
    }
    if (tuning.stormArmorStealPerSecond > 0) {
      const entry = getBulwarkStormArmorEntry(fs, target.id);
      entry.seenThisTick = true;
      entry.outsideLeft = 2.0;
      entry.returning = false;
      entry.returnLeft = 0;
      const perTick = tuning.stormArmorStealPerSecond * tickEvery;
      const gain = Math.max(0, Math.min(perTick, (tuning.stormStealCap || 0) - entry.amount));
      if (gain > 0) {
        entry.amount += gain;
        fs.stormArmorStolen = (fs.stormArmorStolen || 0) + gain;
        applyFrameArmorPenalty(target, gain);
      }
    }
    if (hasStatus(target, I.TAUNT) && tuning.stormTauntedDamageAmpPct > 0) {
      applyStatus(target, I.DAMAGE_AMP, tickEvery + 0.2, {
        sourceId: player.id,
        hostile: true,
        value: tuning.stormTauntedDamageAmpPct,
        label: 'R',
        timeMs
      });
    }
    if (tuning.stormExposureStunThreshold > 0) {
      fs.stormExposureById[target.id] = (fs.stormExposureById[target.id] ?? 0) + tickEvery;
      if (fs.stormExposureById[target.id] >= tuning.stormExposureStunThreshold) {
        fs.stormExposureById[target.id] = 0;
        applyStatus(target, I.STUN, tuning.stormExposureStunDuration, {
          sourceId: player.id,
          hostile: true,
          label: 'R',
          timeMs
        });
      }
    }
  });
}

function tickBulwark(state, player, dt, timeMs) {
  const fs = getBulwarkState(player);
  if (!fs) return;

  tickBulwarkPlates(player, dt);
  if (fs.harpoonHasteLeft > 0) fs.harpoonHasteLeft = Math.max(0, fs.harpoonHasteLeft - dt);
  if (fs.harpoonUnitPhaseLeft > 0) fs.harpoonUnitPhaseLeft = Math.max(0, fs.harpoonUnitPhaseLeft - dt);
  if (fs.breachLeft > 0) fs.breachLeft = Math.max(0, fs.breachLeft - dt);
  if (fs.breachPlateLockLeft > 0) fs.breachPlateLockLeft = Math.max(0, fs.breachPlateLockLeft - dt);

  if (fs.anchorLeft > 0) {
    const prev = fs.anchorLeft;
    fs.anchorLeft = Math.max(0, fs.anchorLeft - dt);
    if (prev > 0 && fs.anchorLeft <= 0) applyBulwarkAnchorPulse(state, player, getBulwarkA(player), timeMs, 'A-end');
  }

  if (fs.meditationLeft > 0) {
    const tuning = getBulwarkE(player);
    const missing = Math.max(0, player.stats.maxHp - player.stats.hp);
    if (missing > 0 && tuning.meditationHealMissingPctPerSecond > 0) {
      healStatBlock(player.stats, missing * tuning.meditationHealMissingPctPerSecond * dt);
    }
    if (tuning.meditationPulseRadius > 0 && tuning.meditationFinalSlowPct > 0) {
      fs.meditationPulseTickLeft = Math.max(0, (fs.meditationPulseTickLeft || 0.85) - dt);
      while (fs.meditationPulseTickLeft <= 0 && fs.meditationLeft > 0) {
        forEachHostileInRadius(state, player, player.x, player.y, tuning.meditationPulseRadius, (target) => {
          applyStatus(target, I.SLOW, tuning.meditationFinalSlowDuration, {
            sourceId: player.id,
            hostile: true,
            value: tuning.meditationFinalSlowPct,
            label: 'E',
            timeMs
          });
        });
        fs.meditationPulseTickLeft += 0.85;
      }
    }
    const prev = fs.meditationLeft;
    fs.meditationLeft = Math.max(0, fs.meditationLeft - dt);
    if (prev > 0 && fs.meditationLeft <= 0) {
      const armor = getBulwarkArmor(player);
      const shieldGain = player.stats.maxHp * tuning.meditationShieldPctMaxHp + armor * tuning.meditationShieldArmorPct;
      grantFrameTempShield(player, shieldGain, 4.0, 'E');
      triggerFramePulse(player, 'bulwark_meditation_exit', tuning.meditationPulseRadius || 180, 0.50);
      if (tuning.meditationPulseRadius > 0 && tuning.meditationFinalSlowPct > 0) {
        forEachHostileInRadius(state, player, player.x, player.y, tuning.meditationPulseRadius, (target) => {
          applyStatus(target, I.SLOW, tuning.meditationFinalSlowDuration, {
            sourceId: player.id,
            hostile: true,
            value: tuning.meditationFinalSlowPct,
            label: 'E',
            timeMs
          });
          if (tuning.meditationFinalGroundedDuration > 0) {
            applyStatus(target, I.GROUNDED, tuning.meditationFinalGroundedDuration, {
              sourceId: player.id,
              hostile: true,
              label: 'E',
              timeMs
            });
          }
        });
      }
    }
  }

  if (fs.stormLeft > 0) {
    fs.stormLeft = Math.max(0, fs.stormLeft - dt);
    fs.stormTickLeft = Math.max(0, fs.stormTickLeft - dt);
    while (fs.stormTickLeft <= 0 && fs.stormLeft > 0) {
      resolveBulwarkStormTick(state, player, timeMs);
      fs.stormTickLeft += 0.5;
    }
    const stormTuning = getBulwarkR(player);
    if (stormTuning.stormShieldGainPctMaxShieldPerTick > 0) {
      fs.stormShieldTickLeft = Math.max(0, fs.stormShieldTickLeft - dt);
      while (fs.stormShieldTickLeft <= 0 && fs.stormLeft > 0) {
        const cap = player.stats.maxHp * (stormTuning.stormShieldGainCapPctMaxShield || 0);
        const gain = Math.min(player.stats.maxHp * stormTuning.stormShieldGainPctMaxShieldPerTick, Math.max(0, cap - (fs.stormShieldGained || 0)));
        if (gain > 0) {
          grantFrameTempShield(player, gain, Math.max(0.5, fs.stormLeft || 0.5), 'R');
          fs.stormShieldGained = (fs.stormShieldGained || 0) + gain;
        }
        fs.stormShieldTickLeft += Math.max(0.1, stormTuning.stormShieldGainTickInterval || 1.2);
      }
    }
    if (getBulwarkR(player).stormPullInterval > 0) {
      fs.stormPullTickLeft = Math.max(0, fs.stormPullTickLeft - dt);
      while (fs.stormPullTickLeft <= 0 && fs.stormLeft > 0) {
        const tuning = getBulwarkR(player);
        forEachHostileInRadius(state, player, player.x, player.y, tuning.stormRadius, (target) => {
          if (distSq(player.x, player.y, target.x, target.y) < tuning.stormInnerRadius * tuning.stormInnerRadius) return;
          applyPullMove(target, player, tuning.stormPullWindow, tuning.stormPullStrength);
        });
        fs.stormPullTickLeft += tuning.stormPullInterval;
      }
    }
  } else {
    fs.stormExposureById = Object.create(null);
    if (!fs.stormReturnScheduled && Object.keys(fs.stormArmorById || {}).length > 0) {
      scheduleBulwarkStormArmorReturn(fs);
      fs.stormReturnScheduled = true;
    }
    fs.stormShieldGained = 0;
  }

  tickBulwarkStormArmorReturns(state, player, fs, dt);
  if ((fs.stormLeft || 0) > 0) fs.stormReturnScheduled = false;

  updateFrameBonuses(player);
}

export function tickFrameGameplay(state, player, dt, timeMs) {
  tickFrameTempShields(player, dt);
  tickFramePulse(player, dt);
  resolvePendingFrameCast(state, player, timeMs);
  if (player.frameId === SHIP_FRAME_IDS.VANGUARD) return tickVanguard(state, player, dt, timeMs);
  if (player.frameId === SHIP_FRAME_IDS.SIGIL) return tickSigil(state, player, dt, timeMs);
  if (player.frameId === SHIP_FRAME_IDS.BULWARK) return tickBulwark(state, player, dt, timeMs);
  if (player.frameBonuses && Object.keys(player.frameBonuses).length) player.frameBonuses = {};
}

export function getFrameAutoAttackProfile(player, options = {}) {
  const defaultProfile = {
    cooldownMult: Math.max(0.15, player.progressionBonuses?.fireRateMult ?? 1),
    damage: getWeaponReferenceDamage(player),
    projectileSpeed: WEAPON_PULSE_MK1.projectileSpeed,
    extras: { sourceAbilitySlot: -1, autoAttackImpactRoll: true, sourceFrameId: player.frameId }
  };

  if (player.frameId === SHIP_FRAME_IDS.VANGUARD) {
    const fs = getVanguardState(player);
    const baseDamage = getWeaponReferenceDamage(player);
    let damage = baseDamage;
    let empoweredUsed = false;

    if (fs?.empoweredCharges > 0) {
      damage += baseDamage * fs.empowerPct + fs.empowerFlat;
      if (!options.peekOnly) fs.empoweredCharges = Math.max(0, fs.empoweredCharges - 1);
      empoweredUsed = true;
    }
    return {
      cooldownMult: Math.max(0.15, (player.progressionBonuses?.fireRateMult ?? 1) * (1 + (player.frameBonuses?.attackSpeed ?? 0))),
      damage,
      projectileSpeed: WEAPON_PULSE_MK1.projectileSpeed,
      extras: {
        sourceAbilitySlot: -1,
        autoAttackImpactRoll: true,
        empoweredAutoUsed: empoweredUsed,
        ultAutoUsed: (fs?.ultLeft ?? 0) > 0,
        sourceFrameId: player.frameId
      }
    };
  }

  if (player.frameId === SHIP_FRAME_IDS.SIGIL) {
    return {
      cooldownMult: Math.max(0.15, player.progressionBonuses?.fireRateMult ?? 1),
      damage: getWeaponReferenceDamage(player),
      projectileSpeed: WEAPON_PULSE_MK1.projectileSpeed,
      extras: { sourceAbilitySlot: -1, autoAttackImpactRoll: true, sourceFrameId: player.frameId }
    };
  }

  if (player.frameId === SHIP_FRAME_IDS.BULWARK) {
    const fs = getBulwarkState(player);
    const armor = getBulwarkArmor(player);
    const passive = BULWARK_PASSIVE;
    const empowered = (fs?.empoweredLeft ?? 0) > 0;
    const conversionBoost = (fs?.anchorLeft ?? 0) > 0 ? 1.5 : 1;
    const pct = (empowered ? passive.empoweredArmorToAttackDamagePct : passive.armorToAttackDamagePct) * conversionBoost;
    const damage = getWeaponReferenceDamage(player) + armor * pct;
    return {
      cooldownMult: Math.max(0.15, player.progressionBonuses?.fireRateMult ?? 1),
      damage,
      projectileSpeed: WEAPON_PULSE_MK1.projectileSpeed,
      extras: { sourceAbilitySlot: -1, autoAttackImpactRoll: true, sourceFrameId: player.frameId, bulwarkEmpowered: empowered, armorUsed: armor }
    };
  }

  return defaultProfile;
}

export function getFrameMoveMultiplier(player) {
  if (player.frameId === SHIP_FRAME_IDS.VANGUARD) return 1 + (player.frameBonuses?.moveHaste ?? 0);
  if (player.frameId === SHIP_FRAME_IDS.BULWARK) return Math.max(0.25, 1 + (player.frameBonuses?.moveHaste ?? 0));
  return 1;
}

export function adjustIncomingDamageByFrame(target, amount) {
  let adjusted = amount;
  const reduction = target?.frameBonuses?.incomingDamageReductionPct ?? 0;
  if (reduction > 0) adjusted *= Math.max(0, 1 - reduction);

  if (target?.frameId === SHIP_FRAME_IDS.BULWARK) {
    const fs = getBulwarkState(target);
    if (fs?.anchorLeft > 0) {
      const tuning = getBulwarkA(target);
      if (tuning.anchorSingleHitCapPctMaxHp > 0) adjusted = Math.min(adjusted, target.stats.maxHp * tuning.anchorSingleHitCapPctMaxHp);
    }
    if (fs?.meditationLeft > 0) {
      const tuning = getBulwarkE(target);
      if (tuning.phase >= 5) adjusted = Math.min(adjusted, target.stats.maxHp * 0.16);
    }
  }

  return adjusted;
}

export function onDamageTakenByFrame(state, target, amount, sourcePlayer, timeMs, options = {}) {
  if (!target || target.frameId !== SHIP_FRAME_IDS.BULWARK) return;
  const fs = getBulwarkState(target);
  if (!fs) return;

  if (!options.isReflected) registerBulwarkBurstDamage(target, amount);

  if (!options.isReflected && fs.anchorLeft > 0 && sourcePlayer) {
    const tuning = getBulwarkA(target);
    const reflected = clamp(amount * tuning.anchorReflectPct, tuning.anchorReflectMinDamage, tuning.anchorReflectMaxDamage);
    if (reflected > 0) applyDamage(state, sourcePlayer, reflected, target, { timeMs, isReflected: true });
    if (tuning.anchorPulseRadius > 0 && tuning.anchorPulseSlowPct > 0) {
      forEachHostileInRadius(state, target, target.x, target.y, tuning.anchorPulseRadius, (entity) => {
        applyStatus(entity, I.SLOW, tuning.anchorPulseSlowDuration, {
          sourceId: target.id,
          hostile: true,
          value: tuning.anchorPulseSlowPct,
          label: 'A',
          timeMs
        });
      });
    }
  }
}

export function onEntityKilledByFrame(state, killer, victim) {
  if (!killer || killer.frameId !== SHIP_FRAME_IDS.VANGUARD) return;
  const fs = getVanguardState(killer);
  if (!fs || fs.ultLeft <= 0) return;
  const tuning = getR(killer);
  if (tuning.extensionDuration <= 0 || tuning.extensionMaxBonusDuration <= 0) return;
  const grant = Math.min(tuning.extensionDuration, tuning.extensionMaxBonusDuration - fs.ultBonusDurationGained);
  if (grant <= 0) return;
  fs.ultBonusDurationGained += grant;
  fs.ultLeft += grant;
}

function handleVanguardProjectileImpact(state, owner, target, projectile, timeMs) {
  const fs = getVanguardState(owner);
  if (!fs) return;

  if (projectile.autoAttackImpactRoll || (projectile.sourceAbilitySlot != null && projectile.sourceAbilitySlot !== -1)) addVanguardHeat(owner, 1, timeMs);

  if (projectile.sourceAbilitySlot === -1) {
    const r = getR(owner);
    if (fs.ultLeft > 0 && r.ultBurnDuration > 0 && hasVanguardMark(target)) {
      const totalBurn = r.ultBurnFlat + r.ultBurnWeaponPct * getWeaponReferenceDamage(owner);
      applyStatus(target, I.BURN, r.ultBurnDuration, {
        sourceId: owner.id,
        hostile: true,
        periodicDamage: totalBurn / Math.max(0.1, r.ultBurnDuration),
        tickEvery: 1,
        label: 'R',
        timeMs
      });
    }
    if (fs.ultLeft > 0 && r.ultCloseEnergyRestore > 0) {
      const rr = r.ultCloseEnergyRange + (target.radius ?? 0);
      if (distSq(owner.x, owner.y, target.x, target.y) <= rr * rr) {
        owner.stats.energy = Math.min(owner.stats.maxEnergy, owner.stats.energy + r.ultCloseEnergyRestore);
      }
    }
    return;
  }

  if (projectile.sourceAbilitySlot !== 'A') return;
  const a = getA(owner);
  const targetHadAmp = hasStatus(target, I.DAMAGE_AMP);
  if (a.refundEnergyOnCrowdControlledTarget > 0 && (hasStatus(target, I.SLOW) || hasStatus(target, I.GROUNDED))) {
    owner.stats.energy = Math.min(owner.stats.maxEnergy, owner.stats.energy + a.refundEnergyOnCrowdControlledTarget);
  }
  applyVanguardMark(owner, target, Math.max(2.0, a.damageAmpDuration), timeMs);
  if (a.damageAmpDuration > 0 && a.damageAmpPct > 0) {
    applyStatus(target, I.DAMAGE_AMP, a.damageAmpDuration, {
      sourceId: owner.id,
      hostile: true,
      value: a.damageAmpPct,
      label: 'A',
      timeMs
    });
  }
  const r = getR(owner);
  if (fs.ultLeft > 0 && r.ultCloseAStunDuration > 0) {
    const rr = r.ultCloseAStunRange + (target.radius ?? 0);
    if (distSq(owner.x, owner.y, target.x, target.y) <= rr * rr) {
      applyStatus(target, I.STUN, r.ultCloseAStunDuration, {
        sourceId: owner.id,
        hostile: true,
        label: 'R+A',
        timeMs
      });
    }
  }
  if (targetHadAmp && a.disarmDuration > 0) {
    applyStatus(target, I.DISARM, a.disarmDuration, {
      sourceId: owner.id,
      hostile: true,
      label: 'A',
      timeMs
    });
  }
  if (projectile.linkedAbilitySynergyActive) {
    const z = getZ(owner);
    if (z.cooldownRefundPct > 0) owner.cooldownZLeft = Math.max(0.45, owner.cooldownZLeft * (1 - z.cooldownRefundPct));
  }
}

function handleSigilProjectileImpact(state, owner, target, projectile, timeMs) {
  const fs = getSigilState(owner);
  if (!fs) return;
  const a = getSigilA(owner);
  const r = getSigilR(owner);
  const runesBefore = getSigilRuneCount(target);

  if (runesBefore > 0) {
    applySigilRuneBonusDamage(state, owner, target, a, timeMs, projectile.sourceAbilitySlot || '', runesBefore);
    maybeSlowFromSigilRunes(owner, target, a, timeMs);
  }

  if (projectile.sourceAbilitySlot !== 'A') {
    if (projectile.sourceAbilitySlot === -1) {
      applySigilRunes(owner, target, a, 1, timeMs);
      maybeSlowFromSigilRunes(owner, target, a, timeMs);
    }
    return;
  }

  const hadRevealRunes = a.aRevealThreshold > 0 && runesBefore >= a.aRevealThreshold;
  const hadHealCutRunes = a.aHealCutThreshold > 0 && runesBefore >= a.aHealCutThreshold;
  applySigilRunes(owner, target, a, a.aImpactRunes, timeMs);
  const runesAfter = getSigilRuneCount(target);
  if (hadRevealRunes) {
    applyStatus(target, I.REVEAL, a.aRevealDuration, {
      sourceId: owner.id,
      hostile: true,
      label: 'A',
      timeMs
    });
  }
  if (hadHealCutRunes) {
    applyStatus(target, I.HEAL_CUT, a.aHealCutDuration, {
      sourceId: owner.id,
      hostile: true,
      value: a.aHealCutPct,
      label: 'A',
      timeMs
    });
  }
  if (fs.ultLeft > 0 && r.ultRevealOnAHitDuration > 0) {
    applyStatus(target, I.REVEAL, r.ultRevealOnAHitDuration, {
      sourceId: owner.id,
      hostile: true,
      label: 'R+A',
      timeMs
    });
  }
  if (fs.ultLeft > 0 && r.ultHealCutThresholdRunes > 0 && runesAfter >= r.ultHealCutThresholdRunes) {
    applyStatus(target, I.HEAL_CUT, r.ultHealCutDuration, {
      sourceId: owner.id,
      hostile: true,
      value: r.ultHealCutPct,
      label: 'R+A',
      timeMs
    });
  }
  maybeDetonateSigilRunes(state, owner, target, timeMs, {
    sourceSlot: 'A',
    applyStasisDuration: a.aDetonationStasisDuration,
    applyStunDuration: fs.ultLeft > 0 ? r.ultDetonationStunDuration : 0
  });
}

function handleBulwarkProjectileImpact(state, owner, target, projectile, timeMs) {
  if (projectile.sourceAbilitySlot === -1) {
    const fs = getBulwarkState(owner);
    const armor = getBulwarkArmor(owner);
    const passive = BULWARK_PASSIVE;
    const conversionBoost = (fs?.anchorLeft ?? 0) > 0 ? 1.5 : 1;
    const pct = ((fs?.empoweredLeft ?? 0) > 0 ? passive.empoweredArmorToOnHitDamagePct : passive.armorToOnHitDamagePct) * conversionBoost;
    let bonus = armor * pct;
    if ((fs?.anchorLeft ?? 0) > 0 && hasStatus(target, I.TAUNT)) {
      const a = getBulwarkA(owner);
      bonus += a.anchorTauntedBonusFlat + armor * a.anchorTauntedBonusArmorPct;
    }
    if (bonus > 0) applyDamage(state, target, bonus, owner, { timeMs, sourceSlot: 'auto', visualKind: 'auto', ignoreItemProcs: true });
    return;
  }
  if (projectile.sourceAbilitySlot !== 'Z') return;
  const tuning = getBulwarkZ(owner);
  const stormTuning = getBulwarkR(owner);
  const targetInStorm = isTargetInsideBulwarkStorm(owner, target, stormTuning);
  const tauntDuration = tuning.harpoonTauntDuration + (targetInStorm ? (tuning.harpoonTauntBonusDurationInStorm || 0) : 0);
  applyStatus(target, I.TAUNT, tauntDuration, {
    sourceId: owner.id,
    hostile: true,
    label: 'Z',
    timeMs
  });
  if (tuning.harpoonArmorShredPct > 0) {
    applyStatus(target, I.ARMOR_SHRED, tuning.harpoonArmorShredDuration, {
      sourceId: owner.id,
      hostile: true,
      value: tuning.harpoonArmorShredPct,
      label: 'Z',
      timeMs
    });
  }
  if (tuning.harpoonGroundedDuration > 0) {
    applyStatus(target, I.GROUNDED, tuning.harpoonGroundedDuration, {
      sourceId: owner.id,
      hostile: true,
      label: 'Z',
      timeMs
    });
  }
  if (tuning.harpoonPullStrength > 0) {
    const pullCenter = targetInStorm ? { id: owner.id, x: owner.x, y: owner.y } : owner;
    applyPullMove(target, pullCenter, 0.18, tuning.harpoonPullStrength);
  }
  if (tuning.harpoonSelfHastePct > 0) {
    applyStatus(owner, I.HASTE, tauntDuration, {
      sourceId: owner.id,
      hostile: false,
      value: tuning.harpoonSelfHastePct,
      label: 'Z',
      timeMs
    });
  }
  if (tuning.harpoonDashDistance > 0) {
    const dir = norm(target.x - owner.x, target.y - owner.y);
    applyDashMove(owner, owner.x + dir.x * tuning.harpoonDashDistance, owner.y + dir.y * tuning.harpoonDashDistance, 0.12, tuning.harpoonDashDistance / 0.12);
  }
}


export function onAreaEffectTickForFrame(state, owner, target, effect, timeMs) {
  if (!owner || owner.frameId !== SHIP_FRAME_IDS.SIGIL || effect?.slot !== 'Z') return;
  const fs = getSigilState(owner);
  if (!fs) return;

  const a = getSigilA(owner);
  const z = getSigilZ(owner);
  const r = getSigilR(owner);
  const runesBefore = getSigilRuneCount(target);

  applySigilRuneBonusDamage(state, owner, target, a, timeMs, 'Z', runesBefore);
  if (z.zRunePulseStacks > 0) applySigilRunes(owner, target, a, z.zRunePulseStacks, timeMs);
  maybeSlowFromSigilRunes(owner, target, a, timeMs);
  maybeDetonateSigilRunes(state, owner, target, timeMs, {
    sourceSlot: 'Z',
    applyStunDuration: fs.ultLeft > 0 ? r.ultDetonationStunDuration : 0
  });
}

export function onProjectileImpactForFrame(state, owner, target, projectile, timeMs) {
  if (!owner) return;
  if (owner.frameId === SHIP_FRAME_IDS.VANGUARD) return handleVanguardProjectileImpact(state, owner, target, projectile, timeMs);
  if (owner.frameId === SHIP_FRAME_IDS.SIGIL) return handleSigilProjectileImpact(state, owner, target, projectile, timeMs);
  if (owner.frameId === SHIP_FRAME_IDS.BULWARK) return handleBulwarkProjectileImpact(state, owner, target, projectile, timeMs);
}

export function onProjectileExpireForFrame(state, owner, projectile, timeMs) {
  if (!owner || owner.frameId !== SHIP_FRAME_IDS.BULWARK) return;
  if (projectile?.sourceAbilitySlot !== 'Z') return;
  const fs = getBulwarkState(owner);
  if (!fs) return;
  fs.breachLeft = Math.max(fs.breachLeft || 0, 2.25);
  fs.breachPlateLockLeft = Math.max(fs.breachPlateLockLeft || 0, 1.25);
  fs.recentDamageTaken = 0;
}

function castVanguardA(state, player, timeMs, options = {}) {
  if (getAbilityInvestedLevel(player, 'A') <= 0) return false;
  const a = getA(player);
  if (player.cooldownALeft > 0 && !options.resolvingCast) return false;
  if (!options.resolvingCast && beginFrameCast(player, 'A', a, timeMs)) return true;
  if (!options.resolvingCast && !consumeEnergy(player.stats, a.energyCost)) return false;

  const world = getCastMouseWorld(player, options.cast);
  const dir = norm(world.x - player.x, world.y - player.y);
  const fs = getVanguardState(player);
  const combo = fs.comboWindowLeft > 0;
  if (combo) fs.comboWindowLeft = 0;

  let damage = getWeaponReferenceDamage(player) * a.damagePct + a.damageFlat;
  let speed = a.projectileSpeed;
  if (combo) {
    damage *= 1 + a.comboDamagePct;
    speed *= 1 + a.comboProjectileSpeedPct;
  }

  fs.empowerPct = a.empowerPct;
  fs.empowerFlat = a.empowerFlat;
  const maxEmpoweredCharges = Math.max(1, Math.min(5, a.empowerCharges | 0));
  fs.empoweredCharges = Math.min(maxEmpoweredCharges, (fs.empoweredCharges | 0) + a.empowerCharges);
  fs.empoweredMaxCharges = maxEmpoweredCharges;

  spawnProjectile(state, player, player.x + dir.x * a.projectileRange, player.y + dir.y * a.projectileRange, { r: 130, g: 225, b: 255 }, damage, Math.max(4, a.projectileWidth * 0.22), speed, a.projectileRange, 0, timeMs, {
    sourceAbilitySlot: 'A',
    linkedAbilitySynergyActive: combo,
    pierceLeft: a.pierceCount,
    hitIds: new Set(),
    sourceFrameId: player.frameId
  });
  if (!options.resolvingCast) player.cooldownALeft = a.baseCooldown;
  return true;
}

function getClientAppliedAbility(player, slot, timeMs) {
  const a = player?._activeClientAppliedAbility || player?.clientAppliedAbilityPose || null;
  if (!a || a.slot !== slot || timeMs > (a.until || 0)) return null;
  return a;
}

function clientAlreadyAppliedDash(player, slot, timeMs) {
  const a = getClientAppliedAbility(player, slot, timeMs);
  return !!a && !!a.dashAlreadyApplied;
}

function castVanguardZ(state, player, timeMs) {
  if (getAbilityInvestedLevel(player, 'Z') <= 0) return false;
  const z = getZ(player);
  if (player.cooldownZLeft > 0) return false;
  if (blocksDash(player)) return false;
  if (!consumeEnergy(player.stats, z.energyCost)) return false;

  const world = getAbilityMouseWorld(player);
  const clientAbility = getClientAppliedAbility(player, 'Z', timeMs);
  const dashLine = clientAbility?.dashLine || null;
  const clientDash = !!clientAbility?.dashAlreadyApplied;
  const fromX = dashLine?.startX ?? player.x;
  const fromY = dashLine?.startY ?? player.y;
  const dir = norm(world.x - fromX, world.y - fromY);
  const toX = dashLine?.endX ?? (fromX + dir.x * z.dashDistance);
  const toY = dashLine?.endY ?? (fromY + dir.y * z.dashDistance);
  if (!clientDash) applyDashMove(player, toX, toY, 0.10, z.dashDistance / 0.10);

  const fs = getVanguardState(player);
  fs.moveBoostLeft = Math.max(fs.moveBoostLeft, z.moveBoostDuration);
  if (z.comboWindowDuration > 0) fs.comboWindowLeft = Math.max(fs.comboWindowLeft, z.comboWindowDuration);
  if (z.cleanseSlowAndRoot) {
    removeStatus(player, I.SLOW);
    removeStatus(player, I.ROOT);
  }
  if (z.trailSlowDuration > 0 && z.trailSlowPct > 0) {
    let hits = 0;
    forEachHostileEntityInSector(state, player, (target) => {
      const rr = 20 + (target.radius ?? 0);
      if (linePointDistance(target.x, target.y, fromX, fromY, toX, toY) > rr) return;
      applyStatus(target, I.SLOW, z.trailSlowDuration, {
        sourceId: player.id,
        hostile: true,
        value: z.trailSlowPct,
        label: 'Z',
        timeMs
      });
      hits += 1;
    });
    if (hits > 0) addVanguardHeat(player, hits, timeMs);
    fs.trailLeft = z.trailSlowDuration;
    fs.trailStartX = fromX;
    fs.trailStartY = fromY;
    fs.trailEndX = toX;
    fs.trailEndY = toY;
    fs.trailSlowPct = z.trailSlowPct;
    fs.trailSlowDuration = z.trailSlowDuration;
  }
  applyOverheatTenacity(player, z, timeMs);
  const r = getR(player);
  if (fs.ultLeft > 0 && r.unstoppableDuration > 0) {
    applyStatus(player, I.UNSTOPPABLE, r.unstoppableDuration, {
      sourceId: player.id,
      hostile: false,
      label: 'R+Z',
      timeMs
    });
  }
  player.cooldownZLeft = z.baseCooldown;
  return true;
}

function castVanguardE(state, player, timeMs, options = {}) {
  if (getAbilityInvestedLevel(player, 'E') <= 0) return false;
  const e = getE(player);
  if (player.cooldownELeft > 0 && !options.resolvingCast) return false;
  if (!options.resolvingCast && beginFrameCast(player, 'E', e, timeMs)) return true;
  if (!options.resolvingCast && !consumeEnergy(player.stats, e.energyCost)) return false;
  const fs = getVanguardState(player);
  fs.phaseLeft = Math.max(fs.phaseLeft, e.phaseDuration);
  fs.phaseStartedAtMaxHeat = fs.passiveStacks >= VANGUARD_PASSIVE.maxStacks;
  applyOverheatTenacity(player, e, timeMs);
  if (!options.resolvingCast) player.cooldownELeft = e.baseCooldown;
  return true;
}

function castVanguardR(state, player, timeMs) {
  if (getAbilityInvestedLevel(player, 'R') <= 0) return false;
  const r = getR(player);
  if (player.cooldownRLeft > 0) return false;
  if (!consumeEnergy(player.stats, r.energyCost)) return false;
  const fs = getVanguardState(player);
  fs.ultLeft = r.ultDuration;
  fs.ultBonusDurationGained = 0;
  player.cooldownRLeft = r.baseCooldown;
  return true;
}

function castSigilA(state, player, timeMs, options = {}) {
  if (getAbilityInvestedLevel(player, 'A') <= 0) return false;
  const a = getSigilA(player);
  if (player.cooldownALeft > 0 && !options.resolvingCast) return false;
  if (!options.resolvingCast && beginFrameCast(player, 'A', a, timeMs)) return true;
  if (!options.resolvingCast && !consumeEnergy(player.stats, a.energyCost)) return false;

  const world = getCastMouseWorld(player, options.cast);
  const dir = norm(world.x - player.x, world.y - player.y);
  const fs = getSigilState(player);
  let damage = getWeaponReferenceDamage(player) * a.aImpactDamagePct + a.aImpactDamageFlat;
  if (fs.veilLeft > 0 && a.aEmpowerFromVeilDamagePct > 0) damage *= 1 + a.aEmpowerFromVeilDamagePct;

  spawnProjectile(state, player, player.x + dir.x * a.aProjectileRange, player.y + dir.y * a.aProjectileRange, { r: 197, g: 120, b: 255 }, damage, Math.max(4, a.aProjectileWidth * 0.22), a.aProjectileSpeed, a.aProjectileRange, 0, timeMs, {
    sourceAbilitySlot: 'A',
    pierceLeft: Math.max(0, a.aPierceCount),
    hitIds: new Set(),
    sourceFrameId: player.frameId
  });

  const ult = getSigilR(player);
  if (!options.resolvingCast) player.cooldownALeft = a.baseCooldown * (fs.ultLeft > 0 ? ult.ultACooldownMultiplier : 1);
  return true;
}

function castSigilZ(state, player, timeMs) {
  if (getAbilityInvestedLevel(player, 'Z') <= 0) return false;
  const z = getSigilZ(player);
  const fs = getSigilState(player);

  if (fs.zoneEffectId && z.zCanRecastClose) {
    const zone = state.areaEffects.get(fs.zoneEffectId);
    if (zone) {
      forEachHostileInRadius(state, player, zone.x, zone.y, zone.radius, (target) => {
        const runes = getSigilRuneCount(target);
        if (runes >= z.zCloseControlThresholdRunes && z.zClosePullStrength > 0) applyPullMove(target, { id: player.id, x: zone.x, y: zone.y }, 0.18, z.zClosePullStrength);
        if (runes >= z.zCloseControlThresholdRunes && z.zCloseSuppressDuration > 0) {
          applyStatus(target, I.SUPPRESS, z.zCloseSuppressDuration, {
            sourceId: player.id,
            hostile: true,
            label: 'Z2',
            timeMs
          });
        }
      });
      state.areaEffects.delete(fs.zoneEffectId);
      fs.zoneEffectId = 0;
      const r = getSigilR(player);
      if (fs.ultLeft > 0 && r.ultZoneCamouflageDuration > 0) {
        applyStatus(player, I.CAMOUFLAGE, r.ultZoneCamouflageDuration, {
          sourceId: player.id,
          hostile: false,
          label: 'R+Z',
          timeMs
        });
      }
      return true;
    }
    fs.zoneEffectId = 0;
  }

  if (player.cooldownZLeft > 0) return false;
  if (!consumeEnergy(player.stats, z.energyCost)) return false;

  const world = getAbilityMouseWorld(player);
  const dir = norm(world.x - player.x, world.y - player.y);
  const dist = Math.min(z.zCastRange, Math.hypot(world.x - player.x, world.y - player.y));
  const x = player.x + dir.x * dist;
  const y = player.y + dir.y * dist;
  const damage = z.zZoneDamageFlatPerSecond + getWeaponReferenceDamage(player) * z.zZoneDamageWeaponPctPerSecond;

  const effect = createAreaEffect(state, player, {
    slot: 'Z',
    kind: 'frame_zone',
    visualStyle: 'sigil_seal',
    x,
    y,
    radius: z.zZoneRadius,
    innerRadius: z.zZoneRadius * 0.48,
    duration: z.zZoneDuration,
    tickEvery: z.zRunePulseInterval,
    pulseEvery: z.zRunePulseInterval,
    damage,
    color: { r: 177, g: 104, b: 255 },
    onTickStatuses: [
      {
        effectId: I.SLOW,
        duration: z.zRunePulseInterval + 0.1,
        value: z.zZoneSlowPct,
        hostile: true,
        label: 'Z'
      }
    ].filter(Boolean)
  });

  fs.zoneEffectId = effect.id;
  fs.zoneX = x;
  fs.zoneY = y;
  player.cooldownZLeft = z.baseCooldown;
  return true;
}

function castSigilE(state, player, timeMs) {
  if (getAbilityInvestedLevel(player, 'E') <= 0) return false;
  const e = getSigilE(player);
  if (player.cooldownELeft > 0) return false;
  if (blocksDash(player)) return false;
  if (!consumeEnergy(player.stats, e.energyCost)) return false;

  const world = getAbilityMouseWorld(player);
  const clientAbility = getClientAppliedAbility(player, 'E', timeMs);
  const dashLine = clientAbility?.dashLine || null;
  const clientDash = !!clientAbility?.dashAlreadyApplied;
  const fromX = dashLine?.startX ?? player.x;
  const fromY = dashLine?.startY ?? player.y;
  const dir = norm(world.x - fromX, world.y - fromY);
  const toX = dashLine?.endX ?? (fromX + dir.x * e.eDashDistance);
  const toY = dashLine?.endY ?? (fromY + dir.y * e.eDashDistance);
  if (!clientDash) applyDashMove(player, toX, toY, 0.10, e.eDashDistance / 0.10);
  applyStatus(player, I.CAMOUFLAGE, e.eCamouflageDuration, {
    sourceId: player.id,
    hostile: false,
    label: 'E',
    timeMs
  });
  const fs = getSigilState(player);
  fs.veilLeft = Math.max(fs.veilLeft, e.eCamouflageDuration);
  fs.trailLeft = e.eTrailDuration;
  fs.trailStartX = fromX;
  fs.trailStartY = fromY;
  fs.trailEndX = clientDash ? player.x : toX;
  fs.trailEndY = clientDash ? player.y : toY;
  fs.trailSlowPct = e.eTrailSlowPct;
  fs.trailSlowDuration = e.eTrailSlowDuration;
  player.cooldownELeft = e.baseCooldown;
  return true;
}

function castSigilR(state, player, timeMs) {
  if (getAbilityInvestedLevel(player, 'R') <= 0) return false;
  const r = getSigilR(player);
  if (player.cooldownRLeft > 0) return false;
  if (!consumeEnergy(player.stats, r.energyCost)) return false;
  const fs = getSigilState(player);
  fs.ultLeft = r.ultDuration;
  fs.ultDetonationStunUsed = false;
  applyStatus(player, I.LIFESTEAL, r.ultDuration, {
    sourceId: player.id,
    hostile: false,
    value: r.ultLifestealPct,
    label: 'R',
    timeMs
  });
  player.cooldownRLeft = r.baseCooldown;
  return true;
}

function castBulwarkA(state, player, timeMs) {
  if (getAbilityInvestedLevel(player, 'A') <= 0) return false;
  const a = getBulwarkA(player);
  if (player.cooldownALeft > 0) return false;
  if (!consumeEnergy(player.stats, a.energyCost)) return false;
  const fs = getBulwarkState(player);
  consumeBulwarkMaxPlatesForAbility(player);
  fs.anchorLeft = a.anchorDuration;
  fs.anchorArmorFlat = a.anchorArmorFlat;
  fs.anchorPulseRadius = a.anchorPulseRadius;
  fs.anchorPulseSlowPct = a.anchorPulseSlowPct;
  fs.anchorPulseSlowDuration = a.anchorPulseSlowDuration;
  applyBulwarkAnchorPulse(state, player, a, timeMs, 'A');
  player.cooldownALeft = a.baseCooldown;
  return true;
}

function castBulwarkZ(state, player, timeMs, options = {}) {
  if (getAbilityInvestedLevel(player, 'Z') <= 0) return false;
  const z = getBulwarkZ(player);
  if (player.cooldownZLeft > 0 && !options.resolvingCast) return false;
  if (!options.resolvingCast && beginFrameCast(player, 'Z', z, timeMs)) return true;
  if (!options.resolvingCast && !consumeEnergy(player.stats, z.energyCost)) return false;
  consumeBulwarkMaxPlatesForAbility(player);
  const fs = getBulwarkState(player);
  if (fs) fs.harpoonUnitPhaseLeft = Math.max(fs.harpoonUnitPhaseLeft || 0, z.harpoonTauntDuration);
  const world = getCastMouseWorld(player, options.cast);
  const dir = norm(world.x - player.x, world.y - player.y);
  const armor = getBulwarkArmor(player);
  const damage = z.harpoonDamageFlat + getWeaponReferenceDamage(player) * z.harpoonDamageWeaponPct + armor * z.harpoonDamageArmorPct;
  spawnProjectile(state, player, player.x + dir.x * z.harpoonRange, player.y + dir.y * z.harpoonRange, { r: 234, g: 190, b: 112 }, damage, Math.max(5, z.harpoonWidth * 0.22), z.harpoonProjectileSpeed, z.harpoonRange, 0, timeMs, {
    sourceAbilitySlot: 'Z',
    pierceLeft: 0,
    hitIds: new Set(),
    sourceFrameId: player.frameId
  });
  if (!options.resolvingCast) player.cooldownZLeft = z.baseCooldown;
  return true;
}

function castBulwarkE(state, player, timeMs) {
  if (getAbilityInvestedLevel(player, 'E') <= 0) return false;
  const e = getBulwarkE(player);
  if (player.cooldownELeft > 0) return false;
  if (!consumeEnergy(player.stats, e.energyCost)) return false;
  consumeBulwarkMaxPlatesForAbility(player);
  if (e.meditationCleanseSilenceDisarmRoot) cleanseControlOnly(player);
  if (e.meditationCastUnstoppableDuration > 0) {
    applyStatus(player, I.UNSTOPPABLE, e.meditationCastUnstoppableDuration, {
      sourceId: player.id,
      hostile: false,
      label: 'E',
      timeMs
    });
  }
  const fs = getBulwarkState(player);
  fs.meditationLeft = e.meditationDuration;
  player.cooldownELeft = e.baseCooldown;
  return true;
}

function castBulwarkR(state, player, timeMs) {
  if (getAbilityInvestedLevel(player, 'R') <= 0) return false;
  const r = getBulwarkR(player);
  if (player.cooldownRLeft > 0) return false;
  if (!consumeEnergy(player.stats, r.energyCost)) return false;
  consumeBulwarkMaxPlatesForAbility(player);
  const fs = getBulwarkState(player);
  fs.stormLeft = r.stormDuration;
  fs.stormTickLeft = 0.5;
  fs.stormPullTickLeft = r.stormPullInterval || 0;
  fs.stormShieldTickLeft = r.stormShieldGainTickInterval || 1.2;
  fs.stormShieldGained = 0;
  clearBulwarkStormArmorSteal(state, fs);
  fs.stormArmorStolen = 0;
  fs.stormArmorById = Object.create(null);
  fs.stormExposureById = Object.create(null);
  fs.stormReturnScheduled = false;
  player.cooldownRLeft = r.baseCooldown;
  return true;
}

export function tryCastFrameAbility(state, player, slot, timeMs) {
  if (player.frameId === SHIP_FRAME_IDS.VANGUARD) {
    if (slot === 'A') return castVanguardA(state, player, timeMs);
    if (slot === 'Z') return castVanguardZ(state, player, timeMs);
    if (slot === 'E') return castVanguardE(state, player, timeMs);
    if (slot === 'R') return castVanguardR(state, player, timeMs);
    return false;
  }
  if (player.frameId === SHIP_FRAME_IDS.SIGIL) {
    if (slot === 'A') return castSigilA(state, player, timeMs);
    if (slot === 'Z') return castSigilZ(state, player, timeMs);
    if (slot === 'E') return castSigilE(state, player, timeMs);
    if (slot === 'R') return castSigilR(state, player, timeMs);
    return false;
  }
  if (player.frameId === SHIP_FRAME_IDS.BULWARK) {
    if (slot === 'A') return castBulwarkA(state, player, timeMs);
    if (slot === 'Z') return castBulwarkZ(state, player, timeMs);
    if (slot === 'E') return castBulwarkE(state, player, timeMs);
    if (slot === 'R') return castBulwarkR(state, player, timeMs);
    return false;
  }
  return false;
}

export function buildFrameUiState(player, timeMs) {
  if (player.frameId === SHIP_FRAME_IDS.VANGUARD) {
    const fs = getVanguardState(player);
    if (!fs) return null;
    const decayLeft = fs.passiveStacks <= 0
      ? 0
      : Math.max(0, VANGUARD_PASSIVE.stackDuration - (timeMs - fs.passiveLastGainAtMs) / 1000);
    return {
      kind: 'vanguard',
      passiveName: 'Surchauffe',
      passiveStacks: fs.passiveStacks,
      passiveMaxStacks: VANGUARD_PASSIVE.maxStacks,
      passiveDecayLeft: decayLeft,
      passiveDecaying: fs.passiveStacks > 0 && decayLeft <= 0.001,
      empoweredCharges: fs.empoweredCharges,
      empoweredMaxCharges: fs.empoweredMaxCharges || Math.max(1, Math.min(5, getA(player).empowerCharges | 0)),
      comboWindowLeft: fs.comboWindowLeft,
      moveBoostLeft: fs.moveBoostLeft,
      phaseLeft: fs.phaseLeft,
      trailLeft: fs.trailLeft || 0,
      trailStartX: fs.trailStartX || 0,
      trailStartY: fs.trailStartY || 0,
      trailEndX: fs.trailEndX || 0,
      trailEndY: fs.trailEndY || 0,
      ultLeft: fs.ultLeft,
      tempShield: Array.isArray(player.frameTempShields) ? player.frameTempShields.reduce((sum, shield) => sum + Math.max(0, shield.amount || 0), 0) : 0,
      pendingCast: player.pendingFrameCast?.frameId === player.frameId ? player.pendingFrameCast : null,
      pulseLeft: fs.pulseLeft || 0,
      pulseKind: fs.pulseKind || '',
      pulseRadius: fs.pulseRadius || 0
    };
  }

  if (player.frameId === SHIP_FRAME_IDS.SIGIL) {
    const fs = getSigilState(player);
    if (!fs) return null;
    return {
      kind: 'sigil',
      passiveName: 'Runes',
      passiveStacks: 0,
      passiveMaxStacks: SIGIL_PASSIVE.maxRunes,
      detonationCooldownLeft: fs.detonationCooldownLeft,
      zoneActive: !!fs.zoneEffectId,
      veilLeft: fs.veilLeft,
      trailLeft: fs.trailLeft || 0,
      trailStartX: fs.trailStartX || 0,
      trailStartY: fs.trailStartY || 0,
      trailEndX: fs.trailEndX || 0,
      trailEndY: fs.trailEndY || 0,
      ultLeft: fs.ultLeft,
      tempShield: Array.isArray(player.frameTempShields) ? player.frameTempShields.reduce((sum, shield) => sum + Math.max(0, shield.amount || 0), 0) : 0,
      pendingCast: player.pendingFrameCast?.frameId === player.frameId ? player.pendingFrameCast : null,
      pulseLeft: fs.pulseLeft || 0,
      pulseKind: fs.pulseKind || '',
      pulseRadius: fs.pulseRadius || 0
    };
  }

  if (player.frameId === SHIP_FRAME_IDS.BULWARK) {
    const fs = getBulwarkState(player);
    if (!fs) return null;
    return {
      kind: 'bulwark',
      passiveName: 'Plaques',
      passiveStacks: getBulwarkPlateCount(player),
      passiveMaxStacks: BULWARK_PASSIVE.maxPlates,
      anchorLeft: fs.anchorLeft,
      meditationLeft: fs.meditationLeft,
      stormLeft: fs.stormLeft,
      breachLeft: fs.breachLeft || 0,
      empoweredLeft: fs.empoweredLeft || 0,
      stormArmorStolen: fs.stormArmorStolen || 0,
      stormArmorReturning: Object.values(fs.stormArmorById || {}).filter((entry) => entry?.returning).length,
      stormShieldGained: fs.stormShieldGained || 0,
      tempShield: Array.isArray(player.frameTempShields) ? player.frameTempShields.reduce((sum, shield) => sum + Math.max(0, shield.amount || 0), 0) : 0,
      pendingCast: player.pendingFrameCast?.frameId === player.frameId ? player.pendingFrameCast : null,
      harpoonUnitPhaseLeft: fs.harpoonUnitPhaseLeft || 0,
      pulseLeft: fs.pulseLeft || 0,
      pulseKind: fs.pulseKind || '',
      pulseRadius: fs.pulseRadius || 0
    };
  }

  return null;
}
