export const SIGIL_PASSIVE = Object.freeze({
  maxRunes: 5,
  runeDuration: 7,
  runeDamageFlatPerRune: 2,
  runeDamageWeaponPctPerRune: 0.08,
  slowThreshold: 3,
  slowPct: 0.12,
  detonationThreshold: 5,
  detonationConsumeRunes: 5,
  detonationCooldown: 1.2,
  detonationBonusFlat: 18,
  detonationBonusWeaponPct: 0.45,
  detonationBonusCurrentEnergyPct: 0.06
});

const PHASE_POINTS = Object.freeze([1, 3, 6, 10, 15]);

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function getNormalSkillLevel(investedLevel) {
  investedLevel = clamp(investedLevel, 1, 15);
  return 1 + (investedLevel - 1) * (29 / 14);
}

function getUltimateSkillLevel(investedLevel) {
  return clamp(investedLevel, 1, 5);
}

function getPhase(slot, investedLevel) {
  if (slot === 'R') return clamp(investedLevel, 1, 5);
  if (investedLevel >= PHASE_POINTS[4]) return 5;
  if (investedLevel >= PHASE_POINTS[3]) return 4;
  if (investedLevel >= PHASE_POINTS[2]) return 3;
  if (investedLevel >= PHASE_POINTS[1]) return 2;
  return 1;
}

export function getSigilAbilityTuning(slot, investedLevel = 1) {
  const maxLevel = slot === 'R' ? 5 : 15;
  investedLevel = clamp(Math.round(investedLevel || 1), 1, maxLevel);
  const phase = getPhase(slot, investedLevel);
  const lvl = slot === 'R' ? getUltimateSkillLevel(investedLevel) : getNormalSkillLevel(investedLevel);

  const tuning = {
    investedLevel,
    phase,
    passive: SIGIL_PASSIVE,
    energyCost: 0,
    baseCooldown: 0,
    castTime: 0,
    aProjectileRange: 0,
    aProjectileWidth: 0,
    aProjectileSpeed: 0,
    aImpactDamageFlat: 0,
    aImpactDamagePct: 0,
    aPierceCount: 0,
    aImpactRunes: 1,
    aRevealThreshold: phase >= 3 ? 3 : 0,
    aRevealDuration: phase >= 3 ? 1.6 : 0,
    aHealCutThreshold: phase >= 4 ? 5 : 0,
    aHealCutPct: phase >= 4 ? 0.30 : 0,
    aHealCutDuration: phase >= 4 ? 2.5 : 0,
    aDetonationStasisDuration: phase >= 5 ? 0.40 : 0,
    zRunePulseInterval: 1,
    zRunePulseStacks: phase >= 2 ? 1 : 0,
    zCanRecastClose: phase >= 3,
    zClosePullStrength: phase >= 4 ? 120 : 0,
    zCloseControlThresholdRunes: 3,
    zCloseSuppressDuration: phase >= 5 ? 0.7 : 0,
    eTrailSlowPct: phase >= 2 ? 0.18 : 0,
    eTrailSlowDuration: phase >= 2 ? 1.2 : 0,
    aEmpowerFromVeilDamagePct: phase >= 3 ? 0.14 : 0,
    eSpellShieldOnEndDuration: phase >= 4 ? 0.40 : 0,
    eGroundedDurationOnMaxRunes: phase >= 5 ? 0.8 : 0,
    eGroundedCheckRadius: 260,
    ultRevealOnAHitDuration: phase >= 2 ? 2.0 : 0,
    ultHealCutThresholdRunes: phase >= 3 ? 4 : 0,
    ultHealCutPct: phase >= 3 ? 0.30 : 0,
    ultHealCutDuration: phase >= 3 ? 2.0 : 0,
    ultZoneCamouflageDuration: phase >= 4 ? 0.45 : 0,
    ultDetonationStunDuration: phase >= 5 ? 0.35 : 0,
    zCastRange: 0,
    zZoneRadius: 0,
    zZoneDuration: 0,
    zZoneDamageFlatPerSecond: 0,
    zZoneDamageWeaponPctPerSecond: 0,
    zZoneSlowPct: 0,
    eDashDistance: 0,
    eCamouflageDuration: 0,
    eTrailDuration: 0,
    ultDuration: 0,
    ultRuneDurationBonusPct: 0,
    ultACooldownMultiplier: 1,
    ultLifestealPct: 0
  };

  if (slot === 'A') {
    tuning.castTime = 0.12;
    tuning.energyCost = 14;
    tuning.baseCooldown = Math.max(3.7, 5.8 - 0.07 * (lvl - 1));
    tuning.aProjectileRange = 760;
    tuning.aProjectileWidth = 26 + 0.4 * Math.floor((lvl - 1) * 0.5);
    tuning.aProjectileSpeed = 1260;
    tuning.aImpactDamageFlat = 12 + 2.4 * (lvl - 1);
    tuning.aImpactDamagePct = 0.62 + 0.018 * (lvl - 1);
    tuning.aPierceCount = phase >= 2 ? 32 : 0;
  } else if (slot === 'Z') {
    tuning.energyCost = 20;
    tuning.baseCooldown = Math.max(13.6, 16 - 0.08 * (lvl - 1));
    tuning.zCastRange = 420;
    tuning.zZoneRadius = 110 + 2.5 * (lvl - 1);
    tuning.zZoneDuration = 4.8 + 0.08 * (lvl - 1);
    tuning.zZoneDamageFlatPerSecond = 7 + 1.4 * (lvl - 1);
    tuning.zZoneDamageWeaponPctPerSecond = 0.24 + 0.016 * (lvl - 1);
    tuning.zZoneSlowPct = 0.22;
  } else if (slot === 'E') {
    tuning.energyCost = 24;
    tuning.baseCooldown = Math.max(15.1, 18 - 0.10 * (lvl - 1));
    tuning.eDashDistance = 150 + 5 * (lvl - 1);
    tuning.eCamouflageDuration = 0.75 + 0.03 * (lvl - 1);
    tuning.eTrailDuration = 1.2 + 0.03 * (lvl - 1);
  } else if (slot === 'R') {
    tuning.energyCost = 38;
    tuning.baseCooldown = Math.max(57, 70 - 0.45 * (lvl - 1));
    tuning.ultDuration = 5.6;
    tuning.ultRuneDurationBonusPct = 0.30 + 0.009 * (lvl - 1);
    tuning.ultACooldownMultiplier = Math.max(0.66, 0.78 - 0.008 * Math.floor((lvl - 1) / 2));
    tuning.ultLifestealPct = 0.06 + 0.0055 * (lvl - 1);
  }

  return tuning;
}
