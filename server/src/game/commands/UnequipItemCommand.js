import { unequipStationItem } from '../station/shop/StationShopSystem.js';

export function handleUnequipItem(state, player, msg, timeMs) {
  const itemId = String(msg?.itemId || '').trim();
  if (!itemId) return false;
  return unequipStationItem(state, player, itemId, timeMs);
}
