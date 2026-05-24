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
    id: 'fab_thruster_mk2',
    baseItemId: 'vector-thruster-vanes',
    name: 'Propulseur Mark II',
    categoryId: ITEM_CATEGORY_IDS.ENGINE,
    mark: 2,
    seconds: 28,
    researchId: 'alien_anomaly_analysis',
    input: { electricMotor: 2, fuelInjector: 1, titaniumPlate: 4, advancedSciencePack: 2 }
  },
  {
    id: 'fab_thruster_mk3',
    baseItemId: 'vector-thruster-vanes',
    name: 'Propulseur Mark III',
    categoryId: ITEM_CATEGORY_IDS.ENGINE,
    mark: 3,
    seconds: 40,
    researchId: 'alien_anomaly_analysis',
    input: { electricMotor: 3, fuelInjector: 2, thermalCeramic: 3, precursorNanomaterial: 1, anomalySciencePack: 1 }
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
    id: 'fab_shield_mk2',
    baseItemId: 'compact-shield-array',
    name: 'Bouclier Mark II',
    categoryId: ITEM_CATEGORY_IDS.DEFENSE,
    mark: 2,
    seconds: 30,
    researchId: 'advanced_research',
    input: { compositeArmor: 2, titaniumPlate: 4, controlCircuit: 2, combatSciencePack: 2 }
  },
  {
    id: 'fab_shield_mk3',
    baseItemId: 'compact-shield-array',
    name: 'Bouclier Mark III',
    categoryId: ITEM_CATEGORY_IDS.DEFENSE,
    mark: 3,
    seconds: 42,
    researchId: 'alien_anomaly_analysis',
    input: { compositeArmor: 3, thermalCeramic: 3, precursorNanomaterial: 1, anomalySciencePack: 1 }
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
    id: 'fab_weapon_mk2',
    baseItemId: 'needle-array-mk1',
    name: 'Arme cinétique Mark II',
    categoryId: ITEM_CATEGORY_IDS.WEAPON,
    mark: 2,
    seconds: 32,
    researchId: 'advanced_research',
    input: { microprocessor: 2, laserLens: 2, titaniumPlate: 3, combatSciencePack: 2 }
  },
  {
    id: 'fab_weapon_mk3',
    baseItemId: 'needle-array-mk1',
    name: 'Arme cinétique Mark III',
    categoryId: ITEM_CATEGORY_IDS.WEAPON,
    mark: 3,
    seconds: 44,
    researchId: 'alien_anomaly_analysis',
    input: { microprocessor: 3, laserLens: 3, thermalCeramic: 2, unknownTechFragment: 1, anomalySciencePack: 1 }
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
    id: 'fab_module_mk2',
    baseItemId: 'cargo-overmesh',
    name: 'Module utilitaire Mark II',
    categoryId: ITEM_CATEGORY_IDS.MODULE,
    mark: 2,
    seconds: 26,
    researchId: 'advanced_research',
    input: { carbonFiber: 4, titaniumPlate: 2, controlCircuit: 1, industrialSciencePack: 2 }
  },
  {
    id: 'fab_module_mk3',
    baseItemId: 'cargo-overmesh',
    name: 'Module utilitaire Mark III',
    categoryId: ITEM_CATEGORY_IDS.MODULE,
    mark: 3,
    seconds: 38,
    researchId: 'alien_anomaly_analysis',
    input: { carbonFiber: 5, microprocessor: 2, precursorNanomaterial: 1, anomalySciencePack: 1 }
  }
]);

export const EQUIPMENT_RD_ALLOWED_SCIENCES = Object.freeze([
  'basicSciencePack',
  'automationSciencePack',
  'industrialSciencePack',
  'energySciencePack',
  'biologySciencePack',
  'combatSciencePack',
  'advancedSciencePack',
  'anomalySciencePack'
]);

export const EQUIPMENT_RD_SECONDS = 60;
export const EQUIPMENT_RD_MAX_SCIENCES = 3;

export function getEquipmentFabricatorRecipe(id) {
  return EQUIPMENT_FABRICATOR_RECIPES.find((recipe) => recipe.id === id) || null;
}

export function isEquipmentRDScience(key) {
  return EQUIPMENT_RD_ALLOWED_SCIENCES.includes(String(key || ''));
}

export function getEquipmentRDQualityBoost(sciences = []) {
  const list = sciences.filter(isEquipmentRDScience).slice(0, EQUIPMENT_RD_MAX_SCIENCES);
  let boost = Math.max(0, list.length - 1) * 4;
  for (const key of list) {
    if (key === 'advancedSciencePack') boost += 4;
    else if (key === 'combatSciencePack') boost += 3;
    else if (key === 'energySciencePack') boost += 2;
    else if (key === 'industrialSciencePack') boost += 2;
    else if (key === 'biologySciencePack') boost += 2;
    else if (key === 'automationSciencePack') boost += 1;
    else if (key === 'basicSciencePack') boost += 0;
    else if (key === 'anomalySciencePack') boost += 9;
  }
  return boost;
}
