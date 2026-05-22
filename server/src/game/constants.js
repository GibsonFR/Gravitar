import { WEAPON_PULSE_MK1, ROCKET_BASIC } from '../../../shared/content/combat/WeaponDefs.js';

export const WORLD = { halfW: 2000, halfH: 2000 };

export const TICK = 1 / 60;
export const SNAP_RATE = 1 / 15;
export const SERVER_LOOP_INTERVAL_MS = 1000 / 120;

export const SNAP_FULL_UI_RATE_MS = 10000;
export const SNAP_VIEW_RADIUS = 1400;
export const SNAP_VIEW_RADIUS_STATIC = 1100;
export const SNAP_STATIC_WORLD_RATE_MS = 2500;
export const SNAP_STATIC_WORLD_RATE_MS_COMBAT = 4500;

export const FACTIONS = {
  PLAYER: 1,
  MOB: 2,
  ASTEROID: -1,
  STATION: -2
};

export { WEAPON_PULSE_MK1, ROCKET_BASIC };
