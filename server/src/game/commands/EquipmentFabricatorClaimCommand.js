import { claimEquipmentFabricatorOutput } from '../structures/StructureEquipmentFabricator.js';
export function handleEquipmentFabricatorClaim(state, player, msg, timeMs) {
  return claimEquipmentFabricatorOutput(state, player, msg.structureId | 0, msg.itemId || '', timeMs).ok;
}
