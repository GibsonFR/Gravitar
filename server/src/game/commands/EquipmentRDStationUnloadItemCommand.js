import { unloadEquipmentRDItem } from '../structures/StructureEquipmentRDStation.js';
export function handleEquipmentRDStationUnloadItem(state, player, msg, timeMs) {
  return unloadEquipmentRDItem(state, player, msg.structureId | 0, msg.slot || 'input', timeMs).ok;
}
