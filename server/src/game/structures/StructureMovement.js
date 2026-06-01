import { SECTOR } from '../sector/SectorDefs.js';
import { BASE_TILE_SIZE, STRUCTURE_TYPES, getStructureDef } from './StructureDefs.js';
import { getStructureRect, isStructureAlive, isStructureOwner } from './StructureSystem.js';

function finite(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function orientedSize(def, orientation = 'h') {
  const o = String(orientation || 'h').toLowerCase();
  const vertical = (o === 'v' || o === 'u' || o === 'd') && (Number(def?.w) !== Number(def?.h) || Number(def?.tilesX || 0) !== Number(def?.tilesY || 0));
  return {
    w: vertical ? def.h : def.w,
    h: vertical ? def.w : def.h
  };
}

function snapToFootprint(value, size, grid = BASE_TILE_SIZE) {
  const g = Math.max(1, Number(grid) || BASE_TILE_SIZE);
  return Math.round(((Number(value) || 0) - size * 0.5) / g) * g + size * 0.5;
}

function snapPlacement(def, x, y, orientation = 'h') {
  const grid = def?.gridSize || BASE_TILE_SIZE;
  const size = orientedSize(def, orientation);
  return { x: snapToFootprint(x, size.w, grid), y: snapToFootprint(y, size.h, grid) };
}

function rectFor(def, x, y, orientation = 'h') {
  const { w, h } = orientedSize(def, orientation);
  return { left: x - w * 0.5, right: x + w * 0.5, top: y - h * 0.5, bottom: y + h * 0.5, w, h };
}

function rectsOverlap(a, b, pad = 0) {
  const eps = 0.001;
  return a.left + pad < b.right - eps && a.right - pad > b.left + eps && a.top + pad < b.bottom - eps && a.bottom - pad > b.top + eps;
}

function rectInside(inner, outer) {
  const eps = 0.001;
  return inner.left >= outer.left - eps && inner.right <= outer.right + eps && inner.top >= outer.top - eps && inner.bottom <= outer.bottom + eps;
}

function pointInsideRect(x, y, rect) {
  const eps = 0.001;
  return x >= rect.left - eps && x <= rect.right + eps && y >= rect.top - eps && y <= rect.bottom + eps;
}

function rectAcceptedByClaim(rect, core) {
  const claim = claimRect(core);
  const cx = (rect.left + rect.right) * 0.5;
  const cy = (rect.top + rect.bottom) * 0.5;
  return rectInside(rect, claim) || pointInsideRect(cx, cy, claim);
}

function sectorBuildRect() {
  return {
    left: -SECTOR.half + BASE_TILE_SIZE,
    right: SECTOR.half - BASE_TILE_SIZE,
    top: -SECTOR.half + BASE_TILE_SIZE,
    bottom: SECTOR.half - BASE_TILE_SIZE
  };
}

function claimRect(core) {
  const half = Math.max(1, Number(core?.claimRadius) || BASE_TILE_SIZE * 8);
  return { left: core.x - half, right: core.x + half, top: core.y - half, bottom: core.y + half };
}

function entityRect(entity) {
  const w = finite(entity.w, 0) || finite(entity.radius, 0) * 2;
  const h = finite(entity.h, 0) || finite(entity.radius, 0) * 2;
  return { left: entity.x - w * 0.5, right: entity.x + w * 0.5, top: entity.y - h * 0.5, bottom: entity.y + h * 0.5, w, h };
}

function inSameWorld(st, player) {
  return String(st?.worldId || 'endless') === String(player?.worldId || 'endless');
}

function isCoreType(type) {
  const t = String(type || '').toLowerCase();
  return t === STRUCTURE_TYPES.BASE_CORE || t === STRUCTURE_TYPES.OUTPOST_CORE;
}

function isResourceDepositEntity(st) {
  return String(st?.type || '').toLowerCase() === STRUCTURE_TYPES.RESOURCE_DEPOSIT;
}

function canOverlapStructure(def, st) {
  if (isResourceDepositEntity(st)) return true;
  return def?.id === STRUCTURE_TYPES.MINING_EXTRACTOR && isResourceDepositEntity(st);
}

function isBlockingStructureForMove(other) {
  if (!other) return false;
  if (isResourceDepositEntity(other)) return false;
  return isStructureAlive(other);
}

function numericId(value) {
  const n = Number(value);
  return Number.isFinite(n) ? (n | 0) : 0;
}

function sameLogicalStructure(a, b, id = 0) {
  if (!a || !b) return false;
  if (a === b) return true;
  const aid = numericId(a.id);
  const bid = numericId(b.id);
  const expectedId = numericId(id);
  if (expectedId && (aid === expectedId || bid === expectedId)) return aid === bid || aid === expectedId || bid === expectedId;
  return !!aid && aid === bid;
}

function sameOldFootprintAsMovingStructure(other, moving, before) {
  if (!other || !moving || !before) return false;
  if (String(other.type || '').toLowerCase() !== String(moving.type || '').toLowerCase()) return false;
  if (String(other.ownerKey || '').toLowerCase() !== String(moving.ownerKey || '').toLowerCase()) return false;
  if ((other.sx | 0) !== (moving.sx | 0) || (other.sy | 0) !== (moving.sy | 0)) return false;
  const dx = Math.abs((Number(other.x) || 0) - (Number(before.x) || 0));
  const dy = Math.abs((Number(other.y) || 0) - (Number(before.y) || 0));
  if (dx > 0.01 || dy > 0.01) return false;
  const ow = Math.round(Number(other.w) || 0);
  const oh = Math.round(Number(other.h) || 0);
  const mw = Math.round(Number(moving.w) || 0);
  const mh = Math.round(Number(moving.h) || 0);
  return ow === mw && oh === mh;
}

function structureDebug(other) {
  if (!other) return null;
  return {
    id: other.id | 0,
    type: other.type,
    name: other.name || '',
    x: Math.round((Number(other.x) || 0) * 10) / 10,
    y: Math.round((Number(other.y) || 0) * 10) / 10,
    w: Math.round((Number(other.w) || 0) * 10) / 10,
    h: Math.round((Number(other.h) || 0) * 10) / 10,
    hp: Math.round(Number(other.stats?.hp ?? 0)),
    ownerKey: String(other.ownerKey || '')
  };
}

function findOwnCoreForRect(state, player, sx, sy, rect) {
  let best = null;
  let bestD2 = Infinity;
  const cx = (rect.left + rect.right) * 0.5;
  const cy = (rect.top + rect.bottom) * 0.5;
  for (const st of state?.structures?.values?.() || []) {
    if (!isCoreType(st?.type)) continue;
    if (!inSameWorld(st, player)) continue;
    if ((st.sx | 0) !== (sx | 0) || (st.sy | 0) !== (sy | 0)) continue;
    if (!isStructureOwner(player, st)) continue;
    if (!isStructureAlive(st)) continue;
    if (!rectAcceptedByClaim(rect, st)) continue;
    const dx = (st.x || 0) - cx;
    const dy = (st.y || 0) - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { best = st; bestD2 = d2; }
  }
  return best;
}

function findOverlappedDeposit(state, player, sx, sy, rect, ignoreId = 0) {
  for (const st of state?.structures?.values?.() || []) {
    if ((st.id | 0) === (ignoreId | 0)) continue;
    if (!isResourceDepositEntity(st)) continue;
    if (!inSameWorld(st, player)) continue;
    if ((st.sx | 0) !== (sx | 0) || (st.sy | 0) !== (sy | 0)) continue;
    if (rectsOverlap(rect, entityRect(st), 0)) return st;
  }
  return null;
}

function normalizeOrientation(value, fallback = 'h') {
  const raw = String(value || fallback || 'h').toLowerCase();
  return ['h', 'v', 'r', 'd', 'l', 'u'].includes(raw) ? raw : 'h';
}

export function canMoveStructure(state, player, structureId, x, y, orientation = null) {
  const id = Number(structureId) | 0;
  if (!id) return { ok: false, error: 'invalid_structure' };
  const st = state?.structures?.get?.(id);
  if (!st) return { ok: false, error: 'not_found' };
  const before = { x: st.x, y: st.y, orientation: st.orientation || 'h', baseCoreId: st.baseCoreId | 0 || 0 };
  if (!inSameWorld(st, player)) return { ok: false, error: 'wrong_world' };
  if ((st.sx | 0) !== (player.sx | 0) || (st.sy | 0) !== (player.sy | 0)) return { ok: false, error: 'wrong_sector' };
  if (!isStructureOwner(player, st)) return { ok: false, error: 'not_owner' };
  if (!isStructureAlive(st)) return { ok: false, error: 'not_alive' };
  if (isResourceDepositEntity(st)) return { ok: false, error: 'natural_deposit' };
  if (isCoreType(st.type)) return { ok: false, error: 'core_move_forbidden' };

  const def = getStructureDef(st.type);
  if (!def) return { ok: false, error: 'unknown_structure' };

  const nextOrientation = normalizeOrientation(orientation, st.orientation || 'h');
  const snapped = snapPlacement(def, finite(x, st.x), finite(y, st.y), nextOrientation);
  const rect = rectFor(def, snapped.x, snapped.y, nextOrientation);
  if (!rectInside(rect, sectorBuildRect())) return { ok: false, error: 'too_close_to_sector_edge' };

  const dist = Math.hypot(snapped.x - (player.x || 0), snapped.y - (player.y || 0));
  if (dist > (def.buildRange || 1100)) return { ok: false, error: 'too_far' };

  const sx = st.sx | 0;
  const sy = st.sy | 0;
  const core = findOwnCoreForRect(state, player, sx, sy, rect);
  if (!core) return { ok: false, error: 'need_nearby_core', debug: { structureId: id, type: st.type, before, target: { x: snapped.x, y: snapped.y, orientation: nextOrientation }, rect } }; 

  let overlappedDeposit = null;
  for (const other of state?.structures?.values?.() || []) {
    if (!other) continue;
    if (sameLogicalStructure(other, st, id) || sameOldFootprintAsMovingStructure(other, st, before)) continue;
    if (!inSameWorld(other, player)) continue;
    if ((other.sx | 0) !== sx || (other.sy | 0) !== sy) continue;
    if (!isBlockingStructureForMove(other)) {
      if (isResourceDepositEntity(other) && rectsOverlap(rect, getStructureRect(other), 0)) overlappedDeposit = other;
      continue;
    }
    if (!rectsOverlap(rect, getStructureRect(other), 0)) continue;
    if (canOverlapStructure(def, other)) {
      if (isResourceDepositEntity(other)) overlappedDeposit = other;
      continue;
    }
    return {
      ok: false,
      error: 'blocked_by_structure',
      debug: {
        structureId: id,
        blockedBy: structureDebug(other),
        before,
        target: { x: snapped.x, y: snapped.y, orientation: nextOrientation, rect }
      }
    };
  }

  for (const wall of state?.asteroids?.values?.() || []) {
    if (!wall.solid && !wall.bastionWall) continue;
    if ((wall.sx | 0) !== sx || (wall.sy | 0) !== sy) continue;
    if (rectsOverlap(rect, entityRect(wall), 0)) return { ok: false, error: 'blocked', debug: { structureId: id, blockedBy: wall.id | 0, blockedType: wall.kind || 'asteroid', before, target: { x: snapped.x, y: snapped.y, orientation: nextOrientation } } };
  }

  for (const station of state?.stations?.values?.() || []) {
    if ((station.sx | 0) !== sx || (station.sy | 0) !== sy) continue;
    const d = Math.hypot((station.x || 0) - snapped.x, (station.y || 0) - snapped.y);
    if (d < (station.radius || 80) + Math.max(rect.w, rect.h) * 0.5 + 80) return { ok: false, error: 'too_close_to_station', debug: { structureId: id, stationId: station.id | 0, before, target: { x: snapped.x, y: snapped.y, orientation: nextOrientation } } };
  }

  if (def.id === STRUCTURE_TYPES.MINING_EXTRACTOR) {
    overlappedDeposit ||= findOverlappedDeposit(state, player, sx, sy, rect, id);
  }

  return { ok: true, structure: st, def, x: snapped.x, y: snapped.y, orientation: nextOrientation, rect, core, overlappedDeposit };
}

export function moveStructure(state, player, structureId, x, y, orientation = null, timeMs = Date.now()) {
  const check = canMoveStructure(state, player, structureId, x, y, orientation);
  if (!check.ok) return { ok: false, error: check.error, debug: check.debug || null };
  const st = check.structure;
  st.x = check.x;
  st.y = check.y;
  st.orientation = check.orientation;
  const size = orientedSize(check.def, check.orientation);
  st.w = size.w;
  st.h = size.h;
  st.radius = Math.max(size.w, size.h) * 0.5;
  st.baseCoreId = check.core?.id | 0 || st.baseCoreId | 0 || 0;
  st.updatedAt = timeMs;

  if (st.type === STRUCTURE_TYPES.MINING_EXTRACTOR) {
    st.depositId = check.overlappedDeposit?.id | 0 || 0;
    st.depositResourceKey = check.overlappedDeposit?.depositResourceKey || '';
    st.depositLabel = check.overlappedDeposit?.depositLabel || '';
    st.extractionProgress = 0;
    st.automationItem = null;
  }

  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true, structure: st };
}
