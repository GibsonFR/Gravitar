import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { clearInventoryResource } from '../inventory/InventorySystem.js';
import { addCredits } from '../inventory/CreditSystem.js';
import { getStationDemandForResource } from '../station/pirate/PirateStationEconomy.js';

export function handleSellAll(state, player) {
  if (!player?.inv) return false;
  const sid = Math.floor(Number(player.dockedStationId) || 0);
  if (!sid) return false;
  const st = state?.stations?.get?.(sid) ?? null;
  if (!st) return false;
  if ((st.sx | 0) !== (player.sx | 0) || (st.sy | 0) !== (player.sy | 0)) return false;

  let added = 0;
  for (const key of Object.keys(RESOURCE_DEFS)) {
    const def = RESOURCE_DEFS[key];
    const demand = st.pirate ? getStationDemandForResource(st, key) : null;
    const unit = st.pirate ? Math.max(0, demand?.priceCredits | 0) : (def.sellPrice || 0);
    if (unit <= 0) continue;
    const sold = clearInventoryResource(player.inv, key);
    if (sold <= 0) continue;
    const credits = sold * unit;
    if (credits > 0) added += credits;
  }

  if (added > 0) addCredits(player.inv, added);
  return added > 0;
}
