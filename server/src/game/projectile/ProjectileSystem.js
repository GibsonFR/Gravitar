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

function pointInsideExpandedRect(x, y, wall, pad) {
  const w = wall.w || wall.radius * 2;
  const h = wall.h || wall.radius * 2;
  return x >= wall.x - w * 0.5 - pad && x <= wall.x + w * 0.5 + pad && y >= wall.y - h * 0.5 - pad && y <= wall.y + h * 0.5 + pad;
}


function projectileCanCollideWithStructure(state, proj, structure, sourcePlayer) {
  if (!structure || (structure.stats?.hp ?? 0) <= 0) return false;
  if ((structure.sx | 0) !== (proj.sx | 0) || (structure.sy | 0) !== (proj.sy | 0)) return false;
  if (sourcePlayer && String(sourcePlayer.worldId || 'endless') !== String(structure.worldId || 'endless')) return false;
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

export function spawnProjectile(state, owner, tx, ty, tint, damage, radius, speed, rangeLeft, splashRadius, timeMs, extras = null) {
  const dir = norm(tx - owner.x, ty - owner.y);
  const startX = owner.x + dir.x * (owner.radius + 8);
  const startY = owner.y + dir.y * (owner.radius + 8);
  const id = newEntityId(state);

  const projectile = {
    id,
    kind: 'projectile',
    sx: owner.sx | 0,
    sy: owner.sy | 0,
    worldId: String(owner.worldId || 'endless'),
    x: startX,
    y: startY,
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
    sourceOwnerKey: String(extras?.sourceOwnerKey || owner.ownerKey || ''),
    visualKind: extras?.visualKind ?? (extras?.sourceAbilitySlot ? 'ability' : 'auto'),
    visualSlot: extras?.visualSlot ?? extras?.sourceAbilitySlot ?? '',
    visualAmmoEffect: extras?.visualAmmoEffect ?? '',
    visualAmmoId: extras?.visualAmmoId ?? '',
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
        applyDamage(state, hit, proj.damage, sourcePlayer, { timeMs, crit: !!proj.crit, sourceSlot: proj.sourceAbilitySlot || '', visualKind: proj.visualKind || '', bonusLifestealRatio: proj.bonusLifestealRatio || 0 });
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
          if (!sourcePlayer || !canPlayerDamageStructure(state, sourcePlayer, st)) continue;
          if ((st.sx | 0) !== (proj.sx | 0) || (st.sy | 0) !== (proj.sy | 0)) continue;
          const d2 = distanceSqToStructureRect(st, proj.x, proj.y);
          if (d2 <= splashSq) {
            applyDamage(state, st, proj.damage * (0.65 + 0.35 * (1 - d2 / splashSq)), sourcePlayer, { timeMs, sourceSlot: proj.sourceAbilitySlot || '', visualKind: proj.visualKind || '', bonusLifestealRatio: proj.bonusLifestealRatio || 0, structureDamageMult: 0.7 });
          }
        }
      }

      queueProjectileImpactEvent(state, proj, hit, timeMs, { reason: 'hit' });

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
