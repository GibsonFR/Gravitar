const TIER_POINT_REQUIREMENTS = Object.freeze([0, 1, 3, 6, 10, 15]);

export const ABILITY_PROGRESSION = Object.freeze({
  maxTier: 5,
  maxPoints: 15,
  maxUltimatePoints: 5,
  tierPointRequirements: TIER_POINT_REQUIREMENTS
});

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function getDisplayedPhase(slot, investedLevel) {
  if (slot === 'R') return clamp(investedLevel | 0, 0, ABILITY_PROGRESSION.maxUltimatePoints);
  return getTierFromPoints(investedLevel | 0);
}

export function getMaxInvestedPointsForSlot(slot) {
  return slot === 'R' ? ABILITY_PROGRESSION.maxUltimatePoints : ABILITY_PROGRESSION.maxPoints;
}

export function getTierFromPoints(points) {
  points = clamp(points | 0, 0, ABILITY_PROGRESSION.maxPoints);
  for (let tier = ABILITY_PROGRESSION.maxTier; tier >= 1; tier -= 1) {
    if (points >= TIER_POINT_REQUIREMENTS[tier]) return tier;
  }
  return 0;
}

export function getPointRequirementForTier(tier) {
  if (tier <= 0) return 0;
  tier = clamp(tier | 0, 1, ABILITY_PROGRESSION.maxTier);
  return TIER_POINT_REQUIREMENTS[tier];
}

export function getUltimateUnlockPlayerLevel(nextUltimateLevel) {
  return 6 + Math.max(0, (nextUltimateLevel | 0) - 1) * 5;
}
