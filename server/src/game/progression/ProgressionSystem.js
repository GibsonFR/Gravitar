import { getBastionExperienceMultiplier } from '../bastion/BastionBuffs.js';
import { nowMs } from '../util/Time.js';
import { computeNextXp, PLAYER_PROGRESSION_TUNING } from '../../../../shared/content/progression/PlayerProgressionTuning.js';
import { setPlayerHint } from '../player/PlayerUiHints.js';
import { syncPlayerFrameStats } from '../frames/FrameStatSync.js';
import { tryUpgradeAbility } from './AbilityInvestment.js';

function markXpGain(player, amount, reason) {
  const prog = player.progression;
  prog.recentXpGain = amount;
  prog.recentXpReason = reason || '';
  prog.xpPulseLeft = 1.2;
}

function handleLevelUp(player) {
  const prog = player.progression;
  prog.level = Math.min(PLAYER_PROGRESSION_TUNING.maxLevel, (prog.level ?? 1) + 1);
  prog.skillPoints = (prog.skillPoints ?? 0) + 1;
  prog.levelUpFlashLeft = 2.4;
  syncPlayerFrameStats(player, { restoreVitals: true, preserveRatios: false });
  setPlayerHint(player, `Niveau ${prog.level} • +1 point de sort`, 2.4);
}

export function gainPlayerXp(player, amount, reason = '') {
  if (!player?.progression || amount <= 0) return { gained: 0, leveledUp: false };
  const prog = player.progression;
  amount = Math.max(0, Math.round(amount * getBastionExperienceMultiplier(player)));
  if (amount <= 0) return { gained: 0, leveledUp: false };

  prog.xp += amount;
  markXpGain(player, amount, reason);

  let leveledUp = false;
  while (prog.level < PLAYER_PROGRESSION_TUNING.maxLevel && prog.xp >= prog.nextXp) {
    prog.xp -= prog.nextXp;
    prog.nextXp = computeNextXp(prog.nextXp);
    handleLevelUp(player);
    leveledUp = true;
  }

  if (prog.level >= PLAYER_PROGRESSION_TUNING.maxLevel) {
    prog.xp = Math.min(prog.xp, prog.nextXp);
  }

  return { gained: amount, leveledUp };
}

export function tickPlayerProgression(player, dt) {
  if (!player?.progression) return;
  if (player.progression.xpPulseLeft > 0) player.progression.xpPulseLeft = Math.max(0, player.progression.xpPulseLeft - dt);
  if (player.progression.levelUpFlashLeft > 0) player.progression.levelUpFlashLeft = Math.max(0, player.progression.levelUpFlashLeft - dt);
}

export function trySpendAbilityPoint(player, slot) {
  const result = tryUpgradeAbility(player, slot);
  if (!result.ok) {
    setPlayerHint(player, result.reason || "Impossible d'investir.", 1.8);
    return result;
  }
  setPlayerHint(player, `${slot} phase ${result.phase} • niveau investi ${result.investedLevel}`, 1.8);
  return result;
}
