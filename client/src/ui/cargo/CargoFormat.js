export function formatInt(value) {
  return `${Math.max(0, value | 0)}`;
}

export function formatCredits(value) {
  return `${Math.max(0, value | 0)} cr`;
}
