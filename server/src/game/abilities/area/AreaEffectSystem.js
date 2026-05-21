import { collectAttackablesInRadius, dealAreaDamage } from '../AbilityTargetQuery.js';
import { applyStatusSpecsToTargets } from '../../status/StatusApplication.js';

export function updateAreaEffects(state, dt) {
  for (const effect of state.areaEffects.values()) {
    effect.durationLeft -= dt;
    effect.tickLeft -= dt;

    while (effect.tickLeft <= 0 && effect.durationLeft > 0) {
      const owner = state.players.get(effect.ownerId);
      if (owner) {
        dealAreaDamage(state, owner, effect.x, effect.y, effect.radius, effect.damage);
        const hits = collectAttackablesInRadius(state, owner, effect.x, effect.y, effect.radius);
        applyStatusSpecsToTargets(state, owner, hits, effect.onTickStatuses);
      }
      effect.tickLeft += effect.tickEvery;
    }

    if (effect.durationLeft <= 0) state.areaEffects.delete(effect.id);
  }
}
