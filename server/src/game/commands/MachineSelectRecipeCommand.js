import { selectMachineRecipe } from '../structures/StructureMachines.js';

export function handleMachineSelectRecipe(state, player, msg, timeMs) {
  return selectMachineRecipe(state, player, msg.structureId | 0, msg.recipeId || '', timeMs).ok;
}
