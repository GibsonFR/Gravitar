import { getShipFrameDef } from '../../../../shared/content/frames/ShipFrameRegistry.js';
import { switchPlayerFrame } from '../frames/FrameSwitchSystem.js';
import { normalizePlayerPseudo } from '../player/PlayerSessionSetup.js';
import { setPlayerHint } from '../player/PlayerUiHints.js';
import { GAME_MODES, clearPlayerBattleResidue, getBattleSessionById, getNewestOpenBattleSession, joinBattleSession, queueForNextBattle, setPlayerEndless, setPlayerTestServer } from '../modes/GameModes.js';
import { applyEndlessSave, getAccountProfileSave } from '../accounts/AccountStore.js';
import { syncPlayerFrameStats } from '../frames/FrameStatSync.js';
import { createPlayer } from '../player/PlayerFactory.js';

function resetPlayerProfileForServer(player, frameId, timeMs) {
  const keep = {
    id: player.id,
    pseudo: player.pseudo,
    accountKey: player.accountKey,
    accountName: player.accountName,
    authStatus: player.authStatus,
    net: player.net
  };
  const fresh = createPlayer(player.id, frameId, timeMs);
  Object.assign(player, fresh, keep);
  player.sessionSetupPending = true;
  player.sessionSetupStep = 'ship';
  player.worldId = 'setup';
  player.gameMode = 'endless';
}

export function handleCommitSessionSetup(state, player, msg, timeMs) {
  if (!player?.sessionSetupPending) return false;

  const requestedId = String(msg?.frameId || '');
  const def = getShipFrameDef(requestedId);
  if (!def || def.id !== requestedId) return false;

  const mode = String(msg?.mode || 'endless');
  player.pseudo = normalizePlayerPseudo(msg?.pseudo);
  player.authStatus = null;
  const accountAction = String(msg?.accountAction || 'guest');
  if ((accountAction === 'login' || accountAction === 'register') && state.accounts) {
    const accountName = normalizePlayerPseudo(msg?.accountName || msg?.pseudo);
    const auth = state.accounts.registerOrLogin(accountName, msg?.accountPassword, accountAction);
    if (!auth.ok) {
      player.accountKey = '';
      player.accountName = '';
      player.authStatus = { ok: false, message: auth.error || 'Connexion impossible' };
      player.uiHint = auth.error || 'Connexion impossible';
      player.uiHintTimer = 2.5;
      return true;
    }
    player.accountKey = auth.key;
    player.accountName = auth.name;
    player.pseudo = normalizePlayerPseudo(auth.name || accountName);
    player.authStatus = { ok: true, message: auth.message || (accountAction === 'register' ? 'Compte créé' : 'Connexion réussie') };
    const save = getAccountProfileSave(auth, mode);
    resetPlayerProfileForServer(player, def.id, timeMs);
    player.accountKey = auth.key;
    player.accountName = auth.name;
    player.pseudo = normalizePlayerPseudo(auth.name || accountName);
    player.authStatus = { ok: true, message: auth.message || (accountAction === 'register' ? 'Compte créé' : 'Connexion réussie') };
    if (save) applyEndlessSave(player, save);
    const stats = auth.battleStats;
    if (stats) state.modes?.battleStats?.set?.(auth.key, { ...stats });
  } else {
    resetPlayerProfileForServer(player, def.id, timeMs);
    player.accountKey = '';
    player.accountName = '';
    player.authStatus = { ok: true, message: 'Mode invité' };
  }
  if (player.frameId !== def.id) switchPlayerFrame(player, def.id);
  syncPlayerFrameStats(player, { restoreVitals: false, preserveRatios: true });
  clearPlayerBattleResidue(state, player, timeMs, { checkWinner: true });
  player.sessionSetupPending = false;
  player.sessionSetupStep = '';
  player.hasMoveTarget = false;
  player.autoTargetKind = '';
  player.autoTargetId = 0;
  player.selectedKind = '';
  player.selectedId = 0;
  player.vx = 0;
  player.vy = 0;

  if (mode === 'battle_server') {
    const selected = getBattleSessionById(state, msg?.battleSessionId || '');
    if (selected && selected.state === 'lobby') {
      joinBattleSession(state, player, selected, timeMs);
    } else {
      player.sessionSetupPending = true;
      player.sessionSetupStep = 'waiting';
      player.worldId = 'setup';
      player.authStatus = { ok: false, message: 'Serveur Battle indisponible. Choisis un serveur ouvert dans la liste.' };
      player.uiHint = 'Serveur Battle indisponible';
      player.uiHintTimer = 3.0;
      return true;
    }
  } else if (mode === 'battle_current') {
    const open = getNewestOpenBattleSession(state, timeMs);
    if (open) joinBattleSession(state, player, open, timeMs);
    else queueForNextBattle(state, player, timeMs);
  } else if (mode === 'battle_next') {
    queueForNextBattle(state, player, timeMs);
  } else if (mode === 'test_server') {
    setPlayerTestServer(state, player, timeMs);
  } else {
    setPlayerEndless(state, player, timeMs);
  }

  setPlayerHint(player, `${player.pseudo} — ${def.name}${player.gameMode === GAME_MODES.BATTLE ? ' — Battle Royale' : (player.gameMode === GAME_MODES.TEST ? ' — Test' : '')}`, 2.2);
  return true;
}
