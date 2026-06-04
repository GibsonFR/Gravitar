import { updateLootMotion } from './LootKinematics.js';
import { tryResolveLootPickup } from './LootPickupSystem.js';
import { queueLootRemovedEvent } from '../events/WorldEntityEvents.js';

export function updateLoots(state, dt, timeMs) {
  for (const loot of state.loots.values()) {
    if (loot.despawnAt && timeMs >= loot.despawnAt) {
      queueLootRemovedEvent(state, loot, 'despawn');
      state.loots.delete(loot.id);
      continue;
    }

    updateLootMotion(state, loot, dt);

    const pickup = tryResolveLootPickup(state, loot);
    if (pickup) {
      queueLootRemovedEvent(state, loot, 'pickup', pickup.playerId || 0);
      state.loots.delete(loot.id);
    }
  }
}
