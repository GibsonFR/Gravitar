import { addCredits } from '../inventory/CreditSystem.js';
import { removeResource } from '../inventory/InventorySystem.js';
import { addPirateReputationXp, completePirateQuest, ensurePlayerPirateState } from '../player/runtime/PlayerPirateState.js';

function findStationQuest(station, questIdRaw) {
  const questId = String(questIdRaw || '').toLowerCase();
  return (station?.stock?.questOffers || []).find((q) => String(q?.questId || '').toLowerCase() === questId) || null;
}

export function handleCompletePirateQuest(state, player, msg) {
  if (!player?.inv) return false;
  const sid = player.dockedStationId | 0;
  if (!sid) return false;
  const station = state?.stations?.get?.(sid) || null;
  if (!station?.pirate) return false;
  if ((station.sx | 0) !== (player.sx | 0) || (station.sy | 0) !== (player.sy | 0)) return false;
  const quest = findStationQuest(station, msg.questId);
  if (!quest) return false;
  const questId = String(quest.questId || '').toLowerCase();
  const pirate = ensurePlayerPirateState(player);
  if (!pirate.activeQuestIds.includes(questId)) return false;
  const storedProgress = pirate.questProgress?.[questId] || null;
  if (quest.type === 'deliver_resource') {
    const key = String(quest.resourceKey || '');
    const required = Math.max(1, quest.required | 0 || 1);
    if ((player.inv.resources?.[key] | 0) < required) return false;
    const removed = removeResource(player.inv, key, required);
    if (removed < required) return false;
  } else if (quest.type === 'kill_mob') {
    const required = Math.max(1, quest.required | 0 || storedProgress?.required | 0 || 1);
    if ((storedProgress?.current | 0) < required) return false;
  } else {
    return false;
  }
  const progress = completePirateQuest(player, questId);
  if (!progress) return false;
  addCredits(player.inv, Math.max(0, quest.rewardCredits | 0 || progress.rewardCredits | 0 || 0));
  addPirateReputationXp(player, Math.max(0, quest.rewardReputationXp | 0 || progress.rewardReputationXp | 0 || 0));
  player.forceFullUiSnapshot = true;
  player.uiHint = `Quête terminée : +${quest.rewardCredits | 0} cr pirates`;
  player.uiHintTimer = 2.4;
  return true;
}
