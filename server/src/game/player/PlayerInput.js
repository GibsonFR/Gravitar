import { clamp, screenToWorld } from '../util/Math.js';
import { applyPrimaryClick } from './PrimaryClick.js';
import { canAcceptInput, sanitizeInputMessage } from '../../net/protocol/InputMessage.js';

function clearAutoAttack(player) {
  player.autoTargetKind = '';
  player.autoTargetId = 0;
}

function setMoveTarget(player, x, y) {
  player.moveTx = x;
  player.moveTy = y;
  player.hasMoveTarget = true;
  player.holdMoveAllowed = true;
  player.groundMarkerX = x;
  player.groundMarkerY = y;
  player.groundMarkerTimer = 0.85;
  clearAutoAttack(player);
}

function applyActionPacket(state, player, action, timeMs) {
  if (!action || (action.seq | 0) <= (player.lastActionSeq | 0)) return;
  player.lastActionSeq = action.seq | 0;

  if (action.type === 'move') {
    setMoveTarget(player, action.x, action.y);
    return;
  }

  if (action.type === 'cancelAttack') {
    clearAutoAttack(player);
    return;
  }

  if (action.type === 'target') {
    player.selectedKind = action.kind;
    player.selectedId = action.id;
    if (action.kind === 'station') {
      clearAutoAttack(player);
    } else {
      player.autoTargetKind = action.kind;
      player.autoTargetId = action.id;
    }
    player.holdMoveAllowed = false;
    player.groundMarkerTimer = 0;
    player.lastClientSelectSeq = Math.max(player.lastClientSelectSeq | 0, action.selectSeq | 0);
    return;
  }

  if (action.type === 'cast') {
    if (Number.isFinite(action.aimX) && Number.isFinite(action.aimY)) {
      player.mouseSx = action.aimX - player.x + player.viewportW * 0.5;
      player.mouseSy = action.aimY - player.y + player.viewportH * 0.5;
    }
    if (!Array.isArray(player.pendingAbilityCasts)) player.pendingAbilityCasts = [];
    player.pendingAbilityCasts.push({ slot: action.slot, seq: action.seq | 0, timeMs });
    if (player.pendingAbilityCasts.length > 8) player.pendingAbilityCasts.splice(0, player.pendingAbilityCasts.length - 8);
    return;
  }

  if (action.type === 'rocket') {
    if (Number.isFinite(action.aimX) && Number.isFinite(action.aimY)) {
      player.mouseSx = action.aimX - player.x + player.viewportW * 0.5;
      player.mouseSy = action.aimY - player.y + player.viewportH * 0.5;
    }
    player.rocketTap = true;
    return;
  }

  if (action.type === 'interact') {
    player.interactTap = true;
  }
}

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

  if (!player.sessionSetupPending && msg.targetClick && msg.targetClickKind && msg.targetClickId) {
    const seq = msg.selectSeq | 0;
    if (seq >= (player.lastClientSelectSeq | 0)) {
      player.lastClientSelectSeq = seq;
      player.selectedKind = msg.targetClickKind;
      player.selectedId = msg.targetClickId;
      player.autoTargetKind = msg.targetClickKind;
      player.autoTargetId = msg.targetClickId;
      player.holdMoveAllowed = false;
      player.groundMarkerTimer = 0;
    }
  } else if (!player.sessionSetupPending && msg.selectedKind && msg.selectedId) {
    // Sélection visuelle persistante uniquement. L'auto-attaque ne s'arme que par
    // paquet action target/targetClick, et un paquet move la coupe explicitement.
    player.selectedKind = msg.selectedKind;
    player.selectedId = msg.selectedId;
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

  if (Array.isArray(msg.actions)) {
    for (const action of msg.actions) applyActionPacket(state, player, action, timeMs);
  }

  player.abilityA = !!msg.a;
  player.abilityZ = !!msg.z;
  player.abilityE = !!msg.e;
  player.abilityR = !!msg.r;

  if (msg.interactTap) player.interactTap = true;
  if (msg.rocketTap) player.rocketTap = true;

  if (msg.moveWorld && Number.isFinite(msg.moveWorldX) && Number.isFinite(msg.moveWorldY)) {
    // Move-click = ordre explicite de mouvement et annulation de l'auto-attaque.
    // La sélection visuelle peut rester, mais l'arme arrête de tirer.
    setMoveTarget(player, msg.moveWorldX, msg.moveWorldY);
  } else if (!msg.selectedKind && !msg.targetClick && msg.primaryClick && Number.isFinite(msg.px) && Number.isFinite(msg.py)) {
    applyPrimaryClick(state, player, msg.px, msg.py);
  }

  if (msg.primaryHold && player.holdMoveAllowed && Number.isFinite(msg.px) && Number.isFinite(msg.py)) {
    const world = screenToWorld(player, msg.px, msg.py);
    setMoveTarget(player, world.x, world.y);
  }

  return true;
}
