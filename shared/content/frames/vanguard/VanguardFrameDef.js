import { defineShipFrame } from '../base/ShipFrameDefinition.js';
import { SHIP_FRAME_IDS } from '../ShipFrameIds.js';

export const VANGUARD_FRAME_DEF = defineShipFrame({
  id: SHIP_FRAME_IDS.VANGUARD,
  name: 'Vanguard',
  shortName: 'VG',
  role: 'Polyvalent',
  difficulty: 'Intermédiaire',
  stats: {
    maxHp: 118,
    maxShield: 42,
    maxEnergy: 100,
    energyRegen: 3.1,
    hullRegen: 0.34,
    shieldRegenPerSec: 8,
    shieldRegenDelayOnHit: 3,
    engine: 250,
    radius: 18,
    magnetRange: 150,
    baseArmor: 12,
    autoAttackBaseCooldown: 0.70,
    autoAttackBaseDamage: 13,
    damageMult: 1,
    fireRateMult: 1,
    autoAttackRangeMult: 1.00,
    autoAttackAccuracy: 0.82,
    cargoCapacity: 130,
    sensorRange: 980,
    critChance: 0,
    critDamageMult: 1.50,
    lifestealRatio: 0,
    tenacity: 0,
    slowResist: 0,
    healCutPct: 0,
    armorShredPct: 0,
    antiShieldPct: 0
  },
  levelScaling: {
    hpPct: 0.060,
    shieldPct: 0.048,
    energyPct: 0.038,
    enginePct: 0.012,
    armorPct: 0.010,
    damagePct: 0.015,
    fireRatePct: 0.010,
    hullRegenPct: 0.018,
    energyRegenPct: 0.005
  },
  abilities: {
    A: { key: 'A', label: 'Percée vectorielle' },
    Z: { key: 'Z', label: 'Postcombustion' },
    E: { key: 'E', label: 'Phase inertielle' },
    R: { key: 'R', label: 'Frénésie de combat' }
  }
});
