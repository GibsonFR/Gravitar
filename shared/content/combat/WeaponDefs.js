export const WEAPON_PULSE_MK1 = {
  id: 'pulse_i',
  family: 'pulse',
  damage: 12,
  cooldown: 0.7,
  projectileSpeed: 950,
  range: 780,
  energyCost: 2,
  tint: { r: 0, g: 255, b: 255 }
};

export const ROCKET_BASIC = {
  id: 'rocket_basic',
  family: 'rocket',
  cooldown: 4.2,
  speed: 980,
  damage: 34,
  splashRadius: 92,
  range: 1600,
  energyCost: 8,
  tint: { r: 255, g: 200, b: 120 }
};

export const WEAPON_DEFS = {
  [WEAPON_PULSE_MK1.id]: WEAPON_PULSE_MK1,
  [ROCKET_BASIC.id]: ROCKET_BASIC
};
