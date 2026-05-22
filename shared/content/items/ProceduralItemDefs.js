import { ITEM_CATEGORY_IDS } from './ItemCategoryIds.js';
import { ITEM_TAG_IDS } from './ItemTagIds.js';
import { STATUS_EFFECT_IDS as S } from '../status/StatusEffectIds.js';

const CYAN = Object.freeze({ r: 0, g: 240, b: 255 });
const ORANGE = Object.freeze({ r: 255, g: 190, b: 105 });
const GREEN = Object.freeze({ r: 120, g: 255, b: 170 });
const VIOLET = Object.freeze({ r: 190, g: 135, b: 255 });
const RED = Object.freeze({ r: 255, g: 92, b: 92 });
const GOLD = Object.freeze({ r: 255, g: 215, b: 110 });

const TAGS = [
  ITEM_TAG_IDS.REAVER,
  ITEM_TAG_IDS.WARDEN,
  ITEM_TAG_IDS.SURGE,
  ITEM_TAG_IDS.VERGE,
  ITEM_TAG_IDS.SIEGE,
  ITEM_TAG_IDS.SIPHON
];

const COLORS = [CYAN, ORANGE, GREEN, VIOLET, RED, GOLD];

const CONVERTER_PAIRS = Object.freeze([
  ['scrap', 8, 'copper', 4],
  ['ice', 7, 'plasmaGel', 2],
  ['copper', 6, 'circuit', 2],
  ['silicon', 5, 'nanoDust', 3],
  ['ironVein', 7, 'alloy', 2],
  ['basaltChunk', 8, 'flux', 2],
  ['sulfurStone', 7, 'phosphorite', 3],
  ['carbonMesh', 5, 'grapheneVeil', 2],
  ['quartzBloom', 4, 'crystal', 2],
  ['lithiumSalt', 5, 'plasmaGel', 1],
  ['cobaltOre', 5, 'palladiumDust', 1],
  ['titaniumOre', 4, 'hafniumPlate', 1],
  ['argonIce', 5, 'xenonPearl', 1],
  ['rutileShard', 4, 'galliumBloom', 1],
  ['vanadiumGlass', 4, 'phaseQuartz', 1],
  ['voidAmber', 3, 'darkMatter', 1]
]);

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function pct(v) {
  return `${Math.round(v * 100)}%`;
}

function cleanId(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function tagPair(seed) {
  const a = TAGS[seed % TAGS.length];
  const b = TAGS[(seed * 3 + 2) % TAGS.length];
  return a === b ? [{ tagId: a, points: 2 }] : [{ tagId: a, points: 1 }, { tagId: b, points: 1 }];
}

function tierPrice(categoryId, tier, index) {
  const baseByCategory = {
    [ITEM_CATEGORY_IDS.WEAPON]: 260,
    [ITEM_CATEGORY_IDS.LAUNCHER]: 290,
    [ITEM_CATEGORY_IDS.DEFENSE]: 240,
    [ITEM_CATEGORY_IDS.ENGINE]: 225,
    [ITEM_CATEGORY_IDS.MODULE]: 210,
    [ITEM_CATEGORY_IDS.AMMO]: 110,
    [ITEM_CATEGORY_IDS.CONVERTER]: 205
  };
  return Math.round((baseByCategory[categoryId] || 220) * (1 + (tier - 1) * 0.82) + (index % 9) * 17);
}

function statPatchFor(categoryId, tier, index) {
  const s = 1 + (tier - 1) * 0.46;
  const variant = index % 8;
  if (categoryId === ITEM_CATEGORY_IDS.AMMO || categoryId === ITEM_CATEGORY_IDS.CONVERTER) return {};
  if (categoryId === ITEM_CATEGORY_IDS.WEAPON) {
    return [
      { damageMultPct: 0.04 * s },
      { fireRatePct: 0.035 * s },
      { critChancePct: 0.025 * s },
      { autoRangePct: 0.035 * s },
      { armorPenFlat: Math.round(4 * s) },
      { shieldPenPct: 0.025 * s },
      { damageMultPct: 0.025 * s, fireRatePct: 0.02 * s },
      { critDamagePct: 0.08 * s }
    ][variant];
  }
  if (categoryId === ITEM_CATEGORY_IDS.LAUNCHER) {
    return [
      { rocketDamagePct: 0.06 * s },
      { cooldownReductionPct: 0.035 * s },
      { energyFlat: Math.round(8 * s) },
      { shieldPenPct: 0.025 * s },
      { rocketDamagePct: 0.035 * s, energyRegenFlat: 0.18 * s },
      { armorPenFlat: Math.round(5 * s) },
      { damageMultPct: 0.025 * s },
      { autoRangePct: 0.025 * s }
    ][variant];
  }
  if (categoryId === ITEM_CATEGORY_IDS.DEFENSE) {
    return [
      { hpFlat: Math.round(18 * s), armorFlat: Math.round(4 * s) },
      { shieldFlat: Math.round(26 * s) },
      { hpPct: 0.045 * s },
      { hullRegenFlat: 0.28 * s },
      { armorFlat: Math.round(8 * s) },
      { shieldFlat: Math.round(14 * s), energyFlat: Math.round(7 * s) },
      { hpFlat: Math.round(10 * s), shieldFlat: Math.round(16 * s) },
      { healPowerPct: 0.05 * s }
    ][variant];
  }
  if (categoryId === ITEM_CATEGORY_IDS.ENGINE) {
    return [
      { enginePct: 0.07 * s },
      { energyRegenFlat: 0.32 * s },
      { energyFlat: Math.round(18 * s) },
      { cooldownReductionPct: 0.04 * s },
      { enginePct: 0.04 * s, energyRegenPct: 0.05 * s },
      { autoRangePct: 0.04 * s },
      { fireRatePct: 0.025 * s },
      { energyFlat: Math.round(9 * s), energyRegenFlat: 0.18 * s }
    ][variant];
  }
  return [
    { damageMultPct: 0.035 * s },
    { lifestealPct: 0.025 * s },
    { cooldownReductionPct: 0.035 * s },
    { energyRegenFlat: 0.26 * s },
    { critChancePct: 0.025 * s },
    { shieldPenPct: 0.025 * s },
    { hullRegenFlat: 0.22 * s, hpFlat: Math.round(8 * s) },
    { cargoFlat: Math.round(16 * s) }
  ][variant];
}

const PROC_TEMPLATES = Object.freeze([
  {
    key: 'frost_auto', label: 'Cryo-auto', trigger: 'autoHit', every: 3,
    text: (v) => `Toutes les ${v.every} autos : slow ${pct(v.value)} pendant ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'target', effectId: S.SLOW, duration: 1.25 + tier * 0.18, value: 0.20 + tier * 0.035, label: 'Item' }]
  },
  {
    key: 'sear_auto', label: 'Auto incendiaire', trigger: 'autoHit', every: 4,
    text: (v) => `Toutes les ${v.every} autos : burn ${v.periodicDamage.toFixed(1)}/s pendant ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'target', effectId: S.BURN, duration: 2.2 + tier * 0.35, periodicDamage: 3.2 + tier * 1.15, tickEvery: 1, label: 'Item' }]
  },
  {
    key: 'hemorrhage_auto', label: 'Auto hémorragique', trigger: 'autoHit', every: 5,
    text: (v) => `Toutes les ${v.every} autos : bleed ${v.periodicDamage.toFixed(1)}/s pendant ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'target', effectId: S.BLEED, duration: 2.5 + tier * 0.4, periodicDamage: 3.5 + tier * 1.35, tickEvery: 1, maxStacks: 3, label: 'Item' }]
  },
  {
    key: 'venom_auto', label: 'Auto toxique', trigger: 'autoHit', every: 4,
    text: (v) => `Toutes les ${v.every} autos : poison ${v.periodicDamage.toFixed(1)}/s pendant ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'target', effectId: S.POISON, duration: 3.0 + tier * 0.45, periodicDamage: 2.8 + tier * 1.1, tickEvery: 1, maxStacks: 4, label: 'Item' }]
  },
  {
    key: 'vamp_auto', label: 'Pompe vampirique', trigger: 'autoHit', every: 3,
    text: (v) => `Toutes les ${v.every} autos : soigne ${pct(v.ratioOfDamage)} des dégâts infligés.`,
    build: (tier) => [{ type: 'heal', target: 'self', ratioOfDamage: 0.18 + tier * 0.04, label: 'Item' }]
  },
  {
    key: 'shield_auto', label: 'Batterie au contact', trigger: 'autoHit', every: 4,
    text: (v) => `Toutes les ${v.every} autos : rend ${Math.round(v.flat)} bouclier.`,
    build: (tier) => [{ type: 'shield', target: 'self', flat: 10 + tier * 5, label: 'Item' }]
  },
  {
    key: 'energy_auto', label: 'Condensateur cinétique', trigger: 'autoHit', every: 3,
    text: (v) => `Toutes les ${v.every} autos : rend ${Math.round(v.flat)} énergie.`,
    build: (tier) => [{ type: 'energy', target: 'self', flat: 5 + tier * 2, label: 'Item' }]
  },
  {
    key: 'armor_shred_auto', label: 'Foreuse de blindage', trigger: 'autoHit', every: 4,
    text: (v) => `Toutes les ${v.every} autos : armor shred ${pct(v.value)} pendant ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'target', effectId: S.ARMOR_SHRED, duration: 2.2 + tier * 0.25, value: 0.10 + tier * 0.03, label: 'Item' }]
  },
  {
    key: 'shield_break_auto', label: 'Briseur de bouclier', trigger: 'autoHit', every: 4,
    text: (v) => `Toutes les ${v.every} autos : anti-shield ${pct(v.value)} pendant ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'target', effectId: S.ANTI_SHIELD, duration: 2.0 + tier * 0.22, value: 0.13 + tier * 0.035, label: 'Item' }]
  },
  {
    key: 'execution_mark', label: 'Marque d’exécution', trigger: 'hitAny', every: 5,
    text: (v) => `Toutes les ${v.every} touches : damage amp ${pct(v.value)} pendant ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'target', effectId: S.DAMAGE_AMP, duration: 2.0 + tier * 0.25, value: 0.08 + tier * 0.025, label: 'Item' }]
  },
  {
    key: 'grievous_hit', label: 'Plaie anti-soin', trigger: 'hitAny', every: 4,
    text: (v) => `Toutes les ${v.every} touches : heal cut ${pct(v.value)} pendant ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'target', effectId: S.HEAL_CUT, duration: 2.3 + tier * 0.3, value: 0.28 + tier * 0.04, label: 'Item' }]
  },
  {
    key: 'ground_ability', label: 'Ancre de phase', trigger: 'abilityHit', every: 2,
    text: (v) => `Toutes les ${v.every} compétences touchées : grounded ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'target', effectId: S.GROUNDED, duration: 0.65 + tier * 0.12, label: 'Item' }]
  },
  {
    key: 'silence_ability', label: 'Silence arcane', trigger: 'abilityHit', every: 3,
    text: (v) => `Toutes les ${v.every} compétences touchées : silence ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'target', effectId: S.SILENCE, duration: 0.45 + tier * 0.1, label: 'Item' }]
  },
  {
    key: 'slow_ability', label: 'Impact gravifique', trigger: 'abilityHit', every: 1, chance: 0.38,
    text: (v) => `${pct(v.chance)} sur compétence touchée : slow ${pct(v.value)} pendant ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'target', effectId: S.SLOW, duration: 1.15 + tier * 0.18, value: 0.18 + tier * 0.035, label: 'Item' }]
  },
  {
    key: 'burn_ability', label: 'Catalyseur de sorts', trigger: 'abilityHit', every: 2,
    text: (v) => `Toutes les ${v.every} compétences touchées : burn ${v.periodicDamage.toFixed(1)}/s pendant ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'target', effectId: S.BURN, duration: 2.2 + tier * 0.35, periodicDamage: 4.0 + tier * 1.2, tickEvery: 1, label: 'Item' }]
  },
  {
    key: 'spell_vamp', label: 'Vampirisme de sort', trigger: 'abilityHit', every: 2,
    text: (v) => `Toutes les ${v.every} compétences touchées : soigne ${pct(v.ratioOfDamage)} des dégâts infligés.`,
    build: (tier) => [{ type: 'heal', target: 'self', ratioOfDamage: 0.16 + tier * 0.035, label: 'Item' }]
  },
  {
    key: 'ability_battery', label: 'Batterie de sort', trigger: 'abilityHit', every: 2,
    text: (v) => `Toutes les ${v.every} compétences touchées : rend ${Math.round(v.flat)} énergie.`,
    build: (tier) => [{ type: 'energy', target: 'self', flat: 7 + tier * 3, label: 'Item' }]
  },
  {
    key: 'rocket_cryo', label: 'Charge cryo', trigger: 'rocketHit', every: 1,
    text: (v) => `Roquettes touchées : slow ${pct(v.value)} pendant ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'target', effectId: S.SLOW, duration: 1.35 + tier * 0.18, value: 0.18 + tier * 0.03, label: 'Item' }]
  },
  {
    key: 'rocket_melta', label: 'Charge melta', trigger: 'rocketHit', every: 2,
    text: (v) => `Toutes les ${v.every} roquettes touchées : armor shred ${pct(v.value)} pendant ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'target', effectId: S.ARMOR_SHRED, duration: 2.4 + tier * 0.3, value: 0.12 + tier * 0.035, label: 'Item' }]
  },
  {
    key: 'rocket_ignite', label: 'Charge incendiaire', trigger: 'rocketHit', every: 1, chance: 0.45,
    text: (v) => `${pct(v.chance)} sur roquette touchée : burn ${v.periodicDamage.toFixed(1)}/s pendant ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'target', effectId: S.BURN, duration: 2.4 + tier * 0.35, periodicDamage: 4.5 + tier * 1.35, tickEvery: 1, label: 'Item' }]
  },
  {
    key: 'rocket_emp', label: 'Charge IEM', trigger: 'rocketHit', every: 3,
    text: (v) => `Toutes les ${v.every} roquettes touchées : disarm ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'target', effectId: S.DISARM, duration: 0.55 + tier * 0.1, label: 'Item' }]
  },
  {
    key: 'cast_haste', label: 'Postcombustion de cast', trigger: 'abilityCast', every: 2,
    text: (v) => `Toutes les ${v.every} compétences lancées : haste ${pct(v.value)} pendant ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'self', effectId: S.HASTE, duration: 1.25 + tier * 0.18, value: 0.12 + tier * 0.03, label: 'Item' }]
  },
  {
    key: 'cast_shield', label: 'Bouclier de cast', trigger: 'abilityCast', every: 3,
    text: (v) => `Toutes les ${v.every} compétences lancées : gagne ${Math.round(v.flat)} bouclier.`,
    build: (tier) => [{ type: 'shield', target: 'self', flat: 12 + tier * 6, label: 'Item' }]
  },
  {
    key: 'cast_tenacity', label: 'Stabilisateur de cast', trigger: 'abilityCast', every: 3,
    text: (v) => `Toutes les ${v.every} compétences lancées : tenacity ${pct(v.value)} pendant ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'self', effectId: S.TENACITY, duration: 2.0 + tier * 0.35, value: 0.16 + tier * 0.035, label: 'Item' }]
  },
  {
    key: 'reactive_armor', label: 'Blindage réactif', trigger: 'takeHit', every: 4,
    text: (v) => `Toutes les ${v.every} touches subies : armor up ${pct(v.value)} pendant ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'self', effectId: S.ARMOR_UP, duration: 1.8 + tier * 0.25, value: 0.12 + tier * 0.035, label: 'Item' }]
  },
  {
    key: 'reactive_haste', label: 'Fuite réactive', trigger: 'takeHit', every: 5,
    text: (v) => `Toutes les ${v.every} touches subies : haste ${pct(v.value)} pendant ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'self', effectId: S.HASTE, duration: 1.3 + tier * 0.2, value: 0.14 + tier * 0.035, label: 'Item' }]
  },
  {
    key: 'thorn_amp', label: 'Épine de rupture', trigger: 'takeHit', every: 5,
    text: (v) => `Toutes les ${v.every} touches subies : applique damage amp ${pct(v.value)} à l’attaquant pendant ${v.duration.toFixed(1)}s.`,
    build: (tier) => [{ type: 'status', target: 'attacker', effectId: S.DAMAGE_AMP, duration: 1.8 + tier * 0.2, value: 0.08 + tier * 0.025, label: 'Item' }]
  }
]);

function materializeProc(template, tier, index) {
  const everyShift = (index % 3) - 1;
  const every = Math.max(1, (template.every ?? 1) + everyShift);
  const chance = template.chance != null ? clamp(template.chance + ((index % 5) - 2) * 0.025, 0.08, 1) : 1;
  const actions = template.build(tier).map((action) => ({ ...action }));
  for (const action of actions) {
    if (action.duration != null) action.duration = Math.round(action.duration * 10) / 10;
    if (action.value != null) action.value = Math.round(action.value * 1000) / 1000;
    if (action.periodicDamage != null) action.periodicDamage = Math.round(action.periodicDamage * 10) / 10;
    if (action.flat != null) action.flat = Math.round(action.flat);
    if (action.ratioOfDamage != null) action.ratioOfDamage = Math.round(action.ratioOfDamage * 1000) / 1000;
  }
  const sample = actions[0] || {};
  const printable = {
    every,
    chance,
    duration: sample.duration ?? 0,
    value: sample.value ?? 0,
    periodicDamage: sample.periodicDamage ?? 0,
    flat: sample.flat ?? 0,
    ratioOfDamage: sample.ratioOfDamage ?? 0
  };
  return {
    id: `${template.key}-${tier}-${index}`,
    name: template.label,
    trigger: template.trigger,
    every,
    chance,
    actions,
    text: template.text(printable)
  };
}

function profileFor(categoryId, tier, index, tint) {
  const s = 1 + (tier - 1) * 0.35;
  if (categoryId === ITEM_CATEGORY_IDS.WEAPON) {
    return {
      weaponProfile: {
        damage: Math.round((10.5 + (index % 7) * 1.2) * s * 10) / 10,
        cooldown: Math.round((0.48 + (index % 6) * 0.08) * 100) / 100,
        projectileSpeed: 910 + (index % 5) * 55,
        range: 720 + (index % 6) * 45,
        energyCost: Math.round((2 + (index % 5) * 0.35) * 10) / 10,
        tint
      }
    };
  }
  if (categoryId === ITEM_CATEGORY_IDS.LAUNCHER) {
    return {
      launcherProfile: {
        cooldown: Math.round((3.2 + (index % 7) * 0.32) * 10) / 10,
        volley: 1 + (index % 4 === 0 ? 1 : 0) + (index % 11 === 0 ? 1 : 0),
        energyCost: Math.round((6.8 + (index % 6) * 0.8) * 10) / 10,
        projectileSpeed: 860 + (index % 7) * 55,
        range: 1380 + (index % 8) * 70,
        splashRadius: 72 + (index % 7) * 9,
        damageMult: Math.round((0.86 + tier * 0.08 + (index % 5) * 0.03) * 100) / 100,
        dispersionDeg: index % 5 === 0 ? 11 : (index % 3 === 0 ? 6 : 0),
        tint
      }
    };
  }
  if (categoryId === ITEM_CATEGORY_IDS.AMMO) {
    const variant = index % 8;
    const base = {
      packSize: Math.max(3, 9 - tier - (index % 3)),
      damage: Math.round((26 + tier * 5 + (index % 6) * 2.5) * 10) / 10,
      splashRadius: 76 + (index % 6) * 8,
      tint,
      summary: 'standard'
    };
    if (variant === 1) Object.assign(base, { effectType: 'slow', effectDuration: 1.3 + tier * 0.25, effectMagnitude: 0.20 + tier * 0.035, summary: `slow ${Math.round((0.20 + tier * 0.035) * 100)}%` });
    else if (variant === 2) Object.assign(base, { effectType: 'burn', effectDuration: 2.1 + tier * 0.35, effectMagnitude: 3.5 + tier * 1.1, summary: `feu ${(3.5 + tier * 1.1).toFixed(1)}/s` });
    else if (variant === 3) Object.assign(base, { effectType: 'stun', effectDuration: 0.35 + tier * 0.08, effectMagnitude: 0, summary: `stun ${(0.35 + tier * 0.08).toFixed(1)}s` });
    else if (variant === 4) Object.assign(base, { damage: Math.round(base.damage * 0.82), splashRadius: base.splashRadius + 26, summary: 'large explosion' });
    else if (variant === 5) Object.assign(base, { damage: Math.round(base.damage * 1.18), splashRadius: Math.max(60, base.splashRadius - 16), summary: 'perforant' });
    else if (variant === 6) Object.assign(base, { packSize: base.packSize + 3, damage: Math.round(base.damage * 0.72), summary: 'volume' });
    else if (variant === 7) Object.assign(base, { effectType: 'slow', effectDuration: 0.9 + tier * 0.16, effectMagnitude: 0.12 + tier * 0.02, damage: Math.round(base.damage * 1.05), summary: 'impact lourd' });
    return { ammoProfile: base };
  }
  if (categoryId === ITEM_CATEGORY_IDS.CONVERTER) {
    const pair = CONVERTER_PAIRS[index % CONVERTER_PAIRS.length];
    const speed = 6.0 + (index % 6) * 0.55 + Math.max(0, tier - 1) * 0.8;
    return {
      converterProfile: {
        inputKey: pair[0],
        inputAmount: Math.max(1, pair[1] - Math.floor(tier / 2)),
        outputKey: pair[2],
        outputAmount: Math.max(1, pair[3] + (tier >= 3 ? 1 : 0)),
        seconds: Math.round(speed * 10) / 10,
        energyPerSecond: Math.round((1.0 + tier * 0.18 + (index % 4) * 0.08) * 100) / 100
      }
    };
  }
  return {};
}

const FAMILY_NAMES = Object.freeze([
  'Cryo', 'Melta', 'Vampire', 'IEM', 'Grav', 'Venin', 'Frappe', 'Prisme', 'Siphon', 'Rift', 'Aegis', 'Surchauffe'
]);

const CATEGORY_NAMES = Object.freeze({
  [ITEM_CATEGORY_IDS.WEAPON]: ['Canon', 'Lanceur pulse', 'Carabine', 'Accélérateur'],
  [ITEM_CATEGORY_IDS.LAUNCHER]: ['Rack', 'Pod', 'Batterie roquette', 'Rampe'],
  [ITEM_CATEGORY_IDS.DEFENSE]: ['Blindage', 'Écran', 'Plaque', 'Coque'],
  [ITEM_CATEGORY_IDS.ENGINE]: ['Propulseur', 'Injecteur', 'Turbine', 'Ailette'],
  [ITEM_CATEGORY_IDS.MODULE]: ['Relais', 'Matrice', 'Noyau', 'Circuit'],
  [ITEM_CATEGORY_IDS.AMMO]: ['Roquettes', 'Charge', 'Munitions', 'Ogives'],
  [ITEM_CATEGORY_IDS.CONVERTER]: ['Convertisseur', 'Raffineur', 'Recycleur', 'Alambic']
});

function shouldAttachPassive(categoryId, index) {
  if (categoryId === ITEM_CATEGORY_IDS.AMMO || categoryId === ITEM_CATEGORY_IDS.CONVERTER) return false;
  return index % 5 === 0;
}

function compatibleTemplate(categoryId, index) {
  if (categoryId === ITEM_CATEGORY_IDS.LAUNCHER) {
    const rocket = PROC_TEMPLATES.filter((p) => p.trigger === 'rocketHit' || p.trigger === 'hitAny' || p.trigger === 'abilityCast');
    return rocket[index % rocket.length];
  }
  if (categoryId === ITEM_CATEGORY_IDS.DEFENSE || categoryId === ITEM_CATEGORY_IDS.ENGINE) {
    const defensive = PROC_TEMPLATES.filter((p) => p.trigger === 'takeHit' || p.trigger === 'abilityCast' || p.trigger === 'hitAny');
    return defensive[index % defensive.length];
  }
  return PROC_TEMPLATES[index % PROC_TEMPLATES.length];
}

function descriptionFor(categoryId, profile, proc) {
  if (proc?.text) return proc.text;
  if (categoryId === ITEM_CATEGORY_IDS.WEAPON) return 'Arme procédurale : variantes de dégâts, cadence, portée et coût énergétique.';
  if (categoryId === ITEM_CATEGORY_IDS.LAUNCHER) return 'Lance-roquettes procédural : variantes de salve, portée, dispersion, recharge et rayon.';
  if (categoryId === ITEM_CATEGORY_IDS.AMMO) return profile?.ammoProfile?.summary ? `Roquettes procédurales : ${profile.ammoProfile.summary}.` : 'Roquettes procédurales sans passif d’équipement.';
  if (categoryId === ITEM_CATEGORY_IDS.CONVERTER) return 'Convertisseur procédural : transforme une ressource locale en ressource raffinée. Aucun passif.';
  return 'Équipement procédural : bonus de statistiques sans passif spécial.';
}

function makeItem(categoryId, index) {
  const tier = 1 + (index % 4 >= 2 ? 1 : 0) + (index % 17 === 0 ? 1 : 0);
  const safeTier = clamp(tier, 1, 4);
  const family = FAMILY_NAMES[index % FAMILY_NAMES.length];
  const nounList = CATEGORY_NAMES[categoryId] || CATEGORY_NAMES[ITEM_CATEGORY_IDS.MODULE];
  const noun = nounList[index % nounList.length];
  const tint = COLORS[index % COLORS.length];
  const profile = profileFor(categoryId, safeTier, index, tint);
  const withPassive = shouldAttachPassive(categoryId, index);
  const template = withPassive ? compatibleTemplate(categoryId, index) : null;
  const proc = template ? materializeProc(template, safeTier, index) : null;
  const name = `${noun} ${family} ${index + 1}`;
  const shortName = `${family} ${index + 1}`;
  const item = {
    id: `proc-${cleanId(categoryId)}-${cleanId(family)}-${index + 1}`,
    generated: true,
    name,
    shortName,
    categoryId,
    tier: safeTier,
    priceCredits: tierPrice(categoryId, safeTier, index),
    tags: categoryId === ITEM_CATEGORY_IDS.AMMO || categoryId === ITEM_CATEGORY_IDS.CONVERTER ? [] : tagPair(index),
    bonuses: statPatchFor(categoryId, safeTier, index),
    ...profile,
    description: descriptionFor(categoryId, profile, proc)
  };
  if (proc) item.passiveEffects = [proc];
  return item;
}

function buildProceduralItemDefs() {
  const specs = [
    [ITEM_CATEGORY_IDS.WEAPON, 34],
    [ITEM_CATEGORY_IDS.LAUNCHER, 44],
    [ITEM_CATEGORY_IDS.AMMO, 48],
    [ITEM_CATEGORY_IDS.DEFENSE, 28],
    [ITEM_CATEGORY_IDS.ENGINE, 28],
    [ITEM_CATEGORY_IDS.MODULE, 60],
    [ITEM_CATEGORY_IDS.CONVERTER, 36]
  ];
  const out = {};
  let globalIndex = 0;
  for (const [categoryId, count] of specs) {
    for (let i = 0; i < count; i += 1) {
      const item = makeItem(categoryId, globalIndex);
      out[item.id] = Object.freeze(item);
      globalIndex += 1;
    }
  }
  return Object.freeze(out);
}

export const PROCEDURAL_ITEM_DEFS = buildProceduralItemDefs();
