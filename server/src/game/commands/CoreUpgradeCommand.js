import { upgradeCore } from '../structures/StructureCoreProgression.js';

export function handleCoreUpgrade(state, player, msg, timeMs) {
  return upgradeCore(state, player, msg.structureId | 0, timeMs);
}
