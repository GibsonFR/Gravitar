import { abandonPirateQuest } from '../player/runtime/PlayerPirateState.js';

export function handleAbandonPirateQuest(state, player, msg) {
  if (!player) return false;
  const ok = abandonPirateQuest(player, msg.questId);
  if (!ok) return false;
  player.forceFullUiSnapshot = true;
  player.uiHint = 'Quête pirate abandonnée';
  player.uiHintTimer = 1.8;
  return true;
}
