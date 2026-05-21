import { equipStationItemToSlot } from '../station/shop/StationShopSystem.js';

export function handleEquipItemToSlot(state, player, msg, timeMs) {
  const itemId = String(msg?.itemId || '').trim();
  const categoryId = String(msg?.categoryId || '').trim();
  const slotId = String(msg?.slotId || '').trim();
  const index = Math.max(0, Math.min(16, Number(msg?.index) | 0));
  if (!itemId || !categoryId) return false;
  return equipStationItemToSlot(state, player, itemId, categoryId, slotId, index, timeMs);
}
