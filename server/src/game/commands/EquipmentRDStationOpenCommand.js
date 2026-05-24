import { openEquipmentRDStation } from '../structures/StructureEquipmentRDStation.js';
export function handleEquipmentRDStationOpen(state, player, msg) { return openEquipmentRDStation(state, player, msg.structureId | 0).ok; }
