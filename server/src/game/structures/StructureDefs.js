export const BASE_TILE_SIZE = 64;

export const STRUCTURE_TYPES = {
  BASE_CORE: 'base_core',
  WALL: 'wall',
  STORAGE: 'storage'
};

export const STRUCTURE_DEFS = {
  [STRUCTURE_TYPES.BASE_CORE]: {
    id: STRUCTURE_TYPES.BASE_CORE,
    name: 'Noyau de base',
    description: 'Définit une zone de construction personnelle tier 1.',
    radius: 64,
    tilesX: 2,
    tilesY: 2,
    w: BASE_TILE_SIZE * 2,
    h: BASE_TILE_SIZE * 2,
    maxHp: 1200,
    solid: false,
    claimRadius: BASE_TILE_SIZE * 8,
    maxPerOwner: 1,
    buildRange: 1100,
    gridSize: BASE_TILE_SIZE,
    color: '#244e68',
    borderColor: '#8de7ff',
    cost: { ironOre: 35, copper: 12, aluminiumOre: 8 }
  },
  [STRUCTURE_TYPES.WALL]: {
    id: STRUCTURE_TYPES.WALL,
    name: 'Mur métallique',
    description: 'Mur solide 3 × 1.',
    radius: 96,
    tilesX: 3,
    tilesY: 1,
    w: BASE_TILE_SIZE * 3,
    h: BASE_TILE_SIZE,
    maxHp: 760,
    buildRange: 1100,
    gridSize: BASE_TILE_SIZE,
    solid: true,
    color: '#263748',
    borderColor: '#73d4ff',
    cost: { ironOre: 12, copper: 2 }
  },
  [STRUCTURE_TYPES.STORAGE]: {
    id: STRUCTURE_TYPES.STORAGE,
    name: 'Coffre spatial',
    description: 'Stockage local 2 × 2. Non bloquant, non destructible directement.',
    radius: 64,
    tilesX: 2,
    tilesY: 2,
    w: BASE_TILE_SIZE * 2,
    h: BASE_TILE_SIZE * 2,
    maxHp: 0,
    damageable: false,
    buildRange: 1100,
    gridSize: BASE_TILE_SIZE,
    solid: false,
    storageSlots: 12,
    storageCapacity: 420,
    color: '#30544b',
    borderColor: '#70f0c5',
    cost: { ironOre: 14, copper: 8, aluminiumOre: 4 }
  }
};

export function getStructureDef(type) {
  return STRUCTURE_DEFS[String(type || '').toLowerCase()] || null;
}

export function getStructureBuildCost(type) {
  return { ...(getStructureDef(type)?.cost || {}) };
}
