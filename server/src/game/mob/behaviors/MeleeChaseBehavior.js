import { applyDamage } from '../../combat/DamageSystem.js';
import { blocksAttacks } from '../../status/StatusRack.js';
import { applyStatusSpecs } from '../../status/StatusApplication.js';
import { getMobOnHitStatuses, tryMobSpecial } from '../MobAbilitySystem.js';
import { distSq, norm } from '../../util/Math.js';
import { queueWorldSfx } from '../../audio/WorldSfxState.js';
import { SFX_EVENT_TYPES } from '../../audio/SfxEventTypes.js';
import { clearMobVelocity, moveMobToward, targetWithinLeash, clampMobToDemoCage, moveMobOrbitAround } from './MobBehaviorUtils.js';

function tryMeleeAttack(state, mob, target, timeMs) {
  if (blocksAttacks(mob)) return false;
  const rr = mob.attackRange + (target.radius ?? 0);
  if (distSq(mob.x, mob.y, target.x, target.y) > rr * rr) return false;
  if (timeMs < (mob.nextAttackAt | 0)) return false;

  // V92: garde-fous anti "mobs blender".
  // Même si plusieurs rusher se superposent ou si le serveur reçoit une rafale de ticks,
  // un joueur ne doit pas prendre 10 coups de mêlée en quelques ms.
  if (!target._mobMeleeHitAtById) target._mobMeleeHitAtById = new Map();
  const previousFromThisMob = target._mobMeleeHitAtById.get(mob.id) || 0;
  if (timeMs - previousFromThisMob < 1550) {
    mob.nextAttackAt = Math.max(mob.nextAttackAt | 0, timeMs + 520);
    return false;
  }
  const previousAnyMelee = target._lastAnyMobMeleeHitAt || 0;
  if (timeMs - previousAnyMelee < 520) {
    mob.nextAttackAt = Math.max(mob.nextAttackAt | 0, timeMs + 620);
    return false;
  }

  target._mobMeleeHitAtById.set(mob.id, timeMs);
  target._lastAnyMobMeleeHitAt = timeMs;
  if (target._mobMeleeHitAtById.size > 64) {
    for (const [id, at] of target._mobMeleeHitAtById) if (timeMs - at > 8000) target._mobMeleeHitAtById.delete(id);
  }

  const cd = Math.max(mob.demoMob ? 2200 : 1800, Math.round((mob.attackCooldownMs | 0) * (mob.demoMob ? 2.4 : 1.65)));
  mob.nextAttackAt = timeMs + cd;
  applyDamage(state, target, Math.max(1, mob.attackDamage * 0.72), mob, { timeMs, visualKind: mob.abilityProfile ? `mob_${mob.abilityProfile}` : 'mob_melee', structureDamageMult: 0.6 });
  if (target.kind !== 'structure') applyStatusSpecs(state, mob, target, getMobOnHitStatuses(mob));
  queueWorldSfx(state, SFX_EVENT_TYPES.AUTO_ATTACK, mob.sx, mob.sy, mob.x, mob.y, mob.id | 0, {
    sourceKind: 'mob',
    mobProfile: mob.abilityProfile || 'default',
    mobId: mob.id,
    visualKind: mob.abilityProfile ? `mob_${mob.abilityProfile}` : 'mob_melee'
  });

  const away = norm(target.x - mob.x, target.y - mob.y);
  if (!target.demoDummy) {
    target.x += away.x * (mob.contactPush * 0.045);
    target.y += away.y * (mob.contactPush * 0.045);
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
  if (target.kind !== 'structure' && tryMobSpecial(state, mob, target, timeMs)) return;
  tryMeleeAttack(state, mob, target, timeMs);
}
