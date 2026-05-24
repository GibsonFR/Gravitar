import { toggleMachine } from '../structures/StructureMachines.js';

export function handleMachineToggle(state, player, msg, timeMs) {
  const hasEnabled = msg.enabled === true || msg.enabled === false;
  return toggleMachine(state, player, msg.structureId | 0, hasEnabled ? !!msg.enabled : null, timeMs).ok;
}
