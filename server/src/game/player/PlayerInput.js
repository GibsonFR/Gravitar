import { clamp, screenToWorld } from '../util/Math.js';
import { applyPrimaryClick } from './PrimaryClick.js';
import { canAcceptInput, sanitizeInputMessage } from '../../net/protocol/InputMessage.js';

export function applyInputMessage(state, player, rawMsg, timeMs) {
  const msg = sanitizeInputMessage(rawMsg);
  if (!msg) return false;
  if (!canAcceptInput(player, timeMs)) return false;

  player.lastInputAt = timeMs;

  if (Number.isFinite(msg.vw)) player.viewportW = clamp(msg.vw, 200, 4096);
  if (Number.isFinite(msg.vh)) player.viewportH = clamp(msg.vh, 200, 4096);
  if (Number.isFinite(msg.msx)) player.mouseSx = msg.msx;
  if (Number.isFinite(msg.msy)) player.mouseSy = msg.msy;

  if (!player.sessionSetupPending && timeMs >= (player.ignoreClientPoseUntil ?? 0) && Number.isFinite(msg.cx) && Number.isFinite(msg.cy)) {
    // Prototype .io : pose client autoritaire. Les paquets de secteur plus anciens
    // sont ignorés pour éviter les allers-retours à la frontière.
    const seq = msg.sectorSeq | 0;
    const lastSeq = player.lastClientSectorSeq | 0;
    const acceptSectorPose = seq >= lastSeq;
    if (acceptSectorPose) {
      player.lastClientSectorSeq = seq;
      player.x = msg.cx;
      player.y = msg.cy;
      if (Number.isFinite(msg.csx)) player.sx = msg.csx | 0;
      if (Number.isFinite(msg.csy)) player.sy = msg.csy | 0;
    }
    if (Number.isFinite(msg.cvx)) player.vx = msg.cvx;
    if (Number.isFinite(msg.cvy)) player.vy = msg.cvy;
    if (Number.isFinite(msg.crot)) player.rot = msg.crot;
    if (Number.isFinite(msg.cthrust)) player.localThrust = msg.cthrust;
    const abilityFresh = (msg.abilitySeq | 0) > (player.lastClientAbilitySeq | 0);
    if (abilityFresh) player.lastClientAbilitySeq = msg.abilitySeq | 0;
    player.clientAuthoritativeUntil = timeMs + (abilityFresh ? 720 : 260);
  }

  if (!player.sessionSetupPending && Number.isFinite(msg.aimWorldX) && Number.isFinite(msg.aimWorldY)) {
    player.mouseSx = msg.aimWorldX - player.x + player.viewportW * 0.5;
    player.mouseSy = msg.aimWorldY - player.y + player.viewportH * 0.5;
  }

  if (!player.sessionSetupPending && msg.selectedKind && msg.selectedId) {
    player.selectedKind = msg.selectedKind;
    player.selectedId = msg.selectedId;
    player.autoTargetKind = msg.selectedKind;
    player.autoTargetId = msg.selectedId;
    player.hasMoveTarget = false;
    player.holdMoveAllowed = false;
  }

  if (player.sessionSetupPending) {
    player.abilityA = false;
    player.abilityZ = false;
    player.abilityE = false;
    player.abilityR = false;
    player.interactTap = false;
    player.rocketTap = false;
    return true;
  }

  player.abilityA = !!msg.a;
  player.abilityZ = !!msg.z;
  player.abilityE = !!msg.e;
  player.abilityR = !!msg.r;

  if (msg.interactTap) player.interactTap = true;
  if (msg.rocketTap) player.rocketTap = true;

  if (!msg.selectedKind && msg.moveWorld && Number.isFinite(msg.moveWorldX) && Number.isFinite(msg.moveWorldY)) {
    player.autoTargetKind = '';
    player.autoTargetId = 0;
    player.selectedKind = '';
    player.selectedId = 0;
    player.moveTx = msg.moveWorldX;
    player.moveTy = msg.moveWorldY;
    player.hasMoveTarget = true;
    player.holdMoveAllowed = true;
    player.groundMarkerX = msg.moveWorldX;
    player.groundMarkerY = msg.moveWorldY;
    player.groundMarkerTimer = 0.85;
  } else if (!msg.selectedKind && msg.primaryClick && Number.isFinite(msg.px) && Number.isFinite(msg.py)) {
    applyPrimaryClick(state, player, msg.px, msg.py);
  }

  if (msg.primaryHold && player.holdMoveAllowed && Number.isFinite(msg.px) && Number.isFinite(msg.py)) {
    player.autoTargetKind = '';
    player.autoTargetId = 0;
    const world = screenToWorld(player, msg.px, msg.py);
    player.moveTx = world.x;
    player.moveTy = world.y;
    player.hasMoveTarget = true;
    player.groundMarkerX = world.x;
    player.groundMarkerY = world.y;
    player.groundMarkerTimer = 0.85;
  }

  return true;
}
