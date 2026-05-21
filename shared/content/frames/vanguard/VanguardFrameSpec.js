export const VANGUARD_PASSIVE = Object.freeze({
  maxStacks: 10,
  stackDuration: 5,
  decayInterval: 0.2,
  attackSpeedPerStack: 0.04,
  moveSpeedPerStack: 0.015,
  slowResistPerStack: 0.015,
  tenacityAtSixPct: 0.20,
  overheatTenacityPct: 0.35,
  overheatTenacityDuration: 0.85
});

const Z_COOLDOWN_BREAKPOINTS = Object.freeze([2, 5, 8, 11, 14, 17, 20, 23, 26, 29]);

export const VANGUARD_DEFAULT_BUILD = Object.freeze({
  A: 15,
  Z: 15,
  E: 15,
  R: 5
});

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function countBreakpoints(investedLevel) {
  let count = 0;
  for (const bp of Z_COOLDOWN_BREAKPOINTS) if (investedLevel >= bp) count += 1;
  return count;
}

function getNonUltSkillLevel(investedLevel) {
  return 1 + (investedLevel - 1) * (29 / 14);
}

function getPhase(slot, investedLevel) {
  if (slot === 'R') return clamp(investedLevel, 1, 5);
  if (investedLevel >= 15) return 5;
  if (investedLevel >= 10) return 4;
  if (investedLevel >= 6) return 3;
  if (investedLevel >= 3) return 2;
  return 1;
}

export function getDefaultVanguardInvestedLevel(slot) {
  return VANGUARD_DEFAULT_BUILD[slot] ?? 1;
}

export function getVanguardAbilityTuning(slot, investedLevel = getDefaultVanguardInvestedLevel(slot), totalArmor = 0) {
  const maxLevel = slot === 'R' ? 5 : 15;
  investedLevel = clamp(Math.round(investedLevel || 1), 1, maxLevel);
  const phase = getPhase(slot, investedLevel);
  const skillLevel = slot === 'R' ? investedLevel : getNonUltSkillLevel(investedLevel);

  const tuning = {
    investedLevel,
    phase,
    totalArmor,
    passive: VANGUARD_PASSIVE,
    energyCost: 0,
    baseCooldown: 0,
    castTime: 0,
    projectileRange: 0,
    projectileWidth: 0,
    projectileSpeed: 0,
    damagePct: 0,
    damageFlat: 0,
    pierceCount: 0,
    damageAmpPct: 0,
    damageAmpDuration: 0,
    refundEnergyOnCrowdControlledTarget: 0,
    disarmDuration: 0,
    empowerCharges: 0,
    empowerPct: 0,
    empowerFlat: 0,
    dashDistance: 0,
    moveBoostDuration: 0,
    moveBoostPct: 0,
    trailSlowPct: 0,
    trailSlowDuration: 0,
    comboWindowDuration: 0,
    comboProjectileSpeedPct: 0,
    comboDamagePct: 0,
    cleanseSlowAndRoot: false,
    cooldownRefundPct: 0,
    phaseDuration: 0,
    damageReductionPct: 0,
    spellShieldDuration: 0,
    exitRadius: 0,
    groundedDuration: 0,
    exitShieldPctMaxShield: 0,
    restoreAChargeOnMaxHeat: false,
    ultDuration: 0,
    ultAttackSpeedPct: 0,
    ultMoveSpeedPct: 0,
    ultEmpowerPct: 0,
    ultBurnFlat: 0,
    ultBurnWeaponPct: 0,
    ultBurnDuration: 0,
    ultCloseEnergyRestore: 0,
    ultCloseEnergyRange: 0,
    ultCloseAStunDuration: 0,
    ultCloseAStunRange: 0,
    empRadius: 0,
    empStunDuration: 0,
    secondaryWaveDamagePct: 0,
    unstoppableDuration: 0,
    extensionDuration: 0,
    extensionMaxBonusDuration: 0
  };

  if (slot === 'A') {
    tuning.castTime = 0.08;
    tuning.projectileRange = 720;
    tuning.projectileWidth = 22 + 0.30 * Math.floor((skillLevel - 1) * 0.5);
    tuning.projectileSpeed = 1100;
    tuning.energyCost = 10;
    tuning.baseCooldown = Math.max(3.4, 5.0 - 0.05 * Math.floor((skillLevel - 1) / 3));
    tuning.damagePct = 0.70 + 0.02 * (skillLevel - 1);
    tuning.damageFlat = 10 + 2 * (skillLevel - 1);
    tuning.empowerCharges = phase;
    tuning.empowerPct = 0.22 + 0.012 * (skillLevel - 1);
    tuning.empowerFlat = 4 + 1.1 * (skillLevel - 1);
    tuning.pierceCount = phase >= 2 ? 1 : 0;
    tuning.damageAmpPct = phase >= 3 ? 0.08 : 0;
    tuning.damageAmpDuration = phase >= 3 ? 2.0 : 0;
    tuning.refundEnergyOnCrowdControlledTarget = phase >= 4 ? 8 : 0;
    tuning.disarmDuration = phase >= 5 ? 0.55 : 0;
    return Object.freeze(tuning);
  }

  if (slot === 'Z') {
    tuning.dashDistance = 180 + 4 * (skillLevel - 1);
    tuning.energyCost = 14;
    tuning.baseCooldown = Math.max(12.5, 14 - 0.15 * countBreakpoints(Math.round(skillLevel)));
    tuning.moveBoostPct = 0.22 + 0.006 * (skillLevel - 1);
    tuning.moveBoostDuration = 2.0 + 0.03 * (skillLevel - 1);
    tuning.trailSlowPct = phase >= 2 ? 0.18 : 0;
    tuning.trailSlowDuration = phase >= 2 ? 1.2 : 0;
    tuning.comboWindowDuration = phase >= 3 ? 1.5 : 0;
    tuning.comboProjectileSpeedPct = phase >= 3 ? 0.20 : 0;
    tuning.comboDamagePct = phase >= 3 ? 0.12 : 0;
    tuning.cleanseSlowAndRoot = phase >= 4;
    tuning.cooldownRefundPct = phase >= 5 ? 0.35 : 0;
    return Object.freeze(tuning);
  }

  if (slot === 'E') {
    tuning.castTime = 0.05;
    tuning.energyCost = 18;
    tuning.baseCooldown = Math.max(13.5, 18 - 0.12 * Math.floor((skillLevel - 1) / 3));
    tuning.phaseDuration = skillLevel <= 21 ? 0.45 + 0.02 * (skillLevel - 1) : 0.85 + 0.01 * (skillLevel - 21);
    tuning.damageReductionPct = 0.35 + 0.006 * Math.floor((skillLevel - 1) * 0.5);
    tuning.spellShieldDuration = phase >= 2 ? 0.45 : 0;
    tuning.exitRadius = phase >= 3 ? 90 : 0;
    tuning.groundedDuration = phase >= 3 ? 0.8 : 0;
    tuning.exitShieldPctMaxShield = phase >= 4 ? 0.10 + 0.004 * Math.max(0, skillLevel - 12) : 0;
    tuning.restoreAChargeOnMaxHeat = phase >= 5;
    return Object.freeze(tuning);
  }

  tuning.energyCost = 45;
  tuning.baseCooldown = Math.max(58, 72 - 0.5 * Math.floor((investedLevel - 1) / 2));
  tuning.ultDuration = 6.0;
  tuning.ultAttackSpeedPct = 0.16 + 0.008 * (investedLevel - 1);
  tuning.ultMoveSpeedPct = 0.10 + 0.005 * (investedLevel - 1);
  tuning.ultEmpowerPct = 0.08 + 0.0045 * (investedLevel - 1);
  tuning.ultBurnFlat = 10;
  tuning.ultBurnWeaponPct = 0.25;
  tuning.ultBurnDuration = phase >= 2 ? 1.8 : 0;
  tuning.unstoppableDuration = phase >= 3 ? 0.35 : 0;
  tuning.ultCloseEnergyRestore = phase >= 4 ? 3 : 0;
  tuning.ultCloseEnergyRange = phase >= 4 ? 160 : 0;
  tuning.ultCloseAStunDuration = phase >= 5 ? 0.45 : 0;
  tuning.ultCloseAStunRange = phase >= 5 ? 200 : 0;
  tuning.extensionDuration = 0.8;
  tuning.extensionMaxBonusDuration = 2.4;
  return Object.freeze(tuning);
}
