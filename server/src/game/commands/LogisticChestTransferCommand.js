import { transferLogisticChestResource } from '../structures/StructureLogistics.js';

export function handleLogisticChestTransfer(state, player, msg, timeMs) {
  return transferLogisticChestResource(state, player, msg.structureId | 0, msg.resourceKey || '', msg.amount, msg.direction, timeMs);
}
