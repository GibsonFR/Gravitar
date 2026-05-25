import { DotNetRandom } from '../../util/DotNetRandom.js';
import { hash2D_Mix } from '../../util/HashUtil.js';
import { ITEM_CATEGORY_IDS, ITEM_CATEGORY_ORDER } from '../../../../../shared/content/items/ItemCategoryIds.js';
import { ITEM_TAG_IDS } from '../../../../../shared/content/items/ItemTagIds.js';
import { listItemDefs } from '../../../../../shared/content/items/ItemDefs.js';
import { generateOfferResourceCosts } from './StationOfferCosts.js';
import { buildStationLocalResourcePool, getStationTierGateFromLocalPool } from './StationLocalResourcePool.js';
import { getStationSpecialtyDef } from './StationStockSpecialties.js';
import { computePirateTier, createPirateDemand, createPirateResourceSupply } from '../pirate/PirateStationEconomy.js';
import { listConversionRecipesForStation } from '../../../../../shared/content/conversion/ConversionRecipeDefs.js';
import { createPirateQuestOffers } from '../../../../../shared/content/pirate/PirateQuestDefs.js';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function priceVarianceForItem(rng, tech, item) {
  const tier = Math.max(1, item?.tier | 0);
  const base = tech ? 0.97 + rng.nextDouble() * 0.14 : 0.93 + rng.nextDouble() * 0.10;
  const tierBias = 1 + Math.max(0, tier - 1) * (tech ? 0.025 : 0.018);
  return clamp(base * tierBias, 0.85, 1.20);
}

function isPirateOffer(item) {
  if (!item) return false;
  if (item.categoryId === ITEM_CATEGORY_IDS.AMMO) return true;
  const tags = item.tags || [];
  return tags.some((t) => t.tagId === ITEM_TAG_IDS.REAVER || t.tagId === ITEM_TAG_IDS.SIPHON || t.tagId === ITEM_TAG_IDS.SIEGE);
}

function compareStockItems(a, b) {
  const ao = ITEM_CATEGORY_ORDER.indexOf(a?.categoryId);
  const bo = ITEM_CATEGORY_ORDER.indexOf(b?.categoryId);
  if (ao !== bo) return ao - bo;
  const at = a?.tier | 0;
  const bt = b?.tier | 0;
  if (at !== bt) return at - bt;
  return String(a?.name || a?.id || '').localeCompare(String(b?.name || b?.id || ''));
}


const BASE_CATEGORY_COUNTS = Object.freeze({
  [ITEM_CATEGORY_IDS.WEAPON]: 8,
  [ITEM_CATEGORY_IDS.LAUNCHER]: 7,
  [ITEM_CATEGORY_IDS.DEFENSE]: 7,
  [ITEM_CATEGORY_IDS.ENGINE]: 7,
  [ITEM_CATEGORY_IDS.MODULE]: 10,
  [ITEM_CATEGORY_IDS.AMMO]: 12,
  [ITEM_CATEGORY_IDS.CONVERTER]: 7
});

function categorySeedOffset(categoryId) {
  let h = 0;
  const str = String(categoryId || '');
  for (let i = 0; i < str.length; i += 1) h = ((h * 31) ^ str.charCodeAt(i)) | 0;
  return h | 0;
}

function stationDistanceTierBonus(sx = 0, sy = 0) {
  const d = Math.abs(sx | 0) + Math.abs(sy | 0);
  if (d >= 18) return 3;
  if (d >= 10) return 2;
  if (d >= 5) return 1;
  return 0;
}

function targetCountForCategory(categoryId, tech, specialty) {
  const base = BASE_CATEGORY_COUNTS[categoryId] ?? 6;
  const techBonus = tech ? (categoryId === ITEM_CATEGORY_IDS.AMMO || categoryId === ITEM_CATEGORY_IDS.CONVERTER ? 2 : 1) : 0;
  const specialtyBonus = specialty?.countBias?.[categoryId] ?? 0;
  return clamp(base + techBonus + specialtyBonus, 3, categoryId === ITEM_CATEGORY_IDS.AMMO ? 18 : 14);
}

function seededShuffle(items, seed) {
  const out = [...items];
  const rng = new DotNetRandom(seed | 0);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = rng.nextMax(i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function chooseCategoryOffers(all, categoryId, rng, stationSeed, tech, specialty, tierGate, sx, sy) {
  const count = targetCountForCategory(categoryId, tech, specialty);
  const specialtyTierBonus = specialty?.tierBias?.[categoryId] ?? 0;
  const effectiveTierGate = clamp(tierGate + specialtyTierBonus + stationDistanceTierBonus(sx, sy), 1, 10);
  let pool = all.filter((item) => item?.categoryId === categoryId && (item?.tier | 0) <= effectiveTierGate);
  if (!pool.length) pool = all.filter((item) => item?.categoryId === categoryId);
  if (!pool.length) return [];

  const preferredMinTier = clamp(effectiveTierGate - (tech ? 2 : 1), 1, 10);
  const preferred = pool.filter((item) => (item?.tier | 0) >= preferredMinTier);
  const lower = pool.filter((item) => (item?.tier | 0) < preferredMinTier);
  const seedBase = (stationSeed ^ categorySeedOffset(categoryId) ^ ((sx | 0) * 73856093) ^ ((sy | 0) * 19349663)) | 0;
  const shuffledPreferred = seededShuffle(preferred, seedBase ^ 0x5a3c21);
  const shuffledLower = seededShuffle(lower, seedBase ^ 0x61e57d);
  const mixed = [...shuffledPreferred, ...shuffledLower];
  const selected = [];
  const seen = new Set();

  for (const item of mixed) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    selected.push(item);
    if (selected.length >= count) break;
  }

  // If a category has too few gated entries, fill with lower/any entries so the shop
  // never collapses to a single munition/converter in ordinary stations.
  if (selected.length < Math.min(count, pool.length)) {
    for (const item of seededShuffle(pool, seedBase ^ 0x17b91f)) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      selected.push(item);
      if (selected.length >= count) break;
    }
  }

  // Rotate a few entries with the station RNG so two stations at the same distance do
  // not show the exact same ammunition page.
  if (selected.length > 3 && rng.nextDouble() < 0.85) {
    const shift = rng.nextMax(selected.length);
    selected.push(...selected.splice(0, shift));
  }
  return selected.slice(0, count);
}

function selectStationOffers(all, rng, stationSeed, tech, pirate, specialty, tierGate, sx, sy, localResourcePool) {
  const items = [];
  for (const categoryId of ITEM_CATEGORY_ORDER) {
    items.push(...chooseCategoryOffers(all, categoryId, rng, stationSeed, tech, specialty, tierGate, sx, sy));
  }
  const sorted = items.sort(compareStockItems);
  return sorted.map((item, index) => {
    const variance = priceVarianceForItem(rng, tech, item);
    const pirateMult = pirate ? 1.08 : 1;
    const specialtyMult = specialty?.priceBias?.[item.categoryId] ?? 1;
    // Distance should unlock better/tiered stock, not multiply prices by hundreds in far/test sectors.
    // Keep only a small frontier premium tied to the same tier bonus used for item selection.
    const frontierPremium = stationDistanceTierBonus(sx, sy);
    const distanceMult = 1 + frontierPremium * 0.08;
    const priceCredits = Math.max(1, Math.round((item.priceCredits || 0) * variance * pirateMult * specialtyMult * distanceMult));
    return {
      itemId: item.id,
      priceCredits,
      tier: item.tier || 1,
      categoryId: item.categoryId,
      resourceCosts: generateOfferResourceCosts(stationSeed ^ (index * 131) ^ ((sx | 0) << 8) ^ ((sy | 0) << 16), item, priceCredits, localResourcePool)
    };
  });
}


function createConversionRecipeOffers(stockLike, playerSeed = 0) {
  const recipes = listConversionRecipesForStation(stockLike, null);
  return recipes.slice(0, 5).map((recipe, index) => {
    const seedBias = Math.abs((playerSeed ^ (index * 2654435761)) | 0) % 9;
    const priceMult = 1 + seedBias * 0.015;
    return {
      recipeId: recipe.id,
      priceCredits: Math.max(1, Math.round((recipe.piratePrice || 500) * priceMult)),
      tier: recipe.tier || 1,
      reputationRequired: recipe.reputationRequired | 0 || 0,
      stationTierMin: recipe.stationTierMin | 0 || 1,
      soldOut: false
    };
  });
}

export function createStationStock(seed, tech = false, sx = 0, sy = 0, options = null) {
  const stationSeed = hash2D_Mix((seed | 0) ^ (tech ? 0x51f3 : 0x0f2d), sx | 0, sy | 0);
  const rng = new DotNetRandom(stationSeed);
  const worldSeed = options?.worldSeed | 0;
  const localResourcePool = buildStationLocalResourcePool(worldSeed, sx, sy);
  const tierGate = getStationTierGateFromLocalPool(tech, localResourcePool);
  const pirate = options?.specialtyId === 'pirate';
  const pirateTier = pirate ? computePirateTier(sx, sy) : 0;
  const specialty = getStationSpecialtyDef(options?.specialtyId || '');
  const all = listItemDefs({ shopOnly: true })
    .filter((item) => item?.categoryId !== ITEM_CATEGORY_IDS.CONVERTER)
    .filter((item) => !pirate || isPirateOffer(item))
    .sort(compareStockItems);

  const offers = selectStationOffers(all, rng, stationSeed, tech, pirate, specialty, tierGate, sx, sy, localResourcePool);
  const demand = pirate ? createPirateDemand(localResourcePool, stationSeed, pirateTier) : [];
  const resourceSupply = pirate ? createPirateResourceSupply(localResourcePool, stationSeed, pirateTier) : [];
  const conversionRecipeOffers = pirate ? createConversionRecipeOffers({ pirateTier, stock: { pirateTier } }, stationSeed) : [];
  const questOffers = pirate ? createPirateQuestOffers({
    stationSeed,
    pirateTier,
    resourceKeys: localResourcePool?.resourceKeys || []
  }) : [];

  return {
    tech: !!tech,
    specialtyId: pirate ? 'pirate' : '',
    specialtyName: pirate ? 'Marché pirate' : '',
    pirateTier,
    refreshSeed: stationSeed,
    refreshIndex: 0,
    refreshAtMs: 0,
    nextRefreshAtMs: 0,
    refreshMs: 0,
    refreshLeftMs: 0,
    tierGate,
    localResourcePool,
    demand,
    resourceDemand: demand,
    resourceSupply,
    conversionRecipeOffers,
    questOffers,
    offers
  };
}
