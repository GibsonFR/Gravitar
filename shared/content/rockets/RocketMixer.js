import { ITEM_CATEGORY_IDS } from '../items/ItemCategoryIds.js';

const ORANGE = { r: 255, g: 182, b: 86 };
const CYAN = { r: 116, g: 224, b: 255 };
const GREEN = { r: 120, g: 242, b: 165 };
const VIOLET = { r: 190, g: 136, b: 255 };
const RED = { r: 255, g: 112, b: 88 };
const WHITE = { r: 235, g: 240, b: 255 };

export const ROCKET_MIX_BASE_INPUT = Object.freeze({
  steelPlate: 5,
  propellant: 3,
  controlCircuit: 1
});

export const ROCKET_BODY_KEYS = Object.freeze([
  'steelPlate',
  'aluminiumIngot',
  'titaniumPlate',
  'carbonFiber',
  'compositeArmor',
  'unknownTechFragment'
]);

export const ROCKET_CHARGE_KEYS = Object.freeze([
  'propellant',
  'refinedFuel',
  'biofuel',
  'sulfur',
  'waterIce',
  'ammoniaIce',
  'lithiumBattery',
  'copperWire',
  'unknownTechFragment'
]);

export const ROCKET_STABILIZER_KEYS = Object.freeze([
  'controlCircuit',
  'microprocessor',
  'servomotor',
  'thermalCeramic',
  'laserLens'
]);

export const ROCKET_MIX_OPTIONAL_KEYS = Object.freeze([
  ...new Set([
    ...ROCKET_BODY_KEYS,
    ...ROCKET_CHARGE_KEYS,
    ...ROCKET_STABILIZER_KEYS,
    'graphite',
    'copperWire',
    'opticalGlass',
    'lithiumBattery'
  ].filter((key) => !(key in ROCKET_MIX_BASE_INPUT)))
]);

export function getRocketMixInputKeys() {
  return [...new Set([...Object.keys(ROCKET_MIX_BASE_INPUT), ...ROCKET_MIX_OPTIONAL_KEYS])];
}

function amountOf(resources, key) {
  return Math.max(0, resources?.[key] | 0);
}

function canPay(resources, cost = {}) {
  return Object.entries(cost || {}).every(([key, amount]) => amountOf(resources, key) >= (amount | 0));
}

function addConsumed(consumed, key, amount) {
  const n = Math.max(0, amount | 0);
  if (n > 0) consumed[key] = (consumed[key] | 0) + n;
}

function addCost(consumed, cost = {}) {
  for (const [key, amount] of Object.entries(cost || {})) addConsumed(consumed, key, amount | 0);
}

function stableHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}

function role(id, name, kind, cost, summary, mods = {}) {
  return { id, name, kind, cost, summary, mods };
}

const BODY_DEFS = Object.freeze([
  role('anomaly', 'Corps anomalique', 'Corps', { steelPlate: 2, unknownTechFragment: 1 }, 'Instable, haut potentiel, pack réduit.', { damage: 12, radius: 10, speed: -0.06, instability: 0.32, tier: 4, pack: -2, tint: VIOLET, tag: 'corps anomalique' }),
  role('composite', 'Corps composite', 'Corps', { steelPlate: 3, carbonFiber: 1 }, 'Léger et solide, vitesse améliorée.', { damage: 3, radius: -4, speed: 0.18, instability: -0.04, tier: 3, tag: 'corps composite' }),
  role('armored', 'Corps lourd titane', 'Corps', { steelPlate: 2, titaniumPlate: 1 }, 'Perforant, dégâts élevés, rayon réduit.', { damage: 10, radius: -10, speed: -0.02, pierce: 1, tier: 3, tag: 'perforant' }),
  role('light', 'Corps léger aluminium', 'Corps', { steelPlate: 2, aluminiumIngot: 3 }, 'Rapide, petit rayon, production plus large.', { damage: -3, radius: -8, speed: 0.28, pack: 2, tier: 2, tag: 'corps léger' }),
  role('standard', 'Corps standard acier', 'Corps', { steelPlate: 5 }, 'Fiable, équilibré.', { tier: 1, tag: 'corps standard' })
]);

const CHARGE_DEFS = Object.freeze([
  role('anomaly', 'Charge anomalique', 'Charge', { propellant: 3, unknownTechFragment: 1 }, 'Explosion instable, puissance élevée.', { damage: 18, radius: 16, instability: 0.42, energy: 7, seconds: 7, tier: 4, effectLabel: 'fissure énergétique', effectType: 'anomaly', effectDuration: 1.2, effectMagnitude: 1, tint: VIOLET, tag: 'charge anomalique' }),
  role('emp', 'Charge IEM', 'Charge', { propellant: 2, lithiumBattery: 1, copperWire: 2 }, 'Désactivation courte, dégâts réduits.', { damage: -5, radius: -4, energy: 3, tier: 3, effectType: 'stun', effectDuration: 0.55, effectMagnitude: 0, effectLabel: 'IEM bref', tint: CYAN, tag: 'IEM' }),
  role('cryo', 'Charge cryogénique', 'Charge', { propellant: 2, waterIce: 1, ammoniaIce: 1 }, 'Ralentissement de zone.', { damage: -2, radius: 7, tier: 2, effectType: 'slow', effectDuration: 2.1, effectMagnitude: 0.36, effectLabel: 'ralentissement 36%', tint: CYAN, tag: 'cryo' }),
  role('incendiary', 'Charge incendiaire', 'Charge', { propellant: 2, biofuel: 2 }, 'Brûlure durable.', { damage: 4, radius: 4, instability: 0.08, tier: 2, effectType: 'burn', effectDuration: 3.4, effectMagnitude: 8, effectLabel: 'brûlure 8/s', tint: RED, tag: 'incendiaire' }),
  role('volatile', 'Charge volatile soufrée', 'Charge', { propellant: 2, sulfur: 2 }, 'Grand rayon, plus instable.', { damage: 3, radius: 20, instability: 0.18, tier: 2, effectLabel: 'surpression', tag: 'volatile' }),
  role('dense', 'Charge explosive raffinée', 'Charge', { propellant: 2, refinedFuel: 2 }, 'Plus de dégâts, moins de rayon.', { damage: 8, radius: -2, tier: 2, effectLabel: 'charge raffinée', tag: 'dense' }),
  role('standard', 'Charge HE standard', 'Charge', { propellant: 3 }, 'Explosion fiable.', { tier: 1, effectLabel: 'explosion standard', tag: 'HE' })
]);

const STABILIZER_DEFS = Object.freeze([
  role('guided', 'Stabilisateur optique', 'Stabilisateur', { microprocessor: 1, laserLens: 1 }, 'Guidage précis, production coûteuse.', { damage: 2, speed: 0.08, instability: -0.10, energy: 3, tier: 4, effectLabel: 'guidage optique', tag: 'guidée' }),
  role('servo', 'Gouvernes servo', 'Stabilisateur', { controlCircuit: 1, servomotor: 1 }, 'Trajectoire plus rapide et stable.', { speed: 0.14, instability: -0.08, tier: 3, effectLabel: 'gouvernes servo', tag: 'servo' }),
  role('thermal', 'Chemisage céramique', 'Stabilisateur', { controlCircuit: 1, thermalCeramic: 1 }, 'Réduit fortement l’instabilité.', { radius: 2, instability: -0.18, tier: 3, effectLabel: 'stabilisée thermique', tag: 'stabilisée' }),
  role('standard', 'Circuit de contrôle', 'Stabilisateur', { controlCircuit: 1 }, 'Détonation standard.', { tier: 1, tag: 'stable' })
]);

function firstAffordable(defs, resources) {
  return defs.find((def) => canPay(resources, def.cost)) || null;
}

function fallbackRole(defs) {
  return defs[defs.length - 1];
}

function resolveCoreParts(resources = {}) {
  const body = firstAffordable(BODY_DEFS, resources);
  const charge = firstAffordable(CHARGE_DEFS, resources);
  const stabilizer = firstAffordable(STABILIZER_DEFS, resources);
  return {
    body,
    charge,
    stabilizer,
    valid: !!body && !!charge && !!stabilizer,
    fallback: {
      body: body || fallbackRole(BODY_DEFS),
      charge: charge || fallbackRole(CHARGE_DEFS),
      stabilizer: stabilizer || fallbackRole(STABILIZER_DEFS)
    }
  };
}

function applyMods(base, mods = {}) {
  base.damage += Number(mods.damage) || 0;
  base.splashRadius += Number(mods.radius) || 0;
  base.speedMult += Number(mods.speed) || 0;
  base.instability += Number(mods.instability) || 0;
  base.energyUse += Number(mods.energy) || 0;
  base.seconds += Number(mods.seconds) || 0;
  base.packSize += Number(mods.pack) || 0;
  base.tier = Math.max(base.tier, mods.tier | 0 || 1);
  if (mods.tint) base.tint = mods.tint;
  if (mods.tag) base.tags.push(mods.tag);
  if (mods.effectLabel) base.effects.push(mods.effectLabel);
  if (mods.effectType) {
    base.effectType = mods.effectType;
    base.effectDuration = Number(mods.effectDuration) || 0;
    base.effectMagnitude = Number(mods.effectMagnitude) || 0;
  }
  if (mods.pierce) base.pierce = Math.max(base.pierce || 0, mods.pierce | 0);
}

function applyExtraAdditives(resources, consumed, base, usedChargeId = '') {
  const additives = [];
  const take = (key, max = 1) => {
    const used = consumed[key] | 0;
    const n = Math.min(max, Math.max(0, amountOf(resources, key) - used));
    if (n > 0) addConsumed(consumed, key, n);
    return n;
  };

  const graphite = take('graphite', 2);
  if (graphite > 0) {
    additives.push({ id: 'graphite', name: 'Graphite dense', amount: graphite, summary: `+${graphite * 5} dégâts, rayon réduit` });
    base.damage += graphite * 5;
    base.splashRadius -= graphite * 3;
    base.tags.push('graphite');
    base.effects.push(`charge dense +${graphite * 5} dégâts`);
    base.tier = Math.max(base.tier, 2);
  }

  const sulfur = usedChargeId === 'volatile' ? 0 : take('sulfur', 1);
  if (sulfur > 0) {
    additives.push({ id: 'sulfur', name: 'Soufre additif', amount: sulfur, summary: '+8 rayon, +instabilité' });
    base.splashRadius += 8;
    base.instability += 0.08;
    base.tags.push('surpression');
    base.effects.push('surpression légère');
    base.tier = Math.max(base.tier, 2);
  }

  const biofuel = usedChargeId === 'incendiary' ? 0 : take('biofuel', 1);
  if (biofuel > 0) {
    additives.push({ id: 'biofuel', name: 'Film incendiaire', amount: biofuel, summary: 'brûlure légère' });
    base.effectType ||= 'burn';
    base.effectDuration = Math.max(base.effectDuration || 0, 2.2);
    base.effectMagnitude = Math.max(base.effectMagnitude || 0, 5);
    base.effects.push('brûlure légère');
    base.tint = RED;
    base.tier = Math.max(base.tier, 2);
  }

  const glass = take('opticalGlass', 1);
  if (glass > 0) {
    additives.push({ id: 'opticalGlass', name: 'Verre optique', amount: glass, summary: '+vitesse, trajectoire propre' });
    base.speedMult += 0.07;
    base.instability -= 0.04;
    base.effects.push('trajectoire lissée');
    base.tier = Math.max(base.tier, 2);
  }

  return additives;
}

export function hasRocketMixBaseInput(resources = {}) {
  return resolveCoreParts(resources).valid;
}

function nameFromParts(body, charge, stabilizer, additives, instability) {
  if (charge.id === 'anomaly' || body.id === 'anomaly') return instability >= 0.45 ? 'Anomalie critiques' : 'Anomalie instables';
  if (charge.id === 'emp') return stabilizer.id === 'guided' ? 'IEM guidées' : 'IEM';
  if (charge.id === 'cryo') return body.id === 'light' ? 'Cryo rapides' : 'Cryo';
  if (charge.id === 'incendiary') return additives.some((a) => a.id === 'graphite') ? 'Incendiaires denses' : 'Incendiaires';
  if (body.id === 'armored') return 'Perforantes';
  if (body.id === 'light') return 'HE rapides';
  if (body.id === 'composite') return 'HE composites';
  if (charge.id === 'volatile') return 'Fragmentaires';
  if (charge.id === 'dense') return 'HE lourdes';
  return 'HE';
}

export function computeRocketMixFromResources(resources = {}) {
  const resolved = resolveCoreParts(resources);
  const body = resolved.body || resolved.fallback.body;
  const charge = resolved.charge || resolved.fallback.charge;
  const stabilizer = resolved.stabilizer || resolved.fallback.stabilizer;
  const valid = resolved.valid;
  const consumed = {};
  if (valid) {
    addCost(consumed, body.cost);
    addCost(consumed, charge.cost);
    addCost(consumed, stabilizer.cost);
  } else {
    addCost(consumed, ROCKET_MIX_BASE_INPUT);
  }

  const base = {
    tags: [],
    effects: [],
    tier: 1,
    damage: 34,
    splashRadius: 92,
    packSize: 10,
    seconds: 14,
    energyUse: 12,
    tint: ORANGE,
    effectType: '',
    effectDuration: 0,
    effectMagnitude: 0,
    instability: 0,
    speedMult: 1,
    pierce: 0
  };

  applyMods(base, body.mods);
  applyMods(base, charge.mods);
  applyMods(base, stabilizer.mods);
  const additives = valid ? applyExtraAdditives(resources, consumed, base, charge.id) : [];

  if (body.id === 'light' && charge.id === 'volatile') base.warnings = ['Corps léger + charge volatile : rayon élevé mais instabilité accrue.'];
  if (charge.id === 'anomaly' && stabilizer.id === 'standard') base.warnings = ['Charge anomalique sans stabilisateur avancé : mélange dangereux.'];

  base.instability = Math.max(0, Math.min(0.95, base.instability));
  base.damage = Math.max(8, Math.round(base.damage));
  base.splashRadius = Math.max(30, Math.round(base.splashRadius));
  base.packSize = Math.max(3, Math.round(base.packSize - (base.instability >= 0.45 ? 2 : 0)));
  base.seconds = Math.max(5, Math.round(base.seconds + base.instability * 10));
  base.energyUse = Math.max(4, Math.round(base.energyUse + Math.max(0, base.tier - 1)));
  base.speedMult = Math.max(0.55, Math.round(base.speedMult * 100) / 100);

  const consumedPairs = Object.entries(consumed).filter(([, amount]) => (amount | 0) > 0).sort(([a], [b]) => a.localeCompare(b));
  const hasOptional = valid && consumedPairs.some(([key]) => !(key in ROCKET_MIX_BASE_INPUT));
  const signature = consumedPairs.map(([key, amount]) => `${key}:${amount}`).join('|');
  const hash = stableHash(`${signature}|${body.id}|${charge.id}|${stabilizer.id}`);
  const id = hasOptional ? `custom-rocket-${hash}` : 'basic-he-rocket-pack';
  const nameCore = valid ? nameFromParts(body, charge, stabilizer, additives, base.instability) : 'HE';
  const name = hasOptional ? `Roquettes ${nameCore}` : 'Roquettes HE';
  const shortName = nameCore.length > 12 ? nameCore.split(' ')[0] : nameCore;
  const summary = base.effects.length ? base.effects.join(' • ') : 'standard';
  const raidKind = charge.id === 'emp'
    ? 'emp'
    : body.id === 'armored' && additives.some((entry) => entry.id === 'graphite')
      ? 'drill'
      : body.id === 'armored'
        ? 'breach'
        : charge.id === 'dense'
          ? 'siege'
          : '';
  const warnings = [
    ...(base.warnings || []),
    ...(!valid ? ['Mix incomplet : ajoute un corps, une charge et un stabilisateur.'] : []),
    ...(base.instability >= 0.35 ? ['Mélange instable : production plus lente, pack réduit ou comportement imprévisible.'] : [])
  ];

  const ammoDef = {
    id,
    name,
    shortName,
    categoryId: ITEM_CATEGORY_IDS.AMMO,
    tier: base.tier,
    priceCredits: Math.max(1, Math.round((70 + base.damage * 3 + base.splashRadius * 0.8 + base.tier * 50) * (1 + base.instability * 0.65))),
    tags: [],
    bonuses: {},
    customRocket: hasOptional,
    rocketMixSignature: signature,
    ammoProfile: {
      packSize: base.packSize,
      damage: base.damage,
      splashRadius: base.splashRadius,
      tint: base.tint,
      effectType: base.effectType || undefined,
      effectDuration: base.effectDuration || undefined,
      effectMagnitude: base.effectMagnitude || undefined,
      instability: Math.round(base.instability * 100) / 100,
      speedMult: base.speedMult,
      pierce: base.pierce || undefined,
      raidKind: raidKind || undefined,
      summary
    },
    description: hasOptional ? 'Roquette expérimentale produite par mixage libre dans l’atelier.' : 'Charge explosive simple et fiable.'
  };

  const roleCards = [body, charge, stabilizer].map((part) => ({
    id: part.id,
    kind: part.kind,
    name: part.name,
    summary: part.summary,
    cost: Object.entries(part.cost || {}).map(([key, amount]) => ({ key, amount }))
  }));

  return {
    id,
    name,
    shortName,
    seconds: base.seconds,
    energyUse: base.energyUse,
    consumedInput: consumed,
    requiredInput: ROCKET_MIX_BASE_INPUT,
    optionalKeys: ROCKET_MIX_OPTIONAL_KEYS,
    hasOptional,
    valid,
    roles: {
      body: roleCards[0],
      charge: roleCards[1],
      stabilizer: roleCards[2],
      additives
    },
    roleCards,
    ammoOutput: { itemId: id, amount: base.packSize },
    ammoDef,
    previewLines: [
      `${base.damage} dégâts`,
      `${base.splashRadius} rayon`,
      `vitesse ×${base.speedMult.toFixed(2)}`,
      base.pierce ? `perforation ${base.pierce}` : '',
      raidKind ? `outil de raid : ${raidKind}` : '',
      summary || 'Explosion standard',
      base.instability > 0 ? `Instabilité ${Math.round(base.instability * 100)}%` : 'Stable'
    ].filter(Boolean),
    warnings
  };
}
