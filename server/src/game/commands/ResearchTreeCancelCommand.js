import { cancelResearchProjectGlobal } from '../structures/StructureResearchStation.js';
export function handleResearchTreeCancel(state, player, msg, timeMs) { return cancelResearchProjectGlobal(state, player, timeMs).ok; }
