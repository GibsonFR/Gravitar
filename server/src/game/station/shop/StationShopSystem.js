import { getItemDef } from '../../../../../shared/content/items/ItemDefs.js';
import { getPlayerItemDef } from '../../equipment/PlayerEquipmentDefs.js';
import { ITEM_CATEGORY_IDS } from '../../../../../shared/content/items/ItemCategoryIds.js';
import { getDockedStation } from '../StationAccess.js';
import { equipOwnedItem, hasOwnedItem, isItemEquipped, removeOwnedItem, sortEquipmentIdsStable, unequipOwnedItem } from '../../equipment/EquipmentRules.js';
import { addRocketAmmo, getRocketAmmoQuantity, consumeRocketAmmo } from '../../rocket/RocketAmmoRules.js';
import { syncPlayerFrameStats } from '../../frames/FrameStatSync.js';
import { consumeOfferCosts } from './StationOfferCosts.js';
import { getEffectivePurchasePriceCredits, getEffectiveSellPriceCredits } from '../../bastion/BastionBuffs.js';
import { ensureStationStockCurrent } from './StationStockRefresh.js';

export function buyStationItem(state, player, itemId, timeMs = 0) {
  const station = getDockedStation(state, player);
  ensureStationStockCurrent(station, timeMs);
  if (!station?.stock?.offers?.length) return false;

  const offer = station.stock.offers.find((entry) => entry.itemId === itemId);
  if (!offer) return false;

  const def = getItemDef(itemId);
   if (!def) return false;
  if (def.categoryId !== ITEM_CATEGORY_IDS.AMMO && hasOwnedItem(player, itemId)) return false;

  const pricedOffer = { ...offer, priceCredits: getEffectivePurchasePriceCredits(player, offer.priceCredits || def.priceCredits || 0) };
  if (!consumeOfferCosts(player?.inv, pricedOffer)) return false;

  if (def.categoryId === ITEM_CATEGORY_IDS.AMMO) {
    const packSize = Math.max(1, def.ammoProfile?.packSize | 0);
    return addRocketAmmo(player, def.id, packSize, timeMs);
  }

  player.equipment.ownedItemIds = sortEquipmentIdsStable([...(player.equipment.ownedItemIds ?? []), def.id]);
  player.equipment.lastChangedAt = timeMs | 0;
  return true;
}

export function equipStationItem(state, player, itemId, timeMs = 0) {
  const def = getPlayerItemDef(player, itemId) || getItemDef(itemId);
  if (!def) return false;

  // The generic equip command is used by UI buttons/double-click. For single-slot
  // categories it should behave like a normal RPG inventory: replace the current
  // item instead of silently failing when the category is already full.
  if (def.categoryId !== ITEM_CATEGORY_IDS.AMMO && def.categoryId !== ITEM_CATEGORY_IDS.CONVERTER) {
    const cap = Math.max(0, player?.equipment?.slotCaps?.[def.categoryId] ?? 0);
    if (cap === 1 && hasOwnedItem(player, itemId)) {
      return equipStationItemToSlot(state, player, itemId, def.categoryId, def.categoryId, 0, timeMs);
    }
  }

  const ok = equipOwnedItem(player, itemId, timeMs);
  if (!ok) return false;
  syncPlayerFrameStats(player, { restoreVitals: false, preserveRatios: true });
  return true;
}

export function unequipStationItem(state, player, itemId, timeMs = 0) {
  const ok = unequipOwnedItem(player, itemId, timeMs);
  if (!ok) return false;
  syncPlayerFrameStats(player, { restoreVitals: false, preserveRatios: true });
  return true;
}



export function equipStationItemToSlot(state, player, itemId, categoryId, slotId = '', index = 0, timeMs = 0) {
  const def = getPlayerItemDef(player, itemId) || getItemDef(itemId);
  if (!def) return false;
  if (def.categoryId !== categoryId) return false;
  if (def.categoryId === ITEM_CATEGORY_IDS.AMMO) return false;
  if (!hasOwnedItem(player, itemId)) return false;

  const equipment = player.equipment ?? (player.equipment = {});
  const equipped = [...(equipment.equippedItemIds ?? [])];
  const caps = equipment.slotCaps ?? {};
  const cap = Math.max(0, caps[categoryId] ?? 0);
  if (cap <= 0) return false;

  const sameCategory = equipped.filter((id) => (getPlayerItemDef(player, id) || getItemDef(id))?.categoryId === categoryId);
  const targetIndex = Math.max(0, Math.min(cap - 1, index | 0));
  const alreadyInSameCategory = sameCategory.includes(itemId);

  let next = equipped.filter((id) => id !== itemId);

  if (categoryId === ITEM_CATEGORY_IDS.MODULE || categoryId === ITEM_CATEGORY_IDS.CONVERTER) {
    const currentSame = next.filter((id) => (getPlayerItemDef(player, id) || getItemDef(id))?.categoryId === categoryId);
    const targetCurrent = currentSame[targetIndex] || '';
    if (targetCurrent) next = next.filter((id) => id !== targetCurrent);
  } else {
    next = next.filter((id) => (getPlayerItemDef(player, id) || getItemDef(id))?.categoryId !== categoryId);
  }

  const currentCountAfterRemoval = next.filter((id) => (getPlayerItemDef(player, id) || getItemDef(id))?.categoryId === categoryId).length;
  if (currentCountAfterRemoval >= cap && !alreadyInSameCategory) return false;

  const beforeCategory = [];
  const afterCategory = [];
  for (const id of next) {
    const d = getPlayerItemDef(player, id) || getItemDef(id);
    if (d?.categoryId === categoryId) afterCategory.push(id);
    else beforeCategory.push(id);
  }

  if (categoryId === ITEM_CATEGORY_IDS.MODULE || categoryId === ITEM_CATEGORY_IDS.CONVERTER) {
    const group = [...afterCategory];
    group.splice(Math.max(0, Math.min(targetIndex, group.length)), 0, itemId);
    equipment.equippedItemIds = [...beforeCategory, ...group];
  } else {
    equipment.equippedItemIds = [...beforeCategory, itemId];
  }

  equipment.lastChangedAt = timeMs | 0;
  syncPlayerFrameStats(player, { restoreVitals: false, preserveRatios: true });
  return true;
}

export function sellStationItem(state, player, itemId, timeMs = 0) {
  const station = getDockedStation(state, player);
  if (!station) return false;

  const def = getPlayerItemDef(player, itemId) || getItemDef(itemId);
  if (!def) return false;

  if (def.categoryId === ITEM_CATEGORY_IDS.AMMO && def.ammoProfile) {
    const packSize = Math.max(1, def.ammoProfile.packSize | 0);
    const ownedQty = getRocketAmmoQuantity(player, itemId);
    if (ownedQty <= 0) return false;
    const soldQty = Math.max(1, Math.min(packSize, ownedQty));
    const sellPrice = getEffectiveSellPriceCredits(player, Math.max(1, Math.round(Math.max(1, def.priceCredits || 0) * (soldQty / packSize) * 0.6)));
    if (!consumeRocketAmmo(player, itemId, soldQty, timeMs)) return false;
    player.inv.credits = Math.max(0, (player.inv.credits | 0) + sellPrice);
    return true;
  }

  if (!hasOwnedItem(player, itemId)) return false;
  if (isItemEquipped(player, itemId)) return false;

  const sellPrice = getEffectiveSellPriceCredits(player, Math.max(1, Math.round((def.priceCredits || 0) * 0.6)));
  removeOwnedItem(player, itemId, timeMs);
  player.inv.credits = Math.max(0, (player.inv.credits | 0) + sellPrice);
  return true;
}
