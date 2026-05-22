import { getEquippedEquipmentDefs } from './EquipmentBonuses.js';
import { applyStatus } from '../status/StatusRack.js';
import { healStatBlock } from '../stats/StatBlockRuntime.js';
import { getSimulationTimeMs } from '../util/Time.js';

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function ensureProcState(player) {
  if (!player.equipmentProcState) player.equipmentProcState = { counters: {}, cooldowns: {} };
  if (!player.equipmentProcState.counters) player.equipmentProcState.counters = {};
  if (!player.equipmentProcState.cooldowns) player.equipmentProcState.cooldowns = {};
  return player.equipmentProcState;
}

function hpRatio(entity) {
  const hp = entity?.stats?.hp ?? 0;
  const maxHp = entity?.stats?.maxHp ?? 0;
  return maxHp > 0 ? hp / maxHp : 1;
}

function shouldTrigger(effect, event, state, owner, target, ctx, timeMs) {
  const triggers = Array.isArray(effect?.triggers) ? effect.triggers : [effect?.trigger || 'hitAny'];
  if (!triggers.includes(event)) return false;
  if (effect.minDamage != null && (ctx?.damage ?? 0) < effect.minDamage) return false;
  if (effect.targetKind && target?.kind !== effect.targetKind) return false;
  if (effect.requireCrit && !ctx?.crit) return false;
  if (effect.requireShielded && !ctx?.shielded) return false;
  if (effect.lowHpSelf != null && hpRatio(owner) > effect.lowHpSelf) return false;
  if (effect.lowHpTarget != null && hpRatio(target) > effect.lowHpTarget) return false;

  const procState = ensureProcState(owner);
  const procKey = `${effect.__itemId || 'item'}:${effect.id || effect.name || event}`;
  const cooldownMs = Math.max(0, Number(effect.cooldownMs ?? 0));
  if (cooldownMs > 0 && (procState.cooldowns[procKey] ?? 0) > timeMs) return false;

  const every = Math.max(1, effect.every | 0 || 1);
  if (every > 1) {
    procState.counters[procKey] = (procState.counters[procKey] | 0) + 1;
    if ((procState.counters[procKey] % every) !== 0) return false;
  }

  const chance = effect.chance == null ? 1 : clamp(Number(effect.chance), 0, 1);
  if (chance < 1 && Math.random() > chance) return false;

  if (cooldownMs > 0) procState.cooldowns[procKey] = timeMs + cooldownMs;
  return true;
}

function resolveActionTarget(owner, target, ctx, action) {
  const t = action?.target || 'target';
  if (t === 'self' || t === 'owner') return owner;
  if (t === 'attacker' || t === 'source') return ctx?.attacker || null;
  return target;
}

function applyShield(entity, amount) {
  if (!entity?.stats || amount <= 0 || entity.stats.hp <= 0) return 0;
  const before = entity.stats.shield ?? 0;
  entity.stats.shield = Math.min(entity.stats.maxShield ?? before, before + amount);
  return entity.stats.shield - before;
}

function applyEnergy(entity, amount) {
  if (!entity?.stats || amount <= 0 || entity.stats.hp <= 0) return 0;
  const before = entity.stats.energy ?? 0;
  entity.stats.energy = Math.min(entity.stats.maxEnergy ?? before, before + amount);
  return entity.stats.energy - before;
}

function applyAction(state, owner, target, action, ctx, timeMs) {
  const entity = resolveActionTarget(owner, target, ctx, action);
  if (!entity) return false;
  if (action.type === 'status') {
    const effectId = action.effectId;
    if (!effectId) return false;
    return !!applyStatus(entity, effectId, Number(action.duration ?? 0), {
      timeMs,
      sourceId: owner?.id ?? 0,
      hostile: entity.id !== owner?.id,
      value: action.value,
      periodicDamage: action.periodicDamage,
      tickEvery: action.tickEvery,
      maxStacks: action.maxStacks,
      stacks: action.stacks,
      label: action.label || 'Item',
      markKey: action.markKey || ''
    })?.ok;
  }
  if (action.type === 'heal') {
    const flat = Math.max(0, Number(action.flat ?? 0));
    const scaled = Math.max(0, Number(action.ratioOfDamage ?? 0)) * Math.max(0, Number(ctx?.damage ?? 0));
    return healStatBlock(entity.stats, flat + scaled) > 0;
  }
  if (action.type === 'shield') {
    const flat = Math.max(0, Number(action.flat ?? 0));
    const scaled = Math.max(0, Number(action.ratioOfDamage ?? 0)) * Math.max(0, Number(ctx?.damage ?? 0));
    return applyShield(entity, flat + scaled) > 0;
  }
  if (action.type === 'energy') {
    const flat = Math.max(0, Number(action.flat ?? 0));
    const scaled = Math.max(0, Number(action.ratioOfDamage ?? 0)) * Math.max(0, Number(ctx?.damage ?? 0));
    return applyEnergy(entity, flat + scaled) > 0;
  }
  return false;
}

function collectPassiveEffects(player) {
  const out = [];
  for (const def of getEquippedEquipmentDefs(player)) {
    const effects = Array.isArray(def?.passiveEffects) ? def.passiveEffects : [];
    for (const effect of effects) {
      if (!effect) continue;
      out.push({ ...effect, __itemId: def.id });
    }
  }
  return out;
}

export function triggerEquipmentProcEvent(state, owner, target, event, ctx = {}) {
  if (!owner || owner.kind !== 'player') return 0;
  const timeMs = getSimulationTimeMs(state, ctx.timeMs);
  let applied = 0;
  for (const effect of collectPassiveEffects(owner)) {
    if (!shouldTrigger(effect, event, state, owner, target, ctx, timeMs)) continue;
    const actions = Array.isArray(effect.actions) ? effect.actions : [];
    for (const action of actions) if (applyAction(state, owner, target, action, ctx, timeMs)) applied += 1;
  }
  return applied;
}

export function triggerEquipmentHitProcs(state, sourcePlayer, target, ctx = {}) {
  if (!sourcePlayer || sourcePlayer.kind !== 'player' || !target) return 0;
  let applied = 0;
  applied += triggerEquipmentProcEvent(state, sourcePlayer, target, 'hitAny', ctx);
  if (ctx.visualKind === 'auto') applied += triggerEquipmentProcEvent(state, sourcePlayer, target, 'autoHit', ctx);
  if (ctx.visualKind === 'rocket') applied += triggerEquipmentProcEvent(state, sourcePlayer, target, 'rocketHit', ctx);
  if (ctx.sourceSlot) applied += triggerEquipmentProcEvent(state, sourcePlayer, target, 'abilityHit', ctx);
  if (ctx.crit) applied += triggerEquipmentProcEvent(state, sourcePlayer, target, 'critHit', ctx);
  if (ctx.shielded) applied += triggerEquipmentProcEvent(state, sourcePlayer, target, 'shieldHit', ctx);
  return applied;
}

export function triggerEquipmentTakeHitProcs(state, owner, attacker, ctx = {}) {
  if (!owner || owner.kind !== 'player') return 0;
  return triggerEquipmentProcEvent(state, owner, attacker, 'takeHit', { ...ctx, attacker });
}
