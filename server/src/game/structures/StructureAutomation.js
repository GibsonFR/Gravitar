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

const AUTOMATION_STATUS_LABELS = {
  blocked: 'Sortie bloquée',
  target_full: 'Sortie pleine',
  target_rejects: 'Sortie incompatible',
  no_input: 'Entrée vide',
  no_input_structure: 'Aucune entrée',
  no_output: 'Aucune sortie',
  no_output_structure: 'Aucune sortie',
  input_empty: 'Entrée vide',
  disabled: 'Arrêté',
  no_power: 'Manque énergie',
  buffer_full: 'Buffer plein',
  no_deposit: 'Aucun gisement'
};

function automationLabel(code) {
  return AUTOMATION_STATUS_LABELS[String(code || '')] || String(code || '');
}

function setAutomationStatus(st, code = '', reason = '', timeMs = Date.now()) {
  const normalized = String(code || '');
  st.automationStatus = normalized;
  st.automationStatusLabel = normalized ? automationLabel(normalized) : '';
  st.automationStatusReason = normalized ? String(reason || st.automationStatusLabel || normalized) : '';
  st.automationStatusAt = normalized ? timeMs : 0;
}

function clearAutomationStatus(st) {
  st.automationStatus = '';
  st.automationStatusLabel = '';
  st.automationStatusReason = '';
  st.automationStatusAt = 0;
}

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

function diagnoseInput(target, key) {
  const dst = getInputMap(target, key);
  if (!dst) return { ok: false, code: 'target_rejects', reason: 'La structure en face ne peut pas recevoir cette ressource.' };
  const per = Number(RESOURCE_DEFS[key]?.cargoPerUnit) || 1;
  const capacity = dst.capacity || RESOURCE_CAPACITY_DEFAULT;
  if (usedCapacity(dst.map) + per > capacity) return { ok: false, code: 'target_full', reason: 'La sortie existe, mais son stockage ou son entrée est plein.' };
  return { ok: true, code: '', reason: '' };
}

function canPut(target, key) {
  return !!diagnoseInput(target, key).ok;
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

function conveyorTargets(state, belt, key) {
  const ports = conveyorOutputPoints(belt);
  const start = Math.max(0, belt.automationOutputIndex | 0);
  const ordered = ports.map((_, i) => ports[(start + i) % ports.length]);
  const targets = [];
  for (const port of ordered) {
    const target = findStructureAt(state, belt, port.point);
    if (target && canConveyorPut(target, key)) targets.push({ target, outDir: null, slot: port.slot });
  }
  return targets;
}

function diagnoseConveyorOutput(state, belt, key) {
  const ports = conveyorOutputPoints(belt);
  let sawStructure = false;
  let sawReject = false;
  for (const port of ports) {
    const target = findStructureAt(state, belt, port.point);
    if (!target) continue;
    sawStructure = true;
    const diag = diagnoseInput(target, key);
    if (diag.ok && isConveyorNetwork(target)) return { code: '', reason: '' };
    if (diag.ok) return { code: 'target_rejects', reason: 'Les convoyeurs ne déposent que vers un convoyeur, un répartiteur ou un fusionneur.' };
    if (diag.code === 'target_full') return { code: 'target_full', reason: diag.reason };
    sawReject = true;
  }
  if (!sawStructure) return { code: 'no_output_structure', reason: 'Aucune structure connectée devant la sortie.' };
  if (sawReject) return { code: 'target_rejects', reason: 'La structure connectée ne peut pas recevoir cette ressource.' };
  return { code: 'blocked', reason: 'Aucune sortie disponible.' };
}

function updateConveyorVisual(belt, timeMs) {
  const key = conveyorItem(belt);
  if (!key) {
    belt.automationItem = null;
    belt.automationMoving = null;
    clearAutomationStatus(belt);
    return;
  }
  if (!belt.automationMoving || belt.automationMoving.key !== key) {
    const travelMs = Number(getStructureDef(belt.type)?.automationIntervalMs) || 700;
    belt.automationMoving = { key, startedAt: timeMs, totalMs: travelMs };
  }
  const totalMs = Math.max(1, Number(belt.automationMoving.totalMs) || 700);
  const progress = Math.max(0, Math.min(1, (timeMs - Number(belt.automationMoving.startedAt || timeMs)) / totalMs));
  belt.automationItem = { ...resourceMeta(key), phase: belt.automationStatus === 'blocked' ? 'blocked' : 'belt', progress, startedAt: Number(belt.automationMoving.startedAt || timeMs), totalMs, at: timeMs };
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
    const diag = diagnoseConveyorOutput(state, belt, key);
    setAutomationStatus(belt, diag.code || 'blocked', diag.reason, timeMs);
    belt.automationBlockedAt = timeMs;
    belt.automationMoving.startedAt = timeMs - totalMs;
    belt.automationItem = { ...resourceMeta(key), phase: 'blocked', progress: 1, startedAt: Number(belt.automationMoving.startedAt || timeMs), totalMs, at: timeMs };
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
  clearAutomationStatus(belt);
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
  arm.automationItem = { ...resourceMeta(arm.automationJob.key), phase, progress, startedAt: Number(arm.automationJob.startedAt || timeMs), totalMs, at: timeMs };
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
      const diag = target ? diagnoseInput(target, arm.automationJob.key) : { code: 'no_output_structure', reason: 'Aucune structure connectée devant le bras.' };
      setAutomationStatus(arm, diag.code || 'blocked', diag.reason, timeMs);
      arm.automationBlockedAt = timeMs;
      arm.automationJob.startedAt = timeMs - totalMs;
      arm.automationItem = { ...resourceMeta(arm.automationJob.key), phase: 'arm_blocked', progress: 1, startedAt: Number(arm.automationJob.startedAt || timeMs), totalMs, at: timeMs };
      return false;
    }
    putOne(target, arm.automationJob.key);
    arm.automationJob = null;
    arm.automationItem = null;
    clearAutomationStatus(arm);
    arm.automationPulse = timeMs;
    arm.updatedAt = timeMs;
    target.updatedAt = timeMs;
    return true;
  }
  if (timeMs - (arm.lastAutomationAt || 0) < Math.max(120, totalMs * 0.22)) return false;
  const source = findStructureAt(state, arm, targetPoint(arm, false, reach));
  const target = findStructureAt(state, arm, targetPoint(arm, true, reach));
  if (!source || !target) {
    setAutomationStatus(arm, !source ? 'no_input_structure' : 'no_output_structure', !source ? 'Aucune structure connectée derrière le bras.' : 'Aucune structure connectée devant le bras.', timeMs);
    return false;
  }
  if (!hasOutput(source, (key) => canPut(target, key))) {
    const sourceHasAny = hasOutput(source);
    if (!sourceHasAny) setAutomationStatus(arm, 'input_empty', 'La structure d’entrée ne contient aucune ressource transférable.', timeMs);
    else {
      const first = resourceEntries(getOutputMap(source))[0]?.[0] || '';
      const diag = first ? diagnoseInput(target, first) : { code: 'blocked', reason: 'Aucune ressource compatible avec la sortie.' };
      setAutomationStatus(arm, diag.code || 'blocked', diag.reason || 'La sortie ne peut pas recevoir les ressources disponibles.', timeMs);
    }
    return false;
  }
  const key = takeOneMatching(source, (candidate) => canPut(target, candidate));
  if (!key) return false;
  arm.automationJob = { key, startedAt: timeMs, totalMs };
  clearAutomationStatus(arm);
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
    clearAutomationStatus(extractor);
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
    setAutomationStatus(extractor, 'no_deposit', 'Aucun gisement dans la portée de l’extracteur.', timeMs);
    extractor.depositResourceKey = '';
    extractor.extractionProgress = 0;
    extractor.automationItem = null;
    return changed;
  }

  const key = String(deposit.depositResourceKey || 'ironOre');
  extractor.depositResourceKey = key;
  extractor.depositLabel = deposit.depositLabel || RESOURCE_DEFS[key]?.name || key;

  if (extractor.machineEnabled === false) {
    setAutomationStatus(extractor, 'disabled', 'Extracteur arrêté manuellement.', timeMs);
    extractor.extractionProgress = 0;
    extractor.automationItem = null;
    return changed;
  }

  const energyUse = Math.max(0, Number(def?.energyUse ?? extractor.energyUse) || 0);
  if (energyUse > 0 && !extractor.powered) {
    setAutomationStatus(extractor, 'no_power', 'Production énergétique insuffisante.', timeMs);
    extractor.extractionProgress = 0;
    extractor.automationItem = { ...resourceMeta(key), phase: 'no_power', progress: 0, startedAt: timeMs, totalMs: 1, at: timeMs };
    return changed;
  }

  const capacity = extractor.storage?.capacity || def?.storageCapacity || 8;
  const per = Number(RESOURCE_DEFS[key]?.cargoPerUnit) || 1;
  if (usedCapacity(map) + per > capacity) {
    setAutomationStatus(extractor, 'buffer_full', 'Le buffer de sortie est plein.', timeMs);
    extractor.extractionProgress = 0;
    return changed;
  }

  const interval = Math.max(250, Number(def?.extractionIntervalMs) || 2200);
  const last = Number(extractor.lastExtractionAt || 0) || 0;
  const elapsed = last > 0 ? timeMs - last : interval;
  extractor.extractionProgress = Math.max(0, Math.min(1, elapsed / interval));
  extractor.automationItem = { ...resourceMeta(key), phase: 'extracting', progress: extractor.extractionProgress, startedAt: timeMs - Math.max(0, elapsed), totalMs: interval, at: timeMs };

  if (elapsed < interval) {
    clearAutomationStatus(extractor);
    return changed;
  }

  const amount = Math.max(1, Number(def?.extractionYield) || 1);
  map[key] = (map[key] | 0) + amount;
  extractor.lastExtractionAt = timeMs;
  extractor.extractionProgress = 0;
  clearAutomationStatus(extractor);
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
