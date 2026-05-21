import { blocksAttacks } from '../../status/StatusRack.js';
import { getMobOnHitStatuses, tryMobSpecial } from '../MobAbilitySystem.js';
import { distSq } from '../../util/Math.js';
import { spawnProjectile } from '../../projectile/ProjectileSystem.js';
import { clearMobVelocity, moveMobAway, moveMobToward, targetWithinLeash, clampMobToDemoCage, moveMobOrbitAround } from './MobBehaviorUtils.js';


function countLiveProjectilesForMob(state, mob) {
  let n = 0;
  for (const p of state.projectiles.values()) if (p.sourceKind === 'mob' && p.sourceId === mob.id) n++;
  return n;
}

function getMobProjectileCap(mob) {
  const base = {
    scoria: 2,
    stinger: 1,
    lancer: 1,
    nodule: 1,
    warden: 2,
    specter: 1,
    hydra: 1,
    apex: 1
  }[mob.abilityProfile] ?? 1;
  return mob.demoMob ? Math.max(1, base) : Math.max(1, base + (mob.elite && base < 2 ? 1 : 0));
}

function getMobAttackCooldown(mob) {
  const base = mob.attackCooldownMs | 0;
  const profileMul = {
    scoria: 2.55,
    stinger: 2.35,
    lancer: 3.25,
    nodule: 2.55,
    warden: 2.75,
    specter: 2.8,
    hydra: 2.65,
    apex: 2.35
  }[mob.abilityProfile] ?? 2.2;
  const demoMul = mob.demoMob ? 1.85 : 1;
  const minCd = mob.demoMob ? 2600 : 1650;
  return Math.max(minCd, Math.round(base * profileMul * demoMul));
}

function tryRangedAttack(state, mob, target, timeMs) {
  if (blocksAttacks(mob)) return false;
  const rr = mob.attackRange + (target.radius ?? 0);
  if (distSq(mob.x, mob.y, target.x, target.y) > rr * rr) return false;
  if (timeMs < (mob.nextAttackAt | 0)) return false;
  if (countLiveProjectilesForMob(state, mob) >= getMobProjectileCap(mob)) return false;

  mob.nextAttackAt = timeMs + getMobAttackCooldown(mob);
  spawnProjectile(
    state,
    mob,
    target.x,
    target.y,
    mob.projectileTint,
    mob.attackDamage,
    mob.projectileRadius,
    mob.projectileSpeed,
    mob.projectileRange,
    mob.projectileSplashRadius,
    timeMs,
    {
      sourceKind: 'mob',
      visualKind: mob.abilityProfile ? `mob_${mob.abilityProfile}` : 'mob_auto',
      onHitStatuses: getMobOnHitStatuses(mob),
      onSplashStatuses: getMobOnHitStatuses(mob),
      maxLifetimeMs: mob.demoMob ? 1800 : 2400
    }
  );
  return true;
}

export function updateRangedKiteMob(state, mob, target, dt, timeMs) {
  if (!targetWithinLeash(mob, target)) {
    mob.targetPlayerId = 0;
    clearMobVelocity(mob);
    return;
  }

  const d2 = distSq(mob.x, mob.y, target.x, target.y);
  const preferredRange = mob.preferredRange ?? Math.max(120, mob.attackRange - 48);
  const retreatRange = mob.retreatRange ?? Math.max(48, preferredRange * 0.55);

  let moved = false;
  if (mob.demoMob) {
    const cageX = mob.demoCageX ?? mob.homeX ?? mob.x;
    const cageY = mob.demoCageY ?? mob.homeY ?? mob.y;
    const orbitR = Math.max(55, Math.min((mob.demoCageRadius ?? 180) - 62, preferredRange * 0.38));
    const sign = (mob.id % 2) ? 1 : -1;
    const speed = ({ scoria: 0.42, stinger: 1.12, lancer: 0.32, nodule: 0.18, warden: 0.45, specter: 0.92, hydra: 0.5, apex: 0.72 }[mob.abilityProfile] ?? 0.5) * sign;
    moved = moveMobOrbitAround(mob, cageX, cageY, dt, orbitR, speed, (mob.id % 17) * 0.37);
  } else if (d2 > preferredRange * preferredRange) {
    moved = moveMobToward(mob, target.x, target.y, dt, preferredRange - 10);
  } else if (d2 < retreatRange * retreatRange) {
    moved = moveMobAway(mob, target.x, target.y, dt, retreatRange + 16);
  }
  if (!moved) clearMobVelocity(mob);
  clampMobToDemoCage(mob);

  if (!tryMobSpecial(state, mob, target, timeMs)) tryRangedAttack(state, mob, target, timeMs);
}
