import { processMachineRecipe } from '../structures/StructureMachines.js';

export function handleMachineProcess(state, player, msg, timeMs) {
  return processMachineRecipe(state, player, msg.structureId | 0, msg.recipeId || '', msg.amount | 0 || 1, timeMs).ok;
}
