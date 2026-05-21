import { DotNetRandom } from '../../util/DotNetRandom.js';
import { hash2D_Mix } from '../../util/HashUtil.js';
import { RESOURCE_DEFS, RESOURCE_KEYS_ORDER, getResourceDef } from '../../inventory/ResourceDefs.js';
import { ITEM_CATEGORY_IDS } from '../../../../../shared/content/items/ItemCategoryIds.js';
import { getItemDef } from '../../../../../shared/content/items/ItemDefs.js';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}


function categoryBias(item, spec) {
  const shape = String(spec?.shapeClass || '');
  const resistBias = Number(spec?.resistBias || 0);
  switch (item?.categoryId) {
    case ITEM_CATEGORY_IDS.DEFENSE:
      if (shape === 'Crystal' || shape === 'Ice' || shape === 'Exotic') return 1.55;
      return resistBias >= 0.04 ? 1.25 : 0.9;
    case ITEM_CATEGORY_IDS.ENGINE:
      if (shape === 'Junk' || shape === 'Rock' || shape === 'Dust') return 1.45;
      return 0.92;
    case ITEM_CATEGORY_IDS.CONVERTER:
      if (shape === 'Junk' || shape === 'Dust' || shape === 'Biomass') return 1.4;
      return 0.9;
    case ITEM_CATEGORY_IDS.LAUNCHER:
    case ITEM_CATEGORY_IDS.AMMO:
      if (shape === 'Exotic' || shape === 'Crystal') return 1.28;
      return 1.02;
    case ITEM_CATEGORY_IDS.WEAPON:
      if (shape === 'Crystal' || shape === 'Rock' || shape === 'Exotic') return 1.2;
      return 1.0;
    case ITEM_CATEGORY_IDS.MODULE:
    default:
      return 1.0;
  }
}

function getCandidateResources(item, localResourcePool = null) {
  const entries = (localResourcePool?.entries || [])
    .map((entry) => ({
      key: String(entry?.resourceKey || ''),
      def: RESOURCE_DEFS[String(entry?.resourceKey || '')],
      localWeight: Math.max(0.01, Number(entry?.weight || 0.01)),
      currentWeight: Math.max(0, Number(entry?.currentWeight || 0)),
      nearestDistance: Math.max(0, entry?.nearestDistance | 0)
    }))
    .filter(({ key, def }) => key && def);
  if (entries.length > 0) return entries;
  return RESOURCE_KEYS_ORDER
    .map((key) => ({ key, def: RESOURCE_DEFS[key], localWeight: 1, currentWeight: 0, nearestDistance: 99 }))
    .filter(({ def }) => !!def && (def.spawnTier | 0) <= 1);
}

function weightedPickDistinct(rng, entries, count, item) {
  const pool = [...entries];
  const out = [];
  while (pool.length > 0 && out.length < count) {
    let total = 0;
    const weights = pool.map(({ def, localWeight, currentWeight, nearestDistance }) => {
      const rarity = Math.max(1, def?.rarity | 0);
      const baseWeight = Math.max(0.05, Number(def?.baseWeight || 1));
      const bias = categoryBias(item, def);
      const localBias = 0.8 + Math.min(1.35, Math.pow(Math.max(0.01, Number(localWeight || 0.01)), 0.42));
      const currentBias = currentWeight > 0 ? 1.18 : 1.0;
      const distanceBias = nearestDistance <= 0 ? 1.16 : nearestDistance === 1 ? 1.03 : 0.92;
      const weight = Math.max(0.01, ((baseWeight * bias * localBias * currentBias * distanceBias) / Math.pow(rarity, 0.9)));
      total += weight;
      return weight;
    });
    let roll = rng.nextDouble() * Math.max(0.01, total);
    let idx = 0;
    for (let i = 0; i < weights.length; i += 1) {
      roll -= weights[i];
      if (roll <= 0) {
        idx = i;
        break;
      }
    }
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function computeResourceAmount(item, def, offerPriceCredits, isPrimary, localResourcePool = null) {
  const sellUnit = Math.max(1, Number(def?.sellPrice || 1));
  const rarity = Math.max(1, def?.rarity | 0);
  const spawnTier = Math.max(1, def?.spawnTier | 0);
  const tier = Math.max(1, item?.tier | 0);
  const budget = Math.max(24, Number(offerPriceCredits || item?.priceCredits || 0));

  let pressure = budget / (sellUnit * (isPrimary ? 5.1 : 7.2));
  pressure *= 1 + (tier - 1) * 0.22;
  const localSpawnCap = Math.max(1, localResourcePool?.maxSpawnTier | 0);
  pressure *= 0.96 + Math.min(0.18, Math.max(0, localSpawnCap - 1) * 0.02);
  pressure *= 1 + Math.max(0, rarity - 1) * 0.18;
  pressure *= 1 + Math.max(0, spawnTier - 1) * 0.08;

  if (def?.id === 'Scrap' || def?.id === 'Copper' || def?.id === 'IronVein') {
    pressure *= isPrimary ? 1.55 : 1.15;
  }

  if (item?.categoryId === ITEM_CATEGORY_IDS.AMMO) pressure *= 0.82;
  if (item?.categoryId === ITEM_CATEGORY_IDS.CONVERTER) pressure *= 1.1;

  const amount = Math.round(clamp(pressure, 1, 56));
  return Math.max(1, amount);
}

export function generateOfferResourceCosts(seed, item, offerPriceCredits, localResourcePool = null) {
  const candidates = getCandidateResources(item, localResourcePool);
  const tier = Math.max(1, item?.tier | 0);
  const want = item?.categoryId === ITEM_CATEGORY_IDS.AMMO
    ? 1
    : tier <= 1 ? 2 : tier === 2 ? 3 : 4;
  const localPoolHash = (localResourcePool?.resourceKeys || []).slice(0, 8).join('|').length;
  const rng = new DotNetRandom(hash2D_Mix(seed | 0, localPoolHash ^ tier * 131, (item?.id || '').length + tier * 17));
  const picked = weightedPickDistinct(rng, candidates, Math.min(want, candidates.length), item);
  const costs = picked.map((entry, index) => ({
    resourceKey: entry.key,
    amount: computeResourceAmount(item, entry.def, offerPriceCredits, index === 0, localResourcePool)
  }));
  costs.sort((a, b) => {
    const ad = getResourceDef(a.resourceKey);
    const bd = getResourceDef(b.resourceKey);
    const as = ad?.spawnTier | 0;
    const bs = bd?.spawnTier | 0;
    if (as !== bs) return bs - as;
    return String(a.resourceKey).localeCompare(String(b.resourceKey));
  });
  return costs;
}

function isCreditOnlyOffer(offer) {
  const def = getItemDef(String(offer?.itemId || ''));
  return def?.categoryId === ITEM_CATEGORY_IDS.AMMO;
}

export function canAffordOffer(inv, offer) {
  if (!inv || !offer) return false;
  const credits = Math.max(0, inv.credits | 0);
  if (credits < Math.max(0, offer.priceCredits | 0)) return false;
  if (isCreditOnlyOffer(offer)) return true;
  const costs = offer.resourceCosts || [];
  return costs.every((entry) => {
    const key = String(entry?.resourceKey || '');
    const need = Math.max(0, entry?.amount | 0);
    return (inv.resources?.[key] || 0) >= need;
  });
}

export function consumeOfferCosts(inv, offer) {
  if (!canAffordOffer(inv, offer)) return false;
  inv.credits = Math.max(0, (inv.credits | 0) - Math.max(0, offer.priceCredits | 0));
  if (isCreditOnlyOffer(offer)) return true;
  for (const entry of offer.resourceCosts || []) {
    const key = String(entry?.resourceKey || '');
    const need = Math.max(0, entry?.amount | 0);
    if (!key || need <= 0) continue;
    const cur = inv.resources?.[key] || 0;
    inv.resources[key] = Math.max(0, cur - need);
    const cargoPerUnit = Math.max(1, getResourceDef(key)?.cargoPerUnit || 1);
    inv.cargoUsed = Math.max(0, (inv.cargoUsed | 0) - cargoPerUnit * need);
  }
  return true;
}
