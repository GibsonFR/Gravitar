export function createStatBlock(def = {}) {
  return {
    hp: def.maxHp ?? 0,
    maxHp: def.maxHp ?? 0,
    shield: def.maxShield ?? 0,
    maxShield: def.maxShield ?? 0,
    energy: def.maxEnergy ?? 0,
    maxEnergy: def.maxEnergy ?? 0,
    energyRegen: def.energyRegen ?? 0,
    hullRegen: def.hullRegen ?? 0,
    shieldRegenPerSec: def.shieldRegenPerSec ?? 0,
    shieldRegenDelayOnHit: def.shieldRegenDelayOnHit ?? 0,
    shieldRegenDelayLeft: 0
  };
}
