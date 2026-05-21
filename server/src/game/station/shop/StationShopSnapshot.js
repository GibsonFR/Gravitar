import { getItemCategoryName } from '../../../../../shared/content/items/ItemCategoryIds.js';
import { getItemDef } from '../../../../../shared/content/items/ItemDefs.js';
import { getResourceDef } from '../../inventory/ResourceDefs.js';
import { canAffordOffer } from './StationOfferCosts.js';
import { ensureStationStockCurrent } from './StationStockRefresh.js';
import { getEffectivePurchasePriceCredits, getEffectiveSellPriceCredits } from '../../bastion/BastionBuffs.js';

function buildResourceCosts(offer, player) {
  return (offer?.resourceCosts || []).map((entry) => {
    const key = String(entry?.resourceKey || '');
    const need = Math.max(0, entry?.amount | 0);
    const def = getResourceDef(key);
    const have = Math.max(0, player?.inv?.resources?.[key] | 0);
    return {
      resourceKey: key,
      amount: need,
      name: def?.name || key,
      colorHex: def?.colorHex || '#cfd7e6',
      have,
      missing: Math.max(0, need - have),
      affordable: have >= need
    };
  });
}

export function buildStationShopSnapshot(station, player, timeMs = 0) {
  if (!station) return null;
  ensureStationStockCurrent(station, timeMs);
  if (!station?.stock) return null;
  return {
    stationId: station.id,
    tech: !!station.tech,
    specialtyId: '',
    specialtyName: '',
    refreshIndex: 0,
    refreshAtMs: 0,
    nextRefreshAtMs: 0,
    refreshMs: 0,
    refreshLeftMs: 0,
    tierGate: Math.max(1, station.stock.tierGate | 0),
    localResourcePool: {
      radius: Math.max(0, station.stock.localResourcePool?.radius | 0),
      maxSpawnTier: Math.max(1, station.stock.localResourcePool?.maxSpawnTier | 0),
      resourceKeys: (station.stock.localResourcePool?.resourceKeys || []).slice(0, 12),
      currentSectorKeys: (station.stock.localResourcePool?.currentSectorKeys || []).slice(0, 8)
    },
    offers: (station.stock.offers ?? []).map((offer) => {
      const def = getItemDef(offer.itemId);
      if (!def) return null;
      const ammoQuantity = Math.max(0, player?.equipment?.rocketAmmoCountsById?.[def.id] | 0);
      const owned = def.categoryId === 'ammo' ? ammoQuantity > 0 : (player?.equipment?.ownedItemIds ?? []).includes(def.id);
      const equipped = def.categoryId === 'ammo' ? (player?.equipment?.rocketAmmoSlotItemIds || []).includes(def.id) : (player?.equipment?.equippedItemIds ?? []).includes(def.id);
      return {
        itemId: def.id,
        name: def.name,
        shortName: def.shortName || def.name,
        categoryId: def.categoryId,
        categoryName: getItemCategoryName(def.categoryId),
        tier: def.tier || 1,
        priceCredits: getEffectivePurchasePriceCredits(player, offer.priceCredits || def.priceCredits || 0),
        basePriceCredits: def.priceCredits || 0,
        description: def.description || '',
        bonuses: { ...(def.bonuses ?? {}) },
        tags: (def.tags ?? []).map((tag) => ({ ...tag })),
        weaponProfile: def.weaponProfile ? { ...def.weaponProfile } : null,
        launcherProfile: def.launcherProfile ? { ...def.launcherProfile } : null,
        converterProfile: def.converterProfile ? { ...def.converterProfile } : null,
        ammoProfile: def.ammoProfile ? { ...def.ammoProfile } : null,
        resourceCosts: buildResourceCosts(offer, player),
        ammoQuantity: Math.max(0, player?.equipment?.rocketAmmoCountsById?.[def.id] | 0),
        assignedRocketSlots: (player?.equipment?.rocketAmmoSlotItemIds || []).map((id, index) => id === def.id ? index : -1).filter((index) => index >= 0),
        activeRocketSlot: (player?.equipment?.activeRocketSlot | 0) || 0,
        owned,
        equipped,
        canAfford: canAffordOffer(player?.inv, { ...offer, priceCredits: getEffectivePurchasePriceCredits(player, offer.priceCredits || def.priceCredits || 0) }),
        sellPriceCredits: getEffectiveSellPriceCredits(player, Math.max(1, Math.round((def.priceCredits || 0) * 0.6)))
      };
    }).filter(Boolean)
  };
}
