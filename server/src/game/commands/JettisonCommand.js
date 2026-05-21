import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { removeResource, clearInventoryResource } from '../inventory/InventorySystem.js';
import { spawnLootBurstInSector } from '../loot/LootBurst.js';
import { getSimulationTimeMs } from '../util/Time.js';

export function handleJettison(state, player, msg, timeMs = null) {
  if (!player?.inv) return false;
  if (player.dockedStationId) return false;

  const key = msg?.resourceKey;
  const def = key ? RESOURCE_DEFS[key] : null;
  if (!def) return false;

  const amountReq = Number.isFinite(msg?.amount) ? Math.floor(msg.amount) : 0;
  const cur = player.inv.resources[key] || 0;
  if (cur <= 0) return false;

  timeMs = getSimulationTimeMs(state, timeMs);

  if (amountReq <= 0 || amountReq >= cur) {
    const removed = clearInventoryResource(player.inv, key);
    if (removed <= 0) return false;
    spawnLootBurstInSector(state, player.sx, player.sy, player.x, player.y, key, removed, timeMs, 'player', player.id, {
      offsetRadius: 12,
      speedBase: 28,
      speedJitter: 22
    });
    return true;
  }

  const removed = removeResource(player.inv, key, amountReq);
  if (removed <= 0) return false;
  spawnLootBurstInSector(state, player.sx, player.sy, player.x, player.y, key, removed, timeMs, 'player', player.id, {
    offsetRadius: 12,
    speedBase: 28,
    speedJitter: 22
  });
  return true;
}
