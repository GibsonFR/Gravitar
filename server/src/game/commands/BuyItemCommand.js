import { buyStationItem } from '../station/shop/StationShopSystem.js';

export function handleBuyItem(state, player, msg, timeMs) {
  const itemId = String(msg?.itemId || '').trim();
  if (!itemId) return false;
  return buyStationItem(state, player, itemId, timeMs);
}
