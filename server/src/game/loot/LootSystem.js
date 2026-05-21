import { updateLootMotion } from './LootKinematics.js';
import { tryResolveLootPickup } from './LootPickupSystem.js';

export function updateLoots(state, dt, timeMs) {
  for (const loot of state.loots.values()) {
    if (loot.despawnAt && timeMs >= loot.despawnAt) {
      state.loots.delete(loot.id);
      continue;
    }

    updateLootMotion(state, loot, dt);

    if (tryResolveLootPickup(state, loot)) {
      state.loots.delete(loot.id);
    }
  }
}
