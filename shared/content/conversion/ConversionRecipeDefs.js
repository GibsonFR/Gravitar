export const CONVERSION_MACHINE_TYPE = 'industrial_converter';

export const CONVERSION_RECIPE_DEFS = Object.freeze([
  {
    id: 'conv_iron_to_copper_basic',
    name: 'Transmutation fer → cuivre',
    tier: 1,
    seconds: 12,
    energyUse: 8,
    input: { ironOre: 8 },
    output: { copper: 5 },
    piratePrice: 650,
    reputationRequired: 0,
    stationTierMin: 1,
    tags: ['ore', 'basic']
  },
  {
    id: 'conv_scrap_to_iron_basic',
    name: 'Récupération ferraille → fer',
    tier: 1,
    seconds: 10,
    energyUse: 7,
    input: { scrap: 12 },
    output: { ironOre: 4 },
    piratePrice: 520,
    reputationRequired: 0,
    stationTierMin: 1,
    tags: ['scrap', 'basic']
  },
  {
    id: 'conv_graphite_to_carbon_basic',
    name: 'Compression graphite → fibre carbone',
    tier: 1,
    seconds: 14,
    energyUse: 10,
    input: { graphite: 10 },
    output: { carbonFiber: 1 },
    piratePrice: 780,
    reputationRequired: 0,
    stationTierMin: 1,
    tags: ['carbon', 'basic']
  },
  {
    id: 'conv_iron_carbon_to_steel',
    name: 'Alliage pirate acier',
    tier: 2,
    seconds: 16,
    energyUse: 12,
    input: { ironIngot: 6, graphite: 2 },
    output: { steelPlate: 3 },
    piratePrice: 1250,
    reputationRequired: 0,
    stationTierMin: 2,
    tags: ['alloy', 'tier2']
  },
  {
    id: 'conv_copper_to_conductors',
    name: 'Bobinage cuivre clandestin',
    tier: 2,
    seconds: 15,
    energyUse: 11,
    input: { copperIngot: 8 },
    output: { copperWire: 18 },
    piratePrice: 1100,
    reputationRequired: 0,
    stationTierMin: 2,
    tags: ['wire', 'tier2']
  },
  {
    id: 'conv_bauxite_to_aluminium',
    name: 'Raffinage bauxite accéléré',
    tier: 2,
    seconds: 18,
    energyUse: 13,
    input: { aluminiumOre: 12 },
    output: { aluminiumIngot: 4 },
    piratePrice: 1350,
    reputationRequired: 0,
    stationTierMin: 2,
    tags: ['ore', 'tier2']
  },
  {
    id: 'conv_ion_crystal_conductor',
    name: 'Conducteur ionique artisanal',
    tier: 3,
    seconds: 22,
    energyUse: 18,
    input: { quartz: 4, copperIngot: 2, unknownTechFragment: 1 },
    output: { controlCircuit: 1 },
    piratePrice: 2450,
    reputationRequired: 1,
    stationTierMin: 3,
    tags: ['ion', 'advanced']
  },
  {
    id: 'conv_titanium_thermal_armor',
    name: 'Plaques blindées thermiques',
    tier: 3,
    seconds: 24,
    energyUse: 19,
    input: { titaniumPlate: 6, thermalCeramic: 3 },
    output: { compositeArmor: 2 },
    piratePrice: 2750,
    reputationRequired: 1,
    stationTierMin: 3,
    tags: ['armor', 'advanced']
  }
]);

export function listConversionRecipes() {
  return CONVERSION_RECIPE_DEFS;
}

export function getConversionRecipe(recipeId) {
  const id = String(recipeId || '').toLowerCase();
  return CONVERSION_RECIPE_DEFS.find((recipe) => recipe.id === id) || null;
}

export function listConversionRecipesForStation(stationOrStock, player = null) {
  const stock = stationOrStock?.stock || stationOrStock || {};
  const tier = Math.max(1, stock.pirateTier | 0 || stationOrStock?.pirateTier | 0 || 1);
  const reputation = Math.max(0, player?.pirate?.reputationLevel | 0 || 0);
  return CONVERSION_RECIPE_DEFS.filter((recipe) => {
    if ((recipe.stationTierMin | 0) > tier) return false;
    if ((recipe.reputationRequired | 0) > Math.max(reputation, 0) + 5) return false;
    return true;
  });
}

export function toMachineRecipe(recipe) {
  if (!recipe) return null;
  return {
    id: recipe.id,
    machineType: CONVERSION_MACHINE_TYPE,
    name: recipe.name,
    seconds: recipe.seconds,
    energyUse: recipe.energyUse,
    input: { ...(recipe.input || {}) },
    output: { ...(recipe.output || {}) },
    pirateRecipe: true,
    tier: recipe.tier | 0 || 1,
    piratePrice: recipe.piratePrice | 0 || 0,
    reputationRequired: recipe.reputationRequired | 0 || 0,
    stationTierMin: recipe.stationTierMin | 0 || 1
  };
}

export const CONVERSION_MACHINE_RECIPES = Object.freeze(CONVERSION_RECIPE_DEFS.map(toMachineRecipe));
