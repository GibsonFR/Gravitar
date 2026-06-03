import { spawnLootInSector } from '../loot/LootFactory.js';

function randomCount(min = 1, max = 1) {
  const lo = Math.max(0, min | 0);
  const hi = Math.max(lo, max | 0);
  return lo + (((hi - lo + 1) > 0 ? (Math.random() * (hi - lo + 1)) | 0 : 0));
}

function spawnOneLoot(state, mob, resource, timeMs) {
  if (!resource) return 0;
  const angle = Math.random() * Math.PI * 2;
  const speed = 35 + Math.random() * 55;
  const id = spawnLootInSector(
    state,
    mob.sx | 0,
    mob.sy | 0,
    mob.x,
    mob.y,
    resource,
    timeMs,
    'mob',
    mob.id,
    { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }
  );
  return id ? 1 : 0;
}

export function dropMobLoot(state, mob, timeMs) {
  if ((!mob?.dropResource && !Array.isArray(mob?.dropTable)) || mob.noLoot || (mob.summonGeneration | 0) > 0) return 0;

  let spawned = 0;
  const table = Array.isArray(mob.dropTable) ? mob.dropTable : null;

  if (table?.length) {
    for (const row of table) {
      const chance = Math.max(0, Math.min(1, Number(row?.chance ?? 1)));
      if (chance < 1 && Math.random() > chance) continue;
      const count = randomCount(row?.min ?? row?.count ?? 1, row?.max ?? row?.count ?? 1);
      for (let i = 0; i < count; i += 1) spawned += spawnOneLoot(state, mob, row.resource || row.key, timeMs);
    }
    return spawned;
  }

  const count = randomCount(mob.dropMin, mob.dropMax);
  for (let i = 0; i < count; i += 1) spawned += spawnOneLoot(state, mob, mob.dropResource, timeMs);
  return spawned;
}
