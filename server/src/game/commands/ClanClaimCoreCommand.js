import { claimCoreForClan } from '../clans/ClanSystem.js';

export function handleClanClaimCore(state, player, msg) {
  return claimCoreForClan(state, player, msg.structureId | 0, msg.shared !== false);
}
