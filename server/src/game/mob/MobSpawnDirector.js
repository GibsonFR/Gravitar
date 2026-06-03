import { listMobDefs } from '../../../../shared/content/mobs/MobDefs.js';
import { sectorFrontierLevel } from '../sector/SectorMath.js';
import { SECTOR } from '../sector/SectorDefs.js';
import { spawnMob } from './MobFactory.js';

const FRONTIER_MAX = 50;

// Courbe voulue pour la version .io : le contenu procédural normal est pensé
// sur une frontière 0→50. Dans les secteurs -10..10, on doit croiser surtout
// les trois familles faibles. Les familles intermédiaires remplacent peu à peu
// les anciennes, mais les anciennes restent possibles en versions mutées/élites.
// L'Apex normal n'arrive qu'à partir du ring 50.
const MOB_FRONTIER_UNLOCKS_BY_TYPE = new Map([
  [1, 1],   // Mite ferreuse
  [2, 1],   // Sapeur de scories — early variety
  [3, 2],   // Dard orbital
  [4, 5],   // Lancier prismatique
  [5, 8],   // Nodule sentinelle
  [6, 11],  // Broyeur plasma
  [7, 15],  // Gardien arc
  [8, 19],  // Spectre vectoriel
  [9, 24],  // Hydre de limaille
  [10, 34]  // Prédateur apex
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rollPos(rng) {
  const min = -SECTOR.half + SECTOR.spawnMargin + 100;
  const max = SECTOR.half - SECTOR.spawnMargin - 100;
  return min + rng.nextDouble() * (max - min);
}

function frontierUnlock(def) {
  return MOB_FRONTIER_UNLOCKS_BY_TYPE.get(def.typeId | 0) ?? (def.sectorMinLevel ?? 1);
}

function mobSpawnWeight(def, frontierLevel) {
  const unlock = frontierUnlock(def);
  if (frontierLevel < unlock) return 0;

  const age = frontierLevel - unlock;
  const base = Math.max(1, def.spawnWeight ?? 1);

  // Pic fort au moment où la famille devient disponible, puis décroissance.
  // Les vieux mobs ne disparaissent jamais complètement, mais deviennent rares.
  let weight = base * (4.2 * Math.exp(-age / 13) + 0.30);

  // Dès les premiers secteurs, on doit voir plusieurs familles.
  // Les trois premiers mobs forment le pool early, avec dominance mite
  // mais sans bloquer scoria/stinger pendant plusieurs rings.
  if (frontierLevel <= 4) {
    const early = [0, 1.20, 0.74, 0.54][def.typeId | 0] ?? 0;
    weight *= early;
  } else if (frontierLevel <= 10 && (def.typeId | 0) <= 5) {
    weight *= [0, 1.08, 0.95, 0.82, 0.42, 0.30][def.typeId | 0] ?? 1;
  }

  // Les familles trop anciennes au late restent lisibles seulement comme bruit
  // de fond. Les variantes mutées/élites porteront leur intérêt.
  if (age > 24) weight *= 0.42;
  if (age > 34) weight *= 0.55;

  // L'Apex ne doit jamais apparaître avant le ring 50 en version normale.
  if ((def.typeId | 0) === 10 && frontierLevel < FRONTIER_MAX) return 0;

  return Math.max(0, weight);
}

function pickMobDefForFrontier(rng, frontierLevel) {
  const defs = listMobDefs().slice().sort((a, b) => (a.typeId ?? 0) - (b.typeId ?? 0));
  let total = 0;
  const weighted = [];
  for (const def of defs) {
    const weight = mobSpawnWeight(def, frontierLevel);
    if (weight <= 0) continue;
    total += weight;
    weighted.push({ def, weight });
  }
  if (!weighted.length) return defs[0] ?? null;

  let roll = rng.nextDouble() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.def;
  }
  return weighted[weighted.length - 1].def;
}

function rollMobVariant(rng, frontierLevel, def) {
  const unlock = frontierUnlock(def);
  const age = Math.max(0, frontierLevel - unlock);
  const oldFamily = age >= 16;

  const mutatedChance = clamp(0.018 + frontierLevel * 0.0035 + (oldFamily ? 0.08 : 0) + age * 0.002, 0.02, 0.34);
  const eliteChance = clamp(0.010 + frontierLevel * 0.0020 + (oldFamily ? 0.035 : 0) + age * 0.0012, 0.01, 0.20);

  const elite = rng.nextDouble() < eliteChance;
  const mutated = !elite && rng.nextDouble() < mutatedChance;
  return { mutated, elite };
}

export function spawnSectorMobs(state, sx, sy, rng, sectorSeed, timeMs = 0) {
  const mapLevel = sectorFrontierLevel(sx, sy);
  if (mapLevel <= 0) return 0;

  const frontierLevel = clamp(mapLevel, 1, FRONTIER_MAX);
  const baseCount = 2 + Math.min(5, Math.floor(frontierLevel / 8));
  const mobCount = baseCount + rng.nextRange(0, 2) + Math.min(3, Math.floor(frontierLevel / 18));
  let spawned = 0;

  for (let i = 0; i < mobCount; i++) {
    let def = pickMobDefForFrontier(rng, frontierLevel);
    if (i === 1 && frontierLevel <= 5) {
      const earlyDefs = listMobDefs()
        .filter((d) => (d.typeId | 0) > 1 && mobSpawnWeight(d, frontierLevel) > 0)
        .sort((a, b) => (a.typeId | 0) - (b.typeId | 0));
      if (earlyDefs.length) def = earlyDefs[Math.floor(rng.nextDouble() * earlyDefs.length)] || def;
    }
    if (!def) continue;
    const x = rollPos(rng);
    const y = rollPos(rng);
    const variant = rollMobVariant(rng, frontierLevel, def);
    spawnMob(state, sx, sy, def.id, x, y, {
      seed: sectorSeed ^ ((i + 1) * 2654435761),
      mapLevel: frontierLevel,
      elite: variant.elite,
      mutated: variant.mutated,
      spawnTimeMs: timeMs
    });
    spawned += 1;
  }

  return spawned;
}

export function getMobFrontierUnlocks() {
  return new Map(MOB_FRONTIER_UNLOCKS_BY_TYPE);
}
