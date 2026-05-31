import { getShipFrameDef } from '../../../../shared/content/frames/ShipFrameRegistry.js';

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function scaleLinear(base, pct, extraLv) {
  return (base ?? 0) * (1 + (pct ?? 0) * extraLv);
}

function scaleAdd(base, perLevel, extraLv) {
  return (base ?? 0) + (perLevel ?? 0) * extraLv;
}

export function resolveFrameStats(frameId, level = 1) {
  const def = getShipFrameDef(frameId);
  const base = def.stats ?? {};
  const scale = def.levelScaling ?? {};
  const extraLv = Math.max(0, (level | 0) - 1);

  const out = {
    ...base,
    maxHp: base.maxHp ?? 0,
    maxShield: base.maxShield ?? 0,
    maxEnergy: base.maxEnergy ?? 0,
    energyRegen: base.energyRegen ?? 0,
    hullRegen: base.hullRegen ?? 0,
    shieldRegenPerSec: base.shieldRegenPerSec ?? 0,
    shieldRegenDelayOnHit: base.shieldRegenDelayOnHit ?? 0,
    engine: base.engine ?? 0,
    radius: base.radius ?? 18,
    magnetRange: base.magnetRange ?? 150,
    baseArmor: base.baseArmor ?? 0,
    autoAttackBaseCooldown: base.autoAttackBaseCooldown ?? 0.70,
    autoAttackBaseDamage: base.autoAttackBaseDamage ?? 13,
    damageMult: base.damageMult ?? 1,
    fireRateMult: base.fireRateMult ?? 1,
    autoAttackRangeMult: base.autoAttackRangeMult ?? 1,
    autoAttackAccuracy: base.autoAttackAccuracy ?? 0.82,
    cargoCapacity: base.cargoCapacity ?? 60,
    sensorRange: base.sensorRange ?? 900,
    critChance: base.critChance ?? 0,
    critDamageMult: base.critDamageMult ?? 1.50,
    lifestealRatio: base.lifestealRatio ?? 0,
    tenacity: base.tenacity ?? 0,
    slowResist: base.slowResist ?? 0,
    healCutPct: base.healCutPct ?? 0,
    armorShredPct: base.armorShredPct ?? 0,
    antiShieldPct: base.antiShieldPct ?? 0,
    levelScaling: { ...scale }
  };

  if (extraLv > 0) {
    out.maxHp = scaleLinear(out.maxHp, scale.hpPct, extraLv);
    out.maxShield = scaleLinear(out.maxShield, scale.shieldPct, extraLv);
    out.maxEnergy = scaleLinear(out.maxEnergy, scale.energyPct, extraLv);
    out.engine = scaleLinear(out.engine, scale.enginePct, extraLv);
    out.baseArmor = scaleLinear(out.baseArmor, scale.armorPct, extraLv);
    out.damageMult = scaleLinear(out.damageMult, scale.damagePct, extraLv);
    out.fireRateMult = scaleLinear(out.fireRateMult, scale.fireRatePct, extraLv);
    out.autoAttackRangeMult = scaleLinear(out.autoAttackRangeMult, scale.autoRangePct, extraLv);
    out.autoAttackAccuracy = scaleAdd(out.autoAttackAccuracy, scale.accuracyPct, extraLv);
    out.hullRegen = scaleLinear(out.hullRegen, scale.hullRegenPct, extraLv);
    out.energyRegen = scaleLinear(out.energyRegen, scale.energyRegenPct, extraLv);
    out.critChance = scaleAdd(out.critChance, scale.critChancePct, extraLv);
    out.critDamageMult = scaleAdd(out.critDamageMult, scale.critDamageMult, extraLv);
    out.lifestealRatio = scaleAdd(out.lifestealRatio, scale.lifestealPct, extraLv);
    out.tenacity = scaleAdd(out.tenacity, scale.tenacityPct, extraLv);
    out.slowResist = scaleAdd(out.slowResist, scale.slowResistPct, extraLv);
    out.healCutPct = scaleAdd(out.healCutPct, scale.healCutPct, extraLv);
    out.armorShredPct = scaleAdd(out.armorShredPct, scale.armorShredPct, extraLv);
    out.antiShieldPct = scaleAdd(out.antiShieldPct, scale.antiShieldPct, extraLv);
  }

  out.autoAttackBaseCooldown = Math.max(0.24, out.autoAttackBaseCooldown);
  out.level = clamp(level | 0, 1, 99);
  return out;
}
