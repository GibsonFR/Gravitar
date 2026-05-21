export function getDockedStation(state, player) {
  const stationId = player?.dockedStationId || 0;
  if (!stationId) return null;
  return state?.stations?.get?.(stationId) ?? null;
}

export function canUseDockedStation(state, player) {
  return !!getDockedStation(state, player);
}
