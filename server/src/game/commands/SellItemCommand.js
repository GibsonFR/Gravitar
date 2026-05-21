import { sellStationItem } from '../station/shop/StationShopSystem.js';

export function handleSellItem(state, player, msg, timeMs) {
  const itemId = String(msg?.itemId || '').trim();
  if (!itemId) return false;
  return sellStationItem(state, player, itemId, timeMs);
}
