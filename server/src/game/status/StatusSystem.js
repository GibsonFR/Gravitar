import { tickStatusRack } from './StatusRack.js';
import { STATUS_EFFECT_IDS as I } from '../../../../shared/content/status/StatusEffectIds.js';
import { applyDamage } from '../combat/DamageSystem.js';

function tickEntityStatuses(state, entity, dt, timeMs) {
  if (!entity?.status) return;
  const tick = tickStatusRack(entity, dt);
  if (tick.periodicDamage <= 0) return;
  const hits = Array.isArray(tick.periodicHits) && tick.periodicHits.length
    ? tick.periodicHits
    : [{ effectId: '', amount: tick.periodicDamage, sourceId: tick.lastSourceId || 0 }];

  for (const hit of hits) {
    const source = hit.sourceId ? (state.players.get(hit.sourceId) ?? state.mobs.get(hit.sourceId) ?? null) : null;
    const sourcePlayer = source?.kind === 'player' ? source : null;
    applyDamage(state, entity, hit.amount, sourcePlayer, {
      isPeriodic: true,
      ignoreBreakOnHit: true,
      bypassShield: hit.effectId === I.POISON,
      visualKind: hit.effectId || 'periodic',
      timeMs
    });
  }
}

export function updateStatuses(state, dt, timeMs = null) {
  for (const player of state.players.values()) tickEntityStatuses(state, player, dt, timeMs);
  for (const mob of state.mobs.values()) tickEntityStatuses(state, mob, dt, timeMs);
  for (const asteroid of state.asteroids.values()) tickEntityStatuses(state, asteroid, dt, timeMs);
  if (state.structures?.values) {
    for (const structure of state.structures.values()) tickEntityStatuses(state, structure, dt, timeMs);
  }
}
