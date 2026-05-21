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
  auth_session_account: handleAuthSessionAccount
};

export function applyCommand(state, player, rawMsg, timeMs) {
  const msg = sanitizeCommandMessage(rawMsg);
  if (!msg) return false;
  if (!canAcceptCommand(player, timeMs)) return false;

  const fn = HANDLERS[msg.cmd] ?? null;
  if (!fn) return false;
  return !!fn(state, player, msg, timeMs);
}
