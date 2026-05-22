import { spawnLootInSector } from '../loot/LootFactory.js';

export function dropMobLoot(state, mob, timeMs) {
  if (!mob?.dropResource || mob.noLoot || (mob.summonGeneration | 0) > 0) return 0;
  const count = Math.max(0, (mob.dropMin | 0) + (((mob.dropMax | 0) - (mob.dropMin | 0) + 1) > 0 ? ((Math.random() * (((mob.dropMax | 0) - (mob.dropMin | 0) + 1))) | 0) : 0));
  let spawned = 0;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 55;
    const id = spawnLootInSector(
      state,
      mob.sx | 0,
      mob.sy | 0,
      mob.x,
      mob.y,
      mob.dropResource,
      timeMs,
      'mob',
      mob.id,
      { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }
    );
    if (id) spawned += 1;
  }
  return spawned;
}
