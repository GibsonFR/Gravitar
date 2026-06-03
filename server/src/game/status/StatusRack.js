import { STATUS_EFFECT_IDS as I } from '../../../../shared/content/status/StatusEffectIds.js';
import { SHIP_FRAME_IDS } from '../../../../shared/content/frames/ShipFrameIds.js';
import { BULWARK_PASSIVE } from '../../../../shared/content/frames/bulwark/BulwarkFrameSpec.js';
import { getStatusEffectDef } from '../../../../shared/content/status/StatusEffectDefs.js';
import { STATUS_EFFECT_FAMILIES as FAM } from '../../../../shared/content/status/StatusEffectFamilies.js';
import {
  isBlockedBySpellShieldStatus,
  isReducedByTenacityStatus,
  breaksOnExternalHitStatus,
  supportsStacksStatus
} from '../../../../shared/content/status/StatusEffectRules.js';

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function markKeyFor(effectId, options) {
  if (effectId === I.MARK && options?.markKey) return `${effectId}:${options.markKey}`;
  return effectId;
}

function baseIdOf(key) {
  const sep = key.indexOf(':');
  return sep >= 0 ? key.slice(0, sep) : key;
}

function isUnstoppableBlocked(effectId) {
  return effectId === I.STUN || effectId === I.ROOT || effectId === I.GROUNDED || effectId === I.KNOCKUP || effectId === I.SUPPRESS || effectId === I.SLEEP || effectId === I.FEAR || effectId === I.CHARM || effectId === I.TAUNT || effectId === I.PULL || effectId === I.KNOCKBACK || effectId === I.BUMP;
}


function isBulwarkPlateControl(effectId) {
  return effectId === I.STUN
    || effectId === I.TAUNT
    || effectId === I.SUPPRESS
    || effectId === I.ROOT
    || effectId === I.DISARM
    || effectId === I.SILENCE
    || effectId === I.KNOCKUP
    || effectId === I.KNOCKBACK
    || effectId === I.BUMP;
}

function grantBulwarkPlateFromControl(entity, effectId, hostile) {
  if (!hostile || entity?.frameId !== SHIP_FRAME_IDS.BULWARK || !isBulwarkPlateControl(effectId)) return;
  const fs = entity.frameState?.bulwark;
  if (!fs || (fs.plateGainIcdLeft ?? 0) > 0 || (fs.breachPlateLockLeft ?? 0) > 0) return;
  if (!Array.isArray(fs.plateDurations)) fs.plateDurations = [];
  if (fs.plateDurations.length >= BULWARK_PASSIVE.maxPlates) {
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < fs.plateDurations.length; i += 1) {
      if (fs.plateDurations[i] < best) {
        best = fs.plateDurations[i];
        idx = i;
      }
    }
    fs.plateDurations[idx] = BULWARK_PASSIVE.plateDuration;
  } else {
    fs.plateDurations.push(BULWARK_PASSIVE.plateDuration);
  }
  fs.plateGainIcdLeft = BULWARK_PASSIVE.plateGainInternalCooldown;
}

function defaultValueFor(effectId, value) {
  if (value != null) return value;
  if (effectId === I.SLOW || effectId === I.HASTE) return 0.25;
  if (effectId === I.SLOW_RESIST || effectId === I.TENACITY) return 0.3;
  if (effectId === I.DAMAGE_AMP || effectId === I.HEAL_CUT || effectId === I.ARMOR_UP || effectId === I.ANTI_SHIELD || effectId === I.ARMOR_SHRED || effectId === I.LIFESTEAL) return 0.25;
  return 0;
}

function defaultTickEvery(effectId, tickEvery) {
  if (tickEvery != null) return tickEvery;
  if (effectId === I.BLEED || effectId === I.POISON || effectId === I.BURN) return 1;
  return 0;
}

function defaultPeriodicDamage(effectId, periodicDamage, value) {
  if (periodicDamage != null) return periodicDamage;
  if (effectId === I.BLEED || effectId === I.POISON || effectId === I.BURN) return value != null && value > 0 ? value : 4;
  return 0;
}

export function createStatusRack() {
  return {
    effects: new Map(),
    lastBlockedBySpellShieldAt: 0,
    lastRemovedAt: 0
  };
}

export function ensureStatusRack(entity) {
  if (!entity.status) entity.status = createStatusRack();
  return entity.status;
}

export function getStatusEntry(entity, effectId, options = null) {
  const rack = ensureStatusRack(entity);
  return rack.effects.get(markKeyFor(effectId, options)) ?? null;
}

export function hasStatus(entity, effectId) {
  return !!getStatusEntry(entity, effectId);
}

export function getStatusValue(entity, effectId, fallback = 0) {
  const entry = getStatusEntry(entity, effectId);
  return entry ? (entry.value ?? fallback) : fallback;
}

export function getStatusStacks(entity, effectId) {
  const entry = getStatusEntry(entity, effectId);
  return entry ? (entry.stacks ?? 1) : 0;
}

export function removeStatus(entity, effectId, options = null) {
  if (!entity?.status?.effects) return false;
  return entity.status.effects.delete(markKeyFor(effectId, options));
}

export function clearStatusesByPredicate(entity, predicate, timeMs = Date.now()) {
  if (!entity?.status?.effects?.size) return 0;
  let removed = 0;
  for (const [key, entry] of [...entity.status.effects.entries()]) {
    if (!predicate(entry)) continue;
    entity.status.effects.delete(key);
    removed += 1;
  }
  if (removed > 0) entity.status.lastRemovedAt = timeMs;
  return removed;
}

export function breakStatusesOnExternalHit(entity, timeMs = Date.now()) {
  return clearStatusesByPredicate(entity, (entry) => {
    const def = getStatusEffectDef(entry.id);
    return breaksOnExternalHitStatus(def);
  }, timeMs);
}

export function consumeSpellShield(entity, timeMs = Date.now()) {
  const ok = removeStatus(entity, I.SPELL_SHIELD);
  if (ok && entity?.status) entity.status.lastBlockedBySpellShieldAt = timeMs;
  return ok;
}

export function applyStatus(entity, effectId, duration, options = {}) {
  if (!entity) return { ok: false, reason: 'no_entity' };
  const def = getStatusEffectDef(effectId);
  if (!def) return { ok: false, reason: 'unknown_effect' };

  const eventTimeMs = Number.isFinite(options.timeMs) ? Math.floor(options.timeMs) : Date.now();

  if (options.hostile && isBlockedBySpellShieldStatus(def) && consumeSpellShield(entity, eventTimeMs)) {
    return { ok: false, reason: 'spell_shield' };
  }

  if (options.hostile && hasStatus(entity, I.UNSTOPPABLE) && isUnstoppableBlocked(effectId)) {
    return { ok: false, reason: 'unstoppable' };
  }

  let finalDuration = Math.max(0, duration ?? 0);
  if (options.hostile && isReducedByTenacityStatus(def) && finalDuration > 0) {
    const tenacity = clamp(getStatusValue(entity, I.TENACITY, 0) + (entity?.frameBonuses?.tenacity ?? 0), 0, 0.8);
    finalDuration *= (1 - tenacity);
  }

  grantBulwarkPlateFromControl(entity, effectId, !!options.hostile);

  const rack = ensureStatusRack(entity);
  const key = markKeyFor(effectId, options);
  const existing = rack.effects.get(key);
  const value = defaultValueFor(effectId, options.value);
  const tickEvery = defaultTickEvery(effectId, options.tickEvery);
  const periodicDamage = defaultPeriodicDamage(effectId, options.periodicDamage, value);
  const maxStacks = Math.max(1, options.maxStacks ?? 5);

  if (existing) {
    existing.durationLeft = Math.max(existing.durationLeft, finalDuration);
    existing.baseDuration = Math.max(existing.baseDuration ?? 0, finalDuration);
    existing.value = value;
    existing.sourceId = options.sourceId ?? existing.sourceId ?? 0;
    existing.meta = options.meta ?? existing.meta ?? null;
    existing.label = options.label ?? existing.label ?? '';
    if (supportsStacksStatus(def)) existing.stacks = clamp((existing.stacks ?? 1) + (options.stacks ?? 1), 1, maxStacks);
    if (tickEvery > 0) existing.tickEvery = tickEvery;
    if (periodicDamage > 0) existing.periodicDamage = periodicDamage;
    return {
      ok: true,
      refreshed: true,
      key,
      effectId,
      duration: finalDuration,
      value,
      stacks: existing.stacks ?? 1,
      hostile: !!options.hostile,
      label: existing.label || options.label || ''
    };
  }

  rack.effects.set(key, {
    key,
    id: effectId,
    sourceId: options.sourceId ?? 0,
    durationLeft: finalDuration,
    baseDuration: finalDuration,
    value,
    stacks: supportsStacksStatus(def) ? clamp(options.stacks ?? 1, 1, maxStacks) : 1,
    maxStacks,
    tickEvery,
    tickLeft: tickEvery,
    periodicDamage,
    markKey: options.markKey ?? '',
    label: options.label ?? '',
    meta: options.meta ?? null,
    hostile: !!options.hostile,
    appliedAt: eventTimeMs
  });

  return {
    ok: true,
    refreshed: false,
    key,
    effectId,
    duration: finalDuration,
    value,
    stacks: supportsStacksStatus(def) ? clamp(options.stacks ?? 1, 1, maxStacks) : 1,
    hostile: !!options.hostile,
    label: options.label ?? ''
  };
}

export function tickStatusRack(entity, dt) {
  const rack = ensureStatusRack(entity);
  let periodicDamage = 0;
  let lastSourceId = 0;
  const periodicHits = [];

  for (const [key, entry] of [...rack.effects.entries()]) {
    if (entry.durationLeft > 0) entry.durationLeft = Math.max(0, entry.durationLeft - dt);

    if (entry.tickEvery > 0 && entry.periodicDamage > 0) {
      entry.tickLeft -= dt;
      while (entry.tickLeft <= 0 && entry.durationLeft > 0) {
        const amount = entry.periodicDamage * Math.max(1, entry.stacks ?? 1);
        periodicDamage += amount;
        lastSourceId = entry.sourceId || lastSourceId;
        periodicHits.push({ effectId: entry.id, amount, sourceId: entry.sourceId || 0 });
        entry.tickLeft += entry.tickEvery;
      }
    }

    if (entry.durationLeft <= 0) rack.effects.delete(key);
  }

  return { periodicDamage, lastSourceId, periodicHits };
}

export function listVisibleStatuses(entity, maxCount = 8) {
  const rack = ensureStatusRack(entity);
  const out = [];

  for (const entry of rack.effects.values()) {
    const def = getStatusEffectDef(entry.id);
    if (!def?.showHudIcon) continue;
    out.push({
      id: entry.id,
      name: def.name,
      shortName: def.shortName,
      family: def.family,
      priority: def.priority,
      durationLeft: entry.durationLeft,
      baseDuration: entry.baseDuration ?? entry.durationLeft,
      value: entry.value ?? 0,
      stacks: entry.stacks ?? 1,
      label: entry.label || entry.markKey || '',
      primaryColor: def.primaryColor,
      secondaryColor: def.secondaryColor
    });
  }

  out.sort((a, b) => b.priority - a.priority || a.durationLeft - b.durationLeft || a.name.localeCompare(b.name));
  return out.slice(0, maxCount);
}

export function getIncomingDamageMultiplier(entity) {
  let mult = 1;
  mult *= (1 + clamp(getStatusValue(entity, I.DAMAGE_AMP, 0), 0, 4));
  return mult;
}

export function getOutgoingHealMultiplier(entity) {
  return 1 - clamp(getStatusValue(entity, I.HEAL_CUT, 0), 0, 0.95);
}

export function getMoveSpeedMultiplier(entity) {
  const slow = clamp(getStatusValue(entity, I.SLOW, 0), 0, 0.95);
  const haste = Math.max(0, getStatusValue(entity, I.HASTE, 0) + (entity?.frameBonuses?.moveHaste ?? 0));
  const slowResist = clamp(getStatusValue(entity, I.SLOW_RESIST, 0) + (entity?.frameBonuses?.slowResist ?? 0), 0, 0.9);
  return Math.max(0.05, (1 - slow * (1 - slowResist)) * (1 + haste));
}

export function blocksVoluntaryMove(entity) {
  return hasStatus(entity, I.STUN) || hasStatus(entity, I.ROOT) || hasStatus(entity, I.KNOCKUP) || hasStatus(entity, I.SUPPRESS) || hasStatus(entity, I.SLEEP) || hasStatus(entity, I.STASIS);
}

export function blocksAttacks(entity) {
  return hasStatus(entity, I.STUN) || hasStatus(entity, I.DISARM) || hasStatus(entity, I.SUPPRESS) || hasStatus(entity, I.SLEEP) || hasStatus(entity, I.STASIS) || hasStatus(entity, I.FEAR) || hasStatus(entity, I.CHARM) || hasStatus(entity, I.TAUNT);
}

export function blocksAbilities(entity) {
  return hasStatus(entity, I.STUN) || hasStatus(entity, I.SILENCE) || hasStatus(entity, I.SUPPRESS) || hasStatus(entity, I.SLEEP) || hasStatus(entity, I.STASIS) || hasStatus(entity, I.FEAR) || hasStatus(entity, I.CHARM) || hasStatus(entity, I.TAUNT);
}

export function blocksDash(entity) {
  return hasStatus(entity, I.GROUNDED) || hasStatus(entity, I.STUN) || hasStatus(entity, I.SUPPRESS) || hasStatus(entity, I.STASIS);
}

export function isUntargetable(entity) {
  return hasStatus(entity, I.UNTARGETABLE) || hasStatus(entity, I.STASIS);
}

export function isInvulnerable(entity) {
  return hasStatus(entity, I.INVULNERABLE) || hasStatus(entity, I.STASIS);
}

export function isCamouflaged(entity) {
  return hasStatus(entity, I.CAMOUFLAGE) || hasStatus(entity, I.COMBAT_CLOAK);
}

export function hasTrueSight(entity) {
  return hasStatus(entity, I.TRUE_SIGHT) || hasStatus(entity, I.DETECTION) || hasStatus(entity, I.REVEAL);
}

export function canSeeCamouflaged(observer, target) {
  if (!isCamouflaged(target)) return true;
  return hasTrueSight(observer) || hasStatus(target, I.REVEAL);
}

export function getForcedMoveMode(entity) {
  if (hasStatus(entity, I.FEAR)) return 'away';
  if (hasStatus(entity, I.CHARM) || hasStatus(entity, I.TAUNT)) return 'toward';
  return '';
}

export function getDominantControlEffect(entity) {
  const rack = ensureStatusRack(entity);
  let best = null;
  for (const entry of rack.effects.values()) {
    const def = getStatusEffectDef(baseIdOf(entry.key));
    if (!def) continue;
    if (!best || def.priority > best.priority) best = { id: entry.id, priority: def.priority };
  }
  return best?.id ?? '';
}


export function isBlinded(entity) {
  return hasStatus(entity, I.BLIND);
}

export function getIncomingShieldDamageMultiplier(entity) {
  let mult = getIncomingDamageMultiplier(entity);
  mult *= (1 + clamp(getStatusValue(entity, I.ANTI_SHIELD, 0), 0, 4));
  mult *= (1 + clamp(getStatusValue(entity, I.ARMOR_SHRED, 0), 0, 2));
  return clamp(mult, 0.05, 10);
}

export function getIncomingHullDamageMultiplier(entity) {
  let mult = getIncomingDamageMultiplier(entity);
  mult *= (1 + clamp(getStatusValue(entity, I.ARMOR_SHRED, 0), 0, 2));
  mult *= (1 - clamp(getStatusValue(entity, I.ARMOR_UP, 0), 0, 0.8));
  return clamp(mult, 0.05, 10);
}

export function getIncomingHealMultiplier(entity) {
  let healCut = clamp(getStatusValue(entity, I.HEAL_CUT, 0), 0, 0.95);
  const fs = entity?.frameId === SHIP_FRAME_IDS.BULWARK ? entity?.frameState?.bulwark : null;
  if (fs && (fs.meditationLeft ?? 0) > 0) {
    healCut *= 0.60;
  }
  const bleedCutBase = hasStatus(entity, I.BLEED) ? 0.45 : 0;
  const bleedCut = fs && (fs.meditationLeft ?? 0) > 0 ? bleedCutBase * 0.60 : bleedCutBase;
  return 1 - clamp(Math.max(healCut, bleedCut), 0, 0.95);
}

export function getOutgoingLifestealRatio(entity) {
  return clamp(getStatusValue(entity, I.LIFESTEAL, 0), 0, 3);
}
