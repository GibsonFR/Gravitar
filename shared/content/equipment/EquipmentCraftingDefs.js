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
    id: 'fab_thruster_mk4',
    baseItemId: 'vector-thruster-vanes',
    name: 'Propulseur Mark IV',
    categoryId: ITEM_CATEGORY_IDS.ENGINE,
    mark: 4,
    seconds: 54,
    researchId: 'equipment_mark_iv',
    input: { electricMotor: 4, fuelInjector: 3, thermalCeramic: 5, precursorNanomaterial: 2, anomalySciencePack: 2 }
  },
  {
    id: 'fab_thruster_mk5',
    baseItemId: 'vector-thruster-vanes',
    name: 'Propulseur Mark V',
    categoryId: ITEM_CATEGORY_IDS.ENGINE,
    mark: 5,
    seconds: 72,
    researchId: 'equipment_mark_v',
    input: { electricMotor: 5, fuelInjector: 4, ancientSuperconductor: 1, precursorNanomaterial: 3, anomalySciencePack: 3 }
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
    id: 'fab_shield_mk4',
    baseItemId: 'compact-shield-array',
    name: 'Bouclier Mark IV',
    categoryId: ITEM_CATEGORY_IDS.DEFENSE,
    mark: 4,
    seconds: 56,
    researchId: 'equipment_mark_iv',
    input: { compositeArmor: 4, thermalCeramic: 5, precursorNanomaterial: 2, anomalySciencePack: 2 }
  },
  {
    id: 'fab_shield_mk5',
    baseItemId: 'compact-shield-array',
    name: 'Bouclier Mark V',
    categoryId: ITEM_CATEGORY_IDS.DEFENSE,
    mark: 5,
    seconds: 74,
    researchId: 'equipment_mark_v',
    input: { compositeArmor: 5, ancientSuperconductor: 1, precursorNanomaterial: 3, anomalySciencePack: 3 }
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
    id: 'fab_weapon_mk4',
    baseItemId: 'needle-array-mk1',
    name: 'Arme cinétique Mark IV',
    categoryId: ITEM_CATEGORY_IDS.WEAPON,
    mark: 4,
    seconds: 58,
    researchId: 'equipment_mark_iv',
    input: { microprocessor: 4, laserLens: 4, thermalCeramic: 4, unknownTechFragment: 2, anomalySciencePack: 2 }
  },
  {
    id: 'fab_weapon_mk5',
    baseItemId: 'needle-array-mk1',
    name: 'Arme cinétique Mark V',
    categoryId: ITEM_CATEGORY_IDS.WEAPON,
    mark: 5,
    seconds: 76,
    researchId: 'equipment_mark_v',
    input: { microprocessor: 5, laserLens: 5, ancientSuperconductor: 1, unknownTechFragment: 3, anomalySciencePack: 3 }
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
  },
  {
    id: 'fab_module_mk4',
    baseItemId: 'cargo-overmesh',
    name: 'Module utilitaire Mark IV',
    categoryId: ITEM_CATEGORY_IDS.MODULE,
    mark: 4,
    seconds: 52,
    researchId: 'equipment_mark_iv',
    input: { carbonFiber: 7, microprocessor: 3, precursorNanomaterial: 2, anomalySciencePack: 2 }
  },
  {
    id: 'fab_module_mk5',
    baseItemId: 'cargo-overmesh',
    name: 'Module utilitaire Mark V',
    categoryId: ITEM_CATEGORY_IDS.MODULE,
    mark: 5,
    seconds: 70,
    researchId: 'equipment_mark_v',
    input: { carbonFiber: 9, microprocessor: 4, ancientSuperconductor: 1, precursorNanomaterial: 3, anomalySciencePack: 3 }
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
