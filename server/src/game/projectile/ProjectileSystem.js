import { newEntityId } from '../state/GameState.js';
import { distSq, norm } from '../util/Math.js';
import { applyDamage } from '../combat/DamageSystem.js';
import { applyStatusSpecs } from '../status/StatusApplication.js';
import { isUntargetable } from '../status/StatusMotion.js';
import { WORLD } from '../constants.js';
import { onProjectileImpactForFrame, onProjectileExpireForFrame } from '../frames/FrameGameplayHooks.js';
import { getSimulationTimeMs } from '../util/Time.js';
import { isSafeNoPvpSector } from '../sector/SpecialSectors.js';
import { sameWorld } from '../modes/GameModes.js';
import { canPlayerDamageStructure, distanceSqToStructureRect } from '../structures/StructureSystem.js';
import { STRUCTURE_TYPES } from '../structures/StructureDefs.js';
import { damageLogisticDroneByProjectile } from '../structures/StructureLogistics.js';
import { queueProjectileSpawnEvent, queueProjectileImpactEvent, queueProjectileDestroyEvent } from '../events/ProjectileEvents.js';

function circleHitsRect(cx, cy, radius, wall) {
  const w = wall.w || wall.radius * 2;
  const h = wall.h || wall.radius * 2;
  const left = wall.x - w * 0.5;
  const right = wall.x + w * 0.5;
  const top = wall.y - h * 0.5;
  const bottom = wall.y + h * 0.5;
  const px = Math.max(left, Math.min(cx, right));
  const py = Math.max(top, Math.min(cy, bottom));
  const dx = cx - px;
  const dy = cy - py;
  return dx * dx + dy * dy <= radius * radius;
}

function distPointToSegmentSq(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq <= 0.000001) return distSq(px, py, bx, by);
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
  const x = ax + abx * t;
  const y = ay + aby * t;
  return distSq(px, py, x, y);
}

function segmentHitsCircle(x1, y1, x2, y2, cx, cy, radius) {
  return distPointToSegmentSq(cx, cy, x1, y1, x2, y2) <= radius * radius;
}

function segmentRectImpactPoint(x1, y1, x2, y2, rect, pad = 0) {
  const w = Number(rect.w || rect.radius * 2 || 0) + pad * 2;
  const h = Number(rect.h || rect.radius * 2 || 0) + pad * 2;
  if (!(w > 0) || !(h > 0)) return null;
  const left = Number(rect.x) - w * 0.5;
  const right = Number(rect.x) + w * 0.5;
  const top = Number(rect.y) - h * 0.5;
  const bottom = Number(rect.y) + h * 0.5;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let best = null;
  const add = (t, x, y) => {
    if (t >= 0 && t <= 1 && x >= left - 0.001 && x <= right + 0.001 && y >= top - 0.001 && y <= bottom + 0.001) {
      if (!best || t < best.t) best = { t, x, y };
    }
  };
  if (Math.abs(dx) > 0.000001) {
    let t = (left - x1) / dx; add(t, left, y1 + dy * t);
    t = (right - x1) / dx; add(t, right, y1 + dy * t);
  }
  if (Math.abs(dy) > 0.000001) {
    let t = (top - y1) / dy; add(t, x1 + dx * t, top);
    t = (bottom - y1) / dy; add(t, x1 + dx * t, bottom);
  }
  return best ? { x: best.x, y: best.y } : null;
}

function projectileImpactPoint(proj, hit, oldX, oldY) {
  const fallback = { x: Number(proj?.x) || 0, y: Number(proj?.y) || 0 };
  if (!proj || !hit) return fallback;
  const x1 = Number(oldX);
  const y1 = Number(oldY);
  const x2 = Number(proj.x);
  const y2 = Number(proj.y);
  if (![x1, y1, x2, y2].every(Number.isFinite)) return fallback;

  if (Number.isFinite(Number(hit.w)) || Number.isFinite(Number(hit.h))) {
    const rectHit = segmentRectImpactPoint(x1, y1, x2, y2, hit, Math.max(0, Number(proj.radius || 0)));
    if (rectHit) return rectHit;
  }

  const hx = Number(hit.x);
  const hy = Number(hit.y);
  const hitRadius = Number(hit.radius || 0);
  const collisionRadius = hitRadius + Number(proj.radius || 0);
  if (Number.isFinite(hx) && Number.isFinite(hy) && collisionRadius > 0) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - hx;
    const fy = y1 - hy;
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - collisionRadius * collisionRadius;
    const disc = b * b - 4 * a * c;
    if (a > 0.000001 && disc >= 0) {
      const s = Math.sqrt(disc);
      const t1 = (-b - s) / (2 * a);
      const t2 = (-b + s) / (2 * a);
      const t = [t1, t2].filter((v) => v >= 0 && v <= 1).sort((aa, bb) => aa - bb)[0];
      if (Number.isFinite(t)) {
        const cx = x1 + dx * t;
        const cy = y1 + dy * t;
        if (hitRadius > 0) {
          const nx = cx - hx;
          const ny = cy - hy;
          const len = Math.hypot(nx, ny);
          if (len > 0.0001) return { x: hx + (nx / len) * hitRadius, y: hy + (ny / len) * hitRadius };
        }
        return { x: cx, y: cy };
      }
    }
  }

  return fallback;
}


function pointInsideExpandedRect(x, y, wall, pad) {
  const w = wall.w || wall.radius * 2;
  const h = wall.h || wall.radius * 2;
  return x >= wall.x - w * 0.5 - pad && x <= wall.x + w * 0.5 + pad && y >= wall.y - h * 0.5 - pad && y <= wall.y + h * 0.5 + pad;
}


function projectileCanCollideWithStructure(state, proj, structure, sourcePlayer) {
  if (!structure || (structure.stats?.hp ?? 0) <= 0) return false;
  if ((structure.sx | 0) !== (proj.sx | 0) || (structure.sy | 0) !== (proj.sy | 0)) return false;
  if (sourcePlayer && String(sourcePlayer.worldId || 'endless') !== String(structure.worldId || 'endless')) return false;
  const structureOwner = String(structure.ownerKey || '').toLowerCase();
  const projectileOwner = String(proj.sourceOwnerKey || '').toLowerCase();
  if (proj.sourceKind === 'structure' && projectileOwner && structureOwner === projectileOwner) return false;
  if (proj.sourceKind === 'mob') {
    const sourceMob = state.mobs?.get?.(proj.sourceId) || null;
    if ((proj.intendedTargetId | 0) === (structure.id | 0) || (sourceMob?.baseRaidTargetId | 0) === (structure.id | 0)) return true;
    return (structure.type === STRUCTURE_TYPES.WALL || structure.type === STRUCTURE_TYPES.DOOR) && structure.solid;
  }
  if ((structure.type === STRUCTURE_TYPES.WALL || structure.type === STRUCTURE_TYPES.DOOR) && structure.solid) return true;
  if (!sourcePlayer) return false;
  return canPlayerDamageStructure(state, sourcePlayer, structure);
}

function segmentHitsStructureRect(x1, y1, x2, y2, structure, pad = 0) {
  return segmentHitsExpandedRect(x1, y1, x2, y2, structure, Math.max(0, pad));
}

function segmentHitsExpandedRect(x1, y1, x2, y2, wall, pad) {
  if (pointInsideExpandedRect(x1, y1, wall, pad) || pointInsideExpandedRect(x2, y2, wall, pad)) return true;
  const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / Math.max(5, pad * 0.5)));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (pointInsideExpandedRect(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, wall, pad)) return true;
  }
  return false;
}

function resolvePlayerActionOrigin(owner, timeMs) {
  const origin = {
    x: Number(owner?.x || 0),
    y: Number(owner?.y || 0),
    sx: owner?.sx | 0,
    sy: owner?.sy | 0,
    source: 'server'
  };
  if (!owner || owner.kind !== 'player') return origin;
  const hintAt = Number(owner.lastClientHintAt || 0);
  const hx = Number(owner.lastClientHintX);
  const hy = Number(owner.lastClientHintY);
  const hsx = owner.lastClientHintSx | 0;
  const hsy = owner.lastClientHintSy | 0;
  if (!Number.isFinite(hx) || !Number.isFinite(hy) || !hintAt) return origin;
  if ((timeMs || 0) - hintAt > 220) return origin;
  if (hsx !== (owner.sx | 0) || hsy !== (owner.sy | 0)) return origin;

  const dx = hx - origin.x;
  const dy = hy - origin.y;
  const d = Math.hypot(dx, dy);
  // This is not full client authority. It is a short action-origin correction
  // used only for firing/pickup feel when the local ship is ahead of the server
  // simulation. Large deltas are rejected to avoid teleports/sector mismatch.
  if (d > 520) return origin;
  return { x: hx, y: hy, sx: hsx, sy: hsy, source: 'client_hint', serverX: origin.x, serverY: origin.y, delta: Math.round(d * 10) / 10 };
}

function getProjectileIntendedTarget(state, proj) {
  const kind = String(proj?.intendedTargetKind || '').toLowerCase();
  const id = proj?.intendedTargetId | 0;
  if (!kind || !id) return null;
  let target = null;
  if (kind === 'asteroid') target = state.asteroids?.get?.(id) || null;
  else if (kind === 'mob') target = state.mobs?.get?.(id) || null;
  else if (kind === 'player') target = state.players?.get?.(id) || null;
  else if (kind === 'structure') target = state.structures?.get?.(id) || null;
  if (!target) return null;
  if ((target.sx | 0) !== (proj.sx | 0) || (target.sy | 0) !== (proj.sy | 0)) return null;
  if (String(target.worldId || 'endless') !== String(proj.worldId || 'endless')) return null;
  if (target.stats && Number(target.stats.hp || 0) <= 0) return null;
  return target;
}

export function spawnProjectile(state, owner, tx, ty, tint, damage, radius, speed, rangeLeft, splashRadius, timeMs, extras = null) {
  const origin = resolvePlayerActionOrigin(owner, timeMs);
  const dir = norm(tx - origin.x, ty - origin.y);
  const startX = origin.x + dir.x * (owner.radius + 8);
  const startY = origin.y + dir.y * (owner.radius + 8);
  const id = newEntityId(state);

  const projectile = {
    id,
    kind: 'projectile',
    sx: origin.sx | 0,
    sy: origin.sy | 0,
    worldId: String(owner.worldId || 'endless'),
    x: startX,
    y: startY,
    sourceX: origin.x,
    sourceY: origin.y,
    sourceSx: origin.sx | 0,
    sourceSy: origin.sy | 0,
    sourceOrigin: origin.source,
    sourceServerX: Number.isFinite(origin.serverX) ? origin.serverX : origin.x,
    sourceServerY: Number.isFinite(origin.serverY) ? origin.serverY : origin.y,
    sourceOriginDelta: Number(origin.delta || 0),
    aimX: tx,
    aimY: ty,
    vx: dir.x * speed + owner.vx * 0.1,
    vy: dir.y * speed + owner.vy * 0.1,
    radius,
    damage,
    rangeLeft,
    splashRadius: splashRadius ?? 0,
    tint,
    sourceId: owner.id,
    sourceKind: extras?.sourceKind ?? owner.kind ?? 'player',
    bornAt: timeMs,
    onHitStatuses: extras?.onHitStatuses ?? null,
    onSplashStatuses: extras?.onSplashStatuses ?? null,
    sourceAbilitySlot: extras?.sourceAbilitySlot ?? null,
    autoAttackImpactRoll: !!extras?.autoAttackImpactRoll,
    linkedAbilitySynergyActive: !!extras?.linkedAbilitySynergyActive,
    sourceFrameId: extras?.sourceFrameId ?? owner.frameId ?? '',
    sourceOwnerKey: String(extras?.sourceOwnerKey || owner.ownerKey || owner.accountKey || owner.accountName || owner.pseudo || ''),
    visualKind: extras?.visualKind ?? (extras?.sourceAbilitySlot ? 'ability' : 'auto'),
    visualSlot: extras?.visualSlot ?? extras?.sourceAbilitySlot ?? '',
    visualAmmoEffect: extras?.visualAmmoEffect ?? '',
    visualAmmoId: extras?.visualAmmoId ?? '',
    intendedTargetKind: String(extras?.intendedTargetKind || ''),
    intendedTargetId: extras?.intendedTargetId | 0,
    lockTarget: !!extras?.lockTarget,
    crit: !!extras?.crit,
    bonusLifestealRatio: Math.max(0, extras?.bonusLifestealRatio || 0),
    empoweredAutoUsed: !!extras?.empoweredAutoUsed,
    ultAutoUsed: !!extras?.ultAutoUsed,
    pierceLeft: extras?.pierceLeft ?? 0,
    hitIds: extras?.hitIds ?? new Set(),
    maxLifetimeMs: extras?.maxLifetimeMs ?? 0
  };

  state.projectiles.set(id, projectile);
  queueProjectileSpawnEvent(state, projectile, timeMs);

  return id;
}

export function updateProjectiles(state, dt, timeMs = null) {
  timeMs = getSimulationTimeMs(state, timeMs);
  for (const proj of state.projectiles.values()) {
    const oldX = proj.x;
    const oldY = proj.y;
    const step = Math.hypot(proj.vx * dt, proj.vy * dt);
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    proj.rangeLeft -= step;

    let hit = null;
    const sourceStructureForCollision = proj.sourceKind === 'structure' ? (state.structures?.get?.(proj.sourceId) ?? null) : null;
    const sourceEntityForCollision = state.players.get(proj.sourceId) ?? state.mobs.get(proj.sourceId) ?? sourceStructureForCollision ?? null;
    const demoProjectile = !!sourceEntityForCollision?.demoMob;
    const hostileToPlayers = proj.sourceKind === 'mob' && !demoProjectile;
    const structureProjectile = proj.sourceKind === 'structure';
    const sourcePlayerForPvp = state.players.get(proj.sourceId) ?? null;
    const sourceOwnerKey = String(proj.sourceOwnerKey || sourceStructureForCollision?.ownerKey || '').toLowerCase();

    const intendedTarget = getProjectileIntendedTarget(state, proj);
    if (intendedTarget && proj.lockTarget) {
      const dx = Number(intendedTarget.x || 0) - Number(proj.x || 0);
      const dy = Number(intendedTarget.y || 0) - Number(proj.y || 0);
      const len = Math.hypot(dx, dy);
      const speed = Math.max(1, Math.hypot(proj.vx || 0, proj.vy || 0));
      if (len > 0.001) {
        // Small authoritative steering for server-fired target-locked attacks.
        // This prevents auto/rocket shots from visually spawning while the
        // server projectile narrowly misses because of stale target/origin drift.
        const steer = Math.min(0.48, Math.max(0.10, dt * 16));
        const tvx = (dx / len) * speed;
        const tvy = (dy / len) * speed;
        proj.vx = proj.vx * (1 - steer) + tvx * steer;
        proj.vy = proj.vy * (1 - steer) + tvy * steer;
      }
      const visualKind = String(proj.visualKind || '').toLowerCase();
      const intendedPadding = visualKind === 'auto' ? 72 : visualKind === 'rocket' ? 96 : 48;
      const r = Number(intendedTarget.radius || 18) + Number(proj.radius || 3) + intendedPadding;
      if (segmentHitsCircle(oldX, oldY, proj.x, proj.y, intendedTarget.x, intendedTarget.y, r)) {
        hit = intendedTarget;
      }
    }

    // Les murs de base doivent bloquer tous les tirs/projectiles.
    // Le noyau et les autres structures ne sont touchés que s'ils sont effectivement attaquables.
    for (const st of state.structures?.values?.() || []) {
      if (!projectileCanCollideWithStructure(state, proj, st, sourcePlayerForPvp)) continue;
      const collides = segmentHitsStructureRect(oldX, oldY, proj.x, proj.y, st, proj.radius + 1.5)
        || circleHitsRect(proj.x, proj.y, proj.radius, st);
      if (!collides) continue;
      hit = st;
      break;
    }

    if (!hit) for (const p of state.players.values()) {
      if (demoProjectile) continue;
      if (!hostileToPlayers && !structureProjectile && p.id === proj.sourceId) continue;
      if (structureProjectile && sourceOwnerKey && String(p.accountKey || p.accountName || p.pseudo || '').toLowerCase() === sourceOwnerKey) continue;
      if (structureProjectile && sourceStructureForCollision && String(sourceStructureForCollision.worldId || 'endless') !== String(p.worldId || 'endless')) continue;
      if (structureProjectile && isSafeNoPvpSector(p.sx | 0, p.sy | 0)) continue;
      if (sourcePlayerForPvp && !sameWorld(sourcePlayerForPvp, p)) continue;
      if (!hostileToPlayers && sourcePlayerForPvp && p.id !== sourcePlayerForPvp.id && isSafeNoPvpSector(p.sx | 0, p.sy | 0) && isSafeNoPvpSector(sourcePlayerForPvp.sx | 0, sourcePlayerForPvp.sy | 0)) continue;
      if ((p.sx | 0) !== (proj.sx | 0) || (p.sy | 0) !== (proj.sy | 0)) continue;
      if (isUntargetable(p)) continue;
      if (segmentHitsCircle(oldX, oldY, proj.x, proj.y, p.x, p.y, proj.radius + p.radius)) {
        hit = p;
        break;
      }
    }

    if (!hit && sourcePlayerForPvp && !hostileToPlayers && !demoProjectile) {
      hit = damageLogisticDroneByProjectile(state, proj, oldX, oldY, sourcePlayerForPvp, timeMs);
    }

    if (!hit && !hostileToPlayers && !demoProjectile) {
      for (const mob of state.mobs.values()) {
        if (mob.id === proj.sourceId) continue;
        if (mob.stats.hp <= 0) continue;
        if ((mob.sx | 0) !== (proj.sx | 0) || (mob.sy | 0) !== (proj.sy | 0)) continue;
        if (segmentHitsCircle(oldX, oldY, proj.x, proj.y, mob.x, mob.y, proj.radius + mob.radius)) {
          hit = mob;
          break;
        }
      }
    }

    if (!hit) {
      for (const a of state.asteroids.values()) {
        if (a.stats.hp <= 0) continue;
        if ((a.sx | 0) !== (proj.sx | 0) || (a.sy | 0) !== (proj.sy | 0)) continue;
        const collides = a.bastionWall
          ? (circleHitsRect(proj.x, proj.y, proj.radius, a) || segmentHitsExpandedRect(oldX, oldY, proj.x, proj.y, a, proj.radius + 1.5))
          : segmentHitsCircle(oldX, oldY, proj.x, proj.y, a.x, a.y, proj.radius + a.radius);
        if (collides) {
          hit = a;
          break;
        }
      }
    }

    if (hit) {
      if (proj.hitIds instanceof Set) {
        if (proj.hitIds.has(hit.id)) {
          state.projectiles.delete(proj.id);
          continue;
        }
        proj.hitIds.add(hit.id);
      }

      const sourcePlayer = state.players.get(proj.sourceId) ?? null;
      const sourceEntity = sourcePlayer ?? sourceEntityForCollision ?? null;
      if (hit.kind !== 'logistic_drone') {
        applyDamage(state, hit, proj.damage, sourceEntity, { timeMs, crit: !!proj.crit, sourceSlot: proj.sourceAbilitySlot || '', visualKind: proj.visualKind || '', bonusLifestealRatio: proj.bonusLifestealRatio || 0 });
      }
      const hitStillExists = hit.kind !== 'mob' || state.mobs.has(hit.id);
      if (hitStillExists && hit.kind !== 'structure' && hit.kind !== 'logistic_drone') {
        applyStatusSpecs(state, sourceEntity, hit, proj.onHitStatuses);
        if (sourcePlayer) onProjectileImpactForFrame(state, sourcePlayer, hit, proj, timeMs);
      }

      if (proj.splashRadius > 0) {
        const splashSq = proj.splashRadius * proj.splashRadius;

        for (const p of state.players.values()) {
          if (!hostileToPlayers && !structureProjectile && p.id === proj.sourceId) continue;
          if (structureProjectile && sourceOwnerKey && String(p.accountKey || p.accountName || p.pseudo || '').toLowerCase() === sourceOwnerKey) continue;
          if (structureProjectile && sourceStructureForCollision && String(sourceStructureForCollision.worldId || 'endless') !== String(p.worldId || 'endless')) continue;
          if (structureProjectile && isSafeNoPvpSector(p.sx | 0, p.sy | 0)) continue;
          if (sourcePlayerForPvp && !sameWorld(sourcePlayerForPvp, p)) continue;
          if (!hostileToPlayers && sourcePlayerForPvp && p.id !== sourcePlayerForPvp.id && isSafeNoPvpSector(p.sx | 0, p.sy | 0) && isSafeNoPvpSector(sourcePlayerForPvp.sx | 0, sourcePlayerForPvp.sy | 0)) continue;
          if ((p.sx | 0) !== (proj.sx | 0) || (p.sy | 0) !== (proj.sy | 0)) continue;
          if (isUntargetable(p)) continue;
          const d2 = distSq(proj.x, proj.y, p.x, p.y);
          if (d2 <= splashSq) {
            applyDamage(state, p, proj.damage * (0.55 + 0.45 * (1 - d2 / splashSq)), sourcePlayer, { timeMs, sourceSlot: proj.sourceAbilitySlot || '', visualKind: proj.visualKind || '', bonusLifestealRatio: proj.bonusLifestealRatio || 0 });
            applyStatusSpecs(state, sourceEntity, p, proj.onSplashStatuses);
          }
        }

        if (!hostileToPlayers && !demoProjectile) {
          for (const mob of state.mobs.values()) {
            if (mob.id === proj.sourceId) continue;
            if (mob.stats.hp <= 0) continue;
            if ((mob.sx | 0) !== (proj.sx | 0) || (mob.sy | 0) !== (proj.sy | 0)) continue;
            const d2 = distSq(proj.x, proj.y, mob.x, mob.y);
            if (d2 <= splashSq) {
              applyDamage(state, mob, proj.damage * (0.65 + 0.35 * (1 - d2 / splashSq)), sourcePlayer, { timeMs, sourceSlot: proj.sourceAbilitySlot || '', visualKind: proj.visualKind || '', bonusLifestealRatio: proj.bonusLifestealRatio || 0 });
              if (state.mobs.has(mob.id)) applyStatusSpecs(state, sourceEntity, mob, proj.onSplashStatuses);
            }
          }
        }

        for (const a of state.asteroids.values()) {
          if (a.stats.hp <= 0) continue;
          if ((a.sx | 0) !== (proj.sx | 0) || (a.sy | 0) !== (proj.sy | 0)) continue;
          const d2 = distSq(proj.x, proj.y, a.x, a.y);
          if (d2 <= splashSq) {
            applyDamage(state, a, proj.damage * (0.65 + 0.35 * (1 - d2 / splashSq)), sourcePlayer, { timeMs, sourceSlot: proj.sourceAbilitySlot || '', visualKind: proj.visualKind || '', bonusLifestealRatio: proj.bonusLifestealRatio || 0 });
            applyStatusSpecs(state, sourceEntity, a, proj.onSplashStatuses);
          }
        }

        for (const st of state.structures?.values?.() || []) {
          if (!projectileCanCollideWithStructure(state, proj, st, sourcePlayer)) continue;
          if ((st.sx | 0) !== (proj.sx | 0) || (st.sy | 0) !== (proj.sy | 0)) continue;
          const d2 = distanceSqToStructureRect(st, proj.x, proj.y);
          if (d2 <= splashSq) {
            applyDamage(state, st, proj.damage * (0.65 + 0.35 * (1 - d2 / splashSq)), sourceEntity, { timeMs, sourceSlot: proj.sourceAbilitySlot || '', visualKind: proj.visualKind || '', bonusLifestealRatio: proj.bonusLifestealRatio || 0, structureDamageMult: 0.7 });
          }
        }
      }

      const impactPoint = projectileImpactPoint(proj, hit, oldX, oldY);
      queueProjectileImpactEvent(state, proj, hit, timeMs, { reason: 'hit', x: impactPoint.x, y: impactPoint.y });

      if (proj.pierceLeft > 0) {
        proj.pierceLeft -= 1;
      } else {
        queueProjectileDestroyEvent(state, proj, timeMs, 'impact');
        state.projectiles.delete(proj.id);
        continue;
      }
    }

    if (
      (proj.maxLifetimeMs > 0 && timeMs - (proj.bornAt || timeMs) > proj.maxLifetimeMs) ||
      proj.rangeLeft <= 0 ||
      Math.abs(proj.x) > WORLD.halfW + 400 ||
      Math.abs(proj.y) > WORLD.halfH + 400
    ) {
      const sourcePlayer = state.players.get(proj.sourceId) ?? null;
      if (sourcePlayer) onProjectileExpireForFrame(state, sourcePlayer, proj, timeMs);
      queueProjectileDestroyEvent(state, proj, timeMs, 'expired');
      state.projectiles.delete(proj.id);
    }
  }
}
