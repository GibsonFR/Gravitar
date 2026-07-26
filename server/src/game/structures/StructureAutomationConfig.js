import { RESOURCE_DEFS, RESOURCE_KEYS_ORDER } from '../inventory/ResourceDefs.js';
import { getStructureDef } from './StructureDefs.js';
import { distanceSqToStructureRect, isStructureOwner } from './StructureSystem.js';

const CONFIG_RANGE = 320;
const FILTER_MODES = new Set(['all', 'include', 'exclude']);
const OUTPUT_PRIORITIES = new Set(['round_robin', 'upper', 'lower']);

export function isConfigurableAutomation(structure) {
  const kind = getStructureDef(structure?.type)?.automationKind || '';
  return kind === 'robot_arm' || structure?.type === 'splitter';
}

function canConfigure(player, structure) {
  if (!player || !isConfigurableAutomation(structure)) return false;
  if (!isStructureOwner(player, structure)) return false;
  if (String(player.worldId || 'endless') !== String(structure.worldId || 'endless')) return false;
  if ((player.sx | 0) !== (structure.sx | 0) || (player.sy | 0) !== (structure.sy | 0)) return false;
  return distanceSqToStructureRect(structure, player.x || 0, player.y || 0) <= CONFIG_RANGE * CONFIG_RANGE;
}

function closeOtherStructurePanels(player) {
  player.openStorageId = 0;
  player.openMachineId = 0;
  player.openRocketWorkshopId = 0;
  player.openDroneStationId = 0;
  player.openLogisticChestId = 0;
  player.openResearchStationId = 0;
  player.openEquipmentFabricatorId = 0;
  player.openEquipmentRDStationId = 0;
}

export function openAutomationConfig(state, player, structureId) {
  const structure = state?.structures?.get?.(structureId | 0);
  if (!canConfigure(player, structure)) return { ok: false, error: 'automation_locked' };
  closeOtherStructurePanels(player);
  player.openAutomationId = structure.id | 0;
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function closeAutomationConfig(player) {
  if (!player) return { ok: false, error: 'missing_player' };
  player.openAutomationId = 0;
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function configureAutomation(state, player, structureId, config = {}, timeMs = Date.now()) {
  const structure = state?.structures?.get?.(structureId | 0);
  if (!canConfigure(player, structure)) return { ok: false, error: 'automation_locked' };
  const filterMode = String(config.filterMode || 'all').toLowerCase();
  const filterKey = String(config.filterKey || '');
  const outputPriority = String(config.outputPriority || 'round_robin').toLowerCase();
  if (!FILTER_MODES.has(filterMode)) return { ok: false, error: 'invalid_filter_mode' };
  if (filterKey && !RESOURCE_DEFS[filterKey]) return { ok: false, error: 'invalid_resource' };
  if (!OUTPUT_PRIORITIES.has(outputPriority)) return { ok: false, error: 'invalid_output_priority' };

  structure.automationFilterMode = filterMode;
  structure.automationFilterKey = filterMode === 'all' ? '' : filterKey;
  structure.automationInputPriorityKey = String(config.inputPriorityKey || '');
  if (structure.automationInputPriorityKey && !RESOURCE_DEFS[structure.automationInputPriorityKey]) {
    structure.automationInputPriorityKey = '';
  }
  structure.automationOutputPriority = outputPriority;
  structure.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  if (String(structure.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true };
}

export function automationAllowsResource(structure, resourceKey) {
  const mode = FILTER_MODES.has(structure?.automationFilterMode) ? structure.automationFilterMode : 'all';
  const key = String(structure?.automationFilterKey || '');
  if (mode === 'all' || !key) return true;
  return mode === 'include' ? resourceKey === key : resourceKey !== key;
}

export function buildAutomationConfigSnapshot(state, player) {
  const id = player?.openAutomationId | 0;
  if (!id) return null;
  const structure = state?.structures?.get?.(id);
  if (!canConfigure(player, structure)) {
    if (player) player.openAutomationId = 0;
    return null;
  }
  const kind = getStructureDef(structure.type)?.automationKind || '';
  return {
    id: structure.id | 0,
    name: structure.name || 'Automatisation',
    structureType: structure.type || '',
    kind,
    filterMode: structure.automationFilterMode || 'all',
    filterKey: structure.automationFilterKey || '',
    inputPriorityKey: structure.automationInputPriorityKey || '',
    outputPriority: structure.automationOutputPriority || 'round_robin',
    status: structure.automationStatus || '',
    resources: RESOURCE_KEYS_ORDER.map((key) => ({
      key,
      name: RESOURCE_DEFS[key]?.name || key,
      colorHex: RESOURCE_DEFS[key]?.colorHex || '#d7e5ff'
    }))
  };
}
