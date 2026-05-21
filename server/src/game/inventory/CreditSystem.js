export function addCredits(inv, amount) {
  if (!inv) return 0;
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  inv.credits = (inv.credits || 0) + amount;
  return amount;
}

export function getCredits(inv) {
  return inv?.credits || 0;
}
