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

function acceptClientPose(player, msg, timeMs, abilityFresh) {
  if (player.sessionSetupPending || timeMs < (player.ignoreClientPoseUntil ?? 0)) return;
  if (!Number.isFinite(msg.cx) || !Number.isFinite(msg.cy)) return;

  // V83: client-authority assumée pour la pose locale.
  // Le serveur ne doit plus tirer depuis une ancienne position parce qu'il a raté/rejeté
  // une frame. On garde seulement des bornes grossières, puis la logique collision/secteur
  // du serveur corrige les cas impossibles.
  const seq = msg.sectorSeq | 0;
  const lastSeq = player.lastClientSectorSeq | 0;
  if (seq >= lastSeq) {
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
  player.lastClientPoseAt = timeMs;
  player.clientAuthoritativeUntil = timeMs + (abilityFresh ? 900 : 520);
}

function applyClientPoseFromAction(player, action, timeMs) {
  if (!action || player.sessionSetupPending || timeMs < (player.ignoreClientPoseUntil ?? 0)) return;
  if (!Number.isFinite(action.cx) || !Number.isFinite(action.cy)) return;
  player.x = action.cx;
  player.y = action.cy;
  if (Number.isFinite(action.csx)) player.sx = action.csx | 0;
  if (Number.isFinite(action.csy)) player.sy = action.csy | 0;
  if (Number.isFinite(action.cvx)) player.vx = action.cvx;
  if (Number.isFinite(action.cvy)) player.vy = action.cvy;
  if (Number.isFinite(action.crot)) player.rot = action.crot;
  if (Number.isFinite(action.cthrust)) player.localThrust = action.cthrust;
  player.lastClientPoseAt = timeMs;
  player.clientAuthoritativeUntil = timeMs + 650;
}


function applyActionPacket(state, player, action, timeMs) {
  if (!action || (action.seq | 0) <= (player.lastActionSeq | 0)) return;
  applyClientPoseFromAction(player, action, timeMs);
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
    if (action.kind === 'station' || action.attack === false) {
      clearAutoAttack(player);
    } else {
      player.autoTargetKind = action.kind;
      player.autoTargetId = action.id;
      player.nextShotAt = Math.min(player.nextShotAt || timeMs, timeMs + 35);
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
  if (!canAcceptInput(player, timeMs, msg.inputSeq | 0)) return false;

  player.lastInputAt = timeMs;

  if (Number.isFinite(msg.vw)) player.viewportW = clamp(msg.vw, 200, 4096);
  if (Number.isFinite(msg.vh)) player.viewportH = clamp(msg.vh, 200, 4096);
  if (Number.isFinite(msg.msx)) player.mouseSx = msg.msx;
  if (Number.isFinite(msg.msy)) player.mouseSy = msg.msy;

  const abilityFresh = (msg.abilitySeq | 0) > (player.lastClientAbilitySeq | 0);
  if (abilityFresh) player.lastClientAbilitySeq = msg.abilitySeq | 0;
  acceptClientPose(player, msg, timeMs, abilityFresh);

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
      player.nextShotAt = Math.min(player.nextShotAt || timeMs, timeMs + 35);
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

  const hasActionPackets = Array.isArray(msg.actions) && msg.actions.length > 0;
  if (hasActionPackets) {
    for (const action of msg.actions) applyActionPacket(state, player, action, timeMs);
    // Les actions modernes sont événementielles. On ne relit pas en plus les anciens
    // booléens maintenus sur plusieurs frames, sinon cast/rocket/interact peuvent être
    // rejoués ou entrer en conflit avec l'état local.
    player.abilityA = false;
    player.abilityZ = false;
    player.abilityE = false;
    player.abilityR = false;
  } else {
    player.abilityA = !!msg.a;
    player.abilityZ = !!msg.z;
    player.abilityE = !!msg.e;
    player.abilityR = !!msg.r;
    if (msg.interactTap) player.interactTap = true;
    if (msg.rocketTap) player.rocketTap = true;
  }

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
