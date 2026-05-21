export const VANGUARD_ABILITY_TUNING = Object.freeze({
  A: Object.freeze({
    cooldown: 2.8,
    energyCost: 14,
    dashRange: 170,
    impactRadius: 96,
    impactDamage: 28,
    hint: 'Impulsion'
  }),
  Z: Object.freeze({
    cooldown: 4.4,
    energyCost: 18,
    projectileDamage: 30,
    projectileRadius: 6,
    projectileSpeed: 1180,
    projectileRange: 1280,
    hint: 'Brèche'
  }),
  E: Object.freeze({
    cooldown: 7.5,
    energyCost: 20,
    castRange: 520,
    zoneRadius: 118,
    duration: 4,
    tickEvery: 0.5,
    tickDamage: 12,
    hint: 'Sceau'
  }),
  R: Object.freeze({
    cooldown: 14,
    energyCost: 36,
    projectileCount: 10,
    projectileDamage: 18,
    projectileRadius: 5,
    projectileSpeed: 920,
    projectileRange: 720,
    hint: 'Déferlante'
  })
});
