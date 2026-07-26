import { createGameState, newPlayerId } from './state/GameState.js';
import { tryResolveExplicitLootPickup } from './loot/LootPickupSystem.js';
import { queueLootRemovedEvent } from './events/WorldEntityEvents.js';
import { seedWorld } from './seed/SeedWorld.js';
import { TICK, SNAP_RATE, SNAP_FULL_UI_RATE_MS, SNAP_STATIC_WORLD_RATE_MS, SNAP_STATIC_WORLD_RATE_MS_COMBAT, SERVER_LOOP_INTERVAL_MS } from './constants.js';
import { advanceSimulationTick, getSimulationTick, getSimulationTimeMs, nowMs, setSimulationTime } from './util/Time.js';
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
import { buildNetworkEventsFromLegacy } from './events/NetworkEventStream.js';
import { buildNetV2BootstrapSnapshot, buildNetV2StatePacket, buildNetV2PlayerPosePacket, buildNetV2PlayerEnterPacket, buildNetV2PlayerLeavePacket, buildNetV2SectorUnloadPacket, buildNetV2InputAckPacket, buildNetV2PlayerStatusPacket, buildNetV2PlayerSessionPacket, buildNetV2ProjectileEventsPacket, buildNetV2CombatEventsPacket, buildNetV2NetworkEventsPacket, buildNetV2WorldEventsPacket, buildNetV2WorldEntitiesDeltaPacket, buildNetV2LogisticsPacket, buildNetV2MetaPacket, buildNetV2CargoPacket, buildNetV2CargoBootstrapPacket, buildNetV2CargoDeltaPacket, buildNetV2CargoSummary, buildNetV2MobPosePacket } from './snapshot/NetV2SnapshotBuilder.js';
import { clearWorldSfx, peekWorldSfx } from './audio/WorldSfxState.js';
import { drainPlayerSfx } from './audio/PlayerSfxState.js';
import { clearCombatFx, peekCombatFx } from './combat/CombatFxState.js';
import { clearStatusPassiveEvents, peekStatusEventsForPlayer, peekPassiveEventsForPlayer } from './events/StatusPassiveEvents.js';
import { peekLogisticTransferEventsForPlayer, pruneLogisticTransferEvents } from './events/LogisticTransferEvents.js';
import { peekProjectileEventsForPlayer } from './events/ProjectileEvents.js';
import { peekWorldEntityEventsForPlayer, pruneWorldEntityEvents } from './events/WorldEntityEvents.js';
import { drainAbilityProtocolEvents } from './events/AbilityProtocolEvents.js';
import { applyCommand } from './commands/CommandRouter.js';
import { ensureSectorLoaded } from './sector/SectorEnsure.js';
import { visitSectorOnPlayer } from './map/PlayerMapState.js';
import { GAME_MODES, clearPlayerBattleResidue, updateModeSessions } from './modes/GameModes.js';
import { buildEndlessSave } from './accounts/AccountStore.js';

const ACCOUNT_AUTOSAVE_INTERVAL_MS = Number(process.env.GRAVITAR_AUTOSAVE_MS || 30000);
const NET_V2_RESET_ENABLED = process.env.GRAVITAR_NET_V2_RESET !== '0';
const NET_V2_ACTIVE_STATE_RATE_MS = Math.max(50, Number(process.env.GRAVITAR_NET_V2_ACTIVE_STATE_RATE_MS || 100));
const NET_V2_IDLE_STATE_RATE_MS = Math.max(250, Number(process.env.GRAVITAR_NET_V2_IDLE_STATE_RATE_MS || 1000));
const NET_V2_POSE_RATE_MS = Math.max(25, Number(process.env.GRAVITAR_NET_V2_POSE_RATE_MS || 33));
const NET_V2_STATUS_ACTIVE_RATE_MS = Math.max(80, Number(process.env.GRAVITAR_NET_V2_STATUS_ACTIVE_RATE_MS || 150));
const NET_V2_STATUS_IDLE_RATE_MS = Math.max(250, Number(process.env.GRAVITAR_NET_V2_STATUS_IDLE_RATE_MS || 1000));
const NET_V2_SESSION_HEARTBEAT_MS = Math.max(0, Number(process.env.GRAVITAR_NET_V2_SESSION_HEARTBEAT_MS || SNAP_FULL_UI_RATE_MS));
const NET_V2_WORLD_DELTA_MS = Math.max(100, Number(process.env.GRAVITAR_NET_V2_WORLD_DELTA_MS || 250));
const NET_V2_WORLD_RECONCILE_MS = Math.max(1000, Number(process.env.GRAVITAR_NET_V2_WORLD_RECONCILE_MS || 3000));
const NET_V2_LOGISTICS_RATE_MS = Math.max(50, Number(process.env.GRAVITAR_NET_V2_LOGISTICS_RATE_MS || 100));
const NET_V2_LOGISTICS_IDLE_MS = Math.max(250, Number(process.env.GRAVITAR_NET_V2_LOGISTICS_IDLE_MS || 1000));
const NET_V2_META_ACTIVE_RATE_MS = Math.max(200, Number(process.env.GRAVITAR_NET_V2_META_ACTIVE_RATE_MS || 250));
const NET_V2_META_IDLE_RATE_MS = Math.max(500, Number(process.env.GRAVITAR_NET_V2_META_IDLE_RATE_MS || 1000));

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
  const knownRemotePlayersByObserver = new Map();
  const lastInputAckByPlayer = new Map();
  const lastStatusV2ByPlayer = new Map();
  const lastStatusV2SignatureByPlayer = new Map();
  const lastSessionV2ByPlayer = new Map();
  const lastSessionV2SignatureByPlayer = new Map();
  const sentProjectileEventIdsByPlayer = new Map();
  const sentCombatEventIdsByPlayer = new Map();
  const sentNetworkEventIdsByPlayer = new Map();
  const sentLogisticEventIdsByPlayer = new Map();
  const lastWorldDeltaCheckByPlayer = new Map();
  const lastWorldDeltaV2ByPlayer = new Map();
  const lastWorldDeltaV2SignatureByPlayer = new Map();
  const lastLogisticsCheckByPlayer = new Map();
  const lastLogisticsV2ByPlayer = new Map();
  const lastLogisticsV2SignatureByPlayer = new Map();
  const lastMetaCheckByPlayer = new Map();
  const lastMetaV2ByPlayer = new Map();
  const lastMetaV2SignatureByPlayer = new Map();
  const lastCargoV2ByPlayer = new Map();
  const lastCargoV2SignatureByPlayer = new Map();
  const lastCargoSummaryByPlayer = new Map();
  const sentWorldEntityEventIdsByPlayer = new Map();
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
    knownRemotePlayersByObserver.delete(id);
    lastInputAckByPlayer.delete(id);
    lastStatusV2ByPlayer.delete(id);
    lastStatusV2SignatureByPlayer.delete(id);
    lastSessionV2ByPlayer.delete(id);
    lastSessionV2SignatureByPlayer.delete(id);
    sentProjectileEventIdsByPlayer.delete(id);
    sentCombatEventIdsByPlayer.delete(id);
    sentNetworkEventIdsByPlayer.delete(id);
    sentLogisticEventIdsByPlayer.delete(id);
    lastWorldDeltaCheckByPlayer.delete(id);
    lastWorldDeltaV2ByPlayer.delete(id);
    lastWorldDeltaV2SignatureByPlayer.delete(id);
    lastLogisticsCheckByPlayer.delete(id);
    lastLogisticsV2ByPlayer.delete(id);
    lastLogisticsV2SignatureByPlayer.delete(id);
    lastMetaCheckByPlayer.delete(id);
    lastMetaV2ByPlayer.delete(id);
    lastMetaV2SignatureByPlayer.delete(id);
    lastCargoV2ByPlayer.delete(id);
    lastCargoV2SignatureByPlayer.delete(id);
    lastCargoSummaryByPlayer.delete(id);
    sentWorldEntityEventIdsByPlayer.delete(id);
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

    // Most station/account/UI commands still need a fresh full UI bootstrap.
    // Ability upgrades are small progression/loadout mutations and must stay packet-only:
    // player_session_v2/player_status_v2 carry updated skill points/ability data.
    const cmdName = String(msg?.cmd || '');
    if (cmdName === 'upgrade_ability') {
      p.forceSessionV2 = true;
      p.forceStatusV2 = true;
    } else {
      p.forceFullUiSnapshot = true;
      p.forceFullUiSnapshotAt = timeMs;
      p.forceFullUiSnapshotReason = cmdName.slice(0, 32);
    }
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


  function sectorKeyOfPlayer(player) {
    if (!player) return '';
    return `${player.worldId || 'endless'}:${player.sx | 0}:${player.sy | 0}`;
  }

  function visibleRemotePlayersFor(observer) {
    if (!observer) return [];
    const worldId = String(observer.worldId || 'endless');
    const sx = observer.sx | 0;
    const sy = observer.sy | 0;
    return [...state.players.values()].filter((p) =>
      (p.id | 0) !== (observer.id | 0) &&
      String(p.worldId || 'endless') === worldId &&
      (p.sx | 0) === sx &&
      (p.sy | 0) === sy
    );
  }

  function visibleRemoteIdSet(observer) {
    return new Set(visibleRemotePlayersFor(observer).map((p) => p.id | 0));
  }

  function syncNetV2PlayerLifecycleForObserver(observerId, timeMs, sendPacket, options = {}) {
    if (!NET_V2_RESET_ENABLED) return;
    const observer = state.players.get(observerId);
    if (!observer) return;

    const currentSectorKey = sectorKeyOfPlayer(observer);
    const previousSectorKey = lastSectorKeyByPlayer.get(observerId) || '';
    const known = knownRemotePlayersByObserver.get(observerId) || new Set();
    const currentRemotes = visibleRemotePlayersFor(observer);
    const currentIds = new Set(currentRemotes.map((p) => p.id | 0));
    const sectorChanged = !!options.sectorChanged || (!!previousSectorKey && previousSectorKey !== currentSectorKey);

    if (sectorChanged) {
      const unload = buildNetV2SectorUnloadPacket(state, observerId, previousSectorKey, [...known], timeMs, 'sector_changed');
      if (unload) sendPacket(observerId, unload);
      known.clear();
    }

    const leaving = [];
    for (const id of known) {
      if (!currentIds.has(id)) leaving.push(id);
    }
    if (leaving.length) {
      const leave = buildNetV2PlayerLeavePacket(state, observerId, leaving, timeMs, 'leave_sector');
      if (leave) sendPacket(observerId, leave);
      for (const id of leaving) known.delete(id);
    }

    // If a sector bootstrap is sent in the same tick, it already carries the
    // initial player list through state_v2/bootstrap path. We still set known
    // here to prevent duplicate enter packets immediately after bootstrap.
    if (!options.skipEnterPackets) {
      const entering = currentRemotes.filter((p) => !known.has(p.id | 0));
      if (entering.length) {
        const enter = buildNetV2PlayerEnterPacket(state, observerId, entering, timeMs);
        if (enter) sendPacket(observerId, enter);
      }
    }

    for (const id of currentIds) known.add(id);
    knownRemotePlayersByObserver.set(observerId, known);
  }

  function inSameSectorForNetV2(ev, player) {
    if (!ev || !player) return false;
    const sx = ev.sx | 0;
    const sy = ev.sy | 0;
    if (sx !== (player.sx | 0) || sy !== (player.sy | 0)) return false;
    const evWorld = String(ev.worldId || player.worldId || 'endless');
    return evWorld === String(player.worldId || 'endless');
  }

  function takeUnsentById(map, playerId, items, maxRemember = 4096) {
    let sent = map.get(playerId);
    if (!sent) {
      sent = new Set();
      map.set(playerId, sent);
    }
    const out = [];
    for (const item of items || []) {
      const id = item?.id | 0;
      if (!id) continue;
      if (sent.has(id)) continue;
      sent.add(id);
      out.push(item);
    }
    if (sent.size > maxRemember) {
      const keep = [...sent].slice(-Math.floor(maxRemember * 0.65));
      map.set(playerId, new Set(keep));
    }
    return out;
  }

  function visibleCombatEventsForPlayer(player) {
    if (!player) return [];
    const worldId = String(player.worldId || 'endless');
    return peekCombatFx(state).filter((ev) => {
      if (!ev) return false;
      if ((ev.sx | 0) !== (player.sx | 0) || (ev.sy | 0) !== (player.sy | 0)) return false;
      const evWorld = String(ev.worldId || worldId);
      return evWorld === worldId;
    });
  }

  function visibleWorldSfxForPlayer(player) {
    if (!player) return [];
    const sx = player.sx | 0;
    const sy = player.sy | 0;
    const worldId = String(player.worldId || 'endless');
    return peekWorldSfx(state).filter((ev) => {
      if (!ev) return false;
      if ((ev.sx | 0) !== sx || (ev.sy | 0) !== sy) return false;
      const evWorld = String(ev.worldId || worldId);
      return evWorld === worldId;
    });
  }

  function sendNetV2NetworkEvents(id, player, timeMs, sendPacket) {
    if (!NET_V2_RESET_ENABLED || !player) return;
    const worldSfx = visibleWorldSfxForPlayer(player);
    const playerSfx = drainPlayerSfx(player);
    const abilityProtocolEvents = drainAbilityProtocolEvents(player);
    const statusEvents = peekStatusEventsForPlayer(state, player);
    const passiveEvents = peekPassiveEventsForPlayer(state, player);
    const logisticTransferEvents = takeUnsentById(
      sentLogisticEventIdsByPlayer,
      id,
      peekLogisticTransferEventsForPlayer(state, player),
      8192
    );
    if (!worldSfx.length && !playerSfx.length && !abilityProtocolEvents.length && !statusEvents.length && !passiveEvents.length && !logisticTransferEvents.length) return;

    const events = buildNetworkEventsFromLegacy(state, id, timeMs, worldSfx, [], playerSfx, abilityProtocolEvents, statusEvents, passiveEvents, logisticTransferEvents);
    const unsent = takeUnsentById(sentNetworkEventIdsByPlayer, id, events, 8192);
    if (!unsent.length) return;
    const packet = buildNetV2NetworkEventsPacket(state, id, unsent, timeMs);
    if (packet) sendPacket(id, packet);
  }

  function netV2CargoSignature(packet) {
    const inv = packet?.inv || {};
    return JSON.stringify({
      credits: inv.credits | 0,
      cargoUsed: Math.round(Number(inv.cargoUsed || 0) * 100),
      cargoMax: Math.round(Number(inv.cargoMax || 0) * 100),
      resources: (Array.isArray(inv.resources) ? inv.resources : []).map((r) => [r.key || '', Math.round(Number(r.amount || 0) * 100)])
    });
  }

  function sendNetV2WorldEvents(id, player, timeMs, sendPacket) {
    if (!NET_V2_RESET_ENABLED || !player) return;
    const events = takeUnsentById(sentWorldEntityEventIdsByPlayer, id, peekWorldEntityEventsForPlayer(state, player), 8192);
    if (!events.length) return;
    const packet = buildNetV2WorldEventsPacket(state, id, events, timeMs);
    if (packet) sendPacket(id, packet);
  }

  function sendNetV2CargoPacket(id, player, timeMs, sendPacket, options = {}) {
    if (!NET_V2_RESET_ENABLED || !player) return;

    if (options.force) {
      const bootstrap = buildNetV2CargoBootstrapPacket(state, id, timeMs);
      if (bootstrap && sendPacket(id, bootstrap)) {
        lastCargoV2ByPlayer.set(id, timeMs);
        lastCargoV2SignatureByPlayer.set(id, netV2CargoSignature(bootstrap));
        lastCargoSummaryByPlayer.set(id, buildNetV2CargoSummary(state, id));
      }
      return;
    }

    const previous = lastCargoSummaryByPlayer.get(id) || null;
    const delta = buildNetV2CargoDeltaPacket(state, id, previous, timeMs);
    if (!delta) return;
    if (sendPacket(id, delta)) {
      lastCargoV2ByPlayer.set(id, timeMs);
      lastCargoSummaryByPlayer.set(id, delta.summary || buildNetV2CargoSummary(state, id));
      lastCargoV2SignatureByPlayer.set(id, JSON.stringify(delta.summary || {}));
    }
  }

  function sendNetV2MobPosePacket(id, player, timeMs, sendPacket) {
    if (!NET_V2_RESET_ENABLED || !player) return;
    const packet = buildNetV2MobPosePacket(state, id, timeMs);
    if (packet) sendPacket(id, packet);
  }

  function netV2WorldDeltaSignature(packet) {
    if (!packet) return '';
    const statusKey = (statuses) => (Array.isArray(statuses) ? statuses : []).map((s) => [
      s?.id || s?.effectId || '',
      s?.key || '',
      s?.stacks | 0,
      Math.round(Number(s?.durationLeft || 0))
    ]);
    return JSON.stringify({
      sector: [packet.worldId || '', packet.sx | 0, packet.sy | 0],
      asteroids: (Array.isArray(packet.asteroids) ? packet.asteroids : []).map((a) => [
        a.id | 0,
        Math.round(Number(a.vitals?.hp || 0)),
        Math.round(Number(a.vitals?.shield || 0)),
        Math.round(Number(a.x || 0)),
        Math.round(Number(a.y || 0)),
        statusKey(a.statuses)
      ]),
      mobs: (Array.isArray(packet.mobs) ? packet.mobs : []).map((m) => [
        m.id | 0,
        m.typeId | 0,
        Math.round(Number(m.vitals?.hp || 0)),
        Math.round(Number(m.vitals?.shield || 0)),
        statusKey(m.statuses),
        m.specialCue || '',
        Math.round(Number(m.specialCueLeft || 0) * 2)
      ]),
      stations: (Array.isArray(packet.stations) ? packet.stations : []).map((s) => [
        s.id | 0,
        s.tech | 0,
        s.specialtyId || ''
      ]),
      structures: (Array.isArray(packet.structures) ? packet.structures : []).map((s) => [
        s.id | 0,
        s.type || '',
        Math.round(Number(s.x || 0)),
        Math.round(Number(s.y || 0)),
        s.orientation || '',
        Math.round(Number(s.vitals?.hp || 0)),
        s.powered ? 1 : 0,
        s.open ? 1 : 0,
        s.machineEnabled ? 1 : 0,
        Math.round(Number(s.machineJob?.progress || 0) * 20),
        Math.round(Number(s.researchProgress || 0) * 20),
        s.turretStatus || '',
        s.turretTargetId | 0,
        s.turretEnabled ? 1 : 0,
        s.turretMode || ''
      ]),
      portals: (Array.isArray(packet.portals) ? packet.portals : []).map((p) => [
        p.id | 0,
        p.unlocked ? 1 : 0,
        p.unlockText || ''
      ]),
      loots: (Array.isArray(packet.loots) ? packet.loots : []).map((l) => [
        l.id | 0,
        l.resource || l.itemId || '',
        Math.round(Number(l.amount || 0) * 100)
      ]),
      areaEffects: (Array.isArray(packet.areaEffects) ? packet.areaEffects : []).map((a) => [
        a.id | 0,
        a.kind || '',
        a.phase || '',
        Math.round(Number(a.cooldownLeft || 0)),
        Math.round(Number(a.activeSeconds || 0)),
        Math.round(Number(a.dormantSeconds || 0))
      ])
    });
  }

  function sendNetV2WorldEntitiesDelta(id, player, timeMs, sendPacket, options = {}) {
    if (!NET_V2_RESET_ENABLED || !player) return;
    const previousCheckAt = lastWorldDeltaCheckByPlayer.get(id) || 0;
    if (!options.force && timeMs - previousCheckAt < NET_V2_WORLD_DELTA_MS) return;
    lastWorldDeltaCheckByPlayer.set(id, timeMs);
    const packet = buildNetV2WorldEntitiesDeltaPacket(state, id, timeMs);
    if (!packet) return;
    const sig = netV2WorldDeltaSignature(packet);
    const prevSig = lastWorldDeltaV2SignatureByPlayer.get(id) || '';
    const prevAt = lastWorldDeltaV2ByPlayer.get(id) || 0;
    const changed = sig !== prevSig;
    const due = changed
      ? timeMs - prevAt >= NET_V2_WORLD_DELTA_MS
      : timeMs - prevAt >= NET_V2_WORLD_RECONCILE_MS;
    if (!options.force && !due) return;
    if (sendPacket(id, packet)) {
      lastWorldDeltaV2ByPlayer.set(id, timeMs);
      lastWorldDeltaV2SignatureByPlayer.set(id, sig);
    }
  }

  function netV2LogisticsSignature(packet) {
    if (!packet) return '';
    return JSON.stringify({
      sector: [packet.worldId || '', packet.sx | 0, packet.sy | 0],
      automation: (Array.isArray(packet.structureAutomation) ? packet.structureAutomation : []).map((s) => [
        s.id | 0,
        s.automationKind || '',
        Math.round(Number(s.automationPulse || 0) * 10),
        s.automationStatus || '',
        s.automationItem?.id | 0,
        s.automationItem?.phase || '',
        Math.round(Number(s.automationItem?.progress || 0) * 20),
        s.depositRemaining | 0,
        Math.round(Number(s.extractionProgress || 0) * 20)
      ]),
      drones: (Array.isArray(packet.logisticDrones) ? packet.logisticDrones : []).map((d) => [
        d.id | 0,
        d.sx | 0,
        d.sy | 0,
        Math.round(Number(d.x || 0)),
        Math.round(Number(d.y || 0)),
        Math.round(Number(d.vitals?.hp || d.stats?.hp || 0)),
        d.state || d.phase || ''
      ])
    });
  }

  function sendNetV2LogisticsPacket(id, player, timeMs, sendPacket, options = {}) {
    if (!NET_V2_RESET_ENABLED || !player) return;
    const previousCheckAt = lastLogisticsCheckByPlayer.get(id) || 0;
    if (!options.force && timeMs - previousCheckAt < NET_V2_LOGISTICS_RATE_MS) return;
    lastLogisticsCheckByPlayer.set(id, timeMs);
    const packet = buildNetV2LogisticsPacket(state, id, timeMs);
    const prevAt = lastLogisticsV2ByPlayer.get(id) || 0;
    if (!packet) {
      if (lastLogisticsV2SignatureByPlayer.get(id) && (options.force || timeMs - prevAt >= NET_V2_LOGISTICS_RATE_MS)) {
        const empty = {
          t: 'logistics_v2',
          protocol: 'net_v2_reset',
          time: timeMs,
          tick: getSimulationTick(state),
          worldId: String(player.worldId || 'endless'),
          sx: player.sx | 0,
          sy: player.sy | 0,
          structureAutomation: [],
          logisticDrones: [],
          net: { netV2Reset: true, packet: 'logistics_v2', authoritativeLogistics: true }
        };
        if (sendPacket(id, empty)) {
          lastLogisticsV2ByPlayer.set(id, timeMs);
          lastLogisticsV2SignatureByPlayer.set(id, '');
        }
      }
      return;
    }
    const sig = netV2LogisticsSignature(packet);
    const prevSig = lastLogisticsV2SignatureByPlayer.get(id) || '';
    const changed = sig !== prevSig;
    const minInterval = changed ? NET_V2_LOGISTICS_RATE_MS : NET_V2_LOGISTICS_IDLE_MS;
    if (!options.force && timeMs - prevAt < minInterval) return;
    if (sendPacket(id, packet)) {
      lastLogisticsV2ByPlayer.set(id, timeMs);
      lastLogisticsV2SignatureByPlayer.set(id, sig);
    }
  }

  function netV2MetaSignature(packet) {
    const modes = packet?.modes || {};
    return JSON.stringify({
      session: [
        Math.floor(Number(packet?.session?.remainingMs || 0) / 1000),
        Math.floor(Number(packet?.session?.elapsedMs || 0) / 1000)
      ],
      modes: {
        ...modes,
        battleNextInMs: Math.floor(Number(modes.battleNextInMs || 0) / 1000),
        battleSessions: (Array.isArray(modes.battleSessions) ? modes.battleSessions : []).map((s) => ({
          ...s,
          remainingMs: Math.floor(Number(s.remainingMs || 0) / 1000)
        }))
      },
      players: (Array.isArray(packet?.playerDirectory) ? packet.playerDirectory : []).map((p) => [
        p.id | 0,
        p.pseudo || '',
        p.frameId || '',
        p.level | 0,
        p.sx | 0,
        p.sy | 0,
        p.inBastion ? 1 : 0,
        (Array.isArray(p.bastions) ? p.bastions : []).map((b) => b.id || b.type || b.name || '')
      ])
    });
  }

  function sendNetV2MetaPacket(id, player, timeMs, sendPacket, options = {}) {
    if (!NET_V2_RESET_ENABLED || !player) return;
    const previousCheckAt = lastMetaCheckByPlayer.get(id) || 0;
    if (!options.force && timeMs - previousCheckAt < NET_V2_META_ACTIVE_RATE_MS) return;
    lastMetaCheckByPlayer.set(id, timeMs);
    const packet = buildNetV2MetaPacket(state, id, timeMs);
    if (!packet) return;
    const sig = netV2MetaSignature(packet);
    const prevSig = lastMetaV2SignatureByPlayer.get(id) || '';
    const prevAt = lastMetaV2ByPlayer.get(id) || 0;
    const changed = sig !== prevSig;
    const minInterval = changed ? NET_V2_META_ACTIVE_RATE_MS : NET_V2_META_IDLE_RATE_MS;
    if (!options.force && timeMs - prevAt < minInterval) return;
    if (sendPacket(id, packet)) {
      lastMetaV2ByPlayer.set(id, timeMs);
      lastMetaV2SignatureByPlayer.set(id, sig);
    }
  }


  function sendNetV2ProjectileCombatPackets(id, player, timeMs, sendPacket) {
    if (!NET_V2_RESET_ENABLED || !player) return;

    const projectileEvents = takeUnsentById(sentProjectileEventIdsByPlayer, id, peekProjectileEventsForPlayer(state, player), 8192);
    if (projectileEvents.length) {
      const packet = buildNetV2ProjectileEventsPacket(state, id, projectileEvents, timeMs);
      if (packet) sendPacket(id, packet);
    }

    const combatEvents = takeUnsentById(sentCombatEventIdsByPlayer, id, visibleCombatEventsForPlayer(player), 8192);
    if (combatEvents.length) {
      const packet = buildNetV2CombatEventsPacket(state, id, combatEvents, timeMs);
      if (packet) sendPacket(id, packet);
    }
  }

  function netV2StatusSignature(packet) {
    const players = Array.isArray(packet?.players) ? packet.players : [];
    return JSON.stringify({
      ack: packet?.ackInputSeq | 0,
      players: players.map((p) => [
        p.id | 0,
        Math.round(Number(p.vitals?.hp || 0)),
        Math.round(Number(p.vitals?.shield || 0)),
        Math.round(Number(p.vitals?.energy || 0)),
        Math.round(Number(p.cooldowns?.A || p.cooldowns?.a || 0) * 10),
        Math.round(Number(p.cooldowns?.Z || p.cooldowns?.z || 0) * 10),
        Math.round(Number(p.cooldowns?.E || p.cooldowns?.e || 0) * 10),
        Math.round(Number(p.cooldowns?.R || p.cooldowns?.r || 0) * 10),
        Math.round(Number(p.rocketCooldownLeft || 0) * 10),
        p.selectedKind || '',
        p.selectedId | 0,
        p.autoTargetKind || '',
        p.autoTargetId | 0,
        ...(Array.isArray(p.statuses) ? p.statuses.map((s) => [
          s?.id || s?.effectId || '',
          s?.key || '',
          s?.markKey || '',
          Math.round(Number(s?.durationLeft || 0) * 10),
          s?.stacks | 0,
          s?.label || ''
        ]) : []),
        p.frameState?.kind || '',
        Math.round(Number(p.frameState?.trailLeft || 0) * 10),
        Math.round(Number(p.frameState?.trailStartX || 0)),
        Math.round(Number(p.frameState?.trailStartY || 0)),
        Math.round(Number(p.frameState?.trailEndX || 0)),
        Math.round(Number(p.frameState?.trailEndY || 0)),
        Math.round(Number(p.frameState?.veilLeft || 0) * 10),
        Math.round(Number(p.frameState?.pulseLeft || 0) * 10),
        p.frameState?.pulseKind || '',
        Math.round(Number(p.progression?.xp || 0)),
        Math.round(Number(p.progression?.nextXp || 0)),
        p.progression?.skillPoints | 0,
        Math.round(Number(p.progression?.xpPulseLeft || 0) * 10),
        p.combat?.inCombat ? 1 : 0,
        Math.round(Number(p.combat?.combatLeft || 0) * 10)
      ])
    });
  }

  function netV2SessionSignatureFromPlayers(players) {
    return JSON.stringify({
      players: (Array.isArray(players) ? players : []).map((p) => [
        p.id | 0,
        p.worldId || '',
        p.sx | 0,
        p.sy | 0,
        p.frameId || '',
        p.gameMode || '',
        p.testWorldId || '',
        p.battleSessionId || '',
        (p.sessionSetup?.pending ?? p.sessionSetupPending) ? 1 : 0,
        p.sessionSetup?.step || p.sessionSetupStep || '',
        p.sessionSetup?.authStatus || p.authStatus || '',
        p.authStatus || '',
        p.dockedStationId | 0,
        p.dockPhase || ''
      ])
    });
  }

  function netV2SessionSignature(packet) {
    return netV2SessionSignatureFromPlayers(packet?.players);
  }

  function netV2LiveSessionSignature(observer) {
    if (!observer) return '';
    const sectorKey = sectorKeyOfPlayer(observer);
    return netV2SessionSignatureFromPlayers(
      [...state.players.values()].filter((candidate) => sectorKeyOfPlayer(candidate) === sectorKey)
    );
  }

  function sendNetV2StatusSessionPackets(id, p, timeMs, sendPacket, options = {}) {
    if (!NET_V2_RESET_ENABLED || !p) return;

    const ackSeq = p.lastInputSeq | 0;
    if ((lastInputAckByPlayer.get(id) | 0) !== ackSeq) {
      const ackPacket = buildNetV2InputAckPacket(state, id, timeMs);
      if (ackPacket && sendPacket(id, ackPacket)) lastInputAckByPlayer.set(id, ackSeq);
    }

    const statusPacket = buildNetV2PlayerStatusPacket(state, id, timeMs);
    if (statusPacket) {
      const sig = netV2StatusSignature(statusPacket);
      const prevSig = lastStatusV2SignatureByPlayer.get(id) || '';
      const prevAt = lastStatusV2ByPlayer.get(id) || 0;
      const changed = sig !== prevSig;
      const minInterval = changed ? NET_V2_STATUS_ACTIVE_RATE_MS : NET_V2_STATUS_IDLE_RATE_MS;
      if (options.forceStatus || p.forceStatusV2 || timeMs - prevAt >= minInterval) {
        if (sendPacket(id, statusPacket)) {
          p.forceStatusV2 = false;
          lastStatusV2ByPlayer.set(id, timeMs);
          lastStatusV2SignatureByPlayer.set(id, sig);
        }
      }
    }

    const previousSessionAt = lastSessionV2ByPlayer.get(id) || 0;
    const heartbeatDue = NET_V2_SESSION_HEARTBEAT_MS > 0 && timeMs - previousSessionAt >= NET_V2_SESSION_HEARTBEAT_MS;
    const liveSessionSignature = netV2LiveSessionSignature(p);
    const needsSession = options.forceSession
      || p.forceSessionV2
      || !lastSessionV2SignatureByPlayer.has(id)
      || liveSessionSignature !== lastSessionV2SignatureByPlayer.get(id)
      || heartbeatDue;
    if (needsSession) {
      const sessionPacket = buildNetV2PlayerSessionPacket(state, id, timeMs);
      if (sessionPacket) {
        const sig = netV2SessionSignature(sessionPacket);
        if (sendPacket(id, sessionPacket)) {
          p.forceSessionV2 = false;
          lastSessionV2ByPlayer.set(id, timeMs);
          lastSessionV2SignatureByPlayer.set(id, sig);
        }
      }
    }
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
        const player = state.players.get(id);
        // Sector bootstrap is the ordering barrier for all incremental V2 packets.
        // This also avoids briefly applying packets from the previous sector.
        if ((lastSectorKeyByPlayer.get(id) || '') !== sectorKeyOfPlayer(player)) continue;
        syncNetV2PlayerLifecycleForObserver(id, timeMs, sendSnapshot);
        sendNetV2WorldEvents(id, player, timeMs, sendSnapshot);
        sendNetV2WorldEntitiesDelta(id, player, timeMs, sendSnapshot);
        sendNetV2LogisticsPacket(id, player, timeMs, sendSnapshot);
        sendNetV2MobPosePacket(id, player, timeMs, sendSnapshot);
        sendNetV2CargoPacket(id, player, timeMs, sendSnapshot);
        // Pose first: projectiles/network events can be bursty, but remote movement must
        // keep its cadence even when an ability/projectile is emitted.
        const packet = buildNetV2PlayerPosePacket(state, id, timeMs);
        if (packet) sendSnapshot(id, packet);
        sendNetV2NetworkEvents(id, player, timeMs, sendSnapshot);
        sendNetV2ProjectileCombatPackets(id, player, timeMs, sendSnapshot);
      }
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
        if (NET_V2_RESET_ENABLED && sectorChanged) {
          syncNetV2PlayerLifecycleForObserver(id, timeMs, sendSnapshot, { sectorChanged: true, skipEnterPackets: true });
        }
        if (NET_V2_RESET_ENABLED && !needsSectorBootstrap) sendNetV2MetaPacket(id, p, timeMs, sendSnapshot);
        if (NET_V2_RESET_ENABLED && !needsSectorBootstrap) {
          sendNetV2StatusSessionPackets(id, p, timeMs, sendSnapshot);
          continue;
        }

        const snap = NET_V2_RESET_ENABLED
          ? buildNetV2BootstrapSnapshot(state, id, timeMs, { fullUi, staticWorld, sectorBootstrap: true })
          : buildSnapshot(state, id, timeMs, { fullUi, staticWorld });
        snap.ackInputSeq = p.lastInputSeq | 0;
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
        if (sent && NET_V2_RESET_ENABLED && needsSectorBootstrap) {
          knownRemotePlayersByObserver.set(id, visibleRemoteIdSet(p));
          sendNetV2StatusSessionPackets(id, p, timeMs, sendSnapshot, { forceStatus: true, forceSession: true });
          sendNetV2CargoPacket(id, p, timeMs, sendSnapshot, { force: true });
          sendNetV2WorldEvents(id, p, timeMs, sendSnapshot);
          sendNetV2WorldEntitiesDelta(id, p, timeMs, sendSnapshot, { force: true });
          sendNetV2LogisticsPacket(id, p, timeMs, sendSnapshot, { force: true });
          sendNetV2MetaPacket(id, p, timeMs, sendSnapshot, { force: true });
        }
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


  function handleLootPickup(playerId, msg) {
    const player = state.players.get(playerId);
    if (!player) return { ok: false, error: 'missing_player' };

    const pickup = tryResolveExplicitLootPickup(state, player, msg?.lootId | 0);
    if (!pickup) return { ok: false, error: 'pickup_refused' };

    queueLootRemovedEvent(state, pickup.loot, 'pickup', player.id | 0);
    state.loots.delete(pickup.loot.id);

    player.forceStatusV2 = true;
    return { ok: true };
  }

  return {
    state,
    allocatePlayerId,
    addPlayer,
    removePlayer,
    handleInput,
    handleCommand,
    handleLootPickup,
    buildStateV2(playerId, timeMs = getSimulationTimeMs(state, nowMs())) {
      return buildNetV2StatePacket(state, playerId, timeMs);
    },
    buildBootstrapV2(playerId, timeMs = getSimulationTimeMs(state, nowMs()), options = {}) {
      return buildNetV2BootstrapSnapshot(state, playerId, timeMs, { fullUi: true, staticWorld: true, sectorBootstrap: true, ...options });
    },
    buildSessionV2(playerId, timeMs = getSimulationTimeMs(state, nowMs())) {
      return buildNetV2PlayerSessionPacket(state, playerId, timeMs);
    },
    isNetV2ResetEnabled() {
      return NET_V2_RESET_ENABLED;
    },
    start
  };
}
