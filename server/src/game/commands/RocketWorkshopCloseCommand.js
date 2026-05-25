import { closeRocketWorkshop } from '../structures/StructureRocketWorkshop.js';
export function handleRocketWorkshopClose(state, player) {
  return closeRocketWorkshop(player);
}
