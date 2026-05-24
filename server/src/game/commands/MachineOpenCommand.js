import { canPlayerAccessMachine } from '../structures/StructureMachines.js';

export function handleMachineOpen(state, player, msg) {
  const st = state?.structures?.get?.(msg.structureId | 0);
  if (!canPlayerAccessMachine(state, player, st)) return false;
  player.openMachineId = st.id | 0;
  player.forceFullUiSnapshot = true;
  return true;
}
