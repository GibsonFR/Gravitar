import { cancelEquipmentRDJob } from '../structures/StructureEquipmentRDStation.js';
export function handleEquipmentRDStationCancel(state, player, msg, timeMs) { return cancelEquipmentRDJob(state, player, msg.structureId | 0, timeMs).ok; }
