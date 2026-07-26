import { createClan } from '../clans/ClanSystem.js';

export function handleClanCreate(state, player, msg, timeMs) {
  return createClan(state, player, msg.clanName, msg.clanTag, timeMs);
}
