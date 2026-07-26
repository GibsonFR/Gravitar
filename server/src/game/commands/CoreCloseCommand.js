import { closeCoreManagement } from '../structures/StructureCoreProgression.js';

export function handleCoreClose(_state, player) {
  return closeCoreManagement(player);
}
