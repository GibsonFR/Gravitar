import { getShipFrameDef } from '../../../../shared/content/frames/ShipFrameRegistry.js';

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
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
    levelScaling: { ...scale }
  };

  if (extraLv <= 0) {
    out.level = clamp(level | 0, 1, 99);
    return out;
  }

  out.maxHp *= 1 + (scale.hpPct ?? 0) * extraLv * 1.30;
  out.maxShield *= 1 + (scale.shieldPct ?? 0) * extraLv * 1.35;
  out.maxEnergy *= 1 + (scale.energyPct ?? 0) * extraLv * 1.25;
  out.engine *= 1 + (scale.enginePct ?? 0) * extraLv * 0.30;
  out.damageMult *= 1 + (scale.damagePct ?? 0) * extraLv * 1.75;
  out.fireRateMult *= 1 + (scale.fireRatePct ?? 0) * extraLv * 1.90;
  out.hullRegen *= 1 + (scale.hullRegenPct ?? 0) * extraLv * 1.60;
  out.energyRegen *= 1 + (scale.energyRegenPct ?? 0) * extraLv * 10.00;
  out.autoAttackBaseCooldown = Math.max(0.24, out.autoAttackBaseCooldown * (1 - 0.0065 * extraLv));
  out.level = clamp(level | 0, 1, 99);
  return out;
}
