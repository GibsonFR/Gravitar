import { createStationStock } from './StationStockFactory.js';

export function getStationRefreshOffsetMs(station) {
  void station;
  return 0;
}

export function getStationRefreshIndexForTime(station, timeMs = 0) {
  void station;
  void timeMs;
  return 0;
}

export function getStationStockRefreshInfo(station, timeMs = 0) {
  void station;
  void timeMs;
  return {
    refreshMs: 0,
    offsetMs: 0,
    refreshIndex: 0,
    refreshAtMs: 0,
    nextRefreshAtMs: 0,
    refreshLeftMs: 0
  };
}

export function buildStationStockForTime(station, timeMs = 0) {
  void timeMs;
  return createStationStock(station?.seed | 0, !!station?.tech, station?.sx | 0, station?.sy | 0, {
    worldSeed: station?.worldSeed | 0,
    specialtyId: station?.specialtyId || ''
  });
}

export function ensureStationStockCurrent(station, timeMs = 0) {
  void timeMs;
  if (!station) return null;
  if (!station.stock) station.stock = buildStationStockForTime(station, 0);
  return station.stock;
}
