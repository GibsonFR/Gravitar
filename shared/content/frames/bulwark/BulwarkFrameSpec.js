export const BULWARK_PASSIVE = Object.freeze({
  maxPlates: 5,
  plateDuration: 7,
  plateGainInternalCooldown: 0.45,
  plateBurstWindow: 0.75,
  plateBurstThresholdPctMaxHp: 0.07,
  plateArmorPerPlate: 4,
  plateDamageReductionPerPlate: 0.02,
  plateTenacityPerPlate: 0.04,
  plateShieldPctMaxHp: 0.10,
  plateShieldArmorPct: 0.35,
  armorToAttackDamagePct: 0.18,
  armorToOnHitDamagePct: 0.08,
  empoweredDuration: 4,
  empoweredArmorToAttackDamagePct: 0.24,
  empoweredArmorToOnHitDamagePct: 0.12
});

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function getSkillLevel(slot, investedLevel) {
  return slot === 'R'
    ? clamp(investedLevel, 1, 5)
    : 1 + (clamp(investedLevel, 1, 15) - 1) * (29 / 14);
}

function getPhase(slot, investedLevel) {
  if (slot === 'R') return clamp(investedLevel, 1, 5);
  if (investedLevel >= 15) return 5;
  if (investedLevel >= 10) return 4;
  if (investedLevel >= 6) return 3;
  if (investedLevel >= 3) return 2;
  return 1;
}

export function getBulwarkAbilityTuning(slot, investedLevel = 1, totalArmor = 0) {
  const maxLevel = slot === 'R' ? 5 : 15;
  investedLevel = clamp(Math.round(investedLevel || 1), 1, maxLevel);
  const phase = getPhase(slot, investedLevel);
  const lvl = getSkillLevel(slot, investedLevel);

  const tuning = {
    investedLevel,
    phase,
    passive: BULWARK_PASSIVE,
    energyCost: 0,
    baseCooldown: 0,
    castTime: 0,
    anchorDuration: 0,
    anchorSelfSlowPct: 0,
    anchorArmorFlat: 0,
    anchorDamageReductionPct: 0,
    anchorReflectPct: 0,
    anchorReflectMinDamage: 0,
    anchorReflectMaxDamage: 0,
    anchorPulseSlowPct: 0,
    anchorPulseSlowDuration: 0,
    anchorPulseRadius: 0,
    anchorTauntedBonusFlat: 0,
    anchorTauntedBonusArmorPct: 0,
    anchorSingleHitCapPctMaxHp: 0,
    harpoonRange: 0,
    harpoonWidth: 0,
    harpoonProjectileSpeed: 0,
    harpoonDamageFlat: 0,
    harpoonDamageWeaponPct: 0,
    harpoonDamageArmorPct: 0,
    harpoonTauntDuration: 0,
    harpoonSelfHastePct: 0,
    harpoonArmorShredPct: 0,
    harpoonArmorShredDuration: 0,
    harpoonGroundedDuration: 0,
    harpoonDashDistance: 0,
    harpoonPullStrength: 0,
    meditationDuration: 0,
    meditationHealMissingPctPerSecond: 0,
    meditationSelfSlowPct: 0,
    meditationShieldPctMaxHp: 0,
    meditationShieldArmorPct: 0,
    meditationDamageReductionPct: 0,
    meditationFinalSlowPct: 0,
    meditationFinalSlowDuration: 0,
    meditationCastUnstoppableDuration: 0,
    meditationCleanseSilenceDisarmRoot: false,
    meditationPulseRadius: 0,
    meditationFinalGroundedDuration: 0,
    stormDuration: 0,
    stormRadius: 0,
    stormInnerRadius: 0,
    stormBaseDpsFlat: 0,
    stormBaseDpsPct: 0,
    stormSlowPct: 0,
    stormTauntedDamageAmpPct: 0,
    stormExposureStunThreshold: 0,
    stormExposureStunDuration: 0,
    stormPullStrength: 0,
    stormPullInterval: 0,
    stormPullWindow: 0,
    stormArmorStealPerSecond: 0,
    stormStealCap: 0,
    stormShieldGainPctMaxShieldPerTick: 0,
    stormShieldGainTickInterval: 0,
    stormShieldGainCapPctMaxShield: 0,
    stormCentralGroundedDuration: 0
  };

  if (slot === 'A') {
    tuning.energyCost = 28;
    tuning.baseCooldown = Math.max(11.9, 16 - 0.14 * (lvl - 1));
    tuning.anchorDuration = 2.75 + 0.035 * (lvl - 1);
    tuning.anchorSelfSlowPct = Math.max(0, 0.18 - 0.0015 * (lvl - 1));
    tuning.anchorArmorFlat = 12 + 0.5 * (lvl - 1);
    tuning.anchorDamageReductionPct = 0.10 + 0.0030 * (lvl - 1);
    tuning.anchorReflectPct = 0.20 + 0.0055 * (lvl - 1);
    tuning.anchorReflectMinDamage = 10 + 1.2 * (lvl - 1) + totalArmor * 0.15;
    tuning.anchorReflectMaxDamage = 28 + 1.1 * (lvl - 1) + totalArmor * 0.30;
    tuning.anchorPulseSlowPct = phase >= 3 ? 0.25 : 0;
    tuning.anchorPulseSlowDuration = phase >= 3 ? 1.0 : 0;
    tuning.anchorPulseRadius = phase >= 3 ? 150 : 0;
    tuning.anchorTauntedBonusFlat = phase >= 4 ? 6 + 0.55 * (lvl - 1) : 0;
    tuning.anchorTauntedBonusArmorPct = phase >= 4 ? 0.08 : 0;
    tuning.anchorSingleHitCapPctMaxHp = phase >= 5 ? 0.20 : 0;
  } else if (slot === 'Z') {
    tuning.castTime = 0.15;
    tuning.energyCost = 40;
    tuning.baseCooldown = Math.max(15.9, 20 - 0.14 * (lvl - 1));
    tuning.harpoonRange = 620 + 2 * Math.floor((lvl - 1) * 0.5);
    tuning.harpoonWidth = 28;
    tuning.harpoonProjectileSpeed = 1200;
    tuning.harpoonDamageFlat = 50 + 4.5 * (lvl - 1);
    tuning.harpoonDamageWeaponPct = 0.70 + 0.012 * (lvl - 1);
    tuning.harpoonDamageArmorPct = 0.25 + 0.007 * (lvl - 1);
    tuning.harpoonTauntDuration = 2.10;
    tuning.harpoonTauntBonusDurationInStorm = phase >= 5 ? 0.40 : 0;
    tuning.harpoonSelfHastePct = 0.25;
    tuning.harpoonArmorShredPct = phase >= 2 ? 0.12 + 0.003 * (lvl - 1) : 0;
    tuning.harpoonArmorShredDuration = phase >= 2 ? 4 : 0;
    tuning.harpoonGroundedDuration = phase >= 3 ? 1.0 + 0.015 * (lvl - 1) : 0;
    tuning.harpoonDashDistance = phase >= 4 ? 120 : 0;
    tuning.harpoonPullStrength = phase >= 5 ? 110 : 0;
  } else if (slot === 'E') {
    tuning.castTime = 0.12;
    tuning.energyCost = 36;
    tuning.baseCooldown = Math.max(14.4, 18 - 0.12 * (lvl - 1));
    tuning.meditationDuration = 2.25 + 0.02 * (lvl - 1);
    tuning.meditationSelfSlowPct = Math.max(0, 0.35 - 0.0008 * (lvl - 1));
    tuning.meditationDamageReductionPct = 0.22 + 0.0055 * (lvl - 1);
    tuning.meditationHealMissingPctPerSecond = 0.05 + 0.0022 * (lvl - 1);
    tuning.meditationShieldPctMaxHp = 0.08 + 0.0028 * (lvl - 1);
    tuning.meditationShieldArmorPct = 0.25 + 0.0065 * (lvl - 1);
    tuning.meditationCastUnstoppableDuration = phase >= 2 ? 0.50 : 0;
    tuning.meditationFinalSlowPct = phase >= 3 ? 0.20 : 0;
    tuning.meditationFinalSlowDuration = phase >= 3 ? 1.0 : 0;
    tuning.meditationPulseRadius = phase >= 3 ? 170 : 0;
    tuning.meditationCleanseSilenceDisarmRoot = phase >= 4;
    tuning.meditationFinalGroundedDuration = phase >= 5 ? 1.25 : 0;
  } else if (slot === 'R') {
    tuning.energyCost = 75;
    tuning.baseCooldown = Math.max(72.5, 110 - 1.25 * (investedLevel - 1));
    tuning.stormDuration = 5.0 + 0.04 * (investedLevel - 1);
    tuning.stormRadius = 180 + 1.4 * Math.floor((investedLevel - 1) * 0.5);
    tuning.stormInnerRadius = 90 + 0.55 * Math.floor((investedLevel - 1) * 0.5);
    tuning.stormBaseDpsFlat = 18 + 1.6 * (investedLevel - 1);
    tuning.stormBaseDpsPct = 0.08 + 0.002 * (investedLevel - 1);
    tuning.stormSlowPct = 0.20;
    tuning.stormTauntedDamageAmpPct = phase >= 2 ? 0.12 : 0;
    tuning.stormCentralGroundedDuration = phase >= 3 ? 0.65 : 0;
    tuning.stormExposureStunThreshold = phase >= 5 ? 2.60 : 0;
    tuning.stormExposureStunDuration = phase >= 5 ? 1.0 : 0;
    tuning.stormPullStrength = phase >= 5 ? 60 : 0;
    tuning.stormPullInterval = phase >= 5 ? 0.8 : 0;
    tuning.stormPullWindow = phase >= 5 ? 1.6 : 0;
    tuning.stormArmorStealPerSecond = 4;
    tuning.stormStealCap = 14;
    tuning.stormShieldGainPctMaxShieldPerTick = phase >= 4 ? 0.03 : 0;
    tuning.stormShieldGainTickInterval = phase >= 4 ? 1.2 : 0;
    tuning.stormShieldGainCapPctMaxShield = phase >= 4 ? 0.09 : 0;
  }

  return tuning;
}
