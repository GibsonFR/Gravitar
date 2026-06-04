import { getStructureDef } from './StructureDefs.js';
import { getMachineRecipe } from '../../../../shared/content/crafting/MachineRecipes.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { EQUIPMENT_RD_ALLOWED_SCIENCES } from '../../../../shared/content/equipment/EquipmentCraftingDefs.js';

const RESOURCE_CAPACITY_DEFAULT = 80;
const MACHINE_INPUT_CAPACITY = 160;
const AUTOMATION_SAVE_INTERVAL_MS = 5000;
const FUEL_KEYS = new Set(['refinedFuel', 'biofuel', 'propellant']);
const RD_SCIENCE_KEYS = new Set(EQUIPMENT_RD_ALLOWED_SCIENCES);
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

function rectDistanceSq(a, b) {
  const ar = rectOf(a);
  const br = rectOf(b);
  const dx = Math.max(0, Math.max(ar.left - br.right, br.left - ar.right));
  const dy = Math.max(0, Math.max(ar.top - br.bottom, br.top - ar.bottom));
  return dx * dx + dy * dy;
}

function sameWorld(a, b) {
  return String(a?.worldId || 'endless') === String(b?.worldId || 'endless')
    && (a?.sx | 0) === (b?.sx | 0)
    && (a?.sy | 0) === (b?.sy | 0);
}

function dirOf(st) {
  const o = String(st?.orientation || 'h').toLowerCase();
  if (o === 'v' || o === 'd') return { x: 0, y: 1, label: 'down' };
  if (o === 'u') return { x: 0, y: -1, label: 'up' };
  if (o === 'l') return { x: -1, y: 0, label: 'left' };
  return { x: 1, y: 0, label: 'right' };
}

function leftOf(d) {
  return { x: -d.y, y: d.x, label: 'left' };
}

function rightOf(d) {
  return { x: d.y, y: -d.x, label: 'right' };
}

function targetPoint(st, forward = true, tiles = 1) {
  const d = dirOf(st);
  const sign = forward ? 1 : -1;
  const step = TILE * Math.max(1, Number(tiles) || 1);
  return { x: finite(st?.x) + d.x * step * sign, y: finite(st?.y) + d.y * step * sign };
}

function frontOutputPoint(st) {
  const d = dirOf(st);
  const w = finite(st?.w, finite(st?.radius, 0) * 2) || TILE;
  const h = finite(st?.h, finite(st?.radius, 0) * 2) || TILE;
  const halfAlong = Math.abs(d.x) > 0 ? w * 0.5 : h * 0.5;
  const step = halfAlong + TILE * 0.5;
  return { x: finite(st?.x) + d.x * step, y: finite(st?.y) + d.y * step };
}

function pointFromDir(st, d, tiles = 1) {
  const step = TILE * Math.max(1, Number(tiles) || 1);
  return { x: finite(st?.x) + d.x * step, y: finite(st?.y) + d.y * step };
}

function portPoint(st, forwardTiles = 1, sideTiles = 0) {
  const d = dirOf(st);
  const side = rightOf(d);
  return {
    x: finite(st?.x) + d.x * TILE * forwardTiles + side.x * TILE * sideTiles,
    y: finite(st?.y) + d.y * TILE * forwardTiles + side.y * TILE * sideTiles
  };
}

function isConveyorNetwork(st) {
  const t = String(st?.type || '').toLowerCase();
  return t === 'conveyor' || t === 'fast_conveyor' || t === 'splitter' || t === 'merger';
}

function conveyorOutputPoints(st) {
  const type = String(st?.type || '').toLowerCase();
  if (type === 'splitter') {
    return [
      { slot: 'upper', point: portPoint(st, 1, -0.5) },
      { slot: 'lower', point: portPoint(st, 1, 0.5) }
    ];
  }
  if (type === 'merger') return [{ slot: 'upper', point: portPoint(st, 1, -0.5) }];
  return [{ slot: 'front', point: targetPoint(st, true, 1) }];
}

function canConveyorPut(target, key) {
  return isConveyorNetwork(target) && canPut(target, key);
}

function findStructureAt(state, origin, point) {
  let best = null;
  let bestD2 = Infinity;
  for (const st of state?.structures?.values?.() || []) {
    if (!st || st.id === origin.id) continue;
    if (String(st.type || '') === 'resource_deposit') continue;
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
  const type = String(st?.type || '').toLowerCase();
  if (type === 'equipment_fabricator') {
    if (!st.machineInput || typeof st.machineInput !== 'object') st.machineInput = {};
    return { map: st.machineInput, capacity: 96 };
  }
  if (type === 'equipment_rd_station') {
    if (!RD_SCIENCE_KEYS.has(key)) return null;
    if (!st.scienceInput || typeof st.scienceInput !== 'object') st.scienceInput = {};
    return { map: st.scienceInput, capacity: 24 };
  }
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

function resourceEntries(map) {
  return Object.entries(clean(map || {}))
    .filter(([, amount]) => (amount | 0) > 0)
    .sort(([a], [b]) => String(a).localeCompare(String(b)));
}

function takeOneMatching(source, predicate = null) {
  const map = getOutputMap(source);
  if (!map) return null;
  for (const [key] of resourceEntries(map)) {
    if (predicate && !predicate(key)) continue;
    map[key] = (map[key] | 0) - 1;
    clean(map);
    return key;
  }
  return null;
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

function hasOutput(source, predicate = null) {
  const map = getOutputMap(source);
  return !!resourceEntries(map).find(([key]) => !predicate || predicate(key));
}

function firstResourcePreview(resources = {}) {
  const entries = resourceEntries(resources);
  if (!entries.length) return null;
  const [key, amount] = entries[0];
  return { ...resourceMeta(key), amount: amount | 0 };
}

function conveyorItem(belt) {
  const map = belt?.storage?.resources || {};
  const preview = firstResourcePreview(map);
  return preview?.key || '';
}

function preferredConveyorSlot(belt) {
  const def = getStructureDef(belt?.type);
  const outputs = Array.isArray(def?.automationOutputs) && def.automationOutputs.length ? def.automationOutputs : ['front'];
  const index = Math.max(0, belt?.automationOutputIndex | 0) % outputs.length;
  return outputs[index] || outputs[0] || 'front';
}

function conveyorTargets(state, belt, key) {
  const ports = conveyorOutputPoints(belt);
  const start = Math.max(0, belt.automationOutputIndex | 0);
  const ordered = ports.map((_, i) => ports[(start + i) % ports.length]);
  const targets = [];
  for (const port of ordered) {
    const target = findStructureAt(state, belt, port.point);
    if (target && canConveyorPut(target, key)) targets.push({ target, slot: port.slot });
  }
  return targets;
}

function updateConveyorVisual(belt, timeMs) {
  const key = conveyorItem(belt);
  if (!key) {
    belt.automationItem = null;
    belt.automationMoving = null;
    belt.automationStatus = '';
    return;
  }
  if (!belt.automationMoving || belt.automationMoving.key !== key) {
    const travelMs = Number(getStructureDef(belt.type)?.automationIntervalMs) || 700;
    belt.automationMoving = {
      key,
      startedAt: timeMs,
      totalMs: travelMs,
      slot: preferredConveyorSlot(belt)
    };
  }
  const totalMs = Math.max(1, Number(belt.automationMoving.totalMs) || 700);
  const progress = Math.max(0, Math.min(1, (timeMs - Number(belt.automationMoving.startedAt || timeMs)) / totalMs));
  belt.automationItem = {
    ...resourceMeta(key),
    phase: belt.automationStatus === 'blocked' ? 'blocked' : 'belt',
    progress,
    startedAt: Number(belt.automationMoving.startedAt || timeMs),
    totalMs,
    slot: belt.automationMoving.slot || preferredConveyorSlot(belt),
    structureType: String(belt?.type || '').toLowerCase(),
    at: timeMs
  };
}

function updateConveyor(state, belt, timeMs) {
  updateConveyorVisual(belt, timeMs);
  const key = conveyorItem(belt);
  if (!key) return false;
  const totalMs = Math.max(1, Number(belt.automationMoving?.totalMs) || Number(getStructureDef(belt.type)?.automationIntervalMs) || 700);
  const elapsed = timeMs - Number(belt.automationMoving?.startedAt || timeMs);
  if (elapsed < totalMs) return false;
  const targets = conveyorTargets(state, belt, key);
  if (!targets.length) {
    belt.automationStatus = 'blocked';
    belt.automationBlockedAt = timeMs;
    if (belt.automationMoving) belt.automationMoving.startedAt = timeMs - totalMs;
    belt.automationItem = {
      ...resourceMeta(key),
      phase: 'blocked',
      progress: 1,
      startedAt: Number(belt.automationMoving?.startedAt || timeMs),
      totalMs,
      slot: belt.automationMoving?.slot || preferredConveyorSlot(belt),
      structureType: String(belt?.type || '').toLowerCase(),
      at: timeMs
    };
    return false;
  }
  const chosen = targets[0];
  const map = getOutputMap(belt);
  map[key] = (map[key] | 0) - 1;
  clean(map);
  putOne(chosen.target, key);
  const def = getStructureDef(belt.type);
  const outputs = def?.automationOutputs || ['front'];
  if (outputs.length > 1) belt.automationOutputIndex = ((belt.automationOutputIndex | 0) + 1) % outputs.length;
  belt.automationMoving = null;
  belt.automationStatus = '';
  belt.automationPulse = timeMs;
  belt.updatedAt = timeMs;
  chosen.target.updatedAt = timeMs;
  return true;
}

function ensureArmVisual(arm, timeMs) {
  if (!arm.automationJob?.key) {
    arm.automationItem = null;
    return;
  }
  const totalMs = Math.max(1, Number(arm.automationJob.totalMs) || 900);
  const progress = Math.max(0, Math.min(1, (timeMs - Number(arm.automationJob.startedAt || timeMs)) / totalMs));
  const phase = arm.automationStatus === 'blocked' ? 'arm_blocked' : 'arm';
  arm.automationItem = {
    ...resourceMeta(arm.automationJob.key),
    phase,
    progress,
    startedAt: Number(arm.automationJob.startedAt || timeMs),
    totalMs,
    reachTiles: arm.automationJob.reachTiles || 1,
    at: timeMs
  };
}

function updateRobotArm(state, arm, timeMs) {
  const def = getStructureDef(arm.type);
  const totalMs = Number(def?.automationIntervalMs) || 900;
  const reach = Math.max(1, Number(def?.automationReachTiles) || 1);
  if (arm.automationJob?.key) {
    ensureArmVisual(arm, timeMs);
    const elapsed = timeMs - Number(arm.automationJob.startedAt || timeMs);
    if (elapsed < totalMs) return false;
    const target = findStructureAt(state, arm, targetPoint(arm, true, reach));
    if (!target || !canPut(target, arm.automationJob.key)) {
      arm.automationStatus = 'blocked';
      arm.automationBlockedAt = timeMs;
      arm.automationJob.startedAt = timeMs - totalMs;
      arm.automationItem = {
        ...resourceMeta(arm.automationJob.key),
        phase: 'arm_blocked',
        progress: 1,
        startedAt: Number(arm.automationJob.startedAt || timeMs),
        totalMs,
        reachTiles: reach,
        at: timeMs
      };
      return false;
    }
    putOne(target, arm.automationJob.key);
    arm.automationJob = null;
    arm.automationItem = null;
    arm.automationStatus = '';
    arm.automationPulse = timeMs;
    arm.updatedAt = timeMs;
    target.updatedAt = timeMs;
    return true;
  }
  if (timeMs - (arm.lastAutomationAt || 0) < Math.max(120, totalMs * 0.22)) return false;
  const source = findStructureAt(state, arm, targetPoint(arm, false, reach));
  const target = findStructureAt(state, arm, targetPoint(arm, true, reach));
  if (!source || !target) {
    arm.automationStatus = !source ? 'no_input' : 'no_output';
    return false;
  }
  if (!hasOutput(source, (key) => canPut(target, key))) {
    arm.automationStatus = hasOutput(source) ? 'blocked' : 'no_input';
    return false;
  }
  const key = takeOneMatching(source, (candidate) => canPut(target, candidate));
  if (!key) return false;
  arm.automationJob = { key, startedAt: timeMs, totalMs, reachTiles: reach };
  arm.automationStatus = '';
  arm.lastAutomationAt = timeMs;
  ensureArmVisual(arm, timeMs);
  source.updatedAt = timeMs;
  arm.updatedAt = timeMs;
  return true;
}


function isDeposit(st) {
  return String(st?.type || '').toLowerCase() === 'resource_deposit';
}

function findDepositById(state, id, origin = null) {
  const wanted = id | 0;
  if (!wanted) return null;
  const st = state?.structures?.get?.(wanted) || null;
  if (!st || !isDeposit(st)) return null;
  if (origin && !sameWorld(origin, st)) return null;
  return st;
}

function findNearestDeposit(state, extractor) {
  const range = Number(getStructureDef(extractor?.type)?.extractionRange) || TILE * 4.5;
  let best = null;
  let bestD2 = range * range;
  for (const st of state?.structures?.values?.() || []) {
    if (!st || !isDeposit(st) || !sameWorld(extractor, st)) continue;
    const d2 = rectDistanceSq(extractor, st);
    if (d2 <= bestD2) { best = st; bestD2 = d2; }
  }
  return best;
}

function extractorOutputTarget(state, extractor, key) {
  const target = findStructureAt(state, extractor, frontOutputPoint(extractor));
  return target && canConveyorPut(target, key) ? target : null;
}

function pushExtractorBuffer(state, extractor, timeMs) {
  const map = getOutputMap(extractor);
  const entries = resourceEntries(map);
  if (!entries.length) return false;
  for (const [key] of entries) {
    const target = extractorOutputTarget(state, extractor, key);
    if (!target) continue;
    if (!putOne(target, key)) continue;
    map[key] = (map[key] | 0) - 1;
    clean(map);
    extractor.automationItem = { ...resourceMeta(key), phase: 'extractor_out', progress: 1, startedAt: timeMs - 160, totalMs: 260, at: timeMs };
    extractor.automationStatus = '';
    extractor.updatedAt = timeMs;
    target.updatedAt = timeMs;
    return true;
  }
  return false;
}

function updateExtractor(state, extractor, timeMs) {
  const def = getStructureDef(extractor?.type);
  const map = getOutputMap(extractor);
  if (!map) return false;

  let changed = false;
  let deposit = findDepositById(state, extractor.depositId, extractor);
  if (!deposit) {
    deposit = findNearestDeposit(state, extractor);
    extractor.depositId = deposit?.id | 0 || 0;
  }

  if (!deposit) {
    extractor.automationStatus = 'no_deposit';
    extractor.depositResourceKey = '';
    extractor.extractionProgress = 0;
    extractor.automationItem = null;
    return changed;
  }

  const key = String(deposit.depositResourceKey || 'ironOre');
  extractor.depositResourceKey = key;
  extractor.depositLabel = deposit.depositLabel || RESOURCE_DEFS[key]?.name || key;

  if (extractor.machineEnabled === false) {
    extractor.automationStatus = 'disabled';
    extractor.extractionProgress = 0;
    extractor.automationItem = null;
    return changed;
  }

  const energyUse = Math.max(0, Number(def?.energyUse ?? extractor.energyUse) || 0);
  if (energyUse > 0 && !extractor.powered) {
    extractor.automationStatus = 'no_power';
    extractor.extractionProgress = 0;
    extractor.automationItem = { ...resourceMeta(key), phase: 'no_power', progress: 0, startedAt: timeMs, totalMs: 1, at: timeMs };
    return changed;
  }

  const capacity = extractor.storage?.capacity || def?.storageCapacity || 8;
  const per = Number(RESOURCE_DEFS[key]?.cargoPerUnit) || 1;
  if (usedCapacity(map) + per > capacity) {
    extractor.automationStatus = 'buffer_full';
    extractor.extractionProgress = 0;
    return changed;
  }

  const interval = Math.max(250, Number(def?.extractionIntervalMs) || 2200);
  const last = Number(extractor.lastExtractionAt || 0) || 0;
  const elapsed = last > 0 ? timeMs - last : interval;
  extractor.extractionProgress = Math.max(0, Math.min(1, elapsed / interval));
  extractor.automationItem = { ...resourceMeta(key), phase: 'extracting', progress: extractor.extractionProgress, startedAt: timeMs - Math.max(0, elapsed), totalMs: interval, at: timeMs };

  if (elapsed < interval) {
    extractor.automationStatus = '';
    return changed;
  }

  const amount = Math.max(1, Number(def?.extractionYield) || 1);
  map[key] = (map[key] | 0) + amount;
  extractor.lastExtractionAt = timeMs;
  extractor.extractionProgress = 0;
  extractor.automationStatus = '';
  extractor.updatedAt = timeMs;
  deposit.updatedAt = timeMs;
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
    else if (def.automationKind === 'extractor') changed = updateExtractor(state, st, timeMs) || changed;
  }
  if (changed && timeMs - (state.lastAutomationSaveAt || 0) > AUTOMATION_SAVE_INTERVAL_MS) {
    state.lastAutomationSaveAt = timeMs;
    state.structureStore?.saveFromState?.(state);
  }
  return changed;
}
