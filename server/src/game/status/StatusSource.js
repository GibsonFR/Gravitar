export function resolveStatusSource(state, entry) {
  if (!entry?.sourceId) return null;
  return state.players.get(entry.sourceId) ?? null;
}
