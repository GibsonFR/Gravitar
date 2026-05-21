export const PLAYER_PROGRESSION_TUNING = Object.freeze({
  startLevel: 1,
  startXp: 0,
  startNextXp: 50,
  startSkillPoints: 1,
  xpGrowthMultiplier: 1.24,
  xpGrowthFlat: 12,
  maxLevel: 99,
  freeAbilityLevels: Object.freeze({ A: 0, Z: 0, E: 0, R: 0 })
});

export function computeNextXp(currentNextXp) {
  return Math.max(1, Math.round((currentNextXp || PLAYER_PROGRESSION_TUNING.startNextXp) * PLAYER_PROGRESSION_TUNING.xpGrowthMultiplier + PLAYER_PROGRESSION_TUNING.xpGrowthFlat));
}
