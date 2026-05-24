export const MACHINE_TYPES = Object.freeze({
  FURNACE: 'furnace',
  HIGH_TEMP_FURNACE: 'high_temp_furnace',
  CHEM_REFINERY: 'chemical_refinery',
  ELECTROLYZER: 'electrolyzer',
  ELECTRONICS_BENCH: 'electronics_bench',
  INDUSTRIAL_PRESS: 'industrial_press',
  SCIENCE_LAB: 'science_lab'
});

export const MACHINE_RECIPES = Object.freeze([
  {
    id: 'iron_ore_to_iron_ingot',
    machineType: MACHINE_TYPES.FURNACE,
    name: 'Lingot de fer',
    seconds: 6,
    energyUse: 4,
    input: { ironOre: 6 },
    output: { ironIngot: 1 }
  },
  {
    id: 'copper_ore_to_copper_ingot',
    machineType: MACHINE_TYPES.FURNACE,
    name: 'Lingot de cuivre',
    seconds: 5,
    energyUse: 4,
    input: { copper: 5 },
    output: { copperIngot: 1 }
  },
  {
    id: 'aluminium_ore_to_aluminium_ingot',
    machineType: MACHINE_TYPES.FURNACE,
    name: 'Lingot d’aluminium',
    seconds: 7,
    energyUse: 4,
    input: { aluminiumOre: 6 },
    output: { aluminiumIngot: 1 }
  },
  {
    id: 'quartz_to_optical_glass',
    machineType: MACHINE_TYPES.HIGH_TEMP_FURNACE,
    name: 'Verre optique',
    seconds: 9,
    energyUse: 9,
    input: { quartz: 6 },
    output: { opticalGlass: 1 }
  },
  {
    id: 'graphite_to_carbon_fiber',
    machineType: MACHINE_TYPES.HIGH_TEMP_FURNACE,
    name: 'Fibre de carbone',
    seconds: 11,
    energyUse: 10,
    input: { graphite: 7 },
    output: { carbonFiber: 1 }
  },
  {
    id: 'titanium_ore_to_titanium_plate',
    machineType: MACHINE_TYPES.HIGH_TEMP_FURNACE,
    name: 'Plaque de titane',
    seconds: 12,
    energyUse: 11,
    input: { titaniumOre: 7 },
    output: { titaniumPlate: 1 }
  },
  {
    id: 'hydrocarbons_to_refined_fuel',
    machineType: MACHINE_TYPES.CHEM_REFINERY,
    name: 'Carburant raffiné',
    seconds: 8,
    energyUse: 6,
    input: { hydrocarbons: 5 },
    output: { refinedFuel: 1 }
  },
  {
    id: 'biomass_lipids_to_biofuel',
    machineType: MACHINE_TYPES.CHEM_REFINERY,
    name: 'Biocarburant',
    seconds: 8,
    energyUse: 5,
    input: { biomass: 5, organicLipids: 2 },
    output: { biofuel: 1 }
  },
  {
    id: 'water_ice_to_hydrogen',
    machineType: MACHINE_TYPES.ELECTROLYZER,
    name: 'Hydrogène',
    seconds: 7,
    energyUse: 8,
    input: { waterIce: 5 },
    output: { hydrogenIce: 2 }
  },
  {
    id: 'methane_ammonia_to_propellant',
    machineType: MACHINE_TYPES.ELECTROLYZER,
    name: 'Propergol',
    seconds: 10,
    energyUse: 9,
    input: { methaneIce: 4, ammoniaIce: 3 },
    output: { propellant: 1 }
  },
  {
    id: 'silicon_to_wafer',
    machineType: MACHINE_TYPES.ELECTRONICS_BENCH,
    name: 'Wafer de silicium',
    seconds: 7,
    energyUse: 5,
    input: { silicon: 6 },
    output: { siliconWafer: 1 }
  },
  {
    id: 'wafer_wire_to_microtransistor',
    machineType: MACHINE_TYPES.ELECTRONICS_BENCH,
    name: 'Microtransistor',
    seconds: 9,
    energyUse: 7,
    input: { siliconWafer: 2, copperWire: 3 },
    output: { microTransistor: 1 }
  },
  {
    id: 'microtransistor_to_printed_circuit',
    machineType: MACHINE_TYPES.ELECTRONICS_BENCH,
    name: 'Circuit imprimé',
    seconds: 10,
    energyUse: 8,
    input: { microTransistor: 2, copperWire: 2 },
    output: { printedCircuit: 1 }
  },
  {
    id: 'copper_ingot_to_wire',
    machineType: MACHINE_TYPES.INDUSTRIAL_PRESS,
    name: 'Fil de cuivre',
    seconds: 5,
    energyUse: 5,
    input: { copperIngot: 1 },
    output: { copperWire: 4 }
  },
  {
    id: 'iron_graphite_to_steel_plate',
    machineType: MACHINE_TYPES.INDUSTRIAL_PRESS,
    name: 'Plaque d’acier',
    seconds: 8,
    energyUse: 8,
    input: { ironIngot: 2, graphite: 1 },
    output: { steelPlate: 1 }
  },
  {
    id: 'steel_titanium_carbon_to_composite_armor',
    machineType: MACHINE_TYPES.INDUSTRIAL_PRESS,
    name: 'Blindage composite',
    seconds: 12,
    energyUse: 10,
    input: { steelPlate: 3, titaniumPlate: 2, carbonFiber: 1 },
    output: { compositeArmor: 1 }
  },
  {
    id: 'steel_copper_to_servomotor',
    machineType: MACHINE_TYPES.INDUSTRIAL_PRESS,
    name: 'Servomoteur',
    seconds: 10,
    energyUse: 8,
    input: { steelPlate: 2, copperWire: 2 },
    output: { servomotor: 1 }
  },
  {
    id: 'printed_circuit_to_control_circuit',
    machineType: MACHINE_TYPES.ELECTRONICS_BENCH,
    name: 'Circuit de contrôle',
    seconds: 12,
    energyUse: 10,
    input: { printedCircuit: 2, microTransistor: 2, copperWire: 4 },
    output: { controlCircuit: 1 }
  },
  {
    id: 'printed_circuit_to_microprocessor',
    machineType: MACHINE_TYPES.ELECTRONICS_BENCH,
    name: 'Microprocesseur',
    seconds: 16,
    energyUse: 14,
    input: { printedCircuit: 2, controlCircuit: 1, siliconWafer: 3 },
    output: { microprocessor: 1 }
  },
  {
    id: 'silicon_glass_to_laser_lens',
    machineType: MACHINE_TYPES.ELECTRONICS_BENCH,
    name: 'Lentille laser',
    seconds: 12,
    energyUse: 10,
    input: { siliconWafer: 2, opticalGlass: 2 },
    output: { laserLens: 1 }
  },
  {
    id: 'lithium_wire_to_battery',
    machineType: MACHINE_TYPES.ELECTRONICS_BENCH,
    name: 'Batterie lithium',
    seconds: 12,
    energyUse: 10,
    input: { lithiumOre: 4, copperWire: 3 },
    output: { lithiumBattery: 1 }
  },
  {
    id: 'hydrogen_circuit_to_fuel_cell',
    machineType: MACHINE_TYPES.ELECTROLYZER,
    name: 'Pile à combustible',
    seconds: 14,
    energyUse: 12,
    input: { hydrogenIce: 4, printedCircuit: 1 },
    output: { fuelCell: 1 }
  },
  {
    id: 'aluminium_copper_to_motor',
    machineType: MACHINE_TYPES.INDUSTRIAL_PRESS,
    name: 'Moteur électrique',
    seconds: 11,
    energyUse: 9,
    input: { aluminiumIngot: 2, copperWire: 4, steelPlate: 1 },
    output: { electricMotor: 1 }
  },
  {
    id: 'steel_fuel_to_injector',
    machineType: MACHINE_TYPES.INDUSTRIAL_PRESS,
    name: 'Injecteur carburant',
    seconds: 10,
    energyUse: 8,
    input: { steelPlate: 1, copperWire: 2, refinedFuel: 1 },
    output: { fuelInjector: 1 }
  },
  {
    id: 'quartz_sulfur_to_thermal_ceramic',
    machineType: MACHINE_TYPES.HIGH_TEMP_FURNACE,
    name: 'Céramique thermique',
    seconds: 14,
    energyUse: 13,
    input: { quartz: 4, sulfur: 3 },
    output: { thermalCeramic: 1 }
  },
  {
    id: 'basic_science_pack',
    machineType: MACHINE_TYPES.SCIENCE_LAB,
    name: 'Science de base',
    seconds: 8,
    energyUse: 6,
    input: { ironIngot: 1, copperWire: 2 },
    output: { basicSciencePack: 1 }
  },
  {
    id: 'automation_science_pack',
    machineType: MACHINE_TYPES.SCIENCE_LAB,
    name: 'Science automatisation',
    seconds: 12,
    energyUse: 8,
    input: { steelPlate: 1, servomotor: 1, printedCircuit: 1 },
    output: { automationSciencePack: 1 }
  },
  {
    id: 'industrial_science_pack',
    machineType: MACHINE_TYPES.SCIENCE_LAB,
    name: 'Science industrielle',
    seconds: 14,
    energyUse: 10,
    input: { titaniumPlate: 1, carbonFiber: 1, refinedFuel: 1 },
    output: { industrialSciencePack: 1 }
  },
  {
    id: 'energy_science_pack',
    machineType: MACHINE_TYPES.SCIENCE_LAB,
    name: 'Science énergétique',
    seconds: 14,
    energyUse: 11,
    input: { lithiumBattery: 1, fuelCell: 1, copperWire: 3 },
    output: { energySciencePack: 1 }
  },
  {
    id: 'biology_science_pack',
    machineType: MACHINE_TYPES.SCIENCE_LAB,
    name: 'Science biologique',
    seconds: 16,
    energyUse: 11,
    input: { biofuel: 1, biomass: 4, organicLipids: 2 },
    output: { biologySciencePack: 1 }
  },
  {
    id: 'combat_science_pack',
    machineType: MACHINE_TYPES.SCIENCE_LAB,
    name: 'Science défense',
    seconds: 18,
    energyUse: 13,
    input: { compositeArmor: 1, propellant: 1, controlCircuit: 1 },
    output: { combatSciencePack: 1 }
  },
  {
    id: 'advanced_science_pack',
    machineType: MACHINE_TYPES.SCIENCE_LAB,
    name: 'Science avancée',
    seconds: 24,
    energyUse: 18,
    input: { microprocessor: 1, laserLens: 1, thermalCeramic: 1, fuelInjector: 1, compositeArmor: 1 },
    output: { advancedSciencePack: 1 }
  },
  {
    id: 'anomaly_science_pack',
    machineType: MACHINE_TYPES.SCIENCE_LAB,
    name: 'Science anomalie',
    seconds: 32,
    energyUse: 24,
    input: { unknownTechFragment: 1, precursorNanomaterial: 1, containedAntimatter: 1, advancedSciencePack: 1 },
    output: { anomalySciencePack: 1 }
  }
]);

export function getRecipesForMachine(machineType) {
  return MACHINE_RECIPES.filter((recipe) => recipe.machineType === machineType);
}

export function getMachineRecipe(recipeId) {
  return MACHINE_RECIPES.find((recipe) => recipe.id === recipeId) || null;
}
