import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { removeResource } from '../inventory/InventorySystem.js';
import { addCredits } from '../inventory/CreditSystem.js';

export function handleSell(state, player, msg) {
  if (!player?.inv) return false;
  const sid = Math.floor(Number(player.dockedStationId) || 0);
  if (!sid) return false;
  const st = state?.stations?.get?.(sid) ?? null;
  if (!st) return false;
  if ((st.sx | 0) !== (player.sx | 0) || (st.sy | 0) !== (player.sy | 0)) return false;

  const key = (msg?.resourceKey ?? msg?.resource ?? msg?.key ?? '').toString().trim();
  const def = key ? RESOURCE_DEFS[key] : null;
  if (!def) return false;

  const amount = Math.floor(Number(msg?.amount) || 0);
  if (amount <= 0) return false;

  const sold = removeResource(player.inv, key, amount);
  if (sold <= 0) return false;

  const unit = def.sellPrice || 0;
  const credits = sold * unit;
  if (credits > 0) addCredits(player.inv, credits);

  return true;
}
