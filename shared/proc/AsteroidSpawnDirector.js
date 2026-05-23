import { hash2D_Mix } from './HashUtil.js';
import { RESOURCE_DEFS } from '../content/resources/ResourceDefs.js';
import { getBiomeResourceKeys, getSectorBiome } from './SectorBiomes.js';

function tierGate(resourceKey, mapLevel) {
  const def = RESOURCE_DEFS[resourceKey] || null;
  if (!def) return 0.01;
  const tier = Math.max(1, def.spawnTier | 0);
  const level = Math.max(1, mapLevel | 0);
  if (tier <= 1) return 1;
  const unlockLevel = 1 + (tier - 1) * 3;
  if (level < unlockLevel - 3) return 0.04;
  if (level < unlockLevel) return 0.18;
  return 1;
}

function pickWeighted(rng, specs) {
  const total = specs.reduce((acc, s) => acc + Math.max(0.0001, s.weight || 0), 0);
  let pick = rng.nextDouble() * total;
  for (const spec of specs) {
    pick -= Math.max(0.0001, spec.weight || 0);
    if (pick <= 0) return spec.key;
  }
  return specs[specs.length - 1]?.key || 'scrap';
}

export function getSectorResourcePool(seed, sx, sy, mapLevel) {
  const biome = getSectorBiome(seed | 0, sx | 0, sy | 0, mapLevel | 0);
  const baseKeys = getBiomeResourceKeys(seed | 0, sx | 0, sy | 0, mapLevel | 0);
  const h = hash2D_Mix((seed | 0) ^ 0x71a5, sx | 0, sy | 0);
  const favoredA = Math.abs(h) % Math.max(1, baseKeys.length);
  const favoredB = Math.abs(((h / 17) | 0) + (sx | 0) * 5 - (sy | 0) * 3) % Math.max(1, baseKeys.length);

  const specs = baseKeys
    .filter((key) => RESOURCE_DEFS[key])
    .map((key, i) => {
      const def = RESOURCE_DEFS[key];
      const rarity = Math.max(1, def.rarity ?? 1);
      let weight = Math.max(0.05, def.baseWeight ?? 1);
      weight /= Math.pow(rarity, 0.72);
      weight *= tierGate(key, mapLevel);
      if (i === favoredA) weight *= 1.55;
      if (i === favoredB) weight *= 1.25;
      return { key, weight };
    });

  if (specs.length <= 0) specs.push({ key: 'scrap', weight: 1 });
  return { biome, specs };
}

export function rollResourceKeyForSector(rng, mapLevel, sx, sy, seed = 1337) {
  const { specs } = getSectorResourcePool(seed | 0, sx | 0, sy | 0, mapLevel | 0);
  return pickWeighted(rng, specs);
}
