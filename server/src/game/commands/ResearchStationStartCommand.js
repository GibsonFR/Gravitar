import { startResearchProject } from '../structures/StructureResearchStation.js';
export function handleResearchStationStart(state, player, msg, timeMs) { return startResearchProject(state, player, msg.structureId | 0, msg.projectId || '', timeMs).ok; }
