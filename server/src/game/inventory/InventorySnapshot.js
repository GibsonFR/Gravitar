import { RESOURCE_DEFS, RESOURCE_KEYS_ORDER } from './ResourceDefs.js';
import { getStationDemandForResource } from '../station/pirate/PirateStationEconomy.js';

export function buildInventorySnapshot(inv, station = null) {
  if (!inv) return null;
  const pirateStation = !!station?.pirate;

  const resources = RESOURCE_KEYS_ORDER.map((key) => {
    const def = RESOURCE_DEFS[key];
    const amount = inv.resources[key] || 0;
    const demand = pirateStation ? getStationDemandForResource(station, key) : null;
    const sellable = pirateStation ? !!demand : true;
    const sellUnitPrice = pirateStation ? Math.max(0, demand?.priceCredits | 0) : (def.sellPrice || 0);
    return {
      key,
      name: def.name,
      amount,
      cargoPerUnit: def.cargoPerUnit || 1,
      sellable,
      demanded: !!demand,
      sellUnitPrice,
      sellTotalValue: sellable ? amount * sellUnitPrice : 0,
      colorHex: def.colorHex || '#d0d7e4'
    };
  });

  return {
    credits: inv.credits || 0,
    creditsLabel: 'Crédits pirates',
    cargoUsed: inv.cargoUsed || 0,
    cargoMax: inv.cargoMax || 0,
    cargoFill01: Math.max(0, Math.min(1, (inv.cargoUsed || 0) / Math.max(1, inv.cargoMax || 0))),
    totalSellValue: resources.reduce((sum, entry) => sum + entry.sellTotalValue, 0),
    resources
  };
}
