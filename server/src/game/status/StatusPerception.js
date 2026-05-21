import { isCamouflaged, canSeeCamouflaged } from './StatusRack.js';

export function canTargetEntity(observer, target) {
  if (!target) return false;
  if (!isCamouflaged(target)) return true;
  return canSeeCamouflaged(observer, target);
}
