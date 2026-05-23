import { wrapIntoSector } from '../../../shared/proc/SectorMath.js';

function finite(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function len(x, y) {
  return Math.hypot(x, y);
}

function norm(x, y) {
  const d = Math.hypot(x, y);
  if (d <= 0.0001) return { x: 0, y: 0 };
  return { x: x / d, y: y / d };
}

function angleLerp(a, b, t) {
  if (!Number.isFinite(a)) return b;
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.max(0, Math.min(1, t));
}


function solidWallBounds(wall) {
  const w = finite(wall?.w, 0) || finite(wall?.radius, 0) * 2;
  const h = finite(wall?.h, 0) || finite(wall?.radius, 0) * 2;
  return {
    left: finite(wall?.x, 0) - w * 0.5,
    right: finite(wall?.x, 0) + w * 0.5,
    top: finite(wall?.y, 0) - h * 0.5,
    bottom: finite(wall?.y, 0) + h * 0.5
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

function pushEntityOutOfWall(entity, wall, pad) {
  const b = solidWallBounds(wall);
  const cx = Math.max(b.left, Math.min(entity.x, b.right));
  const cy = Math.max(b.top, Math.min(entity.y, b.bottom));
  let dx = entity.x - cx;
  let dy = entity.y - cy;
  const d = Math.hypot(dx, dy);

  if (d > 0.0001 && d < pad) {
    const push = pad - d + 0.8;
    entity.x += (dx / d) * push;
    entity.y += (dy / d) * push;
    if (Math.abs(dx) > Math.abs(dy)) entity.vx = 0;
    else entity.vy = 0;
    return true;
  }

  if (entity.x > b.left - pad && entity.x < b.right + pad && entity.y > b.top - pad && entity.y < b.bottom + pad) {
    const pushLeft = Math.abs(entity.x - (b.left - pad));
    const pushRight = Math.abs((b.right + pad) - entity.x);
    const pushTop = Math.abs(entity.y - (b.top - pad));
    const pushBottom = Math.abs((b.bottom + pad) - entity.y);
    const minPush = Math.min(pushLeft, pushRight, pushTop, pushBottom);
    if (minPush === pushLeft) entity.x = b.left - pad - 0.8;
    else if (minPush === pushRight) entity.x = b.right + pad + 0.8;
    else if (minPush === pushTop) entity.y = b.top - pad - 0.8;
    else entity.y = b.bottom + pad + 0.8;
    entity.vx = 0;
    entity.vy = 0;
    return true;
  }
  return false;
}

function resolveLocalSolidWalls(store, me, oldX, oldY) {
  const pad = Math.max(12, finite(me?.radius, 22) + 1.5);
  const blockers = [
    ...(store?.asteroids?.values?.() || []),
    ...(store?.structures?.values?.() || [])
  ];
  for (const wall of blockers) {
    if (wall?.kind === 'structure' && wall?.type !== 'wall' && wall?.type !== 'door') continue;
    if (!wall?.solid && !wall?.bastionWall) continue;
    if ((wall.sx | 0) !== (me.sx | 0) || (wall.sy | 0) !== (me.sy | 0)) continue;
    if (Number.isFinite(oldX) && Number.isFinite(oldY) && segmentHitsExpandedRect(oldX, oldY, me.x, me.y, wall, pad)) {
      me.x = oldX;
      me.y = oldY;
      me.vx = 0;
      me.vy = 0;
      if (store.localPrediction) store.localPrediction.hasMoveTarget = false;
      return true;
    }
    if (pushEntityOutOfWall(me, wall, pad)) {
      if (store.localPrediction) store.localPrediction.hasMoveTarget = false;
      return true;
    }
  }
  return false;
}

function hasBlockingStatus(me) {
  const ids = new Set((me?.statuses ?? []).map((s) => String(s.id || s.effectId || '').toLowerCase()));
  return ids.has('root') || ids.has('stun') || ids.has('suppress') || ids.has('fear') || ids.has('sleep');
}

function getTarget(store, kind, id) {
  if (!kind || !id) return null;
  if (kind === 'player') return store.players.get(id) || null;
  if (kind === 'mob') return store.mobs.get(id) || null;
  if (kind === 'asteroid') return store.asteroids.get(id) || null;
  if (kind === 'station') return store.stations.get(id) || null;
  return null;
}

function getSelectedTarget(store) {
  const kind = store.localPrediction?.selectedKind || store.myState?.selectedKind || '';
  const id = store.localPrediction?.selectedId || store.myState?.selectedId || 0;
  return { kind, id, entity: getTarget(store, kind, id) };
}

function getAttackTarget(store) {
  const now = performance.now();
  const local = store.localPrediction || {};
  const kind = now < (local.attackUntil || 0) ? (local.attackKind || '') : '';
  const id = now < (local.attackUntil || 0) ? (local.attackId || 0) : 0;
  return { kind, id, entity: getTarget(store, kind, id) };
}

function getCooldownMax(myState, slot) {
  const hud = myState?.abilityHud?.[slot];
  return Math.max(0.15, finite(hud?.cooldownMax, finite(hud?.tuning?.baseCooldown, 0.6)));
}

function canSpendEnergy(me, myState, slot) {
  const cost = myState?.abilityHud?.[slot]?.energyCost;
  if (!Number.isFinite(cost)) return true;
  return finite(me?.vitals?.energy, finite(me?.stats?.energy, 9999)) >= cost;
}

function spendEnergyLocal(me, myState, slot) {
  const cost = myState?.abilityHud?.[slot]?.energyCost;
  if (!Number.isFinite(cost) || !me?.vitals) return;
  me.vitals.energy = Math.max(0, finite(me.vitals.energy, 0) - cost);
  const now = performance.now();
  me._localVitalsUntil = Math.max(me._localVitalsUntil || 0, now + 1500);
}

function getLocalAbilityReadyAt(store, slot) {
  const ready = store?.localPrediction?.localAbilityReadyAt?.[slot];
  return Number.isFinite(ready) ? ready : 0;
}

function setLocalAbilityReadyAt(store, slot, readyAt) {
  if (!store?.localPrediction) return;
  if (!store.localPrediction.localAbilityReadyAt) store.localPrediction.localAbilityReadyAt = {};
  if (!store.localPrediction.localAbilityLastCastAt) store.localPrediction.localAbilityLastCastAt = {};
  store.localPrediction.localAbilityReadyAt[slot] = readyAt;
  store.localPrediction.localAbilityLastCastAt[slot] = performance.now();
}

function canCastAbilityLocalFirst(store, me, myState, slot) {
  const now = performance.now();
  const lastLocalCastAt = store?.localPrediction?.localAbilityLastCastAt?.[slot] || 0;
  const localReadyAt = getLocalAbilityReadyAt(store, slot);
  if (lastLocalCastAt > 0) return now + 15 >= localReadyAt;
  const hud = myState?.abilityHud?.[slot];
  const serverCd = finite(myState?.cooldowns?.[slot], finite(hud?.cooldownLeft, 0));
  return serverCd <= 0.03;
}

function getLocalDashDistance(myState, slot) {
  const hud = myState?.abilityHud?.[slot];
  const tuning = hud?.tuning || hud || {};
  const frameId = String(myState?.frameId || '').toLowerCase();

  if (Number.isFinite(tuning.dashDistance) && tuning.dashDistance > 0) return tuning.dashDistance;
  if (Number.isFinite(tuning.eDashDistance) && tuning.eDashDistance > 0) return tuning.eDashDistance;

  if (frameId === 'vanguard' && slot === 'Z') return 190;
  if (frameId === 'sigil' && slot === 'E') return 175;
  return 0;
}

function getLocalMoveBoost(myState, slot) {
  const hud = myState?.abilityHud?.[slot];
  const tuning = hud?.tuning || hud || {};
  const frameId = String(myState?.frameId || '').toLowerCase();

  if (frameId === 'vanguard' && slot === 'Z') {
    return {
      pct: Number.isFinite(tuning.moveBoostPct) ? tuning.moveBoostPct : 0.22,
      duration: Number.isFinite(tuning.moveBoostDuration) ? tuning.moveBoostDuration : 2.0
    };
  }
  return { pct: 0, duration: 0 };
}


function getAbilityLocalAuthorityMs(myState, slot) {
  const frameId = String(myState?.frameId || '').toLowerCase();
  if (frameId === 'vanguard' && slot === 'Z') return 2400;
  if (frameId === 'sigil' && slot === 'E') return 2200;
  return 1500;
}

function applyLocalFrameAbilityState(store, me, slot, worldMouse, now) {
  const myState = store.myState;
  if (!myState) return;
  const frameId = String(myState.frameId || '').toLowerCase();
  myState.frameState = { ...(myState.frameState || {}) };
  if (frameId === 'vanguard' && slot === 'Z') {
    const boost = getLocalMoveBoost(myState, slot);
    if (boost.duration > 0) {
      myState.frameState.moveBoostLeft = Math.max(Number(myState.frameState.moveBoostLeft) || 0, boost.duration);
      myState.frameState.comboWindowLeft = Math.max(Number(myState.frameState.comboWindowLeft) || 0, 1.15);
      myState.frameState.trailLeft = Math.max(Number(myState.frameState.trailLeft) || 0, 0.32);
      myState.frameState.trailStartX = Number.isFinite(me?._localDashFromX) ? me._localDashFromX : me?.x;
      myState.frameState.trailStartY = Number.isFinite(me?._localDashFromY) ? me._localDashFromY : me?.y;
      myState.frameState.trailEndX = me?.x;
      myState.frameState.trailEndY = me?.y;
    }
  }
  if (frameId === 'vanguard' && slot === 'E') {
    myState.frameState.phaseLeft = Math.max(Number(myState.frameState.phaseLeft) || 0, 1.1);
  }
  if (frameId === 'vanguard' && slot === 'R') {
    myState.frameState.ultLeft = Math.max(Number(myState.frameState.ultLeft) || 0, 4.0);
  }
  if (frameId === 'sigil' && slot === 'E') {
    myState.frameState.dashGhostLeft = Math.max(Number(myState.frameState.dashGhostLeft) || 0, 0.35);
  }
  store.localPrediction.localAbilityAuthorityUntil = Math.max(store.localPrediction.localAbilityAuthorityUntil || 0, now + getAbilityLocalAuthorityMs(myState, slot));
  store.localPrediction.localFrameState = { ...(myState.frameState || {}) };
  store.localPrediction.localDerived = { ...(myState.derived || {}) };
}

function shouldProjectile(slot) {
  return slot === 'A' || slot === 'Z' || slot === 'R';
}

function localDamageFor(slot, rocket = false) {
  if (rocket) return 18;
  if (slot === 'R') return 32;
  if (slot === 'Z') return 20;
  if (slot === 'E') return 12;
  return 14;
}

function getLocalAutoInterval(store) {
  const rate = finite(store?.myState?.derived?.autoAttackRate, 0);
  if (rate > 0.05) return clamp(1 / rate, 0.12, 2.2);
  const hudRate = finite(store?.myState?.stats?.cadence, 0);
  if (hudRate > 0.05) return clamp(1 / hudRate, 0.12, 2.2);
  return 0.72;
}

function sameLocalTarget(a, b) {
  return !!a && !!b && String(a.kind || '') === String(b.kind || '') && (a.id | 0) === (b.id | 0);
}

function pinLocalEntityTarget(entity) {
  if (!entity) return;
  entity._tx = entity.x;
  entity._ty = entity.y;
}

export class ClientPrediction {
  constructor(store) {
    this.store = store;
    this.lastKeys = { A: false, Z: false, E: false, R: false, F: false, D: false };
    this.lastAttackFxAt = 0;
    this.localId = -1;
    this.localAutoCooldown = 0;
    this.lastLocalAutoTarget = null;
    this.lastSectorWrapAt = 0;
  }

  update(dt, input, view, camera) {
    const me = this.store.getMe();
    if (!me || (this.store.myState?.sessionSetup?.pending ?? true)) return;

    const loading = this.store.getLoadingState?.();
    if (loading?.active) {
      // Pendant un changement de secteur/portail, on fige l'intention locale.
      // Sinon le vaisseau continue vers l'ancien point cliqué pendant le chargement
      // puis semble glisser 3 secondes vers la frontière après le spawn.
      me.vx = 0;
      me.vy = 0;
      me._localThrust = 0;
      return;
    }

    const worldMouse = {
      x: camera.x + (input.msx - view.cssW * 0.5),
      y: camera.y + (input.msy - view.cssH * 0.5)
    };

    if (input.rightDown && input.holdActive) {
      this.store.cancelLocalAttack?.();
      this.store.setOptimisticMoveTarget(worldMouse.x, worldMouse.y, { fromHold: true, preserveSelection: true, keepAttack: false });
    }

    this.updateLocalFacing(me, worldMouse, dt);
    this.handleAbilityEdges(me, input, worldMouse);
    this.handleRocketEdge(me, input, worldMouse);
    this.predictMovement(me, dt);
    this.predictAutoAttackFx(me, dt);
  }

  queueNetAction(action) {
    const input = this.store?.inputRef || null;
    if (!input) return;
    if (!Array.isArray(input.actions)) input.actions = [];
    input.actionSeq = (input.actionSeq | 0) + 1;
    input.actions.push({ seq: input.actionSeq, time: performance.now(), ...action });
    if (input.actions.length > 32) input.actions.splice(0, input.actions.length - 32);
    input.forceSend = true;
  }

  handleAbilityEdges(me, input, worldMouse) {
    for (const slot of ['A', 'Z', 'E', 'R']) {
      const down = !!input[slot.toLowerCase()];
      if (down && !this.lastKeys[slot]) this.castAbilityOptimistic(me, slot, worldMouse);
      this.lastKeys[slot] = down;
    }
  }


  updateLocalFacing(me, worldMouse, dt) {
    if (!me) return;
    const attack = getAttackTarget(this.store);
    const selected = getSelectedTarget(this.store);
    let tx = null;
    let ty = null;
    // On oriente vers une cible seulement si une attaque active existe.
    // Une sélection visuelle simple ne doit pas bloquer la rotation du vaisseau.
    if (attack.entity && (attack.entity.sx | 0) === (me.sx | 0) && (attack.entity.sy | 0) === (me.sy | 0)) {
      tx = attack.entity.x;
      ty = attack.entity.y;
    } else if (selected.kind === 'station' && selected.entity && (selected.entity.sx | 0) === (me.sx | 0) && (selected.entity.sy | 0) === (me.sy | 0)) {
      tx = selected.entity.x;
      ty = selected.entity.y;
    } else if (this.store.localPrediction?.hasMoveTarget) {
      tx = this.store.localPrediction.moveX;
      ty = this.store.localPrediction.moveY;
    } else {
      tx = worldMouse.x;
      ty = worldMouse.y;
    }
    const dx = tx - me.x;
    const dy = ty - me.y;
    if (dx * dx + dy * dy > 0.001) {
      const desired = Math.atan2(dy, dx);
      me.rot = angleLerp(me.rot, desired, Math.min(1, Math.max(0.18, dt * 28)));
    }
  }

  handleRocketEdge(me, input, worldMouse) {
    const down = !!input.rocketTap;
    if (down && !this.lastKeys.F) {
      if (finite(me.rocketCooldownLeft, 0) <= 0 && finite(me.vitals?.energy, 999) > 1) {
        // V82: le client garde seulement le feedback HUD immédiat.
        // Les projectiles/dégâts roquette viennent du serveur pour éviter les tirs fantômes
        // quand le serveur refuse finalement l'action.
        me.rocketCooldownLeft = Math.max(0.25, finite(this.store.myState?.equipment?.launcher?.cooldown, 0.75));
        me._localActionFlashUntil = performance.now() + 160;
        this.queueNetAction({ type: 'rocket', aimX: worldMouse.x, aimY: worldMouse.y });
      }
    }
    this.lastKeys.F = down;
  }

  castAbilityOptimistic(me, slot, worldMouse) {
    const myState = this.store.myState;
    const hud = myState?.abilityHud?.[slot];
    if (hud && hud.unlocked === false) return;
    if (!canCastAbilityLocalFirst(this.store, me, myState, slot)) return;
    if (!canSpendEnergy(me, myState, slot)) return;

    const cd = getCooldownMax(myState, slot);
    setLocalAbilityReadyAt(this.store, slot, performance.now() + cd * 1000);
    if (!myState.cooldowns) myState.cooldowns = {};
    myState.cooldowns[slot] = cd;
    if (hud) hud.cooldownLeft = cd;
    const now = performance.now();
    this.store.noteLocalAbilityCast?.(slot, cd, { authorityMs: getAbilityLocalAuthorityMs(myState, slot) });
    me._keepLocalPoseUntil = Math.max(me._keepLocalPoseUntil || 0, now + 2600);
    spendEnergyLocal(me, myState, slot);

    const target = getSelectedTarget(this.store);
    const aim = target.entity || worldMouse;
    const dash = getLocalDashDistance(myState, slot);
    const dashStartX = me.x;
    const dashStartY = me.y;
    const appliedDash = dash > 0 && this.applyDash(me, worldMouse, dash);
    const dashEndX = me.x;
    const dashEndY = me.y;
    applyLocalFrameAbilityState(this.store, me, slot, worldMouse, now);
    const boost = getLocalMoveBoost(myState, slot);
    if (boost.pct > 0 && boost.duration > 0) {
      const local = this.store.localPrediction || {};
      local.localMoveBoostMult = Math.max(local.localMoveBoostMult || 1, 1 + boost.pct);
      local.localMoveBoostUntil = Math.max(local.localMoveBoostUntil || 0, performance.now() + boost.duration * 1000);
      me._localMoveBoostUntil = local.localMoveBoostUntil;
      me._localMoveBoostMult = local.localMoveBoostMult;
      const derivedSpeed = finite(myState?.derived?.moveSpeed, finite(me.engine, 250)) * local.localMoveBoostMult;
      local.localDerived = { ...(local.localDerived || myState?.derived || {}), moveSpeed: derivedSpeed };
    }
    // V92: seuls le mouvement/dash/HUD sont locaux. Les projectiles/dégâts restent serveur-authority.
    this.spawnLocalCastArea(me, aim, slot);
    me._localActionFlashUntil = performance.now() + 180;

    this.queueNetAction({
      type: 'cast',
      slot,
      aimX: aim.x,
      aimY: aim.y,
      clientAppliedDash: !!appliedDash,
      castLocalX: me.x,
      castLocalY: me.y,
      castLocalSx: me.sx | 0,
      castLocalSy: me.sy | 0,
      dashStartX,
      dashStartY,
      dashEndX,
      dashEndY,
      localAuthorityMs: getAbilityLocalAuthorityMs(myState, slot)
    });

    const label = hud?.label || slot;
    myState.hint = label;
    myState._optimisticHintLeft = 0.35;
  }

  spawnLocalCastArea(me, worldMouse, slot) {
    if (!this.store.areaEffects) return;
    if (slot !== 'E' && slot !== 'R') return;
    const id = this.localId--;
    this.store.areaEffects.set(id, {
      id,
      localOnly: true,
      ownerId: me.id,
      sx: me.sx | 0,
      sy: me.sy | 0,
      x: finite(worldMouse.x, me.x),
      y: finite(worldMouse.y, me.y),
      radius: slot === 'R' ? 92 : 58,
      durationLeft: slot === 'R' ? 0.34 : 0.22,
      ttl: slot === 'R' ? 0.34 : 0.22,
      color: slot === 'R' ? { r: 255, g: 205, b: 96 } : { r: 92, g: 255, b: 190 }
    });
  }

  applyDash(me, worldMouse, distPx) {
    if (hasBlockingStatus(me)) return false;
    const local = this.store.localPrediction || {};
    const d = norm(worldMouse.x - me.x, worldMouse.y - me.y);
    if (!d.x && !d.y) return false;

    const beforeX = me.x;
    const beforeY = me.y;
    const hadMoveTarget = !!local.hasMoveTarget;
    const moveX = local.moveX;
    const moveY = local.moveY;

    me.x += d.x * distPx;
    me.y += d.y * distPx;
    const dashSpeed = Math.max(finite(this.store.myState?.derived?.moveSpeed, me.engine || 250), distPx / 0.10);
    me.vx = d.x * dashSpeed;
    me.vy = d.y * dashSpeed;
    me.rot = Math.atan2(d.y, d.x);
    me._localThrust = 1;
    me._clientDashGrace = 0.70;
    me._localDashFromX = beforeX;
    me._localDashFromY = beforeY;
    if (resolveLocalSolidWalls(this.store, me, beforeX, beforeY)) {
      me._clientDashGrace = 0;
      me._localThrust = 0;
    }
    pinLocalEntityTarget(me);

    const now = performance.now();
    me._localDashUntil = now + 900;
    me._keepLocalPoseUntil = Math.max(me._keepLocalPoseUntil || 0, now + 3200);

    // Le dash ne consomme pas l'ordre de déplacement en cours : il saute juste une portion du trajet.
    if (hadMoveTarget && Number.isFinite(moveX) && Number.isFinite(moveY)) {
      local.hasMoveTarget = true;
      local.moveX = moveX;
      local.moveY = moveY;
      if (Math.hypot(moveX - me.x, moveY - me.y) <= 10 && !local.hold) local.hasMoveTarget = false;
    }
    local.abilityMovementLockUntil = Math.max(local.abilityMovementLockUntil || 0, now + 1);

    this.requestServerSectorWrapIfNeeded(me);
    return true;
  }

  spawnLocalProjectile(me, targetOrPoint, opts = {}) {
    if (!this.store.projectiles) return;
    const tx = finite(targetOrPoint?.x, me.x + 500);
    const ty = finite(targetOrPoint?.y, me.y);
    const d = norm(tx - me.x, ty - me.y);
    const speed = opts.rocket ? 820 : (opts.slot === 'R' ? 980 : 1250);
    const id = this.localId--;
    const targetKind = opts.targetKind || targetOrPoint?.kind || '';
    const targetId = opts.targetId || targetOrPoint?.id || 0;
    const distToTarget = Math.max(20, Math.hypot(tx - me.x, ty - me.y));
    this.store.projectiles.set(id, {
      id,
      localOnly: true,
      ownerId: me.id,
      sx: me.sx | 0,
      sy: me.sy | 0,
      x: me.x + d.x * 24,
      y: me.y + d.y * 24,
      vx: d.x * speed,
      vy: d.y * speed,
      radius: opts.rocket ? 6 : 4,
      color: opts.rocket ? { r: 255, g: 188, b: 92 } : { r: 130, g: 225, b: 255 },
      tint: opts.rocket ? { r: 255, g: 188, b: 92 } : { r: 130, g: 225, b: 255 },
      visualKind: opts.rocket ? 'rocket' : 'auto',
      sourceAbilitySlot: opts.slot || '',
      ttl: Math.max(opts.rocket ? 0.24 : 0.12, Math.min(opts.rocket ? 0.75 : 0.42, distToTarget / Math.max(1, speed) + 0.05)),
      _tx: tx,
      _ty: ty,
      _targetKind: targetKind,
      _targetId: targetId,
      _impactDamage: finite(opts.impactDamage, 0),
      _visualOnly: !!opts.visualOnly,
      _bornClientAt: performance.now(),
      _expectedServerEchoWindow: finite(opts.expectedServerEchoWindow, 0),
      _impactApplied: false,
      _impactRadius: opts.rocket ? 34 : 24
    });
  }

  predictAutoAttackFx(me, dt) {
    // V82: plus de boucle locale de tirs automatiques.
    // Le client garde le lock/feedback de sélection, mais les projectiles d'auto-attaque
    // viennent uniquement des snapshots serveur. Sinon, dès que le serveur annule
    // l'attaque, le client peut continuer à afficher des tirs fantômes pendant plusieurs secondes.
    this.localAutoCooldown = 0;
    this.lastLocalAutoTarget = null;
  }

  predictMovement(me, dt) {
    if (!Number.isFinite(dt) || dt <= 0 || hasBlockingStatus(me)) return;
    const local = this.store.localPrediction || {};
    const now = performance.now();
    if (now < finite(local.abilityMovementLockUntil, 0)) {
      me.vx *= Math.max(0, 1 - dt * 5);
      me.vy *= Math.max(0, 1 - dt * 5);
      me._localThrust = Math.max(finite(me._localThrust, 0), 0.75);
      pinLocalEntityTarget(me);
      return;
    }
    let tx = null;
    let ty = null;
    let stopDistance = 10;

    if (local.hasMoveTarget) {
      tx = local.moveX;
      ty = local.moveY;
      stopDistance = 10;
    } else {
      const attack = getAttackTarget(this.store);
      if (attack.entity && (attack.entity.sx | 0) === (me.sx | 0) && (attack.entity.sy | 0) === (me.sy | 0)) {
        const range = Math.max(120, finite(this.store.myState?.derived?.autoAttackRange, 620));
        const targetRadius = Math.max(0, finite(attack.entity.radius, 0));
        const dx = attack.entity.x - me.x;
        const dy = attack.entity.y - me.y;
        const d = Math.hypot(dx, dy);
        if (d > range + targetRadius * 0.25) {
          // Target-click hors portée = auto-approche jusqu'à portée, comme un MOBA.
          const desired = Math.max(60, range * 0.82 + targetRadius * 0.20);
          const n = norm(dx, dy);
          tx = attack.entity.x - n.x * desired;
          ty = attack.entity.y - n.y * desired;
          stopDistance = 22;
        }
      } else {
        const selected = getSelectedTarget(this.store);
        if (selected.kind === 'station' && selected.entity && (selected.entity.sx | 0) === (me.sx | 0) && (selected.entity.sy | 0) === (me.sy | 0)) {
          tx = selected.entity.x;
          ty = selected.entity.y;
          stopDistance = Math.max(70, finite(selected.entity.radius, 46) + 70);
        }
      }
    }

    if (!Number.isFinite(tx) || !Number.isFinite(ty)) {
      me.vx = Math.abs(me.vx || 0) < 1 ? 0 : (me.vx || 0) * Math.max(0, 1 - dt * 18);
      me.vy = Math.abs(me.vy || 0) < 1 ? 0 : (me.vy || 0) * Math.max(0, 1 - dt * 18);
      me._localThrust = Math.max(0, finite(me._localThrust, 0) - dt * 8);
      pinLocalEntityTarget(me);
      return;
    }

    const dx = tx - me.x;
    const dy = ty - me.y;
    const d = Math.hypot(dx, dy);
    if (d <= stopDistance) {
      if (local.hasMoveTarget && !local.hold) local.hasMoveTarget = false;
      me.vx = 0;
      me.vy = 0;
      me._localThrust = Math.max(0, finite(me._localThrust, 0) - dt * 10);
      pinLocalEntityTarget(me);
      return;
    }

    let speed = finite(this.store.myState?.derived?.moveSpeed, finite(me.engine, 250));
    const predLocal = this.store.localPrediction || {};
    if (performance.now() < finite(predLocal.localMoveBoostUntil, 0)) speed *= Math.max(1, finite(predLocal.localMoveBoostMult, 1));
    const step = Math.min(d, speed * dt);
    const oldX = me.x;
    const oldY = me.y;
    me.x += (dx / d) * step;
    me.y += (dy / d) * step;
    me.vx = (dx / d) * speed;
    me.vy = (dy / d) * speed;
    if (resolveLocalSolidWalls(this.store, me, oldX, oldY)) {
      me._localThrust = 0;
      pinLocalEntityTarget(me);
      return;
    }
    me.rot = angleLerp(me.rot, Math.atan2(dy, dx), Math.min(1, Math.max(0.22, dt * 30)));
    me._localThrust = Math.min(1, Math.max(finite(me._localThrust, 0), Math.min(1, d / 180)));
    pinLocalEntityTarget(me);
    this.requestServerSectorWrapIfNeeded(me);
  }

  requestServerSectorWrapIfNeeded(me) {
    const now = performance.now();
    if (now < finite(me._sectorLockUntil, 0)) return;
    const over = 18;
    const crossed = me.x < -2000 - over || me.x > 2000 + over || me.y < -2000 - over || me.y > 2000 + over;
    if (!crossed) return;

    // V87: le client ne wrapppe plus lui-même les secteurs. Il laisse volontairement
    // sa pose dépasser la frontière et envoie cette pose au serveur. Le serveur fait
    // le wrap exact avec l'overshoot réel puis renvoie un forceServerPose.
    // Ça évite le double-wrap local/serveur responsable des spawns trop loin/au centre.
    const local = this.store.localPrediction || {};
    local.hasMoveTarget = false;
    local.hold = false;
    local.moveX = me.x;
    local.moveY = me.y;
    this.store.setOptimisticSelection('', 0);
    this.store.cancelLocalAttack?.({ keepSeq: false });
    me.hasMoveTarget = false;
    me.vx = 0;
    me.vy = 0;
    me._localThrust = 0;
    me._sectorLockUntil = now + 900;
    me._keepLocalPoseUntil = 0;
    local.sectorSeq = (local.sectorSeq | 0) + 1;
    this.store.beginPortalLoading?.('Chargement du secteur…', 520, local.sectorSeq | 0);
  }


  reconcileSoftly(me, dt, isMoving = false) {
    return;
  }
}
