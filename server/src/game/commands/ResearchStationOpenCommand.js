import { openResearchStation } from '../structures/StructureResearchStation.js';
export function handleResearchStationOpen(state, player, msg) { return openResearchStation(state, player, msg.structureId | 0).ok; }
