import { spawnLootBurstInSector } from '../loot/LootBurst.js';
import { listInventoryResourceStacks } from '../inventory/InventoryQuery.js';
import { clearInventoryResource } from '../inventory/InventorySystem.js';

export function dropPlayerCargo(state, player, timeMs) {
  if (!player?.inv) return 0;

  let total = 0;
  for (const stack of listInventoryResourceStacks(player.inv)) {
    total += spawnLootBurstInSector(state, player.sx, player.sy, player.x, player.y, stack.resource, stack.amount, timeMs, 'player', player.id, {
      offsetRadius: 10,
      speedBase: 55,
      speedJitter: 65
    });

    clearInventoryResource(player.inv, stack.resource);
  }

  return total;
}
