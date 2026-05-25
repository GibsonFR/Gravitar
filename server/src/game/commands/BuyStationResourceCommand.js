import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { addResource } from '../inventory/InventorySystem.js';
import { getStationSupplyForResource } from '../station/pirate/PirateStationEconomy.js';

export function handleBuyStationResource(state, player, msg) {
  if (!player?.inv) return false;
  const sid = Math.floor(Number(player.dockedStationId) || 0);
  if (!sid) return false;
  const st = state?.stations?.get?.(sid) ?? null;
  if (!st || !st.pirate) return false;
  if ((st.sx | 0) !== (player.sx | 0) || (st.sy | 0) !== (player.sy | 0)) return false;

  const key = String(msg?.resourceKey ?? msg?.resource ?? msg?.key ?? '').trim();
  if (!key || !RESOURCE_DEFS[key]) return false;
  const supply = getStationSupplyForResource(st, key);
  if (!supply) return false;

  const price = Math.max(0, supply.priceCredits | 0);
  const stock = Math.max(0, supply.stock ?? supply.amount ?? 0);
  if (price <= 0 || stock <= 0) return false;
  if ((player.inv.credits || 0) < price) return false;

  const amount = Math.max(1, supply.amount | 0);
  const added = addResource(player.inv, key, Math.min(amount, stock));
  if (added <= 0) return false;

  player.inv.credits = Math.max(0, (player.inv.credits || 0) - price);
  supply.stock = Math.max(0, stock - added);
  return true;
}
