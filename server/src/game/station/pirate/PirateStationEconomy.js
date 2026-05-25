import { RESOURCE_DEFS, RESOURCE_KEYS_ORDER, getResourceRarityScore } from '../../inventory/ResourceDefs.js';

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
  const def = RESOURCE_DEFS[resourceKey];
  if (!def) return 0;
  const rarity = Math.max(1, getResourceRarityScore(resourceKey) || def.rarity || 1);
  const base = 2 + rarity * 3 + Math.max(0, (pirateTier | 0) - 1) * 2;
  const variance = Math.abs((hashString(resourceKey) ^ (stationSeed | 0)) % 5) - 2;
  return Math.max(1, Math.round(base + variance));
}

export function getPirateSupplyUnitPrice(resourceKey, pirateTier = 1, stationSeed = 0) {
  const demandPrice = getPirateDemandUnitPrice(resourceKey, pirateTier, stationSeed);
  const rarity = Math.max(1, getResourceRarityScore(resourceKey) || 1);
  return Math.max(2, Math.round(demandPrice * (2.2 + rarity * 0.18)));
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
    const h = Math.abs((hashString(resourceKey) ^ stationSeed ^ ((pirateTier | 0) * 977)) | 0);
    return { resourceKey, score: (h % 1000) + rarity * 65 };
  }).sort((a, b) => b.score - a.score);

  return scored.slice(0, count).map(({ resourceKey }, index) => ({
    resourceKey,
    priceCredits: getPirateDemandUnitPrice(resourceKey, pirateTier, stationSeed),
    maxAmount: 80 + (pirateTier | 0) * 30 + index * 15,
    reputationXpPerUnit: 0.015 + Math.max(0, (pirateTier | 0) - 1) * 0.004
  }));
}

export function createPirateResourceSupply(localResourcePool, stationSeed = 0, pirateTier = 1) {
  const tier = Math.max(1, pirateTier | 0);
  const rareByTier = RESOURCE_KEYS_ORDER.filter((key) => {
    const def = RESOURCE_DEFS[key];
    if (!def) return false;
    const spawnTier = Math.max(1, def.spawnTier || def.rarity || 1);
    const rarity = Math.max(1, getResourceRarityScore(key) || def.rarity || 1);
    return spawnTier <= tier * 3 + 3 && rarity >= Math.max(2, tier);
  });
  const local = uniqueValid(localResourcePool?.resourceKeys || []).filter((key) => (getResourceRarityScore(key) || 1) >= 2);
  const fallback = uniqueValid(['nickelOre', 'titaniumOre', 'lithiumOre', 'rareEarthOre', 'propellant', 'controlCircuit', 'advancedSciencePack', 'unknownTechFragment', 'precursorNanomaterial']);
  const pool = uniqueValid([...local, ...rareByTier, ...fallback]);
  const count = clamp(2 + Math.floor(tier / 2), 2, 5);
  const scored = pool.map((resourceKey) => {
    const rarity = getResourceRarityScore(resourceKey) || 1;
    const h = Math.abs((hashString(resourceKey) ^ stationSeed ^ 0x6d2b79f5) | 0);
    return { resourceKey, score: (h % 1000) + rarity * 85 };
  }).sort((a, b) => b.score - a.score);

  return scored.slice(0, count).map(({ resourceKey }, index) => ({
    resourceKey,
    priceCredits: getPirateSupplyUnitPrice(resourceKey, tier, stationSeed),
    amount: 20 + tier * 8 + index * 4,
    stock: 20 + tier * 8 + index * 4
  }));
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
