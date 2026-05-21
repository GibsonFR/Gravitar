export function listInventoryResourceStacks(inv) {
  if (!inv?.resources) return [];

  const out = [];
  for (const [resource, amount] of Object.entries(inv.resources)) {
    if ((amount ?? 0) > 0) out.push({ resource, amount });
  }
  return out;
}
