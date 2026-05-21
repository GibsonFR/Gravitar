import { toggleConverterEnabled } from '../equipment/EquipmentRules.js';

export function handleToggleConverter(state, player, msg, timeMs) {
  void state;
  const itemId = String(msg?.itemId || '').trim();
  if (!itemId) return false;
  return toggleConverterEnabled(player, itemId, timeMs);
}
