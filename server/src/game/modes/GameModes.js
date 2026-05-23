import { restoreStatBlockFull } from '../stats/StatBlockRuntime.js';
import { syncPlayerFrameStats } from '../frames/FrameStatSync.js';
import { visitSectorOnPlayer } from '../map/PlayerMapState.js';
import { ensureSectorLoaded } from '../sector/SectorEnsure.js';
import { SPECIAL_SECTORS } from '../sector/SpecialSectors.js';
import { PLAYER_PROGRESSION_TUNING } from '../../../../shared/content/progression/PlayerProgressionTuning.js';

export const GAME_MODES = { ENDLESS: 'endless', BATTLE: 'battle', TEST: 'test', STRESS: 'stress' };
export const BATTLE = {
  intervalMs: 10 * 60 * 1000,
  lobbyDurationMs: 60 * 60 * 1000,
  arenaDurationMs: 20 * 60 * 1000,
  arenaBaseSx: 9400,
  arenaSy: -9400,
  arenaHalf: 4000
};

export const WORLD_IDS = { SETUP: 'setup', ENDLESS: 'endless', TEST: 'test', STRESS: 'stress', BATTLE_WAIT_NEXT: 'battle-wait-next' };

export const TEST_WORLD_DEFS = Object.freeze([
  {
    id: 'u01-foundations',
    title: 'Update 1 — Fondations',
    subtitle: 'Hub de test isolé : portails vers mobs, effets, stress test et fondations de l’update actuelle.',
    sx: SPECIAL_SECTORS.TEST_HUB.sx | 0,
    sy: SPECIAL_SECTORS.TEST_HUB.sy | 0,
    x: 0,
    y: 0,
    level: 50,
    credits: 1000000,
    hint: 'TEST HUB — choisis un portail de test'
  }
]);

export function testWorldIdFor(defOrId) {
  const id = typeof defOrId === 'string' ? defOrId : defOrId?.id;
  return `test:${String(id || 'u01-foundations')}`;
}

export function getTestWorldDef(id) {
  const normalized = String(id || '').toLowerCase();
  return TEST_WORLD_DEFS.find((w) => w.id === normalized) || TEST_WORLD_DEFS[0];
}

export function battleSectorForSeq(seq) {
  return { sx: BATTLE.arenaBaseSx + Math.abs(seq | 0) % 10000, sy: BATTLE.arenaSy };
}

export function battleWorldId(session) {
  return session?.id ? `battle:${session.id}` : WORLD_IDS.BATTLE_WAIT_NEXT;
}

export function createModeState(nowMs = Date.now()) {
  const origin = Math.floor(nowMs / BATTLE.intervalMs) * BATTLE.intervalMs;
  return {
    battleOriginMs: origin,
    battleNextSeq: Math.floor(origin / BATTLE.intervalMs),
    battleSessions: [],
    battleQueueNext: new Set(),
    battleStats: new Map()
  };
}

export function isBattleArenaSector(sx, sy) {
  sx |= 0;
  sy |= 0;
  return sy === BATTLE.arenaSy && sx >= BATTLE.arenaBaseSx && sx < BATTLE.arenaBaseSx + 100000;
}

export function sameWorld(a, b) {
  return !!a && !!b && String(a.worldId || WORLD_IDS.ENDLESS) === String(b.worldId || WORLD_IDS.ENDLESS);
}

export function isBattlePlayer(player) {
  return player?.gameMode === GAME_MODES.BATTLE && !!player?.battleSessionId;
}

export function formatBattleSession(session, timeMs) {
  const now = Number(timeMs || 0);
  const lobbyLeftMs = Math.max(0, Number(session.lobbyEndsAtMs || session.endsAtMs || 0) - now);
  const arenaLeftMs = Math.max(0, Number(session.arenaEndsAtMs || 0) - now);
  const remainingMs = session.state === 'arena' ? arenaLeftMs : lobbyLeftMs;
  return {
    id: session.id,
    seq: session.seq | 0,
    sx: session.sx | 0,
    sy: session.sy | 0,
    state: session.state,
    playerCount: session.players?.size ?? 0,
    aliveCount: session.alive?.size ?? 0,
    startsAtMs: Number(session.startsAtMs || 0),
    lobbyEndsAtMs: Number(session.lobbyEndsAtMs || session.endsAtMs || 0),
    arenaStartsAtMs: Number(session.arenaStartsAtMs || session.lobbyEndsAtMs || 0),
    arenaEndsAtMs: Number(session.arenaEndsAtMs || 0),
    endsAtMs: Number(session.arenaEndsAtMs || session.lobbyEndsAtMs || session.endsAtMs || 0),
    remainingMs,
    winnerName: session.winnerName || '',
    joinable: session.state === 'lobby',
    phaseLabel: session.state === 'lobby' ? 'Préparation' : (session.state === 'arena' ? 'Arène finale' : 'Terminé'),
    startedAgoMs: Math.max(0, now - Number(session.startsAtMs || 0))
  };
}

function createBattleSession(state, seq, startsAtMs) {
  const s = battleSectorForSeq(seq);
  const session = {
    id: `br-${seq}`,
    seq: seq | 0,
    sx: s.sx | 0,
    sy: s.sy | 0,
    startsAtMs: Number(startsAtMs),
    lobbyEndsAtMs: Number(startsAtMs) + BATTLE.lobbyDurationMs,
    arenaStartsAtMs: 0,
    arenaEndsAtMs: 0,
    state: 'lobby',
    players: new Set(),
    alive: new Set(),
    winnerId: 0,
    winnerName: ''
  };
  state.modes.battleSessions.push(session);
  return session;
}

export function updateModeSessions(state, timeMs) {
  if (!state.modes) state.modes = createModeState(timeMs);
  const currentSeq = Math.floor(timeMs / BATTLE.intervalMs);
  while ((state.modes.battleNextSeq | 0) <= currentSeq) {
    const seq = state.modes.battleNextSeq | 0;
    createBattleSession(state, seq, seq * BATTLE.intervalMs);
    state.modes.battleNextSeq = seq + 1;
  }

  for (const session of state.modes.battleSessions) {
    if (session.state === 'lobby' && timeMs >= Number(session.lobbyEndsAtMs || 0)) startBattleArena(state, session, timeMs);
    if (session.state === 'arena' && Number(session.arenaEndsAtMs || 0) > 0 && timeMs >= Number(session.arenaEndsAtMs || 0)) closeBattleSession(state, session, timeMs, 'timer');
  }

  if (state.modes.battleQueueNext.size) {
    for (const playerId of [...state.modes.battleQueueNext]) {
      const p = state.players.get(playerId | 0);
      if (!p || p.gameMode !== GAME_MODES.BATTLE || p.battleSessionId) {
        state.modes.battleQueueNext.delete(playerId | 0);
        continue;
      }
      const targetSeq = Number.isFinite(p.battleQueuedForSeq) ? (p.battleQueuedForSeq | 0) : (Math.floor(timeMs / BATTLE.intervalMs) + 1);
      const target = (state.modes.battleSessions ?? []).find((s) => (s.seq | 0) >= targetSeq && s.state === 'lobby' && Number(timeMs || 0) >= Number(s.startsAtMs || 0));
      if (target && joinBattleSession(state, p, target, timeMs)) {
        p.battleQueuedForSeq = 0;
        state.modes.battleQueueNext.delete(playerId | 0);
      }
    }
  }

  for (const session of state.modes.battleSessions) if (session.state === 'arena') checkBattleWinner(state, session, timeMs);
  state.modes.battleSessions = state.modes.battleSessions.filter((s) => s.state !== 'ended' || timeMs - (s.endedAtMs || timeMs) < 5 * 60 * 1000);
}


export function getBattleSessionById(state, sessionId) {
  const id = String(sessionId || '').trim().toLowerCase();
  if (!id) return null;
  return (state.modes?.battleSessions ?? []).find((s) => String(s.id || '').toLowerCase() === id) || null;
}

function countPlayersByWorld(state) {
  const counts = { endless: 0, test: 0, setup: 0, battleWaiting: 0, testWorlds: {} };
  for (const def of TEST_WORLD_DEFS) counts.testWorlds[def.id] = 0;
  for (const p of state.players?.values?.() ?? []) {
    if (!p) continue;
    const w = String(p.worldId || WORLD_IDS.ENDLESS);
    if (p.sessionSetupPending && w !== WORLD_IDS.BATTLE_WAIT_NEXT) continue;
    if (w === WORLD_IDS.ENDLESS) counts.endless += 1;
    else if (w === WORLD_IDS.TEST || w.startsWith('test:') || w === WORLD_IDS.STRESS) {
      counts.test += 1;
      const id = w.startsWith('test:') ? w.slice('test:'.length) : (p.testWorldId || 'u01-foundations');
      if (Object.prototype.hasOwnProperty.call(counts.testWorlds, id)) counts.testWorlds[id] += 1;
    } else if (w === WORLD_IDS.SETUP) counts.setup += 1;
    else if (w === WORLD_IDS.BATTLE_WAIT_NEXT) counts.battleWaiting += 1;
  }
  return counts;
}

export function getNewestOpenBattleSession(state, timeMs) {
  let best = null;
  for (const s of state.modes?.battleSessions ?? []) {
    if (s.state !== 'lobby') continue;
    if (Number(timeMs || 0) < Number(s.startsAtMs || 0) || Number(timeMs || 0) >= Number(s.lobbyEndsAtMs || 0)) continue;
    if (!best || Number(s.startsAtMs || 0) > Number(best.startsAtMs || 0)) best = s;
  }
  return best;
}

export function getNextBattleOpenMs(timeMs) {
  return (Math.floor(timeMs / BATTLE.intervalMs) + 1) * BATTLE.intervalMs;
}

function spawnPointForPlayer(playerId, count = 12, radius = null) {
  const i = Math.max(0, playerId | 0) % Math.max(1, count);
  const a = (Math.PI * 2 * i / count) + 0.33;
  const r = radius ?? (BATTLE.arenaHalf * 0.72);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

export function joinBattleSession(state, player, session, timeMs) {
  if (!player || !session || session.state !== 'lobby') return false;
  clearPlayerBattleResidue(state, player, timeMs, { checkWinner: true });
  player.gameMode = GAME_MODES.BATTLE;
  player.battleSessionId = session.id;
  player.battleEliminated = false;
  player.worldId = battleWorldId(session);
  session.players.add(player.id | 0);
  session.alive.delete(player.id | 0);
  player.sessionSetupPending = false;

  player.sx = 0;
  player.sy = 0;
  const pos = spawnPointForPlayer(player.id, Math.max(12, session.players.size + 2), 120);
  player.x = pos.x;
  player.y = pos.y;
  player.vx = 0;
  player.vy = 0;
  player.hasMoveTarget = false;
  player.autoTargetKind = '';
  player.autoTargetId = 0;
  player.selectedKind = '';
  player.selectedId = 0;
  syncPlayerFrameStats(player, { restoreVitals: true, preserveRatios: false });
  restoreStatBlockFull(player.stats);
  ensureSectorLoaded(state, player.sx | 0, player.sy | 0, timeMs);
  visitSectorOnPlayer(state, player, player.sx | 0, player.sy | 0, timeMs);
  player.uiHint = 'Serveur Battle Royale — préparation';
  player.uiHintTimer = 3.0;
  return true;
}

export function queueForNextBattle(state, player, timeMs) {
  if (!state.modes) state.modes = createModeState(timeMs);
  clearPlayerBattleResidue(state, player, timeMs, { checkWinner: true });
  player.gameMode = GAME_MODES.BATTLE;
  player.battleSessionId = '';
  player.battleEliminated = false;
  player.sessionSetupPending = true;
  player.worldId = WORLD_IDS.BATTLE_WAIT_NEXT;
  state.modes.battleQueueNext.add(player.id | 0);
  player.battleQueuedForSeq = Math.floor(timeMs / BATTLE.intervalMs) + 1;
  player.sx = 0;
  player.sy = 0;
  player.x = 0;
  player.y = 0;
  player.vx = 0;
  player.vy = 0;
  ensureSectorLoaded(state, 0, 0, timeMs);
  visitSectorOnPlayer(state, player, 0, 0, timeMs);
  player.uiHint = 'En attente du prochain serveur Battle Royale';
  player.uiHintTimer = 3.0;
}

export function setPlayerEndless(state, player, timeMs) {
  if (!player) return;
  clearPlayerBattleResidue(state, player, timeMs, { checkWinner: true });
  player.gameMode = GAME_MODES.ENDLESS;
  player.battleSessionId = '';
  player.battleEliminated = false;
  player.worldId = WORLD_IDS.ENDLESS;
  if (!Number.isFinite(player.sx) || isBattleArenaSector(player.sx | 0, player.sy | 0)) {
    player.sx = 0;
    player.sy = 0;
    player.x = 0;
    player.y = 0;
  }
}


export function setPlayerTestWorld(state, player, timeMs, testWorldId = 'u01-foundations') {
  if (!player) return;
  const def = getTestWorldDef(testWorldId);
  clearPlayerBattleResidue(state, player, timeMs, { checkWinner: true });
  player.gameMode = GAME_MODES.TEST;
  player.testWorldId = def.id;
  player.battleSessionId = '';
  player.battleEliminated = false;
  player.worldId = testWorldIdFor(def);
  player.sessionSetupPending = false;
  player.sessionSetupStep = '';
  player.sx = def.sx | 0;
  player.sy = def.sy | 0;
  player.x = Number(def.x || 0);
  player.y = Number(def.y || 0);
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
  if (player.inv) player.inv.credits = Math.max(player.inv.credits || 0, def.credits | 0 || 0);
  if (player.progression) {
    player.progression.level = Math.max(player.progression.level ?? 1, def.level | 0 || 50);
    player.progression.xp = 0;
    player.progression.nextXp = 1;
    player.progression.skillPoints = 0;
    player.progression.abilityLevels = { A: 15, Z: 15, E: 15, R: 5 };
    player.progression.xpPulseLeft = 0;
    player.progression.levelUpFlashLeft = 0;
    player.progression.recentXpGain = 0;
    player.progression.recentXpReason = '';
    player.progression.canSpendAt = 0;
  }
  syncPlayerFrameStats(player, { restoreVitals: true, preserveRatios: false });
  restoreStatBlockFull(player.stats);
  ensureSectorLoaded(state, player.sx | 0, player.sy | 0, timeMs);
  ensureSectorLoaded(state, SPECIAL_SECTORS.MOB_BESTIARY.sx | 0, SPECIAL_SECTORS.MOB_BESTIARY.sy | 0, timeMs);
  ensureSectorLoaded(state, SPECIAL_SECTORS.TEST_EFFECTS.sx | 0, SPECIAL_SECTORS.TEST_EFFECTS.sy | 0, timeMs);
  ensureSectorLoaded(state, SPECIAL_SECTORS.TEST_FOUNDATIONS.sx | 0, SPECIAL_SECTORS.TEST_FOUNDATIONS.sy | 0, timeMs);
  visitSectorOnPlayer(state, player, player.sx | 0, player.sy | 0, timeMs);
  player.uiHint = def.hint || 'Monde de test';
  player.uiHintTimer = 3.0;
}

export function setPlayerTestServer(state, player, timeMs) {
  setPlayerTestWorld(state, player, timeMs, 'u01-foundations');
}

export function setPlayerStressServer(state, player, timeMs) {
  setPlayerTestServer(state, player, timeMs);
  player.gameMode = GAME_MODES.STRESS;
  player.worldId = WORLD_IDS.STRESS;
  player.testWorldId = 'stress';
  player.sx = SPECIAL_SECTORS.STRESS_ARENA.sx | 0;
  player.sy = SPECIAL_SECTORS.STRESS_ARENA.sy | 0;
  player.x = 0;
  player.y = 0;
  player.vx = 0;
  player.vy = 0;
  player.hasMoveTarget = false;
  player.autoTargetKind = '';
  player.autoTargetId = 0;
  ensureSectorLoaded(state, player.sx | 0, player.sy | 0, timeMs);
  visitSectorOnPlayer(state, player, player.sx | 0, player.sy | 0, timeMs);
  player.uiHint = 'Serveur stress — mobs denses pour tester réseau/CPU';
  player.uiHintTimer = 4.0;
}

export function clearPlayerBattleResidue(state, player, timeMs, options = {}) {
  if (!player || !state?.modes) return;
  const playerId = player.id | 0;
  const checkWinner = options.checkWinner !== false;
  const affectedArenaSessions = [];

  state.modes.battleQueueNext?.delete?.(playerId);

  for (const session of state.modes.battleSessions ?? []) {
    const hadAlive = session.alive?.delete?.(playerId) || false;
    const hadPlayer = session.players?.delete?.(playerId) || false;
    if ((hadAlive || hadPlayer) && session.state === 'arena') affectedArenaSessions.push(session);
  }

  player.battleSessionId = '';
  player.battleQueuedForSeq = 0;
  player.battleEliminated = false;

  if (checkWinner) {
    for (const session of affectedArenaSessions) checkBattleWinner(state, session, timeMs);
  }
}

export function leaveBattleSession(state, player, timeMs, eliminated = true) {
  const id = player?.battleSessionId || '';
  if (!id) {
    state?.modes?.battleQueueNext?.delete?.(player?.id | 0);
    if (player) player.battleQueuedForSeq = 0;
    return;
  }
  const session = state.modes?.battleSessions?.find?.((s) => s.id === id);
  if (session) {
    session.alive.delete(player.id | 0);
    if (!eliminated) session.players.delete(player.id | 0);
    if (session.state === 'arena') checkBattleWinner(state, session, timeMs);
  }
  state.modes?.battleQueueNext?.delete?.(player.id | 0);
  player.battleSessionId = '';
  player.battleQueuedForSeq = 0;
}

export function startBattleArena(state, session, timeMs) {
  if (!session || session.state !== 'lobby') return;
  session.state = 'arena';
  session.arenaStartsAtMs = Number(timeMs || 0);
  session.arenaEndsAtMs = Number(timeMs || 0) + BATTLE.arenaDurationMs;
  session.alive = new Set();
  ensureSectorLoaded(state, session.sx | 0, session.sy | 0, timeMs);
  let index = 0;
  const ids = [...session.players];
  for (const playerId of ids) {
    const p = state.players.get(playerId | 0);
    if (!p || p.gameMode !== GAME_MODES.BATTLE || p.battleSessionId !== session.id) continue;
    p.worldId = battleWorldId(session);
    p.sx = session.sx | 0;
    p.sy = session.sy | 0;
    const pos = spawnPointForPlayer(index++, Math.max(12, ids.length + 2));
    p.x = pos.x;
    p.y = pos.y;
    p.vx = 0;
    p.vy = 0;
    p.hasMoveTarget = false;
    p.autoTargetKind = '';
    p.autoTargetId = 0;
    p.selectedKind = '';
    p.selectedId = 0;
    restoreStatBlockFull(p.stats);
    session.alive.add(p.id | 0);
    visitSectorOnPlayer(state, p, p.sx | 0, p.sy | 0, timeMs);
    p.uiHint = 'Battle Royale — arène ouverte';
    p.uiHintTimer = 4.0;
  }
}

function getBattleStats(state, accountKey) {
  if (!accountKey) return null;
  if (!state.modes.battleStats.has(accountKey)) state.modes.battleStats.set(accountKey, { played: 0, wins: 0, kills: 0, deaths: 0 });
  return state.modes.battleStats.get(accountKey);
}

export function recordBattleDeath(state, player) {
  const stats = getBattleStats(state, player?.accountKey || '');
  if (stats) stats.deaths += 1;
}

export function recordBattleKill(state, player) {
  const stats = getBattleStats(state, player?.accountKey || '');
  if (stats) stats.kills += 1;
}

export function closeBattleSession(state, session, timeMs, reason = 'end') {
  if (!session || session.state === 'ended') return;
  const wasArena = session.state === 'arena';
  session.state = 'ended';
  session.endedAtMs = Number(timeMs);
  let winnerId = 0;
  if (session.alive.size === 1) winnerId = [...session.alive][0] | 0;
  session.winnerId = winnerId;
  const winner = winnerId ? state.players.get(winnerId) : null;
  session.winnerName = winner?.pseudo || '';
  for (const playerId of session.players) {
    const p = state.players.get(playerId | 0);
    const stats = getBattleStats(state, p?.accountKey || '');
    if (stats && wasArena) {
      stats.played += 1;
      if ((playerId | 0) === winnerId) stats.wins += 1;
    }
    if (!p) continue;
    p.battleSessionId = '';
    p.battleQueuedForSeq = 0;
    p.battleEliminated = false;
    p.gameMode = GAME_MODES.ENDLESS;
    p.worldId = WORLD_IDS.SETUP;
    p.sessionSetupPending = true;
    p.sessionSetupStep = 'mode';
    p.sx = 0;
    p.sy = 0;
    p.x = 0;
    p.y = 0;
    p.vx = 0;
    p.vy = 0;
    p.hasMoveTarget = false;
    p.autoTargetKind = '';
    p.autoTargetId = 0;
    p.selectedKind = '';
    p.selectedId = 0;
    p.dockedStationId = 0;
    p.dockPhase = 'none';
    p.dockStationId = 0;
    p.dockProg01 = 0;
    p.dockTimer = 0;
    restoreStatBlockFull(p.stats);
    p.uiHint = winnerId === (p.id | 0) ? 'Victoire Battle Royale — choisis un serveur' : (reason === 'timer' ? 'Battle Royale terminée — choisis un serveur' : 'Battle Royale terminé — choisis un serveur');
    p.uiHintTimer = 4.0;
  }
}

export function checkBattleWinner(state, session, timeMs) {
  if (!session || session.state !== 'arena') return;
  const alive = [...session.alive].filter((id) => {
    const p = state.players.get(id | 0);
    return p && p.gameMode === GAME_MODES.BATTLE && p.battleSessionId === session.id && !p.battleEliminated && (p.stats?.hp ?? 0) > 0;
  });
  session.alive = new Set(alive);
  if (session.players.size > 1 && alive.length <= 1) closeBattleSession(state, session, timeMs, 'last_alive');
}

export function buildModeSnapshot(state, player, timeMs) {
  const sessions = (state.modes?.battleSessions ?? []).map((s) => formatBattleSession(s, timeMs));
  const current = getNewestOpenBattleSession(state, timeMs);
  const nextMs = getNextBattleOpenMs(timeMs);
  const key = player?.accountKey || '';
  const stats = key ? (state.modes?.battleStats?.get?.(key) ?? null) : null;
  const worldCounts = countPlayersByWorld(state);
  return {
    currentMode: player?.gameMode || GAME_MODES.ENDLESS,
    testWorldId: player?.testWorldId || '',
    testWorldTitle: player?.gameMode === GAME_MODES.TEST ? getTestWorldDef(player?.testWorldId).title : '',
    battleSessionId: player?.battleSessionId || '',
    battleQueuedNext: !!state.modes?.battleQueueNext?.has?.(player?.id | 0),
    battleArenaHalf: BATTLE.arenaHalf,
    battleCurrentId: current?.id || '',
    battleNextOpenMs: nextMs,
    battleNextInMs: Math.max(0, nextMs - Number(timeMs || 0)),
    battleWaitingCount: worldCounts.battleWaiting,
    endlessPlayerCount: worldCounts.endless,
    testPlayerCount: worldCounts.test,
    testWorlds: TEST_WORLD_DEFS.map((def) => ({ ...def, playerCount: worldCounts.testWorlds?.[def.id] || 0 })),
    battleSessions: sessions,
    account: {
      guest: !player?.accountKey,
      name: player?.accountName || '',
      battleStats: stats ? { ...stats, winrate: stats.played > 0 ? stats.wins / stats.played : 0 } : null
    }
  };
}
