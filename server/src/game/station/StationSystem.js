import { ensureStationStockCurrent } from './shop/StationStockRefresh.js';

export function updateStations(state, dt, timeMs = 0) {
  void dt;
  for (const station of state?.stations?.values?.() || []) {
    ensureStationStockCurrent(station, timeMs);
  }
}
