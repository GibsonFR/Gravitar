import { SECTOR } from '../sector/SectorDefs.js';
import { BASE_TILE_SIZE, STRUCTURE_TYPES, getStructureDef } from './StructureDefs.js';
import { createStructure } from './StructureFactory.js';
import { removeResource } from '../inventory/InventorySystem.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { getResearchName, getStructureResearchRequirement, isStructureUnlockedByResearch } from '../../../../shared/content/research/ScienceResearchDefs.js';

function finite(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

function orientedSize(def, orientation = 'h') {
  const o = String(orientation || 'h').toLowerCase();
  const vertical = (o === 'v' || o === 'u' || o === 'd') && (Number(def?.w) !== Number(def?.h) || Number(def?.tilesX || 0) !== Number(def?.tilesY || 0));
  return {
    w: vertical ? def.h : def.w,
    h: vertical ? def.w : def.h
  };
}

function snapToFootprint(value, size, grid = 32) {
  const g = Math.max(1, Number(grid) || 32);
  return Math.round(((Number(value) || 0) - size * 0.5) / g) * g + size * 0.5;
}

function snapPlacement(def, x, y, orientation = 'h') {
  const grid = def?.gridSize || 32;
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

function ownerKey(player) {
  return String(player.accountKey || player.accountName || player.pseudo || `guest-${player.id | 0}`).toLowerCase();
}

function isTestPlayer(player) {
  return String(player.gameMode || '').toLowerCase().includes('test') || String(player.worldId || '').toLowerCase().startsWith('test');
}

function isProtectedEndlessHub(player) {
  return String(player?.worldId || 'endless') === 'endless' && (player?.sx | 0) === 0 && (player?.sy | 0) === 0;
}

function inSameWorld(st, player) {
  return String(st.worldId || 'endless') === String(player.worldId || 'endless');
}

function isResourceDepositEntity(st) {
  return String(st?.type || '').toLowerCase() === 'resource_deposit';
}

function isCoreType(type) {
  const t = String(type || '').toLowerCase();
  return t === STRUCTURE_TYPES.BASE_CORE || t === STRUCTURE_TYPES.OUTPOST_CORE;
}

function isBaseCoreType(type) {
  return String(type || '').toLowerCase() === STRUCTURE_TYPES.BASE_CORE;
}

function isOutpostCoreType(type) {
  return String(type || '').toLowerCase() === STRUCTURE_TYPES.OUTPOST_CORE;
}

function canOverlapStructure(def, st) {
  if (!def || !st) return false;
  if (def.id === 'mining_extractor' && isResourceDepositEntity(st)) return true;
  return false;
}

function findOverlappedDeposit(state, player, rect) {
  for (const st of state?.structures?.values?.() || []) {
    if (!isResourceDepositEntity(st)) continue;
    if (!inSameWorld(st, player)) continue;
    if ((st.sx | 0) !== (player.sx | 0) || (st.sy | 0) !== (player.sy | 0)) continue;
    if (rectsOverlap(rect, entityRect(st), 0)) return st;
  }
  return null;
}


function researchCompletedForPlayer(player) {
  return Array.isArray(player?.research?.completed) ? player.research.completed : [];
}

function buildResearchRequirementError(type) {
  const id = getStructureResearchRequirement(type);
  return id ? `research_required:${id}` : 'research_required';
}

function canBuildByResearch(player, type) {
  return isStructureUnlockedByResearch(type, researchCompletedForPlayer(player));
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

function findOwnCore(state, player, sx, sy, rect) {
  const key = ownerKey(player);
  const cx = (rect.left + rect.right) * 0.5;
  const cy = (rect.top + rect.bottom) * 0.5;
  let best = null;
  let bestD2 = Infinity;
  for (const st of state.structures.values()) {
    if (!isCoreType(st.type)) continue;
    if (!inSameWorld(st, player)) continue;
    if ((st.sx | 0) !== (sx | 0) || (st.sy | 0) !== (sy | 0)) continue;
    if (String(st.ownerKey || '').toLowerCase() !== key) continue;
    if (!rectInside(rect, claimRect(st))) continue;
    const dx = st.x - cx;
    const dy = st.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { best = st; bestD2 = d2; }
  }
  return best;
}

export function canPlaceStructure(state, player, type, x, y, orientation = 'h') {
  const def = getStructureDef(type);
  if (!def) return { ok: false, error: 'unknown_structure' };
  if (!isTestPlayer(player) && !canBuildByResearch(player, type)) return { ok: false, error: buildResearchRequirementError(type), researchId: getStructureResearchRequirement(type), researchName: getResearchName(getStructureResearchRequirement(type)) };
  if (!isTestPlayer(player) && isProtectedEndlessHub(player)) return { ok: false, error: 'hub_build_forbidden' };
  const sx = player.sx | 0;
  const sy = player.sy | 0;
  const rawX = finite(x, player.x);
  const rawY = finite(y, player.y);
  const snapped = snapPlacement(def, rawX, rawY, orientation);
  const px = snapped.x;
  const py = snapped.y;
  const r = rectFor(def, px, py, orientation);
  if (!rectInside(r, sectorBuildRect())) return { ok: false, error: 'too_close_to_sector_edge' };
  const dist = Math.hypot(px - player.x, py - player.y);
  if (dist > (def.buildRange || 1100)) return { ok: false, error: 'too_far' };

  const key = ownerKey(player);
  if (isCoreType(def.id)) {
    let outpostsInSector = 0;
    for (const st of state.structures.values()) {
      if (!isCoreType(st.type)) continue;
      if (!inSameWorld(st, player)) continue;
      const sameOwner = String(st.ownerKey || '').toLowerCase() === key;
      if (isBaseCoreType(def.id) && isBaseCoreType(st.type) && sameOwner) return { ok: false, error: 'core_exists' };
      if (isOutpostCoreType(def.id) && isOutpostCoreType(st.type) && sameOwner && (st.sx | 0) === sx && (st.sy | 0) === sy) outpostsInSector += 1;
      if ((st.sx | 0) === sx && (st.sy | 0) === sy) {
        const halfA = Math.max(1, Number(st.claimRadius) || BASE_TILE_SIZE * 8);
        const halfB = Math.max(1, Number(def.claimRadius) || BASE_TILE_SIZE * 2.5);
        if (Math.abs(st.x - px) < halfA + halfB + BASE_TILE_SIZE && Math.abs(st.y - py) < halfA + halfB + BASE_TILE_SIZE) return { ok: false, error: 'too_close_to_base' };
      }
    }
    if (isOutpostCoreType(def.id) && outpostsInSector >= Math.max(1, def.maxPerOwnerPerSector | 0 || 4)) return { ok: false, error: 'outpost_limit_sector' };
    const claim = { left: px - (def.claimRadius || 0), right: px + (def.claimRadius || 0), top: py - (def.claimRadius || 0), bottom: py + (def.claimRadius || 0) };
    if (!rectInside(claim, sectorBuildRect())) return { ok: false, error: 'too_close_to_sector_edge' };
  } else if (!findOwnCore(state, player, sx, sy, r)) {
    return { ok: false, error: 'need_nearby_core' };
  }


  let overlappedDeposit = null;
  for (const st of state.structures.values()) {
    if (!inSameWorld(st, player)) continue;
    if ((st.sx | 0) !== sx || (st.sy | 0) !== sy) continue;
    if (!rectsOverlap(r, entityRect(st), 0)) continue;
    if (canOverlapStructure(def, st)) {
      if (isResourceDepositEntity(st)) overlappedDeposit = st;
      continue;
    }
    return { ok: false, error: 'blocked_by_structure' };
  }
  for (const wall of state.asteroids.values()) {
    if (!wall.solid && !wall.bastionWall) continue;
    if ((wall.sx | 0) !== sx || (wall.sy | 0) !== sy) continue;
    if (rectsOverlap(r, entityRect(wall), 0)) return { ok: false, error: 'blocked' };
  }
  for (const station of state.stations.values()) {
    if ((station.sx | 0) !== sx || (station.sy | 0) !== sy) continue;
    const d = Math.hypot(station.x - px, station.y - py);
    if (d < (station.radius || 80) + Math.max(def.w || def.radius * 2, def.h || def.radius * 2) * 0.5 + 80) return { ok: false, error: 'too_close_to_station' };
  }
  if (!hasResources(player.inv, def.cost)) return { ok: false, error: 'missing_resources' };
  return { ok: true, def, overlappedDeposit };
}

export function placeStructure(state, player, type, x, y, orientation = 'h', timeMs = Date.now()) {
  const check = canPlaceStructure(state, player, type, x, y, orientation);
  if (!check.ok) return { ok: false, error: check.error };
  const def = check.def;
  payResources(player.inv, def.cost);
  const snapped = snapPlacement(def, x, y, orientation);
  const r = rectFor(def, snapped.x, snapped.y, orientation);
  const deposit = def.id === 'mining_extractor' ? (check.overlappedDeposit || findOverlappedDeposit(state, player, r)) : null;
  const st = createStructure(state, def.id, player.sx | 0, player.sy | 0, snapped.x, snapped.y, {
    ownerId: player.id | 0,
    ownerKey: ownerKey(player),
    ownerName: player.pseudo || player.accountName || 'Pilote',
    worldId: player.worldId || 'endless',
    orientation,
    depositId: deposit?.id | 0 || 0,
    depositResourceKey: deposit?.depositResourceKey || '',
    createdAt: timeMs,
    updatedAt: timeMs
  });
  if (isTestPlayer(player) && st.storage?.kind === 'fuel') {
    st.storage.resources ??= {};
    st.storage.resources.refinedFuel = Math.max(st.storage.resources.refinedFuel | 0, st.type === 'fuel_generator' ? 12 : 30);
  }
  state.structures.set(st.id, st);
  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true, structure: st };
}
