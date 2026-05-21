import { getSimulationTimeMs } from '../util/Time.js';
import { updateMobBehavior } from './MobBehaviorRouter.js';
import { acquireTargetPlayer, getMobTarget, updateMobReturnHome } from './behaviors/MobBehaviorUtils.js';
import { tickMobPassive } from './MobAbilitySystem.js';

function updateSingleMob(state, mob, dt, timeMs) {
  if (!mob?.stats || mob.stats.hp <= 0) return;
  if ((mob.summonExpireAt || 0) > 0 && timeMs >= mob.summonExpireAt) {
    mob.stats.hp = 0;
    mob.deadAt = timeMs;
    return;
  }

  let target = getMobTarget(state, mob);
  if (!target) target = acquireTargetPlayer(state, mob);

  if (target) {
    tickMobPassive(state, mob, target, dt, timeMs);
    updateMobBehavior(state, mob, target, dt, timeMs);
    return;
  }

  updateMobReturnHome(mob, dt);
}

export function updateMobs(state, dt, timeMs = null) {
  timeMs = getSimulationTimeMs(state, timeMs);
  for (const mob of state.mobs.values()) updateSingleMob(state, mob, dt, timeMs);
}
