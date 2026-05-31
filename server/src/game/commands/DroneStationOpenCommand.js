import { openDroneStation } from '../structures/StructureLogistics.js';

export function handleDroneStationOpen(state, player, msg) {
  return openDroneStation(state, player, msg.structureId | 0);
}
