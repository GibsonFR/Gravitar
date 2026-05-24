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
  { id: 'combat', name: 'Combat', colorHex: '#ff6f9f' },
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
    unlockRecipes: [],
    prereq: [],
    tier: 1
  },
  {
    id: 'industry_smelting_control',
    branch: 'industry',
    name: 'Contrôle de fusion',
    points: 7,
    energyUse: 9,
    pointCost: { basicSciencePack: 1 },
    unlockBuildings: ['Four haute température'],
    unlockRecipes: ['Lingot de fer', 'Lingot de cuivre', 'Lingot d’aluminium', 'Verre optique', 'Fibre de carbone', 'Plaque de titane'],
    prereq: [],
    tier: 1
  },
  {
    id: 'automation_routing',
    branch: 'automation',
    name: 'Routage logistique',
    points: 8,
    energyUse: 10,
    pointCost: { basicSciencePack: 1, automationSciencePack: 1 },
    unlockBuildings: ['Convoyeur', 'Bras robotisé', 'Répartiteur', 'Fusionneur'],
    unlockRecipes: [],
    prereq: ['construction_foundations'],
    tier: 2
  },
  {
    id: 'energy_distribution',
    branch: 'energy',
    name: 'Distribution énergétique',
    points: 8,
    energyUse: 12,
    pointCost: { basicSciencePack: 1, energySciencePack: 1 },
    unlockBuildings: ['Générateur', 'Réservoir de carburant'],
    unlockRecipes: ['Pile à combustible', 'Batterie lithium'],
    prereq: ['construction_foundations'],
    tier: 2
  },
  {
    id: 'advanced_industry',
    branch: 'industry',
    name: 'Industrie avancée',
    points: 10,
    energyUse: 16,
    pointCost: { basicSciencePack: 1, automationSciencePack: 1, industrialSciencePack: 1 },
    unlockBuildings: ['Raffinerie chimique', 'Électrolyseur', 'Presse industrielle'],
    unlockRecipes: ['Carburant raffiné', 'Biocarburant', 'Propergol', 'Fil de cuivre', 'Plaque d’acier', 'Blindage composite', 'Servomoteur', 'Moteur électrique', 'Injecteur carburant'],
    prereq: ['industry_smelting_control', 'automation_routing'],
    tier: 2
  },
  {
    id: 'electronics_processing',
    branch: 'industry',
    name: 'Électronique de contrôle',
    points: 12,
    energyUse: 18,
    pointCost: { automationSciencePack: 1, energySciencePack: 1, industrialSciencePack: 1 },
    unlockBuildings: ['Atelier électronique'],
    unlockRecipes: ['Wafer de silicium', 'Microtransistor', 'Circuit imprimé', 'Circuit de contrôle', 'Microprocesseur', 'Lentille laser', 'Céramique thermique'],
    prereq: ['energy_distribution', 'advanced_industry'],
    tier: 3
  },
  {
    id: 'resource_scanning',
    branch: 'exploration',
    name: 'Scanner de ressources',
    points: 9,
    energyUse: 14,
    pointCost: { basicSciencePack: 1, automationSciencePack: 1, energySciencePack: 1 },
    unlockBuildings: ['Extracteur minier'],
    unlockRecipes: [],
    prereq: ['energy_distribution'],
    tier: 3
  },
  {
    id: 'bio_processing',
    branch: 'biology',
    name: 'Traitement biologique',
    points: 12,
    energyUse: 18,
    pointCost: { basicSciencePack: 1, industrialSciencePack: 1, biologySciencePack: 1 },
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
    pointCost: { automationSciencePack: 1, industrialSciencePack: 1, combatSciencePack: 1 },
    unlockBuildings: [],
    unlockRecipes: ['Science défense'],
    prereq: ['advanced_industry'],
    tier: 3
  },
  {
    id: 'advanced_research',
    branch: 'industry',
    name: 'Recherche avancée',
    points: 16,
    energyUse: 26,
    pointCost: { automationSciencePack: 1, industrialSciencePack: 1, energySciencePack: 1, advancedSciencePack: 1 },
    unlockBuildings: [],
    unlockRecipes: ['Science avancée'],
    prereq: ['electronics_processing', 'bio_processing'],
    tier: 4
  },
  {
    id: 'pirate_reverse_engineering',
    branch: 'pirate',
    name: 'Rétro-ingénierie pirate',
    points: 18,
    energyUse: 28,
    pointCost: { industrialSciencePack: 1, combatSciencePack: 1, advancedSciencePack: 1 },
    unlockBuildings: [],
    unlockRecipes: [],
    prereq: ['defense_turrets', 'advanced_research'],
    tier: 4
  },
  {
    id: 'alien_anomaly_analysis',
    branch: 'alien',
    name: 'Analyse d’anomalies',
    points: 24,
    energyUse: 36,
    pointCost: { advancedSciencePack: 1, biologySciencePack: 1, combatSciencePack: 1, anomalySciencePack: 1 },
    unlockBuildings: [],
    unlockRecipes: [],
    prereq: ['advanced_research'],
    tier: 5
  }
]);

export function getSciencePack(id) {
  return SCIENCE_PACKS.find((p) => p.id === id) || null;
}

export function isSciencePack(id) {
  return !!getSciencePack(id);
}

export function getResearchBranch(id) {
  return RESEARCH_BRANCHES.find((b) => b.id === id) || null;
}

export function getResearchProject(id) {
  return RESEARCH_PROJECTS.find((p) => p.id === id) || null;
}

export function getResearchProjectsForBranch(branchId) {
  return RESEARCH_PROJECTS.filter((p) => p.branch === branchId);
}

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
