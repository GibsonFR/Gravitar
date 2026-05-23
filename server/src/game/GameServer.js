import { createGameState, newPlayerId } from './state/GameState.js';
import { seedWorld } from './seed/SeedWorld.js';
import { TICK, SNAP_RATE, SNAP_FULL_UI_RATE_MS, SNAP_STATIC_WORLD_RATE_MS, SNAP_STATIC_WORLD_RATE_MS_COMBAT, SERVER_LOOP_INTERVAL_MS } from './constants.js';
import { advanceSimulationTick, getSimulationTimeMs, nowMs, setSimulationTime } from './util/Time.js';
import { updateAsteroids } from './asteroid/AsteroidSystem.js';
import { updateStations } from './station/StationSystem.js';
import { updateProjectiles } from './projectile/ProjectileSystem.js';
import { updateMobs } from './mob/MobSystem.js';
import { updateAreaEffects } from './abilities/area/AreaEffectSystem.js';
import { updateConverters } from './converter/ConverterSystem.js';
import { updateStatuses } from './status/StatusSystem.js';
import { updateTestEffectZones } from './status/TestEffectZoneSystem.js';
import { updateBastions } from './bastion/BastionSystem.js';
import { updatePlayer } from './player/PlayerSystem.js';
import { updateLoots } from './loot/LootSystem.js';
import { updateSectors } from './sector/SectorSystem.js';
import { createPlayer } from './player/PlayerFactory.js';
import { applyInputMessage } from './player/PlayerInput.js';
import { buildSnapshot } from './snapshot/SnapshotBuilder.js';
import { clearWorldSfx } from './audio/WorldSfxState.js';
import { clearCombatFx } from './combat/CombatFxState.js';
import { applyCommand } from './commands/CommandRouter.js';
import { ensureSectorLoaded } from './sector/SectorEnsure.js';
import { visitSectorOnPlayer } from './map/PlayerMapState.js';
import { GAME_MODES, clearPlayerBattleResidue, updateModeSessions } from './modes/GameModes.js';
import { buildEndlessSave } from './accounts/AccountStore.js';

const ACCOUNT_AUTOSAVE_INTERVAL_MS = Number(process.env.GRAVITAR_AUTOSAVE_MS || 30000);

export function createGameServer() {
  const state = createGameState();
  seedWorld(state);

  let last = nowMs();
  let acc = 0;
  let snapAcc = 0;
  let running = false;
  let loopHandle = null;
  const lastFullSnapshotByPlayer = new Map();
  const lastStaticWorldByPlayer = new Map();
  const lastSectorKeyByPlayer = new Map();
  const lastNetStatsAtByPlayer = new Map();
  let lastAccountAutosaveAt = 0;



  function persistAccountPlayer(player) {
    if (!player?.accountKey || !state.accounts) return;
    if (player.gameMode === GAME_MODES.ENDLESS && String(player.worldId || 'endless') === 'endless') state.accounts.saveEndless(player.accountKey, buildEndlessSave(player));
    const battleStats = state.modes?.battleStats?.get?.(player.accountKey);
    if (battleStats) state.accounts.saveBattleStats(player.accountKey, battleStats);
  }

  function autosaveAccounts(timeMs) {
    if (!state.accounts || ACCOUNT_AUTOSAVE_INTERVAL_MS <= 0) return;
    if (timeMs - lastAccountAutosaveAt < ACCOUNT_AUTOSAVE_INTERVAL_MS) return;
    lastAccountAutosaveAt = timeMs;
    for (const player of state.players.values()) persistAccountPlayer(player);
  }

  function allocatePlayerId() {
    return newPlayerId(state);
  }

  function addPlayer(id) {
    const timeMs = getSimulationTimeMs(state, nowMs());
    const p = createPlayer(id, undefined, timeMs);
    state.players.set(id, p);
    ensureSectorLoaded(state, p.sx | 0, p.sy | 0, timeMs);
    visitSectorOnPlayer(state, p, p.sx | 0, p.sy | 0, timeMs);
    return p;
  }

  function removePlayer(id) {
    const p = state.players.get(id);
    if (p) clearPlayerBattleResidue(state, p, getSimulationTimeMs(state, nowMs()), { checkWinner: true });
    persistAccountPlayer(p);
    state.modes?.battleQueueNext?.delete?.(id | 0);
    lastFullSnapshotByPlayer.delete(id);
    lastStaticWorldByPlayer.delete(id);
    lastSectorKeyByPlayer.delete(id);
    lastNetStatsAtByPlayer.delete(id);
    state.players.delete(id);
  }

  function handleInput(id, msg) {
    const p = state.players.get(id);
    if (!p) return;
    applyInputMessage(state, p, msg, getSimulationTimeMs(state, nowMs()));
  }

  function handleCommand(id, msg) {
    const p = state.players.get(id);
    if (!p) return false;
    const timeMs = getSimulationTimeMs(state, nowMs());
    let ok = false;
    let error = '';
    try {
      const result = applyCommand(state, p, msg, timeMs);
      if (typeof result === 'object' && result) {
        ok = !!result.ok;
        error = String(result.error || '');
      } else {
        ok = !!result;
      }
    } catch (err) {
      ok = false;
      error = 'server_exception';
      console.error('[cmd:error]', msg?.cmd || 'unknown', err?.stack || err);
    }

    // Station/account/UI commands need a fresh full snapshot, but only once.
    // This gives immediate UI refresh after ack without streaming the whole station UI at 60 Hz.
    p.forceFullUiSnapshot = true;
    p.forceFullUiSnapshotAt = timeMs;
    p.forceFullUiSnapshotReason = String(msg?.cmd || '').slice(0, 32);
    p.lastCommandError = error;
    return { ok, error };
  }

  function stepFixed(dt, timeMs) {
    advanceSimulationTick(state, timeMs, Math.round(dt * 1000));
    updateModeSessions(state, timeMs);
    updateAsteroids(state, dt, timeMs);
    updateStations(state, dt, timeMs);
    updateTestEffectZones(state, dt, timeMs);
    updateStatuses(state, dt, timeMs);
    for (const p of state.players.values()) updatePlayer(state, p, dt, timeMs);
    updateConverters(state, dt, timeMs);
    updateMobs(state, dt, timeMs);
    updateBastions(state, dt, timeMs);
    updateProjectiles(state, dt, timeMs);
    updateAreaEffects(state, dt, timeMs);
    updateLoots(state, dt, timeMs);
    updateSectors(state, dt, timeMs);
  }

  function tickLoop(getConnectedIds, sendSnapshot) {
    if (!running) return;

    const t = nowMs();
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    acc += dt;
    snapAcc += dt;

    while (acc >= TICK) {
      const stepTimeMs = Math.round(t - acc * 1000 + TICK * 1000);
      stepFixed(TICK, stepTimeMs);
      acc -= TICK;
    }

    if (snapAcc >= SNAP_RATE) {
      snapAcc = 0;
      const ids = getConnectedIds();
      const timeMs = setSimulationTime(state, nowMs());
      for (const id of ids) {
        if (!state.players.has(id)) continue;
        const p = state.players.get(id);
        const sectorKey = `${p.worldId || 'endless'}:${p.sx | 0}:${p.sy | 0}`;
        const previousFullAt = lastFullSnapshotByPlayer.get(id) || 0;
        const previousStaticAt = lastStaticWorldByPlayer.get(id) || 0;
        const previousSectorKey = lastSectorKeyByPlayer.get(id) || '';
        const sectorChanged = previousSectorKey !== sectorKey;
        const forceFullUi = !!p?.forceFullUiSnapshot;
        const fullUi = forceFullUi || sectorChanged || (timeMs - previousFullAt >= SNAP_FULL_UI_RATE_MS);
        const combatPressure = (p.autoTargetId | 0) > 0 || !!p.selectedId || (p.cooldownALeft || 0) > 0 || (p.cooldownZLeft || 0) > 0 || (p.cooldownELeft || 0) > 0 || (p.cooldownRLeft || 0) > 0;
        const staticRateMs = combatPressure ? SNAP_STATIC_WORLD_RATE_MS_COMBAT : SNAP_STATIC_WORLD_RATE_MS;
        const staticWorld = fullUi || sectorChanged || (timeMs - previousStaticAt >= staticRateMs);
        if (fullUi) lastFullSnapshotByPlayer.set(id, timeMs);
        if (staticWorld) lastStaticWorldByPlayer.set(id, timeMs);
        lastSectorKeyByPlayer.set(id, sectorKey);
        const snap = buildSnapshot(state, id, timeMs, { fullUi, staticWorld });
        if (forceFullUi) {
          p.forceFullUiSnapshot = false;
          p.forceFullUiSnapshotReason = '';
        }
        const sent = sendSnapshot(id, snap);
        if (sent && process.env.NET_DEBUG === '1') {
          const prevLog = lastNetStatsAtByPlayer.get(id) || 0;
          if (timeMs - prevLog >= 10000) {
            lastNetStatsAtByPlayer.set(id, timeMs);
            console.log(`[net] player=${id} sector=${sectorKey} fullUi=${fullUi ? 1 : 0} static=${staticWorld ? 1 : 0}`);
          }
        }
      }
      autosaveAccounts(timeMs);
      clearWorldSfx(state);
      clearCombatFx(state);
    }

  }

  function start(getConnectedIds, sendSnapshot) {
    if (running) return;
    running = true;
    last = nowMs();
    setSimulationTime(state, last);
    acc = 0;
    snapAcc = 0;
    loopHandle = setInterval(() => tickLoop(getConnectedIds, sendSnapshot), SERVER_LOOP_INTERVAL_MS);
  }

  return {
    state,
    allocatePlayerId,
    addPlayer,
    removePlayer,
    handleInput,
    handleCommand,
    start
  };
}
