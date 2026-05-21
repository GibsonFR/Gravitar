import { hash2D_Mix } from './HashUtil.js';
import { RESOURCE_DEFS } from '../content/resources/ResourceDefs.js';

const BANDS = [
  { min: 1, max: 3, tiers: [1], weights: [1.0] },
  { min: 4, max: 6, tiers: [1, 2], weights: [0.82, 0.18] },
  { min: 7, max: 9, tiers: [1, 2, 3], weights: [0.20, 0.62, 0.18] },
  { min: 10, max: 12, tiers: [2, 3, 4], weights: [0.42, 0.42, 0.16] },
  { min: 13, max: 16, tiers: [2, 3, 4, 5], weights: [0.15, 0.34, 0.33, 0.18] },
  { min: 17, max: 20, tiers: [3, 4, 5, 6], weights: [0.15, 0.34, 0.31, 0.20] },
  { min: 21, max: 25, tiers: [4, 5, 6, 7], weights: [0.16, 0.30, 0.32, 0.22] },
  { min: 26, max: 30, tiers: [4, 5, 6, 7, 8], weights: [0.08, 0.19, 0.27, 0.27, 0.19] },
  { min: 31, max: 36, tiers: [5, 6, 7, 8], weights: [0.16, 0.28, 0.31, 0.25] },
  { min: 37, max: 45, tiers: [6, 7, 8, 9], weights: [0.14, 0.26, 0.33, 0.27] },
  { min: 46, max: 55, tiers: [7, 8, 9, 10], weights: [0.14, 0.25, 0.31, 0.30] },
  { min: 56, max: 70, tiers: [8, 9, 10, 11], weights: [0.12, 0.24, 0.33, 0.31] },
  { min: 71, max: 85, tiers: [9, 10, 11, 12], weights: [0.12, 0.24, 0.34, 0.30] },
  { min: 86, max: 100, tiers: [10, 11, 12, 13], weights: [0.13, 0.25, 0.33, 0.29] },
  { min: 101, max: 130, tiers: [11, 12, 13, 14, 15], weights: [0.12, 0.24, 0.27, 0.23, 0.14] },
  { min: 131, max: 2147483647, tiers: [12, 13, 14, 15, 16], weights: [0.14, 0.26, 0.25, 0.20, 0.15] }
];

function pickBand(mapLevel) {
  mapLevel = Math.max(1, mapLevel | 0);
  for (const b of BANDS) {
    if (mapLevel >= b.min && mapLevel <= b.max) return b;
  }
  return BANDS[BANDS.length - 1];
}

export function rollResourceKeyForSector(rng, mapLevel, sx, sy) {
  const band = pickBand(mapLevel);
  const specs = Object.entries(RESOURCE_DEFS)
    .filter(([, s]) => band.tiers.includes(s.spawnTier | 0))
    .map(([key, s]) => ({ key, s }));

  if (specs.length === 0) return 'scrap';

  const h = hash2D_Mix(0x71A5, sx, sy);
  const favoredIndex = Math.abs(h) % specs.length;
  const favoredIndex2 = Math.abs(((h / 17) | 0) + (sx | 0) * 3 - (sy | 0) * 5) % specs.length;
  const shapeBias = Math.abs((h / 31) | 0) % 6;

  const weights = specs.map((spec, i) => {
    const s = spec.s;
    const ti = band.tiers.indexOf(s.spawnTier | 0);
    let w = (ti >= 0 && ti < band.weights.length) ? band.weights[ti] : 0.1;
    w *= Math.max(0.05, s.baseWeight ?? 1.0);
    const rarity = Math.max(1, s.rarity ?? 1);
    w /= Math.pow(rarity, 0.92);
    if (i === favoredIndex) w *= 1.65;
    if (i === favoredIndex2) w *= 1.35;

     // Sector flavor by quadrant/coords.
    const shape = s.shapeClass || 'Rock';
    if ((((sx | 0) ^ (sy | 0)) & 1) === 0 && shape === 'Crystal') w *= 1.12;
    if ((((sx | 0) + (sy | 0)) & 2) !== 0 && shape === 'Ice') w *= 1.12;
    if ((((sx | 0) - (sy | 0)) & 4) !== 0 && shape === 'Biomass') w *= 1.14;

    if ((shapeBias === 0 && shape === 'Junk') ||
        (shapeBias === 1 && shape === 'Rock') ||
        (shapeBias === 2 && shape === 'Ice') ||
        (shapeBias === 3 && shape === 'Crystal') ||
        (shapeBias === 4 && shape === 'Dust') ||
        (shapeBias === 5 && shape === 'Exotic')) {
      w *= 1.18;
    }

    // Very late maps: gentle drift toward upper half without excluding the rest.
    if ((mapLevel | 0) >= 100) {
      const minT = Math.min(...band.tiers);
      const maxT = Math.max(...band.tiers);
      const tierNorm = ((s.spawnTier | 0) - minT) / Math.max(1, (maxT - minT));
      w *= 0.92 + 0.28 * tierNorm;
    }

    return Math.max(0.0001, w);
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let pick = rng.nextDouble() * total;
  for (let i = 0; i < specs.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return specs[i].key;
  }
  return specs[specs.length - 1].key;
}
