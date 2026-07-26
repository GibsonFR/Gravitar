import { leaveClan } from '../clans/ClanSystem.js';

export function handleClanLeave(state, player) {
  return leaveClan(state, player);
}
