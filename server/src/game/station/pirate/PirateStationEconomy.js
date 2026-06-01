import { RESOURCE_DEFS, RESOURCE_KEYS_ORDER, getResourceRarityScore } from '../../inventory/ResourceDefs.js';
import { compareResourceEconomicValue, getPirateResourceBuyUnitPrice, getPirateResourceSellUnitPrice, getResourceEconomyProfile } from '../../economy/PirateResourceEconomy.js';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function hashString(str) {
  let h = 2166136261 | 0;
  for (let i = 0; i < String(str || '').length; i += 1) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

function uniqueValid(keys) {
  const out = [];
  const seen = new Set();
  for (const key of keys || []) {
    const k = String(key || '');
    if (!k || seen.has(k) || !RESOURCE_DEFS[k]) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

export function computePirateTier(sx = 0, sy = 0) {
  const frontier = Math.max(Math.abs(sx | 0), Math.abs(sy | 0));
  if (frontier >= 39) return 5;
  if (frontier >= 26) return 4;
  if (frontier >= 16) return 3;
  if (frontier >= 9) return 2;
  return 1;
}

export function getPirateDemandUnitPrice(resourceKey, pirateTier = 1, stationSeed = 0) {
  return getPirateResourceSellUnitPrice(resourceKey, pirateTier, stationSeed);
}

export function getPirateSupplyUnitPrice(resourceKey, pirateTier = 1, stationSeed = 0) {
  return getPirateResourceBuyUnitPrice(resourceKey, pirateTier, stationSeed);
}

export function createPirateDemand(localResourcePool, stationSeed = 0, pirateTier = 1) {
  const localKeys = uniqueValid([
    ...(localResourcePool?.currentSectorKeys || []),
    ...(localResourcePool?.resourceKeys || [])
  ]);
  const fallback = uniqueValid(['scrap', 'ironOre', 'copper', 'aluminiumOre', 'graphite', 'quartz', 'hydrocarbons', 'propellant', 'titaniumOre', 'unknownTechFragment']);
  const pool = uniqueValid([...localKeys, ...fallback]);
  const count = clamp(3 + Math.floor((pirateTier | 0) / 2), 3, 6);
  const scored = pool.map((resourceKey) => {
    const rarity = getResourceRarityScore(resourceKey) || 1;
    const profile = getResourceEconomyProfile(resourceKey);
    const h = Math.abs((hashString(resourceKey) ^ stationSeed ^ ((pirateTier | 0) * 977)) | 0);
    const categoryBias = profile?.category === 'industrial' ? 180 : profile?.category === 'science' ? 220 : profile?.category === 'anomaly' ? 260 : 0;
    return { resourceKey, score: (h % 1000) + rarity * 65 + categoryBias };
  }).sort((a, b) => b.score - a.score || compareResourceEconomicValue(a.resourceKey, b.resourceKey));

  return scored.slice(0, count).map(({ resourceKey }, index) => {
    const profile = getResourceEconomyProfile(resourceKey);
    const stockScale = profile?.category === 'raw_common' ? 52 : profile?.category === 'raw_rare' ? 34 : 18;
    return {
      resourceKey,
      priceCredits: getPirateDemandUnitPrice(resourceKey, pirateTier, stationSeed),
      maxAmount: stockScale + (pirateTier | 0) * 12 + index * 6,
      reputationXpPerUnit: 0.015 + Math.max(0, (pirateTier | 0) - 1) * 0.004
    };
  });
}

export function createPirateResourceSupply(localResourcePool, stationSeed = 0, pirateTier = 1) {
  const tier = Math.max(1, pirateTier | 0);
  const rareByTier = RESOURCE_KEYS_ORDER.filter((key) => {
    const def = RESOURCE_DEFS[key];
    if (!def) return false;
    const profile = getResourceEconomyProfile(key);
    const spawnTier = Math.max(1, profile?.spawnTier || def.spawnTier || def.rarity || 1);
    const rarity = Math.max(1, profile?.rarity || getResourceRarityScore(key) || def.rarity || 1);
    return spawnTier <= tier * 3 + 3 && (rarity >= Math.max(2, tier) || ['industrial', 'science', 'anomaly'].includes(profile?.category));
  });
  const local = uniqueValid(localResourcePool?.resourceKeys || []).filter((key) => {
    const profile = getResourceEconomyProfile(key);
    return (profile?.rarity || getResourceRarityScore(key) || 1) >= 2 || ['industrial', 'science', 'anomaly'].includes(profile?.category);
  });
  const fallback = uniqueValid(['nickelOre', 'titaniumOre', 'lithiumOre', 'rareEarthOre', 'propellant', 'controlCircuit', 'advancedSciencePack', 'unknownTechFragment', 'precursorNanomaterial']);
  const pool = uniqueValid([...local, ...rareByTier, ...fallback]);
  const count = clamp(2 + Math.floor(tier / 2), 2, 5);
  const scored = pool.map((resourceKey) => {
    const profile = getResourceEconomyProfile(resourceKey);
    const rarity = profile?.rarity || getResourceRarityScore(resourceKey) || 1;
    const h = Math.abs((hashString(resourceKey) ^ stationSeed ^ 0x6d2b79f5) | 0);
    const categoryBias = profile?.category === 'industrial' ? 160 : profile?.category === 'science' ? 210 : profile?.category === 'anomaly' ? 260 : 0;
    return { resourceKey, score: (h % 1000) + rarity * 85 + categoryBias };
  }).sort((a, b) => b.score - a.score || compareResourceEconomicValue(a.resourceKey, b.resourceKey));

  return scored.slice(0, count).map(({ resourceKey }, index) => {
    const profile = getResourceEconomyProfile(resourceKey);
    const lotSize = profile?.category === 'raw_rare' ? 12 : profile?.category === 'refined_simple' ? 8 : profile?.category === 'industrial' ? 5 : profile?.category === 'science' ? 3 : profile?.category === 'anomaly' ? 2 : 16;
    const amount = Math.max(1, lotSize + Math.floor(tier * 1.5) + Math.floor(index * 0.5));
    return {
      resourceKey,
      priceCredits: getPirateSupplyUnitPrice(resourceKey, tier, stationSeed),
      amount,
      stock: amount
    };
  });
}

export function getStationDemandForResource(station, resourceKey) {
  const key = String(resourceKey || '');
  const demand = station?.stock?.demand || station?.stock?.resourceDemand || [];
  return demand.find((entry) => String(entry?.resourceKey || '') === key) || null;
}

export function getStationSupplyForResource(station, resourceKey) {
  const key = String(resourceKey || '');
  const supply = station?.stock?.resourceSupply || [];
  return supply.find((entry) => String(entry?.resourceKey || '') === key) || null;
}
