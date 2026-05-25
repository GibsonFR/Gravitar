import { startRocketWorkshop } from '../structures/StructureRocketWorkshop.js';
export function handleRocketWorkshopStart(state, player, msg, timeMs) {
  return startRocketWorkshop(state, player, msg.structureId | 0, timeMs).ok;
}
