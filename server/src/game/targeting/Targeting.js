import { distSq } from '../util/Math.js';
import { canTargetEntity } from '../status/StatusPerception.js';
import { isUntargetable } from '../status/StatusMotion.js';
import { isBlinded } from '../status/StatusRack.js';
import { isPlayerSessionPending } from '../player/PlayerSessionSetup.js';
import { isSafeNoPvpSector } from '../sector/SpecialSectors.js';
import { sameWorld } from '../modes/GameModes.js';

export const BLIND_TARGET_ACQUIRE_RADIUS = 135;

export function getTarget(state, kind, id) {
  if (kind === 'player') return state.players.get(id) ?? null;
  if (kind === 'mob') return state.mobs.get(id) ?? null;
  if (kind === 'asteroid') return state.asteroids.get(id) ?? null;
  if (kind === 'station') return state.stations.get(id) ?? null;
  if (kind === 'portal') return state.portals.get(id) ?? null;
  return null;
}

export function blindAllowsTarget(observer, target) {
  if (!observer || !target || !isBlinded(observer)) return true;
  const r = BLIND_TARGET_ACQUIRE_RADIUS + (target.radius ?? 0);
  return distSq(observer.x, observer.y, target.x, target.y) <= r * r;
}

export function blindAllowsPoint(observer, x, y) {
  if (!observer || !isBlinded(observer)) return true;
  return distSq(observer.x, observer.y, x, y) <= BLIND_TARGET_ACQUIRE_RADIUS * BLIND_TARGET_ACQUIRE_RADIUS;
}

export function getTargetForPlayer(state, player, kind, id) {
  const t = getTarget(state, kind, id);
  if (!t) return null;
  if ((t.sx | 0) !== (player.sx | 0) || (t.sy | 0) !== (player.sy | 0)) return null;
  if (!blindAllowsTarget(player, t)) return null;
  if (t.kind === 'player' && !sameWorld(player, t)) return null;
  if (t.kind === 'player' && isPlayerSessionPending(t)) return null;
  return t;
}

export function isPlayerAttackable(owner, target) {
  if (!target) return false;
  if (!blindAllowsTarget(owner, target)) return false;
  if (target.kind === 'player') {
    if (target.id === owner.id) return false;
    if (!sameWorld(owner, target)) return false;
    if (isSafeNoPvpSector(owner?.sx | 0, owner?.sy | 0) && isSafeNoPvpSector(target.sx | 0, target.sy | 0)) return false;
    if (isPlayerSessionPending(target)) return false;
    if (isUntargetable(target)) return false;
    return canTargetEntity(owner, target);
  }
  if (target.kind === 'mob') {
    if (isUntargetable(target)) return false;
    return canTargetEntity(owner, target) && target.stats.hp > 0;
  }
  if (target.kind === 'asteroid') return target.stats.hp > 0;
  return false;
}
