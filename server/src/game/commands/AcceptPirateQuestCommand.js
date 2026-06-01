import { acceptPirateQuest, ensurePlayerPirateState } from '../player/runtime/PlayerPirateState.js';

function findStationQuest(station, questIdRaw) {
  const questId = String(questIdRaw || '').toLowerCase();
  return (station?.stock?.questOffers || []).find((q) => String(q?.questId || '').toLowerCase() === questId) || null;
}

export function handleAcceptPirateQuest(state, player, msg, timeMs = Date.now()) {
  if (!player) return false;
  const sid = player.dockedStationId | 0;
  if (!sid) return false;
  const station = state?.stations?.get?.(sid) || null;
  if (!station?.pirate) return false;
  if ((station.sx | 0) !== (player.sx | 0) || (station.sy | 0) !== (player.sy | 0)) return false;
  const quest = findStationQuest(station, msg.questId);
  if (!quest) return false;
  ensurePlayerPirateState(player);
  const ok = acceptPirateQuest(player, {
    ...quest,
    stationId: station.id | 0,
    stationName: station.name || 'Station pirate',
    stationSx: station.sx | 0,
    stationSy: station.sy | 0,
    acceptedAtMs: timeMs | 0
  });
  if (!ok) return false;
  player.forceFullUiSnapshot = true;
  player.uiHint = `Quête acceptée : ${quest.name || 'quête pirate'}`;
  player.uiHintTimer = 2.2;
  return true;
}
