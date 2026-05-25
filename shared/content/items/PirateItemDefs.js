import { ITEM_CATEGORY_IDS } from './ItemCategoryIds.js';
import { ITEM_TAG_IDS } from './ItemTagIds.js';

const BLACK = Object.freeze({ r: 255, g: 94, b: 168 });
const ORANGE = Object.freeze({ r: 255, g: 170, b: 82 });
const CYAN = Object.freeze({ r: 96, g: 232, b: 255 });
const GREEN = Object.freeze({ r: 120, g: 255, b: 160 });

export const PIRATE_ITEM_DEFS = Object.freeze({
  'pirate-ironmaw-cannon': {
    id: 'pirate-ironmaw-cannon',
    pirateOnly: true,
    source: 'pirate',
    shopOffer: true,
    name: 'Canon Mange-Fer',
    shortName: 'Mange-Fer',
    categoryId: ITEM_CATEGORY_IDS.WEAPON,
    tier: 3,
    priceCredits: 980,
    tags: [{ tagId: ITEM_TAG_IDS.REAVER, points: 3 }, { tagId: ITEM_TAG_IDS.SIEGE, points: 1 }],
    bonuses: { damageMultPct: 0.12, armorPenFlat: 18, energyRegenFlat: -0.25 },
    weaponProfile: {
      damage: 31,
      cooldown: 1.05,
      projectileSpeed: 1040,
      range: 1040,
      energyCost: 5.2,
      tint: BLACK
    },
    passives: ['Arme pirate lourde : gros impact, coût énergétique élevé.'],
    description: 'Canon de contrebande soudé sur des pièces récupérées. Très fort contre les coques, mais gourmand.'
  },
  'pirate-blackleak-needler': {
    id: 'pirate-blackleak-needler',
    pirateOnly: true,
    source: 'pirate',
    shopOffer: true,
    name: 'Aiguilleur Fuite Noire',
    shortName: 'Fuite Noire',
    categoryId: ITEM_CATEGORY_IDS.WEAPON,
    tier: 4,
    priceCredits: 1680,
    tags: [{ tagId: ITEM_TAG_IDS.SIPHON, points: 3 }, { tagId: ITEM_TAG_IDS.VERGE, points: 2 }],
    bonuses: { fireRatePct: 0.16, lifestealPct: 0.05, hpFlat: -18 },
    weaponProfile: {
      damage: 17,
      cooldown: 0.36,
      projectileSpeed: 1280,
      range: 850,
      energyCost: 3.6,
      tint: GREEN
    },
    passives: ['Cadence illégale : sustain offensif, coque maximale réduite.'],
    description: 'Une arme instable qui transforme la pression continue en survie, au prix d’un châssis fragilisé.'
  },
  'pirate-contraband-rack': {
    id: 'pirate-contraband-rack',
    pirateOnly: true,
    source: 'pirate',
    shopOffer: true,
    name: 'Lance-roquettes Contrebandier',
    shortName: 'Rack Contrebande',
    categoryId: ITEM_CATEGORY_IDS.LAUNCHER,
    tier: 3,
    priceCredits: 1120,
    tags: [{ tagId: ITEM_TAG_IDS.SIEGE, points: 3 }, { tagId: ITEM_TAG_IDS.REAVER, points: 1 }],
    bonuses: { rocketDamagePct: 0.17, energyFlat: -10 },
    launcherProfile: {
      cooldown: 4.7,
      volley: 2,
      energyCost: 15,
      projectileSpeed: 1030,
      range: 1740,
      splashRadius: 118,
      damageMult: 1.12,
      dispersionDeg: 5,
      tint: ORANGE
    },
    passives: ['Double salve pirate : dégâts élevés, consommation énergétique dangereuse.'],
    description: 'Rack bricolé pour envoyer deux charges sales en rafale. Puissant, mais moins propre qu’un modèle militaire.'
  },
  'pirate-overload-shield': {
    id: 'pirate-overload-shield',
    pirateOnly: true,
    source: 'pirate',
    shopOffer: true,
    name: 'Bouclier Trafiqué',
    shortName: 'Bouclier Trafiqué',
    categoryId: ITEM_CATEGORY_IDS.DEFENSE,
    tier: 3,
    priceCredits: 860,
    tags: [{ tagId: ITEM_TAG_IDS.WARDEN, points: 2 }, { tagId: ITEM_TAG_IDS.SURGE, points: 2 }],
    bonuses: { shieldFlat: 92, energyRegenFlat: -0.35, armorFlat: 10 },
    passives: ['Condensateur trafiqué : beaucoup de bouclier, recharge énergétique plus lente.'],
    description: 'Un bouclier gonflé au-delà des spécifications. Solide, mais il tire sur le réseau énergétique.'
  },
  'pirate-runaway-thruster': {
    id: 'pirate-runaway-thruster',
    pirateOnly: true,
    source: 'pirate',
    shopOffer: true,
    name: 'Propulseur Fuite Noire',
    shortName: 'Propulseur Fuite',
    categoryId: ITEM_CATEGORY_IDS.ENGINE,
    tier: 3,
    priceCredits: 920,
    tags: [{ tagId: ITEM_TAG_IDS.VERGE, points: 3 }, { tagId: ITEM_TAG_IDS.SIPHON, points: 1 }],
    bonuses: { enginePct: 0.24, cooldownReductionPct: 0.04, armorFlat: -8 },
    passives: ['Poussée instable : mobilité très haute, blindage réduit.'],
    description: 'Propulseur de fuite utilisé par les cargos pirates. Excellent pour survivre par la vitesse.'
  },
  'pirate-illegal-overdrive': {
    id: 'pirate-illegal-overdrive',
    pirateOnly: true,
    source: 'pirate',
    shopOffer: true,
    name: 'Module Surcharge Illégale',
    shortName: 'Surcharge Illégale',
    categoryId: ITEM_CATEGORY_IDS.MODULE,
    tier: 4,
    priceCredits: 1550,
    tags: [{ tagId: ITEM_TAG_IDS.SURGE, points: 3 }, { tagId: ITEM_TAG_IDS.REAVER, points: 2 }],
    bonuses: { damageMultPct: 0.12, cooldownReductionPct: 0.10, energyRegenFlat: -0.45, hpFlat: -12 },
    passives: ['Surcharge illégale : accélère l’offense, fragilise le vaisseau.'],
    description: 'Module pirate instable qui pousse les cycles au-delà des limites de sécurité.'
  },
  'pirate-stolen-emp-pack': {
    id: 'pirate-stolen-emp-pack',
    pirateOnly: true,
    source: 'pirate',
    shopOffer: true,
    name: 'Roquettes EMP volées',
    shortName: 'EMP volées',
    categoryId: ITEM_CATEGORY_IDS.AMMO,
    tier: 3,
    priceCredits: 390,
    tags: [{ tagId: ITEM_TAG_IDS.SURGE, points: 2 }, { tagId: ITEM_TAG_IDS.SIEGE, points: 1 }],
    bonuses: {},
    ammoProfile: {
      packSize: 6,
      damage: 39,
      splashRadius: 102,
      tint: CYAN,
      effectType: 'stun',
      effectDuration: 0.78,
      effectMagnitude: 0,
      summary: 'EMP 0.8s'
    },
    passives: ['Lot volé : meilleur contrôle que les IEM standards.'],
    description: 'Munitions récupérées sur des cargaisons militaires. Efficaces, chères, peu disponibles.'
  },
  'pirate-unstable-incendiary-pack': {
    id: 'pirate-unstable-incendiary-pack',
    pirateOnly: true,
    source: 'pirate',
    shopOffer: true,
    name: 'Roquettes incendiaires instables',
    shortName: 'Incendiaires inst.',
    categoryId: ITEM_CATEGORY_IDS.AMMO,
    tier: 4,
    priceCredits: 520,
    tags: [{ tagId: ITEM_TAG_IDS.REAVER, points: 2 }, { tagId: ITEM_TAG_IDS.SIEGE, points: 2 }],
    bonuses: {},
    ammoProfile: {
      packSize: 5,
      damage: 43,
      splashRadius: 116,
      tint: ORANGE,
      effectType: 'burn',
      effectDuration: 4.2,
      effectMagnitude: 7.4,
      summary: 'feu 7.4/s 4.2s'
    },
    passives: ['Charge instable : dégâts prolongés élevés, stock limité.'],
    description: 'Roquettes incendiaires trafiquées. Elles brûlent longtemps, mais coûtent cher à sécuriser.'
  }
});
