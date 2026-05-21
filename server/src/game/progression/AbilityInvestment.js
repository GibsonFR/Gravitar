import {
  getDisplayedPhase,
  getMaxInvestedPointsForSlot,
  getTierFromPoints,
  getUltimateUnlockPlayerLevel
} from '../../../../shared/content/progression/AbilityProgression.js';

const BASE_SLOTS = ['A', 'Z', 'E'];

function getAbilityBag(player) {
  return player?.progression?.abilityLevels ?? { A: 0, Z: 0, E: 0, R: 0 };
}

export function getAbilityInvestedLevel(player, slot) {
  return Math.max(0, Math.min(getMaxInvestedPointsForSlot(slot), getAbilityBag(player)[slot] ?? 0));
}

export function getAbilityPhase(player, slot) {
  return getDisplayedPhase(slot, getAbilityInvestedLevel(player, slot));
}

function getBaseAbilityBalanceCap(player, slot) {
  if (!BASE_SLOTS.includes(slot)) return getMaxInvestedPointsForSlot(slot);
  const others = BASE_SLOTS.filter((s) => s !== slot).map((s) => getAbilityInvestedLevel(player, s));
  return Math.min(getMaxInvestedPointsForSlot(slot), Math.max(...others) + 1);
}

export function canUpgradeAbility(player, slot) {
  if (!player?.progression) return { ok: false, reason: 'Progression absente.' };
  if (!['A', 'Z', 'E', 'R'].includes(slot)) return { ok: false, reason: 'Sort invalide.' };
  if ((player.progression.skillPoints ?? 0) <= 0) return { ok: false, reason: 'Aucun point de sort.' };

  const current = getAbilityInvestedLevel(player, slot);
  const maxLevel = getMaxInvestedPointsForSlot(slot);
  if (current >= maxLevel) return { ok: false, reason: 'Niveau maximum atteint.' };

  const nextLevel = current + 1;
  if (slot !== 'R') {
    const balanceCap = getBaseAbilityBalanceCap(player, slot);
    if (nextLevel > balanceCap) {
      return { ok: false, reason: `Équilibrage requis : ${slot} ne peut pas dépasser ${balanceCap} pour l'instant.` };
    }
  } else {
    const neededLevel = getUltimateUnlockPlayerLevel(nextLevel);
    const playerLevel = player.progression.level ?? 1;
    if (playerLevel < neededLevel) {
      return { ok: false, reason: `Le niveau ${neededLevel} est requis pour investir R${nextLevel}.` };
    }
  }

  return { ok: true, reason: `Ctrl+${slot} pour investir 1 point.` };
}

export function tryUpgradeAbility(player, slot) {
  const gate = canUpgradeAbility(player, slot);
  if (!gate.ok) return gate;
  player.progression.skillPoints = Math.max(0, (player.progression.skillPoints ?? 0) - 1);
  getAbilityBag(player)[slot] = getAbilityInvestedLevel(player, slot) + 1;
  return {
    ok: true,
    investedLevel: getAbilityInvestedLevel(player, slot),
    phase: getAbilityPhase(player, slot)
  };
}

export function buildAbilityUpgradeFlags(player) {
  return {
    A: canUpgradeAbility(player, 'A'),
    Z: canUpgradeAbility(player, 'Z'),
    E: canUpgradeAbility(player, 'E'),
    R: canUpgradeAbility(player, 'R')
  };
}
