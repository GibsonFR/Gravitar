import { transferMachineResource } from '../structures/StructureMachines.js';

export function handleMachineTransfer(state, player, msg, timeMs) {
  return transferMachineResource(
    state,
    player,
    msg.structureId | 0,
    msg.resourceKey || '',
    msg.direction || 'deposit',
    msg.slot || 'input',
    msg.amount | 0 || 1,
    timeMs
  ).ok;
}
