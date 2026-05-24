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
    id: 'construction_foundations', branch: 'construction', name: 'Fondations métalliques', tier: 1,
    points: 12, energyUse: 8, pointCost: { basicSciencePack: 1 }, prereq: [],
    unlockBuildings: ['Coffre de ressources', 'Coffre d’équipement', 'Coffre de roquettes', 'Laboratoire scientifique', 'Station de recherche'],
    unlockRecipes: ['Science de base']
  },
  {
    id: 'industry_smelting_control', branch: 'industry', name: 'Contrôle de fusion', tier: 1,
    points: 14, energyUse: 9, pointCost: { basicSciencePack: 1 }, prereq: [],
    unlockBuildings: ['Four basique', 'Four haute température'],
    unlockRecipes: ['Lingot de fer', 'Lingot de cuivre', 'Lingot d’aluminium', 'Verre optique', 'Fibre de carbone', 'Plaque de titane', 'Science industrielle']
  },
  {
    id: 'automation_routing', branch: 'automation', name: 'Routage logistique', tier: 2,
    points: 22, energyUse: 12, pointCost: { basicSciencePack: 1, automationSciencePack: 1 }, prereq: ['construction_foundations'],
    unlockBuildings: ['Convoyeur', 'Convoyeur rapide', 'Bras robotisé', 'Bras rapide', 'Répartiteur', 'Fusionneur'],
    unlockRecipes: ['Science automatisation', 'Servomoteur']
  },
  {
    id: 'energy_distribution', branch: 'energy', name: 'Distribution énergétique', tier: 2,
    points: 22, energyUse: 14, pointCost: { basicSciencePack: 1, energySciencePack: 1 }, prereq: ['construction_foundations'],
    unlockBuildings: ['Panneau solaire', 'Générateur à carburant', 'Réservoir de carburant'],
    unlockRecipes: ['Batterie lithium', 'Pile à combustible', 'Science énergétique']
  },
  {
    id: 'advanced_industry', branch: 'industry', name: 'Industrie avancée', tier: 2,
    points: 34, energyUse: 18, pointCost: { basicSciencePack: 1, automationSciencePack: 1, industrialSciencePack: 1 }, prereq: ['industry_smelting_control', 'automation_routing'],
    unlockBuildings: ['Raffinerie chimique', 'Électrolyseur', 'Presse industrielle', 'Extracteur minier'],
    unlockRecipes: ['Carburant raffiné', 'Biocarburant', 'Propergol', 'Fil de cuivre', 'Plaque d’acier', 'Blindage composite', 'Moteur électrique', 'Injecteur carburant']
  },
  {
    id: 'resource_scanning', branch: 'exploration', name: 'Scanner de ressources', tier: 3,
    points: 30, energyUse: 16, pointCost: { basicSciencePack: 1, automationSciencePack: 1, energySciencePack: 1 }, prereq: ['energy_distribution'],
    unlockBuildings: ['Balise de scan', 'Carte des gisements'],
    unlockRecipes: ['Marqueurs de gisements', 'Analyse de biome']
  },
  {
    id: 'electronics_processing', branch: 'industry', name: 'Électronique de contrôle', tier: 3,
    points: 42, energyUse: 22, pointCost: { automationSciencePack: 1, industrialSciencePack: 1, energySciencePack: 1 }, prereq: ['advanced_industry', 'energy_distribution'],
    unlockBuildings: ['Atelier électronique'],
    unlockRecipes: ['Wafer de silicium', 'Microtransistor', 'Circuit imprimé', 'Circuit de contrôle', 'Microprocesseur', 'Lentille laser', 'Céramique thermique']
  },
  {
    id: 'bio_processing', branch: 'biology', name: 'Traitement biologique', tier: 3,
    points: 44, energyUse: 22, pointCost: { basicSciencePack: 1, industrialSciencePack: 1, biologySciencePack: 1 }, prereq: ['advanced_industry'],
    unlockBuildings: ['Cuve biologique'],
    unlockRecipes: ['Science biologique', 'Enzymes stabilisées', 'Support organique', 'Catalyseur biologique']
  },
  {
    id: 'defense_turrets', branch: 'defense', name: 'Systèmes défensifs', tier: 3,
    points: 46, energyUse: 24, pointCost: { automationSciencePack: 1, industrialSciencePack: 1, combatSciencePack: 1 }, prereq: ['advanced_industry'],
    unlockBuildings: ['Atelier d’armement', 'Atelier de boucliers'],
    unlockRecipes: ['Science défense', 'Blindage composite', 'Module de bouclier basique', 'Munitions renforcées']
  },
  {
    id: 'advanced_research', branch: 'industry', name: 'Recherche avancée', tier: 4,
    points: 72, energyUse: 34, pointCost: { automationSciencePack: 1, industrialSciencePack: 1, energySciencePack: 1, advancedSciencePack: 1 }, prereq: ['electronics_processing', 'bio_processing'],
    unlockBuildings: ['Atelier de modules', 'Atelier de propulseurs'],
    unlockRecipes: ['Science avancée', 'Propulseur ionique', 'Module de cadence', 'Module de capacité', 'Module de rendement']
  },
  {
    id: 'pirate_reverse_engineering', branch: 'pirate', name: 'Rétro-ingénierie pirate', tier: 4,
    points: 84, energyUse: 36, pointCost: { industrialSciencePack: 1, combatSciencePack: 1, advancedSciencePack: 1 }, prereq: ['defense_turrets', 'advanced_research'],
    unlockBuildings: ['Banc de récupération pirate'],
    unlockRecipes: ['Armes instables', 'Recycleur d’équipement', 'Catalyseur de reroll']
  },
  {
    id: 'alien_anomaly_analysis', branch: 'alien', name: 'Analyse d’anomalies', tier: 5,
    points: 120, energyUse: 48, pointCost: { advancedSciencePack: 1, biologySciencePack: 1, combatSciencePack: 1, anomalySciencePack: 1 }, prereq: ['advanced_research', 'pirate_reverse_engineering'],
    unlockBuildings: ['Stabilisateur anomalie', 'Forge exotique'],
    unlockRecipes: ['Science anomalie', 'Matrice précurseur', 'Antimatière confinée stabilisée', 'Propulseur gravitationnel', 'Bouclier de phase']
  }
]);

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
