import { toggleRocketWorkshop } from '../structures/StructureRocketWorkshop.js';
export function handleRocketWorkshopToggle(state, player, msg, timeMs) {
  return toggleRocketWorkshop(state, player, msg.structureId | 0, msg.enabled, timeMs).ok;
}
