import { ITEM_TAG_IDS, ITEM_TAG_ORDER } from '../../../../shared/content/items/ItemTagIds.js';
import { getItemTagDef } from '../../../../shared/content/items/ItemTagDefs.js';
import { ITEM_SUPER_TAG_IDS } from '../../../../shared/content/items/ItemSuperTagIds.js';
import { getItemSuperTagDef } from '../../../../shared/content/items/ItemSuperTagDefs.js';
import { resolveEquipmentBonuses, getEquippedEquipmentDefs } from './EquipmentBonuses.js';
import { ITEM_CATEGORY_IDS } from '../../../../shared/content/items/ItemCategoryIds.js';

const SUPER_TAG_PAIRS = Object.freeze([
  { id: ITEM_SUPER_TAG_IDS.OVERDRIVE, a: ITEM_TAG_IDS.REAVER, b: ITEM_TAG_IDS.SURGE },
  { id: ITEM_SUPER_TAG_IDS.JUGGERNAUT, a: ITEM_TAG_IDS.REAVER, b: ITEM_TAG_IDS.WARDEN },
  { id: ITEM_SUPER_TAG_IDS.GHOSTWIRE, a: ITEM_TAG_IDS.SURGE, b: ITEM_TAG_IDS.VERGE },
  { id: ITEM_SUPER_TAG_IDS.NAPALM, a: ITEM_TAG_IDS.REAVER, b: ITEM_TAG_IDS.SIEGE },
  { id: ITEM_SUPER_TAG_IDS.BLOODWALL, a: ITEM_TAG_IDS.WARDEN, b: ITEM_TAG_IDS.SIPHON }
]);

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function emptyRuntimeBonuses() {
  return {
    hpFlat: 0,
    hpPct: 0,
    shieldFlat: 0,
    energyFlat: 0,
    hullRegenFlat: 0,
    energyRegenFlat: 0,
    energyRegenPct: 0,
    damageFlat: 0,
    damageMultPct: 0,
    enginePct: 0,
    cargoFlat: 0,
    fireRatePct: 0,
    cooldownReductionPct: 0,
    critChancePct: 0,
    critDamagePct: 0,
    lifestealPct: 0,
    healPowerPct: 0,
    overhealShieldRatio: 0,
    autoBurnDuration: 0,
    autoBurnDps: 0,
    autoBurnEvery: 0,
    autoSlowEvery: 0,
    autoSlowPct: 0,
    autoSlowDuration: 0,
    autoLifestealEvery: 0,
    autoLifestealPct: 0,
    autoBleedEvery: 0,
    autoBleedDuration: 0,
    autoBleedDps: 0,
    autoAmpEvery: 0,
    autoAmpPct: 0,
    autoAmpDuration: 0,
    rocketDamagePct: 0,
    autoRangePct: 0,
    armorFlat: 0,
    shieldPenPct: 0,
    armorPenFlat: 0
  };
}

function addTo(out, patch) {
  if (!patch) return out;
  for (const [key, value] of Object.entries(patch)) {
    if (!Number.isFinite(value)) continue;
    if (key === 'autoBurnDuration' || key === 'autoBurnDps' || key.endsWith('Duration') || key.endsWith('Pct') || key.endsWith('Dps')) out[key] = Math.max(out[key] || 0, value);
    else if (key.endsWith('Every')) out[key] = out[key] || value;
    else out[key] = (out[key] || 0) + value;
  }
  return out;
}

function stageFromPoints(points) {
  return points >= 6 ? 3 : points >= 4 ? 2 : points >= 2 ? 1 : 0;
}

function buildTagPointMap(player) {
  const totals = new Map();
  for (const def of getEquippedEquipmentDefs(player)) {
    if (def?.categoryId === ITEM_CATEGORY_IDS.CONVERTER) continue;
    for (const tag of def.tags ?? []) {
      if (!tag?.tagId) continue;
      totals.set(tag.tagId, (totals.get(tag.tagId) || 0) + Math.max(0, tag.points | 0));
    }
  }
  return totals;
}

function superTagRank(aPoints, bPoints) {
  if (aPoints >= 4 && bPoints >= 4) return 2;
  if (aPoints >= 2 && bPoints >= 2) return 1;
  return 0;
}

function isLowHp(player) {
  const hp = player?.stats?.hp ?? 0;
  const maxHp = player?.stats?.maxHp ?? 0;
  if (maxHp <= 0) return false;
  return hp / maxHp <= 0.35;
}

export function buildEquippedTagState(player) {
  const totals = buildTagPointMap(player);
  return ITEM_TAG_ORDER.map((tagId) => {
    const def = getItemTagDef(tagId);
    const points = totals.get(tagId) || 0;
    return {
      tagId,
      name: def?.name || tagId,
      short: def?.short || tagId.slice(0, 3).toUpperCase(),
      colorHex: def?.colorHex || '#d0d7e4',
      points,
      stage: stageFromPoints(points),
      active: points >= 2
    };
  });
}

export function buildEquippedSuperTagState(player) {
  const totals = buildTagPointMap(player);
  return SUPER_TAG_PAIRS.map((pair) => {
    const aPoints = totals.get(pair.a) || 0;
    const bPoints = totals.get(pair.b) || 0;
    const rank = superTagRank(aPoints, bPoints);
    const def = getItemSuperTagDef(pair.id);
    return {
      superTagId: pair.id,
      name: def?.name || pair.id,
      short: def?.short || pair.id.slice(0, 2).toUpperCase(),
      colorHex: def?.colorHex || '#e0e6f4',
      aTagId: pair.a,
      bTagId: pair.b,
      rank,
      active: rank > 0,
      empowered: rank >= 2
    };
  }).filter((entry) => entry.active);
}

function applyTagStageEffects(out, tagState, lowHp) {
  if (!tagState?.active) return;
  switch (tagState.tagId) {
    case ITEM_TAG_IDS.REAVER:
      if (tagState.stage >= 2) addTo(out, { damageMultPct: 0.16, fireRatePct: 0.10 });
      else addTo(out, { damageMultPct: 0.08 });
      if (tagState.stage >= 3) addTo(out, { autoBurnDuration: 3, autoBurnDps: 6 });
      break;
    case ITEM_TAG_IDS.WARDEN:
      if (tagState.stage >= 2) addTo(out, { hpPct: 0.20 });
      else addTo(out, { hpPct: 0.10 });
      break;
    case ITEM_TAG_IDS.SURGE:
      if (tagState.stage >= 2) addTo(out, { energyRegenPct: 0.20, cooldownReductionPct: 0.10 });
      else addTo(out, { energyRegenPct: 0.20 });
      break;
    case ITEM_TAG_IDS.VERGE:
      if (tagState.stage >= 2) addTo(out, { enginePct: 0.20, autoRangePct: 0.12 });
      else addTo(out, { enginePct: 0.10 });
      if (tagState.stage >= 3 && lowHp) addTo(out, { enginePct: 0.18 });
      break;
    case ITEM_TAG_IDS.SIEGE:
      if (tagState.stage >= 2) addTo(out, { rocketDamagePct: 0.20, autoRangePct: 0.12 });
      else addTo(out, { rocketDamagePct: 0.20 });
      break;
    case ITEM_TAG_IDS.SIPHON:
      if (tagState.stage >= 2) addTo(out, { lifestealPct: 0.12, healPowerPct: 0.15 });
      else addTo(out, { lifestealPct: 0.06 });
      if (tagState.stage >= 3 && lowHp) addTo(out, { damageMultPct: 0.08, healPowerPct: 0.10 });
      break;
  }
}

function applySuperTagEffects(out, superTag, lowHp) {
  if (!superTag?.active) return;
  switch (superTag.superTagId) {
    case ITEM_SUPER_TAG_IDS.OVERDRIVE:
      addTo(out, { critChancePct: superTag.rank >= 2 ? 0.08 : 0.05 });
      break;
    case ITEM_SUPER_TAG_IDS.JUGGERNAUT:
      addTo(out, { hpPct: superTag.rank >= 2 ? 0.12 : 0.08, damageMultPct: superTag.rank >= 2 ? 0.08 : 0.05 });
      break;
    case ITEM_SUPER_TAG_IDS.GHOSTWIRE:
      if (lowHp) addTo(out, {
        enginePct: superTag.rank >= 2 ? 0.18 : 0.10,
        cooldownReductionPct: superTag.rank >= 2 ? 0.08 : 0.05,
        energyRegenPct: superTag.rank >= 2 ? 0.16 : 0.10
      });
      break;
    case ITEM_SUPER_TAG_IDS.NAPALM:
      addTo(out, { autoBurnDuration: superTag.rank >= 2 ? 4 : 3, autoBurnDps: superTag.rank >= 2 ? 9 : 6 });
      break;
    case ITEM_SUPER_TAG_IDS.BLOODWALL:
      addTo(out, { overhealShieldRatio: superTag.rank >= 2 ? 1.0 : 0.70 });
      break;
  }
}

export function resolveEquipmentRuntimeBonuses(player) {
  const out = emptyRuntimeBonuses();
  addTo(out, resolveEquipmentBonuses(player));
  const lowHp = isLowHp(player);
  const tagStates = buildEquippedTagState(player);
  const superTags = buildEquippedSuperTagState(player);

  for (const tagState of tagStates) applyTagStageEffects(out, tagState, lowHp);
  for (const superTag of superTags) applySuperTagEffects(out, superTag, lowHp);

  out.cooldownReductionPct = clamp(out.cooldownReductionPct, 0, 0.55);
  out.critChancePct = clamp(out.critChancePct, 0, 0.95);
  out.critDamagePct = clamp(out.critDamagePct, 0, 2.5);
  out.lifestealPct = clamp(out.lifestealPct, 0, 0.6);
  out.healPowerPct = clamp(out.healPowerPct, 0, 2);
  out.overhealShieldRatio = clamp(out.overhealShieldRatio, 0, 1);
  out.autoSlowPct = clamp(out.autoSlowPct, 0, 0.65);
  out.autoLifestealPct = clamp(out.autoLifestealPct, 0, 0.65);
  out.autoAmpPct = clamp(out.autoAmpPct, 0, 0.40);
  out.shieldPenPct = clamp(out.shieldPenPct, 0, 0.80);
  out.armorPenFlat = clamp(out.armorPenFlat, 0, 250);
  return out;
}

function pct(n) {
  return `${Math.round(n * 100)}%`;
}

export function buildEquipmentEffectLines(player) {
  const runtime = resolveEquipmentRuntimeBonuses(player);
  const lines = [];
  if (runtime.hpFlat) lines.push(`+${Math.round(runtime.hpFlat)} coque`);
  if (runtime.hpPct) lines.push(`+${pct(runtime.hpPct)} coque max`);
  if (runtime.shieldFlat) lines.push(`+${Math.round(runtime.shieldFlat)} bouclier`);
  if (runtime.energyFlat) lines.push(`+${Math.round(runtime.energyFlat)} énergie`);
  if (runtime.energyRegenFlat) lines.push(`+${runtime.energyRegenFlat.toFixed(2)} énergie/s`);
  if (runtime.energyRegenPct) lines.push(`+${pct(runtime.energyRegenPct)} régén. énergie`);
  if (runtime.hullRegenFlat) lines.push(`+${runtime.hullRegenFlat.toFixed(2)} coque/s`);
  if (runtime.damageMultPct) lines.push(`+${pct(runtime.damageMultPct)} dégâts`);
  if (runtime.fireRatePct) lines.push(`+${pct(runtime.fireRatePct)} cadence auto`);
  if (runtime.enginePct) lines.push(`+${pct(runtime.enginePct)} moteur`);
  if (runtime.cooldownReductionPct) lines.push(`+${pct(runtime.cooldownReductionPct)} CDR`);
  if (runtime.critChancePct) lines.push(`+${pct(runtime.critChancePct)} critique auto`);
  if (runtime.lifestealPct) lines.push(`+${pct(runtime.lifestealPct)} vol de vie`);
  if (runtime.cargoFlat) lines.push(`+${Math.round(runtime.cargoFlat)} soute`);
  if (runtime.armorFlat) lines.push(`+${Math.round(runtime.armorFlat)} armure`);
  if (runtime.shieldPenPct) lines.push(`+${pct(runtime.shieldPenPct)} pénétration bouclier`);
  if (runtime.armorPenFlat) lines.push(`+${Math.round(runtime.armorPenFlat)} pénétration armure`);
  if (runtime.autoBurnDuration > 0 && runtime.autoBurnDps > 0) lines.push(`Autos : brûlure ${runtime.autoBurnDps.toFixed(0)}/s ${runtime.autoBurnDuration.toFixed(0)}s`);
  if (runtime.autoSlowEvery > 0 && runtime.autoSlowPct > 0) lines.push(`Toutes les ${runtime.autoSlowEvery} autos : slow ${pct(runtime.autoSlowPct)}`);
  if (runtime.autoLifestealEvery > 0 && runtime.autoLifestealPct > 0) lines.push(`Toutes les ${runtime.autoLifestealEvery} autos : vol de vie ${pct(runtime.autoLifestealPct)}`);
  if (runtime.autoBleedEvery > 0 && runtime.autoBleedDps > 0) lines.push(`Toutes les ${runtime.autoBleedEvery} autos : saignement ${runtime.autoBleedDps.toFixed(0)}/s`);
  if (runtime.autoAmpEvery > 0 && runtime.autoAmpPct > 0) lines.push(`Toutes les ${runtime.autoAmpEvery} autos : marque +${pct(runtime.autoAmpPct)} dégâts reçus`);
  return lines;
}
