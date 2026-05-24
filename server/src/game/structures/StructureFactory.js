import { FACTIONS } from '../constants.js';
import { createStatBlock } from '../stats/StatBlockFactory.js';
import { newEntityId } from '../state/GameState.js';
import { getStructureDef } from './StructureDefs.js';


function buildStructureStorage(def, saved = null) {
  const kind = def?.storageKind || '';
  if (!kind) return saved || { resources: {} };
  if (kind === 'fuel') {
    const resources = saved?.resources && typeof saved.resources === 'object' ? { ...saved.resources } : {};
    return { kind, resources, capacity: saved?.capacity || def.fuelCapacity || 0 };
  }
  if (kind === 'equipment') {
    const items = Array.isArray(saved?.items) ? saved.items.map((id) => String(id || '')).filter(Boolean) : [];
    return { kind, items, itemCapacity: def.itemCapacity || 0 };
  }
  if (kind === 'ammo') {
    const ammo = saved?.ammo && typeof saved.ammo === 'object' ? { ...saved.ammo } : {};
    return { kind, ammo, ammoCapacity: def.ammoCapacity || 0 };
  }
  const resources = saved?.resources && typeof saved.resources === 'object' ? { ...saved.resources } : {};
  return { kind: 'resources', resources, capacity: saved?.capacity || def.storageCapacity || 0 };
}

function q(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

export function createStructure(state, type, sx, sy, x, y, options = {}) {
  const def = getStructureDef(type);
  if (!def) return null;
  const orientation = String(options.orientation || 'h').toLowerCase() === 'v' ? 'v' : 'h';
  const swap = (def.id === 'wall' || def.id === 'door') && orientation === 'v';
  const id = Number.isFinite(options.id) ? (options.id | 0) : newEntityId(state);
  const damageable = def.damageable !== false;
  const maxHp = damageable ? Math.max(1, options.maxHp || def.maxHp || 100) : 0;
  return {
    kind: 'structure',
    id,
    type: def.id,
    name: def.name,
    faction: FACTIONS.NEUTRAL ?? 0,
    ownerId: options.ownerId | 0 || 0,
    ownerKey: String(options.ownerKey || ''),
    ownerName: String(options.ownerName || '').slice(0, 24),
    worldId: String(options.worldId || 'endless'),
    sx: sx | 0,
    sy: sy | 0,
    x: q(x),
    y: q(y),
    radius: q(def.radius, 42),
    w: swap ? q(def.h, 48) : q(def.w, def.radius * 2),
    h: swap ? q(def.w, 190) : q(def.h, def.radius * 2),
    orientation,
    stats: createStatBlock({ maxHp }),
    damageable,
    open: !!options.open,
    openable: !!def.openable,
    solid: !!def.solid && !options.open,
    claimRadius: def.claimRadius || 0,
    storage: buildStructureStorage(def, options.storage),
    color: def.color || '#526274',
    borderColor: def.borderColor || '#9fcfff',
    powered: false,
    energyOutput: Number(def.energyOutput) || 0,
    energyUse: Number(def.energyUse) || 0,
    fuelUsePerSecond: Number(def.fuelUsePerSecond) || 0,
    fuelBufferSeconds: Number(options.fuelBufferSeconds ?? options.energyBuffer ?? 0) || 0,
    energyState: options.energyState || null,
    createdAt: options.createdAt || Date.now(),
    updatedAt: options.updatedAt || Date.now()
  };
}

export function serializeStructure(structure) {
  if (!structure) return null;
  return {
    id: structure.id | 0,
    type: structure.type,
    ownerId: structure.ownerId | 0,
    ownerKey: structure.ownerKey || '',
    ownerName: structure.ownerName || '',
    worldId: structure.worldId || 'endless',
    sx: structure.sx | 0,
    sy: structure.sy | 0,
    x: Math.round((structure.x || 0) * 10) / 10,
    y: Math.round((structure.y || 0) * 10) / 10,
    orientation: structure.orientation || 'h',
    hp: Math.max(0, Math.round(structure.stats?.hp ?? structure.stats?.maxHp ?? 0)),
    maxHp: Math.max(0, Math.round(structure.stats?.maxHp ?? 0)),
    storage: structure.storage || { resources: {} },
    open: !!structure.open,
    fuelBufferSeconds: Math.max(0, Math.round((Number(structure.fuelBufferSeconds) || 0) * 10) / 10),
    energyState: structure.energyState || null,
    createdAt: structure.createdAt || Date.now(),
    updatedAt: Date.now()
  };
}

export function hydrateStructure(state, saved) {
  const s = saved && typeof saved === 'object' ? saved : null;
  if (!s) return null;
  const st = createStructure(state, s.type, s.sx, s.sy, s.x, s.y, {
    id: s.id,
    ownerId: s.ownerId,
    ownerKey: s.ownerKey,
    ownerName: s.ownerName,
    worldId: s.worldId || 'endless',
    orientation: s.orientation,
    maxHp: s.maxHp,
    storage: s.storage,
    open: !!s.open,
    fuelBufferSeconds: s.fuelBufferSeconds ?? s.energyBuffer ?? 0,
    energyState: s.energyState || null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt
  });
  if (!st) return null;
  const hp = Number(s.hp);
  if (Number.isFinite(hp)) st.stats.hp = Math.max(0, Math.min(st.stats.maxHp, hp));
  return st;
}
