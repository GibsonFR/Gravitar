import { RESOURCE_DEFS, RESOURCE_KEYS_ORDER } from './ResourceDefs.js';

export function buildInventorySnapshot(inv) {
  if (!inv) return null;

  const resources = RESOURCE_KEYS_ORDER.map((key) => {
    const def = RESOURCE_DEFS[key];
    const amount = inv.resources[key] || 0;
    const sellUnitPrice = def.sellPrice || 0;
    return {
      key,
      name: def.name,
      amount,
      cargoPerUnit: def.cargoPerUnit || 1,
      sellUnitPrice,
      sellTotalValue: amount * sellUnitPrice,
      colorHex: def.colorHex || '#d0d7e4'
    };
  });

  return {
    credits: inv.credits || 0,
    cargoUsed: inv.cargoUsed || 0,
    cargoMax: inv.cargoMax || 0,
    cargoFill01: Math.max(0, Math.min(1, (inv.cargoUsed || 0) / Math.max(1, inv.cargoMax || 0))),
    totalSellValue: resources.reduce((sum, entry) => sum + entry.sellTotalValue, 0),
    resources
  };
}
