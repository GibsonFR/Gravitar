import { restoreStatBlockFull } from '../stats/StatBlockRuntime.js';
import { syncPlayerFrameStats } from '../frames/FrameStatSync.js';
import { visitSectorOnPlayer } from '../map/PlayerMapState.js';
import { ensureSectorLoaded } from '../sector/SectorEnsure.js';
import { SPECIAL_SECTORS } from '../sector/SpecialSectors.js';
import { PLAYER_PROGRESSION_TUNING } from '../../../../shared/content/progression/PlayerProgressionTuning.js';
import { createInventoryState } from '../inventory/InventoryState.js';
import { addResource } from '../inventory/InventorySystem.js';
import { createNeutralCraftedEquipment } from '../../../../shared/content/equipment/EquipmentRoller.js';
import { addCustomEquipmentDef } from '../equipment/PlayerEquipmentDefs.js';
import { createStructure } from '../structures/StructureFactory.js';
import { createEquipmentState } from '../equipment/EquipmentState.js';
import { STARTER_ITEM_IDS, STARTER_AMMO_LOADOUT } from '../../../../shared/content/items/ItemDefs.js';
import { createPlayerProgressionState } from '../player/runtime/PlayerProgressionState.js';
import { ensurePlayerPirateState } from '../player/runtime/PlayerPirateState.js';

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
      ironOre: 'Gisement de fer',
      copper: 'Veine de cuivre',
      aluminiumOre: 'Gisement de bauxite',
      quartz: 'Filon de quartz',
      graphite: 'Veine de graphite',
      hydrocarbons: 'Poche de pétrole'
    }[dep.key] || dep.key;
    const st = createStructure(state, 'resource_deposit', sx, sy, dep.x, dep.y, {
      ownerId: player.id | 0,
      ownerKey: 'test',
      ownerName: 'Gisement test',
      worldId,
      depositResourceKey: dep.key,
      depositRemaining: -1,
      depositMax: -1,
      depositLabel: defName,
      createdAt: timeMs,
      updatedAt: timeMs
    });
    if (!st) continue;
    st.name = defName;
    state.structures.set(st.id, st);
  }
}

function ensureTestStructure(state, worldId, type, sx, sy, x, y, options = {}) {
  const exists = [...(state.structures?.values?.() || [])].find((st) => String(st.worldId || '') === worldId && st.type === type && (st.sx | 0) === (sx | 0) && (st.sy | 0) === (sy | 0) && Math.abs(Number(st.x || 0) - x) < 4 && Math.abs(Number(st.y || 0) - y) < 4);
  if (exists) {
    if (options.ownerKey || (options.ownerId | 0)) {
      exists.ownerId = options.ownerId | 0;
      exists.ownerKey = options.ownerKey || exists.ownerKey || '';
      exists.ownerName = options.ownerName || exists.ownerName || '';
      exists.updatedAt = options.timeMs || Date.now();
    }
    return exists;
  }
  const st = createStructure(state, type, sx | 0, sy | 0, x, y, {
    ownerId: options.ownerId | 0 || 0,
    ownerKey: options.ownerKey || 'test',
    ownerName: options.ownerName || 'Test',
    worldId,
    createdAt: options.timeMs || Date.now(),
    updatedAt: options.timeMs || Date.now()
  });
  if (!st) return null;
  st.powered = true;
  st.ownerId = options.ownerId | 0 || st.ownerId | 0;
  st.ownerKey = options.ownerKey || st.ownerKey || 'test';
  st.ownerName = options.ownerName || st.ownerName || 'Test';
  state.structures.set(st.id, st);
  return st;
}


function seedTestEquipmentItems(player, timeMs = Date.now()) {
  if (!player?.equipment) return;
  player.equipment.customItemDefs ??= {};
  player.equipment.ownedItemIds = Array.isArray(player.equipment.ownedItemIds) ? player.equipment.ownedItemIds : [];
  const specs = [
    ['vector-thruster-vanes', 'Propulseur Mark III', 3],
    ['needle-array-mk1', 'Arme cinétique Mark III', 3],
    ['siege-barrage-rack', 'Lance-roquettes Mark III', 3],
    ['compact-shield-array', 'Bouclier Mark III', 3],
    ['cargo-overmesh', 'Module soute Mark III', 3],
    ['reaver-gyro-stabilizer', 'Module dégâts Mark III', 3],
    ['surge-capacitor-bank', 'Module énergie Mark III', 3],
    ['siphon-repair-weave', 'Module réparation Mark III', 3],
    ['siege-target-matrix', 'Module ciblage Mark III', 3],
    ['vector-thruster-vanes', 'Propulseur Mark V', 5],
    ['needle-array-mk1', 'Arme cinétique Mark V', 5],
    ['scatterstorm-pod', 'Lance-roquettes Mark V', 5],
    ['compact-shield-array', 'Bouclier Mark V', 5]
  ];
  player.equipment.craftedItemCounter = Math.max(0, player.equipment.craftedItemCounter | 0);
  for (let i = 0; i < specs.length; i += 1) {
    const [baseItemId, name, mark] = specs[i];
    const stableId = `test-neutral-${baseItemId.replace(/[^a-z0-9]+/g, '-')}-mk${mark}`;
    const crafted = createNeutralCraftedEquipment({
      baseItemId,
      recipeId: stableId,
      recipeName: name,
      mark,
      ownerKey: player.accountKey || player.pseudo || player.id || 'test',
      craftedIndex: 9000 + i,
      timeMs: 100000 + i
    });
    if (!crafted) continue;
    crafted.id = stableId;
    crafted.name = name;
    crafted.shortName = name;
    addCustomEquipmentDef(player, crafted);
    if (!player.equipment.ownedItemIds.includes(stableId)) player.equipment.ownedItemIds.push(stableId);
  }
  player.equipment.ownedItemIds = [...new Set(player.equipment.ownedItemIds)].sort();
  player.equipment.lastChangedAt = timeMs | 0;
}


function equipTestCraftedLoadout(player, timeMs) {
  if (!player?.equipment) return;
  seedTestEquipmentItems(player, timeMs);
  const wanted = [
    'test-neutral-vector-thruster-vanes-mk3',
    'test-neutral-needle-array-mk1-mk3',
    'test-neutral-siege-barrage-rack-mk3',
    'test-neutral-compact-shield-array-mk3',
    'test-neutral-cargo-overmesh-mk3',
    'test-neutral-reaver-gyro-stabilizer-mk3',
    'test-neutral-surge-capacitor-bank-mk3'
  ];
  player.equipment.equippedItemIds = wanted.filter((id) => player.equipment.customItemDefs?.[id]);
  player.equipment.ownedItemIds = [...new Set([
    ...(player.equipment.ownedItemIds || []).filter((id) => id !== STARTER_ITEM_IDS.weapon && id !== STARTER_ITEM_IDS.launcher),
    ...wanted
  ])].sort();
  player.equipment.lastChangedAt = timeMs | 0;
}

export function ensureTestEquipmentBench(state, player, timeMs) {
  if (!state?.structures || !player) return;
  const worldId = String(player.worldId || '');
  const sx = SPECIAL_SECTORS.TEST_EQUIPMENT.sx | 0;
  const sy = SPECIAL_SECTORS.TEST_EQUIPMENT.sy | 0;
  if ((player.sx | 0) !== sx || (player.sy | 0) !== sy) return;
  const owner = { ownerId: player.id | 0, ownerKey: player.accountKey || 'test', ownerName: player.pseudo || 'Test', timeMs };
  const core = ensureTestStructure(state, worldId, 'base_core', sx, sy, -384, 0, owner);
  if (core) {
    core.claimRadius = Math.max(core.claimRadius || 0, 1400);
    core.energy = Math.max(core.energy || 0, 2000);
  }
  ensureTestStructure(state, worldId, 'solar_panel', sx, sy, -192, -160, owner);
  ensureTestStructure(state, worldId, 'solar_panel', sx, sy, -64, -160, owner);
  ensureTestStructure(state, worldId, 'fuel_generator', sx, sy, 80, -160, owner);
  ensureTestStructure(state, worldId, 'science_lab', sx, sy, -96, 96, owner);
  const station = ensureTestStructure(state, worldId, 'research_station', sx, sy, 128, 96, owner);
  if (station) {
    station.scienceInput = {
      basicSciencePack: 30,
      automationSciencePack: 20,
      industrialSciencePack: 20,
      energySciencePack: 20,
      biologySciencePack: 16,
      combatSciencePack: 16,
      advancedSciencePack: 16,
      anomalySciencePack: 10
    };
    station.researchEnabled = true;
  }
  ensureTestStructure(state, worldId, 'equipment_fabricator', sx, sy, 320, 96, owner);
  ensureTestStructure(state, worldId, 'equipment_rd_station', sx, sy, 576, 96, owner);
  const equipmentChest = ensureTestStructure(state, worldId, 'equipment_storage', sx, sy, 640, 96, owner);
  if (equipmentChest) {
    equipmentChest.storage ??= { kind: 'equipment', items: [] };
    equipmentChest.storage.kind = 'equipment';
    const starterEquipmentItems = [
      'test-neutral-vector-thruster-vanes-mk5',
      'test-neutral-needle-array-mk1-mk5',
      'test-neutral-scatterstorm-pod-mk5',
      'test-neutral-compact-shield-array-mk5',
      'test-neutral-cargo-overmesh-mk3',
      'test-neutral-reaver-gyro-stabilizer-mk3',
      'test-neutral-surge-capacitor-bank-mk3',
      'test-neutral-siphon-repair-weave-mk3',
      'test-neutral-siege-target-matrix-mk3'
    ];
    equipmentChest.storage.customItemDefs ??= {};
    for (const itemId of starterEquipmentItems) {
      const def = player.equipment?.customItemDefs?.[itemId];
      if (def) equipmentChest.storage.customItemDefs[itemId] = JSON.parse(JSON.stringify(def));
    }
    equipmentChest.storage.items = [...new Set([...(equipmentChest.storage.items || []), ...starterEquipmentItems])];
  }
  ensureTestStructure(state, worldId, 'storage', sx, sy, 640, -96, owner);
}



export function ensureTestIndustrialConverterBench(state, player, timeMs) {
  if (!state?.structures || !player) return;
  const worldId = String(player.worldId || '');
  const sx = SPECIAL_SECTORS.TEST_INDUSTRIAL_CONVERTER.sx | 0;
  const sy = SPECIAL_SECTORS.TEST_INDUSTRIAL_CONVERTER.sy | 0;
  if ((player.sx | 0) !== sx || (player.sy | 0) !== sy) return;
  const owner = { ownerId: player.id | 0, ownerKey: player.accountKey || 'test', ownerName: player.pseudo || 'Test', timeMs };
  const core = ensureTestStructure(state, worldId, 'base_core', sx, sy, -448, 0, owner);
  if (core) {
    core.claimRadius = Math.max(core.claimRadius || 0, 1600);
    core.energyState = { production: 240, consumption: 0, surplus: 240 };
  }
  ensureTestStructure(state, worldId, 'solar_panel', sx, sy, -256, -192, owner);
  ensureTestStructure(state, worldId, 'solar_panel', sx, sy, -128, -192, owner);
  ensureTestStructure(state, worldId, 'fuel_generator', sx, sy, 64, -192, owner);
  const converter = ensureTestStructure(state, worldId, 'industrial_converter', sx, sy, 64, 96, owner);
  if (converter) {
    converter.machineRecipeId = converter.machineRecipeId || 'conv_iron_to_copper_basic';
    converter.machineEnabled = true;
    converter.machineInput = { ironOre: 64, scrap: 48, graphite: 40, ironIngot: 24, copperIngot: 24, aluminiumOre: 40, quartz: 12, unknownTechFragment: 4, titaniumPlate: 12, thermalCeramic: 8 };
    converter.machineOutput ||= {};
    converter.powered = true;
    converter.updatedAt = timeMs;
  }
  const storage = ensureTestStructure(state, worldId, 'storage', sx, sy, 352, 96, owner);
  if (storage) {
    storage.storage ??= { kind: 'resources', resources: {}, capacity: 420 };
    storage.storage.kind = 'resources';
    storage.storage.capacity = Math.max(storage.storage.capacity || 0, 420);
    storage.storage.resources = { ironOre: 120, scrap: 120, graphite: 80, copperIngot: 40, aluminiumOre: 80, quartz: 40, unknownTechFragment: 8, titaniumPlate: 20, thermalCeramic: 12 };
  }
  const pirate = ensurePlayerPirateState(player);
  const unlocked = new Set([...(pirate.unlockedConversionRecipeIds || []), 'conv_iron_to_copper_basic', 'conv_scrap_to_iron_basic', 'conv_graphite_to_carbon_basic']);
  pirate.unlockedConversionRecipeIds = [...unlocked].sort();
}



export function ensureTestLogisticDronesBench(state, player, timeMs) {
  if (!state?.structures || !player) return;
  const worldId = String(player.worldId || '');
  const sx = SPECIAL_SECTORS.TEST_LOGISTIC_DRONES.sx | 0;
  const sy = SPECIAL_SECTORS.TEST_LOGISTIC_DRONES.sy | 0;
  if ((player.sx | 0) !== sx || (player.sy | 0) !== sy) return;
  const owner = { ownerId: player.id | 0, ownerKey: player.accountKey || 'test', ownerName: player.pseudo || 'Test', timeMs };
  const core = ensureTestStructure(state, worldId, 'base_core', sx, sy, -512, 0, owner);
  if (core) core.claimRadius = Math.max(core.claimRadius || 0, 1600);
  ensureTestStructure(state, worldId, 'solar_panel', sx, sy, -320, -192, owner);
  ensureTestStructure(state, worldId, 'solar_panel', sx, sy, -192, -192, owner);
  ensureTestStructure(state, worldId, 'fuel_generator', sx, sy, -64, -192, owner);
  const station = ensureTestStructure(state, worldId, 'logistic_drone_station', sx, sy, 96, 96, owner);
  if (station) {
    station.storage ??= { kind: 'resources', resources: {}, capacity: 80 };
    station.storage.kind = 'resources';
    station.storage.capacity = Math.max(station.storage.capacity || 0, 80);
    station.storage.resources ??= {};
    station.storage.resources.logisticDroneBasic = Math.max(station.storage.resources.logisticDroneBasic | 0, 3);
    station.powered = true;
  }
  const workshop = ensureTestStructure(state, worldId, 'logistic_drone_workshop', sx, sy, 352, 96, owner);
  if (workshop) {
    workshop.machineRecipeId = workshop.machineRecipeId || 'logistic_drone_basic';
    workshop.machineEnabled = true;
    workshop.machineInput = { steelPlate: 18, copperWire: 24, controlCircuit: 6, lithiumBattery: 6, servomotor: 6 };
    workshop.machineOutput ||= {};
    workshop.powered = true;
    workshop.updatedAt = timeMs;
  }
  const storage = ensureTestStructure(state, worldId, 'storage', sx, sy, 608, 96, owner);
  if (storage) {
    storage.storage ??= { kind: 'resources', resources: {}, capacity: 720 };
    storage.storage.kind = 'resources';
    storage.storage.capacity = Math.max(storage.storage.capacity || 0, 720);
    storage.storage.resources = {
      steelPlate: 80,
      copperWire: 120,
      controlCircuit: 24,
      lithiumBattery: 24,
      servomotor: 24,
      logisticDroneBasic: 4
    };
  }
  const provider = ensureTestStructure(state, worldId, 'logistic_chest_provider', sx, sy, 96, 352, owner);
  if (provider) {
    provider.storage ??= { kind: 'resources', resources: {}, capacity: 140 };
    provider.storage.kind = 'resources';
    provider.storage.capacity = Math.max(provider.storage.capacity || 0, 140);
    provider.storage.resources = { copper: 60, ironOre: 80 };
  }
  const requester = ensureTestStructure(state, worldId, 'logistic_chest_requester', sx, sy, 256, 352, owner);
  if (requester) {
    requester.storage ??= { kind: 'resources', resources: {}, capacity: 140 };
    requester.storage.kind = 'resources';
    requester.storage.capacity = Math.max(requester.storage.capacity || 0, 140);
    requester.logisticRequests = { copper: Math.max(requester.logisticRequests?.copper | 0, 40), ironOre: Math.max(requester.logisticRequests?.ironOre | 0, 40) };
  }
  ensureTestStructure(state, worldId, 'logistic_chest_buffer', sx, sy, 416, 352, owner);

  const remoteSx = sx + 1;
  const remoteSy = sy;
  const remoteOwner = owner;
  const remoteCore = ensureTestStructure(state, worldId, 'outpost_core', remoteSx, remoteSy, -384, 0, remoteOwner);
  if (remoteCore) remoteCore.claimRadius = Math.max(remoteCore.claimRadius || 0, 640);
  ensureTestStructure(state, worldId, 'solar_panel', remoteSx, remoteSy, -192, -128, remoteOwner);
  ensureTestStructure(state, worldId, 'solar_panel', remoteSx, remoteSy, -64, -128, remoteOwner);
  const remoteStation = ensureTestStructure(state, worldId, 'logistic_drone_station', remoteSx, remoteSy, 96, 64, remoteOwner);
  if (remoteStation) {
    remoteStation.storage ??= { kind: 'resources', resources: {}, capacity: 80 };
    remoteStation.storage.kind = 'resources';
    remoteStation.storage.capacity = Math.max(remoteStation.storage.capacity || 0, 80);
    remoteStation.storage.resources ??= {};
    remoteStation.storage.resources.logisticDroneBasic = Math.max(remoteStation.storage.resources.logisticDroneBasic | 0, 1);
    remoteStation.powered = true;
  }
  const remoteProvider = ensureTestStructure(state, worldId, 'logistic_chest_provider', remoteSx, remoteSy, 288, 64, remoteOwner);
  if (remoteProvider) {
    remoteProvider.storage ??= { kind: 'resources', resources: {}, capacity: 160 };
    remoteProvider.storage.kind = 'resources';
    remoteProvider.storage.capacity = Math.max(remoteProvider.storage.capacity || 0, 160);
    remoteProvider.storage.resources = { copper: 90, ironOre: 90, lithiumOre: 35 };
  }
  const remoteRequester = ensureTestStructure(state, worldId, 'logistic_chest_requester', remoteSx, remoteSy, 480, 64, remoteOwner);
  if (remoteRequester) {
    remoteRequester.storage ??= { kind: 'resources', resources: {}, capacity: 160 };
    remoteRequester.storage.kind = 'resources';
    remoteRequester.storage.capacity = Math.max(remoteRequester.storage.capacity || 0, 160);
    remoteRequester.logisticRequests = {
      copper: Math.max(remoteRequester.logisticRequests?.copper | 0, 55),
      ironOre: Math.max(remoteRequester.logisticRequests?.ironOre | 0, 55),
      lithiumOre: Math.max(remoteRequester.logisticRequests?.lithiumOre | 0, 25)
    };
  }
}

export function ensureTestRocketWorkshopBench(state, player, timeMs) {
  if (!state?.structures || !player) return;
  const worldId = String(player.worldId || '');
  const sx = SPECIAL_SECTORS.TEST_ROCKET_WORKSHOP.sx | 0;
  const sy = SPECIAL_SECTORS.TEST_ROCKET_WORKSHOP.sy | 0;
  if ((player.sx | 0) !== sx || (player.sy | 0) !== sy) return;
  const owner = { ownerId: player.id | 0, ownerKey: player.accountKey || 'test', ownerName: player.pseudo || 'Test', timeMs };
  const core = ensureTestStructure(state, worldId, 'base_core', sx, sy, -448, 0, owner);
  if (core) core.claimRadius = Math.max(core.claimRadius || 0, 1600);
  ensureTestStructure(state, worldId, 'solar_panel', sx, sy, -256, -192, owner);
  ensureTestStructure(state, worldId, 'solar_panel', sx, sy, -128, -192, owner);
  const gen = ensureTestStructure(state, worldId, 'fuel_generator', sx, sy, 64, -192, owner);
  if (gen) {
    gen.storage ??= { kind: 'fuel', resources: {}, capacity: 80 };
    gen.storage.kind = 'fuel';
    gen.storage.resources ??= {};
    gen.storage.resources.refinedFuel = Math.max(gen.storage.resources.refinedFuel | 0, 20);
  }
  const workshop = ensureTestStructure(state, worldId, 'rocket_workshop', sx, sy, 64, 96, owner);
  if (workshop) {
    workshop.rocketWorkshopEnabled = true;
    workshop.rocketWorkshopInput = { steelPlate: 30, propellant: 24, controlCircuit: 8 };
    workshop.rocketWorkshopOutput ||= {};
    workshop.updatedAt = timeMs;
  }
  const storage = ensureTestStructure(state, worldId, 'storage', sx, sy, 352, 96, owner);
  if (storage) {
    storage.storage ??= { kind: 'resources', resources: {}, capacity: 420 };
    storage.storage.kind = 'resources';
    storage.storage.capacity = Math.max(storage.storage.capacity || 0, 420);
    storage.storage.resources = { steelPlate: 80, propellant: 80, controlCircuit: 20, ironOre: 120, graphite: 80, copperWire: 80 };
  }
}

export function ensureTestRocketMixerBench(state, player, timeMs) {
  if (!state?.structures || !player) return;
  const worldId = String(player.worldId || '');
  const sx = SPECIAL_SECTORS.TEST_ROCKET_MIXER.sx | 0;
  const sy = SPECIAL_SECTORS.TEST_ROCKET_MIXER.sy | 0;
  if ((player.sx | 0) !== sx || (player.sy | 0) !== sy) return;
  const owner = { ownerId: player.id | 0, ownerKey: player.accountKey || 'test', ownerName: player.pseudo || 'Test', timeMs };
  const core = ensureTestStructure(state, worldId, 'base_core', sx, sy, -448, 0, owner);
  if (core) core.claimRadius = Math.max(core.claimRadius || 0, 1600);
  ensureTestStructure(state, worldId, 'solar_panel', sx, sy, -256, -192, owner);
  ensureTestStructure(state, worldId, 'solar_panel', sx, sy, -128, -192, owner);
  const gen = ensureTestStructure(state, worldId, 'fuel_generator', sx, sy, 64, -192, owner);
  if (gen) {
    gen.storage ??= { kind: 'fuel', resources: {}, capacity: 80 };
    gen.storage.kind = 'fuel';
    gen.storage.resources ??= {};
    gen.storage.resources.refinedFuel = Math.max(gen.storage.resources.refinedFuel | 0, 30);
  }
  const workshop = ensureTestStructure(state, worldId, 'rocket_workshop', sx, sy, 64, 96, owner);
  if (workshop) {
    workshop.rocketWorkshopEnabled = true;
    workshop.rocketWorkshopInput = { steelPlate: 12, propellant: 10, controlCircuit: 4, aluminiumIngot: 3, refinedFuel: 2, graphite: 2, thermalCeramic: 1 };
    workshop.rocketWorkshopOutput ||= {};
    workshop.updatedAt = timeMs;
  }
  const storage = ensureTestStructure(state, worldId, 'storage', sx, sy, 352, 96, owner);
  if (storage) {
    storage.storage ??= { kind: 'resources', resources: {}, capacity: 620 };
    storage.storage.kind = 'resources';
    storage.storage.capacity = Math.max(storage.storage.capacity || 0, 620);
    storage.storage.resources = {
      steelPlate: 140, propellant: 140, controlCircuit: 36,
      biofuel: 30, waterIce: 30, ammoniaIce: 30,
      lithiumBattery: 16, copperWire: 80, graphite: 40,
      sulfur: 30, titaniumPlate: 16, aluminiumIngot: 42,
      carbonFiber: 18, compositeArmor: 8, microprocessor: 12,
      servomotor: 16, thermalCeramic: 18, opticalGlass: 18,
      laserLens: 10, unknownTechFragment: 8
    };
  }
}



export function ensureTestFactorioLogisticsBench(state, player, timeMs) {
  if (!state?.structures || !player) return;
  const worldId = String(player.worldId || '');
  const sx = SPECIAL_SECTORS.TEST_FACTORIO_LOGISTICS.sx | 0;
  const sy = SPECIAL_SECTORS.TEST_FACTORIO_LOGISTICS.sy | 0;
  if ((player.sx | 0) !== sx || (player.sy | 0) !== sy) return;

  const owner = {
    ownerId: player.id | 0,
    ownerKey: player.accountKey || 'test',
    ownerName: player.pseudo || 'Test',
    timeMs
  };

  const core = ensureTestStructure(state, worldId, 'base_core', sx, sy, 0, 0, owner);
  if (core) {
    core.claimRadius = Math.max(core.claimRadius || 0, 1800);
    core.powered = true;
    core.updatedAt = timeMs;
  }

  const chest = (x, y, resources = {}) => {
    const st = ensureTestStructure(state, worldId, 'storage', sx, sy, x, y, owner);
    if (!st) return null;
    st.storage ??= { kind: 'resources', resources: {}, capacity: 240 };
    st.storage.kind = 'resources';
    st.storage.capacity = Math.max(st.storage.capacity || 0, 240);
    for (const [key, amount] of Object.entries(resources || {})) {
      st.storage.resources[key] = Math.max(st.storage.resources[key] | 0, amount | 0);
    }
    st.powered = true;
    st.updatedAt = timeMs;
    return st;
  };

  const belt = (type, x, y, orientation = 'r', resources = {}) => {
    const st = ensureTestStructure(state, worldId, type, sx, sy, x, y, { ...owner, orientation });
    if (!st) return null;
    st.orientation = orientation;
    st.storage ??= { kind: 'conveyor', resources: {}, capacity: 1 };
    st.storage.kind = 'conveyor';
    st.storage.capacity = Math.max(st.storage.capacity || 0, 1);
    for (const [key, amount] of Object.entries(resources || {})) {
      st.storage.resources[key] = Math.max(st.storage.resources[key] | 0, amount | 0);
    }
    st.powered = true;
    st.updatedAt = timeMs;
    return st;
  };

  const arm = (type, x, y, orientation = 'r') => {
    const st = ensureTestStructure(state, worldId, type, sx, sy, x, y, { ...owner, orientation });
    if (!st) return null;
    st.orientation = orientation;
    st.powered = true;
    st.updatedAt = timeMs;
    return st;
  };

  chest(-448, -192, { ironOre: 80, copper: 40 });
  arm('robot_arm', -384, -192, 'r');
  belt('conveyor', -320, -192, 'r');
  belt('conveyor', -256, -192, 'r');
  belt('fast_conveyor', -192, -192, 'r');
  belt('splitter', -128, -192, 'r');
  belt('fast_conveyor', -64, -224, 'r');
  belt('fast_conveyor', 0, -224, 'r');
  arm('fast_arm', 64, -224, 'r');
  chest(128, -224, {});
  belt('conveyor', -64, -160, 'r');
  belt('conveyor', 0, -160, 'r');
  arm('robot_arm', 64, -160, 'r');
  chest(128, -160, {});

  chest(-448, 64, { silicon: 40 });
  chest(-448, 192, { quartz: 40 });
  arm('robot_arm', -384, 64, 'r');
  arm('robot_arm', -384, 192, 'r');
  belt('conveyor', -320, 64, 'r');
  belt('conveyor', -320, 192, 'r');
  belt('merger', -256, 128, 'r');
  belt('fast_conveyor', -192, 128, 'r');
  belt('fast_conveyor', -128, 128, 'r');
  arm('fast_arm', -64, 128, 'r');
  chest(0, 128, {});

  chest(-448, 384, { ironIngot: 40 });
  arm('long_arm', -320, 384, 'r');
  belt('conveyor', -192, 384, 'r');
  belt('conveyor', -128, 384, 'r');
  arm('long_arm', 0, 384, 'r');
  chest(128, 384, {});

  belt('conveyor', -448, -448, 'r', { ironOre: 1 });
  player.forceFullUiSnapshot = true;
}


export function ensureTestTurretsBench(state, player, timeMs) {
  if (!state?.structures || !player) return;
  const worldId = String(player.worldId || '');
  const sx = SPECIAL_SECTORS.TEST_TURRETS.sx | 0;
  const sy = SPECIAL_SECTORS.TEST_TURRETS.sy | 0;
  if ((player.sx | 0) !== sx || (player.sy | 0) !== sy) return;
  const owner = { ownerId: player.id | 0, ownerKey: player.accountKey || 'test', ownerName: player.pseudo || 'Test', timeMs };
  const core = ensureTestStructure(state, worldId, 'base_core', sx, sy, -640, 0, owner);
  if (core) core.claimRadius = Math.max(core.claimRadius || 0, 960);
  ensureTestStructure(state, worldId, 'solar_panel', sx, sy, -832, -192, owner);
  ensureTestStructure(state, worldId, 'solar_panel', sx, sy, -704, -192, owner);
  ensureTestStructure(state, worldId, 'solar_panel', sx, sy, -576, -192, owner);
  const turret = ensureTestStructure(state, worldId, 'defense_turret', sx, sy, -320, 0, owner);
  if (turret) {
    turret.storage ??= { kind: 'ammo', ammo: {}, ammoCapacity: 80 };
    turret.storage.kind = 'ammo';
    turret.storage.ammo ??= {};
    turret.storage.ammo['basic-he-rocket-pack'] = Math.max(turret.storage.ammo['basic-he-rocket-pack'] | 0, 40);
    turret.turretEnabled = true;
    turret.turretMode = 'auto';
    turret.updatedAt = timeMs;
  }
  const ammo = ensureTestStructure(state, worldId, 'ammo_storage', sx, sy, -128, 0, owner);
  if (ammo) {
    ammo.storage ??= { kind: 'ammo', ammo: {}, ammoCapacity: 260 };
    ammo.storage.kind = 'ammo';
    ammo.storage.ammo ??= {};
    ammo.storage.ammo['basic-he-rocket-pack'] = Math.max(ammo.storage.ammo['basic-he-rocket-pack'] | 0, 120);
  }

  const enemyOwner = { ownerId: 0, ownerKey: 'test-enemy-turret', ownerName: 'Tourelle ennemie', timeMs };
  const enemyCore = ensureTestStructure(state, worldId, 'base_core', sx, sy, 720, 0, enemyOwner);
  if (enemyCore) enemyCore.claimRadius = Math.max(enemyCore.claimRadius || 0, 760);
  ensureTestStructure(state, worldId, 'solar_panel', sx, sy, 528, -192, enemyOwner);
  ensureTestStructure(state, worldId, 'solar_panel', sx, sy, 656, -192, enemyOwner);
  ensureTestStructure(state, worldId, 'solar_panel', sx, sy, 784, -192, enemyOwner);
  const enemyTurret = ensureTestStructure(state, worldId, 'defense_turret', sx, sy, 448, 0, enemyOwner);
  if (enemyTurret) {
    enemyTurret.storage ??= { kind: 'ammo', ammo: {}, ammoCapacity: 80 };
    enemyTurret.storage.kind = 'ammo';
    enemyTurret.storage.ammo ??= {};
    enemyTurret.storage.ammo['basic-he-rocket-pack'] = Math.max(enemyTurret.storage.ammo['basic-he-rocket-pack'] | 0, 40);
    enemyTurret.turretEnabled = true;
    enemyTurret.turretMode = 'auto';
    enemyTurret.updatedAt = timeMs;
  }
}

function grantTestResources(player) {
  if (!player?.inv) return;
  player.inv.cargoMax = Math.max(player.inv.cargoMax || 0, 1400);
  const pack = {
    ironOre: 48, copper: 48, aluminiumOre: 32, titaniumOre: 24, quartz: 32, graphite: 24,
    silicon: 32, hydrocarbons: 28, biomass: 24, organicLipids: 16, waterIce: 24, methane: 20, ammonia: 20,
    refinedFuel: 20, biofuel: 12, propellant: 40,
    ironIngot: 30, copperIngot: 20, aluminiumIngot: 20, copperWire: 40, steelPlate: 24,
    siliconWafer: 18, microTransistor: 10, printedCircuit: 8, controlCircuit: 4,
    titaniumPlate: 10, carbonFiber: 8, opticalGlass: 8, lithiumBattery: 4, fuelCell: 4,
    basicSciencePack: 20, automationSciencePack: 10, industrialSciencePack: 10, energySciencePack: 12,
    biologySciencePack: 10, combatSciencePack: 10, advancedSciencePack: 30, anomalySciencePack: 18,
    precursorNanomaterial: 12, unknownTechFragment: 10, titaniumPlate: 36, ancientSuperconductor: 4,
    electricMotor: 12, compositeArmor: 8, laserLens: 8, microprocessor: 12, thermalCeramic: 6,
    fuelInjector: 4, hydrogen: 20, biocarbure: 12, lithiumBattery: 8, fuelCell: 8
  };
  for (const [key, amount] of Object.entries(pack)) addResource(player.inv, key, amount);
  seedTestEquipmentItems(player, Date.now());
}

function resetNonPersistentModeLoadout(player, options = {}) {
  if (!player) return;
  player.inv = createInventoryState();
  player.equipment = createEquipmentState();
  player.equipment.ownedItemIds = [STARTER_ITEM_IDS.weapon, STARTER_ITEM_IDS.launcher];
  player.equipment.equippedItemIds = [STARTER_ITEM_IDS.weapon, STARTER_ITEM_IDS.launcher];
  player.equipment.rocketAmmoCountsById = { ...(STARTER_AMMO_LOADOUT.inventory ?? {}) };
  player.equipment.rocketAmmoSlotItemIds = [...(STARTER_AMMO_LOADOUT.slots ?? ['', ''])];
  player.equipment.activeRocketSlot = Math.max(0, Math.min(1, STARTER_AMMO_LOADOUT.activeSlot ?? 0));
  player.completedBastionIds = [];
  player.bastionBuffs = [];
  player.bastionReturn = null;
  player.bastionRunKey = '';
  player.frameBonuses = {};
  if (options.resetProgression) player.progression = createPlayerProgressionState();
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


export function setPlayerTestWorld(state, player, timeMs, testWorldId = 'test-hub') {
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
  resetNonPersistentModeLoadout(player, { resetProgression: false });
  player.dockedStationId = 0;
  player.dockPhase = 'none';
  player.dockStationId = 0;
  player.dockProg01 = 0;
  player.dockTimer = 0;
  if (player.inv) player.inv.credits = Math.max(player.inv.credits || 0, def.credits | 0 || 0);
  grantTestResources(player);
  equipTestCraftedLoadout(player, timeMs);
  ensureTestMiningDeposits(state, player, timeMs);
  ensureTestEquipmentBench(state, player, timeMs);
  ensureTestIndustrialConverterBench(state, player, timeMs);
  ensureTestRocketWorkshopBench(state, player, timeMs);
  ensureTestTurretsBench(state, player, timeMs);
  ensureTestFactorioLogisticsBench(state, player, timeMs);
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
  ensureSectorLoaded(state, SPECIAL_SECTORS.TEST_MINING.sx | 0, SPECIAL_SECTORS.TEST_MINING.sy | 0, timeMs);
  ensureSectorLoaded(state, SPECIAL_SECTORS.TEST_EQUIPMENT.sx | 0, SPECIAL_SECTORS.TEST_EQUIPMENT.sy | 0, timeMs);
  ensureSectorLoaded(state, SPECIAL_SECTORS.TEST_TURRETS.sx | 0, SPECIAL_SECTORS.TEST_TURRETS.sy | 0, timeMs);
  visitSectorOnPlayer(state, player, player.sx | 0, player.sy | 0, timeMs);
  player.uiHint = def.hint || 'Monde de test';
  player.uiHintTimer = 3.0;
}

export function setPlayerTestServer(state, player, timeMs) {
  setPlayerTestWorld(state, player, timeMs, 'test-hub');
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
