export const REFINERY_RECIPES = [
  {
    id: 'iron_to_steel_plate',
    name: 'Acier',
    category: 'Métallurgie',
    station: 'Raffinerie simple',
    seconds: 3.5,
    input: { ironOre: 8 },
    output: { steelPlate: 1 },
    description: 'Réduit et compacte le minerai de fer en plaque d’acier utilisable pour murs, machines et tourelles.'
  },
  {
    id: 'copper_to_wire',
    name: 'Fil de cuivre',
    category: 'Électronique',
    station: 'Atelier basique',
    seconds: 2.2,
    input: { copper: 3 },
    output: { copperWire: 2 },
    description: 'Étire le cuivre en conducteurs pour circuits, moteurs et panneaux solaires.'
  },
  {
    id: 'silicon_to_wafer',
    name: 'Wafer de silicium',
    category: 'Électronique',
    station: 'Atelier basique',
    seconds: 4.0,
    input: { silicon: 6 },
    output: { siliconWafer: 1 },
    description: 'Purifie et découpe le silicium en wafer pour microtransistors.'
  },
  {
    id: 'wafer_to_microtransistor',
    name: 'Microtransistor',
    category: 'Électronique avancée',
    station: 'Atelier électronique',
    seconds: 6.0,
    input: { siliconWafer: 2, copperWire: 2 },
    output: { microTransistor: 1 },
    description: 'Assemble des transistors miniaturisés, première brique des circuits de contrôle.'
  },
  {
    id: 'microtransistor_to_printed_circuit',
    name: 'Circuit imprimé',
    category: 'Électronique avancée',
    station: 'Atelier électronique',
    seconds: 7.0,
    input: { microTransistor: 2, copperWire: 2 },
    output: { printedCircuit: 1 },
    description: 'Produit un circuit imprimé générique pour machines, radars et modules.'
  },
  {
    id: 'printed_circuit_to_control_circuit',
    name: 'Circuit de contrôle',
    category: 'Électronique avancée',
    station: 'Atelier électronique',
    seconds: 9.0,
    input: { printedCircuit: 2, rareEarthOre: 1 },
    output: { controlCircuit: 1 },
    description: 'Ajoute composants de contrôle et aimants à terres rares pour piloter machines et tourelles.'
  },
  {
    id: 'quartz_to_optical_glass',
    name: 'Verre optique',
    category: 'Optique',
    station: 'Raffinerie minérale',
    seconds: 4.5,
    input: { quartz: 5 },
    output: { opticalGlass: 1 },
    description: 'Fond et purifie le quartz en verre optique pour capteurs, lasers et panneaux solaires.'
  },
  {
    id: 'optical_glass_to_laser_lens',
    name: 'Lentille laser',
    category: 'Optique',
    station: 'Raffinerie minérale',
    seconds: 6.5,
    input: { opticalGlass: 2, berylliumOre: 1 },
    output: { laserLens: 1 },
    description: 'Taille une lentille résistante à la chaleur pour futurs émetteurs laser.'
  },
  {
    id: 'lithium_to_battery',
    name: 'Batterie lithium-ion',
    category: 'Énergie',
    station: 'Atelier énergétique',
    seconds: 5.5,
    input: { lithiumOre: 4, graphite: 2, copperWire: 1 },
    output: { lithiumBattery: 1 },
    description: 'Assemble une batterie rechargeable pour bases, drones et modules.'
  },
  {
    id: 'hydrocarbons_to_refined_fuel',
    name: 'Carburant raffiné',
    category: 'Carburants',
    station: 'Raffinerie chimique',
    seconds: 5.0,
    input: { hydrocarbons: 6 },
    output: { refinedFuel: 2 },
    description: 'Raffine des hydrocarbures en carburant stable pour générateurs thermiques.'
  },
  {
    id: 'methane_to_propellant',
    name: 'Propergol',
    category: 'Carburants',
    station: 'Raffinerie chimique',
    seconds: 4.0,
    input: { methaneIce: 5, ammoniaIce: 2 },
    output: { propellant: 1 },
    description: 'Prépare un propergol simple pour propulsion et munitions futures.'
  },
  {
    id: 'biomass_to_biofuel',
    name: 'Biocarburant',
    category: 'Biologie',
    station: 'Bio-incubateur',
    seconds: 4.5,
    input: { biomass: 8, organicLipids: 2 },
    output: { biofuel: 2 },
    description: 'Transforme biomasse et lipides organiques en carburant biologique.'
  },
  {
    id: 'uranium_to_fuel_rod',
    name: 'Barre de combustible',
    category: 'Nucléaire',
    station: 'Stabilisateur nucléaire',
    seconds: 10.0,
    input: { uraniumOre: 5, thermalCeramic: 1 },
    output: { fuelRod: 1 },
    description: 'Prépare une barre de combustible pour réacteurs avancés.'
  },
  {
    id: 'carbon_to_carbon_fiber',
    name: 'Fibre de carbone',
    category: 'Composites',
    station: 'Four industriel',
    seconds: 5.0,
    input: { graphite: 4 },
    output: { carbonFiber: 1 },
    description: 'Transforme le graphite en fibres légères pour blindages et structures.'
  },
  {
    id: 'armor_composite_basic',
    name: 'Blindage composite',
    category: 'Composites',
    station: 'Assembleur mécanique',
    seconds: 8.0,
    input: { steelPlate: 2, titaniumOre: 2, carbonFiber: 1 },
    output: { compositeArmor: 1 },
    description: 'Combine acier, titane et fibre de carbone en blindage de structure.'
  }
];

export const REFINERY_RECIPE_BY_ID = Object.fromEntries(REFINERY_RECIPES.map((recipe) => [recipe.id, recipe]));

export function getRefineryRecipe(id) {
  return REFINERY_RECIPE_BY_ID[String(id || '')] || null;
}

export function listRefineryRecipes() {
  return REFINERY_RECIPES;
}
