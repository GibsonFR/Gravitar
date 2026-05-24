export const SCIENCE_PACKS = Object.freeze([
  { id: 'basicSciencePack', name: 'Science de base', tier: 1, colorHex: '#7edcff' },
  { id: 'automationSciencePack', name: 'Science automatisation', tier: 2, colorHex: '#c5a6ff' },
  { id: 'industrialSciencePack', name: 'Science industrielle', tier: 2, colorHex: '#ffb866' },
  { id: 'energySciencePack', name: 'Science énergétique', tier: 2, colorHex: '#ffe66d' },
  { id: 'biologySciencePack', name: 'Science biologique', tier: 3, colorHex: '#84e080' },
  { id: 'combatSciencePack', name: 'Science défense', tier: 3, colorHex: '#ff8f8f' },
  { id: 'advancedSciencePack', name: 'Science avancée', tier: 4, colorHex: '#f0f4ff' },
  { id: 'anomalySciencePack', name: 'Science anomalie', tier: 5, colorHex: '#b58cff' }
]);

export const RESEARCH_POINT_SECONDS = 30;

export const RESEARCH_BRANCHES = Object.freeze([
  { id: 'construction', name: 'Construction', colorHex: '#9fdcff' },
  { id: 'industry', name: 'Industrie', colorHex: '#ffb866' },
  { id: 'energy', name: 'Énergie', colorHex: '#ffe66d' },
  { id: 'automation', name: 'Automatisation', colorHex: '#c5a6ff' },
  { id: 'exploration', name: 'Exploration', colorHex: '#8fd8ff' },
  { id: 'biology', name: 'Biologie', colorHex: '#84e080' },
  { id: 'defense', name: 'Défense', colorHex: '#ff8f8f' },
  { id: 'pirate', name: 'Pirate', colorHex: '#ffbf7a' },
  { id: 'alien', name: 'Alien', colorHex: '#b58cff' }
]);

export const RESEARCH_PROJECTS = Object.freeze([
  {
    id: 'construction_foundations',
    branch: 'construction',
    name: 'Fondations métalliques',
    points: 6,
    energyUse: 8,
    pointCost: { basicSciencePack: 1 },
    unlockBuildings: ['Laboratoire scientifique', 'Station de recherche'],
    unlockRecipes: ['Science automatisation'],
    prereq: [],
    tier: 1
  },
  {
    id: 'industry_smelting_control',
    branch: 'industry',
    name: 'Contrôle de fusion',
    points: 8,
    energyUse: 9,
    pointCost: { basicSciencePack: 1 },
    unlockBuildings: ['Four haute température'],
    unlockRecipes: ['Verre optique', 'Fibre de carbone', 'Plaque de titane'],
    prereq: [],
    tier: 1
  },
  {
    id: 'automation_routing',
    branch: 'automation',
    name: 'Routage logistique',
    points: 9,
    energyUse: 10,
    pointCost: { basicSciencePack: 1, automationSciencePack: 1 },
    unlockBuildings: ['Convoyeur', 'Convoyeur rapide', 'Bras robotisé', 'Bras rapide', 'Bras long', 'Répartiteur', 'Fusionneur'],
    unlockRecipes: [],
    prereq: ['construction_foundations'],
    tier: 2
  },
  {
    id: 'energy_distribution',
    branch: 'energy',
    name: 'Distribution énergétique',
    points: 10,
    energyUse: 12,
    pointCost: { basicSciencePack: 1, automationSciencePack: 1 },
    unlockBuildings: ['Générateur thermique', 'Réservoir carburant'],
    unlockRecipes: ['Batterie lithium', 'Pile à combustible'],
    prereq: ['construction_foundations'],
    tier: 2
  },
  {
    id: 'advanced_industry',
    branch: 'industry',
    name: 'Industrie avancée',
    points: 12,
    energyUse: 16,
    pointCost: { basicSciencePack: 1, automationSciencePack: 1 },
    unlockBuildings: ['Raffinerie chimique', 'Électrolyseur'],
    unlockRecipes: ['Carburant raffiné', 'Biocarburant', 'Hydrogène', 'Propergol', 'Science industrielle'],
    prereq: ['industry_smelting_control', 'automation_routing'],
    tier: 2
  },
  {
    id: 'electronics_processing',
    branch: 'industry',
    name: 'Électronique de contrôle',
    points: 14,
    energyUse: 18,
    pointCost: { automationSciencePack: 1, industrialSciencePack: 1 },
    unlockBuildings: ['Atelier électronique'],
    unlockRecipes: ['Wafer de silicium', 'Microtransistor', 'Circuit imprimé', 'Circuit de contrôle', 'Microprocesseur', 'Lentille laser', 'Céramique thermique'],
    prereq: ['advanced_industry', 'energy_distribution'],
    tier: 3
  },
  {
    id: 'resource_scanning',
    branch: 'exploration',
    name: 'Scanner de ressources',
    points: 10,
    energyUse: 14,
    pointCost: { basicSciencePack: 1, automationSciencePack: 1, energySciencePack: 1 },
    unlockBuildings: ['Extracteur minier'],
    unlockRecipes: [],
    prereq: ['energy_distribution', 'electronics_processing'],
    tier: 3
  },
  {
    id: 'bio_processing',
    branch: 'biology',
    name: 'Traitement biologique',
    points: 12,
    energyUse: 18,
    pointCost: { industrialSciencePack: 1 },
    unlockBuildings: [],
    unlockRecipes: ['Science biologique'],
    prereq: ['advanced_industry'],
    tier: 3
  },
  {
    id: 'defense_turrets',
    branch: 'defense',
    name: 'Tourelles cinétiques',
    points: 12,
    energyUse: 20,
    pointCost: { automationSciencePack: 1, industrialSciencePack: 1 },
    unlockBuildings: [],
    unlockRecipes: ['Blindage composite', 'Science défense'],
    prereq: ['advanced_industry'],
    tier: 3
  },
  {
    id: 'advanced_research',
    branch: 'industry',
    name: 'Recherche avancée',
    points: 18,
    energyUse: 26,
    pointCost: { industrialSciencePack: 1, energySciencePack: 1, biologySciencePack: 1, combatSciencePack: 1 },
    unlockBuildings: ['Atelier d’équipement'],
    unlockRecipes: ['Moteur électrique', 'Injecteur carburant', 'Science énergétique', 'Science avancée', 'Craft équipement avancé'],
    prereq: ['electronics_processing', 'bio_processing', 'defense_turrets'],
    tier: 4
  },
  {
    id: 'pirate_reverse_engineering',
    branch: 'pirate',
    name: 'Rétro-ingénierie pirate',
    points: 20,
    energyUse: 28,
    pointCost: { industrialSciencePack: 1, combatSciencePack: 1, advancedSciencePack: 1 },
    unlockBuildings: [],
    unlockRecipes: [],
    prereq: ['advanced_research'],
    tier: 4
  },
  {
    id: 'equipment_rd_station',
    branch: 'combat',
    name: 'Station R&D équipement',
    points: 18,
    energyUse: 30,
    pointCost: { advancedSciencePack: 1, combatSciencePack: 1, biologySciencePack: 1 },
    unlockBuildings: ['Station R&D'],
    unlockRecipes: ['Amélioration R&D 1-3 sciences'],
    prereq: ['advanced_research'],
    tier: 5
  },
  {
    id: 'equipment_mark_iv',
    branch: 'combat',
    name: 'Équipement Mark IV',
    points: 28,
    energyUse: 40,
    pointCost: { advancedSciencePack: 1, combatSciencePack: 1, anomalySciencePack: 1 },
    unlockBuildings: [],
    unlockRecipes: ['Propulseur Mark IV', 'Bouclier Mark IV', 'Arme Mark IV', 'Module Mark IV'],
    prereq: ['alien_anomaly_analysis', 'equipment_rd_station'],
    tier: 6
  },
  {
    id: 'equipment_mark_v',
    branch: 'alien',
    name: 'Équipement Mark V',
    points: 40,
    energyUse: 52,
    pointCost: { advancedSciencePack: 1, combatSciencePack: 1, biologySciencePack: 1, anomalySciencePack: 1 },
    unlockBuildings: [],
    unlockRecipes: ['Propulseur Mark V', 'Bouclier Mark V', 'Arme Mark V', 'Module Mark V'],
    prereq: ['equipment_mark_iv'],
    tier: 7
  },
  {
    id: 'alien_anomaly_analysis',
    branch: 'alien',
    name: 'Analyse d’anomalies',
    points: 30,
    energyUse: 36,
    pointCost: { advancedSciencePack: 1, biologySciencePack: 1, combatSciencePack: 1 },
    unlockBuildings: [],
    unlockRecipes: ['Science anomalie', 'Équipement Mark III', 'Station R&D'],
    prereq: ['advanced_research'],
    tier: 5
  }
]);



export const STRUCTURE_RESEARCH_REQUIREMENTS = Object.freeze({
  high_temp_furnace: 'industry_smelting_control',
  conveyor: 'automation_routing',
  fast_conveyor: 'automation_routing',
  splitter: 'automation_routing',
  merger: 'automation_routing',
  robot_arm: 'automation_routing',
  fast_arm: 'automation_routing',
  long_arm: 'automation_routing',
  fuel_generator: 'energy_distribution',
  fuel_tank: 'energy_distribution',
  chemical_refinery: 'advanced_industry',
  electrolyzer: 'advanced_industry',
  electronics_bench: 'electronics_processing',
  mining_extractor: 'resource_scanning',
  equipment_fabricator: 'advanced_research',
  equipment_rd_station: 'equipment_rd_station'
});

export const RECIPE_RESEARCH_REQUIREMENTS = Object.freeze({
  fab_thruster_mk1: 'advanced_research',
  fab_shield_mk1: 'defense_turrets',
  fab_weapon_mk1: 'advanced_research',
  fab_module_mk1: 'advanced_research',
  fab_thruster_mk2: 'alien_anomaly_analysis',
  fab_shield_mk2: 'advanced_research',
  fab_weapon_mk2: 'advanced_research',
  fab_module_mk2: 'advanced_research',
  fab_thruster_mk3: 'alien_anomaly_analysis',
  fab_shield_mk3: 'alien_anomaly_analysis',
  fab_weapon_mk3: 'alien_anomaly_analysis',
  fab_module_mk3: 'alien_anomaly_analysis',
  fab_thruster_mk4: 'equipment_mark_iv',
  fab_shield_mk4: 'equipment_mark_iv',
  fab_weapon_mk4: 'equipment_mark_iv',
  fab_module_mk4: 'equipment_mark_iv',
  fab_thruster_mk5: 'equipment_mark_v',
  fab_shield_mk5: 'equipment_mark_v',
  fab_weapon_mk5: 'equipment_mark_v',
  fab_module_mk5: 'equipment_mark_v',
  automation_science_pack: 'construction_foundations',
  quartz_to_optical_glass: 'industry_smelting_control',
  graphite_to_carbon_fiber: 'industry_smelting_control',
  titanium_ore_to_titanium_plate: 'industry_smelting_control',
  hydrocarbons_to_refined_fuel: 'advanced_industry',
  biomass_lipids_to_biofuel: 'advanced_industry',
  water_ice_to_hydrogen: 'advanced_industry',
  methane_ammonia_to_propellant: 'advanced_industry',
  industrial_science_pack: 'advanced_industry',
  silicon_to_wafer: 'electronics_processing',
  wafer_wire_to_microtransistor: 'electronics_processing',
  microtransistor_to_printed_circuit: 'electronics_processing',
  printed_circuit_to_control_circuit: 'electronics_processing',
  printed_circuit_to_microprocessor: 'electronics_processing',
  silicon_glass_to_laser_lens: 'electronics_processing',
  quartz_sulfur_to_thermal_ceramic: 'electronics_processing',
  lithium_wire_to_battery: 'energy_distribution',
  hydrogen_circuit_to_fuel_cell: 'energy_distribution',
  steel_titanium_carbon_to_composite_armor: 'defense_turrets',
  biology_science_pack: 'bio_processing',
  combat_science_pack: 'defense_turrets',
  aluminium_copper_to_motor: 'advanced_research',
  steel_fuel_to_injector: 'advanced_research',
  energy_science_pack: 'advanced_research',
  advanced_science_pack: 'advanced_research',
  anomaly_science_pack: 'alien_anomaly_analysis'
});

export function completedResearchSet(researchOrCompleted = []) {
  const list = Array.isArray(researchOrCompleted)
    ? researchOrCompleted
    : Array.isArray(researchOrCompleted?.completed)
      ? researchOrCompleted.completed
      : [];
  return new Set(list.map((v) => String(v || '')).filter(Boolean));
}

export function getResearchName(researchId) {
  return RESEARCH_PROJECTS.find((p) => p.id === researchId)?.name || researchId || '';
}

export function isResearchCompleted(researchOrCompleted, researchId) {
  if (!researchId) return true;
  return completedResearchSet(researchOrCompleted).has(researchId);
}

export function getStructureResearchRequirement(structureType) {
  return STRUCTURE_RESEARCH_REQUIREMENTS[String(structureType || '').toLowerCase()] || '';
}

export function isStructureUnlockedByResearch(structureType, researchOrCompleted) {
  return isResearchCompleted(researchOrCompleted, getStructureResearchRequirement(structureType));
}

export function getRecipeResearchRequirement(recipeOrId) {
  const id = typeof recipeOrId === 'string' ? recipeOrId : recipeOrId?.id;
  return RECIPE_RESEARCH_REQUIREMENTS[String(id || '')] || '';
}

export function isRecipeUnlockedByResearch(recipeOrId, researchOrCompleted) {
  return isResearchCompleted(researchOrCompleted, getRecipeResearchRequirement(recipeOrId));
}

export function getSciencePack(id) { return SCIENCE_PACKS.find((p) => p.id === id) || null; }
export function isSciencePack(id) { return !!getSciencePack(id); }
export function getResearchBranch(id) { return RESEARCH_BRANCHES.find((b) => b.id === id) || null; }
export function getResearchProject(id) { return RESEARCH_PROJECTS.find((p) => p.id === id) || null; }
export function getResearchProjectsForBranch(branchId) { return RESEARCH_PROJECTS.filter((p) => p.branch === branchId); }
export function arePrerequisitesMet(project, completed = []) {
  const done = new Set(completed || []);
  return (project?.prereq || []).every((id) => done.has(id));
}
export function getResearchProjectTotalCost(project) {
  const points = Math.max(1, Number(project?.points ?? 1) || 1);
  const total = {};
  for (const [key, amount] of Object.entries(project?.pointCost || {})) total[key] = Math.max(0, amount | 0) * points;
  return total;
}
