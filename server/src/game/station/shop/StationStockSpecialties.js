import { hash2D_Mix } from '../../util/HashUtil.js';
import { ITEM_CATEGORY_IDS } from '../../../../../shared/content/items/ItemCategoryIds.js';

export const STATION_SPECIALTY_DEFS = Object.freeze({
  armory: Object.freeze({
    id: 'armory',
    name: 'Armurerie',
    countBias: Object.freeze({ [ITEM_CATEGORY_IDS.WEAPON]: 2, [ITEM_CATEGORY_IDS.MODULE]: 1 }),
    tierBias: Object.freeze({ [ITEM_CATEGORY_IDS.WEAPON]: 1, [ITEM_CATEGORY_IDS.MODULE]: 1 }),
    priceBias: Object.freeze({ [ITEM_CATEGORY_IDS.WEAPON]: 0.96, [ITEM_CATEGORY_IDS.MODULE]: 0.98 })
  }),
  ordnance: Object.freeze({
    id: 'ordnance',
    name: 'Ordnance',
    countBias: Object.freeze({ [ITEM_CATEGORY_IDS.LAUNCHER]: 2, [ITEM_CATEGORY_IDS.AMMO]: 2 }),
    tierBias: Object.freeze({ [ITEM_CATEGORY_IDS.LAUNCHER]: 1, [ITEM_CATEGORY_IDS.AMMO]: 1 }),
    priceBias: Object.freeze({ [ITEM_CATEGORY_IDS.LAUNCHER]: 0.96, [ITEM_CATEGORY_IDS.AMMO]: 0.94 })
  }),
  defense: Object.freeze({
    id: 'defense',
    name: 'Défense',
    countBias: Object.freeze({ [ITEM_CATEGORY_IDS.DEFENSE]: 2, [ITEM_CATEGORY_IDS.MODULE]: 1 }),
    tierBias: Object.freeze({ [ITEM_CATEGORY_IDS.DEFENSE]: 1 }),
    priceBias: Object.freeze({ [ITEM_CATEGORY_IDS.DEFENSE]: 0.95 })
  }),
  mobility: Object.freeze({
    id: 'mobility',
    name: 'Mobilité',
    countBias: Object.freeze({ [ITEM_CATEGORY_IDS.ENGINE]: 2, [ITEM_CATEGORY_IDS.MODULE]: 1 }),
    tierBias: Object.freeze({ [ITEM_CATEGORY_IDS.ENGINE]: 1 }),
    priceBias: Object.freeze({ [ITEM_CATEGORY_IDS.ENGINE]: 0.95 })
  }),
  systems: Object.freeze({
    id: 'systems',
    name: 'Systèmes',
    countBias: Object.freeze({ [ITEM_CATEGORY_IDS.MODULE]: 2, [ITEM_CATEGORY_IDS.CONVERTER]: 1 }),
    tierBias: Object.freeze({ [ITEM_CATEGORY_IDS.MODULE]: 1, [ITEM_CATEGORY_IDS.CONVERTER]: 1 }),
    priceBias: Object.freeze({ [ITEM_CATEGORY_IDS.MODULE]: 0.97, [ITEM_CATEGORY_IDS.CONVERTER]: 0.96 })
  }),
  industrial: Object.freeze({
    id: 'industrial',
    name: 'Industriel',
    countBias: Object.freeze({ [ITEM_CATEGORY_IDS.CONVERTER]: 2, [ITEM_CATEGORY_IDS.AMMO]: -1, [ITEM_CATEGORY_IDS.MODULE]: 1 }),
    tierBias: Object.freeze({ [ITEM_CATEGORY_IDS.CONVERTER]: 1 }),
    priceBias: Object.freeze({ [ITEM_CATEGORY_IDS.CONVERTER]: 0.94 })
  })
});

const NORMAL_SPECIALTY_IDS = Object.freeze(['armory', 'ordnance', 'defense', 'mobility', 'industrial']);
const TECH_SPECIALTY_IDS = Object.freeze(['armory', 'ordnance', 'defense', 'mobility', 'systems']);

export function getStationSpecialtyDef(specialtyId) {
  return STATION_SPECIALTY_DEFS[specialtyId] || STATION_SPECIALTY_DEFS.systems;
}

export function resolveStationSpecialtyId(seed = 0, tech = false, sx = 0, sy = 0) {
  const ids = tech ? TECH_SPECIALTY_IDS : NORMAL_SPECIALTY_IDS;
  const h = hash2D_Mix((seed | 0) ^ (tech ? 0x72f31 : 0x18a5d), sx | 0, sy | 0);
  const idx = Math.abs(h % ids.length);
  return ids[idx] || ids[0];
}
