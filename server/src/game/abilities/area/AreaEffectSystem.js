import { collectAttackablesInRadius, dealAreaDamage } from '../AbilityTargetQuery.js';
import { applyStatusSpecsToTargets } from '../../status/StatusApplication.js';
import { onAreaEffectTickForFrame } from '../../frames/FrameGameplayHooks.js';
import { getSimulationTimeMs } from '../../util/Time.js';

export function updateAreaEffects(state, dt) {
  const timeMs = getSimulationTimeMs(state);
  for (const effect of state.areaEffects.values()) {
    effect.durationLeft -= dt;
    effect.tickLeft -= dt;

    while (effect.tickLeft <= 0 && effect.durationLeft > 0) {
      const owner = state.players.get(effect.ownerId);
      if (owner) {
        dealAreaDamage(state, owner, effect.x, effect.y, effect.radius, effect.damage, { sourceSlot: effect.slot || '', visualKind: 'ability_area' });
        const hits = collectAttackablesInRadius(state, owner, effect.x, effect.y, effect.radius);
        applyStatusSpecsToTargets(state, owner, hits, effect.onTickStatuses);
        for (const target of hits) onAreaEffectTickForFrame(state, owner, target, effect, timeMs);
      }
      effect.tickLeft += effect.tickEvery;
    }

    if (effect.durationLeft <= 0) {
      state.areaEffects.delete(effect.id);
    }
  }
}
