import { handleSell } from './SellCommand.js';
import { handleSellAll } from './SellAllCommand.js';
import { handleUndock } from './UndockCommand.js';
import { handleJettison } from './JettisonCommand.js';
import { handleSetFrame } from './SetFrameCommand.js';
import { handleUpgradeAbility } from './UpgradeAbilityCommand.js';
import { handleBuyItem } from './BuyItemCommand.js';
import { handleBuyAndAssignRocketAmmo } from './BuyAndAssignRocketAmmoCommand.js';
import { handleEquipItem } from './EquipItemCommand.js';
import { handleEquipItemToSlot } from './EquipItemToSlotCommand.js';
import { handleUnequipItem } from './UnequipItemCommand.js';
import { handleSellItem } from './SellItemCommand.js';
import { handleAssignRocketAmmo } from './AssignRocketAmmoCommand.js';
import { handleUnassignRocketAmmo } from './UnassignRocketAmmoCommand.js';
import { handleSwitchRocketSlot } from './SwitchRocketSlotCommand.js';
import { handleToggleConverter } from './ToggleConverterCommand.js';
import { handleCommitSessionSetup } from './CommitSessionSetupCommand.js';
import { handleQuitSession } from './QuitSessionCommand.js';
import { handleCancelBattleQueue } from './CancelBattleQueueCommand.js';
import { handleAuthSessionAccount } from './AuthSessionCommand.js';
import { handleBuildStructure } from './BuildStructureCommand.js';
import { handleRemoveStructure } from './RemoveStructureCommand.js';
import { handleRepairStructure } from './RepairStructureCommand.js';
import { handleStorageTransfer } from './StorageTransferCommand.js';
import { handleStorageOpen } from './StorageOpenCommand.js';
import { handleStorageClose } from './StorageCloseCommand.js';
import { handleToggleStructure } from './ToggleStructureCommand.js';
import { handleMachineOpen } from './MachineOpenCommand.js';
import { handleMachineClose } from './MachineCloseCommand.js';
import { handleMachineProcess } from './MachineProcessCommand.js';
import { handleMachineSelectRecipe } from './MachineSelectRecipeCommand.js';
import { handleMachineTransfer } from './MachineTransferCommand.js';
import { handleMachineToggle } from './MachineToggleCommand.js';
import { handleResearchStationOpen } from './ResearchStationOpenCommand.js';
import { handleResearchStationClose } from './ResearchStationCloseCommand.js';
import { handleResearchStationTransfer } from './ResearchStationTransferCommand.js';
import { handleResearchStationStart } from './ResearchStationStartCommand.js';
import { handleResearchStationToggle } from './ResearchStationToggleCommand.js';
import { handleResearchTreeStart } from './ResearchTreeStartCommand.js';
import { handleResearchTreeCancel } from './ResearchTreeCancelCommand.js';
import { canAcceptCommand, sanitizeCommandMessage } from '../../net/protocol/CommandMessage.js';

const HANDLERS = {
  sell: handleSell,
  sell_all: handleSellAll,
  undock: handleUndock,
  jettison: handleJettison,
  set_frame: handleSetFrame,
  upgrade_ability: handleUpgradeAbility,
  buy_item: handleBuyItem,
  buy_and_assign_rocket_ammo: handleBuyAndAssignRocketAmmo,
  equip_item: handleEquipItem,
  equip_item_to_slot: handleEquipItemToSlot,
  unequip_item: handleUnequipItem,
  sell_item: handleSellItem,
  assign_rocket_ammo: handleAssignRocketAmmo,
  unassign_rocket_ammo: handleUnassignRocketAmmo,
  switch_rocket_slot: handleSwitchRocketSlot,
  toggle_converter: handleToggleConverter,
  commit_session_setup: handleCommitSessionSetup,
  quit_session: handleQuitSession,
  cancel_battle_queue: handleCancelBattleQueue,
  auth_session_account: handleAuthSessionAccount,
  build_structure: handleBuildStructure,
  remove_structure: handleRemoveStructure,
  repair_structure: handleRepairStructure,
  storage_transfer: handleStorageTransfer,
  storage_open: handleStorageOpen,
  storage_close: handleStorageClose,
  toggle_structure: handleToggleStructure,
  machine_open: handleMachineOpen,
  machine_close: handleMachineClose,
  machine_process: handleMachineProcess,
  machine_select_recipe: handleMachineSelectRecipe,
  machine_transfer: handleMachineTransfer,
  machine_toggle: handleMachineToggle,
  research_station_open: handleResearchStationOpen,
  research_station_close: handleResearchStationClose,
  research_station_transfer: handleResearchStationTransfer,
  research_station_start: handleResearchStationStart,
  research_station_toggle: handleResearchStationToggle,
  research_tree_start: handleResearchTreeStart,
  research_tree_cancel: handleResearchTreeCancel,
  research_start: handleResearchTreeStart,
  research_cancel: handleResearchTreeCancel
};

export function applyCommand(state, player, rawMsg, timeMs) {
  const msg = sanitizeCommandMessage(rawMsg);
  if (!msg) return { ok: false, error: 'invalid_command' };
  if (!canAcceptCommand(player, timeMs)) return { ok: false, error: 'rate_limited' };

  const fn = HANDLERS[msg.cmd] ?? null;
  if (!fn) return { ok: false, error: 'unknown_command' };
  try {
    const ok = !!fn(state, player, msg, timeMs);
    return { ok, error: ok ? '' : 'rejected' };
  } catch (err) {
    console.error('[command-router:error]', msg.cmd, err?.stack || err);
    return { ok: false, error: 'server_exception' };
  }
}
