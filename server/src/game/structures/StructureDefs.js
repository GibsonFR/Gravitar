export const STRUCTURE_TYPES = {
  BASE_CORE: 'base_core',
  WALL: 'wall',
  STORAGE: 'storage'
};

export const STRUCTURE_DEFS = {
  [STRUCTURE_TYPES.BASE_CORE]: {
    id: STRUCTURE_TYPES.BASE_CORE,
    name: 'Noyau de base',
    description: 'Définit une zone de construction personnelle.',
    radius: 54,
    w: 108,
    h: 108,
    maxHp: 1400,
    solid: true,
    claimRadius: 950,
    maxPerOwner: 1,
    color: '#57b8ff',
    borderColor: '#a8e7ff',
    cost: { scrap: 40, ironOre: 20, copper: 10 }
  },
  [STRUCTURE_TYPES.WALL]: {
    id: STRUCTURE_TYPES.WALL,
    name: 'Mur métallique',
    description: 'Bloque les déplacements et protège une base.',
    radius: 92,
    w: 190,
    h: 48,
    maxHp: 680,
    solid: true,
    color: '#263748',
    borderColor: '#73d4ff',
    cost: { scrap: 8, ironOre: 10 }
  },
  [STRUCTURE_TYPES.STORAGE]: {
    id: STRUCTURE_TYPES.STORAGE,
    name: 'Coffre spatial',
    description: 'Stockage local de base. Inventaire réel à venir.',
    radius: 42,
    w: 84,
    h: 84,
    maxHp: 420,
    solid: true,
    storageSlots: 12,
    color: '#30544b',
    borderColor: '#70f0c5',
    cost: { scrap: 18, ironOre: 8, copper: 4 }
  }
};

export function getStructureDef(type) {
  return STRUCTURE_DEFS[String(type || '').toLowerCase()] || null;
}

export function getStructureBuildCost(type) {
  return { ...(getStructureDef(type)?.cost || {}) };
}
