import { claimRocketWorkshopAmmo } from '../structures/StructureRocketWorkshop.js';
export function handleRocketWorkshopClaim(state, player, msg, timeMs) {
  return claimRocketWorkshopAmmo(state, player, msg.structureId | 0, msg.itemId || '', msg.amount | 0 || 9999, timeMs).ok;
}
