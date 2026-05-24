import { ITEM_CATEGORY_IDS } from '../items/ItemCategoryIds.js';

export const EQUIPMENT_FABRICATOR_RECIPES = Object.freeze([
  {
    id: 'fab_thruster_mk1',
    baseItemId: 'vector-thruster-vanes',
    name: 'Propulseur Mark I',
    categoryId: ITEM_CATEGORY_IDS.ENGINE,
    mark: 1,
    seconds: 18,
    researchId: 'advanced_research',
    input: { electricMotor: 1, aluminiumIngot: 4, copperWire: 6, energySciencePack: 1 }
  },
  {
    id: 'fab_shield_mk1',
    baseItemId: 'compact-shield-array',
    name: 'Bouclier Mark I',
    categoryId: ITEM_CATEGORY_IDS.DEFENSE,
    mark: 1,
    seconds: 20,
    researchId: 'defense_turrets',
    input: { compositeArmor: 1, controlCircuit: 1, copperWire: 6, combatSciencePack: 1 }
  },
  {
    id: 'fab_weapon_mk1',
    baseItemId: 'needle-array-mk1',
    name: 'Arme cinétique Mark I',
    categoryId: ITEM_CATEGORY_IDS.WEAPON,
    mark: 1,
    seconds: 22,
    researchId: 'advanced_research',
    input: { microprocessor: 1, laserLens: 1, steelPlate: 3, advancedSciencePack: 1 }
  },
  {
    id: 'fab_module_mk1',
    baseItemId: 'cargo-overmesh',
    name: 'Module utilitaire Mark I',
    categoryId: ITEM_CATEGORY_IDS.MODULE,
    mark: 1,
    seconds: 16,
    researchId: 'advanced_research',
    input: { carbonFiber: 2, steelPlate: 2, printedCircuit: 1, industrialSciencePack: 1 }
  },
  {
    id: 'fab_thruster_mk2',
    baseItemId: 'vector-thruster-vanes',
    name: 'Propulseur Mark II',
    categoryId: ITEM_CATEGORY_IDS.ENGINE,
    mark: 2,
    seconds: 28,
    researchId: 'alien_anomaly_analysis',
    input: { electricMotor: 2, fuelInjector: 1, titaniumPlate: 4, advancedSciencePack: 2 }
  }
]);

export const EQUIPMENT_RD_PROGRAMS = Object.freeze([
  {
    id: 'rd_basic',
    name: 'Infusion contrôlée',
    seconds: 60,
    qualityBoost: 0,
    scienceInput: { advancedSciencePack: 1 },
    maxSciencePacks: 1,
    requiresResearchId: 'advanced_research',
    description: 'Ajoute des bonus procéduraux légers et un tag passif.'
  },
  {
    id: 'rd_dual',
    name: 'Synthèse croisée',
    seconds: 60,
    qualityBoost: 6,
    scienceInput: { advancedSciencePack: 1, combatSciencePack: 1 },
    maxSciencePacks: 2,
    requiresResearchId: 'advanced_research',
    description: 'Deux sciences, meilleurs rolls et affixes plus stables.'
  },
  {
    id: 'rd_anomaly',
    name: 'Imprégnation anomalie',
    seconds: 60,
    qualityBoost: 16,
    scienceInput: { advancedSciencePack: 1, combatSciencePack: 1, anomalySciencePack: 1 },
    maxSciencePacks: 3,
    requiresResearchId: 'alien_anomaly_analysis',
    description: 'Trois sciences, chances fortes de rareté et tags puissants.'
  }
]);

export function getEquipmentFabricatorRecipe(id) {
  return EQUIPMENT_FABRICATOR_RECIPES.find((recipe) => recipe.id === id) || null;
}

export function getEquipmentRDProgram(id) {
  return EQUIPMENT_RD_PROGRAMS.find((program) => program.id === id) || EQUIPMENT_RD_PROGRAMS[0];
}
