import { openLogisticChest } from '../structures/StructureLogistics.js';

export function handleLogisticChestOpen(state, player, msg) {
  return openLogisticChest(state, player, msg.structureId | 0);
}
