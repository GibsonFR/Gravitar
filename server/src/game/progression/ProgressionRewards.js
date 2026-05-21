import { getResourceDef } from '../../../../shared/content/resources/ResourceDefs.js';

export function getAsteroidXpReward(asteroid) {
  const spec = getResourceDef(asteroid?.resource) ?? { rarity: 1, spawnTier: 1 };
  const rarity = spec.rarity ?? 1;
  const yieldValue = Math.max(1, asteroid?.yieldValue ?? 1);
  const dist = Math.abs(asteroid?.sx ?? 0) + Math.abs(asteroid?.sy ?? 0);
  let xp = 1 + rarity;
  xp += Math.max(0, yieldValue - 1) * Math.max(1, ((rarity + 1) / 2) | 0);
  xp += Math.min(12, (dist / 5) | 0);
  xp += Math.max(0, (spec.spawnTier ?? 1) - 1) / 2;
  if (asteroid?.secret) xp += 14 + rarity * 2;
  return Math.max(1, Math.round(xp));
}

export function getMobXpReward(mob) {
  return Math.max(6, Math.round(mob?.xpReward ?? 10));
}

export function getPlayerKillXpReward(victim) {
  const victimLevel = victim?.progression?.level ?? 1;
  return Math.max(18, 24 + (victimLevel - 1) * 7);
}
