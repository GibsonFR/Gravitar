import { openCoreManagement } from '../structures/StructureCoreProgression.js';

export function handleCoreOpen(state, player, msg) {
  return openCoreManagement(state, player, msg.structureId | 0);
}
