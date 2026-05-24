import { rollSpawnAround } from '../util/Math.js';
import { FACTIONS } from '../constants.js';
import { createInventoryState } from '../inventory/InventoryState.js';
import { createPlayerSfxState } from '../audio/PlayerSfxState.js';
import { createStatBlock } from '../stats/StatBlockFactory.js';
import { createPlayerMapState } from '../map/PlayerMapState.js';
import { createFrameRuntime } from '../frames/FrameRuntimeFactory.js';
import { resolveFrameStats } from '../frames/FrameStatResolver.js';
import { createPlayerCoreState } from './runtime/PlayerCoreFactory.js';
import { createPlayerTargetingState } from './runtime/PlayerTargetingState.js';
import { createPlayerMotionState } from './runtime/PlayerMotionState.js';
import { createPlayerCombatState } from './runtime/PlayerCombatState.js';
import { createPlayerAbilityState } from './runtime/PlayerAbilityState.js';
import { createPlayerDockingState } from './runtime/PlayerDockingState.js';
import { createPlayerUiState } from './runtime/PlayerUiState.js';
import { createPlayerStatusState } from './runtime/PlayerStatusState.js';
import { createPlayerProgressionState } from './runtime/PlayerProgressionState.js';
import { createPlayerNetState } from './runtime/PlayerNetState.js';
import { createFrameState } from '../frames/FrameStateFactory.js';
import { syncPlayerFrameStats } from '../frames/FrameStatSync.js';
import { createEquipmentState } from '../equipment/EquipmentState.js';
import { STARTER_ITEM_IDS, STARTER_AMMO_LOADOUT } from '../../../../shared/content/items/ItemDefs.js';

export function createPlayer(id, frameId, timeMs = Date.now()) {
  const spawn = rollSpawnAround(80, 180);
  const frame = createFrameRuntime(frameId);
  const progression = createPlayerProgressionState();
  const frameStats = resolveFrameStats(frame.id, progression.level);

  const player = {
    ...createPlayerCoreState(id, spawn, frame, frameStats),
    frameName: frame.name,
    frameRole: frame.role,
    frameDifficulty: frame.difficulty,
    faction: FACTIONS.PLAYER,
    progression,
    stats: createStatBlock(frameStats),
    ...createPlayerTargetingState(),
    ...createPlayerMotionState(),
    ...createPlayerCombatState(),
    ...createPlayerAbilityState(frame),
    ...createPlayerStatusState(),
    frameState: createFrameState(frame.id),
    frameBonuses: {},
    progressionBonuses: {},
    ...createPlayerDockingState(),
    ...createPlayerUiState(timeMs),
    net: createPlayerNetState(timeMs),
    inv: createInventoryState(),
    equipment: createEquipmentState(),
    sfx: createPlayerSfxState(),
    map: createPlayerMapState(),
    bastionBuffs: [],
    bastionReturn: null,
    completedBastionIds: [],
    research: { completed: [], unlocked: [] },
    gameMode: 'endless',
    worldId: 'setup',
    battleSessionId: '',
    battleEliminated: false,
    accountKey: '',
    accountName: ''
  };

  player.equipment.ownedItemIds = [STARTER_ITEM_IDS.weapon, STARTER_ITEM_IDS.launcher];
  player.equipment.equippedItemIds = [STARTER_ITEM_IDS.weapon, STARTER_ITEM_IDS.launcher];
  player.equipment.rocketAmmoCountsById = { ...(STARTER_AMMO_LOADOUT.inventory ?? {}) };
  player.equipment.rocketAmmoSlotItemIds = [...(STARTER_AMMO_LOADOUT.slots ?? ['', ''])];
  player.equipment.activeRocketSlot = Math.max(0, Math.min(1, STARTER_AMMO_LOADOUT.activeSlot ?? 0));
  syncPlayerFrameStats(player, { restoreVitals: true, preserveRatios: false });
  return player;
}
