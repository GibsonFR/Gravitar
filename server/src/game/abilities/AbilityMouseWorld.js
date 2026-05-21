import { screenToWorld } from '../util/Math.js';

export function getAbilityMouseWorld(player) {
  return screenToWorld(player, player.mouseSx, player.mouseSy);
}
