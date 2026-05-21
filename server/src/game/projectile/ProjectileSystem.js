import { newEntityId } from '../state/GameState.js';
import { distSq, norm } from '../util/Math.js';
import { applyDamage } from '../combat/DamageSystem.js';
import { applyStatusSpecs } from '../status/StatusApplication.js';
import { isUntargetable } from '../status/StatusMotion.js';
import { WORLD } from '../constants.js';
import { onProjectileImpactForFrame } from '../frames/FrameGameplayHooks.js';
import { getSimulationTimeMs } from '../util/Time.js';
import { isSafeNoPvpSector } from '../sector/SpecialSectors.js';
import { sameWorld } from '../modes/GameModes.js';

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

export function spawnProjectile(state, owner, tx, ty, tint, damage, radius, speed, rangeLeft, splashRadius, timeMs, extras = null) {
  const dir = norm(tx - owner.x, ty - owner.y);
  const startX = owner.x + dir.x * (owner.radius + 8);
  const startY = owner.y + dir.y * (owner.radius + 8);
  const id = newEntityId(state);

  state.projectiles.set(id, {
    id,
    kind: 'projectile',
    sx: owner.sx | 0,
    sy: owner.sy | 0,
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
    visualKind: extras?.visualKind ?? (extras?.sourceAbilitySlot ? 'ability' : 'auto'),
    visualSlot: extras?.visualSlot ?? extras?.sourceAbilitySlot ?? '',
    visualAmmoEffect: extras?.visualAmmoEffect ?? '',
    visualAmmoId: extras?.visualAmmoId ?? '',
    crit: !!extras?.crit,
    empoweredAutoUsed: !!extras?.empoweredAutoUsed,
    ultAutoUsed: !!extras?.ultAutoUsed,
    pierceLeft: extras?.pierceLeft ?? 0,
    hitIds: extras?.hitIds ?? new Set(),
    maxLifetimeMs: extras?.maxLifetimeMs ?? 0
  });

  return id;
}

export function updateProjectiles(state, dt, timeMs = null) {
  timeMs = getSimulationTimeMs(state, timeMs);
  for (const proj of state.projectiles.values()) {
    const step = Math.hypot(proj.vx * dt, proj.vy * dt);
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    proj.rangeLeft -= step;

    let hit = null;
    const sourceEntityForCollision = state.players.get(proj.sourceId) ?? state.mobs.get(proj.sourceId) ?? null;
    const demoProjectile = !!sourceEntityForCollision?.demoMob;
    const hostileToPlayers = proj.sourceKind === 'mob' && !demoProjectile;
    const sourcePlayerForPvp = state.players.get(proj.sourceId) ?? null;

    for (const p of state.players.values()) {
      if (demoProjectile) continue;
      if (!hostileToPlayers && p.id === proj.sourceId) continue;
      if (sourcePlayerForPvp && !sameWorld(sourcePlayerForPvp, p)) continue;
      if (!hostileToPlayers && sourcePlayerForPvp && p.id !== sourcePlayerForPvp.id && isSafeNoPvpSector(p.sx | 0, p.sy | 0) && isSafeNoPvpSector(sourcePlayerForPvp.sx | 0, sourcePlayerForPvp.sy | 0)) continue;
      if ((p.sx | 0) !== (proj.sx | 0) || (p.sy | 0) !== (proj.sy | 0)) continue;
      if (isUntargetable(p)) continue;
      if (distSq(proj.x, proj.y, p.x, p.y) <= (proj.radius + p.radius) * (proj.radius + p.radius)) {
        hit = p;
        break;
      }
    }

    if (!hit && !hostileToPlayers && !demoProjectile) {
      for (const mob of state.mobs.values()) {
        if (mob.id === proj.sourceId) continue;
        if (mob.stats.hp <= 0) continue;
        if ((mob.sx | 0) !== (proj.sx | 0) || (mob.sy | 0) !== (proj.sy | 0)) continue;
        if (distSq(proj.x, proj.y, mob.x, mob.y) <= (proj.radius + mob.radius) * (proj.radius + mob.radius)) {
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
          ? circleHitsRect(proj.x, proj.y, proj.radius, a)
          : distSq(proj.x, proj.y, a.x, a.y) <= (proj.radius + a.radius) * (proj.radius + a.radius);
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
      applyDamage(state, hit, proj.damage, sourcePlayer, { timeMs, crit: !!proj.crit, sourceSlot: proj.sourceAbilitySlot || '', visualKind: proj.visualKind || '' });
      const hitStillExists = hit.kind !== 'mob' || state.mobs.has(hit.id);
      if (hitStillExists) {
        applyStatusSpecs(state, sourceEntity, hit, proj.onHitStatuses);
        if (sourcePlayer) onProjectileImpactForFrame(state, sourcePlayer, hit, proj, timeMs);
      }

      if (proj.splashRadius > 0) {
        const splashSq = proj.splashRadius * proj.splashRadius;

        for (const p of state.players.values()) {
          if (!hostileToPlayers && p.id === proj.sourceId) continue;
          if (sourcePlayerForPvp && !sameWorld(sourcePlayerForPvp, p)) continue;
          if (!hostileToPlayers && sourcePlayerForPvp && p.id !== sourcePlayerForPvp.id && isSafeNoPvpSector(p.sx | 0, p.sy | 0) && isSafeNoPvpSector(sourcePlayerForPvp.sx | 0, sourcePlayerForPvp.sy | 0)) continue;
          if ((p.sx | 0) !== (proj.sx | 0) || (p.sy | 0) !== (proj.sy | 0)) continue;
          if (isUntargetable(p)) continue;
          const d2 = distSq(proj.x, proj.y, p.x, p.y);
          if (d2 <= splashSq) {
            applyDamage(state, p, proj.damage * (0.55 + 0.45 * (1 - d2 / splashSq)), sourcePlayer, { timeMs, sourceSlot: proj.sourceAbilitySlot || '', visualKind: proj.visualKind || '' });
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
              applyDamage(state, mob, proj.damage * (0.65 + 0.35 * (1 - d2 / splashSq)), sourcePlayer, { timeMs, sourceSlot: proj.sourceAbilitySlot || '', visualKind: proj.visualKind || '' });
              if (state.mobs.has(mob.id)) applyStatusSpecs(state, sourceEntity, mob, proj.onSplashStatuses);
            }
          }
        }

        for (const a of state.asteroids.values()) {
          if (a.stats.hp <= 0) continue;
          if ((a.sx | 0) !== (proj.sx | 0) || (a.sy | 0) !== (proj.sy | 0)) continue;
          const d2 = distSq(proj.x, proj.y, a.x, a.y);
          if (d2 <= splashSq) {
            applyDamage(state, a, proj.damage * (0.65 + 0.35 * (1 - d2 / splashSq)), sourcePlayer, { timeMs, sourceSlot: proj.sourceAbilitySlot || '', visualKind: proj.visualKind || '' });
            applyStatusSpecs(state, sourceEntity, a, proj.onSplashStatuses);
          }
        }
      }

      if (proj.pierceLeft > 0) {
        proj.pierceLeft -= 1;
      } else {
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
      state.projectiles.delete(proj.id);
    }
  }
}
