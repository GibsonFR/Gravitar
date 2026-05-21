import { PLAYER_PROGRESSION_TUNING } from '../../../../../shared/content/progression/PlayerProgressionTuning.js';

export function createPlayerProgressionState() {
  return {
    level: PLAYER_PROGRESSION_TUNING.startLevel,
    xp: PLAYER_PROGRESSION_TUNING.startXp,
    nextXp: PLAYER_PROGRESSION_TUNING.startNextXp,
    skillPoints: PLAYER_PROGRESSION_TUNING.startSkillPoints,
    abilityLevels: { ...PLAYER_PROGRESSION_TUNING.freeAbilityLevels },
    xpPulseLeft: 0,
    levelUpFlashLeft: 0,
    recentXpGain: 0,
    recentXpReason: '',
    canSpendAt: 0
  };
}
