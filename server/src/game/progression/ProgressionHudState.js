import { getShipFrameDef } from '../../../../shared/content/frames/ShipFrameRegistry.js';
import { getVanguardAbilityTuning } from '../../../../shared/content/frames/vanguard/VanguardFrameSpec.js';
import { getSigilAbilityTuning } from '../../../../shared/content/frames/sigil/SigilFrameSpec.js';
import { getBulwarkAbilityTuning } from '../../../../shared/content/frames/bulwark/BulwarkFrameSpec.js';
import { getAbilityInvestedLevel, getAbilityPhase, buildAbilityUpgradeFlags } from './AbilityInvestment.js';

function getFrameSlotTuning(player, slot, investedLevel) {
  const level = Math.max(1, investedLevel || 1);
  if (player.frameId === 'vanguard') return getVanguardAbilityTuning(slot, level);
  if (player.frameId === 'sigil') return getSigilAbilityTuning(slot, level);
  if (player.frameId === 'bulwark') return getBulwarkAbilityTuning(slot, level, player.baseArmor ?? 0);
  return getVanguardAbilityTuning(slot, level);
}

function buildFrameSlotState(player, slot, label, cooldownLeft) {
  const investedLevel = getAbilityInvestedLevel(player, slot);
  const unlocked = investedLevel > 0;
  const tuning = getFrameSlotTuning(player, slot, investedLevel);
  return {
    slot,
    key: slot,
    label,
    investedLevel,
    phase: getAbilityPhase(player, slot),
    cooldownLeft,
    cooldownMax: unlocked ? tuning.baseCooldown : 0,
    energyCost: unlocked ? tuning.energyCost : null,
    unlocked,
    placeholder: false,
    frameId: player.frameId,
    tuning
  };
}

export function buildAbilityHudState(player) {
  const def = getShipFrameDef(player.frameId);
  const canUpgrade = buildAbilityUpgradeFlags(player);
  const slots = {};
  for (const slot of ['A', 'Z', 'E', 'R']) {
    slots[slot] = {
      ...buildFrameSlotState(player, slot, def.abilities[slot].label, player[`cooldown${slot}Left`] ?? 0),
      canUpgrade: canUpgrade[slot].ok,
      upgradeReason: canUpgrade[slot].reason
    };
  }
  return slots;
}


export function buildProgressionSnapshot(player) {
  const p = player.progression ?? {};
  return {
    level: p.level ?? 1,
    xp: p.xp ?? 0,
    nextXp: p.nextXp ?? 50,
    skillPoints: p.skillPoints ?? 0,
    recentXpGain: p.recentXpGain ?? 0,
    recentXpReason: p.recentXpReason ?? '',
    xpPulseLeft: p.xpPulseLeft ?? 0,
    levelUpFlashLeft: p.levelUpFlashLeft ?? 0
  };
}
