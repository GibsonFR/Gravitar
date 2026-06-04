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
import { updateStructures } from './structures/StructureSystem.js';
import { updateResearchStations } from './structures/StructureResearchStation.js';
import { updateEquipmentRDStations } from './structures/StructureEquipmentRDStation.js';
import { createPlayer } from './player/PlayerFactory.js';
import { applyInputMessage } from './player/PlayerInput.js';
import { buildSnapshot } from './snapshot/SnapshotBuilder.js';
import { buildNetV2BootstrapSnapshot, buildNetV2StatePacket, buildNetV2PlayerPosePacket } from './snapshot/NetV2SnapshotBuilder.js';
import { clearWorldSfx } from './audio/WorldSfxState.js';
import { clearCombatFx } from './combat/CombatFxState.js';
import { clearStatusPassiveEvents } from './events/StatusPassiveEvents.js';
import { pruneLogisticTransferEvents } from './events/LogisticTransferEvents.js';
import { applyCommand } from './commands/CommandRouter.js';
import { ensureSectorLoaded } from './sector/SectorEnsure.js';
import { visitSectorOnPlayer } from './map/PlayerMapState.js';
import { GAME_MODES, clearPlayerBattleResidue, updateModeSessions } from './modes/GameModes.js';
import { buildEndlessSave } from './accounts/AccountStore.js';

const ACCOUNT_AUTOSAVE_INTERVAL_MS = Number(process.env.GRAVITAR_AUTOSAVE_MS || 30000);
const NET_V2_RESET_ENABLED = process.env.GRAVITAR_NET_V2_RESET !== '0';
const NET_V2_ACTIVE_STATE_RATE_MS = Math.max(50, Number(process.env.GRAVITAR_NET_V2_ACTIVE_STATE_RATE_MS || 100));
const NET_V2_IDLE_STATE_RATE_MS = Math.max(250, Number(process.env.GRAVITAR_NET_V2_IDLE_STATE_RATE_MS || 1000));
const NET_V2_POSE_RATE_MS = Math.max(33, Number(process.env.GRAVITAR_NET_V2_POSE_RATE_MS || 67));

export function createGameServer() {
  const state = createGameState();
  seedWorld(state);

  let last = nowMs();
  let acc = 0;
  let snapAcc = 0;
  let poseAcc = 0;
  let running = false;
  let loopHandle = null;
  const lastFullSnapshotByPlayer = new Map();
  const lastStaticWorldByPlayer = new Map();
  const lastSectorKeyByPlayer = new Map();
  const lastNetStatsAtByPlayer = new Map();
  const lastStateV2ByPlayer = new Map();
  const lastStateV2SignatureByPlayer = new Map();
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
    p.worldSeed = state.seed | 0;
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
    lastStateV2ByPlayer.delete(id);
    lastStateV2SignatureByPlayer.delete(id);
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
    if (ok && p.accountKey && p.gameMode === GAME_MODES.ENDLESS && String(p.worldId || 'endless') === 'endless') {
      const cmd = String(msg?.cmd || '');
      if (cmd.includes('pirate_quest') || cmd === 'buy_conversion_recipe' || cmd === 'sell' || cmd === 'sell_all') persistAccountPlayer(p);
    }
    return { ok, error };
  }

  function stepFixed(dt, timeMs) {
    advanceSimulationTick(state, timeMs, Math.round(dt * 1000));
    updateModeSessions(state, timeMs);
    updateAsteroids(state, dt, timeMs);
    updateStations(state, dt, timeMs);
    updateStructures(state, dt, timeMs);
    updateResearchStations(state, timeMs, Math.round(dt * 1000));
    updateEquipmentRDStations(state, timeMs, Math.round(dt * 1000));
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

  function countNetV2ObserversInSector(player) {
    if (!player) return 0;
    const worldId = String(player.worldId || 'endless');
    const sx = player.sx | 0;
    const sy = player.sy | 0;
    let count = 0;
    for (const other of state.players.values()) {
      if (String(other.worldId || 'endless') === worldId && (other.sx | 0) === sx && (other.sy | 0) === sy) count += 1;
    }
    return count;
  }


  function netV2StateSignature(packet) {
    const players = Array.isArray(packet?.players) ? packet.players : [];
    const stablePlayers = players.map((p) => [
      p.id | 0,
      p.sx | 0,
      p.sy | 0,
      Math.round(Number(p.x || 0) * 10),
      Math.round(Number(p.y || 0) * 10),
      Math.round(Number(p.vx || 0) * 10),
      Math.round(Number(p.vy || 0) * 10),
      Math.round(Number(p.rot || 0) * 100),
      p.frameId || '',
      p.gameMode || '',
      p.testWorldId || '',
      p.battleSessionId || '',
      p.sessionSetup?.pending ? 1 : 0,
      p.sessionSetup?.step || '',
      p.sessionSetup?.authStatus || '',
      p.selectedKind || '',
      p.selectedId | 0,
      p.autoTargetKind || '',
      p.autoTargetId | 0,
      Math.round(Number(p.stats?.hp || 0)),
      Math.round(Number(p.stats?.shield || 0)),
      Math.round(Number(p.stats?.energy || 0)),
      Math.round(Number(p.cooldowns?.a || 0) * 10),
      Math.round(Number(p.cooldowns?.z || 0) * 10),
      Math.round(Number(p.cooldowns?.e || 0) * 10),
      Math.round(Number(p.cooldowns?.r || 0) * 10)
    ]);
    return JSON.stringify({
      ack: packet?.ackInputSeq | 0,
      players: stablePlayers
    });
  }

  function tickLoop(getConnectedIds, sendSnapshot) {
    if (!running) return;

    const t = nowMs();
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    acc += dt;
    snapAcc += dt;
    poseAcc += dt;

    while (acc >= TICK) {
      const stepTimeMs = Math.round(t - acc * 1000 + TICK * 1000);
      stepFixed(TICK, stepTimeMs);
      acc -= TICK;
    }

    if (NET_V2_RESET_ENABLED && poseAcc * 1000 >= NET_V2_POSE_RATE_MS) {
      poseAcc = 0;
      const ids = getConnectedIds();
      const timeMs = setSimulationTime(state, nowMs());
      for (const id of ids) {
        if (!state.players.has(id)) continue;
        const packet = buildNetV2PlayerPosePacket(state, id, timeMs);
        if (packet) sendSnapshot(id, packet);
      }
    }

    if (snapAcc >= SNAP_RATE) {
      snapAcc = 0;
    poseAcc = 0;
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
        const combatPressure = (p.autoTargetId | 0) > 0 || !!p.selectedId || (p.cooldownALeft || 0) > 0 || (p.cooldownZLeft || 0) > 0 || (p.cooldownELeft || 0) > 0 || (p.cooldownRLeft || 0) > 0;
        const legacyFullUi = forceFullUi || sectorChanged || (timeMs - previousFullAt >= SNAP_FULL_UI_RATE_MS);
        const staticRateMs = combatPressure ? SNAP_STATIC_WORLD_RATE_MS_COMBAT : SNAP_STATIC_WORLD_RATE_MS;
        const legacyStaticWorld = legacyFullUi || sectorChanged || (timeMs - previousStaticAt >= staticRateMs);
        const fullUi = NET_V2_RESET_ENABLED ? (forceFullUi || sectorChanged) : legacyFullUi;
        const staticWorld = NET_V2_RESET_ENABLED ? (forceFullUi || sectorChanged) : legacyStaticWorld;
        if (fullUi) lastFullSnapshotByPlayer.set(id, timeMs);
        if (staticWorld) lastStaticWorldByPlayer.set(id, timeMs);
        lastSectorKeyByPlayer.set(id, sectorKey);
        const needsSectorBootstrap = sectorChanged || staticWorld || fullUi;
        const snap = NET_V2_RESET_ENABLED
          ? (needsSectorBootstrap
            ? buildNetV2BootstrapSnapshot(state, id, timeMs, { fullUi, staticWorld, sectorBootstrap: true })
            : buildNetV2StatePacket(state, id, timeMs))
          : buildSnapshot(state, id, timeMs, { fullUi, staticWorld });
        snap.ackInputSeq = p.lastInputSeq | 0;

        if (NET_V2_RESET_ENABLED && !needsSectorBootstrap) {
          const signature = netV2StateSignature(snap);
          const previousSignature = lastStateV2SignatureByPlayer.get(id) || '';
          const previousAt = lastStateV2ByPlayer.get(id) || 0;
          const changed = signature !== previousSignature;
          const minInterval = changed ? NET_V2_ACTIVE_STATE_RATE_MS : NET_V2_IDLE_STATE_RATE_MS;
          if (timeMs - previousAt < minInterval) continue;
          lastStateV2ByPlayer.set(id, timeMs);
          lastStateV2SignatureByPlayer.set(id, signature);
        }
        snap.net = {
          ...(snap.net || {}),
          fullUi,
          staticWorld,
          combatPressure,
          serverSnapBuiltAt: timeMs,
          lastInputAt: p.lastInputAt || 0,
          lastClientAbilitySeq: p.lastClientAbilitySeq | 0,
          netV2Reset: NET_V2_RESET_ENABLED
        };
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
      clearStatusPassiveEvents(state);
      pruneLogisticTransferEvents(state, timeMs);
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
    buildStateV2(playerId, timeMs = getSimulationTimeMs(state, nowMs())) {
      return buildNetV2StatePacket(state, playerId, timeMs);
    },
    buildBootstrapV2(playerId, timeMs = getSimulationTimeMs(state, nowMs()), options = {}) {
      return buildNetV2BootstrapSnapshot(state, playerId, timeMs, { fullUi: true, staticWorld: true, sectorBootstrap: true, ...options });
    },
    isNetV2ResetEnabled() {
      return NET_V2_RESET_ENABLED;
    },
    start
  };
}
