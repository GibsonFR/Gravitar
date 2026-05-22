import { clamp, distSq, screenToWorld } from '../util/Math.js';
import { applyPrimaryClick } from './PrimaryClick.js';
import { getTargetForPlayer, isPlayerAttackable } from '../targeting/Targeting.js';
import { canAcceptInput, sanitizeInputMessage } from '../../net/protocol/InputMessage.js';

function clearAutoAttack(player, options = {}) {
  player.autoTargetKind = '';
  player.autoTargetId = 0;
  if (options.clearSelection) {
    player.selectedKind = '';
    player.selectedId = 0;
  }
}

function setApproachTarget(player, target, desiredRange) {
  if (!target) return false;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const d = Math.hypot(dx, dy);
  if (d <= Math.max(48, desiredRange)) return false;
  const nX = dx / Math.max(0.001, d);
  const nY = dy / Math.max(0.001, d);
  player.moveTx = target.x - nX * Math.max(60, desiredRange * 0.82);
  player.moveTy = target.y - nY * Math.max(60, desiredRange * 0.82);
  player.hasMoveTarget = true;
  player.holdMoveAllowed = false;
  player.groundMarkerX = player.moveTx;
  player.groundMarkerY = player.moveTy;
  player.groundMarkerTimer = 0.65;
  return true;
}

function setMoveTarget(player, x, y, options = {}) {
  player.moveTx = x;
  player.moveTy = y;
  player.hasMoveTarget = true;
  player.holdMoveAllowed = true;
  player.groundMarkerX = x;
  player.groundMarkerY = y;
  player.groundMarkerTimer = 0.85;
  clearAutoAttack(player, { clearSelection: options.clearSelection !== false });
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
  player.clientAuthoritativeUntil = timeMs + (abilityFresh ? 1400 : 650);
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
  player.clientAuthoritativeUntil = timeMs + 1200;
}


function applyActionPacket(state, player, action, timeMs) {
  if (!action || (action.seq | 0) <= (player.lastActionSeq | 0)) return;
  applyClientPoseFromAction(player, action, timeMs);
  player.lastActionSeq = action.seq | 0;

  if (action.type === 'move') {
    setMoveTarget(player, action.x, action.y, { clearSelection: true });
    return;
  }

  if (action.type === 'cancelAttack') {
    clearAutoAttack(player, { clearSelection: !!action.clearSelection });
    return;
  }

  if (action.type === 'target') {
    player.selectedKind = action.kind;
    player.selectedId = action.id;
    player.lastClientSelectSeq = Math.max(player.lastClientSelectSeq | 0, action.selectSeq | 0);
    player.holdMoveAllowed = false;
    player.groundMarkerTimer = 0;

    const target = getTargetForPlayer(state, player, action.kind, action.id);
    if (action.kind === 'station' || action.attack === false) {
      clearAutoAttack(player);
      player.stationIntentId = action.kind === 'station' ? action.id : 0;
      if (target) setApproachTarget(player, target, Math.max(110, (target.radius || 46) + 95));
      return;
    }

    if (!isPlayerAttackable(player, target)) {
      clearAutoAttack(player);
      return;
    }

    const sameTarget = player.autoTargetKind === action.kind && (player.autoTargetId | 0) === (action.id | 0);
    player.autoTargetKind = action.kind;
    player.autoTargetId = action.id;
    player.hasMoveTarget = false;

    // Un spam-clic sur la cible ne reset plus le cooldown d'auto-attaque.
    // Le premier clic arme vite le tir, les suivants gardent la cadence serveur.
    if (!sameTarget || !Number.isFinite(player.nextShotAt)) player.nextShotAt = Math.min(player.nextShotAt || timeMs, timeMs + 35);
    return;
  }

  if (action.type === 'cast') {
    if (Number.isFinite(action.aimX) && Number.isFinite(action.aimY)) {
      player.mouseSx = action.aimX - player.x + player.viewportW * 0.5;
      player.mouseSy = action.aimY - player.y + player.viewportH * 0.5;
    }
    if (!Array.isArray(player.pendingAbilityCasts)) player.pendingAbilityCasts = [];
    player.pendingAbilityCasts.push({ slot: action.slot, seq: action.seq | 0, timeMs, clientPoseApplied: true });
    player.clientAppliedAbilityPose = { slot: action.slot, seq: action.seq | 0, until: timeMs + 420 };
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
      const target = getTargetForPlayer(state, player, msg.targetClickKind, msg.targetClickId);
      if (msg.targetClickKind !== 'station' && isPlayerAttackable(player, target)) {
        const sameTarget = player.autoTargetKind === msg.targetClickKind && (player.autoTargetId | 0) === (msg.targetClickId | 0);
        player.autoTargetKind = msg.targetClickKind;
        player.autoTargetId = msg.targetClickId;
        if (!sameTarget || !Number.isFinite(player.nextShotAt)) player.nextShotAt = Math.min(player.nextShotAt || timeMs, timeMs + 35);
      } else {
        clearAutoAttack(player);
      }
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
    setMoveTarget(player, msg.moveWorldX, msg.moveWorldY, { clearSelection: true });
  } else if (!msg.selectedKind && !msg.targetClick && msg.primaryClick && Number.isFinite(msg.px) && Number.isFinite(msg.py)) {
    applyPrimaryClick(state, player, msg.px, msg.py);
  }

  if (msg.primaryHold && player.holdMoveAllowed && Number.isFinite(msg.px) && Number.isFinite(msg.py)) {
    const world = screenToWorld(player, msg.px, msg.py);
    setMoveTarget(player, world.x, world.y, { clearSelection: true });
  }

  return true;
}
