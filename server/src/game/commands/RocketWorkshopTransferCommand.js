import { transferRocketWorkshopResource } from '../structures/StructureRocketWorkshop.js';
export function handleRocketWorkshopTransfer(state, player, msg, timeMs) {
  return transferRocketWorkshopResource(state, player, msg.structureId | 0, msg.resourceKey || '', msg.direction || 'deposit', msg.amount | 0 || 1, timeMs).ok;
}
