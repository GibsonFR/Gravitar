const COMMAND_MIN_INTERVAL_MS = 0;
const COMMANDS = new Set(['sell', 'sell_all', 'undock', 'jettison', 'set_frame', 'upgrade_ability', 'buy_item', 'buy_and_assign_rocket_ammo', 'equip_item', 'unequip_item', 'sell_item', 'assign_rocket_ammo', 'unassign_rocket_ammo', 'switch_rocket_slot', 'toggle_converter', 'commit_session_setup', 'auth_session_account', 'quit_session', 'cancel_battle_queue', 'equip_item_to_slot', 'build_structure', 'remove_structure', 'repair_structure', 'storage_transfer', 'storage_open', 'storage_close', 'toggle_structure', 'machine_open', 'machine_close', 'machine_process', 'machine_select_recipe', 'machine_transfer', 'machine_toggle', 'research_station_open', 'research_station_close', 'research_station_transfer', 'research_station_start', 'research_station_toggle', 'research_tree_start', 'research_tree_cancel', 'research_start', 'research_cancel', 'equipment_fabricator_open', 'equipment_fabricator_close', 'equipment_fabricator_craft', 'equipment_rd_open', 'equipment_rd_close', 'equipment_rd_start', 'equipment_rd_cancel']);

function cleanWord(value, maxLen = 48) {
  return String(value ?? '')
    .trim()
    .slice(0, maxLen)
    .replace(/[^a-zA-Z0-9_\-]/g, '');
}

function cleanFree(value, maxLen = 120) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLen);
}

function cleanPseudo(value, maxLen = 18) {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
    .replace(/[^\p{L}\p{N} _.'’-]/gu, '')
    .trim();
}

export function sanitizeCommandMessage(raw) {
  if (!raw || raw.t !== 'cmd') return null;
  const cmd = cleanWord(raw.cmd, 32).toLowerCase();
  if (!COMMANDS.has(cmd)) return null;

  const msg = { t: 'cmd', cmd };
  if (raw.cmdId != null) msg.cmdId = cleanWord(raw.cmdId, 48);

  if (cmd === 'sell' || cmd === 'jettison') {
    msg.resourceKey = cleanWord(raw.resourceKey ?? raw.resource ?? raw.key, 48);
    msg.itemId = cleanWord(raw.itemId ?? raw.id ?? '', 64).toLowerCase();
    const amount = Number.isFinite(raw.amount) ? Math.floor(raw.amount) : Math.floor(Number(raw.amount) || 0);
    msg.amount = Math.max(0, Math.min(999999, amount));
  }

  if (cmd === 'set_frame') msg.frameId = cleanWord(raw.frameId, 32).toLowerCase();
  if (cmd === 'commit_session_setup' || cmd === 'auth_session_account') {
    msg.frameId = cleanWord(raw.frameId, 32).toLowerCase();
    msg.pseudo = cleanPseudo(raw.pseudo ?? raw.name ?? raw.value, 18);
    msg.mode = cleanWord(raw.mode || 'endless', 32).toLowerCase();
    msg.battleSessionId = cleanWord(raw.battleSessionId || raw.serverId || '', 48).toLowerCase();
    msg.testWorldId = cleanWord(raw.testWorldId || '', 48).toLowerCase();
    msg.accountAction = cleanWord(raw.accountAction || 'guest', 16).toLowerCase();
    msg.accountName = cleanPseudo(raw.accountName ?? raw.accountPseudo ?? raw.accountEmail ?? '', 18);
    msg.accountPassword = cleanFree(raw.accountPassword || '', 80);
  }
  if (cmd === 'upgrade_ability') msg.slot = cleanWord(raw.slot, 1).toUpperCase();
  if (cmd === 'buy_item' || cmd === 'buy_and_assign_rocket_ammo' || cmd === 'equip_item' || cmd === 'unequip_item' || cmd === 'sell_item' || cmd === 'assign_rocket_ammo' || cmd === 'toggle_converter' || cmd === 'equip_item_to_slot') msg.itemId = cleanWord(raw.itemId ?? raw.id, 64).toLowerCase();
  if (cmd === 'equip_item_to_slot') {
    msg.categoryId = cleanWord(raw.categoryId ?? raw.category ?? '', 32).toLowerCase();
    msg.slotId = cleanWord(raw.slotId ?? raw.slot ?? '', 32).toLowerCase();
    const index = Number.isFinite(raw.index) ? Math.floor(raw.index) : Math.floor(Number(raw.index) || 0);
    msg.index = Math.max(0, Math.min(16, index));
  }
  if (cmd === 'toggle_converter') {
    if (raw.enabled === true || raw.enabled === false) msg.enabled = !!raw.enabled;
    else if (raw.enabled === 'true' || raw.enabled === '1' || raw.enabled === 1) msg.enabled = true;
    else if (raw.enabled === 'false' || raw.enabled === '0' || raw.enabled === 0) msg.enabled = false;
  }

  if (cmd === 'build_structure') {
    msg.structureType = cleanWord(raw.structureType ?? raw.type ?? '', 32).toLowerCase();
    const rawOrientation = cleanWord(raw.orientation || 'h', 1).toLowerCase();
    msg.orientation = ['h', 'v', 'r', 'd', 'l', 'u'].includes(rawOrientation) ? rawOrientation : 'h';
    const x = Number(raw.x);
    const y = Number(raw.y);
    if (Number.isFinite(x)) msg.x = Math.max(-4000, Math.min(4000, x));
    if (Number.isFinite(y)) msg.y = Math.max(-4000, Math.min(4000, y));
  }

  if (cmd === 'remove_structure' || cmd === 'repair_structure' || cmd === 'storage_open' || cmd === 'toggle_structure' || cmd === 'machine_open' || cmd === 'machine_toggle') {
    const structureId = Number.isFinite(raw.structureId) ? Math.floor(raw.structureId) : Math.floor(Number(raw.structureId) || 0);
    msg.structureId = Math.max(0, Math.min(2147483647, structureId));
  }




  if (cmd === 'machine_select_recipe') {
    const structureId = Number.isFinite(raw.structureId) ? Math.floor(raw.structureId) : Math.floor(Number(raw.structureId) || 0);
    msg.structureId = Math.max(0, Math.min(2147483647, structureId));
    msg.recipeId = cleanWord(raw.recipeId ?? raw.recipe ?? '', 80).toLowerCase();
  }

  if (cmd === 'machine_transfer') {
    const structureId = Number.isFinite(raw.structureId) ? Math.floor(raw.structureId) : Math.floor(Number(raw.structureId) || 0);
    msg.structureId = Math.max(0, Math.min(2147483647, structureId));
    msg.resourceKey = cleanWord(raw.resourceKey ?? raw.resource ?? raw.key, 48);
    const amount = Number.isFinite(raw.amount) ? Math.floor(raw.amount) : Math.floor(Number(raw.amount) || 0);
    msg.amount = Math.max(1, Math.min(999999, amount));
    const dir = cleanWord(raw.direction || raw.dir || '', 16).toLowerCase();
    msg.direction = dir === 'withdraw' ? 'withdraw' : 'deposit';
    const slot = cleanWord(raw.slot || 'input', 16).toLowerCase();
    msg.slot = slot === 'output' ? 'output' : 'input';
  }

  if (cmd === 'machine_toggle') {
    if (raw.enabled === true || raw.enabled === false) msg.enabled = !!raw.enabled;
    else if (raw.enabled === 'true' || raw.enabled === '1' || raw.enabled === 1) msg.enabled = true;
    else if (raw.enabled === 'false' || raw.enabled === '0' || raw.enabled === 0) msg.enabled = false;
  }

  if (cmd === 'machine_process') {
    const structureId = Number.isFinite(raw.structureId) ? Math.floor(raw.structureId) : Math.floor(Number(raw.structureId) || 0);
    msg.structureId = Math.max(0, Math.min(2147483647, structureId));
    msg.recipeId = cleanWord(raw.recipeId ?? raw.recipe ?? '', 80).toLowerCase();
    const amount = Number.isFinite(raw.amount) ? Math.floor(raw.amount) : Math.floor(Number(raw.amount) || 0);
    msg.amount = Math.max(1, Math.min(10, amount));
  }

  if (cmd === 'storage_transfer') {
    const structureId = Number.isFinite(raw.structureId) ? Math.floor(raw.structureId) : Math.floor(Number(raw.structureId) || 0);
    msg.structureId = Math.max(0, Math.min(2147483647, structureId));
    msg.resourceKey = cleanWord(raw.resourceKey ?? raw.resource ?? raw.key, 48);
    msg.itemId = cleanWord(raw.itemId ?? raw.id ?? '', 64).toLowerCase();
    const amount = Number.isFinite(raw.amount) ? Math.floor(raw.amount) : Math.floor(Number(raw.amount) || 0);
    msg.amount = Math.max(1, Math.min(999999, amount));
    const dir = cleanWord(raw.direction || raw.dir || '', 16).toLowerCase();
    msg.direction = dir === 'withdraw' ? 'withdraw' : 'deposit';
  }

  if (cmd === 'assign_rocket_ammo' || cmd === 'unassign_rocket_ammo' || cmd === 'switch_rocket_slot') {
    const slot = Number.isFinite(raw.slot) ? Math.floor(raw.slot) : Math.floor(Number(raw.slot) || 0);
    msg.slot = Math.max(0, Math.min(1, slot));
  }

  if (cmd === 'research_station_open' || cmd === 'research_station_close' || cmd === 'research_station_toggle' || cmd === 'research_station_start' || cmd === 'research_station_transfer') {
    const structureId = Number.isFinite(raw.structureId) ? Math.floor(raw.structureId) : Math.floor(Number(raw.structureId) || 0);
    msg.structureId = Math.max(0, Math.min(2147483647, structureId));
  }

  if (cmd === 'research_station_transfer') {
    msg.resourceKey = cleanWord(raw.resourceKey ?? raw.resource ?? raw.key, 48);
    const amount = Number.isFinite(raw.amount) ? Math.floor(raw.amount) : Math.floor(Number(raw.amount) || 0);
    msg.amount = Math.max(1, Math.min(999999, amount));
    const dir = cleanWord(raw.direction || raw.dir || '', 16).toLowerCase();
    msg.direction = dir === 'withdraw' ? 'withdraw' : 'deposit';
  }

  if (cmd === 'research_station_start' || cmd === 'research_tree_start' || cmd === 'research_start') {
    msg.projectId = cleanWord(raw.projectId ?? raw.project ?? '', 96).toLowerCase();
  }

  if (cmd === 'research_station_toggle') {
    if (raw.enabled === true || raw.enabled === false) msg.enabled = !!raw.enabled;
    else if (raw.enabled === 'true' || raw.enabled === '1' || raw.enabled === 1) msg.enabled = true;
    else if (raw.enabled === 'false' || raw.enabled === '0' || raw.enabled === 0) msg.enabled = false;
  }


  if (cmd === 'equipment_fabricator_open' || cmd === 'equipment_fabricator_close' || cmd === 'equipment_fabricator_craft' || cmd === 'equipment_rd_open' || cmd === 'equipment_rd_close' || cmd === 'equipment_rd_start' || cmd === 'equipment_rd_cancel') {
    const structureId = Number.isFinite(raw.structureId) ? Math.floor(raw.structureId) : Math.floor(Number(raw.structureId) || 0);
    msg.structureId = Math.max(0, Math.min(2147483647, structureId));
  }
  if (cmd === 'equipment_fabricator_craft') {
    msg.recipeId = cleanWord(raw.recipeId ?? raw.recipe ?? '', 80).toLowerCase();
    msg.mode = cleanWord(raw.mode ?? raw.craftMode ?? 'standard', 32).toLowerCase();
  }

  return msg;
}

export function canAcceptCommand(player, timeMs) {
  if (!player) return false;
  const net = player.net ?? (player.net = {
    lastAcceptedInputAt: timeMs - 1000,
    lastAcceptedCommandAt: timeMs - 1000,
    droppedInputCount: 0,
    droppedCommandCount: 0
  });
  if (!Number.isFinite(net.lastAcceptedCommandAt)) net.lastAcceptedCommandAt = timeMs - COMMAND_MIN_INTERVAL_MS;
  if ((timeMs - (net.lastAcceptedCommandAt | 0)) < COMMAND_MIN_INTERVAL_MS) {
    net.droppedCommandCount = (net.droppedCommandCount | 0) + 1;
    return false;
  }
  net.lastAcceptedCommandAt = timeMs;
  return true;
}
