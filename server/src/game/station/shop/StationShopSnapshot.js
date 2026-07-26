import { getItemCategoryName } from '../../../../../shared/content/items/ItemCategoryIds.js';
import { getItemDef } from '../../../../../shared/content/items/ItemDefs.js';
import { getResourceDef } from '../../inventory/ResourceDefs.js';
import { canAffordOffer } from './StationOfferCosts.js';
import { ensureStationStockCurrent } from './StationStockRefresh.js';
import { getEffectivePurchasePriceCredits, getEffectiveSellPriceCredits } from '../../bastion/BastionBuffs.js';
import { createStationBarterOffers, getStationDemandForResource, getStationSupplyForResource } from '../pirate/PirateStationEconomy.js';
import { getConversionRecipe } from '../../../../../shared/content/conversion/ConversionRecipeDefs.js';
import { MOB_DEFS } from '../../../../../shared/content/mobs/MobDefs.js';
import { ensurePlayerPirateState, hasUnlockedConversionRecipe, getPirateReputationSnapshot } from '../../player/runtime/PlayerPirateState.js';


function serializePassiveEffects(def) {
  const out = [];
  const rawPassives = Array.isArray(def?.passives) ? def.passives : [];
  for (const entry of rawPassives) {
    if (typeof entry === 'string') out.push(entry);
    else if (entry) out.push({ name: entry.name || entry.label || '', text: entry.text || entry.description || entry.name || '' });
  }
  const rawEffects = Array.isArray(def?.passiveEffects) ? def.passiveEffects : [];
  for (const entry of rawEffects) {
    if (typeof entry === 'string') out.push(entry);
    else if (entry) out.push({
      name: entry.name || entry.label || '',
      text: entry.text || entry.description || entry.name || '',
      trigger: entry.trigger || '',
      every: entry.every || 0,
      chance: entry.chance == null ? 1 : Number(entry.chance || 0)
    });
  }
  return out;
}


function buildDemandSnapshot(station, player) {
  return (station?.stock?.demand || station?.stock?.resourceDemand || []).map((entry) => {
    const key = String(entry?.resourceKey || '');
    const def = getResourceDef(key);
    const have = Math.max(0, player?.inv?.resources?.[key] | 0);
    const priceCredits = Math.max(0, entry?.priceCredits | 0);
    return {
      resourceKey: key,
      key,
      name: def?.name || key,
      colorHex: def?.colorHex || '#cfd7e6',
      priceCredits,
      sellUnitPrice: priceCredits,
      have,
      maxAmount: Math.max(0, entry?.maxAmount | 0),
      reputationXpPerUnit: Number(entry?.reputationXpPerUnit || 0),
      sellTotalValue: have * priceCredits
    };
  }).filter((entry) => entry.resourceKey);
}

function buildResourceSupplySnapshot(station, player) {
  return (station?.stock?.resourceSupply || []).map((entry) => {
    const key = String(entry?.resourceKey || '');
    const def = getResourceDef(key);
    const priceCredits = getEffectivePurchasePriceCredits(player, Math.max(0, entry?.priceCredits | 0));
    const stock = Math.max(0, entry?.stock ?? entry?.amount ?? 0);
    return {
      resourceKey: key,
      key,
      name: def?.name || key,
      colorHex: def?.colorHex || '#cfd7e6',
      priceCredits,
      amount: Math.max(1, entry?.amount | 0),
      stock,
      canAfford: Math.max(0, player?.inv?.credits | 0) >= priceCredits && stock > 0
    };
  }).filter((entry) => entry.resourceKey);
}

function buildResourceBarterSnapshot(station, player) {
  return createStationBarterOffers(station).map((offer) => {
    const inputDef = getResourceDef(offer.inputResourceKey);
    const outputDef = getResourceDef(offer.outputResourceKey);
    const have = Math.max(0, player?.inv?.resources?.[offer.inputResourceKey] | 0);
    const inputCargo = (inputDef?.cargoPerUnit || 1) * offer.inputAmount;
    const outputCargo = (outputDef?.cargoPerUnit || 1) * offer.outputAmount;
    const fitsCargo = (player?.inv?.cargoUsed || 0) - inputCargo + outputCargo <= (player?.inv?.cargoMax || 0);
    return {
      ...offer,
      inputName: inputDef?.name || offer.inputResourceKey,
      inputColorHex: inputDef?.colorHex || '#cfd7e6',
      outputName: outputDef?.name || offer.outputResourceKey,
      outputColorHex: outputDef?.colorHex || '#cfd7e6',
      have,
      canBarter: have >= offer.inputAmount && offer.stock >= offer.outputAmount && fitsCargo
    };
  });
}



function buildQuestSnapshot(station, player) {
  const pirate = ensurePlayerPirateState(player);
  const reputation = getPirateReputationSnapshot(player);
  const active = new Set(pirate.activeQuestIds || []);
  const completed = new Set(pirate.completedQuestIds || []);
  const offers = (station?.stock?.questOffers || []).map((offer) => {
    const questId = String(offer?.questId || '').toLowerCase();
    if (!questId) return null;
    const progress = pirate.questProgress?.[questId] || null;
    const type = offer.type || 'deliver_resource';
    const required = Math.max(1, offer.required | 0 || progress?.required | 0 || 1);
    const status = completed.has(questId) ? 'completed' : active.has(questId) ? 'active' : 'available';
    const resourceDef = getResourceDef(offer.resourceKey);
    const mobDef = MOB_DEFS[offer.targetMobId] || null;
    const have = type === 'kill_mob' ? Math.max(0, progress?.current | 0 || 0) : Math.max(0, player?.inv?.resources?.[offer.resourceKey] | 0);
    const current = status === 'active' ? Math.max(0, Math.min(required, type === 'kill_mob' ? (progress?.current | 0 || 0) : have)) : 0;
    return {
      questId,
      templateId: offer.templateId || '',
      type,
      name: offer.name || 'Quête pirate',
      description: offer.description || '',
      resourceKey: offer.resourceKey || '',
      resourceName: resourceDef?.name || offer.resourceKey || '',
      resourceColorHex: resourceDef?.colorHex || '#cfd7e6',
      targetMobId: offer.targetMobId || progress?.targetMobId || '',
      targetName: offer.targetName || progress?.targetName || mobDef?.name || offer.targetMobId || '',
      targetColorHex: mobDef?.color ? `rgb(${mobDef.color.r},${mobDef.color.g},${mobDef.color.b})` : '#ffbf7a',
      current,
      have,
      required,
      rewardCredits: Math.max(0, offer.rewardCredits | 0 || 0),
      rewardReputationXp: Math.max(0, offer.rewardReputationXp | 0 || 0),
      status,
      active: active.has(questId),
      completed: completed.has(questId),
      canAccept: status === 'available',
      canComplete: status === 'active' && current >= required
    };
  }).filter(Boolean);
  return {
    ...reputation,
    available: offers,
    activeCount: pirate.activeQuestIds?.length | 0 || 0,
    completedCount: pirate.completedQuestIds?.length | 0 || 0
  };
}

function buildConversionRecipeSnapshot(station, player) {
  const pirate = ensurePlayerPirateState(player);
  const reputationLevel = Math.max(0, pirate.reputationLevel | 0 || 0);
  return (station?.stock?.conversionRecipeOffers || []).map((offer) => {
    const recipe = getConversionRecipe(offer?.recipeId);
    if (!recipe) return null;
    const priceCredits = getEffectivePurchasePriceCredits(player, Math.max(1, offer.priceCredits | 0 || recipe.piratePrice | 0 || 1));
    const owned = hasUnlockedConversionRecipe(player, recipe.id);
    const reputationRequired = Math.max(0, offer.reputationRequired | 0 || recipe.reputationRequired | 0 || 0);
    const lockedByReputation = reputationLevel < reputationRequired;
    return {
      recipeId: recipe.id,
      id: recipe.id,
      name: recipe.name,
      tier: recipe.tier | 0 || 1,
      seconds: Number(recipe.seconds) || 0,
      energyUse: Number(recipe.energyUse) || 0,
      input: Object.entries(recipe.input || {}).map(([key, amount]) => {
        const def = getResourceDef(key);
        return { resourceKey: key, key, name: def?.name || key, amount: amount | 0, colorHex: def?.colorHex || '#cfd7e6' };
      }),
      output: Object.entries(recipe.output || {}).map(([key, amount]) => {
        const def = getResourceDef(key);
        return { resourceKey: key, key, name: def?.name || key, amount: amount | 0, colorHex: def?.colorHex || '#cfd7e6' };
      }),
      priceCredits,
      reputationRequired,
      owned,
      lockedByReputation,
      canAfford: !owned && !lockedByReputation && Math.max(0, player?.inv?.credits | 0) >= priceCredits
    };
  }).filter(Boolean);
}

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
    pirate: !!station.pirate,
    pirateTier: Math.max(0, station.pirateTier || station.stock.pirateTier || 0),
    specialtyId: station.stock.specialtyId || station.specialtyId || '',
    specialtyName: station.stock.specialtyName || station.specialtyName || '',
    refreshIndex: 0,
    refreshAtMs: 0,
    nextRefreshAtMs: 0,
    refreshMs: 0,
    refreshLeftMs: 0,
    tierGate: Math.max(1, station.stock.tierGate | 0),
    demand: buildDemandSnapshot(station, player),
    resourceDemand: buildDemandSnapshot(station, player),
    resourceSupply: buildResourceSupplySnapshot(station, player),
    resourceBarter: buildResourceBarterSnapshot(station, player),
    conversionRecipes: buildConversionRecipeSnapshot(station, player),
    quests: buildQuestSnapshot(station, player),
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
      const pirateState = ensurePlayerPirateState(player);
      const reputationRequired = Math.max(0, offer.reputationRequired | 0 || 0);
      const lockedByReputation = Math.max(0, pirateState.reputationLevel | 0 || 0) < reputationRequired;
      const effectivePriceCredits = getEffectivePurchasePriceCredits(player, offer.priceCredits || def.priceCredits || 0);
      const pricedOffer = { ...offer, priceCredits: effectivePriceCredits };
      return {
        itemId: def.id,
        name: def.name,
        shortName: def.shortName || def.name,
        categoryId: def.categoryId,
        categoryName: getItemCategoryName(def.categoryId),
        tier: def.tier || 1,
        priceCredits: effectivePriceCredits,
        basePriceCredits: def.priceCredits || 0,
        description: def.description || '',
        passives: serializePassiveEffects(def),
        passiveEffects: [],
        bonuses: { ...(def.bonuses ?? {}) },
        tags: (def.tags ?? []).map((tag) => ({ ...tag })),
        weaponProfile: def.weaponProfile ? { ...def.weaponProfile } : null,
        launcherProfile: def.launcherProfile ? { ...def.launcherProfile } : null,
        converterProfile: def.converterProfile ? { ...def.converterProfile } : null,
        ammoProfile: def.ammoProfile ? { ...def.ammoProfile } : null,
        resourceCosts: buildResourceCosts(offer, player),
        reputationRequired,
        lockedByReputation,
        pirateOnly: !!offer.pirateOnly,
        ammoQuantity: Math.max(0, player?.equipment?.rocketAmmoCountsById?.[def.id] | 0),
        assignedRocketSlots: (player?.equipment?.rocketAmmoSlotItemIds || []).map((id, index) => id === def.id ? index : -1).filter((index) => index >= 0),
        activeRocketSlot: (player?.equipment?.activeRocketSlot | 0) || 0,
        owned,
        equipped,
        canAfford: !lockedByReputation && canAffordOffer(player?.inv, pricedOffer),
        sellPriceCredits: getEffectiveSellPriceCredits(player, Math.max(1, Math.round((def.priceCredits || 0) * 0.6)))
      };
    }).filter(Boolean)
  };
}
