import { closeDroneStation } from '../structures/StructureLogistics.js';

export function handleDroneStationClose(state, player) {
  return closeDroneStation(player);
}
