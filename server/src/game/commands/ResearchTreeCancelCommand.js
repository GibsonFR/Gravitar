import { cancelGlobalResearchProject } from '../structures/StructureResearchStation.js';
export function handleResearchTreeCancel(state, player) { return cancelGlobalResearchProject(state, player).ok; }
