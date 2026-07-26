import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { addResource, removeResource } from '../inventory/InventorySystem.js';
import { getStationBarterForResource, getStationSupplyForResource } from '../station/pirate/PirateStationEconomy.js';

export function handleBarterStationResource(state, player, msg) {
  if (!player?.inv) return false;
  const stationId = Math.floor(Number(player.dockedStationId) || 0);
  const station = stationId ? state?.stations?.get?.(stationId) : null;
  if (!station?.pirate) return false;
  if ((station.sx | 0) !== (player.sx | 0) || (station.sy | 0) !== (player.sy | 0)) return false;

  const outputKey = String(msg?.resourceKey || '').trim();
  const offer = getStationBarterForResource(station, outputKey);
  const supply = getStationSupplyForResource(station, outputKey);
  if (!offer || !supply || !RESOURCE_DEFS[offer.inputResourceKey] || !RESOURCE_DEFS[offer.outputResourceKey]) return false;
  if ((player.inv.resources?.[offer.inputResourceKey] | 0) < offer.inputAmount) return false;
  if ((supply.stock | 0) < offer.outputAmount) return false;

  const inputCargo = (RESOURCE_DEFS[offer.inputResourceKey].cargoPerUnit || 1) * offer.inputAmount;
  const outputCargo = (RESOURCE_DEFS[offer.outputResourceKey].cargoPerUnit || 1) * offer.outputAmount;
  if ((player.inv.cargoUsed || 0) - inputCargo + outputCargo > (player.inv.cargoMax || 0)) return false;

  const removed = removeResource(player.inv, offer.inputResourceKey, offer.inputAmount);
  if (removed !== offer.inputAmount) return false;
  const added = addResource(player.inv, offer.outputResourceKey, offer.outputAmount);
  if (added !== offer.outputAmount) {
    addResource(player.inv, offer.inputResourceKey, removed);
    return false;
  }
  supply.stock = Math.max(0, (supply.stock | 0) - added);
  player.forceFullUiSnapshot = true;
  return true;
}
