import { closeLogisticChest } from '../structures/StructureLogistics.js';

export function handleLogisticChestClose(state, player) {
  return closeLogisticChest(player);
}
