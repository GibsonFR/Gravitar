import { ITEM_CATEGORY_IDS } from '../items/ItemCategoryIds.js';
import { ITEM_TAG_IDS } from '../items/ItemTagIds.js';
import { getItemDef } from '../items/ItemDefs.js';

const QUALITY_TABLE = Object.freeze([
  { id: 'common', name: 'Standard', mult: 1.00, weight: 64 },
  { id: 'uncommon', name: 'Renforcé', mult: 1.10, weight: 25 },
  { id: 'rare', name: 'Rare', mult: 1.24, weight: 9 },
  { id: 'epic', name: 'Prototype', mult: 1.45, weight: 2 }
]);

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i += 1) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seedText) {
  let s = hashString(seedText) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17; s >>>= 0;
    s ^= s << 5; s >>>= 0;
    return (s >>> 0) / 4294967296;
  };
}

function pickWeighted(rand, arr) {
  const total = arr.reduce((sum, it) => sum + Math.max(0, it.weight || 0), 0) || 1;
  let roll = rand() * total;
  for (const it of arr) {
    roll -= Math.max(0, it.weight || 0);
    if (roll <= 0) return it;
  }
  return arr[arr.length - 1];
}

function roundBonus(v) {
  if (Math.abs(v) >= 1) return Math.round(v);
  return Math.round(v * 1000) / 1000;
}

export function scaleNeutralBonuses(baseBonuses = {}, mark = 1) {
  const m = Math.max(1, mark | 0 || 1);
  const out = {};
  for (const [key, raw] of Object.entries(baseBonuses || {})) {
    const value = Number(raw) || 0;
    let mult = 1 + (m - 1) * 0.34;
    if (String(key).endsWith('Flat')) mult = 1 + (m - 1) * 0.55;
    if (String(key).endsWith('Pct')) mult = 1 + (m - 1) * 0.28;
    out[key] = roundBonus(value * mult);
  }
  if (m >= 2) mergeBonus(out, 'energyFlat', 6 * (m - 1));
  if (m >= 3) mergeBonus(out, 'cooldownReductionPct', 0.01 * (m - 2));
  if (m >= 4) mergeBonus(out, 'critChancePct', 0.01 * (m - 3));
  if (m >= 5) mergeBonus(out, 'damageMultPct', 0.015 * (m - 4));
  return out;
}

export function getNeutralBaseBonuses(baseItemId, mark = 1) {
  const base = getItemDef(baseItemId);
  if (!base) return {};
  return scaleNeutralBonuses(base.bonuses || {}, mark);
}

function mergeBonus(out, key, value) {
  out[key] = roundBonus((Number(out[key]) || 0) + Number(value || 0));
}

function baseAffixes(categoryId) {
  if (categoryId === ITEM_CATEGORY_IDS.WEAPON) return [
    ['damageMultPct', 0.035], ['fireRatePct', 0.032], ['critChancePct', 0.022], ['critDamagePct', 0.075], ['armorPenFlat', 4]
  ];
  if (categoryId === ITEM_CATEGORY_IDS.DEFENSE) return [
    ['hpFlat', 18], ['shieldFlat', 24], ['armorFlat', 5], ['hpPct', 0.035], ['hullRegenFlat', 0.20]
  ];
  if (categoryId === ITEM_CATEGORY_IDS.ENGINE) return [
    ['enginePct', 0.055], ['energyRegenFlat', 0.24], ['energyFlat', 12], ['cooldownReductionPct', 0.018]
  ];
  if (categoryId === ITEM_CATEGORY_IDS.MODULE) return [
    ['cargoFlat', 18], ['energyFlat', 10], ['critChancePct', 0.014], ['cooldownReductionPct', 0.016], ['damageMultPct', 0.018]
  ];
  return [['energyFlat', 8], ['hpFlat', 10]];
}

function statLabel(key) {
  return ({
    damageMultPct: 'Dégâts',
    fireRatePct: 'Cadence',
    critChancePct: 'Critique',
    critDamagePct: 'Dégâts crit.',
    armorPenFlat: 'Pénétration',
    hpFlat: 'Coque',
    shieldFlat: 'Bouclier',
    armorFlat: 'Armure',
    hpPct: 'Coque %',
    hullRegenFlat: 'Réparation',
    enginePct: 'Vitesse',
    energyRegenFlat: 'Recharge',
    energyFlat: 'Énergie',
    cooldownReductionPct: 'Récupération',
    cargoFlat: 'Soute'
  })[key] || key;
}

function rollTag(rand) {
  const tags = [ITEM_TAG_IDS.REAVER, ITEM_TAG_IDS.SURGE, ITEM_TAG_IDS.VERGE, ITEM_TAG_IDS.SIEGE, ITEM_TAG_IDS.WARDEN, ITEM_TAG_IDS.SIPHON];
  return tags[Math.floor(rand() * tags.length)] || ITEM_TAG_IDS.REAVER;
}

export function rollCraftedEquipment({ baseItemId, recipeId, ownerKey = '', craftedIndex = 0, timeMs = Date.now(), qualityBoost = 0 }) {
  const base = getItemDef(baseItemId);
  if (!base) return null;
  const rand = rng(`${ownerKey}|${recipeId}|${baseItemId}|${craftedIndex}|${timeMs}`);
  const effectiveBoost = Math.max(0, Number(qualityBoost) || 0) * (0.4 + rand() * 1.2);
  const adjustedQualities = QUALITY_TABLE.map((q, idx) => ({
    ...q,
    weight: Math.max(1, q.weight + (idx > 0 ? effectiveBoost * idx * 4 : -effectiveBoost * 2))
  }));
  const quality = pickWeighted(rand, adjustedQualities);
  const affixPool = baseAffixes(base.categoryId);
  const affixCount = quality.id === 'epic' ? 3 : quality.id === 'rare' ? 2 : quality.id === 'uncommon' ? 2 : 1;
  const bonuses = { ...(base.bonuses || {}) };
  const lines = [];
  const used = new Set();
  for (let i = 0; i < affixCount; i += 1) {
    let picked = affixPool[Math.floor(rand() * affixPool.length)];
    for (let guard = 0; guard < 8 && used.has(picked[0]); guard += 1) picked = affixPool[Math.floor(rand() * affixPool.length)];
    used.add(picked[0]);
    const variance = 0.82 + rand() * 0.42;
    const value = roundBonus(picked[1] * quality.mult * variance);
    mergeBonus(bonuses, picked[0], value);
    lines.push({ key: picked[0], label: statLabel(picked[0]), value });
  }
  const suffix = quality.id === 'common' ? '' : ` ${quality.name}`;
  const id = `crafted-${recipeId}-${craftedIndex}-${hashString(`${ownerKey}|${timeMs}|${baseItemId}`).toString(36)}`;
  return {
    ...base,
    id,
    baseItemId: base.id,
    crafted: true,
    qualityId: quality.id,
    qualityName: quality.name,
    name: `${base.name}${suffix}`,
    shortName: `${base.shortName || base.name}${suffix}`,
    shopOffer: false,
    priceCredits: Math.round((base.priceCredits || 120) * (1.25 + quality.mult * 0.45) * (1 + ((neutralItemDef?.mark || 1) - 1) * 0.35)),
    bonuses,
    tags: [...(base.tags || []), { tagId: rollTag(rand), points: quality.id === 'epic' ? 2 : 1 }],
    rollLines: lines,
    description: `${base.description || ''} Fabrication ${quality.name.toLowerCase()} issue de l’atelier.`
  };
}

export function getQualityName(id) {
  return QUALITY_TABLE.find((q) => q.id === id)?.name || 'Standard';
}


export function createNeutralCraftedEquipment({ baseItemId, recipeId, recipeName = '', mark = 1, ownerKey = '', craftedIndex = 0, timeMs = Date.now() }) {
  const base = getItemDef(baseItemId);
  if (!base) return null;
  const id = `neutral-${recipeId}-${craftedIndex}-${hashString(`${ownerKey}|${timeMs}|${baseItemId}|neutral`).toString(36)}`;
  const baseBonuses = getNeutralBaseBonuses(baseItemId, mark);
  return {
    ...base,
    id,
    baseItemId: base.id,
    neutralBase: true,
    rdEnhanced: false,
    crafted: true,
    mark: mark | 0 || 1,
    qualityId: 'neutral',
    qualityName: 'Neutre',
    name: recipeName || `${base.name} Mark ${mark | 0 || 1}`,
    shortName: recipeName || `${base.shortName || base.name} Mk.${mark | 0 || 1}`,
    shopOffer: false,
    tags: [],
    bonuses: baseBonuses,
    rollLines: [],
    description: `Objet neutre Mark ${mark | 0 || 1}. Peut être amélioré dans une station R&D avec des sciences.`
  };
}

export function rollRDEquipment({ neutralItemDef, programId = 'rd_basic', ownerKey = '', craftedIndex = 0, timeMs = Date.now(), qualityBoost = 0 }) {
  if (!neutralItemDef) return null;
  const baseItemId = neutralItemDef.baseItemId || neutralItemDef.id;
  const rolled = rollCraftedEquipment({
    baseItemId,
    recipeId: programId,
    ownerKey,
    craftedIndex,
    timeMs,
    qualityBoost
  });
  if (!rolled) return null;
  return {
    ...rolled,
    id: `rd-${programId}-${craftedIndex}-${hashString(`${ownerKey}|${timeMs}|${neutralItemDef.id}|rd`).toString(36)}`,
    baseItemId,
    neutralSourceId: neutralItemDef.id,
    neutralBase: false,
    rdEnhanced: true,
    crafted: true,
    mark: neutralItemDef.mark || 1,
    name: `${neutralItemDef.name} ${rolled.qualityName}`,
    shortName: `${neutralItemDef.shortName || neutralItemDef.name} ${rolled.qualityName}`,
    description: `${neutralItemDef.name} amélioré par R&D. ${rolled.description || ''}`.trim()
  };
}
