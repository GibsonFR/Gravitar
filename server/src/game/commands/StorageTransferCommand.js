import { transferStorageResource, transferStorageItem } from '../structures/StructureStorage.js';

export function handleStorageTransfer(state, player, msg, timeMs) {
  if (msg.itemId) return transferStorageItem(state, player, msg.structureId | 0, msg.itemId, msg.amount, msg.direction, timeMs).ok;
  return transferStorageResource(state, player, msg.structureId | 0, msg.resourceKey, msg.amount, msg.direction, timeMs).ok;
}
