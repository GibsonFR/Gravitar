import { assignRocketAmmoToSlot } from '../rocket/RocketAmmoRules.js';

export function handleAssignRocketAmmo(state, player, msg, timeMs) {
  void state;
  const itemId = String(msg?.itemId || '').trim();
  const slot = Number.isFinite(msg?.slot) ? (msg.slot | 0) : 0;
  if (!itemId) return false;
  return assignRocketAmmoToSlot(player, itemId, slot, timeMs);
}
