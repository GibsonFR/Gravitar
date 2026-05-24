import { transferEquipmentRDScience } from '../structures/StructureEquipmentRDStation.js';
export function handleEquipmentRDStationTransfer(state, player, msg, timeMs) {
  return transferEquipmentRDScience(state, player, msg.structureId | 0, msg.resourceKey || '', msg.direction || 'deposit', msg.amount | 0 || 1, timeMs).ok;
}
