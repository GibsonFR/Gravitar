import { startGlobalResearchProject } from '../structures/StructureResearchStation.js';
export function handleResearchTreeStart(state, player, msg, timeMs) { return startGlobalResearchProject(state, player, msg.projectId || '', timeMs).ok; }
