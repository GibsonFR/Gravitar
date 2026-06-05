import { randRange } from '../util/Math.js';
import { spawnLootInSector } from './LootFactory.js';

export function spawnLootBurst(state, x, y, lootKey, count, timeMs, sourceKind = '', sourceId = 0, opts = null) {
  return spawnLootBurstInSector(state, 0, 0, x, y, lootKey, count, timeMs, sourceKind, sourceId, opts);
}

export function spawnLootBurstInSector(state, sx, sy, x, y, lootKey, count, timeMs, sourceKind = '', sourceId = 0, opts = null) {
  const n = Math.max(0, count | 0);
  if (n <= 0) return 0;

  const off = Math.max(0, opts?.offsetRadius ?? 6);
  const speedBase = Math.max(0, opts?.speedBase ?? 14);
  const speedJitter = Math.max(0, opts?.speedJitter ?? 10);

  let spawned = 0;
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const speed = speedBase + randRange(0, speedJitter);
    spawnLootInSector(state, sx, sy, x + dirX * off, y + dirY * off, lootKey, timeMs, sourceKind, sourceId, { x: dirX * speed, y: dirY * speed });
    spawned += 1;
  }

  return spawned;
}
