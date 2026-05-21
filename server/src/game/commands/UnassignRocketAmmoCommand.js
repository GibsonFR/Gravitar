import { unassignRocketAmmoSlot } from '../rocket/RocketAmmoRules.js';

export function handleUnassignRocketAmmo(state, player, msg, timeMs) {
  void state;
  const slot = Number.isFinite(msg?.slot) ? (msg.slot | 0) : 0;
  return unassignRocketAmmoSlot(player, slot, timeMs);
}
