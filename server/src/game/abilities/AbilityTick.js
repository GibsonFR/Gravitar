import { getBastionCooldownRecoveryMultiplier } from '../bastion/BastionBuffs.js';
import { ABILITY_SLOTS } from './AbilitySlots.js';

export function tickAbilityCooldowns(player, dt) {
  const recovery = Math.max(0.05, (player?.progressionBonuses?.cooldownRecoveryMult ?? 1) * getBastionCooldownRecoveryMultiplier(player));
  const tickDt = dt * recovery;
  for (const slot of ABILITY_SLOTS) {
    const key = `cooldown${slot}Left`;
    if (player[key] > 0) player[key] = Math.max(0, player[key] - tickDt);
  }
}

export function consumeAbilityEdge(player, slot) {
  const liveKey = `ability${slot}`;
  const prevKey = `prevAbility${slot}`;
  const pressed = !!player[liveKey] && !player[prevKey];
  player[prevKey] = !!player[liveKey];
  return pressed;
}
