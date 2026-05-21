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
}

function shouldDash(myState, slot) {
  const frameId = String(myState?.frameId || '').toLowerCase();
  if (frameId === 'vanguard' && slot === 'Z') return 190;
  if (frameId === 'sigil' && slot === 'E') return 175;
  return 0;
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

export class ClientPrediction {
  constructor(store) {
    this.store = store;
    this.lastKeys = { A: false, Z: false, E: false, R: false, F: false, D: false };
    this.lastAttackFxAt = 0;
    this.localId = -1;
    this.localAutoCooldown = 0;
  }

  update(dt, input, view, camera) {
    const me = this.store.getMe();
    if (!me || (this.store.myState?.sessionSetup?.pending ?? true)) return;

    const worldMouse = {
      x: camera.x + (input.msx - view.cssW * 0.5),
      y: camera.y + (input.msy - view.cssH * 0.5)
    };

    if (input.rightDown && input.holdActive) {
      this.store.setOptimisticSelection('', 0);
      this.store.setOptimisticMoveTarget(worldMouse.x, worldMouse.y, { fromHold: true });
    }

    this.handleAbilityEdges(me, input, worldMouse);
    this.handleRocketEdge(me, input, worldMouse);
    this.predictMovement(me, dt);
    this.predictAutoAttackFx(me, dt);
  }

  handleAbilityEdges(me, input, worldMouse) {
    for (const slot of ['A', 'Z', 'E', 'R']) {
      const down = !!input[slot.toLowerCase()];
      if (down && !this.lastKeys[slot]) this.castAbilityOptimistic(me, slot, worldMouse);
      this.lastKeys[slot] = down;
    }
  }

  handleRocketEdge(me, input, worldMouse) {
    const down = !!input.rocketTap;
    if (down && !this.lastKeys.F) {
      if (finite(me.rocketCooldownLeft, 0) <= 0 && finite(me.vitals?.energy, 999) > 1) {
        me.rocketCooldownLeft = Math.max(0.25, finite(this.store.myState?.equipment?.launcher?.cooldown, 0.75));
        const target = getSelectedTarget(this.store);
        this.spawnLocalProjectile(me, target.entity || worldMouse, { rocket: true, targetKind: target.kind, targetId: target.id, impactDamage: localDamageFor('', true) });
        if (target.entity && target.kind !== 'station') this.store.applyLocalDamage(target.kind, target.id, localDamageFor('', true), target.entity.x, target.entity.y);
      }
    }
    this.lastKeys.F = down;
  }

  castAbilityOptimistic(me, slot, worldMouse) {
    const myState = this.store.myState;
    const hud = myState?.abilityHud?.[slot];
    if (hud && hud.unlocked === false) return;
    if (finite(myState?.cooldowns?.[slot], finite(hud?.cooldownLeft, 0)) > 0.03) return;
    if (!canSpendEnergy(me, myState, slot)) return;

    const cd = getCooldownMax(myState, slot);
    if (!myState.cooldowns) myState.cooldowns = {};
    myState.cooldowns[slot] = cd;
    if (hud) hud.cooldownLeft = cd;
    spendEnergyLocal(me, myState, slot);

    const target = getSelectedTarget(this.store);
    const aim = target.entity || worldMouse;
    const dash = shouldDash(myState, slot);
    if (dash > 0) this.applyDash(me, worldMouse, dash);
    if (shouldProjectile(slot)) this.spawnLocalProjectile(me, aim, { slot, targetKind: target.kind, targetId: target.id, impactDamage: localDamageFor(slot) });
    if (target.entity && target.kind !== 'station') this.store.applyLocalDamage(target.kind, target.id, localDamageFor(slot), target.entity.x, target.entity.y);
    this.spawnLocalCastArea(me, aim, slot);

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
    if (hasBlockingStatus(me)) return;
    const d = norm(worldMouse.x - me.x, worldMouse.y - me.y);
    me.x += d.x * distPx;
    me.y += d.y * distPx;
    me.vx = d.x * finite(this.store.myState?.derived?.moveSpeed, me.engine || 250);
    me.vy = d.y * finite(this.store.myState?.derived?.moveSpeed, me.engine || 250);
    me._clientDashGrace = 0.12;
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
      _impactApplied: false,
      _impactRadius: opts.rocket ? 34 : 24
    });
  }

  predictAutoAttackFx(me, dt) {
    this.localAutoCooldown = Math.max(0, this.localAutoCooldown - Math.max(0, dt));
    const target = getSelectedTarget(this.store);
    if (!target.entity || target.kind === 'station') return;
    const range = 420;
    const dx = target.entity.x - me.x;
    const dy = target.entity.y - me.y;
    if (dx * dx + dy * dy > range * range) return;
    if (this.localAutoCooldown > 0) return;
    this.localAutoCooldown = 0.22;
    this.lastAttackFxAt = performance.now();
    this.spawnLocalProjectile(me, target.entity, { auto: true, targetKind: target.kind, targetId: target.id, impactDamage: 7 });
    this.store.applyLocalDamage(target.kind, target.id, 7, target.entity.x, target.entity.y);
  }

  predictMovement(me, dt) {
    if (!Number.isFinite(dt) || dt <= 0 || hasBlockingStatus(me)) return;
    const local = this.store.localPrediction || {};
    let tx = null;
    let ty = null;

    const target = getTarget(this.store, local.selectedKind || this.store.myState?.selectedKind, local.selectedId || this.store.myState?.selectedId);
    if (target && (target.kind === 'station' || local.selectedKind === 'station')) {
      tx = target.x;
      ty = target.y;
    } else if (target && (local.selectedKind || this.store.myState?.selectedKind) !== 'station') {
      const aaRange = 330;
      const d = Math.max(0.001, len(me.x - target.x, me.y - target.y));
      if (d > aaRange) {
        const nx = (me.x - target.x) / d;
        const ny = (me.y - target.y) / d;
        tx = target.x + nx * (aaRange * 0.82);
        ty = target.y + ny * (aaRange * 0.82);
      }
    }

    if (local.hasMoveTarget) {
      tx = local.moveX;
      ty = local.moveY;
    }

    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;

    const dx = tx - me.x;
    const dy = ty - me.y;
    const d = Math.hypot(dx, dy);
    if (d <= 10) {
      if (local.hasMoveTarget && !local.hold) local.hasMoveTarget = false;
      me.vx = 0;
      me.vy = 0;
      return;
    }

    const speed = finite(this.store.myState?.derived?.moveSpeed, finite(me.engine, 250));
    const step = Math.min(d, speed * dt);
    me.x += (dx / d) * step;
    me.y += (dy / d) * step;
    me.vx = (dx / d) * speed;
    me.vy = (dy / d) * speed;
    this.applyLocalSectorWrap(me);
  }

  applyLocalSectorWrap(me) {
    const beforeX = me.x;
    const beforeY = me.y;
    const beforeSx = me.sx | 0;
    const beforeSy = me.sy | 0;
    const wrapped = wrapIntoSector({ x: me.x, y: me.y }, beforeSx, beforeSy);
    if ((wrapped.sx | 0) === beforeSx && (wrapped.sy | 0) === beforeSy) return;

    me.x = wrapped.x;
    me.y = wrapped.y;
    me.sx = wrapped.sx | 0;
    me.sy = wrapped.sy | 0;

    const dx = me.x - beforeX;
    const dy = me.y - beforeY;
    const local = this.store.localPrediction || {};
    if (local.hasMoveTarget) {
      local.moveX += dx;
      local.moveY += dy;
    }
    if (Number.isFinite(me.groundMarkerX)) me.groundMarkerX += dx;
    if (Number.isFinite(me.groundMarkerY)) me.groundMarkerY += dy;

    // On évite de garder une cible ou un point de déplacement de l'ancien secteur.
    this.store.setOptimisticSelection('', 0);
    this.store.localPrediction.hasMoveTarget = false;
    me.hasMoveTarget = false;
    me.groundMarkerTimer = 0;
    me._forceServerPose = false;
    me._localSectorChangedAt = performance.now();
  }

  reconcileSoftly(me, dt, isMoving = false) {
    return;
  }
}
