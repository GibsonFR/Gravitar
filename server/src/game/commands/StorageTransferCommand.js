import { transferStorageResource } from '../structures/StructureStorage.js';

export function handleStorageTransfer(state, player, msg, timeMs) {
  return transferStorageResource(state, player, msg.structureId | 0, msg.resourceKey, msg.amount, msg.direction, timeMs).ok;
}
