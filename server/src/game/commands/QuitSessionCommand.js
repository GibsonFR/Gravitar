import { buildEndlessSave } from '../accounts/AccountStore.js';
import { GAME_MODES, WORLD_IDS, clearPlayerBattleResidue } from '../modes/GameModes.js';
import { restoreStatBlockFull } from '../stats/StatBlockRuntime.js';

function resetToHub(player) {
  player.sx = 0;
  player.sy = 0;
  player.x = 0;
  player.y = 0;
  player.vx = 0;
  player.vy = 0;
  player.hasMoveTarget = false;
  player.autoTargetKind = '';
  player.autoTargetId = 0;
  player.selectedKind = '';
  player.selectedId = 0;
  player.dockedStationId = 0;
  player.dockPhase = 'none';
  player.dockStationId = 0;
  player.dockProg01 = 0;
  player.dockTimer = 0;
  player.bastionReturn = null;
  player.bastionRunKey = '';
  player.bastionBuffs = [];
  restoreStatBlockFull(player.stats);
}

export function handleQuitSession(state, player, msg, timeMs) {
  if (!player) return false;

  const wasBattle = player.gameMode === GAME_MODES.BATTLE || !!player.battleSessionId;
  if (wasBattle) {
    clearPlayerBattleResidue(state, player, timeMs, { checkWinner: true });
    player.battleEliminated = false;
    player.gameMode = GAME_MODES.ENDLESS;
    player.worldId = WORLD_IDS.SETUP;
  } else if (player.accountKey && state.accounts?.saveEndless) {
    state.accounts.saveEndless(player.accountKey, buildEndlessSave(player));
  }

  resetToHub(player);
  player.worldId = WORLD_IDS.SETUP;
  player.sessionSetupPending = true;
  player.sessionSetupStep = 'mode';
  player.uiHint = wasBattle ? 'Battle Royale quittée' : 'Session quittée — vaisseau protégé';
  player.uiHintTimer = 2.5;
  return true;
}
