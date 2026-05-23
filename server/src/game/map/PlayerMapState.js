import { sectorKey } from '../sector/SectorKey.js';
import { SECTOR } from '../sector/SectorDefs.js';
import { getSectorSummary } from './SectorSummary.js';
import { getBastionColor, getBastionEffectSummary, getBastionGlyph } from '../bastion/BastionTypes.js';
import { getBastionUnlockText, isBastionUnlockedForPlayer } from '../bastion/BastionSession.js';

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
    if (s) sectors.push({
      sx: s.sx | 0,
      sy: s.sy | 0,
      level: s.level | 0,
      asteroidCount: s.asteroidCount | 0,
      stationCount: s.stationCount | 0,
      hasReturnPortal: !!s.hasReturnPortal,
      bastion: state?.bastionsBySector?.get?.(`${s.sx | 0},${s.sy | 0}`) ? buildMapBastion(state.bastionsBySector.get(`${s.sx | 0},${s.sy | 0}`), player, timeMs, state) : null,
      primaryResource: s.primaryResource || 'scrap',
      resourceKeys: (s.resourceKeys || [s.primaryResource || 'scrap']).slice(0, 6),
      resourceNames: (s.resourceNames || []).slice(0, 6),
      biomeId: s.biomeId || '',
      biomeName: s.biomeName || '',
      biomeShortName: s.biomeShortName || '',
      biomeDescription: s.biomeDescription || '',
      biomeColorHex: s.biomeColorHex || ''
    });
  }

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
    players
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