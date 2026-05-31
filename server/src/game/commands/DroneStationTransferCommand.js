import { transferDroneStationDrone } from '../structures/StructureLogistics.js';

export function handleDroneStationTransfer(state, player, msg, timeMs) {
  return transferDroneStationDrone(state, player, msg.structureId | 0, msg.direction || 'deposit', msg.amount | 0 || 1, timeMs);
}
