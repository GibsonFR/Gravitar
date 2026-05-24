import { loadEquipmentRDItem } from '../structures/StructureEquipmentRDStation.js';
export function handleEquipmentRDStationLoadItem(state, player, msg, timeMs) {
  return loadEquipmentRDItem(state, player, msg.structureId | 0, msg.itemId || '', timeMs).ok;
}
