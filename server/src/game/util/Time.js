export function nowMs() {
  return Date.now();
}

export function createSimulationClock(now = nowMs()) {
  return {
    startedAtMs: now,
    currentMs: now,
    tick: 0,
    fixedStepMs: 0
  };
}

export function setSimulationTime(state, timeMs, fixedStepMs = null) {
  if (!state) return nowMs();
  if (!state.time) state.time = createSimulationClock(timeMs);
  state.time.currentMs = Number.isFinite(timeMs) ? Math.max(0, Math.floor(timeMs)) : nowMs();
  if (Number.isFinite(fixedStepMs) && fixedStepMs >= 0) state.time.fixedStepMs = fixedStepMs;
  return state.time.currentMs;
}

export function advanceSimulationTick(state, timeMs, fixedStepMs = null) {
  const current = setSimulationTime(state, timeMs, fixedStepMs);
  if (state?.time) state.time.tick = (state.time.tick | 0) + 1;
  return current;
}

export function getSimulationTimeMs(state, fallback = null) {
  if (Number.isFinite(state?.time?.currentMs)) return state.time.currentMs;
  return Number.isFinite(fallback) ? Math.floor(fallback) : nowMs();
}

export function getSimulationTick(state) {
  return state?.time?.tick | 0;
}
