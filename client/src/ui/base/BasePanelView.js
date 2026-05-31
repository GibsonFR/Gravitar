import { getResearchName, getStructureResearchRequirement, isStructureUnlockedByResearch } from '../../../../shared/content/research/ScienceResearchDefs.js';
const BASE_TILE = 64;
const SECTOR_HALF = 2000;
const BUILD_RANGE = 1200;
const EDGE_RESERVE_TILES = 1;
const EDGE_RESERVE = BASE_TILE * EDGE_RESERVE_TILES;

const RESOURCE_LABELS = {
  scrap: 'Ferraille',
  ironOre: 'Minerai de fer',
  copper: 'Cuivre',
  aluminiumOre: 'Minerai d’aluminium',
  titaniumOre: 'Minerai de titane',
  graphite: 'Graphite',
  quartz: 'Quartz',
  hydrocarbons: 'Hydrocarbures',
  biomass: 'Biomasse',
  organicLipids: 'Lipides organiques',
  waterIce: 'Glace d’eau',
  methaneIce: 'Méthane',
  ammoniaIce: 'Ammoniac',
  sulfur: 'Soufre',
  lithiumOre: 'Minerai de lithium',
  ironIngot: 'Lingot de fer',
  copperIngot: 'Lingot de cuivre',
  aluminiumIngot: 'Lingot d’aluminium',
  steelPlate: 'Plaque d’acier',
  copperWire: 'Fil de cuivre',
  silicon: 'Silicium',
  siliconWafer: 'Wafer de silicium',
  microTransistor: 'Microtransistor',
  printedCircuit: 'Circuit imprimé',
  controlCircuit: 'Circuit de contrôle',
  microprocessor: 'Microprocesseur',
  opticalGlass: 'Verre optique',
  laserLens: 'Lentille laser',
  lithiumBattery: 'Batterie lithium',
  fuelCell: 'Pile à combustible',
  refinedFuel: 'Carburant raffiné',
  biofuel: 'Biocarburant',
  propellant: 'Propergol',
  titaniumPlate: 'Plaque de titane',
  carbonFiber: 'Fibre de carbone',
  compositeArmor: 'Blindage composite',
  servomotor: 'Servomoteur',
  electricMotor: 'Moteur électrique',
  fuelInjector: 'Injecteur carburant',
  thermalCeramic: 'Céramique thermique',
  basicSciencePack: 'Science de base',
  automationSciencePack: 'Science automatisation',
  industrialSciencePack: 'Science industrielle',
  energySciencePack: 'Science énergétique',
  biologySciencePack: 'Science biologique',
  combatSciencePack: 'Science défense',
  advancedSciencePack: 'Science avancée',
  anomalySciencePack: 'Science anomalie'
};

const AUTOMATION_DIRECTIONAL_TYPES = new Set(['conveyor', 'fast_conveyor', 'splitter', 'merger', 'robot_arm', 'fast_arm', 'long_arm']);

function isDirectionalAutomation(type) {
  return AUTOMATION_DIRECTIONAL_TYPES.has(String(type || '').toLowerCase());
}

function iconSvg(kind) {
  if (kind === 'core') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 7l21 12v26L32 57 11 45V19L32 7z" fill="rgba(101,215,255,.12)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="32" r="12" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="32" cy="32" r="4" fill="currentColor" opacity=".85"/><path d="M32 12v8M32 44v8M14 22l7 4M43 38l7 4M14 42l7-4M43 26l7-4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".75"/></svg>`;
  if (kind === 'wall') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="22" width="52" height="20" rx="3" fill="rgba(120,190,255,.12)" stroke="currentColor" stroke-width="3"/><path d="M14 22v20M24 22v20M34 22v20M44 22v20M54 22v20" stroke="currentColor" stroke-width="2" opacity=".72"/><path d="M10 32h44" stroke="currentColor" stroke-width="2" opacity=".45"/></svg>`;
  if (kind === 'door') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="19" width="50" height="26" rx="4" fill="rgba(135,217,255,.12)" stroke="currentColor" stroke-width="3"/><path d="M18 22v20M46 22v20" stroke="currentColor" stroke-width="2.4" opacity=".75"/><path d="M24 32h16M40 32l-5-5M40 32l-5 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (kind === 'equipment_storage') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 16h36v34H14V16z" fill="rgba(139,184,255,.12)" stroke="currentColor" stroke-width="3"/><path d="M22 24h20M22 32h20M22 40h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="45" cy="43" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>`;
  if (kind === 'ammo_storage') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M15 18h34v28H15V18z" fill="rgba(255,193,111,.12)" stroke="currentColor" stroke-width="3"/><path d="M22 39l9-18 9 18M26 33h10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 48h40" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".65"/></svg>`;
  if (kind === 'storage') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M13 21l19-10 19 10v22L32 53 13 43V21z" fill="rgba(111,240,197,.12)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M13 21l19 11 19-11M32 32v21" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".82"/><path d="M22 26l19-10M22 39l20-11" stroke="currentColor" stroke-width="2" opacity=".28"/></svg>`;
  if (kind === 'repair') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M39 12l13 13-7 7-5-5-18 18-10 3 3-10 18-18-5-5 11-3z" fill="rgba(112,240,197,.12)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M18 49h30" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".75"/></svg>`;
  if (kind === 'demolish') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 16h24l-2 34H22L20 16z" fill="rgba(255,120,120,.10)" stroke="currentColor" stroke-width="3"/><path d="M17 16h30M26 16l2-5h8l2 5M27 25v17M37 25v17" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;
  if (kind === 'solar_panel') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="18" width="44" height="28" rx="4" fill="rgba(189,233,146,.13)" stroke="currentColor" stroke-width="3"/><path d="M21 18v28M32 18v28M43 18v28M10 32h44M20 10l-4 5M32 7v7M44 10l4 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".8"/></svg>`;
  if (kind === 'fuel_generator') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="13" y="16" width="38" height="34" rx="5" fill="rgba(255,183,97,.13)" stroke="currentColor" stroke-width="3"/><path d="M25 42c-3-7 5-10 4-18 7 5 10 10 8 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M19 23h8M37 23h8M19 50h26" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".72"/></svg>`;
  if (kind === 'fuel_tank') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 13h24l6 8v30H14V21l6-8z" fill="rgba(255,195,111,.12)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M22 29h20M22 38h20M27 13v-4h10v4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".75"/></svg>`;

if (kind === 'furnace') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="16" width="40" height="36" rx="6" fill="rgba(255,185,96,.13)" stroke="currentColor" stroke-width="3"/><path d="M22 16v-5h20v5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".72"/><path d="M21 40c3-5 4-9 11-15 7 6 8 10 11 15-3 5-8 7-11 7s-8-2-11-7Z" fill="rgba(255,160,74,.18)" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M18 52h28" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" opacity=".68"/></svg>`;
if (kind === 'high_temp_furnace') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="18" width="40" height="34" rx="6" fill="rgba(255,116,86,.13)" stroke="currentColor" stroke-width="3"/><path d="M20 18v-6h7v6M37 18v-6h7v6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".8"/><path d="M22 39c2-5 6-9 10-13 4 4 8 8 10 13-2 5-6 8-10 8s-8-3-10-8Z" fill="rgba(255,116,86,.18)" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M17 52h30" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" opacity=".7"/></svg>`;
if (kind === 'chemical_refinery') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="16" width="14" height="30" rx="5" fill="rgba(150,235,130,.12)" stroke="currentColor" stroke-width="3"/><rect x="36" y="22" width="14" height="24" rx="5" fill="rgba(150,235,130,.09)" stroke="currentColor" stroke-width="3"/><path d="M28 24h8v-6h6M21 16v-5M43 22v-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/><path d="M19 30h4M41 34h4M20 51c5-6 11-6 16 0" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".78"/></svg>`;
if (kind === 'electrolyzer') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="18" width="16" height="28" rx="5" fill="rgba(120,220,255,.12)" stroke="currentColor" stroke-width="3"/><rect x="36" y="18" width="16" height="28" rx="5" fill="rgba(120,220,255,.08)" stroke="currentColor" stroke-width="3"/><path d="M20 12v8M44 12v8M18 32h4M42 30h4M44 28v6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".8"/><path d="M30 22l-5 10h6l-4 10 11-14h-6l4-6" fill="rgba(120,220,255,.16)" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
if (kind === 'electronics_bench') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="11" y="15" width="42" height="34" rx="5" fill="rgba(145,176,255,.12)" stroke="currentColor" stroke-width="3"/><rect x="24" y="25" width="16" height="12" rx="2.5" fill="rgba(145,176,255,.1)" stroke="currentColor" stroke-width="2.6"/><path d="M18 21v6M18 37v6M46 21v6M46 37v6M11 22h7M11 42h7M46 22h7M46 42h7M20 31h4M40 31h4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".78"/></svg>`;
if (kind === 'industrial_converter') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8l18 10v28L32 56 14 46V18L32 8z" fill="rgba(255,140,230,.12)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M22 26h20M22 38h20M28 20l-6 6 6 6M36 32l6 6-6 6" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="32" r="5" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".8"/></svg>`;
if (kind === 'rocket_workshop') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="17" width="40" height="34" rx="6" fill="rgba(255,184,92,.13)" stroke="currentColor" stroke-width="3"/><path d="M23 40l8-20 8 20M27 33h8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M44 20l7 5-7 5M45 34l7 5-7 5M15 52h34" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/></svg>`;
if (kind === 'industrial_press') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="14" width="36" height="8" rx="3" fill="rgba(220,232,242,.12)" stroke="currentColor" stroke-width="3"/><rect x="18" y="42" width="28" height="8" rx="3" fill="rgba(220,232,242,.10)" stroke="currentColor" stroke-width="3"/><path d="M24 22v12M40 22v12M24 34h16M32 34v8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 54h24" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" opacity=".72"/></svg>`;
  if (kind === 'machine') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="11" y="18" width="42" height="32" rx="5" fill="rgba(255,180,110,.12)" stroke="currentColor" stroke-width="3"/><circle cx="25" cy="34" r="7" fill="none" stroke="currentColor" stroke-width="3"/><path d="M37 27h8M37 34h8M37 41h8M18 18v-6h28v6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".72"/></svg>`;
  if (kind === 'mining_extractor') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="18" width="40" height="30" rx="5" fill="rgba(159,220,255,.12)" stroke="currentColor" stroke-width="3"/><path d="M20 48l8-18h8l8 18M24 38h16M32 18v-7M24 12h16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M44 32h9M49 27l6 5-6 5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (kind === 'science_lab') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M24 12v14l-10 18a6 6 0 0 0 5.2 9h25.6A6 6 0 0 0 50 44L40 26V12" fill="rgba(126,220,255,.10)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M22 22h20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".75"/><path d="M24 40c4-3 8-3 12 0 4 3 8 3 12 0" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/><circle cx="30" cy="34" r="2.5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="38" cy="37" r="2.5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`;
  if (kind === 'research_station') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 10l18 10v24L32 54 14 44V20l18-10Z" fill="rgba(181,140,255,.08)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M32 10v44M14 20l18 10 18-10M14 44l18-10 18 10" fill="none" stroke="currentColor" stroke-width="2.2" opacity=".8"/><circle cx="32" cy="32" r="6" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>`;
  if (kind === 'equipment_fabricator') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="18" width="40" height="32" rx="6" fill="rgba(181,140,255,.10)" stroke="currentColor" stroke-width="3"/><path d="M22 34h20M32 24v20M23 45h18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="22" cy="26" r="3" fill="currentColor" opacity=".75"/><circle cx="42" cy="26" r="3" fill="currentColor" opacity=".75"/></svg>`;
  if (kind === 'equipment_rd_station') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="18" width="40" height="32" rx="6" fill="rgba(210,140,255,.10)" stroke="currentColor" stroke-width="3"/><path d="M21 42h22M26 24v12l-5 8M38 24v12l5 8M26 24h12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="40" r="4" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>`;
  if (kind === 'automation') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 34h34" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M38 24l12 10-12 10" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="46" r="4" fill="currentColor" opacity=".65"/><circle cx="32" cy="46" r="4" fill="currentColor" opacity=".65"/></svg>`;
  if (kind === 'conveyor') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="22" width="48" height="20" rx="4" fill="rgba(110,215,255,.12)" stroke="currentColor" stroke-width="3"/><path d="M14 28h36M14 36h36" stroke="currentColor" stroke-width="2" opacity=".35"/><path d="M18 32h22M34 25l8 7-8 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="48" r="3" fill="currentColor" opacity=".5"/><circle cx="32" cy="48" r="3" fill="currentColor" opacity=".5"/><circle cx="46" cy="48" r="3" fill="currentColor" opacity=".5"/></svg>`;
  if (kind === 'fast_conveyor') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="18" width="48" height="28" rx="5" fill="rgba(120,255,255,.10)" stroke="currentColor" stroke-width="3"/><path d="M14 24h36M14 40h36" stroke="currentColor" stroke-width="2.5" opacity=".7"/><path d="M16 32h14M28 25l8 7-8 7M38 25l8 7-8 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (kind === 'splitter') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="22" width="50" height="20" rx="4" fill="rgba(140,232,255,.10)" stroke="currentColor" stroke-width="3"/><path d="M16 32h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M28 32h8l10-10M36 32l10 10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (kind === 'merger') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="22" width="50" height="20" rx="4" fill="rgba(140,232,255,.10)" stroke="currentColor" stroke-width="3"/><path d="M18 22l10 10h8M18 42l10-10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M36 32h12M42 25l8 7-8 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (kind === 'robot_arm') return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="8" fill="rgba(255,210,123,.12)" stroke="currentColor" stroke-width="3"/><path d="M12 32h16M36 32h16M46 25l8 7-8 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 22l8 8M46 42l-8-8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".75"/></svg>`;
  if (kind === 'fast_arm') return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="8" fill="rgba(255,228,140,.12)" stroke="currentColor" stroke-width="3"/><circle cx="32" cy="32" r="15" fill="none" stroke="currentColor" stroke-width="2" opacity=".55"/><path d="M12 32h16M36 32h16M46 25l8 7-8 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (kind === 'long_arm') return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="24" cy="32" r="7" fill="rgba(255,210,123,.12)" stroke="currentColor" stroke-width="3"/><path d="M8 32h10M30 32h24M50 25l8 7-8 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 25l10 7-10 7" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".75"/></svg>`;
  if (kind === 'power') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M35 6L16 36h14l-3 22 21-34H34l1-18z" fill="rgba(255,213,95,.13)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`;
  return '';
}

export const BUILD_STRUCTURES = [
  {
    type: 'base_core',
    category: 'construction',
    title: 'Noyau de base',
    subtitle: '2 × 2 cases',
    icon: 'core',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    claimRadius: BASE_TILE * 8,
    hp: 1200,
    role: 'Définit ta zone de construction.',
    stats: ['Zone : 16 × 16 cases', '1 noyau actif'],
    cost: { scrap: 20, ironOre: 12, copper: 6 }
  },
  {
    type: 'wall',
    category: 'construction',
    title: 'Mur métallique',
    subtitle: '3 × 1 cases',
    icon: 'wall',
    orientation: 'h',
    rotatable: true,
    tilesX: 3,
    tilesY: 1,
    w: 192,
    h: 64,
    hp: 760,
    role: 'Protège la base.',
    stats: [],
    cost: { scrap: 8, ironOre: 6 }
  },

  {
    type: 'door',
    category: 'construction',
    title: 'Porte renforcée',
    subtitle: '3 × 1 cases',
    icon: 'door',
    orientation: 'h',
    rotatable: true,
    tilesX: 3,
    tilesY: 1,
    w: 192,
    h: 64,
    hp: 680,
    role: 'Entrée de base ouvrable.',
    stats: [],
    cost: { scrap: 6, ironOre: 8, copper: 3 }
  },
  {
    type: 'storage',
    category: 'storage',
    title: 'Coffre de ressources',
    subtitle: '',
    icon: 'storage',
    orientation: 'h',
    tilesX: 1,
    tilesY: 1,
    w: 64,
    h: 64,
    hp: 0,
    storageCapacity: 420,
    role: 'Stocke les minerais et matériaux.',
    stats: ['Capacité : 420'],
    cost: { scrap: 10, ironOre: 8, copper: 4 }
  },
  {
    type: 'equipment_storage',
    category: 'storage',
    title: 'Coffre d’équipement',
    subtitle: '',
    icon: 'equipment_storage',
    orientation: 'h',
    tilesX: 1,
    tilesY: 1,
    w: 64,
    h: 64,
    hp: 0,
    itemCapacity: 18,
    role: 'Stocke armes, lance-roquettes et modules.',
    stats: ['Capacité : 18 objets'],
    cost: { ironIngot: 4, copperWire: 4, scrap: 8 }
  },
  {
    type: 'solar_panel',
    category: 'power',
    title: 'Panneau solaire',
    subtitle: '+8 énergie',
    icon: 'solar_panel',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyOutput: 8,
    role: 'Produit une énergie stable sans carburant.',
    stats: ['Production : +8 énergie'],
    cost: { silicon: 8, copper: 6, ironOre: 6 }
  },
  {
    type: 'fuel_generator',
    category: 'power',
    title: 'Générateur thermique',
    subtitle: '+34 énergie',
    icon: 'fuel_generator',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyOutput: 34,
    fuelCapacity: 80,
    role: 'Produit beaucoup d’énergie avec du carburant.',
    stats: ['Production : +34 énergie', 'Stock carburant : 80'],
    cost: { ironIngot: 4, copperWire: 4, steelPlate: 2 }
  },
  {
    type: 'fuel_tank',
    category: 'power',
    title: 'Réservoir carburant',
    subtitle: '240 carburant',
    icon: 'fuel_tank',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    fuelCapacity: 240,
    role: 'Stocke le carburant de la base.',
    stats: ['Capacité : 240 carburant'],
    cost: { ironIngot: 4, copperWire: 2, steelPlate: 1 }
  },

  {
    type: 'science_lab',
    category: 'industry',
    title: 'Laboratoire scientifique',
    subtitle: '',
    icon: 'science_lab',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyUse: 6,
    role: 'Produit les packs de science à partir de composants industriels.',
    stats: ['Machine de production', 'Packs de science'],
    cost: { ironOre: 16, copper: 8, silicon: 6 }
  },
  {
    type: 'research_station',
    category: 'industry',
    title: 'Station de recherche',
    subtitle: '',
    icon: 'research_station',
    tilesX: 3,
    tilesY: 2,
    w: 192,
    h: 128,
    hp: 0,
    energyUse: 8,
    role: 'Consomme les packs de science pour débloquer des technologies.',
    stats: ['Arbre de recherche', 'Packs requis', 'Énergie active'],
    cost: { ironIngot: 4, copper: 10, silicon: 6 }
  },

  {
    type: 'furnace',
    category: 'industry',
    title: 'Four basique',
    subtitle: '2 × 2 cases',
    icon: 'furnace',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyUse: 4,
    role: 'Transforme les minerais communs.',
    stats: ['Consommation : 4 énergie'],
    cost: { scrap: 8, ironOre: 12, copper: 3 }
  },
  {
    type: 'high_temp_furnace',
    category: 'industry',
    title: 'Four haute température',
    subtitle: '2 × 2 cases',
    icon: 'high_temp_furnace',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyUse: 9,
    role: 'Traite quartz, graphite et matériaux durs.',
    stats: ['Consommation : 9 énergie'],
    cost: { ironIngot: 6, copperIngot: 4, graphite: 6 }
  },
  {
    type: 'chemical_refinery',
    category: 'industry',
    title: 'Raffinerie chimique',
    subtitle: '2 × 2 cases',
    icon: 'chemical_refinery',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyUse: 6,
    role: 'Produit carburants et composants chimiques.',
    stats: ['Consommation : 6 énergie'],
    cost: { steelPlate: 2, copperWire: 4, silicon: 4 }
  },
  {
    type: 'electrolyzer',
    category: 'industry',
    title: 'Électrolyseur',
    subtitle: '2 × 2 cases',
    icon: 'electrolyzer',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyUse: 8,
    role: 'Sépare et stabilise les volatils.',
    stats: ['Consommation : 8 énergie'],
    cost: { steelPlate: 2, copperWire: 6, silicon: 6 }
  },
  {
    type: 'electronics_bench',
    category: 'industry',
    title: 'Atelier électronique',
    subtitle: '2 × 2 cases',
    icon: 'electronics_bench',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyUse: 7,
    role: 'Produit wafers, transistors et circuits.',
    stats: ['Consommation : 7 énergie'],
    cost: { steelPlate: 3, copperWire: 8, silicon: 10 }
  },
  {
    type: 'industrial_press',
    category: 'industry',
    title: 'Presse industrielle',
    subtitle: '2 × 2 cases',
    icon: 'industrial_press',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyUse: 10,
    role: 'Assemble pièces mécaniques et blindage.',
    stats: ['Consommation : 10 énergie'],
    cost: { ironIngot: 4, copper: 8, graphite: 4 }
  },
  {
    type: 'industrial_converter',
    category: 'industry',
    title: 'Convertisseur industriel',
    subtitle: '2 × 2 cases',
    icon: 'industrial_converter',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyUse: 10,
    role: 'Convertit les ressources avec les recettes achetées en station pirate.',
    stats: ['Consommation : 10 énergie', 'Recettes pirates uniquement'],
    cost: { steelPlate: 6, copperWire: 10, controlCircuit: 2, titaniumPlate: 1 }
  },
  {
    type: 'rocket_workshop',
    category: 'industry',
    title: 'Atelier de roquettes',
    subtitle: '2 × 2 cases',
    icon: 'rocket_workshop',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyUse: 12,
    role: 'Produit des lots de roquettes HE standards.',
    stats: ['Consommation : 12 énergie', 'Sortie : munitions de roquettes'],
    cost: { steelPlate: 5, propellant: 5, controlCircuit: 1 }
  },
  {
    type: 'equipment_fabricator',
    category: 'industry',
    title: 'Atelier d’équipement',
    subtitle: '',
    icon: 'equipment_fabricator',
    orientation: 'h',
    tilesX: 3,
    tilesY: 2,
    w: 192,
    h: 128,
    hp: 420,
    energyUse: 18,
    role: 'Fabrique des armes, boucliers, propulseurs et modules avancés.',
    stats: ['Consommation : 18 énergie', 'Craft équipement'],
    cost: { steelPlate: 8, microprocessor: 2, controlCircuit: 2, advancedSciencePack: 1 }
  },
  {
    type: 'equipment_rd_station',
    category: 'industry',
    title: 'Station R&D',
    subtitle: '',
    icon: 'equipment_rd_station',
    orientation: 'h',
    tilesX: 3,
    tilesY: 2,
    w: 192,
    h: 128,
    hp: 420,
    energyUse: 24,
    role: 'Améliore des objets neutres avec 1 à 3 sciences.',
    stats: ['Consommation : 24 énergie', 'R&D équipement : 60s'],
    cost: { steelPlate: 10, microprocessor: 3, controlCircuit: 3, advancedSciencePack: 2 }
  },
  {
    type: 'ammo_storage',
    category: 'storage',
    title: 'Coffre de roquettes',
    subtitle: '',
    icon: 'ammo_storage',
    orientation: 'h',
    tilesX: 1,
    tilesY: 1,
    w: 64,
    h: 64,
    hp: 0,
    ammoCapacity: 260,
    role: 'Stocke uniquement les roquettes.',
    stats: ['Capacité : 260 roquettes'],
    cost: { steelPlate: 2, copperWire: 4 }
  }
,

  {
    type: 'mining_extractor',
    category: 'industry',
    title: 'Extracteur minier',
    subtitle: '',
    icon: 'mining_extractor',
    orientation: 'h',
    rotatable: false,
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    storageCapacity: 8,
    role: 'Fore un gisement permanent. Le débit dépend du cycle, du buffer et de l’énergie.',
    stats: ['Pose : sur gisement', 'Sortie : avant', 'Cycle : 2.2 s', 'Énergie : 18', 'Buffer : 8'],
    cost: { steelPlate: 4, copperWire: 8, controlCircuit: 1 }
  },

  {
    type: 'conveyor',
    category: 'automation',
    title: 'Convoyeur',
    subtitle: '',
    icon: 'conveyor',
    orientation: 'r',
    rotatable: true,
    tilesX: 1,
    tilesY: 1,
    w: 64,
    h: 64,
    hp: 0,
    storageCapacity: 1,
    role: 'Déplace les ressources dans son sens.',
    stats: ['Vitesse : normale', 'Buffer : 1'],
    cost: { ironOre: 6, copper: 2 }
  },
  {
    type: 'fast_conveyor',
    category: 'automation',
    title: 'Convoyeur rapide',
    subtitle: '',
    icon: 'fast_conveyor',
    orientation: 'r',
    rotatable: true,
    tilesX: 1,
    tilesY: 1,
    w: 64,
    h: 64,
    hp: 0,
    storageCapacity: 1,
    role: 'Déplace les ressources plus vite.',
    stats: ['Vitesse : rapide', 'Buffer : 1'],
    cost: { ironIngot: 2, copperWire: 2 }
  },
  {
    type: 'splitter',
    category: 'automation',
    title: 'Répartiteur',
    subtitle: '',
    icon: 'splitter',
    orientation: 'r',
    rotatable: true,
    tilesX: 1,
    tilesY: 2,
    w: 64,
    h: 128,
    hp: 0,
    storageCapacity: 1,
    role: 'Une entrée à gauche, deux sorties à droite.',
    stats: ['Entrée : 1', 'Sorties : 2'],
    cost: { ironIngot: 3, copperWire: 2 }
  },
  {
    type: 'merger',
    category: 'automation',
    title: 'Fusionneur',
    subtitle: '',
    icon: 'merger',
    orientation: 'r',
    rotatable: true,
    tilesX: 1,
    tilesY: 2,
    w: 64,
    h: 128,
    hp: 0,
    storageCapacity: 1,
    role: 'Deux entrées à gauche, une sortie à droite.',
    stats: ['Entrées : 2', 'Sortie : 1'],
    cost: { ironIngot: 3, copperWire: 2 }
  },
  {
    type: 'robot_arm',
    category: 'automation',
    title: 'Bras robotique',
    subtitle: '',
    icon: 'robot_arm',
    orientation: 'r',
    rotatable: true,
    tilesX: 1,
    tilesY: 1,
    w: 64,
    h: 64,
    hp: 0,
    role: 'Transfère des ressources entre deux bâtiments adjacents.',
    stats: ['Portée : 1 case', 'Entrée arrière → sortie avant'],
    cost: { ironIngot: 2, copperWire: 2 }
  },
  {
    type: 'fast_arm',
    category: 'automation',
    title: 'Bras rapide',
    subtitle: '',
    icon: 'fast_arm',
    orientation: 'r',
    rotatable: true,
    tilesX: 1,
    tilesY: 1,
    w: 64,
    h: 64,
    hp: 0,
    role: 'Transfert court plus rapide.',
    stats: ['Portée : 1 case', 'Cycle rapide'],
    cost: { steelPlate: 1, copperWire: 3 }
  },
  {
    type: 'long_arm',
    category: 'automation',
    title: 'Bras long',
    subtitle: '',
    icon: 'long_arm',
    orientation: 'r',
    rotatable: true,
    tilesX: 1,
    tilesY: 1,
    w: 64,
    h: 64,
    hp: 0,
    role: 'Transfère par-dessus une case.',
    stats: ['Portée : 2 cases', 'Cycle lent'],
    cost: { steelPlate: 1, copperWire: 3 }
  }];

const BUILD_CATEGORIES = [
  { id: 'construction', label: 'Construction de base', icon: 'core' },
  { id: 'storage', label: 'Stockage', icon: 'storage' },
  { id: 'power', label: 'Énergie', icon: 'power' },
  { id: 'industry', label: 'Industrie', icon: 'machine' },
  { id: 'automation', label: 'Automatisation', icon: 'automation' },
  { id: 'repair', label: 'Réparer', icon: 'repair' },
  { id: 'demolish', label: 'Démolition', icon: 'demolish' }
];

function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function structureDef(type) {
  return BUILD_STRUCTURES.find((s) => s.type === type) || null;
}

function formatCost(cost = {}) {
  const entries = Object.entries(cost || {}).filter(([, v]) => Number(v) > 0);
  if (!entries.length) return 'Aucun coût';
  return entries.map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key] || key}`).join(' · ');
}


function cargoAmount(store, key) {
  const resources = store?.myState?.inv?.resources;
  if (!resources) return 0;
  if (Array.isArray(resources)) return resources.find((entry) => entry?.key === key)?.amount | 0;
  return resources?.[key] | 0;
}

function missingCostEntries(store, cost = {}) {
  return Object.entries(cost || {})
    .filter(([, amount]) => Number(amount) > 0)
    .map(([key, amount]) => ({ key, need: amount | 0, have: cargoAmount(store, key) | 0 }))
    .filter((entry) => entry.have < entry.need);
}

function hasBuildCost(store, cost = {}) {
  return missingCostEntries(store, cost).length === 0;
}

function formatMissingCost(store, cost = {}) {
  const missing = missingCostEntries(store, cost);
  if (!missing.length) return '';
  return missing.map((entry) => `${Math.max(0, entry.need - entry.have)} ${RESOURCE_LABELS[entry.key] || entry.key}`).join(' · ');
}

function formatCostWithStock(store, cost = {}) {
  const entries = Object.entries(cost || {}).filter(([, v]) => Number(v) > 0);
  if (!entries.length) return 'Aucun coût';
  return entries.map(([key, amount]) => {
    const have = cargoAmount(store, key);
    const ok = have >= (amount | 0);
    return `${amount} ${RESOURCE_LABELS[key] || key} (${have}/${amount})${ok ? '' : ' manquant'}`;
  }).join(' · ');
}

const BUILD_PIN_STORAGE_KEY = 'gravitar.buildPins.v1';

function loadBuildPins() {
  try {
    const raw = localStorage.getItem(BUILD_PIN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({ type: String(entry?.type || ''), count: Math.max(1, Math.min(99, entry?.count | 0 || 1)) }))
      .filter((entry) => !!structureDef(entry.type));
  } catch {
    return [];
  }
}

function saveBuildPins(pins = []) {
  try { localStorage.setItem(BUILD_PIN_STORAGE_KEY, JSON.stringify(pins)); } catch {}
}

function aggregatePinCosts(pins = []) {
  const totals = new Map();
  for (const pin of pins) {
    const def = structureDef(pin.type);
    if (!def) continue;
    const count = Math.max(1, pin.count | 0 || 1);
    for (const [key, amount] of Object.entries(def.cost || {})) {
      const n = Math.max(0, amount | 0) * count;
      if (n > 0) totals.set(key, (totals.get(key) || 0) + n);
    }
  }
  return [...totals.entries()].map(([key, amount]) => ({ key, amount })).sort((a, b) => String(RESOURCE_LABELS[a.key] || a.key).localeCompare(String(RESOURCE_LABELS[b.key] || b.key)));
}

function isBuildPinned(pins = [], type = '') {
  return pins.some((pin) => pin.type === type);
}

function renderPinnedCostRows(store, totals = []) {
  if (!totals.length) return '<div class="build-pin-hud__empty">Aucun coût à suivre.</div>';
  return totals.map(({ key, amount }) => {
    const have = cargoAmount(store, key);
    const missing = Math.max(0, (amount | 0) - (have | 0));
    const pct = Math.max(0, Math.min(100, Math.round((have / Math.max(1, amount)) * 100)));
    return `
      <div class="build-pin-hud__res ${missing <= 0 ? 'is-ok' : 'is-missing'}">
        <div class="build-pin-hud__res-top">
          <span>${escapeHtml(RESOURCE_LABELS[key] || key)}</span>
          <b>${Math.min(have, amount)}/${amount}</b>
        </div>
        <div class="build-pin-hud__bar"><span style="width:${pct}%"></span></div>
        <div class="build-pin-hud__missing">${missing > 0 ? `Manque ${missing}` : 'OK'}</div>
      </div>`;
  }).join('');
}

function researchCompletedForStore(store) {
  const overview = store?.myState?.researchOverview;
  const direct = store?.myState?.research;
  if (Array.isArray(overview?.completed)) return overview.completed;
  if (Array.isArray(direct?.completed)) return direct.completed;
  return [];
}

function unlockRequirementForBuild(store, type) {
  const researchId = getStructureResearchRequirement(type);
  if (!researchId) return null;
  const completed = researchCompletedForStore(store);
  if (isStructureUnlockedByResearch(type, completed)) return null;
  return { id: researchId, name: getResearchName(researchId) };
}

function isBuildUnlocked(store, type) {
  return !unlockRequirementForBuild(store, type);
}

function orientationCycle(def, current = 'h') {
  const o = String(current || 'h').toLowerCase();
  if (isDirectionalAutomation(def?.type)) {
    const all = ['r', 'd', 'l', 'u'];
    return all[(all.indexOf(o) + 1 + all.length) % all.length];
  }
  return o === 'v' ? 'h' : 'v';
}

function orientationLabel(o = 'h') {
  const v = String(o || 'h').toLowerCase();
  if (v === 'r' || v === 'h') return 'Droite';
  if (v === 'd' || v === 'v') return 'Bas';
  if (v === 'l') return 'Gauche';
  if (v === 'u') return 'Haut';
  return 'Horizontal';
}

function orientedSize(def, orientation = 'h') {
  const o = String(orientation || 'h').toLowerCase();
  const vertical = (o === 'v' || o === 'u' || o === 'd') && (Number(def?.w) !== Number(def?.h) || Number(def?.tilesX || 0) !== Number(def?.tilesY || 0));
  return {
    w: vertical ? def.h : def.w,
    h: vertical ? def.w : def.h,
    tilesX: vertical ? def.tilesY : def.tilesX,
    tilesY: vertical ? def.tilesX : def.tilesY
  };
}

function snapFootprint(rawX, rawY, size, grid = BASE_TILE) {
  const left = Math.round(((Number(rawX) || 0) - size.w * 0.5) / grid) * grid;
  const top = Math.round(((Number(rawY) || 0) - size.h * 0.5) / grid) * grid;
  return { x: left + size.w * 0.5, y: top + size.h * 0.5 };
}

function rectFor(def, x, y, orientation = 'h') {
  const size = orientedSize(def, orientation);
  return { left: x - size.w * 0.5, right: x + size.w * 0.5, top: y - size.h * 0.5, bottom: y + size.h * 0.5, ...size };
}

function rectsOverlap(a, b, pad = 0) {
  const eps = 0.001;
  return a.left + pad < b.right - eps && a.right - pad > b.left + eps && a.top + pad < b.bottom - eps && a.bottom - pad > b.top + eps;
}

function entityRect(e) {
  const w = Number(e?.w) || (Number(e?.radius) || 0) * 2;
  const h = Number(e?.h) || (Number(e?.radius) || 0) * 2;
  return { left: (e?.x || 0) - w * 0.5, right: (e?.x || 0) + w * 0.5, top: (e?.y || 0) - h * 0.5, bottom: (e?.y || 0) + h * 0.5, w, h };
}

function sameSector(a, b) {
  return (a?.sx | 0) === (b?.sx | 0) && (a?.sy | 0) === (b?.sy | 0);
}

function canPreviewOverlapStructure(def, st) {
  return def?.type === 'mining_extractor' && st?.type === 'resource_deposit';
}

function claimRect(core) {
  const half = Math.max(1, Number(core?.claimRadius) || BASE_TILE * 8);
  return { left: (core?.x || 0) - half, right: (core?.x || 0) + half, top: (core?.y || 0) - half, bottom: (core?.y || 0) + half, w: half * 2, h: half * 2 };
}

function isRectInside(a, b) {
  const eps = 0.001;
  return a.left >= b.left - eps && a.right <= b.right + eps && a.top >= b.top - eps && a.bottom <= b.bottom + eps;
}

function sectorBuildRect() {
  return { left: -SECTOR_HALF + EDGE_RESERVE, right: SECTOR_HALF - EDGE_RESERVE, top: -SECTOR_HALF + EDGE_RESERVE, bottom: SECTOR_HALF - EDGE_RESERVE };
}

function findOwnCore(store, me, rect) {
  let best = null;
  let bestD2 = Infinity;
  for (const st of store?.structures?.values?.() || []) {
    if (st?.type !== 'base_core' || !st.owned || !sameSector(st, me)) continue;
    if (!isRectInside(rect, claimRect(st))) continue;
    const dx = (st.x || 0) - (rect.left + rect.right) * 0.5;
    const dy = (st.y || 0) - (rect.top + rect.bottom) * 0.5;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { best = st; bestD2 = d2; }
  }
  return best;
}

function isProtectedEndlessHub(me) {
  return String(me?.worldId || 'endless') === 'endless' && (me?.sx | 0) === 0 && (me?.sy | 0) === 0;
}

function hasOwnCore(store) {
  for (const st of store?.structures?.values?.() || []) {
    if (st?.type === 'base_core' && st.owned) return true;
  }
  return false;
}

function validatePreview(store, me, def, x, y, orientation) {
  if (!me) return { ok: false, reason: 'Aucun vaisseau actif' };
  const r = rectFor(def, x, y, orientation);
  const dist = Math.hypot(x - (me.x || 0), y - (me.y || 0));
  if (dist > BUILD_RANGE) return { ok: false, reason: 'Trop loin' };
  if (!isRectInside(r, sectorBuildRect())) return { ok: false, reason: 'Bord du secteur' };
  if (isProtectedEndlessHub(me)) return { ok: false, reason: 'Hub protégé : construis hors [0,0]' };

  const ownCore = def.type === 'base_core' ? null : findOwnCore(store, me, r);
  if (def.type === 'base_core') {
    if (hasOwnCore(store)) return { ok: false, reason: 'Noyau déjà posé' };
    const claim = { left: x - (def.claimRadius || 0), right: x + (def.claimRadius || 0), top: y - (def.claimRadius || 0), bottom: y + (def.claimRadius || 0) };
    if (!isRectInside(claim, sectorBuildRect())) return { ok: false, reason: 'Zone trop proche du bord' };
  } else if (!ownCore) {
    return { ok: false, reason: 'Hors base' };
  }

  for (const st of store?.structures?.values?.() || []) {
    if (!sameSector(st, me)) continue;
    if (!rectsOverlap(r, entityRect(st), 0)) continue;
    if (canPreviewOverlapStructure(def, st)) continue;
    return { ok: false, reason: 'Occupé' };
  }
  for (const a of store?.asteroids?.values?.() || []) {
    if (!sameSector(a, me)) continue;
    if (!a.solid && !a.bastionWall) continue;
    if (rectsOverlap(r, entityRect(a), 0)) return { ok: false, reason: 'Obstacle' };
  }
  for (const station of store?.stations?.values?.() || []) {
    if (!sameSector(station, me)) continue;
    const d = Math.hypot((station.x || 0) - x, (station.y || 0) - y);
    if (d < (station.radius || 80) + Math.max(r.w, r.h) * 0.5 + 80) return { ok: false, reason: 'Station proche' };
  }
  if (!hasBuildCost(store, def.cost)) return { ok: false, reason: `Manque : ${formatMissingCost(store, def.cost)}`, ownCore };
  return { ok: true, reason: 'OK', ownCore };
}


function structureHealthRatio(st) {
  const hp = Number(st?.vitals?.hp ?? st?.stats?.hp ?? 0);
  const maxHp = Number(st?.vitals?.maxHp ?? st?.stats?.maxHp ?? 0);
  return { hp, maxHp, damaged: maxHp > 0 && hp > 0 && hp < maxHp };
}

function findRepairableStructureAt(store, me, x, y) {
  let best = null;
  let bestArea = Infinity;
  for (const st of store?.structures?.values?.() || []) {
    if (!st?.owned || !sameSector(st, me)) continue;
    if (st.type === 'base_core') continue;
    const hp = structureHealthRatio(st);
    if (!hp.damaged) continue;
    const r = entityRect(st);
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    const area = Math.max(1, r.w * r.h);
    if (area < bestArea) { best = st; bestArea = area; }
  }
  return best;
}

function findOwnedStructureAt(store, me, x, y) {
  let best = null;
  let bestArea = Infinity;
  for (const st of store?.structures?.values?.() || []) {
    if (!st?.owned || !sameSector(st, me)) continue;
    const r = entityRect(st);
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    const area = Math.max(1, r.w * r.h);
    if (area < bestArea) { best = st; bestArea = area; }
  }
  return best;
}

export class BasePanelView {
  constructor(sendCmd, onPick = null) {
    this.sendCmd = sendCmd;
    this.onPick = typeof onPick === 'function' ? onPick : null;
    this.store = null;
    this.activeBuild = null;
    this.lastPreview = null;
    this.category = 'construction';
    this.hoveredType = null;
    this.pinnedBuilds = loadBuildPins();
    this.pinHud = document.createElement('aside');
    this.pinHud.className = 'build-pin-hud is-hidden';
    document.body.appendChild(this.pinHud);
    this.el = document.createElement('div');
    this.el.className = 'base-panel';
    this.el.innerHTML = `
      <div class="base-panel__head">
        <div>
          <div class="base-panel__eyebrow">Construction</div>
          <div class="base-panel__title">Build</div>
        </div>
        <button class="base-panel__cancel" type="button" title="Annuler">×</button>
      </div>
      <div class="base-panel__body">
        <div class="base-panel__cats"></div>
        <div class="base-panel__content">
          <div class="base-panel__grid"></div>
          <div class="base-panel__status"></div>
        </div>
        <aside class="base-panel__details"></aside>
      </div>
    `;
    this.cats = this.el.querySelector('.base-panel__cats');
    this.grid = this.el.querySelector('.base-panel__grid');
    this.status = this.el.querySelector('.base-panel__status');
    this.details = this.el.querySelector('.base-panel__details');
    this.cancelBtn = this.el.querySelector('.base-panel__cancel');
    this.cats.innerHTML = BUILD_CATEGORIES.map((c) => `
      <button class="base-panel__cat ${c.disabled ? 'is-disabled' : ''}" data-category="${c.id}" title="${escapeHtml(c.disabled ? 'À venir' : c.label)}" ${c.disabled ? 'disabled' : ''}>
        ${iconSvg(c.icon)}<span>${escapeHtml(c.label)}</span>
      </button>
    `).join('');
    this.cats.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-category]');
      if (!btn || btn.disabled) return;
      this.category = btn.dataset.category;
      if (this.category === 'demolish') this.selectDemolish();
      else if (this.category === 'repair') this.selectRepair();
      else {
        this.hoveredType = null;
        this.refresh();
      }
    });
    this.grid.addEventListener('click', (ev) => {
      const pinBtn = ev.target.closest('[data-pin-type]');
      if (pinBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        this.togglePin(pinBtn.dataset.pinType || '');
        return;
      }
      const btn = ev.target.closest('button[data-type]');
      if (!btn) return;
      this.select(btn.dataset.type);
    });
    this.grid.addEventListener('mouseover', (ev) => {
      const btn = ev.target.closest('button[data-type]');
      if (!btn) return;
      this.hoveredType = btn.dataset.type;
      this.renderDetails();
    });
    this.cancelBtn.addEventListener('click', () => this.cancel());
    this.details.addEventListener('click', (ev) => {
      const pinBtn = ev.target.closest('button[data-detail-pin-type]');
      if (!pinBtn) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.togglePin(pinBtn.dataset.detailPinType || '');
    });
    this.pinHud.addEventListener('click', (ev) => this.handlePinHudClick(ev));
    this.refresh();
    this.renderPinHud();
  }

  persistPins() {
    saveBuildPins(this.pinnedBuilds);
    this.renderPinHud();
    this.refresh();
  }

  findPin(type) {
    return this.pinnedBuilds.find((pin) => pin.type === type) || null;
  }

  togglePin(type) {
    if (!structureDef(type)) return;
    const idx = this.pinnedBuilds.findIndex((pin) => pin.type === type);
    if (idx >= 0) this.pinnedBuilds.splice(idx, 1);
    else this.pinnedBuilds.push({ type, count: 1 });
    this.persistPins();
  }

  adjustPin(type, delta) {
    const pin = this.findPin(type);
    if (!pin) return;
    pin.count = Math.max(1, Math.min(99, (pin.count | 0 || 1) + (delta | 0)));
    this.persistPins();
  }

  removePin(type) {
    const before = this.pinnedBuilds.length;
    this.pinnedBuilds = this.pinnedBuilds.filter((pin) => pin.type !== type);
    if (this.pinnedBuilds.length !== before) this.persistPins();
  }

  clearPins() {
    if (!this.pinnedBuilds.length) return;
    this.pinnedBuilds = [];
    this.persistPins();
  }

  handlePinHudClick(ev) {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const act = target.closest('[data-build-pin-act]');
    if (!act) return;
    ev.preventDefault();
    ev.stopPropagation();
    const type = act.dataset.pinType || '';
    const action = act.dataset.buildPinAct || '';
    if (action === 'inc') this.adjustPin(type, 1);
    else if (action === 'dec') this.adjustPin(type, -1);
    else if (action === 'remove') this.removePin(type);
    else if (action === 'clear') this.clearPins();
  }

  renderPinHud() {
    if (!this.pinHud) return;
    const pins = (this.pinnedBuilds || []).filter((pin) => !!structureDef(pin.type));
    this.pinHud.classList.toggle('is-hidden', !pins.length);
    if (!pins.length) {
      this.pinHud.innerHTML = '';
      return;
    }
    const totals = aggregatePinCosts(pins);
    const missingTotal = totals.reduce((sum, entry) => sum + Math.max(0, (entry.amount | 0) - cargoAmount(this.store, entry.key)), 0);
    const ready = missingTotal <= 0;
    const buildRows = pins.map((pin) => {
      const def = structureDef(pin.type);
      const count = Math.max(1, pin.count | 0 || 1);
      return `
        <div class="build-pin-hud__build">
          <div class="build-pin-hud__build-icon">${iconSvg(def.icon)}</div>
          <div class="build-pin-hud__build-main">
            <strong>${escapeHtml(def.title)}</strong>
            <span>${escapeHtml(formatCost(def.cost))}</span>
          </div>
          <div class="build-pin-hud__build-controls">
            <button type="button" data-build-pin-act="dec" data-pin-type="${escapeHtml(pin.type)}">−</button>
            <b>${count}</b>
            <button type="button" data-build-pin-act="inc" data-pin-type="${escapeHtml(pin.type)}">+</button>
            <button type="button" class="is-danger" data-build-pin-act="remove" data-pin-type="${escapeHtml(pin.type)}">×</button>
          </div>
        </div>`;
    }).join('');
    this.pinHud.innerHTML = `
      <div class="build-pin-hud__head">
        <div>
          <div class="build-pin-hud__eyebrow">Objectif construction</div>
          <div class="build-pin-hud__title">${ready ? 'Prêt à construire' : `${missingTotal} ressource${missingTotal > 1 ? 's' : ''} manquante${missingTotal > 1 ? 's' : ''}`}</div>
        </div>
        <button type="button" data-build-pin-act="clear" title="Tout retirer">×</button>
      </div>
      <div class="build-pin-hud__builds">${buildRows}</div>
      <div class="build-pin-hud__resources">${renderPinnedCostRows(this.store, totals)}</div>
    `;
  }

  select(type) {
    const def = structureDef(type);
    if (!def) return;
    const req = unlockRequirementForBuild(this.store, type);
    if (req) {
      this.hoveredType = type;
      this.refresh();
      this.status.textContent = `Recherche requise : ${req.name}`;
      return;
    }
    const prev = this.activeBuild;
    const orientation = prev?.type === type ? prev.orientation : def.orientation;
    this.activeBuild = { mode: 'build', type, orientation };
    this.hoveredType = type;
    this.refresh();
    this.status.textContent = `${def.title} prêt`;
    this.onPick?.();
  }

  selectDemolish() {
    this.activeBuild = { mode: 'demolish' };
    this.refresh();
    this.status.textContent = 'Démolition active';
    this.onPick?.();
  }

  selectRepair() {
    this.activeBuild = { mode: 'repair' };
    this.refresh();
    this.status.textContent = 'Réparation active';
    this.onPick?.();
  }

  cancel() {
    this.activeBuild = null;
    this.lastPreview = null;
    this.refresh();
    this.status.textContent = '';
  }

  rotate() {
    if (!this.activeBuild || this.activeBuild.mode !== 'build') return false;
    const def = structureDef(this.activeBuild.type);
    if (!def?.rotatable) return false;
    this.activeBuild.orientation = orientationCycle(def, this.activeBuild.orientation);
    this.status.textContent = `Orientation : ${orientationLabel(this.activeBuild.orientation)}`;
    return true;
  }

  hasActivePlacement() {
    return !!this.activeBuild;
  }

  getDetailDef() {
    if (this.category === 'demolish' || this.category === 'repair') return null;
    return structureDef(this.hoveredType || this.activeBuild?.type) || BUILD_STRUCTURES.find((s) => s.category === this.category) || null;
  }

  renderDetails() {
    if (this.category === 'repair') {
      this.details.innerHTML = `
        <div class="base-panel__details-icon base-panel__details-icon--repair">${iconSvg('repair')}</div>
        <h3>Réparer</h3>
        <p>Répare une structure endommagée qui t’appartient. Le coût dépend du pourcentage de PV manquants.</p>
        <div class="base-panel__details-section"><strong>Noyau</strong><span>Non réparable : il se régénère seul.</span></div>`;
      return;
    }
    if (this.category === 'demolish') {
      this.details.innerHTML = `
        <div class="base-panel__details-icon base-panel__details-icon--danger">${iconSvg('demolish')}</div>
        <h3>Démolition</h3>
        <p>Retire une structure qui t’appartient. Les retours de matériaux seront ajoutés plus tard.</p>
        <div class="base-panel__details-section"><strong>Utilisation</strong><span>Clique une structure dans le monde.</span></div>`;
      return;
    }
    const def = this.getDetailDef();
    if (!def) {
      this.details.innerHTML = `<h3>À venir</h3><p>Cette catégorie sera remplie dans une prochaine update.</p>`;
      return;
    }
    const previewOrientation = this.activeBuild?.type === def.type ? (this.activeBuild.orientation || def.orientation || 'h') : (def.orientation || 'h');
    const size = orientedSize(def, previewOrientation);
    const sections = [
      `<div class="base-panel__details-section"><strong>Taille</strong><span>${size.tilesX} × ${size.tilesY} cases</span></div>`
    ];
    if (def.storageCapacity) sections.push(`<div class="base-panel__details-section"><strong>Capacité</strong><span>${def.storageCapacity} unités</span></div>`);
    if (def.itemCapacity) sections.push(`<div class="base-panel__details-section"><strong>Capacité</strong><span>${def.itemCapacity} objets</span></div>`);
    if (def.ammoCapacity) sections.push(`<div class="base-panel__details-section"><strong>Capacité</strong><span>${def.ammoCapacity} roquettes</span></div>`);
    if (def.fuelCapacity) sections.push(`<div class="base-panel__details-section"><strong>Carburant</strong><span>${def.fuelCapacity} unités</span></div>`);
    if (def.energyOutput) sections.push(`<div class="base-panel__details-section"><strong>Énergie</strong><span>+${def.energyOutput}</span></div>`);
    if (def.hp) sections.push(`<div class="base-panel__details-section"><strong>Résistance</strong><span>${def.hp} PV</span></div>`);
    const requirement = unlockRequirementForBuild(this.store, def.type);
    if (requirement) sections.unshift(`<div class="base-panel__details-section is-locked"><strong>Recherche requise</strong><span>${escapeHtml(requirement.name)}</span></div>`);
    sections.push(`<div class="base-panel__details-section ${hasBuildCost(this.store, def.cost) ? '' : 'is-locked'}"><strong>Coût</strong><span>${escapeHtml(formatCostWithStock(this.store, def.cost))}</span></div>`);
    this.details.innerHTML = `
      <div class="base-panel__details-icon base-panel__details-icon--${escapeHtml(def.icon)}">${iconSvg(def.icon)}</div>
      <h3>${escapeHtml(def.title)}</h3>
      <p>${escapeHtml(def.role || def.subtitle || '')}</p>
      <button class="base-panel__pin-detail ${isBuildPinned(this.pinnedBuilds, def.type) ? 'is-pinned' : ''}" type="button" data-detail-pin-type="${escapeHtml(def.type)}">${isBuildPinned(this.pinnedBuilds, def.type) ? 'Retirer de l’objectif' : '📌 Suivre cette construction'}</button>
      ${sections.join('')}`;
  }

  refresh() {
    const activeType = this.activeBuild?.type || '';
    const activeMode = this.activeBuild?.mode || '';
    for (const btn of this.cats.querySelectorAll('button[data-category]')) {
      btn.classList.toggle('is-active', btn.dataset.category === this.category || (activeMode === 'demolish' && btn.dataset.category === 'demolish') || (activeMode === 'repair' && btn.dataset.category === 'repair'));
    }
    if (this.category === 'repair') {
      this.grid.innerHTML = `
        <button class="base-panel__btn base-panel__btn--wide ${activeMode === 'repair' ? 'is-active' : ''}" data-repair="1" type="button">
          <span class="base-panel__icon">${iconSvg('repair')}</span>
          <span class="base-panel__meta"><strong>Réparer</strong><small>Structure endommagée</small></span>
        </button>`;
      this.grid.querySelector('[data-repair]')?.addEventListener('click', () => this.selectRepair());
    } else if (this.category === 'demolish') {
      this.grid.innerHTML = `
        <button class="base-panel__btn base-panel__btn--wide ${activeMode === 'demolish' ? 'is-active' : ''}" data-demolish="1" type="button">
          <span class="base-panel__icon">${iconSvg('demolish')}</span>
          <span class="base-panel__meta"><strong>Démolir</strong><small>Retirer une structure</small></span>
        </button>`;
      this.grid.querySelector('[data-demolish]')?.addEventListener('click', () => this.selectDemolish());
    } else {
      this.grid.innerHTML = BUILD_STRUCTURES
        .filter((s) => s.category === this.category)
        .map((s) => {
          const req = unlockRequirementForBuild(this.store, s.type);
          const locked = !!req;
          const pinned = isBuildPinned(this.pinnedBuilds, s.type);
          return `
          <button class="base-panel__btn ${s.type === activeType ? 'is-active' : ''} ${locked ? 'is-locked' : ''} ${pinned ? 'is-pinned' : ''}" data-type="${s.type}" type="button" title="${locked ? `Requiert : ${escapeHtml(req.name)}` : ''}">
            <span class="base-panel__pin-btn ${pinned ? 'is-pinned' : ''}" data-pin-type="${escapeHtml(s.type)}" title="${pinned ? 'Retirer de l’objectif' : 'Suivre les ressources'}">📌</span>
            <span class="base-panel__icon base-panel__icon--${escapeHtml(s.icon)}">${iconSvg(s.icon)}</span>
            <span class="base-panel__meta">
              <strong>${escapeHtml(s.title)}</strong>
              ${locked ? `<small>Requiert : ${escapeHtml(req.name)}</small>` : ''}
            </span>
          </button>`;
        }).join('');
    }
    this.cancelBtn.classList.toggle('is-visible', !!this.activeBuild);
    this.renderDetails();
  }

  getPreview(store, mouseWorld) {
    this.store = store || this.store;
    if (!this.activeBuild || !mouseWorld) return null;
    const me = this.store?.getMe?.();
    if (this.activeBuild.mode === 'repair') {
      const target = findRepairableStructureAt(this.store, me, mouseWorld.x, mouseWorld.y);
      const hp = structureHealthRatio(target);
      this.lastPreview = {
        mode: 'repair',
        targetId: target?.id || 0,
        type: target?.type || 'repair',
        title: target ? `Réparer ${target.name || 'structure'}` : 'Réparation',
        reason: target ? `${Math.ceil(hp.maxHp - hp.hp)} PV manquants` : 'Aucune structure endommagée',
        ok: !!target,
        x: target?.x ?? mouseWorld.x,
        y: target?.y ?? mouseWorld.y,
        sx: me?.sx | 0,
        sy: me?.sy | 0,
        w: target?.w || BASE_TILE,
        h: target?.h || BASE_TILE,
        tilesX: Math.max(1, Math.round((target?.w || BASE_TILE) / BASE_TILE)),
        tilesY: Math.max(1, Math.round((target?.h || BASE_TILE) / BASE_TILE)),
        gridSize: BASE_TILE
      };
      return this.lastPreview;
    }
    if (this.activeBuild.mode === 'demolish') {
      const target = findOwnedStructureAt(this.store, me, mouseWorld.x, mouseWorld.y);
      this.lastPreview = {
        mode: 'demolish',
        targetId: target?.id || 0,
        type: target?.type || 'demolish',
        title: target ? `Démolir ${target.name || 'structure'}` : 'Démolition',
        reason: target ? 'OK' : 'Aucune structure',
        ok: !!target,
        x: target?.x ?? mouseWorld.x,
        y: target?.y ?? mouseWorld.y,
        sx: me?.sx | 0,
        sy: me?.sy | 0,
        w: target?.w || BASE_TILE,
        h: target?.h || BASE_TILE,
        tilesX: Math.max(1, Math.round((target?.w || BASE_TILE) / BASE_TILE)),
        tilesY: Math.max(1, Math.round((target?.h || BASE_TILE) / BASE_TILE)),
        gridSize: BASE_TILE
      };
      return this.lastPreview;
    }
    const def = structureDef(this.activeBuild.type);
    if (!def) return null;
    const requirement = unlockRequirementForBuild(this.store, def.type);
    if (requirement) {
      this.lastPreview = {
        mode: 'build',
        type: def.type,
        title: def.title,
        reason: `Recherche requise : ${requirement.name}`,
        ok: false,
        x: mouseWorld.x,
        y: mouseWorld.y,
        sx: me?.sx | 0,
        sy: me?.sy | 0,
        w: def.w || BASE_TILE,
        h: def.h || BASE_TILE,
        tilesX: def.tilesX || 1,
        tilesY: def.tilesY || 1,
        gridSize: BASE_TILE
      };
      return this.lastPreview;
    }
    const orientation = this.activeBuild.orientation || 'h';
    const size = orientedSize(def, orientation);
    const snapped = snapFootprint(mouseWorld.x, mouseWorld.y, size, BASE_TILE);
    const rect = rectFor(def, snapped.x, snapped.y, orientation);
    const validation = validatePreview(this.store, me, def, snapped.x, snapped.y, orientation);
    this.lastPreview = {
      mode: 'build',
      type: def.type,
      title: def.title,
      x: snapped.x,
      y: snapped.y,
      sx: me?.sx | 0,
      sy: me?.sy | 0,
      w: rect.w,
      h: rect.h,
      tilesX: rect.tilesX,
      tilesY: rect.tilesY,
      gridSize: BASE_TILE,
      buildRange: BUILD_RANGE,
      radius: Math.max(rect.w, rect.h) * 0.5,
      orientation,
      claimRadius: def.claimRadius || 0,
      extractionRange: def.type === 'mining_extractor' ? (def.extractionRange || BASE_TILE * 5) : 0,
      ok: validation.ok,
      reason: validation.reason,
      ownCore: validation.ownCore ? { x: validation.ownCore.x, y: validation.ownCore.y, claimRadius: validation.ownCore.claimRadius || BASE_TILE * 8 } : null
    };
    return this.lastPreview;
  }

  placeCurrent(store, mouseWorld) {
    const preview = this.getPreview(store, mouseWorld);
    if (!preview) return false;
    if (!preview.ok) {
      this.status.textContent = preview.reason || 'Impossible';
      return false;
    }
    if (preview.mode === 'repair') {
      this.sendCmd('repair_structure', { structureId: preview.targetId });
      this.status.textContent = 'Réparation envoyée';
      return true;
    }
    if (preview.mode === 'demolish') {
      this.sendCmd('remove_structure', { structureId: preview.targetId });
      this.status.textContent = 'Démolition envoyée';
      return true;
    }
    this.sendCmd('build_structure', { structureType: preview.type, orientation: preview.orientation, x: preview.x, y: preview.y });
    this.status.textContent = 'Placement envoyé';
    return true;
  }

  update(store) {
    this.store = store;
    this.renderPinHud();
    if (this.activeBuild && this.lastPreview) {
      this.status.textContent = this.lastPreview.ok ? this.lastPreview.title : this.lastPreview.reason;
      return;
    }
    this.status.textContent = '';
  }
}
