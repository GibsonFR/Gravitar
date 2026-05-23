import { hash2D_Mix } from './HashUtil.js';

export const SECTOR_BIOMES = {
  hub: {
    id: 'hub',
    name: 'Hub spatial',
    shortName: 'Hub',
    description: 'Zone de départ protégée, ressources communes et faible danger.',
    colorHex: '#78c8ff',
    resources: ['scrap', 'ironOre', 'copper', 'ice', 'silicon']
  },
  metallic: {
    id: 'metallic',
    name: 'Ceinture métallique',
    shortName: 'Métal',
    description: 'Astéroïdes ferreux riches en métaux structurels.',
    colorHex: '#a8b2bd',
    resources: ['ironOre', 'copper', 'nickelOre', 'aluminiumOre', 'titaniumOre', 'cobaltOre']
  },
  silicate: {
    id: 'silicate',
    name: 'Champ silicaté',
    shortName: 'Silicate',
    description: 'Roches riches en silicium, quartz et minéraux utiles à l’électronique.',
    colorHex: '#d8c9a3',
    resources: ['silicon', 'quartz', 'graphite', 'boronOre', 'berylliumOre', 'rareEarthOre']
  },
  organic: {
    id: 'organic',
    name: 'Zone xénobiologique',
    shortName: 'Organique',
    description: 'Biomasse et colonies vivantes, dangereuses mais utiles au carburant biologique.',
    colorHex: '#77d18b',
    resources: ['biomass', 'chitin', 'organicLipids', 'enzymes', 'proteinFibers', 'spores']
  },
  volatile: {
    id: 'volatile',
    name: 'Nuage volatil',
    shortName: 'Volatile',
    description: 'Gaz, glaces et hydrocarbures pour carburant, propergol et chimie industrielle.',
    colorHex: '#6fc6ff',
    resources: ['waterIce', 'hydrogenIce', 'methaneIce', 'ammoniaIce', 'hydrocarbons', 'sulfur']
  },
  nuclear: {
    id: 'nuclear',
    name: 'Champ radioactif',
    shortName: 'Radioactif',
    description: 'Minerais lourds et isotopes dangereux destinés aux réacteurs avancés.',
    colorHex: '#b6ff5c',
    resources: ['uraniumOre', 'thoriumOre', 'unstableIsotopes', 'berylliumOre', 'leadOre']
  },
  anomaly: {
    id: 'anomaly',
    name: 'Anomalie ancienne',
    shortName: 'Anomalie',
    description: 'Zone endgame contenant surtout des débris technologiques et matériaux inconnus.',
    colorHex: '#c08cff',
    resources: ['unknownTechFragment', 'ancientSuperconductor', 'precursorNanomaterial', 'containedAntimatter', 'strangeMatter']
  }
};

const BIOME_RING_TABLE = [
  ['metallic', 'silicate', 'volatile'],
  ['metallic', 'silicate', 'organic', 'volatile'],
  ['metallic', 'silicate', 'organic', 'volatile', 'nuclear'],
  ['silicate', 'organic', 'volatile', 'nuclear', 'anomaly'],
  ['organic', 'volatile', 'nuclear', 'anomaly']
];

export function getSectorBiome(seed, sx, sy, mapLevel = 1) {
  sx |= 0;
  sy |= 0;
  mapLevel = Math.max(1, mapLevel | 0);
  if (sx === 0 && sy === 0) return SECTOR_BIOMES.hub;

  const ring = Math.min(BIOME_RING_TABLE.length - 1, Math.floor(Math.max(0, mapLevel - 1) / 12));
  const candidates = BIOME_RING_TABLE[ring] || BIOME_RING_TABLE[0];
  const h = hash2D_Mix((seed | 0) ^ 0x4b104d, Math.floor(sx / 2), Math.floor(sy / 2));
  const idx = Math.abs(h) % candidates.length;
  return SECTOR_BIOMES[candidates[idx]] || SECTOR_BIOMES.metallic;
}

export function getBiomeResourceKeys(seed, sx, sy, mapLevel = 1) {
  return (getSectorBiome(seed, sx, sy, mapLevel)?.resources || SECTOR_BIOMES.metallic.resources).slice();
}
