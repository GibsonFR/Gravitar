import { transferResearchScience } from '../structures/StructureResearchStation.js';

export function handleResearchStationTransfer(state, player, msg, timeMs) {
  return transferResearchScience(
    state,
    player,
    msg.structureId | 0,
    msg.resourceKey || '',
    msg.direction || 'deposit',
    msg.amount | 0 || 1,
    timeMs
  ).ok;
}
