import { defineShipFrame } from '../base/ShipFrameDefinition.js';
import { SHIP_FRAME_IDS } from '../ShipFrameIds.js';

export const BULWARK_FRAME_DEF = defineShipFrame({
  id: SHIP_FRAME_IDS.BULWARK,
  name: 'Bulwark',
  shortName: 'BW',
  role: 'Frontline',
  difficulty: 'Faible',
  stats: {
    maxHp: 146,
    maxShield: 58,
    maxEnergy: 96,
    energyRegen: 2.9,
    hullRegen: 0.48,
    shieldRegenPerSec: 7,
    shieldRegenDelayOnHit: 3.2,
    engine: 230,
    radius: 18,
    magnetRange: 150,
    baseArmor: 22,
    autoAttackBaseCooldown: 0.90,
    autoAttackBaseDamage: 12,
    damageMult: 0.94,
    fireRateMult: 0.93,
    autoAttackRangeMult: 0.95,
    autoAttackAccuracy: 0.80,
    cargoCapacity: 140,
    sensorRange: 950,
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
    hpPct: 0.070,
    shieldPct: 0.057,
    energyPct: 0.031,
    enginePct: 0.010,
    armorPct: 0.023,
    damagePct: 0.009,
    fireRatePct: 0.007,
    hullRegenPct: 0.022,
    energyRegenPct: 0.005
  },
  abilities: {
    A: { key: 'A', label: 'Carapace hérissée' },
    Z: { key: 'Z', label: "Harpon d'opprobre" },
    E: { key: 'E', label: 'Méditation blindée' },
    R: { key: 'R', label: 'Tempête de siphon' }
  }
});
