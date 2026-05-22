import { ITEM_CATEGORY_IDS } from './ItemCategoryIds.js';
import { ITEM_TAG_IDS } from './ItemTagIds.js';

export const STARTER_ITEM_IDS = Object.freeze({
  weapon: 'pulse-caster-alpha',
  launcher: 'rack-basic'
});

export const STARTER_AMMO_LOADOUT = Object.freeze({
  inventory: Object.freeze({
    'basic-he-rocket-pack': 12
  }),
  slots: Object.freeze(['basic-he-rocket-pack', '']),
  activeSlot: 0
});

export const PLAYER_EQUIPMENT_RULES = Object.freeze({
  slotCaps: Object.freeze({
    [ITEM_CATEGORY_IDS.WEAPON]: 1,
    [ITEM_CATEGORY_IDS.LAUNCHER]: 1,
    [ITEM_CATEGORY_IDS.DEFENSE]: 1,
    [ITEM_CATEGORY_IDS.ENGINE]: 1,
    [ITEM_CATEGORY_IDS.MODULE]: 3,
    [ITEM_CATEGORY_IDS.CONVERTER]: 2
  }),
  starterCredits: 650
});

const CYAN = Object.freeze({ r: 0, g: 255, b: 255 });
const ORANGE = Object.freeze({ r: 255, g: 200, b: 120 });
const GREEN = Object.freeze({ r: 120, g: 255, b: 170 });

export const ITEM_DEFS = Object.freeze({
  'pulse-caster-alpha': {
    id: 'pulse-caster-alpha',
    shopOffer: false,
    name: 'Pulse Caster Alpha',
    shortName: 'Pulse Alpha',
    categoryId: ITEM_CATEGORY_IDS.WEAPON,
    tier: 1,
    priceCredits: 0,
    tags: [{ tagId: ITEM_TAG_IDS.REAVER, points: 1 }],
    bonuses: {},
    weaponProfile: {
      damage: 12,
      cooldown: 0.70,
      projectileSpeed: 950,
      range: 780,
      energyCost: 2,
      tint: CYAN
    },
    description: 'Arme de base équilibrée. Cycle simple, bonne lisibilité, portée standard.'
  },
  'needle-array-mk1': {
    id: 'needle-array-mk1',
    name: 'Array Needle Mk.I',
    shortName: 'Needle Mk.I',
    categoryId: ITEM_CATEGORY_IDS.WEAPON,
    tier: 1,
    priceCredits: 235,
    tags: [{ tagId: ITEM_TAG_IDS.SURGE, points: 1 }, { tagId: ITEM_TAG_IDS.VERGE, points: 1 }],
    bonuses: { fireRatePct: 0.04 },
    weaponProfile: {
      damage: 10.5,
      cooldown: 0.52,
      projectileSpeed: 1120,
      range: 760,
      energyCost: 2.2,
      tint: GREEN
    },
    description: 'Arme nerveuse à cadence rapide. Moins lourde, mais meilleure pression continue.'
  },
  'lancer-focus-array': {
    id: 'lancer-focus-array',
    name: 'Lancer Focus Array',
    shortName: 'Lancer Focus',
    categoryId: ITEM_CATEGORY_IDS.WEAPON,
    tier: 2,
    priceCredits: 445,
    tags: [{ tagId: ITEM_TAG_IDS.SIEGE, points: 1 }, { tagId: ITEM_TAG_IDS.REAVER, points: 1 }],
    bonuses: { critChancePct: 0.03, armorPenFlat: 6 },
    weaponProfile: {
      damage: 18,
      cooldown: 0.94,
      projectileSpeed: 1080,
      range: 980,
      energyCost: 3.4,
      tint: ORANGE
    },
    description: 'Frappe plus lourde et plus longue portée. Idéale pour les builds de pression.'
  },
  'rack-basic': {
    id: 'rack-basic',
    shopOffer: false,
    name: 'Rack RL-0',
    shortName: 'RL-0',
    categoryId: ITEM_CATEGORY_IDS.LAUNCHER,
    tier: 1,
    priceCredits: 0,
    tags: [{ tagId: ITEM_TAG_IDS.SIEGE, points: 1 }],
    bonuses: {},
    launcherProfile: {
      cooldown: 4.2,
      volley: 1,
      energyCost: 8,
      projectileSpeed: 980,
      range: 1600,
      splashRadius: 92,
      damageMult: 1,
      dispersionDeg: 0,
      tint: ORANGE
    },
    description: 'Lance-roquettes standard. Une salve simple, stable, sans dispersion.'
  },
  'siege-barrage-rack': {
    id: 'siege-barrage-rack',
    name: 'Siege Barrage Rack',
    shortName: 'Barrage Rack',
    categoryId: ITEM_CATEGORY_IDS.LAUNCHER,
    tier: 1,
    priceCredits: 285,
    tags: [{ tagId: ITEM_TAG_IDS.SIEGE, points: 2 }],
    bonuses: { rocketDamagePct: 0.08 },
    launcherProfile: {
      cooldown: 3.8,
      volley: 1,
      energyCost: 7.4,
      projectileSpeed: 1020,
      range: 1680,
      splashRadius: 102,
      damageMult: 1.08,
      dispersionDeg: 0,
      tint: ORANGE
    },
    description: 'Version siège du rack standard : tir plus tendu, plus fréquent, plus propre.'
  },
  'scatterstorm-pod': {
    id: 'scatterstorm-pod',
    name: 'Scatterstorm Pod',
    shortName: 'Scatterstorm',
    categoryId: ITEM_CATEGORY_IDS.LAUNCHER,
    tier: 2,
    priceCredits: 470,
    tags: [{ tagId: ITEM_TAG_IDS.REAVER, points: 1 }, { tagId: ITEM_TAG_IDS.SIEGE, points: 1 }],
    bonuses: { rocketDamagePct: 0.05 },
    launcherProfile: {
      cooldown: 5.3,
      volley: 2,
      energyCost: 11.5,
      projectileSpeed: 930,
      range: 1520,
      splashRadius: 86,
      damageMult: 0.86,
      dispersionDeg: 8,
      tint: ORANGE
    },
    description: 'Pod à double salve. Plus large, plus sale, meilleure saturation à courte-moyenne portée.'
  },
  'basic-he-rocket-pack': {
    id: 'basic-he-rocket-pack',
    shopOffer: false,
    name: 'Roquettes HE',
    shortName: 'HE',
    categoryId: ITEM_CATEGORY_IDS.AMMO,
    tier: 1,
    priceCredits: 92,
    tags: [],
    bonuses: {},
    ammoProfile: {
      packSize: 8,
      damage: 34,
      splashRadius: 92,
      tint: ORANGE,
      summary: 'standard'
    },
    description: 'Charge explosive simple et fiable. Bon profil par défaut pour les racks légers.'
  },
  'cryo-rocket-pack': {
    id: 'cryo-rocket-pack',
    name: 'Roquettes Cryo',
    shortName: 'Cryo',
    categoryId: ITEM_CATEGORY_IDS.AMMO,
    tier: 1,
    priceCredits: 148,
    tags: [],
    bonuses: {},
    ammoProfile: {
      packSize: 6,
      damage: 30,
      splashRadius: 96,
      tint: GREEN,
      effectType: 'slow',
      effectDuration: 1.9,
      effectMagnitude: 0.34,
      summary: 'slow 34% 1.9s'
    },
    description: 'Charge cryogénique qui sacrifie un peu de brut pour ralentir les cibles touchées.'
  },
  'incendiary-rocket-pack': {
    id: 'incendiary-rocket-pack',
    name: 'Roquettes Incendiaires',
    shortName: 'Inc.',
    categoryId: ITEM_CATEGORY_IDS.AMMO,
    tier: 2,
    priceCredits: 220,
    tags: [],
    bonuses: {},
    ammoProfile: {
      packSize: 5,
      damage: 36,
      splashRadius: 90,
      tint: ORANGE,
      effectType: 'burn',
      effectDuration: 3.2,
      effectMagnitude: 5.5,
      summary: 'feu 5.5/s 3.2s'
    },
    description: 'Charge incendiaire à effet de zone. Excellente pour prolonger la pression après impact.'
  },
  'emp-rocket-pack': {
    id: 'emp-rocket-pack',
    name: 'Roquettes IEM',
    shortName: 'IEM',
    categoryId: ITEM_CATEGORY_IDS.AMMO,
    tier: 2,
    priceCredits: 245,
    tags: [],
    bonuses: {},
    ammoProfile: {
      packSize: 4,
      damage: 32,
      splashRadius: 88,
      tint: CYAN,
      effectType: 'stun',
      effectDuration: 0.58,
      effectMagnitude: 0,
      summary: 'stun 0.6s'
    },
    description: 'Charge IEM plus rare. Moins de volume, mais meilleur potentiel d’ouverture sur cible isolée.'
  },
  'compact-shield-array': {
    id: 'compact-shield-array',
    name: 'Réseau de bouclier compact',
    shortName: 'Bouclier compact',
    categoryId: ITEM_CATEGORY_IDS.DEFENSE,
    tier: 1,
    priceCredits: 210,
    tags: [{ tagId: ITEM_TAG_IDS.WARDEN, points: 2 }],
    bonuses: { shieldFlat: 28, hpFlat: 10, armorFlat: 4 },
    description: 'Renforce immédiatement la survie du châssis avec un gain simple et stable.'
  },
  'phase-reactive-plating': {
    id: 'phase-reactive-plating',
    name: 'Blindage réactif de phase',
    shortName: 'Blindage réactif',
    categoryId: ITEM_CATEGORY_IDS.DEFENSE,
    tier: 2,
    priceCredits: 420,
    tags: [{ tagId: ITEM_TAG_IDS.WARDEN, points: 2 }, { tagId: ITEM_TAG_IDS.SIPHON, points: 1 }],
    bonuses: { hpFlat: 36, shieldFlat: 42, hullRegenFlat: 0.35, armorFlat: 12 },
    description: 'Blindage lourd destiné aux sorties longues, avec un léger maintien de coque.'
  },
  'vector-thruster-vanes': {
    id: 'vector-thruster-vanes',
    name: 'Ailettes de poussée vectorielle',
    shortName: 'Ailettes vectorielles',
    categoryId: ITEM_CATEGORY_IDS.ENGINE,
    tier: 1,
    priceCredits: 190,
    tags: [{ tagId: ITEM_TAG_IDS.VERGE, points: 2 }],
    bonuses: { enginePct: 0.11 },
    description: 'Améliore la nervosité générale du vaisseau sans coût énergétique supplémentaire.'
  },
  'surge-flux-injector': {
    id: 'surge-flux-injector',
    name: 'Injecteur de flux Surge',
    shortName: 'Injecteur Surge',
    categoryId: ITEM_CATEGORY_IDS.ENGINE,
    tier: 2,
    priceCredits: 410,
    tags: [{ tagId: ITEM_TAG_IDS.SURGE, points: 1 }, { tagId: ITEM_TAG_IDS.VERGE, points: 2 }],
    bonuses: { enginePct: 0.16, energyFlat: 14, energyRegenFlat: 0.55 },
    description: 'Pack moteur plus agressif, avec une petite réserve d’énergie additionnelle.'
  },
  'reaver-gyro-stabilizer': {
    id: 'reaver-gyro-stabilizer',
    name: 'Gyrostabilisateur Reaver',
    shortName: 'Gyrostabilisateur',
    categoryId: ITEM_CATEGORY_IDS.MODULE,
    tier: 1,
    priceCredits: 240,
    tags: [{ tagId: ITEM_TAG_IDS.REAVER, points: 2 }],
    bonuses: { damageMultPct: 0.09 },
    description: 'Module offensif simple qui augmente le rendement des attaques automatiques et des compétences.'
  },
  'surge-capacitor-bank': {
    id: 'surge-capacitor-bank',
    name: 'Batterie capacitive Surge',
    shortName: 'Batterie Surge',
    categoryId: ITEM_CATEGORY_IDS.MODULE,
    tier: 1,
    priceCredits: 230,
    tags: [{ tagId: ITEM_TAG_IDS.SURGE, points: 2 }],
    bonuses: { energyFlat: 26, energyRegenFlat: 0.7 },
    description: 'Réserve et recharge énergétique pour soutenir les cycles de capacités.'
  },
  'cargo-overmesh': {
    id: 'cargo-overmesh',
    name: 'Maillage de soute extensif',
    shortName: 'Soute extensif',
    categoryId: ITEM_CATEGORY_IDS.MODULE,
    tier: 1,
    priceCredits: 175,
    tags: [{ tagId: ITEM_TAG_IDS.SIEGE, points: 1 }, { tagId: ITEM_TAG_IDS.WARDEN, points: 1 }],
    bonuses: { cargoFlat: 24, hpFlat: 8 },
    description: 'Élargit la capacité de soute tout en ajoutant un peu de structure.'
  },
  'siphon-repair-weave': {
    id: 'siphon-repair-weave',
    name: 'Treillis de réparation Siphon',
    shortName: 'Treillis Siphon',
    categoryId: ITEM_CATEGORY_IDS.MODULE,
    tier: 2,
    priceCredits: 360,
    tags: [{ tagId: ITEM_TAG_IDS.SIPHON, points: 2 }],
    bonuses: { hullRegenFlat: 0.7, hpFlat: 18, lifestealPct: 0.03 },
    description: 'Module de sustain conçu pour lisser l’attrition hors burst.'
  },
  'siege-target-matrix': {
    id: 'siege-target-matrix',
    name: 'Matrice de ciblage Siege',
    shortName: 'Matrice Siege',
    categoryId: ITEM_CATEGORY_IDS.MODULE,
    tier: 2,
    priceCredits: 390,
    tags: [{ tagId: ITEM_TAG_IDS.SIEGE, points: 2 }, { tagId: ITEM_TAG_IDS.REAVER, points: 1 }],
    bonuses: { damageMultPct: 0.13, critChancePct: 0.04, shieldPenPct: 0.08 },
    description: 'Augmente la pression offensive et prépare la branche roquettes.'
  },
  'chrono-loop-relay': {
    id: 'chrono-loop-relay',
    name: 'Relais chrono-loop',
    shortName: 'Relais chrono',
    categoryId: ITEM_CATEGORY_IDS.MODULE,
    tier: 2,
    priceCredits: 405,
    tags: [{ tagId: ITEM_TAG_IDS.SURGE, points: 2 }, { tagId: ITEM_TAG_IDS.VERGE, points: 1 }],
    bonuses: { cooldownReductionPct: 0.08, energyRegenFlat: 0.45, energyFlat: 12 },
    description: 'Relais de cadence qui accélère les cycles de sort sans sacrifier la réserve.'
  },
  'predator-visor-array': {
    id: 'predator-visor-array',
    name: 'Visière Predator',
    shortName: 'Visière Predator',
    categoryId: ITEM_CATEGORY_IDS.MODULE,
    tier: 2,
    priceCredits: 430,
    tags: [{ tagId: ITEM_TAG_IDS.REAVER, points: 2 }, { tagId: ITEM_TAG_IDS.SIEGE, points: 1 }],
    bonuses: { critChancePct: 0.07, damageMultPct: 0.05, armorPenFlat: 8 },
    description: 'Suite d’acquisition agressive qui augmente les coups critiques des autos.'
  },
  'bloodmesh-pump': {
    id: 'bloodmesh-pump',
    name: 'Pompe Bloodmesh',
    shortName: 'Bloodmesh',
    categoryId: ITEM_CATEGORY_IDS.MODULE,
    tier: 2,
    priceCredits: 395,
    tags: [{ tagId: ITEM_TAG_IDS.WARDEN, points: 1 }, { tagId: ITEM_TAG_IDS.SIPHON, points: 2 }],
    bonuses: { lifestealPct: 0.06, hullRegenFlat: 0.35, hpFlat: 14 },
    description: 'Boucle organique qui favorise le vol de vie et la tenue des combats prolongés.'
  },
  'scrap-smelter-loop': {
    id: 'scrap-smelter-loop',
    name: 'Boucle de fusion ferraille',
    shortName: 'Fusion ferraille',
    categoryId: ITEM_CATEGORY_IDS.CONVERTER,
    tier: 1,
    priceCredits: 185,
    tags: [],
    bonuses: {},
    converterProfile: {
      inputKey: 'scrap',
      inputAmount: 6,
      outputKey: 'copper',
      outputAmount: 3,
      seconds: 6,
      energyPerSecond: 1.15
    },
    description: 'Convertit progressivement la ferraille basique en cuivre utile pour la vente.'
  },
  'cryo-refiner-cell': {
    id: 'cryo-refiner-cell',
    name: 'Cellule de raffinage cryo',
    shortName: 'Raffinage cryo',
    categoryId: ITEM_CATEGORY_IDS.CONVERTER,
    tier: 2,
    priceCredits: 335,
    tags: [],
    bonuses: { energyRegenFlat: 0.25 },
    converterProfile: {
      inputKey: 'ice',
      inputAmount: 6,
      outputKey: 'plasmaGel',
      outputAmount: 2,
      seconds: 8,
      energyPerSecond: 1.35
    },
    description: 'Chaîne plus technique qui raffine la glace en hydrogène liquide à bord.'
  }
});


const PROCEDURAL_AFFIXES = Object.freeze({
  frost_edge: {
    id: 'frost_edge',
    prefix: 'Cryo',
    tagId: ITEM_TAG_IDS.VERGE,
    bonusBase: { autoSlowEvery: 4, autoSlowPct: 0.28, autoSlowDuration: 1.45 },
    line: (v) => `Toutes les ${v.autoSlowEvery} autos : ralentit la cible de ${Math.round(v.autoSlowPct * 100)}% pendant ${v.autoSlowDuration.toFixed(1)}s.`
  },
  siphon_cycle: {
    id: 'siphon_cycle',
    prefix: 'Siphon',
    tagId: ITEM_TAG_IDS.SIPHON,
    bonusBase: { autoLifestealEvery: 3, autoLifestealPct: 0.22 },
    line: (v) => `Toutes les ${v.autoLifestealEvery} autos : ${Math.round(v.autoLifestealPct * 100)}% des dégâts rendus en coque.`
  },
  bleed_serration: {
    id: 'bleed_serration',
    prefix: 'Dentelé',
    tagId: ITEM_TAG_IDS.REAVER,
    bonusBase: { autoBleedEvery: 3, autoBleedDuration: 2.6, autoBleedDps: 4.5 },
    line: (v) => `Toutes les ${v.autoBleedEvery} autos : saignement ${v.autoBleedDps.toFixed(1)}/s pendant ${v.autoBleedDuration.toFixed(1)}s.`
  },
  ion_mark: {
    id: 'ion_mark',
    prefix: 'Ionique',
    tagId: ITEM_TAG_IDS.SURGE,
    bonusBase: { autoAmpEvery: 5, autoAmpPct: 0.10, autoAmpDuration: 2.2 },
    line: (v) => `Toutes les ${v.autoAmpEvery} autos : marque la cible, +${Math.round(v.autoAmpPct * 100)}% dégâts subis pendant ${v.autoAmpDuration.toFixed(1)}s.`
  },
  siege_burn: {
    id: 'siege_burn',
    prefix: 'Incendiaire',
    tagId: ITEM_TAG_IDS.SIEGE,
    bonusBase: { autoBurnEvery: 4, autoBurnDuration: 2.4, autoBurnDps: 5.2 },
    line: (v) => `Toutes les ${v.autoBurnEvery} autos : brûlure ${v.autoBurnDps.toFixed(1)}/s pendant ${v.autoBurnDuration.toFixed(1)}s.`
  }
});

function hashString32(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < String(text).length; i += 1) {
    h ^= String(text).charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry01(seed) {
  let t = (seed + 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function clampProc(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scaleProcBonuses(base, tier, seed) {
  const roll = 0.90 + mulberry01(seed) * 0.22;
  const tierScale = 1 + Math.max(0, (tier | 0) - 1) * 0.16;
  const out = { ...base };
  for (const key of Object.keys(out)) {
    if (!Number.isFinite(out[key])) continue;
    if (key.endsWith('Every')) continue;
    if (key.endsWith('Duration')) out[key] = Math.round(out[key] * (0.94 + roll * 0.08) * 10) / 10;
    else out[key] = Math.round(out[key] * roll * tierScale * 1000) / 1000;
  }
  if (out.autoSlowPct != null) out.autoSlowPct = clampProc(out.autoSlowPct, 0.08, 0.55);
  if (out.autoLifestealPct != null) out.autoLifestealPct = clampProc(out.autoLifestealPct, 0.05, 0.45);
  if (out.autoAmpPct != null) out.autoAmpPct = clampProc(out.autoAmpPct, 0.04, 0.22);
  return out;
}

export function makeProceduralItemId(baseId, affixId, seed) {
  return `proc:${String(baseId)}:${String(affixId)}:${Math.abs(seed | 0)}`;
}

function resolveProceduralItemDef(itemId) {
  const raw = String(itemId || '');
  if (!raw.startsWith('proc:')) return null;
  const parts = raw.split(':');
  if (parts.length !== 4) return null;
  const [, baseId, affixId, seedText] = parts;
  const base = ITEM_DEFS[baseId];
  const affix = PROCEDURAL_AFFIXES[affixId];
  if (!base || !affix) return null;

  const seed = (Number.parseInt(seedText, 10) || hashString32(raw)) >>> 0;
  const tier = Math.max(1, base.tier | 0);
  const passiveBonuses = scaleProcBonuses(affix.bonusBase, tier, seed ^ hashString32(baseId));
  const baseBonuses = { ...(base.bonuses ?? {}) };
  const bonusPatch = { ...passiveBonuses };
  for (const [key, value] of Object.entries(passiveBonuses)) {
    if (!Number.isFinite(value)) continue;
    if (key.endsWith('Every') || key.endsWith('Duration')) continue;
    bonusPatch[key] = value;
  }

  const tags = [...(base.tags ?? [])];
  if (affix.tagId) tags.push({ tagId: affix.tagId, points: 1 });

  const suffixRoll = Math.floor(mulberry01(seed ^ 0x9e3779b9) * 900) + 100;
  const shortBase = base.shortName || base.name || base.id;
  const passiveLine = affix.line(passiveBonuses);
  return {
    ...base,
    id: raw,
    procedural: true,
    baseItemId: baseId,
    affixId,
    name: `${affix.prefix} ${base.name}`,
    shortName: `${affix.prefix} ${shortBase}`.slice(0, 26),
    priceCredits: Math.max(1, Math.round((base.priceCredits || 1) * (1.10 + tier * 0.06 + mulberry01(seed ^ 17) * 0.16))),
    tags,
    bonuses: { ...baseBonuses, ...bonusPatch },
    description: `${base.description || ''}\nPassif #${suffixRoll} : ${passiveLine}`.trim()
  };
}

export function listProceduralAffixIdsForCategory(categoryId) {
  switch (categoryId) {
    case ITEM_CATEGORY_IDS.WEAPON:
      return ['frost_edge', 'siphon_cycle', 'bleed_serration', 'ion_mark', 'siege_burn'];
    case ITEM_CATEGORY_IDS.ENGINE:
      return ['frost_edge', 'ion_mark', 'siphon_cycle'];
    case ITEM_CATEGORY_IDS.MODULE:
      return ['siphon_cycle', 'bleed_serration', 'ion_mark', 'siege_burn', 'frost_edge'];
    case ITEM_CATEGORY_IDS.DEFENSE:
      return ['siphon_cycle', 'frost_edge', 'ion_mark'];
    case ITEM_CATEGORY_IDS.LAUNCHER:
      return ['siege_burn', 'ion_mark', 'frost_edge'];
    default:
      return [];
  }
}

export function getItemDef(itemId) {
  const key = String(itemId || '');
  return ITEM_DEFS[key] ?? resolveProceduralItemDef(key) ?? null;
}

export function listItemDefs(options = null) {
  const all = Object.values(ITEM_DEFS);
  if (!options) return all;
  return all.filter((item) => {
    if (options.shopOnly && item.shopOffer === false) return false;
    if (options.categoryId && item.categoryId !== options.categoryId) return false;
    return true;
  });
}
