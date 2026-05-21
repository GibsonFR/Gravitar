import { RESOURCE_DEFS } from './ResourceDefs.js';

export function canAddResource(inv, resourceKey, amount) {
  const def = RESOURCE_DEFS[resourceKey];
  if (!def) return false;
  if (amount <= 0) return false;
  const addCargo = def.cargoPerUnit * amount;
  return (inv.cargoUsed + addCargo) <= inv.cargoMax;
}

export function addResource(inv, resourceKey, amount) {
  const def = RESOURCE_DEFS[resourceKey];
  if (!def) return 0;
  if (amount <= 0) return 0;

  const maxAdd = Math.floor((inv.cargoMax - inv.cargoUsed) / def.cargoPerUnit);
  const add = Math.max(0, Math.min(amount, maxAdd));
  if (add <= 0) return 0;

  inv.resources[resourceKey] = (inv.resources[resourceKey] || 0) + add;
  inv.cargoUsed += def.cargoPerUnit * add;
  return add;
}

export function clearInventoryResource(inv, resourceKey) {
  const def = RESOURCE_DEFS[resourceKey];
  if (!def || !inv?.resources) return 0;

  const amount = inv.resources[resourceKey] || 0;
  if (amount <= 0) return 0;

  inv.resources[resourceKey] = 0;
  inv.cargoUsed = Math.max(0, inv.cargoUsed - def.cargoPerUnit * amount);
  return amount;
}

export function removeResource(inv, resourceKey, amount) {
  const def = RESOURCE_DEFS[resourceKey];
  if (!def || !inv?.resources) return 0;
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  const cur = inv.resources[resourceKey] || 0;
  const take = Math.max(0, Math.min(cur, amount));
  if (take <= 0) return 0;

  inv.resources[resourceKey] = cur - take;
  inv.cargoUsed = Math.max(0, inv.cargoUsed - def.cargoPerUnit * take);
  return take;
}
