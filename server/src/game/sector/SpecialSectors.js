import { BASTION_INTERIOR_SY } from '../bastion/BastionSession.js';
import { isBattleArenaSector } from '../modes/GameModes.js';

export const SPECIAL_SECTORS = {
  TEST_HUB: { sx: 9100, sy: -9100 },
  TEST_EFFECTS: { sx: 9103, sy: -9100 },
  TEST_FOUNDATIONS: { sx: 9104, sy: -9100 },
  TEST_BIOMES: { sx: 9105, sy: -9100 },
  TEST_BASES: { sx: 9106, sy: -9100 },
  TEST_MINING: { sx: 9107, sy: -9100 },
  TEST_EQUIPMENT: { sx: 9108, sy: -9100 },
  TEST_PIRATE_MARKET: { sx: 9109, sy: -9100 },
  TEST_BIOME_METALLIC: { sx: 9110, sy: -9100, biomeId: 'metallic', label: 'Type M — métallique' },
  TEST_BIOME_SILICATE: { sx: 9111, sy: -9100, biomeId: 'silicate', label: 'Type S — silicaté' },
  TEST_BIOME_ORGANIC: { sx: 9112, sy: -9100, biomeId: 'organic', label: 'Protobiologique' },
  TEST_BIOME_VOLATILE: { sx: 9113, sy: -9100, biomeId: 'volatile', label: 'Volatils glacés' },
  TEST_BIOME_NUCLEAR: { sx: 9114, sy: -9100, biomeId: 'nuclear', label: 'Actinides' },
  TEST_BIOME_ANOMALY: { sx: 9115, sy: -9100, biomeId: 'anomaly', label: 'Débris anciens' },
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
  if (sx === SPECIAL_SECTORS.TEST_BIOMES.sx) return true;
  if (sx === SPECIAL_SECTORS.TEST_BASES.sx) return true;
  if (sx === SPECIAL_SECTORS.TEST_MINING.sx) return true;
  if (sx === SPECIAL_SECTORS.TEST_EQUIPMENT.sx) return true;
  if (sx === SPECIAL_SECTORS.TEST_PIRATE_MARKET.sx) return true;
  if (getTestBiomeSector(sx, sy)) return true;
  if (sx === SPECIAL_SECTORS.MOB_BESTIARY.sx) return true;
  if (sx === SPECIAL_SECTORS.STRESS_ARENA.sx) return true;
  if (sx === SPECIAL_SECTORS.MOB_HYPER_LATE.sx) return true;
  const familyIndex = sx - SPECIAL_SECTORS.MOB_FAMILY_BASE.sx;
  return familyIndex >= 0 && familyIndex < 10;
}

export function isSafeNoPvpSector(sx, sy) {
  return (sx | 0) === 0 && (sy | 0) === 0;
}


export const TEST_BIOME_SECTORS = [
  SPECIAL_SECTORS.TEST_BIOME_METALLIC,
  SPECIAL_SECTORS.TEST_BIOME_SILICATE,
  SPECIAL_SECTORS.TEST_BIOME_ORGANIC,
  SPECIAL_SECTORS.TEST_BIOME_VOLATILE,
  SPECIAL_SECTORS.TEST_BIOME_NUCLEAR,
  SPECIAL_SECTORS.TEST_BIOME_ANOMALY
];

export function getTestBiomeSector(sx, sy) {
  sx |= 0;
  sy |= 0;
  return TEST_BIOME_SECTORS.find((s) => (s.sx | 0) === sx && (s.sy | 0) === sy) || null;
}
