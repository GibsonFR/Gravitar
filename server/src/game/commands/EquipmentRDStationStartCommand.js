import { startEquipmentRDJob } from '../structures/StructureEquipmentRDStation.js';
export function handleEquipmentRDStationStart(state, player, msg, timeMs) { return startEquipmentRDJob(state, player, msg.structureId | 0, msg.itemId || '', msg.sciences || [], timeMs).ok; }
