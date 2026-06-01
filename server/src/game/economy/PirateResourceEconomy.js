import { RESOURCE_DEFS, RESOURCE_KEYS_ORDER, getResourceRarityScore } from '../inventory/ResourceDefs.js';

const RAW_COMMON = new Set(['scrap', 'ironOre', 'copper', 'aluminiumOre', 'silicon', 'waterIce', 'sulfur', 'biomass', 'chitin']);
const RAW_RARE = new Set(['nickelOre', 'titaniumOre', 'cobaltOre', 'quartz', 'graphite', 'lithiumOre', 'boronOre', 'berylliumOre', 'rareEarthOre', 'hydrogenIce', 'methaneIce', 'ammoniaIce', 'hydrocarbons', 'uraniumOre', 'thoriumOre', 'unstableIsotopes', 'leadOre', 'organicLipids', 'enzymes', 'proteinFibers', 'spores']);
const REFINED_SIMPLE = new Set(['ironIngot', 'copperIngot', 'aluminiumIngot', 'titaniumPlate', 'steelPlate', 'copperWire', 'siliconWafer', 'opticalGlass', 'refinedFuel', 'biofuel', 'propellant', 'thermalCeramic', 'carbonFiber']);
const INDUSTRIAL = new Set(['microTransistor', 'printedCircuit', 'controlCircuit', 'microprocessor', 'laserLens', 'lithiumBattery', 'fuelCell', 'turbine', 'industrialPump', 'electricMotor', 'servomotor', 'fuelInjector', 'fuelRod', 'compositeArmor', 'logisticDroneBasic']);
const SCIENCE = new Set(['basicSciencePack', 'automationSciencePack', 'industrialSciencePack', 'energySciencePack', 'biologySciencePack', 'combatSciencePack', 'advancedSciencePack', 'anomalySciencePack']);
const ANOMALY = new Set(['containedAntimatter', 'strangeMatter', 'unknownTechFragment', 'ancientSuperconductor', 'precursorNanomaterial']);

const CATEGORY_BASE_VALUE = Object.freeze({
  raw_common: 2,
  raw_rare: 7,
  refined_simple: 18,
  industrial: 46,
  science: 72,
  anomaly: 120,
  legacy: 12
});

const CATEGORY_MIN_VALUE = Object.freeze({
  raw_common: 1,
  raw_rare: 5,
  refined_simple: 14,
  industrial: 34,
  science: 56,
  anomaly: 90,
  legacy: 6
});

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function hashString(str) {
  let h = 2166136261 | 0;
  for (let i = 0; i < String(str || '').length; i += 1) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

export function getResourceEconomicCategory(resourceKey) {
  const key = String(resourceKey || '');
  if (RAW_COMMON.has(key)) return 'raw_common';
  if (RAW_RARE.has(key)) return 'raw_rare';
  if (REFINED_SIMPLE.has(key)) return 'refined_simple';
  if (INDUSTRIAL.has(key)) return 'industrial';
  if (SCIENCE.has(key)) return 'science';
  if (ANOMALY.has(key)) return 'anomaly';
  return RESOURCE_DEFS[key] ? 'legacy' : '';
}

export function getResourceEconomyProfile(resourceKey) {
  const key = String(resourceKey || '');
  const def = RESOURCE_DEFS[key];
  if (!def) return null;

  const category = getResourceEconomicCategory(key);
  const rarity = Math.max(1, getResourceRarityScore(key) || def.rarity || 1);
  const spawnTier = Math.max(1, def.spawnTier | 0 || rarity || 1);
  const base = CATEGORY_BASE_VALUE[category] ?? CATEGORY_BASE_VALUE.legacy;
  const min = CATEGORY_MIN_VALUE[category] ?? CATEGORY_MIN_VALUE.legacy;
  const rarityMult = 1 + Math.max(0, rarity - 1) * 0.32;
  const spawnMult = 1 + Math.max(0, spawnTier - 1) * 0.14;
  const hardnessMult = clamp(Number(def.hardnessMultiplier || 1), 0.75, 1.45);
  const cargoMult = 1 + Math.max(0, (def.cargoPerUnit | 0 || 1) - 1) * 0.18;
  const unitValue = Math.max(min, Math.round(base * rarityMult * spawnMult * hardnessMult * cargoMult));

  return {
    key,
    category,
    rarity,
    spawnTier,
    unitValue
  };
}

export function getResourceEconomicUnitValue(resourceKey) {
  return getResourceEconomyProfile(resourceKey)?.unitValue || 1;
}

export function getPirateResourceSellUnitPrice(resourceKey, pirateTier = 1, stationSeed = 0) {
  const profile = getResourceEconomyProfile(resourceKey);
  if (!profile) return 0;
  const tier = Math.max(1, pirateTier | 0 || 1);
  const localDemandMult = 0.76 + Math.max(0, tier - 1) * 0.055;
  const h = Math.abs((hashString(resourceKey) ^ (stationSeed | 0) ^ 0x3a71c5) | 0);
  const variance = 0.92 + (h % 17) / 100;
  return Math.max(1, Math.round(profile.unitValue * localDemandMult * variance));
}

export function getPirateResourceBuyUnitPrice(resourceKey, pirateTier = 1, stationSeed = 0) {
  const profile = getResourceEconomyProfile(resourceKey);
  if (!profile) return 0;
  const sell = getPirateResourceSellUnitPrice(resourceKey, pirateTier, stationSeed);
  const rarityMargin = 1.55 + Math.max(0, profile.rarity - 1) * 0.11;
  const categoryMargin = profile.category === 'industrial' || profile.category === 'science' || profile.category === 'anomaly' ? 0.18 : 0;
  return Math.max(sell + 1, Math.round(sell * (rarityMargin + categoryMargin)));
}

export function compareResourceEconomicValue(a, b) {
  const av = getResourceEconomicUnitValue(a);
  const bv = getResourceEconomicUnitValue(b);
  if (av !== bv) return bv - av;
  const ar = getResourceEconomyProfile(a)?.rarity || 1;
  const br = getResourceEconomyProfile(b)?.rarity || 1;
  if (ar !== br) return br - ar;
  return String(a || '').localeCompare(String(b || ''));
}

export function listEconomyResourceKeys() {
  return RESOURCE_KEYS_ORDER.filter((key) => !!RESOURCE_DEFS[key] && !!getResourceEconomyProfile(key));
}
