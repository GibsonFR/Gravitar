import { SECTOR } from '../sector/SectorDefs.js';
import { getStructureDef } from './StructureDefs.js';
import { createStructure } from './StructureFactory.js';
import { removeResource } from '../inventory/InventorySystem.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';

function finite(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

function rectFor(def, x, y, orientation = 'h') {
  const vertical = def.id === 'wall' && String(orientation).toLowerCase() === 'v';
  const w = vertical ? def.h : def.w;
  const h = vertical ? def.w : def.h;
  return { left: x - w * 0.5, right: x + w * 0.5, top: y - h * 0.5, bottom: y + h * 0.5, w, h };
}

function rectsOverlap(a, b, pad = 16) {
  return a.left - pad <= b.right && a.right + pad >= b.left && a.top - pad <= b.bottom && a.bottom + pad >= b.top;
}

function entityRect(entity) {
  const w = finite(entity.w, 0) || finite(entity.radius, 0) * 2;
  const h = finite(entity.h, 0) || finite(entity.radius, 0) * 2;
  return { left: entity.x - w * 0.5, right: entity.x + w * 0.5, top: entity.y - h * 0.5, bottom: entity.y + h * 0.5, w, h };
}

function ownerKey(player) {
  return String(player.accountKey || player.accountName || player.pseudo || `guest-${player.id | 0}`).toLowerCase();
}

function isTestPlayer(player) {
  return String(player.gameMode || '').toLowerCase().includes('test') || String(player.worldId || '').toLowerCase().startsWith('test');
}

function inSameWorld(st, player) {
  return String(st.worldId || 'endless') === String(player.worldId || 'endless');
}

function hasResources(inv, cost) {
  for (const [key, amount] of Object.entries(cost || {})) {
    if (!RESOURCE_DEFS[key]) return false;
    if ((inv?.resources?.[key] || 0) < (amount | 0)) return false;
  }
  return true;
}

function payResources(inv, cost) {
  for (const [key, amount] of Object.entries(cost || {})) removeResource(inv, key, amount | 0);
}

function findOwnCore(state, player, sx, sy, x, y) {
  const key = ownerKey(player);
  let best = null;
  let bestD2 = Infinity;
  for (const st of state.structures.values()) {
    if (st.type !== 'base_core') continue;
    if (!inSameWorld(st, player)) continue;
    if ((st.sx | 0) !== (sx | 0) || (st.sy | 0) !== (sy | 0)) continue;
    if (String(st.ownerKey || '').toLowerCase() !== key) continue;
    const dx = st.x - x;
    const dy = st.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { best = st; bestD2 = d2; }
  }
  return best && Math.sqrt(bestD2) <= (best.claimRadius || 900) ? best : null;
}

export function canPlaceStructure(state, player, type, x, y, orientation = 'h') {
  const def = getStructureDef(type);
  if (!def) return { ok: false, error: 'unknown_structure' };
  const sx = player.sx | 0;
  const sy = player.sy | 0;
  const px = finite(x, player.x);
  const py = finite(y, player.y);
  if (Math.abs(px) > SECTOR.half - 120 || Math.abs(py) > SECTOR.half - 120) return { ok: false, error: 'too_close_to_sector_edge' };
  const dist = Math.hypot(px - player.x, py - player.y);
  if (dist > 320) return { ok: false, error: 'too_far' };

  const key = ownerKey(player);
  if (def.id === 'base_core') {
    for (const st of state.structures.values()) {
      if (st.type !== 'base_core') continue;
      if (!inSameWorld(st, player)) continue;
      if (String(st.ownerKey || '').toLowerCase() === key) return { ok: false, error: 'core_exists' };
      if ((st.sx | 0) === sx && (st.sy | 0) === sy && Math.hypot(st.x - px, st.y - py) < 1100) return { ok: false, error: 'too_close_to_base' };
    }
  } else if (!findOwnCore(state, player, sx, sy, px, py)) {
    return { ok: false, error: 'need_nearby_core' };
  }

  const r = rectFor(def, px, py, orientation);
  for (const st of state.structures.values()) {
    if (!inSameWorld(st, player)) continue;
    if ((st.sx | 0) !== sx || (st.sy | 0) !== sy) continue;
    if (rectsOverlap(r, entityRect(st), 14)) return { ok: false, error: 'blocked_by_structure' };
  }
  for (const wall of state.asteroids.values()) {
    if (!wall.solid && !wall.bastionWall) continue;
    if ((wall.sx | 0) !== sx || (wall.sy | 0) !== sy) continue;
    if (rectsOverlap(r, entityRect(wall), 16)) return { ok: false, error: 'blocked' };
  }
  for (const station of state.stations.values()) {
    if ((station.sx | 0) !== sx || (station.sy | 0) !== sy) continue;
    const d = Math.hypot(station.x - px, station.y - py);
    if (d < (station.radius || 80) + Math.max(def.w || def.radius * 2, def.h || def.radius * 2) * 0.5 + 80) return { ok: false, error: 'too_close_to_station' };
  }
  if (!isTestPlayer(player) && !hasResources(player.inv, def.cost)) return { ok: false, error: 'missing_resources' };
  return { ok: true, def };
}

export function placeStructure(state, player, type, x, y, orientation = 'h', timeMs = Date.now()) {
  const check = canPlaceStructure(state, player, type, x, y, orientation);
  if (!check.ok) return { ok: false, error: check.error };
  const def = check.def;
  if (!isTestPlayer(player)) payResources(player.inv, def.cost);
  const st = createStructure(state, def.id, player.sx | 0, player.sy | 0, x, y, {
    ownerId: player.id | 0,
    ownerKey: ownerKey(player),
    ownerName: player.pseudo || player.accountName || 'Pilote',
    worldId: player.worldId || 'endless',
    orientation,
    createdAt: timeMs,
    updatedAt: timeMs
  });
  state.structures.set(st.id, st);
  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true, structure: st };
}
