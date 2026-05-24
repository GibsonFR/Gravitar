import { STRUCTURE_TYPES, getStructureDef } from './StructureDefs.js';
const FUEL_ENERGY_SECONDS = {
  refinedFuel: 40,
  biofuel: 26,
  propellant: 55
};

const ENERGY_SAVE_INTERVAL_MS = 5000;

function isStructureAliveLocal(structure) {
  if (!structure) return false;
  if (structure.damageable === false) return true;
  return (structure.stats?.hp ?? 0) > 0;
}

function getStructureClaimRectLocal(core) {
  const half = Math.max(1, Number(core?.claimRadius) || 0);
  return {
    left: (Number(core?.x) || 0) - half,
    right: (Number(core?.x) || 0) + half,
    top: (Number(core?.y) || 0) - half,
    bottom: (Number(core?.y) || 0) + half
  };
}

function rectOf(entity) {
  const w = Number(entity?.w) || (Number(entity?.radius) || 0) * 2;
  const h = Number(entity?.h) || (Number(entity?.radius) || 0) * 2;
  return {
    left: (Number(entity?.x) || 0) - w * 0.5,
    right: (Number(entity?.x) || 0) + w * 0.5,
    top: (Number(entity?.y) || 0) - h * 0.5,
    bottom: (Number(entity?.y) || 0) + h * 0.5
  };
}

function rectInside(inner, outer) {
  const eps = 0.001;
  return inner.left >= outer.left - eps && inner.right <= outer.right + eps && inner.top >= outer.top - eps && inner.bottom <= outer.bottom + eps;
}

function sameBaseWorld(a, b) {
  return String(a?.worldId || 'endless') === String(b?.worldId || 'endless')
    && (a?.sx | 0) === (b?.sx | 0)
    && (a?.sy | 0) === (b?.sy | 0)
    && String(a?.ownerKey || '').toLowerCase() === String(b?.ownerKey || '').toLowerCase();
}

function structuresInCore(state, core) {
  if (!state?.structures || !core) return [];
  const claim = getStructureClaimRectLocal(core);
  const out = [];
  for (const st of state.structures.values()) {
    if (!st || st.id === core.id) continue;
    if (!sameBaseWorld(st, core)) continue;
    if (rectInside(rectOf(st), claim)) out.push(st);
  }
  return out;
}

function takeFuelUnit(storage) {
  const resources = storage?.resources || {};
  for (const key of Object.keys(FUEL_ENERGY_SECONDS)) {
    const qty = resources[key] | 0;
    if (qty > 0) {
      resources[key] = qty - 1;
      if (resources[key] <= 0) delete resources[key];
      return FUEL_ENERGY_SECONDS[key] || 0;
    }
  }
  return 0;
}

function updateFuelGenerator(gen, dt) {
  const def = getStructureDef(gen?.type);
  const output = Number(def?.energyOutput ?? gen?.energyOutput) || 0;
  if (output <= 0) return { output: 0, active: false, changed: false };
  const before = Number(gen.fuelBufferSeconds) || 0;
  let buffer = Math.max(0, before);
  if (buffer <= 0.001) buffer += takeFuelUnit(gen.storage);
  const active = buffer > 0.001;
  if (active) buffer = Math.max(0, buffer - Math.max(0, Number(dt) || 0));
  gen.fuelBufferSeconds = buffer;
  gen.powered = active;
  gen.energyState = {
    output: active ? output : 0,
    kind: 'fuel',
    active,
    fuelSeconds: Math.round(buffer * 10) / 10
  };
  return { output: active ? output : 0, active, changed: Math.abs(buffer - before) > 0.0001 };
}

export function updateBaseEnergy(state, dt, timeMs = Date.now()) {
  if (!state?.structures) return false;
  let shouldSave = false;

  for (const st of state.structures.values()) {
    st.baseCoreId = 0;
    if (st.type !== STRUCTURE_TYPES.BASE_CORE) {
      st.energyState = st.energyState || null;
      if (st.type !== STRUCTURE_TYPES.FUEL_GENERATOR) st.powered = false;
    }
  }

  for (const core of state.structures.values()) {
    if (core.type !== STRUCTURE_TYPES.BASE_CORE || !isStructureAliveLocal(core)) continue;
    const children = structuresInCore(state, core);
    let production = 0;
    let consumption = 0;
    let fuelSeconds = 0;
    let solarCount = 0;
    let generatorCount = 0;

    for (const st of children) {
      st.baseCoreId = core.id | 0;
      const def = getStructureDef(st.type);
      const use = Math.max(0, Number(def?.energyUse ?? st.energyUse) || 0);
      if (use > 0) consumption += use;

      if (st.type === STRUCTURE_TYPES.SOLAR_PANEL) {
        const out = Math.max(0, Number(def?.energyOutput ?? st.energyOutput) || 0);
        production += out;
        solarCount += 1;
        st.powered = true;
        st.energyState = { output: out, kind: 'solar', active: true };
      } else if (st.type === STRUCTURE_TYPES.FUEL_GENERATOR) {
        const r = updateFuelGenerator(st, dt);
        production += r.output;
        fuelSeconds += Math.max(0, Number(st.fuelBufferSeconds) || 0);
        generatorCount += 1;
        shouldSave ||= r.changed && String(st.worldId || 'endless') === 'endless';
      }
    }

    const powered = consumption <= 0 || production >= consumption;
    for (const st of children) {
      const def = getStructureDef(st.type);
      const use = Math.max(0, Number(def?.energyUse ?? st.energyUse) || 0);
      if (use > 0) st.powered = powered;
    }
    core.energyState = {
      production: Math.round(production * 10) / 10,
      consumption: Math.round(consumption * 10) / 10,
      surplus: Math.round((production - consumption) * 10) / 10,
      powered,
      solarCount,
      generatorCount,
      fuelSeconds: Math.round(fuelSeconds * 10) / 10,
      structureCount: children.length
    };
    core.powered = powered;
  }

  if (shouldSave && timeMs - (state.lastEnergySaveAt || 0) > ENERGY_SAVE_INTERVAL_MS) {
    state.lastEnergySaveAt = timeMs;
    state.structureStore?.saveFromState?.(state);
  }
  return shouldSave;
}

export const FUEL_RESOURCE_KEYS = Object.freeze(Object.keys(FUEL_ENERGY_SECONDS));
