import { SECTOR } from '../world/SectorDefs.js';

export function worldToSectorCoord(v) {
  return Math.floor((v + SECTOR.half) / SECTOR.size);
}

export function worldToSectorYCoord(y) {
  // En canvas/world space, y augmente vers le bas. Pour l'interface du jeu,
  // on veut l'inverse : monter dans le monde doit augmenter sy.
  return -worldToSectorCoord(y);
}

export function computeSector(x, y) {
  return { sx: worldToSectorCoord(x), sy: worldToSectorYCoord(y) };
}

export function wrapIntoSector(pos, sx, sy) {
  let x = pos.x;
  let y = pos.y;
  let nsx = sx | 0;
  let nsy = sy | 0;

  while (x < -SECTOR.half) { x += SECTOR.size; nsx -= 1; }
  while (x > SECTOR.half) { x -= SECTOR.size; nsx += 1; }

  // Convention finale :
  // - monter à l'écran / dans le monde correspond à y < -half et augmente sy ;
  // - descendre correspond à y > half et diminue sy.
  while (y < -SECTOR.half) { y += SECTOR.size; nsy += 1; }
  while (y > SECTOR.half) { y -= SECTOR.size; nsy -= 1; }

  return { x, y, sx: nsx, sy: nsy };
}

export function sectorFrontierLevel(sx, sy) {
  // Same session-frontier convention as the Windows version: the playable
  // difficulty ring is the Chebyshev distance from [0,0], capped at 50.
  // Sectors beyond that can exist, but normal procedural content should not
  // keep scaling infinitely or unlock mobs earlier/later than the intended
  // 0→50 frontier curve.
  const f = Math.max(Math.abs(sx), Math.abs(sy));
  return Math.min(50, Math.max(1, f));
}
