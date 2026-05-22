import { DotNetRandom } from '../../util/DotNetRandom.js';
import { hash2D_Mix } from '../../util/HashUtil.js';
import { ITEM_CATEGORY_IDS, ITEM_CATEGORY_ORDER } from '../../../../../shared/content/items/ItemCategoryIds.js';
import { ITEM_TAG_IDS } from '../../../../../shared/content/items/ItemTagIds.js';
import { listItemDefs } from '../../../../../shared/content/items/ItemDefs.js';
import { generateOfferResourceCosts } from './StationOfferCosts.js';
import { buildStationLocalResourcePool, getStationTierGateFromLocalPool } from './StationLocalResourcePool.js';

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

export function createStationStock(seed, tech = false, sx = 0, sy = 0, options = null) {
  const stationSeed = hash2D_Mix((seed | 0) ^ (tech ? 0x51f3 : 0x0f2d), sx | 0, sy | 0);
  const rng = new DotNetRandom(stationSeed);
  const worldSeed = options?.worldSeed | 0;
  const localResourcePool = buildStationLocalResourcePool(worldSeed, sx, sy);
  const tierGate = getStationTierGateFromLocalPool(tech, localResourcePool);
  const pirate = options?.specialtyId === 'pirate';
  const all = listItemDefs({ shopOnly: true })
    .filter((item) => (item?.tier | 0) <= tierGate)
    .filter((item) => !pirate || isPirateOffer(item))
    .sort(compareStockItems);

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
