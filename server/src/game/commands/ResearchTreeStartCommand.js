import { startResearchProjectGlobal } from '../structures/StructureResearchStation.js';
export function handleResearchTreeStart(state, player, msg, timeMs) { return startResearchProjectGlobal(state, player, msg.projectId || '', timeMs).ok; }
