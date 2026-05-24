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
    seconds: 24,
    energyUse: 8,
    scienceCost: { basicSciencePack: 8 },
    unlocks: ['Fondations 1×1', 'plateformes industrielles'],
    prereq: [],
    tier: 1
  },
  {
    id: 'industry_smelting_control',
    branch: 'industry',
    name: 'Contrôle de fusion',
    seconds: 28,
    energyUse: 9,
    scienceCost: { basicSciencePack: 10 },
    unlocks: ['rendements four basique', 'recettes lingots optimisées'],
    prereq: [],
    tier: 1
  },
  {
    id: 'automation_routing',
    branch: 'automation',
    name: 'Routage logistique',
    seconds: 32,
    energyUse: 10,
    scienceCost: { basicSciencePack: 10, automationSciencePack: 6 },
    unlocks: ['filtres de bras', 'priorités entrée/sortie'],
    prereq: ['construction_foundations'],
    tier: 2
  },
  {
    id: 'energy_distribution',
    branch: 'energy',
    name: 'Distribution énergétique',
    seconds: 34,
    energyUse: 12,
    scienceCost: { basicSciencePack: 10, energySciencePack: 8 },
    unlocks: ['réseau électrique avancé', 'diagnostic énergie'],
    prereq: ['construction_foundations'],
    tier: 2
  },
  {
    id: 'advanced_industry',
    branch: 'industry',
    name: 'Industrie avancée',
    seconds: 42,
    energyUse: 16,
    scienceCost: { basicSciencePack: 8, automationSciencePack: 8, industrialSciencePack: 10 },
    unlocks: ['assembleur mécanique', 'chaînes composants'],
    prereq: ['industry_smelting_control', 'automation_routing'],
    tier: 2
  },
  {
    id: 'electronics_processing',
    branch: 'industry',
    name: 'Électronique de contrôle',
    seconds: 46,
    energyUse: 18,
    scienceCost: { automationSciencePack: 8, energySciencePack: 8, industrialSciencePack: 6 },
    unlocks: ['circuits de contrôle', 'microprocesseurs'],
    prereq: ['energy_distribution', 'advanced_industry'],
    tier: 3
  },
  {
    id: 'resource_scanning',
    branch: 'exploration',
    name: 'Scanner de ressources',
    seconds: 40,
    energyUse: 14,
    scienceCost: { basicSciencePack: 8, automationSciencePack: 6, energySciencePack: 6 },
    unlocks: ['détection gisements', 'radar ressources'],
    prereq: ['energy_distribution'],
    tier: 3
  },
  {
    id: 'bio_processing',
    branch: 'biology',
    name: 'Traitement biologique',
    seconds: 52,
    energyUse: 18,
    scienceCost: { basicSciencePack: 8, industrialSciencePack: 6, biologySciencePack: 12 },
    unlocks: ['biocarburants avancés', 'matériaux organiques'],
    prereq: ['advanced_industry'],
    tier: 3
  },
  {
    id: 'defense_turrets',
    branch: 'defense',
    name: 'Tourelles cinétiques',
    seconds: 56,
    energyUse: 20,
    scienceCost: { automationSciencePack: 10, industrialSciencePack: 10, combatSciencePack: 12 },
    unlocks: ['tourelle cinétique', 'radar de base'],
    prereq: ['advanced_industry'],
    tier: 3
  },
  {
    id: 'advanced_research',
    branch: 'industry',
    name: 'Recherche avancée',
    seconds: 70,
    energyUse: 26,
    scienceCost: { automationSciencePack: 12, industrialSciencePack: 12, energySciencePack: 12, advancedSciencePack: 10 },
    unlocks: ['science avancée stable', 'production haut niveau'],
    prereq: ['electronics_processing', 'bio_processing'],
    tier: 4
  },
  {
    id: 'pirate_reverse_engineering',
    branch: 'pirate',
    name: 'Rétro-ingénierie pirate',
    seconds: 78,
    energyUse: 28,
    scienceCost: { industrialSciencePack: 10, combatSciencePack: 10, advancedSciencePack: 12 },
    unlocks: ['brouilleur radar', 'charges de brèche'],
    prereq: ['defense_turrets', 'advanced_research'],
    tier: 4
  },
  {
    id: 'alien_anomaly_analysis',
    branch: 'alien',
    name: 'Analyse d’anomalies',
    seconds: 96,
    energyUse: 36,
    scienceCost: { advancedSciencePack: 14, biologySciencePack: 10, combatSciencePack: 10, anomalySciencePack: 8 },
    unlocks: ['analyse matière étrange', 'technologies précurseurs'],
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
