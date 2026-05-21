import { GAME_MODES, WORLD_IDS, clearPlayerBattleResidue } from '../modes/GameModes.js';

export function handleCancelBattleQueue(state, player, msg, timeMs) {
  if (!player) return false;
  clearPlayerBattleResidue(state, player, timeMs, { checkWinner: true });
  player.gameMode = GAME_MODES.ENDLESS;
  player.worldId = WORLD_IDS.SETUP;
  player.sessionSetupPending = true;
  player.sessionSetupStep = 'mode';
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
  player.uiHint = 'Attente Battle quittée';
  player.uiHintTimer = 2.5;
  return true;
}
