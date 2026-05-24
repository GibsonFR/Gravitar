import { ITEM_CATEGORY_IDS } from '../items/ItemCategoryIds.js';

const COMMON_SCIENCES = Object.freeze({
  mk1: 'advanced_research',
  mk2: 'equipment_mark_ii',
  mk3: 'equipment_mark_iii',
  mk4: 'equipment_mark_iv',
  mk5: 'equipment_mark_v'
});

function markRecipe({ id, baseItemId, name, categoryId, mark, seconds, input }) {
  return {
    id,
    baseItemId,
    name: `${name} Mark ${['', 'I', 'II', 'III', 'IV', 'V'][mark] || mark}`,
    categoryId,
    mark,
    seconds,
    researchId: COMMON_SCIENCES[`mk${mark}`],
    input
  };
}

const PROPULSERS = Object.freeze([
  markRecipe({ id: 'fab_thruster_mk1', baseItemId: 'vector-thruster-vanes', name: 'Propulseur', categoryId: ITEM_CATEGORY_IDS.ENGINE, mark: 1, seconds: 18, input: { electricMotor: 1, aluminiumIngot: 4, copperWire: 6, energySciencePack: 1 } }),
  markRecipe({ id: 'fab_thruster_mk2', baseItemId: 'vector-thruster-vanes', name: 'Propulseur', categoryId: ITEM_CATEGORY_IDS.ENGINE, mark: 2, seconds: 28, input: { electricMotor: 2, fuelInjector: 1, titaniumPlate: 4, advancedSciencePack: 1 } }),
  markRecipe({ id: 'fab_thruster_mk3', baseItemId: 'vector-thruster-vanes', name: 'Propulseur', categoryId: ITEM_CATEGORY_IDS.ENGINE, mark: 3, seconds: 40, input: { electricMotor: 3, fuelInjector: 2, thermalCeramic: 3, advancedSciencePack: 2 } }),
  markRecipe({ id: 'fab_thruster_mk4', baseItemId: 'vector-thruster-vanes', name: 'Propulseur', categoryId: ITEM_CATEGORY_IDS.ENGINE, mark: 4, seconds: 54, input: { electricMotor: 4, fuelInjector: 3, thermalCeramic: 5, precursorNanomaterial: 2, anomalySciencePack: 1 } }),
  markRecipe({ id: 'fab_thruster_mk5', baseItemId: 'vector-thruster-vanes', name: 'Propulseur', categoryId: ITEM_CATEGORY_IDS.ENGINE, mark: 5, seconds: 72, input: { electricMotor: 5, fuelInjector: 4, ancientSuperconductor: 1, precursorNanomaterial: 3, anomalySciencePack: 3 } })
]);

const SHIELDS = Object.freeze([
  markRecipe({ id: 'fab_shield_mk1', baseItemId: 'compact-shield-array', name: 'Bouclier', categoryId: ITEM_CATEGORY_IDS.DEFENSE, mark: 1, seconds: 20, input: { compositeArmor: 1, controlCircuit: 1, copperWire: 6, combatSciencePack: 1 } }),
  markRecipe({ id: 'fab_shield_mk2', baseItemId: 'compact-shield-array', name: 'Bouclier', categoryId: ITEM_CATEGORY_IDS.DEFENSE, mark: 2, seconds: 30, input: { compositeArmor: 2, titaniumPlate: 4, controlCircuit: 2, combatSciencePack: 1 } }),
  markRecipe({ id: 'fab_shield_mk3', baseItemId: 'compact-shield-array', name: 'Bouclier', categoryId: ITEM_CATEGORY_IDS.DEFENSE, mark: 3, seconds: 42, input: { compositeArmor: 3, titaniumPlate: 6, controlCircuit: 3, advancedSciencePack: 2 } }),
  markRecipe({ id: 'fab_shield_mk4', baseItemId: 'compact-shield-array', name: 'Bouclier', categoryId: ITEM_CATEGORY_IDS.DEFENSE, mark: 4, seconds: 56, input: { compositeArmor: 4, thermalCeramic: 5, precursorNanomaterial: 2, anomalySciencePack: 1 } }),
  markRecipe({ id: 'fab_shield_mk5', baseItemId: 'compact-shield-array', name: 'Bouclier', categoryId: ITEM_CATEGORY_IDS.DEFENSE, mark: 5, seconds: 74, input: { compositeArmor: 5, ancientSuperconductor: 1, precursorNanomaterial: 3, anomalySciencePack: 3 } })
]);

const WEAPONS = Object.freeze([
  markRecipe({ id: 'fab_weapon_mk1', baseItemId: 'needle-array-mk1', name: 'Arme cinétique', categoryId: ITEM_CATEGORY_IDS.WEAPON, mark: 1, seconds: 22, input: { microprocessor: 1, laserLens: 1, steelPlate: 3, advancedSciencePack: 1 } }),
  markRecipe({ id: 'fab_weapon_mk2', baseItemId: 'needle-array-mk1', name: 'Arme cinétique', categoryId: ITEM_CATEGORY_IDS.WEAPON, mark: 2, seconds: 32, input: { microprocessor: 2, laserLens: 2, titaniumPlate: 3, combatSciencePack: 1 } }),
  markRecipe({ id: 'fab_weapon_mk3', baseItemId: 'needle-array-mk1', name: 'Arme cinétique', categoryId: ITEM_CATEGORY_IDS.WEAPON, mark: 3, seconds: 44, input: { microprocessor: 3, laserLens: 3, thermalCeramic: 2, advancedSciencePack: 2 } }),
  markRecipe({ id: 'fab_weapon_mk4', baseItemId: 'needle-array-mk1', name: 'Arme cinétique', categoryId: ITEM_CATEGORY_IDS.WEAPON, mark: 4, seconds: 58, input: { microprocessor: 4, laserLens: 4, thermalCeramic: 4, unknownTechFragment: 2, anomalySciencePack: 1 } }),
  markRecipe({ id: 'fab_weapon_mk5', baseItemId: 'needle-array-mk1', name: 'Arme cinétique', categoryId: ITEM_CATEGORY_IDS.WEAPON, mark: 5, seconds: 76, input: { microprocessor: 5, laserLens: 5, ancientSuperconductor: 1, unknownTechFragment: 3, anomalySciencePack: 3 } })
]);

function moduleSeries(prefix, baseItemId, label, focusInput = {}) {
  return Object.freeze([
    markRecipe({ id: `fab_module_${prefix}_mk1`, baseItemId, name: label, categoryId: ITEM_CATEGORY_IDS.MODULE, mark: 1, seconds: 16, input: { steelPlate: 2, printedCircuit: 1, industrialSciencePack: 1, ...focusInput.mk1 } }),
    markRecipe({ id: `fab_module_${prefix}_mk2`, baseItemId, name: label, categoryId: ITEM_CATEGORY_IDS.MODULE, mark: 2, seconds: 26, input: { titaniumPlate: 2, controlCircuit: 1, industrialSciencePack: 1, ...focusInput.mk2 } }),
    markRecipe({ id: `fab_module_${prefix}_mk3`, baseItemId, name: label, categoryId: ITEM_CATEGORY_IDS.MODULE, mark: 3, seconds: 38, input: { titaniumPlate: 4, microprocessor: 1, advancedSciencePack: 1, ...focusInput.mk3 } }),
    markRecipe({ id: `fab_module_${prefix}_mk4`, baseItemId, name: label, categoryId: ITEM_CATEGORY_IDS.MODULE, mark: 4, seconds: 52, input: { microprocessor: 2, precursorNanomaterial: 1, anomalySciencePack: 1, ...focusInput.mk4 } }),
    markRecipe({ id: `fab_module_${prefix}_mk5`, baseItemId, name: label, categoryId: ITEM_CATEGORY_IDS.MODULE, mark: 5, seconds: 70, input: { microprocessor: 3, ancientSuperconductor: 1, precursorNanomaterial: 2, anomalySciencePack: 2, ...focusInput.mk5 } })
  ]);
}

const MODULES = Object.freeze([
  ...moduleSeries('cargo', 'cargo-overmesh', 'Module soute', {
    mk1: { carbonFiber: 2 }, mk2: { carbonFiber: 4 }, mk3: { carbonFiber: 5 }, mk4: { carbonFiber: 7 }, mk5: { carbonFiber: 9 }
  }),
  ...moduleSeries('damage', 'reaver-gyro-stabilizer', 'Module dégâts', {
    mk1: { laserLens: 1 }, mk2: { laserLens: 2 }, mk3: { laserLens: 3 }, mk4: { unknownTechFragment: 1 }, mk5: { unknownTechFragment: 2 }
  }),
  ...moduleSeries('energy', 'surge-capacitor-bank', 'Module énergie', {
    mk1: { copperWire: 6 }, mk2: { lithiumBattery: 2 }, mk3: { lithiumBattery: 4 }, mk4: { fuelCell: 2 }, mk5: { fuelCell: 4 }
  }),
  ...moduleSeries('repair', 'siphon-repair-weave', 'Module réparation', {
    mk1: { biomass: 4 }, mk2: { organicLipids: 2 }, mk3: { organicLipids: 4 }, mk4: { biocarbure: 2 }, mk5: { biocarbure: 4 }
  }),
  ...moduleSeries('targeting', 'siege-target-matrix', 'Module ciblage', {
    mk1: { quartz: 4 }, mk2: { opticalGlass: 2 }, mk3: { opticalGlass: 4 }, mk4: { unknownTechFragment: 1 }, mk5: { unknownTechFragment: 2 }
  })
]);

export const EQUIPMENT_FABRICATOR_RECIPES = Object.freeze([
  ...PROPULSERS,
  ...WEAPONS,
  ...SHIELDS,
  ...MODULES
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

export function getEquipmentRDScienceTier(key) {
  return ({
    basicSciencePack: 1,
    automationSciencePack: 2,
    industrialSciencePack: 2,
    energySciencePack: 2,
    biologySciencePack: 3,
    combatSciencePack: 3,
    advancedSciencePack: 4,
    anomalySciencePack: 5
  })[String(key || '')] || 0;
}

export function getEquipmentRDScienceScore(sciences = []) {
  return sciences.filter(isEquipmentRDScience).slice(0, EQUIPMENT_RD_MAX_SCIENCES).reduce((sum, key) => sum + getEquipmentRDScienceTier(key), 0);
}

export function getEquipmentRDQualityBoost(sciences = []) {
  const score = getEquipmentRDScienceScore(sciences);
  return Math.round(score * 2.5);
}
