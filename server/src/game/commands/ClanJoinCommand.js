import { joinClan } from '../clans/ClanSystem.js';

export function handleClanJoin(state, player, msg) {
  return joinClan(state, player, msg.clanTag);
}
