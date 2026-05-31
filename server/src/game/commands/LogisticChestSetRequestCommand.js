import { setLogisticChestRequest } from '../structures/StructureLogistics.js';

export function handleLogisticChestSetRequest(state, player, msg, timeMs) {
  return setLogisticChestRequest(state, player, msg.structureId | 0, msg.resourceKey || '', msg.delta | 0 || 0, msg.setTarget, timeMs);
}
