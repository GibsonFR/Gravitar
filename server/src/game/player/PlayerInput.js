import { clamp, distSq, screenToWorld } from '../util/Math.js';
import { applyPrimaryClick } from './PrimaryClick.js';
import { getTargetForPlayer, isPlayerAttackable } from '../targeting/Targeting.js';
import { canAcceptInput, sanitizeInputMessage } from '../../net/protocol/InputMessage.js';
import { getStatusEntry } from '../status/StatusRack.js';
import { STATUS_EFFECT_IDS } from '../../../../shared/content/status/StatusEffectIds.js';



function hasHardClientControlLock(player) {
  return !!getStatusEntry(player, STATUS_EFFECT_IDS.TAUNT)
    || !!getStatusEntry(player, STATUS_EFFECT_IDS.FEAR)
    || !!getStatusEntry(player, STATUS_EFFECT_IDS.CHARM)
    || !!getStatusEntry(player, STATUS_EFFECT_IDS.SUPPRESS)
    || !!getStatusEntry(player, STATUS_EFFECT_IDS.STASIS);
}

function cancelClientAuthorityForControl(player) {
  player.clientAuthoritativeUntil = 0;
  player.clientAppliedAbilityPose = null;
  player._activeClientAppliedAbility = null;
  if (Array.isArray(player.pendingAbilityCasts)) player.pendingAbilityCasts.length = 0;
  player.abilityA = false;
  player.abilityZ = false;
  player.abilityE = false;
  player.abilityR = false;
  player.rocketTap = false;
}

function solidWallBounds(wall) {
  const w = Number.isFinite(wall?.w) && wall.w > 0 ? wall.w : (wall?.radius || 0) * 2;
  const h = Number.isFinite(wall?.h) && wall.h > 0 ? wall.h : (wall?.radius || 0) * 2;
  return {
    left: (wall?.x || 0) - w * 0.5,
    right: (wall?.x || 0) + w * 0.5,
    top: (wall?.y || 0) - h * 0.5,
    bottom: (wall?.y || 0) + h * 0.5
  };
}

function pointInsideExpandedRect(x, y, wall, pad) {
  const b = solidWallBounds(wall);
  return x >= b.left - pad && x <= b.right + pad && y >= b.top - pad && y <= b.bottom + pad;
}

function segmentHitsExpandedRect(x1, y1, x2, y2, wall, pad) {
  if (pointInsideExpandedRect(x1, y1, wall, pad) || pointInsideExpandedRect(x2, y2, wall, pad)) return true;
  const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / Math.max(8, pad * 0.45)));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (pointInsideExpandedRect(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, wall, pad)) return true;
  }
  return false;
}

function clientPoseCrossesSolidWall(state, player, oldX, oldY, oldSx, oldSy) {
  if ((oldSx | 0) !== (player.sx | 0) || (oldSy | 0) !== (player.sy | 0)) return false;
  const pad = Math.max(12, (player.radius || 22) + 1.5);
  const blockers = [
    ...(state?.asteroids?.values?.() || []),
    ...(state?.structures?.values?.() || [])
  ];
  for (const wall of blockers) {
    if (wall?.kind === 'structure' && wall?.type !== 'wall' && wall?.type !== 'door') continue;
    if (!wall?.solid && !wall?.bastionWall) continue;
    if ((wall.sx | 0) !== (player.sx | 0) || (wall.sy | 0) !== (player.sy | 0)) continue;
    if (segmentHitsExpandedRect(oldX, oldY, player.x, player.y, wall, pad)) return true;
  }
  return false;
}

function revertClientPose(player, oldX, oldY, oldSx, oldSy) {
  player.x = oldX;
  player.y = oldY;
  player.sx = oldSx | 0;
  player.sy = oldSy | 0;
  player.vx = 0;
  player.vy = 0;
  player.hasMoveTarget = false;
}

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
  player.moveIntentSeq = (player.moveIntentSeq | 0) + 1;
  player.moveIntentStartedAt = Date.now();
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
  player.moveIntentSeq = (player.moveIntentSeq | 0) + 1;
  player.moveIntentStartedAt = Date.now();
  clearAutoAttack(player, { clearSelection: options.clearSelection !== false });
}

function acceptClientPose(state, player, msg, timeMs, abilityFresh) {
  if (player.sessionSetupPending || timeMs < (player.ignoreClientPoseUntil ?? 0)) return;

  // Net V2:
  // - déplacement normal : le client envoie une intention, le serveur simule ;
  // - cx/cy ordinaires : hint/debug seulement ;
  // - dash/ability : autorité locale courte acceptée.
  //
  // Ne jamais recopier cx/cy sur un input de mouvement standard, sinon la fluidité
  // observée dépend directement de la fréquence d'input client.
  const clientPoseAuthority = Number.isFinite(player.clientAuthoritativeUntil) && timeMs <= player.clientAuthoritativeUntil;

  if (clientPoseAuthority && Number.isFinite(msg.cx) && Number.isFinite(msg.cy)) {
    const oldX = player.x;
    const oldY = player.y;
    const oldSx = player.sx | 0;
    const oldSy = player.sy | 0;
    const seq = msg.sectorSeq | 0;
    const lastSeq = player.lastClientSectorSeq | 0;
    if (seq >= lastSeq) {
      player.lastClientSectorSeq = seq;
      player.x = msg.cx;
      player.y = msg.cy;
      if (Number.isFinite(msg.csx)) player.sx = msg.csx | 0;
      if (Number.isFinite(msg.csy)) player.sy = msg.csy | 0;
      player.lastClientHintX = msg.cx;
      player.lastClientHintY = msg.cy;
      player.lastClientHintSx = player.sx | 0;
      player.lastClientHintSy = player.sy | 0;
      player.lastClientHintAt = timeMs;
      if (clientPoseCrossesSolidWall(state, player, oldX, oldY, oldSx, oldSy)) revertClientPose(player, oldX, oldY, oldSx, oldSy);
    }
    if (Number.isFinite(msg.cvx)) player.vx = msg.cvx;
    if (Number.isFinite(msg.cvy)) player.vy = msg.cvy;
  } else {
    if (Number.isFinite(msg.cx) && Number.isFinite(msg.cy)) {
      player.lastClientHintX = msg.cx;
      player.lastClientHintY = msg.cy;
      player.lastClientHintSx = Number.isFinite(msg.csx) ? (msg.csx | 0) : (player.sx | 0);
      player.lastClientHintSy = Number.isFinite(msg.csy) ? (msg.csy | 0) : (player.sy | 0);
      player.lastClientHintAt = timeMs;
    }
    if (Number.isFinite(msg.cvx)) player.lastClientHintVx = msg.cvx;
    if (Number.isFinite(msg.cvy)) player.lastClientHintVy = msg.cvy;
  }

  if (Number.isFinite(msg.crot)) {
    player.rot = msg.crot;
    player.visualRot = msg.crot;
    player.lastClientVisualRotAt = timeMs;
  }
  if (Number.isFinite(msg.cthrust)) player.localThrust = msg.cthrust;
  player.lastClientPoseAt = timeMs;

  // An ability input by itself must not enable long client pose authority.
  // Only an explicit client-applied dash branch may do that below. Otherwise
  // observers see movement cadence depend on sparse local input after a spell.
  if (abilityFresh) {
    player.lastAbilityFreshAt = timeMs;
  }
}

function applyClientPoseFromAction(state, player, action, timeMs) {
  if (!action || player.sessionSetupPending || timeMs < (player.ignoreClientPoseUntil ?? 0)) return;
  if (!Number.isFinite(action.cx) || !Number.isFinite(action.cy)) return;
  const oldX = player.x;
  const oldY = player.y;
  const oldSx = player.sx | 0;
  const oldSy = player.sy | 0;
  player.x = action.cx;
  player.y = action.cy;
  if (Number.isFinite(action.csx)) player.sx = action.csx | 0;
  if (Number.isFinite(action.csy)) player.sy = action.csy | 0;
  if (clientPoseCrossesSolidWall(state, player, oldX, oldY, oldSx, oldSy)) revertClientPose(player, oldX, oldY, oldSx, oldSy);
  if (Number.isFinite(action.cvx)) player.vx = action.cvx;
  if (Number.isFinite(action.cvy)) player.vy = action.cvy;
  if (Number.isFinite(action.crot)) {
    player.rot = action.crot;
    player.visualRot = action.crot;
    player.lastClientVisualRotAt = timeMs;
  }
  if (Number.isFinite(action.cthrust)) player.localThrust = action.cthrust;
  player.lastClientPoseAt = timeMs;
  if (action.type === 'cast' && action.clientAppliedDash) player.clientAuthoritativeUntil = timeMs + 1200;
}


function applyActionPacket(state, player, action, timeMs) {
  if (!action || (action.seq | 0) <= (player.lastActionSeq | 0)) return;

  // Très important : les actions de déplacement/target/interact ne doivent pas
  // réappliquer la pose locale du client. Elles ne transportent qu'une intention.
  // Les seules actions qui peuvent donner une autorité de pose temporaire sont
  // les abilities/dash explicitement traitées dans leur branche dédiée.
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
    if (action.clientAppliedDash && Number.isFinite(action.castLocalX) && Number.isFinite(action.castLocalY)) {
      const oldX = player.x;
      const oldY = player.y;
      const oldSx = player.sx | 0;
      const oldSy = player.sy | 0;
      player.x = action.castLocalX;
      player.y = action.castLocalY;
      if (Number.isFinite(action.castLocalSx)) player.sx = action.castLocalSx | 0;
      if (Number.isFinite(action.castLocalSy)) player.sy = action.castLocalSy | 0;
      if (clientPoseCrossesSolidWall(state, player, oldX, oldY, oldSx, oldSy)) revertClientPose(player, oldX, oldY, oldSx, oldSy);
    } else if (Number.isFinite(action.castLocalX) && Number.isFinite(action.castLocalY)) {
      player.lastClientAbilityHintX = action.castLocalX;
      player.lastClientAbilityHintY = action.castLocalY;
      player.lastClientAbilityHintAt = timeMs;
    }
    if (Number.isFinite(action.aimX) && Number.isFinite(action.aimY)) {
      player.mouseSx = action.aimX - player.x + player.viewportW * 0.5;
      player.mouseSy = action.aimY - player.y + player.viewportH * 0.5;
    }
    if (!Array.isArray(player.pendingAbilityCasts)) player.pendingAbilityCasts = [];
    const localAuthorityMs = action.clientAppliedDash
      ? Math.max(120, Math.min(360, Number(action.localAuthorityMs) || 220))
      : 0;
    const dashLine = Number.isFinite(action.dashStartX) && Number.isFinite(action.dashStartY) && Number.isFinite(action.dashEndX) && Number.isFinite(action.dashEndY)
      ? { startX: action.dashStartX, startY: action.dashStartY, endX: action.dashEndX, endY: action.dashEndY }
      : null;
    player.pendingAbilityCasts.push({
      slot: action.slot,
      seq: action.seq | 0,
      timeMs,
      // Non-dash spells must not become pose-authoritative. The client may have
      // played local feedback/projectile/animation, but the server must keep
      // simulating normal held movement from primaryHold.
      clientPoseApplied: !!action.clientAppliedDash,
      clientAppliedDash: !!action.clientAppliedDash,
      localAuthorityMs,
      dashLine,
      aimX: action.aimX,
      aimY: action.aimY
    });
    player.clientAppliedAbilityPose = action.clientAppliedDash
      ? { slot: action.slot, seq: action.seq | 0, until: timeMs + localAuthorityMs, dashAlreadyApplied: true, dashLine }
      : null;
    if (action.clientAppliedDash && localAuthorityMs > 0) {
      player.clientAuthoritativeUntil = Math.max(player.clientAuthoritativeUntil || 0, timeMs + localAuthorityMs);
    }
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
  player.lastInputSeq = msg.inputSeq | 0;

  if (Number.isFinite(msg.vw)) player.viewportW = clamp(msg.vw, 200, 4096);
  if (Number.isFinite(msg.vh)) player.viewportH = clamp(msg.vh, 200, 4096);
  if (Number.isFinite(msg.msx)) player.mouseSx = msg.msx;
  if (Number.isFinite(msg.msy)) player.mouseSy = msg.msy;

  const abilityFresh = (msg.abilitySeq | 0) > (player.lastClientAbilitySeq | 0);
  if (abilityFresh) player.lastClientAbilitySeq = msg.abilitySeq | 0;
  const controlLocked = hasHardClientControlLock(player);
  if (controlLocked) cancelClientAuthorityForControl(player);
  else acceptClientPose(state, player, msg, timeMs, abilityFresh);

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

  if (controlLocked) {
    // A hard control such as Provocation must not be overwritten by live browser input.
    // The server will drive movement and forced auto-attack for the duration.
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

  if (msg.primaryHold && Number.isFinite(msg.px) && Number.isFinite(msg.py)) {
    // The client only sends primaryHold when it has decided that the right mouse
    // drag is a movement hold (selection clicks use suppressRightHoldUntilUp and
    // therefore do not send primaryHold). After spells/sector transfers, old
    // legacy paths can leave holdMoveAllowed=false while the physical mouse is
    // still pressed; gating here makes the server stop moving until release/repress.
    const world = screenToWorld(player, msg.px, msg.py);
    player.holdMoveAllowed = true;
    player.lastPrimaryHoldMoveAt = timeMs;
    setMoveTarget(player, world.x, world.y, { clearSelection: true });
  }

  return true;
}
