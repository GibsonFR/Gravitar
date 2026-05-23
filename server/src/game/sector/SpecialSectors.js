import { BASTION_INTERIOR_SY } from '../bastion/BastionSession.js';
import { isBattleArenaSector } from '../modes/GameModes.js';

export const SPECIAL_SECTORS = {
  TEST_HUB: { sx: 9100, sy: -9100 },
  TEST_EFFECTS: { sx: 9103, sy: -9100 },
  TEST_FOUNDATIONS: { sx: 9104, sy: -9100 },
  TEST_ARENA: { sx: 9103, sy: -9100 },
  STRESS_ARENA: { sx: 9102, sy: -9100 },
  MOB_BESTIARY: { sx: 9101, sy: -9100 },
  MOB_FAMILY_BASE: { sx: 9200, sy: -9100 },
  MOB_HYPER_LATE: { sx: 9210, sy: -9100 }
};

export function isBastionInteriorSector(sx, sy) {
  return (sy | 0) === BASTION_INTERIOR_SY && (sx | 0) >= 9000;
}

export function isSpecialDetachedSector(sx, sy) {
  sx |= 0;
  sy |= 0;
  if (isBastionInteriorSector(sx, sy)) return true;
  if (isBattleArenaSector(sx, sy)) return true;
  if (sy !== SPECIAL_SECTORS.TEST_ARENA.sy) return false;
  if (sx === SPECIAL_SECTORS.TEST_HUB.sx) return true;
  if (sx === SPECIAL_SECTORS.TEST_EFFECTS.sx) return true;
  if (sx === SPECIAL_SECTORS.TEST_FOUNDATIONS.sx) return true;
  if (sx === SPECIAL_SECTORS.MOB_BESTIARY.sx) return true;
  if (sx === SPECIAL_SECTORS.STRESS_ARENA.sx) return true;
  if (sx === SPECIAL_SECTORS.MOB_HYPER_LATE.sx) return true;
  const familyIndex = sx - SPECIAL_SECTORS.MOB_FAMILY_BASE.sx;
  return familyIndex >= 0 && familyIndex < 10;
}

export function isSafeNoPvpSector(sx, sy) {
  return (sx | 0) === 0 && (sy | 0) === 0;
}
