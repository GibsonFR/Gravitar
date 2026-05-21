import { forceUndock } from '../station/DockingSystem.js';

export function handleUndock(state, player) {
  void state;
  if (!player) return false;
  if (!player.dockPhase || player.dockPhase === 'none') return false;
  forceUndock(player);
  return true;
}
