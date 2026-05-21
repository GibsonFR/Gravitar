import { equipStationItem } from '../station/shop/StationShopSystem.js';

export function handleEquipItem(state, player, msg, timeMs) {
  const itemId = String(msg?.itemId || '').trim();
  if (!itemId) return false;
  return equipStationItem(state, player, itemId, timeMs);
}
