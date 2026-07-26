import { clearTestZone, giveTestResources, resetTestZone, spawnTestDummy, spawnTestMob } from '../test/TestToolsSystem.js';

export function handleTestGive(state, player, msg) {
  return giveTestResources(state, player, msg.resourceKey, msg.amount);
}

export function handleTestSpawnMob(state, player, msg) {
  return spawnTestMob(state, player, msg.mobId);
}

export function handleTestSpawnDummy(state, player) {
  return spawnTestDummy(state, player);
}

export function handleTestClear(state, player) {
  return clearTestZone(state, player);
}

export function handleTestReset(state, player) {
  return resetTestZone(state, player);
}
