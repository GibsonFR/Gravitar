import { toggleResearchStation } from '../structures/StructureResearchStation.js';
export function handleResearchStationToggle(state, player, msg, timeMs) { return toggleResearchStation(state, player, msg.structureId | 0, msg.enabled !== false, timeMs).ok; }
