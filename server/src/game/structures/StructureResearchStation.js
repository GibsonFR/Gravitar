import { getStructureDef } from './StructureDefs.js';
import { isStructureOwner, distanceSqToStructureRect, findAliveCoreForStructure } from './StructureSystem.js';
import { addResource, removeResource, canAddResource } from '../inventory/InventorySystem.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import {
  SCIENCE_PACKS,
  RESEARCH_BRANCHES,
  RESEARCH_PROJECTS,
  getResearchProject,
  arePrerequisitesMet,
  isSciencePack
} from '../../../../shared/content/research/ScienceResearchDefs.js';

const RESEARCH_RANGE = 280;
const SCIENCE_CAPACITY = 240;
const RESEARCH_SAVE_INTERVAL_MS = 5000;

export function ensurePlayerResearch(player) {
  if (!player.research || typeof player.research !== 'object') player.research = { completed: [], unlocked: [], active: null };
  if (!Array.isArray(player.research.completed)) player.research.completed = [];
  if (!Array.isArray(player.research.unlocked)) player.research.unlocked = [];
  player.research.completed = player.research.completed.map((v) => String(v || '')).filter((v, i, a) => v && a.indexOf(v) === i);
  player.research.unlocked = player.research.unlocked.map((v) => String(v || '')).filter((v, i, a) => v && a.indexOf(v) === i);
  if (player.research.active && typeof player.research.active !== 'object') player.research.active = null;
  if (player.research.active && !getResearchProject(player.research.active.projectId)) player.research.active = null;
  return player.research;
}

function isResearchStation(st) {
  return String(st?.type || '').toLowerCase() === 'research_station';
}

export function isResearchStationStructure(st) {
  return isResearchStation(st);
}

function scienceInput(st) {
  if (!st.scienceInput || typeof st.scienceInput !== 'object') st.scienceInput = {};
  return st.scienceInput;
}

function cleanMap(map = {}) {
  for (const key of Object.keys(map)) if ((map[key] | 0) <= 0) delete map[key];
  return map;
}

function usedCapacity(map = {}) {
  let used = 0;
  for (const [key, amount] of Object.entries(map || {})) {
    if ((amount | 0) <= 0) continue;
    used += (Number(RESOURCE_DEFS[key]?.cargoPerUnit) || 1) * (amount | 0);
  }
  return used;
}

function resourceEntry(key, amount) {
  const def = RESOURCE_DEFS[key] || null;
  return { key, name: def?.name || key, amount: amount | 0, colorHex: def?.colorHex || '#ffffff' };
}

function resourceList(map = {}) {
  return Object.entries(map || {}).filter(([, amount]) => (amount | 0) > 0).map(([key, amount]) => resourceEntry(key, amount));
}

function mapHas(map = {}, required = {}) {
  for (const [key, amount] of Object.entries(required || {})) {
    if ((map[key] | 0) < (amount | 0)) return false;
  }
  return true;
}

function consume(map = {}, required = {}) {
  if (!mapHas(map, required)) return false;
  for (const [key, amount] of Object.entries(required || {})) map[key] = (map[key] | 0) - (amount | 0);
  cleanMap(map);
  return true;
}

function stationAccess(state, player, station) {
  if (!player || !isResearchStation(station)) return false;
  if (!isStructureOwner(player, station)) return false;
  if (distanceSqToStructureRect(station, player.x, player.y) > RESEARCH_RANGE * RESEARCH_RANGE) return false;
  return true;
}

function completedSet(player) {
  return new Set(ensurePlayerResearch(player).completed || []);
}

function projectAvailable(project, player) {
  if (!project) return false;
  const done = completedSet(player);
  if (done.has(project.id)) return false;
  return arePrerequisitesMet(project, [...done]);
}

function projectSnapshot(project, player) {
  const research = ensurePlayerResearch(player);
  const completed = research.completed.includes(project.id);
  const available = !completed && arePrerequisitesMet(project, research.completed);
  return {
    ...project,
    branchName: RESEARCH_BRANCHES.find((b) => b.id === project.branch)?.name || project.branch,
    completed,
    available,
    locked: !completed && !available
  };
}

function progressOf(station) {
  const job = station.researchJob || null;
  if (!job?.projectId) return 0;
  const total = Math.max(1, Number(job.totalMs) || 1);
  const remaining = Math.max(0, Number(job.remainingMs) || 0);
  return Math.max(0, Math.min(1, 1 - remaining / total));
}

export function canPlayerAccessResearchStation(state, player, station) {
  return stationAccess(state, player, station);
}

export function getResearchActiveEnergyUse(station) {
  if (!isResearchStation(station)) return 0;
  if (station.researchEnabled === false) return 0;
  if (station.globalResearchActive) return Math.max(0, Number(station.globalResearchEnergyUse || getStructureDef(station.type)?.energyUse) || 0);
  const job = station.researchJob || null;
  if (!job?.projectId || Number(job.remainingMs || 0) <= 0) return 0;
  const project = getResearchProject(job.projectId);
  return Math.max(0, Number(project?.energyUse ?? getStructureDef(station.type)?.energyUse) || 0);
}


function sameResearchWorld(a, b) {
  return String(a?.worldId || 'endless') === String(b?.worldId || 'endless');
}

function ownedResearchStations(state, player) {
  const arr = [];
  for (const st of state?.structures?.values?.() || []) {
    if (!isResearchStation(st)) continue;
    if ((st.ownerId | 0) !== (player?.id | 0)) continue;
    if (!sameResearchWorld(st, player)) continue;
    arr.push(st);
  }
  return arr;
}

function totalScienceInStations(stations) {
  const out = {};
  for (const st of stations || []) {
    const map = scienceInput(st);
    for (const [key, amount] of Object.entries(map)) {
      if (!isSciencePack(key)) continue;
      out[key] = (out[key] | 0) + Math.max(0, amount | 0);
    }
  }
  return out;
}

function consumeScienceFromStations(stations, cost = {}) {
  const total = totalScienceInStations(stations);
  if (!mapHas(total, cost)) return false;
  for (const [key, needRaw] of Object.entries(cost || {})) {
    let need = Math.max(0, needRaw | 0);
    for (const st of stations || []) {
      if (need <= 0) break;
      const map = scienceInput(st);
      const have = Math.max(0, map[key] | 0);
      if (have <= 0) continue;
      const take = Math.min(have, need);
      map[key] = have - take;
      need -= take;
      cleanMap(map);
      st.updatedAt = Date.now();
    }
  }
  return true;
}

function activeResearchProgress(active) {
  if (!active?.projectId) return 0;
  const total = Math.max(1, Number(active.totalMs || 1));
  const rem = Math.max(0, Number(active.remainingMs || 0));
  return Math.max(0, Math.min(1, 1 - rem / total));
}

function researchAvailability(project, player, scienceAvailable = {}) {
  const research = ensurePlayerResearch(player);
  const completed = research.completed.includes(project.id);
  const prerequisitesMet = arePrerequisitesMet(project, research.completed);
  const scienceReady = mapHas(scienceAvailable, project.scienceCost || {});
  return {
    completed,
    available: !completed && prerequisitesMet,
    locked: !completed && !prerequisitesMet,
    scienceReady
  };
}

function globalProjectSnapshot(project, player, scienceAvailable) {
  const state = researchAvailability(project, player, scienceAvailable);
  return {
    ...project,
    branchName: RESEARCH_BRANCHES.find((b) => b.id === project.branch)?.name || project.branch,
    ...state
  };
}

export function buildResearchTreeSnapshot(state, player) {
  if (!player) return null;
  const research = ensurePlayerResearch(player);
  const stations = ownedResearchStations(state, player);
  const scienceAvailable = totalScienceInStations(stations);
  const active = research.active || null;
  const activeProject = active?.projectId ? getResearchProject(active.projectId) : null;
  const poweredStations = stations.filter((st) => st.researchEnabled !== false && !!st.powered);
  return {
    completed: research.completed.slice(),
    unlocked: research.unlocked.slice(),
    activeProjectId: activeProject?.id || '',
    activeProjectName: activeProject?.name || '',
    activeProgress: activeResearchProgress(active),
    activePaused: !!active?.paused,
    activeStatus: active?.status || '',
    stationCount: stations.length,
    poweredStationCount: poweredStations.length,
    scienceAvailable: resourceList(scienceAvailable),
    packs: SCIENCE_PACKS,
    branches: RESEARCH_BRANCHES,
    projects: RESEARCH_PROJECTS.map((p) => globalProjectSnapshot(p, player, scienceAvailable))
  };
}

export function startGlobalResearchProject(state, player, projectId, timeMs = Date.now()) {
  const project = getResearchProject(projectId);
  if (!project) return { ok: false, error: 'unknown_project' };
  const research = ensurePlayerResearch(player);
  if (research.active?.projectId) return { ok: false, error: 'busy' };
  if (research.completed.includes(project.id)) return { ok: false, error: 'completed' };
  if (!arePrerequisitesMet(project, research.completed)) return { ok: false, error: 'locked' };
  const stations = ownedResearchStations(state, player);
  if (!stations.length) return { ok: false, error: 'no_station' };
  if (!consumeScienceFromStations(stations, project.scienceCost || {})) return { ok: false, error: 'science' };
  research.active = {
    projectId: project.id,
    startedAt: timeMs,
    totalMs: Math.max(1000, Number(project.seconds || 1) * 1000),
    remainingMs: Math.max(1000, Number(project.seconds || 1) * 1000),
    paused: false,
    status: ''
  };
  for (const st of stations) {
    if (st.researchEnabled === false) continue;
    st.globalResearchActive = true;
    st.globalResearchEnergyUse = Math.max(0, Number(project.energyUse || getStructureDef(st.type)?.energyUse) || 0);
  }
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function cancelGlobalResearchProject(state, player) {
  const research = ensurePlayerResearch(player);
  if (!research.active?.projectId) return { ok: false, error: 'idle' };
  research.active = null;
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function updateGlobalResearchForPlayer(state, player, timeMs, dtMs) {
  const research = ensurePlayerResearch(player);
  const active = research.active || null;
  const stations = ownedResearchStations(state, player);
  for (const st of stations) {
    st.globalResearchActive = false;
    st.globalResearchEnergyUse = 0;
  }
  if (!active?.projectId) return false;
  const project = getResearchProject(active.projectId);
  if (!project) {
    research.active = null;
    player.forceFullUiSnapshot = true;
    return true;
  }
  for (const st of stations) {
    if (st.researchEnabled === false) continue;
    st.globalResearchActive = true;
    st.globalResearchEnergyUse = Math.max(0, Number(project.energyUse || getStructureDef(st.type)?.energyUse) || 0);
  }
  const powered = stations.filter((st) => st.researchEnabled !== false && !!st.powered);
  if (!stations.length) {
    active.paused = true;
    active.status = 'no_station';
    return false;
  }
  if (!powered.length) {
    active.paused = true;
    active.status = 'no_power';
    return false;
  }
  active.paused = false;
  active.status = '';
  const speed = Math.max(1, powered.length);
  active.remainingMs = Math.max(0, Number(active.remainingMs || active.totalMs || 1) - Math.max(0, Number(dtMs) || 0) * speed);
  if (active.remainingMs > 0) return false;
  if (!research.completed.includes(project.id)) research.completed.push(project.id);
  for (const unlock of project.unlocks || []) if (!research.unlocked.includes(unlock)) research.unlocked.push(unlock);
  research.active = null;
  player.forceFullUiSnapshot = true;
  return true;
}


export function buildResearchStationSnapshot(state, player) {
  if (!player?.openResearchStationId) return null;
  const station = state?.structures?.get?.(player.openResearchStationId | 0);
  if (!stationAccess(state, player, station)) return null;
  const def = getStructureDef(station.type);
  const research = ensurePlayerResearch(player);
  const job = station.researchJob || null;
  const activeProject = job?.projectId ? getResearchProject(job.projectId) : null;
  const core = findAliveCoreForStructure(state, station);
  return {
    id: station.id | 0,
    type: station.type,
    name: station.name || def?.name || 'Station de recherche',
    enabled: station.researchEnabled !== false,
    powered: !!station.powered,
    energyUse: activeProject?.energyUse || 0,
    baseEnergy: core?.energyState || null,
    status: station.researchStatus || '',
    activeProjectId: job?.projectId || '',
    activeProjectName: activeProject?.name || '',
    progress: progressOf(station),
    paused: !!job?.paused,
    scienceInput: resourceList(scienceInput(station)),
    inputUsed: usedCapacity(scienceInput(station)),
    inputCapacity: SCIENCE_CAPACITY,
    packs: SCIENCE_PACKS,
    branches: RESEARCH_BRANCHES,
    completed: research.completed.slice(),
    unlocked: research.unlocked.slice(),
    projects: RESEARCH_PROJECTS.map((p) => projectSnapshot(p, player))
  };
}

export function openResearchStation(state, player, stationId) {
  const station = state?.structures?.get?.(stationId | 0);
  if (!stationAccess(state, player, station)) return { ok: false, error: 'access' };
  player.openResearchStationId = station.id | 0;
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function closeResearchStation(player) {
  if (!player) return false;
  player.openResearchStationId = 0;
  player.forceFullUiSnapshot = true;
  return true;
}

export function transferResearchScience(state, player, stationId, resourceKey, direction = 'deposit', amount = 1, timeMs = Date.now()) {
  const station = state?.structures?.get?.(stationId | 0);
  if (!stationAccess(state, player, station)) return { ok: false, error: 'access' };
  const key = String(resourceKey || '');
  if (!isSciencePack(key)) return { ok: false, error: 'not_science' };
  const n = Math.max(1, amount | 0 || 1);
  const map = scienceInput(station);

  if (direction === 'withdraw') {
    const have = Math.max(0, map[key] | 0);
    const take = Math.min(have, n);
    if (take <= 0) return { ok: false, error: 'empty' };
    if (!canAddResource(player.inv, key, take)) return { ok: false, error: 'cargo_full' };
    map[key] = have - take;
    cleanMap(map);
    addResource(player.inv, key, take);
  } else {
    const have = Math.max(0, player.inv?.resources?.[key] | 0);
    const put = Math.min(have, n);
    if (put <= 0) return { ok: false, error: 'missing' };
    const per = Number(RESOURCE_DEFS[key]?.cargoPerUnit) || 1;
    if (usedCapacity(map) + per * put > SCIENCE_CAPACITY) return { ok: false, error: 'full' };
    if (!removeResource(player.inv, key, put)) return { ok: false, error: 'missing' };
    map[key] = (map[key] | 0) + put;
  }

  station.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function startResearchProject(state, player, stationId, projectId, timeMs = Date.now()) {
  const station = state?.structures?.get?.(stationId | 0);
  if (!stationAccess(state, player, station)) return { ok: false, error: 'access' };
  const project = getResearchProject(projectId);
  if (!project) return { ok: false, error: 'unknown_project' };
  const research = ensurePlayerResearch(player);
  if (research.completed.includes(project.id)) return { ok: false, error: 'completed' };
  if (!projectAvailable(project, player)) return { ok: false, error: 'locked' };
  if (station.researchJob?.projectId) return { ok: false, error: 'busy' };
  const input = scienceInput(station);
  if (!mapHas(input, project.scienceCost || {})) return { ok: false, error: 'science' };
  consume(input, project.scienceCost || {});
  station.researchJob = {
    projectId: project.id,
    startedAt: timeMs,
    totalMs: Math.max(1000, Number(project.seconds || 1) * 1000),
    remainingMs: Math.max(1000, Number(project.seconds || 1) * 1000),
    paused: false
  };
  station.researchStatus = '';
  station.researchEnabled = true;
  station.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function toggleResearchStation(state, player, stationId, enabled = true, timeMs = Date.now()) {
  const station = state?.structures?.get?.(stationId | 0);
  if (!stationAccess(state, player, station)) return { ok: false, error: 'access' };
  station.researchEnabled = !!enabled;
  station.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function updateResearchStations(state, timeMs, dtMs) {
  if (!state?.structures) return false;
  let shouldSave = false;
  const stepMs = Math.max(0, Number(dtMs) || 0);

  for (const player of state.players?.values?.() || []) {
    if (updateGlobalResearchForPlayer(state, player, timeMs, stepMs)) shouldSave ||= String(player.worldId || 'endless') === 'endless';
  }

  for (const station of state.structures.values()) {
    if (!isResearchStation(station)) continue;
    const job = station.researchJob;
    if (!job?.projectId) {
      station.researchStatus = '';
      continue;
    }

    const project = getResearchProject(job.projectId);
    if (!project) {
      station.researchJob = null;
      station.researchStatus = '';
      station.updatedAt = timeMs;
      continue;
    }

    if (station.researchEnabled === false) {
      job.paused = true;
      station.researchStatus = 'off';
      continue;
    }
    if (!station.powered) {
      job.paused = true;
      station.researchStatus = 'no_power';
      continue;
    }

    job.paused = false;
    job.remainingMs = Math.max(0, Number(job.remainingMs || job.totalMs || 1) - stepMs);
    station.researchStatus = '';
    station.updatedAt = timeMs;

    if (job.remainingMs > 0) {
      if (String(station.worldId || 'endless') === 'endless' && timeMs - (station.lastResearchSaveAt || 0) > RESEARCH_SAVE_INTERVAL_MS) {
        station.lastResearchSaveAt = timeMs;
        shouldSave = true;
      }
      continue;
    }

    const owner = [...(state.players?.values?.() || [])].find((p) => (p.id | 0) === (station.ownerId | 0) && String(p.worldId || 'endless') === String(station.worldId || 'endless'));
    if (owner) {
      const research = ensurePlayerResearch(owner);
      if (!research.completed.includes(project.id)) research.completed.push(project.id);
      for (const unlock of project.unlocks || []) if (!research.unlocked.includes(unlock)) research.unlocked.push(unlock);
      owner.forceFullUiSnapshot = true;
    }
    station.researchJob = null;
    station.researchStatus = 'complete';
    station.updatedAt = timeMs;
    shouldSave ||= String(station.worldId || 'endless') === 'endless';
  }

  if (shouldSave) state.structureStore?.saveFromState?.(state);
  return shouldSave;
}
