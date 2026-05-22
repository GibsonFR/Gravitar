import { setConverterEnabledExplicit, toggleConverterEnabled } from '../equipment/EquipmentRules.js';

export function handleToggleConverter(state, player, msg, timeMs) {
  void state;
  const itemId = String(msg?.itemId || '').trim();
  if (!itemId) return false;
  if (msg.enabled === true || msg.enabled === false) {
    return setConverterEnabledExplicit(player, itemId, msg.enabled, timeMs);
  }
  return toggleConverterEnabled(player, itemId, timeMs);
}
