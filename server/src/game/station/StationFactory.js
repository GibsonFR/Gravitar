import { newEntityId } from '../state/GameState.js';
import { FACTIONS } from '../constants.js';
import { buildStationStockForTime } from './shop/StationStockRefresh.js';

export function spawnStation(state, sx, sy, x, y, tech = false, seed = 0, timeMs = 0, options = null) {
  const specialtyId = String(options?.specialtyId || '');
  const pirate = specialtyId === 'pirate';
  const id = newEntityId(state);
  const station = {
    kind: 'station',
    id,
    faction: FACTIONS.STATION,
    sx: sx | 0,
    sy: sy | 0,
    x,
    y,
    radius: 28,
    tech,
    specialtyId,
    specialtyName: pirate ? 'Shop pirate' : '',
    pirate,
    name: pirate ? 'Shop pirate' : (tech ? 'Station Tech' : 'Station'),
    seed: seed | 0,
    worldSeed: state?.seed | 0,
    stock: null,
    pulse: (((seed | 0) >>> 0) % 10000) / 10000 * Math.PI * 2
  };
  station.stock = buildStationStockForTime(station, timeMs);
  state.stations.set(id, station);
  return id;
}
