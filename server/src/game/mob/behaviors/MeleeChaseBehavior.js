import { applyDamage } from '../../combat/DamageSystem.js';
import { blocksAttacks } from '../../status/StatusRack.js';
import { applyStatusSpecs } from '../../status/StatusApplication.js';
import { getMobOnHitStatuses, tryMobSpecial } from '../MobAbilitySystem.js';
import { distSq, norm } from '../../util/Math.js';
import { clearMobVelocity, moveMobToward, targetWithinLeash, clampMobToDemoCage, moveMobOrbitAround } from './MobBehaviorUtils.js';

function tryMeleeAttack(state, mob, target, timeMs) {
  if (blocksAttacks(mob)) return false;
  const rr = mob.attackRange + (target.radius ?? 0);
  if (distSq(mob.x, mob.y, target.x, target.y) > rr * rr) return false;
  if (timeMs < (mob.nextAttackAt | 0)) return false;

  mob.nextAttackAt = timeMs + Math.max(mob.demoMob ? 1800 : 1250, Math.round((mob.attackCooldownMs | 0) * (mob.demoMob ? 2.1 : 1.45)));
  applyDamage(state, target, mob.attackDamage, null, { timeMs, visualKind: mob.abilityProfile ? `mob_${mob.abilityProfile}` : 'mob_melee' });
  applyStatusSpecs(state, mob, target, getMobOnHitStatuses(mob));

  const away = norm(target.x - mob.x, target.y - mob.y);
  if (!target.demoDummy) {
    target.x += away.x * (mob.contactPush * 0.08);
    target.y += away.y * (mob.contactPush * 0.08);
  }
  return true;
}

export function updateMeleeChaseMob(state, mob, target, dt, timeMs) {
  if (!targetWithinLeash(mob, target)) {
    mob.targetPlayerId = 0;
    clearMobVelocity(mob);
    return;
  }

  if (mob.demoMob) {
    const cageX = mob.demoCageX ?? mob.homeX ?? mob.x;
    const cageY = mob.demoCageY ?? mob.homeY ?? mob.y;
    const orbitR = Math.max(45, Math.min((mob.demoCageRadius ?? 180) - 58, 105));
    moveMobOrbitAround(mob, cageX, cageY, dt, orbitR, mob.abilityProfile === 'crusher' ? 0.48 : 0.85, (mob.id % 19) * 0.33);
  } else {
    moveMobToward(mob, target.x, target.y, dt, Math.max(0, mob.attackRange - 6));
  }
  clampMobToDemoCage(mob);
  if (tryMobSpecial(state, mob, target, timeMs)) return;
  tryMeleeAttack(state, mob, target, timeMs);
}
