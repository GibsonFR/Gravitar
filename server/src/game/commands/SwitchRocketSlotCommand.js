import { switchActiveRocketSlot } from '../rocket/RocketAmmoRules.js';

export function handleSwitchRocketSlot(state, player, msg, timeMs) {
  void state;
  const slot = Number.isFinite(msg?.slot) ? (msg.slot | 0) : 0;
  return switchActiveRocketSlot(player, slot, timeMs);
}
