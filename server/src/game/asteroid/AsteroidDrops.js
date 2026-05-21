import { spawnLootBurstInSector } from '../loot/LootBurst.js';

export function spawnAsteroidDrops(state, asteroid, timeMs) {
  const count = Math.max(0, asteroid.yieldValue | 0);
  if (count <= 0) return;

  spawnLootBurstInSector(state, asteroid.sx, asteroid.sy, asteroid.x, asteroid.y, asteroid.resource, count, timeMs, 'asteroid', asteroid.id, {
    offsetRadius: 8,
    speedBase: 45,
    speedJitter: 30
  });
}
