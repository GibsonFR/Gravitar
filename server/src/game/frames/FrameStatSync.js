import { resolveFrameStats } from './FrameStatResolver.js';
import { resolveEquipmentRuntimeBonuses } from '../equipment/EquipmentEffectResolver.js';

function applyRatio(current, nextMax, key, nextKey) {
  if (!Number.isFinite(current?.[nextKey]) || current[nextKey] <= 0) return nextMax;
  const ratio = current[key] / current[nextKey];
  return Math.max(0, Math.min(nextMax, nextMax * ratio));
}

export function syncPlayerFrameStats(player, options = {}) {
  const preserveRatios = options.preserveRatios !== false;
  const restoreVitals = !!options.restoreVitals;
  const level = player?.progression?.level ?? 1;
  const nextStats = resolveFrameStats(player.frameId, level);
  const prevStats = player.stats ?? {};
  const equipmentBonuses = resolveEquipmentRuntimeBonuses(player);

  const maxHpBase = nextStats.maxHp + Math.max(0, equipmentBonuses.hpFlat ?? 0);
  const maxHp = maxHpBase * (1 + Math.max(0, equipmentBonuses.hpPct ?? 0));
  const maxShield = nextStats.maxShield + Math.max(0, equipmentBonuses.shieldFlat ?? 0);
  const maxEnergy = nextStats.maxEnergy + Math.max(0, equipmentBonuses.energyFlat ?? 0);
  const energyRegen = (nextStats.energyRegen ?? 0) * (1 + Math.max(0, equipmentBonuses.energyRegenPct ?? 0)) + (equipmentBonuses.energyRegenFlat ?? 0);
  const hullRegen = (nextStats.hullRegen ?? 0) + (equipmentBonuses.hullRegenFlat ?? 0);

  player.engine = nextStats.engine * (1 + (equipmentBonuses.enginePct ?? 0));
  player.radius = nextStats.radius;
  player.baseArmor = (nextStats.baseArmor ?? 0) + Math.max(0, equipmentBonuses.armorFlat ?? 0);
  player.magnetRange = nextStats.magnetRange;
  player.progressionBonuses = {
    damageMult: (nextStats.damageMult ?? 1) * (1 + (equipmentBonuses.damageMultPct ?? 0)),
    fireRateMult: (nextStats.fireRateMult ?? 1) * (1 + (equipmentBonuses.fireRatePct ?? 0)),
    cooldownRecoveryMult: 1 + (equipmentBonuses.cooldownReductionPct ?? 0),
    autoAttackBaseCooldown: nextStats.autoAttackBaseCooldown ?? 0.70,
    autoAttackBaseDamage: (nextStats.autoAttackBaseDamage ?? 13) + (equipmentBonuses.damageFlat ?? 0),
    hullRegen,
    energyRegen,
    critChance: equipmentBonuses.critChancePct ?? 0,
    critDamageMult: 1.5 + (equipmentBonuses.critDamagePct ?? 0),
    lifestealRatio: equipmentBonuses.lifestealPct ?? 0,
    healMult: 1 + (equipmentBonuses.healPowerPct ?? 0),
    overhealShieldRatio: equipmentBonuses.overhealShieldRatio ?? 0,
    autoBurnDuration: equipmentBonuses.autoBurnDuration ?? 0,
    autoBurnDps: equipmentBonuses.autoBurnDps ?? 0,
    autoBurnEvery: equipmentBonuses.autoBurnEvery ?? 0,
    autoSlowEvery: equipmentBonuses.autoSlowEvery ?? 0,
    autoSlowPct: equipmentBonuses.autoSlowPct ?? 0,
    autoSlowDuration: equipmentBonuses.autoSlowDuration ?? 0,
    autoLifestealEvery: equipmentBonuses.autoLifestealEvery ?? 0,
    autoLifestealPct: equipmentBonuses.autoLifestealPct ?? 0,
    autoBleedEvery: equipmentBonuses.autoBleedEvery ?? 0,
    autoBleedDuration: equipmentBonuses.autoBleedDuration ?? 0,
    autoBleedDps: equipmentBonuses.autoBleedDps ?? 0,
    autoAmpEvery: equipmentBonuses.autoAmpEvery ?? 0,
    autoAmpPct: equipmentBonuses.autoAmpPct ?? 0,
    autoAmpDuration: equipmentBonuses.autoAmpDuration ?? 0,
    rocketDamageMult: 1 + (equipmentBonuses.rocketDamagePct ?? 0),
    autoRangeMult: 1 + (equipmentBonuses.autoRangePct ?? 0),
    shieldPenPct: equipmentBonuses.shieldPenPct ?? 0,
    armorPenFlat: equipmentBonuses.armorPenFlat ?? 0,
    armorFlat: equipmentBonuses.armorFlat ?? 0
  };

  if (player?.inv) {
    player.inv.cargoMax = 60 + Math.max(0, Math.round(equipmentBonuses.cargoFlat ?? 0));
  }

  player.stats = {
    ...prevStats,
    maxHp,
    maxShield,
    maxEnergy,
    energyRegen,
    shieldRegenPerSec: nextStats.shieldRegenPerSec,
    shieldRegenDelayOnHit: nextStats.shieldRegenDelayOnHit,
    hullRegen,
    hp: restoreVitals
      ? maxHp
      : (preserveRatios ? applyRatio(prevStats, maxHp, 'hp', 'maxHp') : Math.min(prevStats.hp ?? maxHp, maxHp)),
    shield: restoreVitals
      ? maxShield
      : (preserveRatios ? applyRatio(prevStats, maxShield, 'shield', 'maxShield') : Math.min(prevStats.shield ?? maxShield, maxShield)),
    energy: restoreVitals
      ? maxEnergy
      : (preserveRatios ? applyRatio(prevStats, maxEnergy, 'energy', 'maxEnergy') : Math.min(prevStats.energy ?? maxEnergy, maxEnergy))
  };
}
