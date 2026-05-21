export function createVanguardFrameState() {
  return {
    passiveStacks: 0,
    passiveLastGainAtMs: 0,
    passiveDecayCarry: 0,
    empoweredCharges: 0,
    empowerPct: 0,
    empowerFlat: 0,
    moveBoostLeft: 0,
    comboWindowLeft: 0,
    ultLeft: 0,
    ultBonusDurationGained: 0,
    phaseLeft: 0,
    phaseStartedAtMaxHeat: false,
    trailLeft: 0,
    trailStartX: 0,
    trailStartY: 0,
    trailEndX: 0,
    trailEndY: 0,
    trailSlowPct: 0,
    trailSlowDuration: 0
  };
}
