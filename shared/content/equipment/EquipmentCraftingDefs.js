import { ITEM_CATEGORY_IDS } from '../items/ItemCategoryIds.js';

export const EQUIPMENT_FABRICATOR_RECIPES = Object.freeze([
  {
    id: 'craft_vector_thruster_vanes',
    itemId: 'vector-thruster-vanes',
    name: 'Ailettes de poussée vectorielle',
    categoryId: ITEM_CATEGORY_IDS.ENGINE,
    tier: 1,
    seconds: 18,
    researchId: 'advanced_research',
    input: { electricMotor: 1, aluminiumIngot: 4, copperWire: 6, energySciencePack: 1 }
  },
  {
    id: 'craft_compact_shield_array',
    itemId: 'compact-shield-array',
    name: 'Réseau de bouclier compact',
    categoryId: ITEM_CATEGORY_IDS.DEFENSE,
    tier: 1,
    seconds: 20,
    researchId: 'defense_turrets',
    input: { compositeArmor: 1, controlCircuit: 1, copperWire: 6, combatSciencePack: 1 }
  },
  {
    id: 'craft_needle_array_mk1',
    itemId: 'needle-array-mk1',
    name: 'Array Needle Mk.I',
    categoryId: ITEM_CATEGORY_IDS.WEAPON,
    tier: 1,
    seconds: 22,
    researchId: 'advanced_research',
    input: { microprocessor: 1, laserLens: 1, steelPlate: 3, advancedSciencePack: 1 }
  },
  {
    id: 'craft_cargo_overmesh',
    itemId: 'cargo-overmesh',
    name: 'Maillage de soute extensif',
    categoryId: ITEM_CATEGORY_IDS.MODULE,
    tier: 1,
    seconds: 16,
    researchId: 'advanced_research',
    input: { carbonFiber: 2, steelPlate: 2, printedCircuit: 1, industrialSciencePack: 1 }
  }
]);

export function getEquipmentCraftRecipe(id) {
  return EQUIPMENT_FABRICATOR_RECIPES.find((recipe) => recipe.id === id) || null;
}
