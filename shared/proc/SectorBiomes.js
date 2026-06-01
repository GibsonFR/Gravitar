import { hash2D_Mix } from './HashUtil.js';

export const SECTOR_BIOMES = {
  hub: {
    id: 'hub',
    name: 'Hub sécurisé',
    shortName: 'Hub',
    description: 'Zone de départ protégée, ressources communes et faible danger.',
    colorHex: '#78c8ff',
    resources: ['scrap', 'ironOre', 'copper', 'ice', 'silicon']
  },
  metallic: {
    id: 'metallic',
    name: 'Ceinture métallique',
    shortName: 'Métallique',
    description: 'Secteur dense en astéroïdes ferriques et alliages bruts, riche en métaux structurels.',
    colorHex: '#a8b2bd',
    resources: ['ironOre', 'copper', 'nickelOre', 'aluminiumOre', 'titaniumOre', 'cobaltOre']
  },
  silicate: {
    id: 'silicate',
    name: 'Champ cristallin',
    shortName: 'Cristallin',
    description: 'Secteur pierreux riche en silice, quartz et matériaux utiles à l’électronique avancée.',
    colorHex: '#d8c9a3',
    resources: ['silicon', 'quartz', 'graphite', 'boronOre', 'berylliumOre', 'rareEarthOre']
  },
  organic: {
    id: 'organic',
    name: 'Nuage organique',
    shortName: 'Organique',
    description: 'Région enrichie en composés carbonés et colonies biologiques primitives, source de biomasse industrielle.',
    colorHex: '#77d18b',
    resources: ['biomass', 'chitin', 'organicLipids', 'enzymes', 'proteinFibers', 'spores']
  },
  volatile: {
    id: 'volatile',
    name: 'Banquise hydrocarburée',
    shortName: 'Glacé',
    description: 'Région froide riche en glaces, hydrocarbures et composés volatils utilisables pour carburant et chimie industrielle.',
    colorHex: '#6fc6ff',
    resources: ['waterIce', 'hydrogenIce', 'methaneIce', 'ammoniaIce', 'hydrocarbons', 'sulfur']
  },
  nuclear: {
    id: 'nuclear',
    name: 'Zone radioactive',
    shortName: 'Radioactif',
    description: 'Zone rare contenant des éléments lourds et isotopes exploitables pour réacteurs et technologies à haute énergie.',
    colorHex: '#b6ff5c',
    resources: ['uraniumOre', 'thoriumOre', 'unstableIsotopes', 'berylliumOre', 'leadOre']
  },
  anomaly: {
    id: 'anomaly',
    name: 'Anomalie ancienne',
    shortName: 'Anomalique',
    description: 'Champ de débris artificiels non identifiés, source de matériaux précurseurs et technologies impossibles à produire au début.',
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
