import { trySpendAbilityPoint } from '../progression/ProgressionSystem.js';

export function handleUpgradeAbility(state, player, msg) {
  const slot = String(msg?.slot || '').toUpperCase();
  if (!['A', 'Z', 'E', 'R'].includes(slot)) return false;
  return !!trySpendAbilityPoint(player, slot).ok;
}
