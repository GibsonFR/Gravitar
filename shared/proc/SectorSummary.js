import { hash2D_Mix, hash2D_XorShift } from './HashUtil.js';
import { DotNetRandom } from './DotNetRandom.js';
import { sectorFrontierLevel } from './SectorMath.js';
import { rollResourceKeyForSector } from './AsteroidSpawnDirector.js';
import { getSectorBiome } from './SectorBiomes.js';
import { getResourceDef } from '../content/resources/ResourceDefs.js';

export function getSectorSummary(seed, sx, sy) {
  seed = seed | 0;
  sx = sx | 0;
  sy = sy | 0;

  const h = hash2D_Mix(seed, sx, sy);
  const rng = new DotNetRandom(h);

  const hub = sx === 0 && sy === 0;
  const mapLevel = sectorFrontierLevel(sx, sy);
  const biome = getSectorBiome(seed, sx, sy, mapLevel);

  const asteroidCount = 16 + rng.nextMax(12) + Math.min(15, Math.floor(mapLevel / 3));

  let stationCount = 0;
  if (hub) stationCount = 1;
  else if ((h & 7) === 0) stationCount = 1;

  let hasReturnPortal = false;
  if (!hub) {
    const ph = hash2D_XorShift(seed ^ 0x2f6e2b1, sx, sy);
    hasReturnPortal = Math.abs(ph % 20) === 0;
  }

  const rrng = new DotNetRandom(h ^ 0x51c7a2f);
  const resourceKeys = [];
  const seenResources = new Set();
  const resourceRolls = 4;
  for (let i = 0; i < resourceRolls; i += 1) {
    const key = rollResourceKeyForSector(rrng, mapLevel, sx, sy, seed);
    if (!key || seenResources.has(key)) continue;
    seenResources.add(key);
    resourceKeys.push(key);
  }
  const biomeKeys = (biome?.resources || []).slice(0, 5);
  for (const key of biomeKeys) {
    if (resourceKeys.length >= 6) break;
    if (!key || seenResources.has(key)) continue;
    seenResources.add(key);
    resourceKeys.push(key);
  }
  if (resourceKeys.length <= 0) resourceKeys.push('scrap');
  const primaryResource = resourceKeys[0];
  const resourceNames = resourceKeys.map((key) => getResourceDef(key)?.name || key);

  return {
    sx,
    sy,
    level: mapLevel,
    biomeId: biome?.id || 'metallic',
    biomeName: biome?.name || 'Ceinture métallique',
    biomeShortName: biome?.shortName || 'Métal',
    biomeDescription: biome?.description || '',
    biomeColorHex: biome?.colorHex || '#a8b2bd',
    asteroidCount,
    stationCount,
    hasReturnPortal,
    primaryResource,
    resourceKeys,
    resourceNames
  };
}
