import { ITEM_CATEGORY_IDS } from '../items/ItemCategoryIds.js';

const ORANGE = { r: 255, g: 182, b: 86 };
const CYAN = { r: 116, g: 224, b: 255 };
const GREEN = { r: 120, g: 242, b: 165 };
const VIOLET = { r: 190, g: 136, b: 255 };
const RED = { r: 255, g: 112, b: 88 };

export const ROCKET_MIX_BASE_INPUT = Object.freeze({
  steelPlate: 5,
  propellant: 3,
  controlCircuit: 1
});

export const ROCKET_MIX_OPTIONAL_KEYS = Object.freeze([
  'biofuel',
  'waterIce',
  'ammoniaIce',
  'lithiumBattery',
  'copperWire',
  'graphite',
  'sulfur',
  'titaniumPlate',
  'unknownTechFragment'
]);

export function getRocketMixInputKeys() {
  return [...Object.keys(ROCKET_MIX_BASE_INPUT), ...ROCKET_MIX_OPTIONAL_KEYS];
}

function amountOf(resources, key) {
  return Math.max(0, resources?.[key] | 0);
}

function addConsumed(consumed, key, amount) {
  const n = Math.max(0, amount | 0);
  if (n > 0) consumed[key] = (consumed[key] | 0) + n;
}

function stableHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}

export function hasRocketMixBaseInput(resources = {}) {
  return Object.entries(ROCKET_MIX_BASE_INPUT).every(([key, amount]) => amountOf(resources, key) >= (amount | 0));
}

export function computeRocketMixFromResources(resources = {}) {
  const consumed = {};
  for (const [key, amount] of Object.entries(ROCKET_MIX_BASE_INPUT)) addConsumed(consumed, key, amount | 0);

  const tags = [];
  const effects = [];
  let nameCore = 'HE';
  let shortCore = 'HE';
  let tier = 1;
  let damage = 34;
  let splashRadius = 92;
  let packSize = 10;
  let seconds = 14;
  let energyUse = 12;
  let tint = ORANGE;
  let effectType = '';
  let effectDuration = 0;
  let effectMagnitude = 0;
  let instability = 0;
  let speedMult = 1;

  const biofuel = Math.min(2, amountOf(resources, 'biofuel'));
  if (biofuel > 0) {
    addConsumed(consumed, 'biofuel', biofuel);
    tags.push('incendiary');
    effects.push(`brûlure ${4 + biofuel * 2}/s`);
    nameCore = 'Incendiaires';
    shortCore = 'Inc.';
    tier = Math.max(tier, 2);
    damage += 2 * biofuel;
    effectType = 'burn';
    effectDuration = 2.4 + biofuel * 0.7;
    effectMagnitude = 4 + biofuel * 2;
    instability += biofuel * 0.08;
    tint = RED;
  }

  const cold = Math.min(2, amountOf(resources, 'waterIce') + amountOf(resources, 'ammoniaIce'));
  if (cold > 0) {
    const water = Math.min(amountOf(resources, 'waterIce'), cold);
    const ammonia = Math.max(0, cold - water);
    addConsumed(consumed, 'waterIce', water);
    addConsumed(consumed, 'ammoniaIce', ammonia);
    tags.push('cryo');
    effects.push(`ralentissement ${Math.round((0.26 + cold * 0.07) * 100)}%`);
    nameCore = tags.includes('incendiary') ? 'Thermo-cyro' : 'Cryo';
    shortCore = tags.includes('incendiary') ? 'T-Cryo' : 'Cryo';
    damage -= 2;
    splashRadius += cold * 4;
    tier = Math.max(tier, 2);
    effectType = effectType || 'slow';
    effectDuration = Math.max(effectDuration, 1.5 + cold * 0.45);
    effectMagnitude = Math.max(effectMagnitude, 0.26 + cold * 0.07);
    tint = CYAN;
  }

  if (amountOf(resources, 'lithiumBattery') >= 1 && amountOf(resources, 'copperWire') >= 2) {
    addConsumed(consumed, 'lithiumBattery', 1);
    addConsumed(consumed, 'copperWire', 2);
    tags.push('emp');
    effects.push('IEM bref');
    nameCore = tags.length > 1 ? `${shortCore}-IEM` : 'IEM';
    shortCore = 'IEM';
    damage -= 4;
    splashRadius -= 4;
    tier = Math.max(tier, 3);
    effectType = 'stun';
    effectDuration = 0.45;
    effectMagnitude = 0;
    energyUse += 2;
    tint = CYAN;
  }

  const graphite = Math.min(2, amountOf(resources, 'graphite'));
  if (graphite > 0) {
    addConsumed(consumed, 'graphite', graphite);
    tags.push('dense');
    effects.push(`charge dense +${graphite * 5} dégâts`);
    damage += graphite * 5;
    splashRadius -= graphite * 4;
    tier = Math.max(tier, 2);
  }

  const sulfur = Math.min(2, amountOf(resources, 'sulfur'));
  if (sulfur > 0) {
    addConsumed(consumed, 'sulfur', sulfur);
    tags.push('volatile');
    effects.push(`surpression +${sulfur * 9} rayon`);
    damage += sulfur * 2;
    splashRadius += sulfur * 9;
    instability += sulfur * 0.1;
    tier = Math.max(tier, 2);
  }

  const titanium = Math.min(1, amountOf(resources, 'titaniumPlate'));
  if (titanium > 0) {
    addConsumed(consumed, 'titaniumPlate', titanium);
    tags.push('perforant');
    effects.push('corps perforant');
    damage += 8;
    splashRadius -= 10;
    speedMult += 0.08;
    tier = Math.max(tier, 3);
  }

  const anomaly = Math.min(1, amountOf(resources, 'unknownTechFragment'));
  if (anomaly > 0) {
    addConsumed(consumed, 'unknownTechFragment', anomaly);
    tags.push('anomalie');
    effects.push('charge instable anomalique');
    nameCore = 'Anomalie instables';
    shortCore = 'Anom.';
    damage += 14;
    splashRadius += 12;
    packSize = 6;
    energyUse += 6;
    seconds += 6;
    instability += 0.38;
    tier = Math.max(tier, 4);
    tint = VIOLET;
  }

  damage = Math.max(8, Math.round(damage));
  splashRadius = Math.max(36, Math.round(splashRadius));
  packSize = Math.max(1, Math.round(packSize));
  seconds = Math.max(4, Math.round(seconds + instability * 8));
  energyUse = Math.max(4, Math.round(energyUse + tier - 1));

  const consumedPairs = Object.entries(consumed).filter(([, amount]) => (amount | 0) > 0).sort(([a], [b]) => a.localeCompare(b));
  const hasOptional = consumedPairs.some(([key]) => !(key in ROCKET_MIX_BASE_INPUT));
  const signature = consumedPairs.map(([key, amount]) => `${key}:${amount}`).join('|');
  const id = hasOptional ? `custom-rocket-${stableHash(signature)}` : 'basic-he-rocket-pack';
  const name = hasOptional ? `Roquettes ${nameCore}` : 'Roquettes HE';
  const shortName = hasOptional ? shortCore : 'HE';
  const summary = effects.length ? effects.join(' • ') : 'standard';

  const ammoDef = {
    id,
    name,
    shortName,
    categoryId: ITEM_CATEGORY_IDS.AMMO,
    tier,
    priceCredits: Math.max(1, Math.round((70 + damage * 3 + splashRadius * 0.8 + tier * 50) * (1 + instability * 0.6))),
    tags: [],
    bonuses: {},
    customRocket: hasOptional,
    rocketMixSignature: signature,
    ammoProfile: {
      packSize,
      damage,
      splashRadius,
      tint,
      effectType: effectType || undefined,
      effectDuration: effectDuration || undefined,
      effectMagnitude: effectMagnitude || undefined,
      instability: Math.round(instability * 100) / 100,
      speedMult: Math.round(speedMult * 100) / 100,
      summary
    },
    description: hasOptional ? 'Roquette expérimentale produite par mixage libre dans l’atelier.' : 'Charge explosive simple et fiable.'
  };

  return {
    id,
    name,
    shortName,
    seconds,
    energyUse,
    consumedInput: consumed,
    requiredInput: ROCKET_MIX_BASE_INPUT,
    optionalKeys: ROCKET_MIX_OPTIONAL_KEYS,
    hasOptional,
    ammoOutput: { itemId: id, amount: packSize },
    ammoDef,
    previewLines: [
      `${damage} dégâts`,
      `${splashRadius} rayon`,
      effects.length ? effects.join(' • ') : 'Explosion standard',
      instability > 0 ? `Instabilité ${Math.round(instability * 100)}%` : 'Stable'
    ],
    warnings: instability >= 0.35 ? ['Mélange instable : production plus lente et pack réduit.'] : []
  };
}
