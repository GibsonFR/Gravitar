import { restoreStatBlockFull } from '../stats/StatBlockRuntime.js';
import { syncPlayerFrameStats } from '../frames/FrameStatSync.js';
import { visitSectorOnPlayer } from '../map/PlayerMapState.js';
import { ensureSectorLoaded } from '../sector/SectorEnsure.js';
import { SPECIAL_SECTORS } from '../sector/SpecialSectors.js';
import { PLAYER_PROGRESSION_TUNING } from '../../../../shared/content/progression/PlayerProgressionTuning.js';
import { createInventoryState } from '../inventory/InventoryState.js';
import { addResource } from '../inventory/InventorySystem.js';
import { createStructure } from '../structures/StructureFactory.js';
import { createEquipmentState } from '../equipment/EquipmentState.js';
import { STARTER_ITEM_IDS, STARTER_AMMO_LOADOUT } from '../../../../shared/content/items/ItemDefs.js';
import { createPlayerProgressionState } from '../player/runtime/PlayerProgressionState.js';

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
    id: 'test-hub',
    title: 'Server Test',
    subtitle: 'Hub de test',
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
  return `test:${String(id || 'test-hub')}`;
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
      const id = w.startsWith('test:') ? w.slice('test:'.length) : (p.testWorldId || 'test-hub');
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
  resetNonPersistentModeLoadout(player, { resetProgression: true });
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



function ensureTestMiningDeposits(state, player, timeMs) {
  if (!state?.structures || !player) return;
  const worldId = String(player.worldId || '');
  const sx = SPECIAL_SECTORS.TEST_MINING.sx | 0;
  const sy = SPECIAL_SECTORS.TEST_MINING.sy | 0;
  const exists = [...state.structures.values()].some((st) => st?.type === 'resource_deposit' && String(st.worldId || '') === worldId && (st.sx | 0) === sx && (st.sy | 0) === sy);
  if (exists) return;
  const deposits = [
    { x: -512, y: -384, key: 'ironOre', amount: 120 },
    { x: -128, y: -384, key: 'copper', amount: 120 },
    { x: 256, y: -384, key: 'aluminiumOre', amount: 100 },
    { x: 640, y: -384, key: 'quartz', amount: 90 },
    { x: -512, y: 128, key: 'graphite', amount: 90 },
    { x: -128, y: 128, key: 'hydrocarbons', amount: 100 }
  ];
  for (const dep of deposits) {
    const defName = {
      ironOre: 'Minerai de fer',
      copper: 'Cuivre',
      aluminiumOre: 'Minerai d’aluminium',
      quartz: 'Quartz',
      graphite: 'Graphite',
      hydrocarbons: 'Hydrocarbures'
    }[dep.key] || dep.key;
    const st = createStructure(state, 'resource_deposit', sx, sy, dep.x, dep.y, {
      ownerId: player.id | 0,
      ownerKey: 'test',
      ownerName: 'Gisement test',
      worldId,
      depositResourceKey: dep.key,
      depositRemaining: dep.amount,
      depositMax: dep.amount,
      depositLabel: defName,
      createdAt: timeMs,
      updatedAt: timeMs
    });
    if (!st) continue;
    st.name = `Gisement test ${defName}`;
    state.structures.set(st.id, st);
  }
}
