import { DotNetRandom } from '../../util/DotNetRandom.js';
import { hash2D_Mix } from '../../util/HashUtil.js';
import { rollResourceKeyForSector } from '../../asteroid/AsteroidSpawnDirector.js';
import { sectorFrontierLevel } from '../../sector/SectorMath.js';
import { getResourceDef } from '../../inventory/ResourceDefs.js';

const CURRENT_SECTOR_SAMPLE_COUNT = 28;
const NEIGHBOR_SECTOR_SAMPLE_COUNT = 12;
const HUB_NEIGHBORHOOD_RADIUS = 1;
const DEFAULT_NEIGHBORHOOD_RADIUS = 1;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function getNeighborhoodRadius(sx = 0, sy = 0) {
  if ((sx | 0) === 0 && (sy | 0) === 0) return HUB_NEIGHBORHOOD_RADIUS;
  return DEFAULT_NEIGHBORHOOD_RADIUS;
}

function getSampleCount(dx = 0, dy = 0) {
  return dx === 0 && dy === 0 ? CURRENT_SECTOR_SAMPLE_COUNT : NEIGHBOR_SECTOR_SAMPLE_COUNT;
}

export function buildStationLocalResourcePool(worldSeed = 0, sx = 0, sy = 0) {
  const radius = getNeighborhoodRadius(sx, sy);
  const counts = new Map();
  const currentSectorKeys = new Set();
  let maxObservedSpawnTier = 1;
  let minObservedSpawnTier = 99;

  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      const nsx = (sx | 0) + dx;
      const nsy = (sy | 0) + dy;
      const mapLevel = sectorFrontierLevel(nsx, nsy);
      const sampleCount = getSampleCount(dx, dy);
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      const distanceWeight = distance === 0 ? 2.2 : 1 / (1 + distance * 0.65);
      const rng = new DotNetRandom(hash2D_Mix((worldSeed | 0) ^ 0x61a5e7, nsx, nsy));

      for (let i = 0; i < sampleCount; i += 1) {
        const key = String(rollResourceKeyForSector(rng, mapLevel, nsx, nsy, worldSeed | 0) || 'scrap');
        const def = getResourceDef(key);
        if (!def) continue;
        const prev = counts.get(key) || { count: 0, currentCount: 0, nearestDistance: 99, spawnTier: Math.max(1, def.spawnTier | 0) };
        prev.count += distanceWeight;
        if (distance === 0) prev.currentCount += 1;
        prev.nearestDistance = Math.min(prev.nearestDistance, distance);
        prev.spawnTier = Math.max(1, def.spawnTier | 0);
        counts.set(key, prev);
        if (distance === 0) currentSectorKeys.add(key);
        maxObservedSpawnTier = Math.max(maxObservedSpawnTier, prev.spawnTier);
        minObservedSpawnTier = Math.min(minObservedSpawnTier, prev.spawnTier);
      }
    }
  }

  if (!counts.size) {
    const fallback = getResourceDef('scrap');
    return {
      radius,
      maxSpawnTier: 1,
      minSpawnTier: 1,
      resourceKeys: ['scrap'],
      currentSectorKeys: ['scrap'],
      entries: fallback ? [{ resourceKey: 'scrap', weight: 1, currentWeight: 1, nearestDistance: 0, spawnTier: 1, name: fallback.name }] : []
    };
  }

  const entries = [...counts.entries()]
    .map(([resourceKey, data]) => {
      const def = getResourceDef(resourceKey);
      return {
        resourceKey,
        weight: Number(data.count || 0),
        currentWeight: Number(data.currentCount || 0),
        nearestDistance: Math.max(0, data.nearestDistance | 0),
        spawnTier: Math.max(1, data.spawnTier | 0),
        name: def?.name || resourceKey
      };
    })
    .sort((a, b) => {
      if (b.currentWeight !== a.currentWeight) return b.currentWeight - a.currentWeight;
      if (a.nearestDistance !== b.nearestDistance) return a.nearestDistance - b.nearestDistance;
      if (b.weight !== a.weight) return b.weight - a.weight;
      if (a.spawnTier !== b.spawnTier) return a.spawnTier - b.spawnTier;
      return String(a.resourceKey).localeCompare(String(b.resourceKey));
    });

  const resourceKeys = entries.map((entry) => entry.resourceKey);
  const currentKeysOrdered = entries.filter((entry) => currentSectorKeys.has(entry.resourceKey)).map((entry) => entry.resourceKey);

  return {
    radius,
    maxSpawnTier: clamp(maxObservedSpawnTier, 1, 16),
    minSpawnTier: clamp(minObservedSpawnTier === 99 ? 1 : minObservedSpawnTier, 1, 16),
    resourceKeys,
    currentSectorKeys: currentKeysOrdered.length > 0 ? currentKeysOrdered : resourceKeys.slice(0, 3),
    entries
  };
}

export function getStationTierGateFromLocalPool(tech = false, localPool = null) {
  const maxSpawnTier = Math.max(1, localPool?.maxSpawnTier | 0);
  const baseGate = Math.max(1, Math.ceil(maxSpawnTier / 2));
  const techBonus = tech && maxSpawnTier >= 2 ? 1 : 0;
  return clamp(baseGate + techBonus, 1, 10);
}
