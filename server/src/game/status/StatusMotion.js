import {
  applyStatus,
  blocksAbilities,
  blocksAttacks,
  blocksDash,
  blocksVoluntaryMove,
  getForcedMoveMode,
  getMoveSpeedMultiplier,
  getStatusEntry,
  isInvulnerable,
  isUntargetable
} from './StatusRack.js';
import { STATUS_EFFECT_IDS as I } from '../../../../shared/content/status/StatusEffectIds.js';

export { getMoveSpeedMultiplier, blocksVoluntaryMove, blocksAttacks, blocksAbilities, blocksDash, isUntargetable, isInvulnerable };

function towardPointVector(entity, targetX, targetY, invert = false) {
  const dx = targetX - entity.x;
  const dy = targetY - entity.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const dirX = dx / len;
  const dirY = dy / len;
  return invert ? { x: -dirX, y: -dirY } : { x: dirX, y: dirY };
}

function sourceFromEntry(state, entry) {
  if (Number.isFinite(entry?.meta?.sourceX) && Number.isFinite(entry?.meta?.sourceY)) {
    return { id: entry.sourceId || 0, x: entry.meta.sourceX, y: entry.meta.sourceY };
  }
  return entry?.sourceId ? (state.players.get(entry.sourceId) ?? state.mobs.get(entry.sourceId) ?? null) : null;
}

export function applyDashMove(entity, tx, ty, duration = 0.18, speed = null) {
  if (blocksDash(entity)) return { ok: false, reason: 'blocked_dash' };
  const len = Math.hypot(tx - entity.x, ty - entity.y);
  const finalSpeed = speed ?? (duration > 0.001 ? len / duration : Math.max(240, len));
  return applyStatus(entity, I.DASH, duration, {
    sourceId: entity.id,
    hostile: false,
    meta: { tx, ty, speed: finalSpeed }
  });
}

export function applyBlinkMove(entity, tx, ty) {
  if (blocksDash(entity)) return { ok: false, reason: 'blocked_blink' };
  return applyStatus(entity, I.BLINK, 0.05, {
    sourceId: entity.id,
    hostile: false,
    meta: { tx, ty, done: false }
  });
}

export function applyPullMove(target, source, duration = 0.18, speed = 720) {
  return applyStatus(target, I.PULL, duration, {
    sourceId: source?.id ?? 0,
    hostile: true,
    meta: { speed }
  });
}

export function applyKnockbackMove(target, source, duration = 0.16, speed = 760) {
  return applyStatus(target, I.KNOCKBACK, duration, {
    sourceId: source?.id ?? 0,
    hostile: true,
    meta: { speed }
  });
}

export function applyBumpMove(target, source, duration = 0.08, speed = 420) {
  return applyStatus(target, I.BUMP, duration, {
    sourceId: source?.id ?? 0,
    hostile: true,
    meta: { speed }
  });
}

export function getForcedMoveVector(state, entity) {
  const mode = getForcedMoveMode(entity);
  if (!mode) return null;

  const fear = getStatusEntry(entity, I.FEAR);
  const charm = getStatusEntry(entity, I.CHARM);
  const taunt = getStatusEntry(entity, I.TAUNT);
  const entry = taunt || charm || fear;
  const source = sourceFromEntry(state, entry);
  if (!source) return null;

  return towardPointVector(entity, source.x, source.y, mode === 'away');
}

function getForcedStatusMove(state, entity, effectId, invert = false) {
  const entry = getStatusEntry(entity, effectId);
  if (!entry) return null;

  if (effectId === I.BLINK) {
    if (!entry.meta?.done) {
      entity.x = entry.meta?.tx ?? entity.x;
      entity.y = entry.meta?.ty ?? entity.y;
      entry.meta = { ...(entry.meta ?? {}), done: true };
    }
    entry.durationLeft = 0;
    return { stopVoluntaryMove: true };
  }

  if (effectId === I.DASH) {
    const tx = entry.meta?.tx ?? entity.x;
    const ty = entry.meta?.ty ?? entity.y;
    const vector = towardPointVector(entity, tx, ty, false);
    if (!vector) {
      entry.durationLeft = 0;
      return { stopVoluntaryMove: true };
    }
    return {
      x: vector.x,
      y: vector.y,
      speed: entry.meta?.speed ?? entity.engine,
      stopVoluntaryMove: true
    };
  }

  const source = sourceFromEntry(state, entry);
  if (!source) {
    entry.durationLeft = 0;
    return null;
  }

  const vector = towardPointVector(entity, source.x, source.y, invert);
  if (!vector) {
    entry.durationLeft = 0;
    return { stopVoluntaryMove: true };
  }

  return {
    x: vector.x,
    y: vector.y,
    speed: entry.meta?.speed ?? entity.engine,
    stopVoluntaryMove: true
  };
}

export function consumeMotionOverride(state, entity) {
  return (
    getForcedStatusMove(state, entity, I.BLINK, false) ||
    getForcedStatusMove(state, entity, I.DASH, false) ||
    getForcedStatusMove(state, entity, I.PULL, false) ||
    getForcedStatusMove(state, entity, I.KNOCKBACK, true) ||
    getForcedStatusMove(state, entity, I.BUMP, true) ||
    (() => {
      const control = getForcedMoveVector(state, entity);
      return control ? { x: control.x, y: control.y, speed: entity.engine, stopVoluntaryMove: true } : null;
    })()
  );
}
