export const ITEM_CATEGORY_IDS = Object.freeze({
  WEAPON: 'weapon',
  LAUNCHER: 'launcher',
  AMMO: 'ammo',
  DEFENSE: 'defense',
  ENGINE: 'engine',
  MODULE: 'module',
  CONVERTER: 'converter'
});

export const ITEM_CATEGORY_ORDER = Object.freeze([
  ITEM_CATEGORY_IDS.WEAPON,
  ITEM_CATEGORY_IDS.LAUNCHER,
  ITEM_CATEGORY_IDS.AMMO,
  ITEM_CATEGORY_IDS.DEFENSE,
  ITEM_CATEGORY_IDS.ENGINE,
  ITEM_CATEGORY_IDS.MODULE,
  ITEM_CATEGORY_IDS.CONVERTER
]);

export const EQUIPMENT_CATEGORY_ORDER = Object.freeze([
  ITEM_CATEGORY_IDS.WEAPON,
  ITEM_CATEGORY_IDS.LAUNCHER,
  ITEM_CATEGORY_IDS.AMMO,
  ITEM_CATEGORY_IDS.DEFENSE,
  ITEM_CATEGORY_IDS.ENGINE,
  ITEM_CATEGORY_IDS.MODULE,
  ITEM_CATEGORY_IDS.CONVERTER
]);

export function getItemCategoryName(categoryId) {
  switch (categoryId) {
    case ITEM_CATEGORY_IDS.WEAPON: return 'Armes';
    case ITEM_CATEGORY_IDS.LAUNCHER: return 'Lance-roquettes';
    case ITEM_CATEGORY_IDS.AMMO: return 'Roquettes';
    case ITEM_CATEGORY_IDS.DEFENSE: return 'Boucliers';
    case ITEM_CATEGORY_IDS.ENGINE: return 'Propulseurs';
    case ITEM_CATEGORY_IDS.MODULE: return 'Modules';
    case ITEM_CATEGORY_IDS.CONVERTER: return 'Convertisseurs';
    default: return 'Item';
  }
}
