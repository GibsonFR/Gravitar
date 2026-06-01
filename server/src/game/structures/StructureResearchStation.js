import { getStructureDef } from './StructureDefs.js';
import { isStructureOwner, distanceSqToStructureRect, findAliveCoreForStructure } from './StructureSystem.js';
import { addResource, removeResource, canAddResource } from '../inventory/InventorySystem.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { buildEndlessSave } from '../accounts/AccountStore.js';
import {
  SCIENCE_PACKS,
  RESEARCH_BRANCHES,
  RESEARCH_PROJECTS,
  RESEARCH_POINT_SECONDS,
  getResearchProject,
  getResearchProjectTotalCost,
  arePrerequisitesMet,
  isSciencePack
} from '../../../../shared/content/research/ScienceResearchDefs.js';

const RESEARCH_RANGE = 280;
const SCIENCE_CAPACITY = 240;
const RESEARCH_SAVE_INTERVAL_MS = 5000;
const POINT_MS = RESEARCH_POINT_SECONDS * 1000;

function saveResearchStationState(state, station) {
  if (String(station?.worldId || 'endless') !== 'endless') return;
  state?.structureStore?.saveFromState?.(state);
}

function saveResearchOwnerState(state, player) {
  if (!player?.accountKey) return;
  if (String(player.worldId || 'endless') !== 'endless') return;
  state?.accounts?.saveEndless?.(player.accountKey, buildEndlessSave(player));
}

export function ensurePlayerResearch(player) {
  if (!player.research || typeof player.research !== 'object') player.research = { completed: [], unlocked: [] };
  if (!Array.isArray(player.research.completed)) player.research.completed = [];
  if (!Array.isArray(player.research.unlocked)) player.research.unlocked = [];
  player.research.completed = player.research.completed.map((v) => String(v || '')).filter((v, i, a) => v && a.indexOf(v) === i);
  player.research.unlocked = player.research.unlocked.map((v) => String(v || '')).filter((v, i, a) => v && a.indexOf(v) === i);
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

function cargoScienceList(player) {
  const resources = player?.inv?.resources || {};
  return Object.entries(resources)
    .filter(([key, amount]) => isSciencePack(key) && (amount | 0) > 0)
    .map(([key, amount]) => resourceEntry(key, amount));
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

function unlockList(project) {
  return [
    ...(Array.isArray(project?.unlockBuildings) ? project.unlockBuildings : []),
    ...(Array.isArray(project?.unlockRecipes) ? project.unlockRecipes : [])
  ];
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
    locked: !completed && !available,
    totalCost: getResearchProjectTotalCost(project)
  };
}

function ensureResearchJobShape(station, project) {
  const job = station?.researchJob || null;
  if (!job || !project) return job;
  if (Number.isFinite(job.pointsTotal) && Number.isFinite(job.pointsDone) && Number.isFinite(job.pointRemainingMs)) {
    if (!Number.isFinite(job.pointMs) || (job.pointMs | 0) <= 0) job.pointMs = POINT_MS;
    if (typeof job.pointLoaded !== 'boolean') job.pointLoaded = true;
    return job;
  }
  const oldTotal = Math.max(1000, Number(job.totalMs || 0) || POINT_MS);
  const oldRemaining = Math.max(0, Number(job.remainingMs || oldTotal) || 0);
  const totalPoints = Math.max(1, Number(project.points || 1) || 1);
  const ratio = Math.max(0, Math.min(1, 1 - oldRemaining / oldTotal));
  const exactPoints = ratio * totalPoints;
  const pointsDone = Math.max(0, Math.min(totalPoints - 1, Math.floor(exactPoints)));
  const partial = Math.max(0, exactPoints - pointsDone);
  station.researchJob = {
    projectId: job.projectId,
    startedAt: job.startedAt || Date.now(),
    pointsTotal: totalPoints,
    pointsDone,
    pointMs: POINT_MS,
    pointRemainingMs: partial > 0 ? Math.max(1, Math.round((1 - partial) * POINT_MS)) : POINT_MS,
    pointLoaded: partial > 0,
    paused: !!job.paused
  };
  return station.researchJob;
}

function progressOf(station) {
  const job = station?.researchJob || null;
  if (!job?.projectId) return 0;
  const project = getResearchProject(job.projectId);
  const normalized = ensureResearchJobShape(station, project) || job;
  const totalPoints = Math.max(1, Number(normalized.pointsTotal || project?.points || 1) || 1);
  const done = Math.max(0, Number(normalized.pointsDone || 0) || 0);
  const pointMs = Math.max(1, Number(normalized.pointMs || POINT_MS) || POINT_MS);
  const inPoint = normalized.pointLoaded ? Math.max(0, Math.min(1, 1 - (Math.max(0, Number(normalized.pointRemainingMs || pointMs) || pointMs) / pointMs))) : 0;
  return Math.max(0, Math.min(1, (done + inPoint) / totalPoints));
}

function pointProgress(job, project) {
  const normalized = ensureResearchJobShape({ researchJob: job }, project) || job;
  const pointMs = Math.max(1, Number(normalized.pointMs || POINT_MS) || POINT_MS);
  return normalized.pointLoaded ? Math.max(0, Math.min(1, 1 - (Math.max(0, Number(normalized.pointRemainingMs || pointMs) || pointMs) / pointMs))) : 0;
}

export function canPlayerAccessResearchStation(state, player, station) {
  return stationAccess(state, player, station);
}

export function getResearchActiveEnergyUse(station) {
  if (!isResearchStation(station)) return 0;
  if (station.researchEnabled === false) return 0;
  const job = station.researchJob || null;
  if (!job?.projectId) return 0;
  const project = getResearchProject(job.projectId);
  return Math.max(0, Number(project?.energyUse ?? getStructureDef(station.type)?.energyUse) || 0);
}

function ownedResearchStations(state, player) {
  const arr = [];
  if (!state?.structures || !player) return arr;
  for (const st of state.structures.values()) {
    if (!isResearchStation(st)) continue;
    if (!isStructureOwner(player, st)) continue;
    arr.push(st);
  }
  return arr;
}

function aggregateScience(stations = []) {
  const out = {};
  for (const st of stations) {
    const input = scienceInput(st);
    for (const [key, amount] of Object.entries(input || {})) {
      if ((amount | 0) > 0) out[key] = (out[key] | 0) + (amount | 0);
    }
  }
  return out;
}

function aggregateActiveJobs(stations = []) {
  return stations
    .map((st) => {
      const job = st.researchJob || null;
      const project = job?.projectId ? getResearchProject(job.projectId) : null;
      if (!job || !project) return null;
      const normalized = ensureResearchJobShape(st, project) || job;
      return {
        stationId: st.id | 0,
        projectId: project.id,
        name: project.name,
        progress: progressOf(st),
        powered: !!st.powered,
        paused: !!normalized.paused,
        status: st.researchStatus || '',
        pointsDone: normalized.pointsDone | 0,
        pointsTotal: normalized.pointsTotal | 0,
        pointProgress: pointProgress(normalized, project),
        pointSeconds: RESEARCH_POINT_SECONDS
      };
    })
    .filter(Boolean);
}

function canPayPointFromStation(station, project) {
  if (!station || !project) return false;
  return mapHas(scienceInput(station), project.pointCost || {});
}

function canStartOnStation(state, player, station, project) {
  if (!station || !project) return false;
  if (!stationAccess(state, player, station)) return false;
  if (station.researchEnabled === false) return false;
  if (station.researchJob?.projectId) return false;
  return canPayPointFromStation(station, project);
}

function chooseStationForProject(state, player, project) {
  const stations = ownedResearchStations(state, player)
    .filter((st) => st.researchEnabled !== false)
    .sort((a, b) => {
      const ap = a.powered ? 0 : 1;
      const bp = b.powered ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return (a.id | 0) - (b.id | 0);
    });
  return stations.find((st) => canStartOnStation(state, player, st, project)) || null;
}

export function buildResearchOverviewSnapshot(state, player) {
  const research = ensurePlayerResearch(player);
  const stations = ownedResearchStations(state, player);
  const science = aggregateScience(stations);
  const active = aggregateActiveJobs(stations);
  return {
    completed: research.completed.slice(),
    unlocked: research.unlocked.slice(),
    stationCount: stations.length,
    poweredStations: stations.filter((s) => !!s.powered && s.researchEnabled !== false).length,
    science: resourceList(science),
    active,
    branches: RESEARCH_BRANCHES,
    packs: SCIENCE_PACKS,
    pointSeconds: RESEARCH_POINT_SECONDS,
    projects: RESEARCH_PROJECTS.map((p) => {
      const snap = projectSnapshot(p, player);
      const station = chooseStationForProject(state, player, p);
      return {
        ...snap,
        canStart: !!station && !snap.completed && !snap.locked && active.length === 0,
        targetStationId: station?.id | 0 || 0
      };
    })
  };
}

export function startResearchProjectGlobal(state, player, projectId, timeMs = Date.now()) {
  const project = getResearchProject(projectId);
  if (!project) return { ok: false, error: 'unknown_project' };
  const research = ensurePlayerResearch(player);
  if (research.completed.includes(project.id)) return { ok: false, error: 'completed' };
  if (!projectAvailable(project, player)) return { ok: false, error: 'locked' };
  if (aggregateActiveJobs(ownedResearchStations(state, player)).length > 0) return { ok: false, error: 'busy' };
  const station = chooseStationForProject(state, player, project);
  if (!station) return { ok: false, error: 'science' };
  return startResearchProject(state, player, station.id | 0, project.id, timeMs);
}

export function cancelResearchProjectGlobal(state, player, timeMs = Date.now()) {
  const stations = ownedResearchStations(state, player);
  let changed = false;
  for (const st of stations) {
    if (!st.researchJob?.projectId) continue;
    st.researchJob = null;
    st.researchStatus = 'cancelled';
    st.updatedAt = timeMs;
    changed = true;
  }
  if (changed) {
    player.forceFullUiSnapshot = true;
    state?.structureStore?.saveFromState?.(state);
  }
  return { ok: changed };
}

export function buildResearchStationSnapshot(state, player) {
  if (!player?.openResearchStationId) return null;
  const station = state?.structures?.get?.(player.openResearchStationId | 0);
  if (!stationAccess(state, player, station)) return null;
  const def = getStructureDef(station.type);
  const research = ensurePlayerResearch(player);
  const job = station.researchJob || null;
  const activeProject = job?.projectId ? getResearchProject(job.projectId) : null;
  const normalizedJob = activeProject ? ensureResearchJobShape(station, activeProject) : null;
  const core = findAliveCoreForStructure(state, station);
  const activeGlobal = aggregateActiveJobs(ownedResearchStations(state, player));
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
    paused: !!normalizedJob?.paused,
    pointsDone: normalizedJob?.pointsDone | 0,
    pointsTotal: normalizedJob?.pointsTotal | 0,
    pointProgress: activeProject ? pointProgress(normalizedJob, activeProject) : 0,
    pointSeconds: RESEARCH_POINT_SECONDS,
    scienceInput: resourceList(scienceInput(station)),
    cargoScience: cargoScienceList(player),
    inputUsed: usedCapacity(scienceInput(station)),
    inputCapacity: SCIENCE_CAPACITY,
    packs: SCIENCE_PACKS,
    branches: RESEARCH_BRANCHES,
    completed: research.completed.slice(),
    unlocked: research.unlocked.slice(),
    projects: RESEARCH_PROJECTS.map((p) => {
      const snap = projectSnapshot(p, player);
      return {
        ...snap,
        canStart: !snap.completed && !snap.locked && activeGlobal.length === 0 && canStartOnStation(state, player, station, p),
        totalCost: getResearchProjectTotalCost(p)
      };
    })
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
  saveResearchStationState(state, station);
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
  if (aggregateActiveJobs(ownedResearchStations(state, player)).length > 0) return { ok: false, error: 'busy' };
  if (station.researchJob?.projectId) return { ok: false, error: 'busy' };
  const input = scienceInput(station);
  if (!mapHas(input, project.pointCost || {})) return { ok: false, error: 'science' };
  station.researchJob = {
    projectId: project.id,
    startedAt: timeMs,
    pointsTotal: Math.max(1, Number(project.points || 1) || 1),
    pointsDone: 0,
    pointMs: POINT_MS,
    pointRemainingMs: POINT_MS,
    pointLoaded: false,
    paused: false
  };
  station.researchStatus = '';
  station.researchEnabled = true;
  station.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  saveResearchStationState(state, station);
  return { ok: true };
}

export function toggleResearchStation(state, player, stationId, enabled = true, timeMs = Date.now()) {
  const station = state?.structures?.get?.(stationId | 0);
  if (!stationAccess(state, player, station)) return { ok: false, error: 'access' };
  station.researchEnabled = !!enabled;
  station.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  saveResearchStationState(state, station);
  return { ok: true };
}

export function updateResearchStations(state, timeMs, dtMs) {
  if (!state?.structures) return false;
  let shouldSave = false;
  const stepMs = Math.max(0, Number(dtMs) || 0);

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
      shouldSave ||= String(station.worldId || 'endless') === 'endless';
      continue;
    }

    const normalized = ensureResearchJobShape(station, project) || job;

    if (station.researchEnabled === false) {
      normalized.paused = true;
      station.researchStatus = 'off';
      continue;
    }
    if (!station.powered) {
      normalized.paused = true;
      station.researchStatus = 'no_power';
      continue;
    }

    if (!normalized.pointLoaded) {
      if (!consume(scienceInput(station), project.pointCost || {})) {
        normalized.paused = true;
        station.researchStatus = 'science';
        continue;
      }
      normalized.pointLoaded = true;
      normalized.pointRemainingMs = Math.max(1, Number(normalized.pointMs || POINT_MS) || POINT_MS);
    }

    normalized.paused = false;
    normalized.pointRemainingMs = Math.max(0, Number(normalized.pointRemainingMs || normalized.pointMs || POINT_MS) - stepMs);
    station.researchStatus = '';
    station.updatedAt = timeMs;

    if (normalized.pointRemainingMs > 0) {
      if (String(station.worldId || 'endless') === 'endless' && timeMs - (station.lastResearchSaveAt || 0) > RESEARCH_SAVE_INTERVAL_MS) {
        station.lastResearchSaveAt = timeMs;
        shouldSave = true;
      }
      continue;
    }

    normalized.pointsDone = Math.max(0, (normalized.pointsDone | 0) + 1);
    normalized.pointLoaded = false;
    normalized.pointRemainingMs = Math.max(1, Number(normalized.pointMs || POINT_MS) || POINT_MS);

    if (normalized.pointsDone < Math.max(1, Number(normalized.pointsTotal || project.points || 1) || 1)) {
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
      for (const unlock of unlockList(project)) if (!research.unlocked.includes(unlock)) research.unlocked.push(unlock);
      owner.forceFullUiSnapshot = true;
      saveResearchOwnerState(state, owner);
    }
    station.researchJob = null;
    station.researchStatus = 'complete';
    station.updatedAt = timeMs;
    shouldSave ||= String(station.worldId || 'endless') === 'endless';
  }

  if (shouldSave) state.structureStore?.saveFromState?.(state);
  return shouldSave;
}
