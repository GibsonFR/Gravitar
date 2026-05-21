import { MOB_BEHAVIOR_IDS } from '../../../../shared/content/mobs/MobDefs.js';
import { updateMeleeChaseMob } from './behaviors/MeleeChaseBehavior.js';
import { updateRangedKiteMob } from './behaviors/RangedKiteBehavior.js';

export function updateMobBehavior(state, mob, target, dt, timeMs) {
  switch (mob.behaviorId) {
    case MOB_BEHAVIOR_IDS.RUSHER:
      updateMeleeChaseMob(state, mob, target, dt, timeMs);
      return;
    case MOB_BEHAVIOR_IDS.BOMBER:
    case MOB_BEHAVIOR_IDS.SKIRMISHER:
    case MOB_BEHAVIOR_IDS.SNIPER:
    case MOB_BEHAVIOR_IDS.SENTRY:
    default:
      updateRangedKiteMob(state, mob, target, dt, timeMs);
      return;
  }
}
