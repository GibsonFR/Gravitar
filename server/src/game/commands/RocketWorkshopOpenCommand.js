import { openRocketWorkshop } from '../structures/StructureRocketWorkshop.js';
export function handleRocketWorkshopOpen(state, player, msg) {
  return openRocketWorkshop(state, player, msg.structureId | 0).ok;
}
