import { ITEM_CATEGORY_IDS } from '../../../../shared/content/items/ItemCategoryIds.js';
import { getItemDef } from '../../../../shared/content/items/ItemDefs.js';
import { buyStationItem } from '../station/shop/StationShopSystem.js';
import { assignRocketAmmoToSlot } from '../rocket/RocketAmmoRules.js';

export function handleBuyAndAssignRocketAmmo(state, player, msg, timeMs) {
  const itemId = String(msg?.itemId || '').trim();
  const slot = Number.isFinite(msg?.slot) ? (msg.slot | 0) : 0;
  if (!itemId) return false;

  const def = getItemDef(itemId);
  if (!def || def.categoryId !== ITEM_CATEGORY_IDS.AMMO || !def.ammoProfile) return false;

  const bought = buyStationItem(state, player, itemId, timeMs);
  if (!bought) return false;

  // Atomic station action: once the purchase succeeded, immediately put the
  // bought pack in the requested rocket slot. This avoids the UI having to send
  // buy_item then assign_rocket_ammo as two separate websocket commands, which
  // could be rate-limited or applied one snapshot later.
  return assignRocketAmmoToSlot(player, itemId, slot, timeMs);
}
