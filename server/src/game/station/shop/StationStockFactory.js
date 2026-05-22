import { DotNetRandom } from '../../util/DotNetRandom.js';
import { hash2D_Mix } from '../../util/HashUtil.js';
import { ITEM_CATEGORY_IDS, ITEM_CATEGORY_ORDER } from '../../../../../shared/content/items/ItemCategoryIds.js';
import { ITEM_TAG_IDS } from '../../../../../shared/content/items/ItemTagIds.js';
import { getItemDef, listItemDefs, listProceduralAffixIdsForCategory, makeProceduralItemId } from '../../../../../shared/content/items/ItemDefs.js';
import { generateOfferResourceCosts } from './StationOfferCosts.js';
import { buildStationLocalResourcePool, getStationTierGateFromLocalPool } from './StationLocalResourcePool.js';
import { NORMAL_STATION_BASE_COUNTS, TECH_STATION_BASE_COUNTS } from './StationShopTuning.js';

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


function pickBaseForCategory(rng, items, categoryId, tierGate, index) {
  const candidates = items
    .filter((item) => item.categoryId === categoryId)
    .filter((item) => (item.tier | 0) <= tierGate)
    .filter((item) => item.shopOffer !== false);
  if (!candidates.length) return null;
  return candidates[(rng.nextMax(candidates.length) + index) % candidates.length];
}

function createProceduralOffers(rng, stationSeed, sx, sy, tech, pirate, tierGate, staticItems) {
  const counts = tech ? TECH_STATION_BASE_COUNTS : NORMAL_STATION_BASE_COUNTS;
  const categories = ITEM_CATEGORY_ORDER.filter((categoryId) => categoryId !== ITEM_CATEGORY_IDS.AMMO && categoryId !== ITEM_CATEGORY_IDS.CONVERTER);
  const out = [];
  for (const categoryId of categories) {
    const affixes = listProceduralAffixIdsForCategory(categoryId);
    if (!affixes.length) continue;
    const targetCount = Math.max(0, (counts[categoryId] | 0) + (tech ? 2 : 1));
    for (let i = 0; i < targetCount; i += 1) {
      const base = pickBaseForCategory(rng, staticItems, categoryId, tierGate, i);
      if (!base) continue;
      if (pirate && !isPirateOffer(base)) continue;
      const affixId = affixes[Math.abs((stationSeed ^ (i * 1103515245) ^ (categoryId.length * 2654435761)) | 0) % affixes.length];
      const itemId = makeProceduralItemId(base.id, affixId, stationSeed ^ ((sx | 0) * 73856093) ^ ((sy | 0) * 19349663) ^ (i * 83492791) ^ hashCategory(categoryId));
      const def = getItemDef(itemId);
      if (def) out.push(def);
    }
  }
  return out;
}

function hashCategory(categoryId) {
  let h = 0x45d9f3b;
  for (let i = 0; i < String(categoryId).length; i += 1) h = Math.imul(h ^ String(categoryId).charCodeAt(i), 16777619);
  return h | 0;
}

export function createStationStock(seed, tech = false, sx = 0, sy = 0, options = null) {
  const stationSeed = hash2D_Mix((seed | 0) ^ (tech ? 0x51f3 : 0x0f2d), sx | 0, sy | 0);
  const rng = new DotNetRandom(stationSeed);
  const worldSeed = options?.worldSeed | 0;
  const localResourcePool = buildStationLocalResourcePool(worldSeed, sx, sy);
  const tierGate = getStationTierGateFromLocalPool(tech, localResourcePool);
  const pirate = options?.specialtyId === 'pirate';
  const staticItems = listItemDefs({ shopOnly: true })
    .filter((item) => (item?.tier | 0) <= tierGate)
    .filter((item) => !pirate || isPirateOffer(item));
  const proceduralItems = createProceduralOffers(rng, stationSeed, sx, sy, tech, pirate, tierGate, listItemDefs({ shopOnly: true }));
  const all = [...staticItems, ...proceduralItems].sort(compareStockItems);

  const offers = all.map((item, index) => {
    const variance = priceVarianceForItem(rng, tech, item);
    const pirateMult = pirate ? 1.08 : 1;
    const priceCredits = Math.max(1, Math.round((item.priceCredits || 0) * variance * pirateMult));
    return {
      itemId: item.id,
      priceCredits,
      tier: item.tier || 1,
      categoryId: item.categoryId,
      resourceCosts: generateOfferResourceCosts(stationSeed ^ (index * 131) ^ ((sx | 0) << 8) ^ ((sy | 0) << 16), item, priceCredits, localResourcePool)
    };
  });

  return {
    tech: !!tech,
    specialtyId: pirate ? 'pirate' : '',
    specialtyName: pirate ? 'Shop pirate' : '',
    refreshSeed: stationSeed,
    refreshIndex: 0,
    refreshAtMs: 0,
    nextRefreshAtMs: 0,
    refreshMs: 0,
    refreshLeftMs: 0,
    tierGate,
    localResourcePool,
    offers
  };
}
