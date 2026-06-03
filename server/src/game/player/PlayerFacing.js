import { screenToWorld } from '../util/Math.js';
import { getTarget } from '../targeting/Targeting.js';

function setFacingFromVector(player, dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
  if (dx * dx + dy * dy < 1e-6) return;
  const aimRot = Math.atan2(dy, dx);
  player.aimRot = aimRot;
  player.rot = aimRot;
}

export function updatePlayerFacing(state, player) {
  if (player.autoTargetId) {
    const target = getTarget(state, player.autoTargetKind, player.autoTargetId);
    if (target) {
      setFacingFromVector(player, target.x - player.x, target.y - player.y);
      return;
    }
  }

  const mouseWorld = screenToWorld(player, player.mouseSx, player.mouseSy);
  setFacingFromVector(player, mouseWorld.x - player.x, mouseWorld.y - player.y);
}
