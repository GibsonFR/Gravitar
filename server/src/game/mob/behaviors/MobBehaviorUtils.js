import { distSq, norm } from '../../util/Math.js';
import { blocksVoluntaryMove, getMoveSpeedMultiplier } from '../../status/StatusRack.js';
import { canTargetEntity } from '../../status/StatusPerception.js';
import { isUntargetable } from '../../status/StatusMotion.js';
import { isPlayerSessionPending } from '../../player/PlayerSessionSetup.js';

export function clearMobVelocity(mob) {
  mob.vx = 0;
  mob.vy = 0;
}

function getDemoTarget(state, mob) {
  if (!mob?.demoMob || !mob.demoTargetId) return null;
  const target = mob.demoTargetKind === 'asteroid'
    ? state.asteroids.get(mob.demoTargetId)
    : state.mobs.get(mob.demoTargetId);
  if (!target || !target.stats || target.stats.hp <= 0) return null;
  if ((target.sx | 0) !== (mob.sx | 0) || (target.sy | 0) !== (mob.sy | 0)) return null;
  mob.targetKind = target.kind;
  mob.targetPlayerId = target.id;
  return target;
}

export function acquireTargetPlayer(state, mob) {
  const demoTarget = getDemoTarget(state, mob);
  if (demoTarget) return demoTarget;

  let best = null;
  let bestScore = -Infinity;
  const aggroRangeSq = mob.aggroRange * mob.aggroRange;

  for (const player of state.players.values()) {
    if ((player.sx | 0) !== (mob.sx | 0) || (player.sy | 0) !== (mob.sy | 0)) continue;
    if (player.dockedStationId) continue;
    if (isPlayerSessionPending(player)) continue;
    if (isUntargetable(player) || !canTargetEntity(mob, player)) continue;
    const d2 = distSq(mob.x, mob.y, player.x, player.y);
    if (d2 > aggroRangeSq) continue;
    const vitals = player.stats?.hpMax > 0 ? (player.stats.hp / player.stats.hpMax) : 1;
    const score = (1 / Math.max(1, d2)) + (1 - vitals) * 0.0008;
    if (score > bestScore) {
      best = player;
      bestScore = score;
    }
  }

  mob.targetKind = best ? 'player' : '';
  mob.targetPlayerId = best?.id ?? 0;
  return best;
}

export function getMobTarget(state, mob) {
  if (mob.demoMob) return getDemoTarget(state, mob);
  if (mob.baseRaidTargetId) {
    const structure = state.structures?.get?.(mob.baseRaidTargetId | 0) || null;
    if (structure?.stats?.hp > 0
      && (structure.sx | 0) === (mob.sx | 0)
      && (structure.sy | 0) === (mob.sy | 0)
      && String(structure.worldId || 'endless') === String(mob.worldId || 'endless')) {
      mob.targetKind = 'structure';
      return structure;
    }
    mob.baseRaidTargetId = 0;
  }
  if (!mob.targetPlayerId) return null;
  const player = state.players.get(mob.targetPlayerId) ?? null;
  if (!player) return null;
  if ((player.sx | 0) !== (mob.sx | 0) || (player.sy | 0) !== (mob.sy | 0)) return null;
  if (player.dockedStationId) return null;
  if (isPlayerSessionPending(player)) return null;
  if (isUntargetable(player) || !canTargetEntity(mob, player)) return null;
  return player;
}

export function targetWithinLeash(mob, target) {
  const leashDx = target.x - mob.homeX;
  const leashDy = target.y - mob.homeY;
  const leashD2 = leashDx * leashDx + leashDy * leashDy;
  return leashD2 <= mob.leashRange * mob.leashRange;
}

export function moveMobToward(mob, tx, ty, dt, desiredRange = 0) {
  const dx = tx - mob.x;
  const dy = ty - mob.y;
  const d2 = dx * dx + dy * dy;
  if (d2 <= desiredRange * desiredRange || blocksVoluntaryMove(mob)) {
    clearMobVelocity(mob);
    return false;
  }
  const n = norm(dx, dy);
  const speed = mob.moveSpeed * getMoveSpeedMultiplier(mob);
  mob.vx = n.x * speed;
  mob.vy = n.y * speed;
  mob.x += mob.vx * dt;
  mob.y += mob.vy * dt;
  mob.rot = Math.atan2(mob.vy, mob.vx);
  return true;
}

export function moveMobAway(mob, tx, ty, dt, minRange) {
  const dx = mob.x - tx;
  const dy = mob.y - ty;
  const d2 = dx * dx + dy * dy;
  if (d2 >= minRange * minRange || blocksVoluntaryMove(mob)) {
    clearMobVelocity(mob);
    return false;
  }
  const n = norm(dx, dy);
  const speed = mob.moveSpeed * getMoveSpeedMultiplier(mob);
  mob.vx = n.x * speed;
  mob.vy = n.y * speed;
  mob.x += mob.vx * dt;
  mob.y += mob.vy * dt;
  mob.rot = Math.atan2(mob.vy, mob.vx);
  return true;
}

export function updateMobReturnHome(mob, dt) {
  const dx = mob.homeX - mob.x;
  const dy = mob.homeY - mob.y;
  const d2 = dx * dx + dy * dy;
  if (d2 <= 9) {
    mob.x = mob.homeX;
    mob.y = mob.homeY;
    clearMobVelocity(mob);
    return;
  }
  if (blocksVoluntaryMove(mob)) {
    clearMobVelocity(mob);
    return;
  }
  const n = norm(dx, dy);
  const speed = Math.max(40, mob.moveSpeed * 0.75) * getMoveSpeedMultiplier(mob);
  mob.vx = n.x * speed;
  mob.vy = n.y * speed;
  mob.x += mob.vx * dt;
  mob.y += mob.vy * dt;
  mob.rot = Math.atan2(mob.vy, mob.vx);
}

export function clampMobToDemoCage(mob) {
  if (!mob?.demoMob || !mob.demoCageRadius) return;
  const cx = mob.demoCageX ?? mob.homeX ?? mob.x;
  const cy = mob.demoCageY ?? mob.homeY ?? mob.y;
  const maxR = Math.max(20, mob.demoCageRadius - (mob.radius ?? 14) - 16);
  const dx = mob.x - cx;
  const dy = mob.y - cy;
  const d = Math.hypot(dx, dy);
  if (d <= maxR || d <= 0.0001) return;
  mob.x = cx + dx / d * maxR;
  mob.y = cy + dy / d * maxR;
}

export function moveMobOrbitAround(mob, cx, cy, dt, radius, angularSpeed = 0.75, phase = 0) {
  if (blocksVoluntaryMove(mob)) {
    clearMobVelocity(mob);
    return false;
  }
  const t = ((Date.now() + ((mob.seed || mob.id || 0) % 9973)) / 1000) * angularSpeed + phase;
  const tx = cx + Math.cos(t) * radius;
  const ty = cy + Math.sin(t) * radius;
  const dx = tx - mob.x;
  const dy = ty - mob.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) {
    clearMobVelocity(mob);
    return false;
  }
  const speed = mob.moveSpeed * getMoveSpeedMultiplier(mob);
  const step = Math.min(d, speed * dt);
  mob.vx = dx / d * speed;
  mob.vy = dy / d * speed;
  mob.x += dx / d * step;
  mob.y += dy / d * step;
  mob.rot = Math.atan2(mob.vy, mob.vx);
  clampMobToDemoCage(mob);
  return true;
}
