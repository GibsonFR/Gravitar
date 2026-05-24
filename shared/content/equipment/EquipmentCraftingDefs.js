import { ITEM_CATEGORY_IDS } from '../items/ItemCategoryIds.js';

export const EQUIPMENT_CRAFT_MODES = Object.freeze([
  {
    id: 'standard',
    name: 'Standard',
    description: 'Fabrication normale. Peu coûteuse, forte chance de qualité standard.',
    qualityBoost: 0,
    extraInput: {},
    requiresResearchId: ''
  },
  {
    id: 'calibrated',
    name: 'Calibré',
    description: 'Ajoute de la science avancée pour stabiliser la fabrication.',
    qualityBoost: 5,
    extraInput: { advancedSciencePack: 1 },
    requiresResearchId: 'advanced_research'
  },
  {
    id: 'experimental',
    name: 'Expérimental',
    description: 'Ajoute de la science anomalie. Plus cher, mais meilleures chances de rareté.',
    qualityBoost: 13,
    extraInput: { anomalySciencePack: 1 },
    requiresResearchId: 'alien_anomaly_analysis'
  }
]);

export function getEquipmentCraftMode(id) {
  return EQUIPMENT_CRAFT_MODES.find((mode) => mode.id === id) || EQUIPMENT_CRAFT_MODES[0];
}

export function mergeRecipeInputs(base = {}, extra = {}) {
  const out = { ...(base || {}) };
  for (const [key, amount] of Object.entries(extra || {})) out[key] = (out[key] | 0) + (amount | 0);
  return out;
}

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
