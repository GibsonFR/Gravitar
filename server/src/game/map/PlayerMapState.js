import { sectorKey } from '../sector/SectorKey.js';
import { SECTOR } from '../sector/SectorDefs.js';
import { getSectorSummary } from './SectorSummary.js';
import { getBastionColor, getBastionEffectSummary, getBastionGlyph } from '../bastion/BastionTypes.js';
import { getBastionUnlockText, isBastionUnlockedForPlayer } from '../bastion/BastionSession.js';
import { buildLogisticMapSnapshot } from '../structures/StructureLogistics.js';
import { STRUCTURE_TYPES } from '../structures/StructureDefs.js';
import { isStructureAlive, isStructureOwner } from '../structures/StructureSystem.js';

export function createPlayerMapState() {
  return {
    visited: new Map(),
    order: []
  };
}

export function visitSectorOnPlayer(state, player, sx, sy, timeMs) {
  if (!player?.map) return;
  const key = sectorKey(sx, sy);

  if (!player.map.visited.has(key)) {
    const summary = getSectorSummary(state.seed | 0, sx, sy);
    player.map.visited.set(key, { ...summary, firstSeenAt: timeMs | 0, lastSeenAt: timeMs | 0 });
    player.map.order.push(key);
  } else {
    const s = player.map.visited.get(key);
    if (s) s.lastSeenAt = timeMs | 0;
  }

}

export function buildPlayerMapSnapshot(player, state = null, timeMs = 0) {
  if (!player?.map) return { sectors: [], sx: player?.sx | 0, sy: player?.sy | 0, activeRadius: SECTOR.sessionActiveRadius | 0 };
  const sectors = [];
  for (const key of player.map.order) {
    const s = player.map.visited.get(key);
    if (s) {
      const sx = s.sx | 0;
      const sy = s.sy | 0;
      // V229 hotfix: old accounts can contain already-discovered sectors saved with
      // legacy display labels (Type M/Type S). Keep the stable discovered-sector data,
      // but always refresh biome display metadata from current definitions before
      // sending the map snapshot.
      const currentSummary = getSectorSummary(state?.seed ?? 1337, sx, sy);
      sectors.push({
        sx,
        sy,
        level: s.level | 0,
        asteroidCount: s.asteroidCount | 0,
        stationCount: s.stationCount | 0,
        pirateStationCount: s.pirateStationCount | 0,
        hasReturnPortal: !!s.hasReturnPortal,
        bastion: state?.bastionsBySector?.get?.(`${sx},${sy}`) ? buildMapBastion(state.bastionsBySector.get(`${sx},${sy}`), player, timeMs, state) : null,
        primaryResource: s.primaryResource || 'scrap',
        resourceKeys: (s.resourceKeys || [s.primaryResource || 'scrap']).slice(0, 6),
        resourceNames: (s.resourceNames || []).slice(0, 6),
        biomeId: currentSummary.biomeId || s.biomeId || '',
        biomeName: currentSummary.biomeName || s.biomeName || '',
        biomeShortName: currentSummary.biomeShortName || s.biomeShortName || '',
        biomeDescription: currentSummary.biomeDescription || s.biomeDescription || '',
        biomeColorHex: currentSummary.biomeColorHex || s.biomeColorHex || ''
      });
    }
  }

  const homeBase = buildLocalBaseMapSnapshot(player, state);

  const bastions = (state?.bastions || []).map((b) => buildMapBastion(b, player, timeMs, state));

  const worldId = player?.worldId || 'endless';
  const players = [...(state?.players?.values?.() ?? [])]
    .filter((p) => p && !p.sessionSetupPending && String(p.worldId || 'endless') === String(worldId))
    .map((p) => ({
      id: p.id | 0,
      pseudo: p.pseudo || `Joueur ${p.id}`,
      frameId: p.frameId || '',
      frameName: p.frameName || '',
      level: p.progression?.level ?? 1,
      sx: p.sx | 0,
      sy: p.sy | 0,
      inBastion: !!p.bastionReturn,
      bastions: (p.bastionBuffs || []).map((b) => ({ type: b.type, tier: b.tier | 0, glyph: b.glyph || '' })).slice(0, 12)
    }));

  return {
    meId: player.id | 0,
    sx: player.sx | 0,
    sy: player.sy | 0,
    activeRadius: SECTOR.sessionActiveRadius | 0,
    sectors,
    bastions,
    players,
    homeBase,
    logistics: buildLogisticMapSnapshot(state, player, timeMs)
  };
}


function buildLocalBaseMapSnapshot(player, state) {
  if (!player || !state?.structures?.values) return null;

  let best = null;
  for (const structure of state.structures.values()) {
    if (!structure || structure.type !== STRUCTURE_TYPES.BASE_CORE) continue;
    if (!isStructureAlive(structure)) continue;
    if (!isStructureOwner(player, structure)) continue;
    if (String(structure.worldId || 'endless') !== String(player.worldId || 'endless')) continue;

    if (!best || Number(structure.createdAt || 0) < Number(best.createdAt || 0)) best = structure;
  }

  if (!best) return null;
  return {
    sx: best.sx | 0,
    sy: best.sy | 0,
    x: Math.round((Number(best.x) || 0) * 10) / 10,
    y: Math.round((Number(best.y) || 0) * 10) / 10,
    ownerName: best.ownerName || player.pseudo || '',
    structureId: best.id | 0
  };
}

function buildMapBastion(bastion, player, timeMs, state = null) {
  const color = getBastionColor(bastion.type);
  return {
    id: bastion.id | 0,
    sx: bastion.sx | 0,
    sy: bastion.sy | 0,
    tier: bastion.tier | 0,
    type: bastion.type || '',
    glyph: getBastionGlyph(bastion.type),
    name: bastion.name || 'Bastion',
    summary: getBastionEffectSummary(bastion.type),
    captured: !!bastion.captured,
    unlocked: isBastionUnlockedForPlayer(player, bastion, timeMs, state),
    unlockText: getBastionUnlockText(player, bastion, timeMs, state),
    unlockAtMs: bastion.unlockAtMs | 0,
    color
  };
}
export function serializePlayerMapState(map) {
  if (!map || typeof map !== 'object') return { visited: [], order: [] };
  const order = Array.isArray(map.order) ? map.order.map((key) => String(key || '')).filter(Boolean) : [];
  const visited = [];
  const seen = new Set();
  for (const key of order) {
    const entry = map.visited?.get?.(key) || null;
    if (!entry || seen.has(key)) continue;
    seen.add(key);
    visited.push({ key, ...entry });
  }
  for (const [key, entry] of map.visited?.entries?.() || []) {
    if (!entry || seen.has(key)) continue;
    seen.add(key);
    visited.push({ key, ...entry });
    order.push(String(key));
  }
  return { visited, order };
}

export function hydratePlayerMapState(raw) {
  const map = createPlayerMapState();
  if (!raw || typeof raw !== 'object') return map;
  const rawVisited = Array.isArray(raw.visited) ? raw.visited : [];
  const byKey = new Map();
  for (const entry of rawVisited) {
    if (!entry || typeof entry !== 'object') continue;
    const sx = entry.sx | 0;
    const sy = entry.sy | 0;
    const key = String(entry.key || sectorKey(sx, sy));
    if (!key) continue;
    byKey.set(key, {
      ...entry,
      sx,
      sy,
      level: entry.level | 0,
      asteroidCount: Math.max(0, entry.asteroidCount | 0),
      stationCount: Math.max(0, entry.stationCount | 0),
      pirateStationCount: Math.max(0, entry.pirateStationCount | 0),
      hasReturnPortal: !!entry.hasReturnPortal,
      firstSeenAt: Number(entry.firstSeenAt || 0),
      lastSeenAt: Number(entry.lastSeenAt || 0),
      primaryResource: entry.primaryResource || 'scrap',
      resourceKeys: Array.isArray(entry.resourceKeys) ? entry.resourceKeys.slice(0, 6) : [],
      resourceNames: Array.isArray(entry.resourceNames) ? entry.resourceNames.slice(0, 6) : [],
      biomeId: entry.biomeId || '',
      biomeName: entry.biomeName || '',
      biomeShortName: entry.biomeShortName || '',
      biomeDescription: entry.biomeDescription || '',
      biomeColorHex: entry.biomeColorHex || ''
    });
  }
  const order = Array.isArray(raw.order) ? raw.order.map((key) => String(key || '')).filter(Boolean) : [];
  const finalOrder = [];
  for (const key of order) if (byKey.has(key) && !finalOrder.includes(key)) finalOrder.push(key);
  for (const key of byKey.keys()) if (!finalOrder.includes(key)) finalOrder.push(key);
  for (const key of finalOrder) {
    map.order.push(key);
    map.visited.set(key, byKey.get(key));
  }
  return map;
}
