import { ITEM_CATEGORY_IDS } from '../../../../shared/content/items/ItemCategoryIds.js';
import { getPlayerItemDef } from './PlayerEquipmentDefs.js';

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function getOwnedEquipmentDefs(player) {
  const ids = player?.equipment?.ownedItemIds ?? [];
  return ids.map((id) => getPlayerItemDef(player, id)).filter(Boolean);
}

export function getEquippedEquipmentDefs(player) {
  const ids = player?.equipment?.equippedItemIds ?? [];
  return ids.map((id) => getPlayerItemDef(player, id)).filter(Boolean);
}

export function buildEquippedCountByCategory(player) {
  const out = {
    [ITEM_CATEGORY_IDS.WEAPON]: 0,
    [ITEM_CATEGORY_IDS.LAUNCHER]: 0,
    [ITEM_CATEGORY_IDS.DEFENSE]: 0,
    [ITEM_CATEGORY_IDS.ENGINE]: 0,
    [ITEM_CATEGORY_IDS.MODULE]: 0,
    [ITEM_CATEGORY_IDS.CONVERTER]: 0
  };
  for (const def of getEquippedEquipmentDefs(player)) {
    if (out[def.categoryId] == null) out[def.categoryId] = 0;
    out[def.categoryId] += 1;
  }
  return out;
}

export function resolveEquipmentBonuses(player) {
  const out = {
    hpFlat: 0,
    hpPct: 0,
    shieldFlat: 0,
    energyFlat: 0,
    hullRegenFlat: 0,
    energyRegenFlat: 0,
    energyRegenPct: 0,
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

  for (const def of getEquippedEquipmentDefs(player)) {
    const bonuses = def?.bonuses ?? {};
    out.hpFlat += finite(bonuses.hpFlat, 0);
    out.hpPct += finite(bonuses.hpPct, 0);
    out.shieldFlat += finite(bonuses.shieldFlat, 0);
    out.energyFlat += finite(bonuses.energyFlat, 0);
    out.hullRegenFlat += finite(bonuses.hullRegenFlat, 0);
    out.energyRegenFlat += finite(bonuses.energyRegenFlat, 0);
    out.energyRegenPct += finite(bonuses.energyRegenPct, 0);
    out.damageMultPct += finite(bonuses.damageMultPct, 0);
    out.enginePct += finite(bonuses.enginePct, 0);
    out.cargoFlat += finite(bonuses.cargoFlat, 0);
    out.fireRatePct += finite(bonuses.fireRatePct, 0);
    out.cooldownReductionPct += finite(bonuses.cooldownReductionPct, 0);
    out.critChancePct += finite(bonuses.critChancePct, 0);
    out.critDamagePct += finite(bonuses.critDamagePct, 0);
    out.lifestealPct += finite(bonuses.lifestealPct, 0);
    out.healPowerPct += finite(bonuses.healPowerPct, 0);
    out.overhealShieldRatio += finite(bonuses.overhealShieldRatio, 0);
    out.autoBurnDuration = Math.max(out.autoBurnDuration, finite(bonuses.autoBurnDuration, 0));
    out.autoBurnDps = Math.max(out.autoBurnDps, finite(bonuses.autoBurnDps, 0));
    out.autoBurnEvery = out.autoBurnEvery || finite(bonuses.autoBurnEvery, 0);
    out.autoSlowEvery = out.autoSlowEvery || finite(bonuses.autoSlowEvery, 0);
    out.autoSlowPct = Math.max(out.autoSlowPct, finite(bonuses.autoSlowPct, 0));
    out.autoSlowDuration = Math.max(out.autoSlowDuration, finite(bonuses.autoSlowDuration, 0));
    out.autoLifestealEvery = out.autoLifestealEvery || finite(bonuses.autoLifestealEvery, 0);
    out.autoLifestealPct = Math.max(out.autoLifestealPct, finite(bonuses.autoLifestealPct, 0));
    out.autoBleedEvery = out.autoBleedEvery || finite(bonuses.autoBleedEvery, 0);
    out.autoBleedDuration = Math.max(out.autoBleedDuration, finite(bonuses.autoBleedDuration, 0));
    out.autoBleedDps = Math.max(out.autoBleedDps, finite(bonuses.autoBleedDps, 0));
    out.autoAmpEvery = out.autoAmpEvery || finite(bonuses.autoAmpEvery, 0);
    out.autoAmpPct = Math.max(out.autoAmpPct, finite(bonuses.autoAmpPct, 0));
    out.autoAmpDuration = Math.max(out.autoAmpDuration, finite(bonuses.autoAmpDuration, 0));
    out.rocketDamagePct += finite(bonuses.rocketDamagePct, 0);
    out.autoRangePct += finite(bonuses.autoRangePct, 0);
    out.armorFlat += finite(bonuses.armorFlat, 0);
    out.shieldPenPct += finite(bonuses.shieldPenPct, 0);
    out.armorPenFlat += finite(bonuses.armorPenFlat, 0);
  }

  return out;
}
