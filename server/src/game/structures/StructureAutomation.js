import { getStructureDef } from './StructureDefs.js';
import { getMachineRecipe } from '../../../../shared/content/crafting/MachineRecipes.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';

const RESOURCE_CAPACITY_DEFAULT = 80;
const MACHINE_INPUT_CAPACITY = 160;
const AUTOMATION_SAVE_INTERVAL_MS = 5000;
const FUEL_KEYS = new Set(['refinedFuel', 'biofuel', 'propellant']);
const TILE = 64;

function finite(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function usedCapacity(resources = {}) {
  let used = 0;
  for (const [key, amount] of Object.entries(resources || {})) {
    const n = amount | 0;
    if (n <= 0) continue;
    used += (Number(RESOURCE_DEFS[key]?.cargoPerUnit) || 1) * n;
  }
  return used;
}

function rectOf(st) {
  const w = finite(st?.w, 0) || finite(st?.radius, 0) * 2;
  const h = finite(st?.h, 0) || finite(st?.radius, 0) * 2;
  return {
    left: finite(st?.x) - w * 0.5,
    right: finite(st?.x) + w * 0.5,
    top: finite(st?.y) - h * 0.5,
    bottom: finite(st?.y) + h * 0.5
  };
}

function pointInside(st, x, y, pad = 6) {
  const r = rectOf(st);
  return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
}

function sameWorld(a, b) {
  return String(a?.worldId || 'endless') === String(b?.worldId || 'endless')
    && (a?.sx | 0) === (b?.sx | 0)
    && (a?.sy | 0) === (b?.sy | 0)
    && String(a?.ownerKey || '').toLowerCase() === String(b?.ownerKey || '').toLowerCase();
}

function dirOf(st) {
  const o = String(st?.orientation || 'h').toLowerCase();
  if (o === 'v' || o === 'd') return { x: 0, y: 1, label: 'down' };
  if (o === 'u') return { x: 0, y: -1, label: 'up' };
  if (o === 'l') return { x: -1, y: 0, label: 'left' };
  return { x: 1, y: 0, label: 'right' };
}

function targetPoint(st, forward = true) {
  const d = dirOf(st);
  const sign = forward ? 1 : -1;
  return { x: finite(st?.x) + d.x * TILE * sign, y: finite(st?.y) + d.y * TILE * sign };
}

function findStructureAt(state, origin, point) {
  let best = null;
  let bestD2 = Infinity;
  for (const st of state?.structures?.values?.() || []) {
    if (!st || st.id === origin.id) continue;
    if (!sameWorld(origin, st)) continue;
    if (!pointInside(st, point.x, point.y, 8)) continue;
    const dx = finite(st.x) - point.x;
    const dy = finite(st.y) - point.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { best = st; bestD2 = d2; }
  }
  return best;
}

function clean(resources = {}) {
  for (const key of Object.keys(resources)) if ((resources[key] | 0) <= 0) delete resources[key];
  return resources;
}

function resourceMeta(key) {
  const def = RESOURCE_DEFS[key] || {};
  return { key, name: def.name || key, colorHex: def.colorHex || '#d7e5ff' };
}

function getOutputMap(st) {
  const def = getStructureDef(st?.type);
  if (def?.machineType) {
    if (!st.machineOutput || typeof st.machineOutput !== 'object') st.machineOutput = {};
    return st.machineOutput;
  }
  const kind = st?.storage?.kind || '';
  if (kind === 'resources' || kind === 'conveyor' || kind === 'fuel') {
    if (!st.storage.resources || typeof st.storage.resources !== 'object') st.storage.resources = {};
    return st.storage.resources;
  }
  return null;
}

function getInputMap(st, key) {
  const def = getStructureDef(st?.type);
  if (def?.machineType) {
    const recipe = getMachineRecipe(st.machineRecipeId || '');
    if (recipe && !(key in (recipe.input || {}))) return null;
    if (!st.machineInput || typeof st.machineInput !== 'object') st.machineInput = {};
    return { map: st.machineInput, capacity: MACHINE_INPUT_CAPACITY };
  }
  const kind = st?.storage?.kind || '';
  if (kind === 'fuel' && !FUEL_KEYS.has(key)) return null;
  if (kind === 'conveyor') {
    if (!st.storage.resources || typeof st.storage.resources !== 'object') st.storage.resources = {};
    return { map: st.storage.resources, capacity: st.storage.capacity || 1 };
  }
  if (kind === 'resources' || kind === 'fuel') {
    if (!st.storage.resources || typeof st.storage.resources !== 'object') st.storage.resources = {};
    return { map: st.storage.resources, capacity: st.storage.capacity || RESOURCE_CAPACITY_DEFAULT };
  }
  return null;
}

function takeOne(source) {
  const map = getOutputMap(source);
  if (!map) return null;
  const entries = Object.entries(clean(map)).filter(([, amount]) => (amount | 0) > 0);
  if (!entries.length) return null;
  entries.sort(([a], [b]) => String(a).localeCompare(String(b)));
  const key = entries[0][0];
  map[key] = (map[key] | 0) - 1;
  clean(map);
  return key;
}

function canPut(target, key) {
  const dst = getInputMap(target, key);
  if (!dst) return false;
  const per = Number(RESOURCE_DEFS[key]?.cargoPerUnit) || 1;
  return usedCapacity(dst.map) + per <= (dst.capacity || RESOURCE_CAPACITY_DEFAULT);
}

function putOne(target, key) {
  const dst = getInputMap(target, key);
  if (!dst) return false;
  const per = Number(RESOURCE_DEFS[key]?.cargoPerUnit) || 1;
  if (usedCapacity(dst.map) + per > (dst.capacity || RESOURCE_CAPACITY_DEFAULT)) return false;
  dst.map[key] = (dst.map[key] | 0) + 1;
  return true;
}

function hasOutput(source) {
  const map = getOutputMap(source);
  return !!Object.entries(clean(map || {})).find(([, amount]) => (amount | 0) > 0);
}

function firstResourcePreview(resources = {}) {
  const entries = Object.entries(clean(resources)).filter(([, amount]) => (amount | 0) > 0);
  if (!entries.length) return null;
  entries.sort(([a], [b]) => String(a).localeCompare(String(b)));
  const [key, amount] = entries[0];
  return { ...resourceMeta(key), amount: amount | 0 };
}

function conveyorItem(belt) {
  const map = belt?.storage?.resources || {};
  const preview = firstResourcePreview(map);
  return preview?.key || '';
}

function updateConveyorVisual(belt, timeMs) {
  const key = conveyorItem(belt);
  if (!key) {
    belt.automationItem = null;
    belt.automationMoving = null;
    return;
  }
  if (!belt.automationMoving || belt.automationMoving.key !== key) {
    const travelMs = Number(getStructureDef(belt.type)?.automationIntervalMs) || 700;
    belt.automationMoving = { key, startedAt: timeMs, totalMs: travelMs };
  }
  const totalMs = Math.max(1, Number(belt.automationMoving.totalMs) || 700);
  const progress = Math.max(0, Math.min(1, (timeMs - Number(belt.automationMoving.startedAt || timeMs)) / totalMs));
  belt.automationItem = { ...resourceMeta(key), phase: 'belt', progress, at: timeMs };
}

function updateConveyor(state, belt, timeMs) {
  updateConveyorVisual(belt, timeMs);
  const key = conveyorItem(belt);
  if (!key) return false;
  const totalMs = Math.max(1, Number(belt.automationMoving?.totalMs) || Number(getStructureDef(belt.type)?.automationIntervalMs) || 700);
  const elapsed = timeMs - Number(belt.automationMoving?.startedAt || timeMs);
  if (elapsed < totalMs) return false;
  const target = findStructureAt(state, belt, targetPoint(belt, true));
  if (!target || !canPut(target, key)) {
    belt.automationMoving.startedAt = timeMs - totalMs;
    belt.automationItem = { ...resourceMeta(key), phase: 'blocked', progress: 1, at: timeMs };
    return false;
  }
  const map = getOutputMap(belt);
  map[key] = (map[key] | 0) - 1;
  clean(map);
  putOne(target, key);
  belt.automationMoving = null;
  belt.automationPulse = timeMs;
  belt.updatedAt = timeMs;
  target.updatedAt = timeMs;
  return true;
}

function ensureArmVisual(arm, timeMs) {
  if (!arm.automationJob?.key) {
    arm.automationItem = null;
    return;
  }
  const totalMs = Math.max(1, Number(arm.automationJob.totalMs) || 900);
  const progress = Math.max(0, Math.min(1, (timeMs - Number(arm.automationJob.startedAt || timeMs)) / totalMs));
  arm.automationItem = { ...resourceMeta(arm.automationJob.key), phase: 'arm', progress, at: timeMs };
}

function updateRobotArm(state, arm, timeMs) {
  const def = getStructureDef(arm.type);
  const totalMs = Number(def?.automationIntervalMs) || 900;
  if (arm.automationJob?.key) {
    ensureArmVisual(arm, timeMs);
    const elapsed = timeMs - Number(arm.automationJob.startedAt || timeMs);
    if (elapsed < totalMs) return false;
    const target = findStructureAt(state, arm, targetPoint(arm, true));
    if (!target || !canPut(target, arm.automationJob.key)) {
      arm.automationJob.startedAt = timeMs - totalMs;
      arm.automationItem = { ...resourceMeta(arm.automationJob.key), phase: 'arm_blocked', progress: 1, at: timeMs };
      return false;
    }
    putOne(target, arm.automationJob.key);
    arm.automationJob = null;
    arm.automationItem = null;
    arm.automationPulse = timeMs;
    arm.updatedAt = timeMs;
    target.updatedAt = timeMs;
    return true;
  }
  if (timeMs - (arm.lastAutomationAt || 0) < Math.max(150, totalMs * 0.25)) return false;
  const source = findStructureAt(state, arm, targetPoint(arm, false));
  const target = findStructureAt(state, arm, targetPoint(arm, true));
  if (!source || !target || !hasOutput(source)) return false;
  const key = takeOne(source);
  if (!key) return false;
  if (!canPut(target, key)) {
    putOne(source, key);
    arm.lastAutomationAt = timeMs;
    return false;
  }
  arm.automationJob = { key, startedAt: timeMs, totalMs };
  arm.lastAutomationAt = timeMs;
  ensureArmVisual(arm, timeMs);
  source.updatedAt = timeMs;
  arm.updatedAt = timeMs;
  return true;
}

export function updateStructureAutomation(state, dt, timeMs = Date.now()) {
  if (!state?.structures) return false;
  let changed = false;
  for (const st of state.structures.values()) {
    const def = getStructureDef(st?.type);
    if (!def?.automationKind) continue;
    if (def.automationKind === 'conveyor') changed = updateConveyor(state, st, timeMs) || changed;
    else if (def.automationKind === 'robot_arm') changed = updateRobotArm(state, st, timeMs) || changed;
  }
  if (changed && timeMs - (state.lastAutomationSaveAt || 0) > AUTOMATION_SAVE_INTERVAL_MS) {
    state.lastAutomationSaveAt = timeMs;
    state.structureStore?.saveFromState?.(state);
  }
  return changed;
}
