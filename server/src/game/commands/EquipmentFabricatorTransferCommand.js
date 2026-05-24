import { transferEquipmentFabricatorResource } from '../structures/StructureEquipmentFabricator.js';
export function handleEquipmentFabricatorTransfer(state, player, msg, timeMs) {
  return transferEquipmentFabricatorResource(state, player, msg.structureId | 0, msg.resourceKey || '', msg.direction || 'deposit', msg.amount | 0 || 1, timeMs).ok;
}
