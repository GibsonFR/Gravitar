import { defineShipFrame } from '../base/ShipFrameDefinition.js';
import { SHIP_FRAME_IDS } from '../ShipFrameIds.js';

export const SIGIL_FRAME_DEF = defineShipFrame({
  id: SHIP_FRAME_IDS.SIGIL,
  name: 'Sigil',
  shortName: 'SG',
  role: 'Contrôle',
  difficulty: 'Élevée',
  stats: {
    maxHp: 108,
    maxShield: 48,
    maxEnergy: 112,
    energyRegen: 3.4,
    hullRegen: 0.30,
    shieldRegenPerSec: 9,
    shieldRegenDelayOnHit: 3,
    engine: 236,
    radius: 18,
    magnetRange: 150,
    baseArmor: 10,
    autoAttackBaseCooldown: 0.78,
    autoAttackBaseDamage: 12.5,
    damageMult: 0.96,
    fireRateMult: 0.95
  },
  levelScaling: {
    hpPct: 0.052,
    shieldPct: 0.044,
    energyPct: 0.045,
    enginePct: 0.013,
    damagePct: 0.016,
    fireRatePct: 0.010,
    hullRegenPct: 0.014,
    energyRegenPct: 0.006
  },
  abilities: {
    A: { key: 'A', label: 'Impulsion runique' },
    Z: { key: 'Z', label: "Sceau d'enfermement" },
    E: { key: 'E', label: 'Voile fractal' },
    R: { key: 'R', label: 'Convergence runique' }
  }
});
