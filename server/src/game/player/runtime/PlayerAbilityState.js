export function createPlayerAbilityState(frameRuntime) {
  return {
    abilityA: false,
    abilityZ: false,
    abilityE: false,
    abilityR: false,
    prevAbilityA: false,
    prevAbilityZ: false,
    prevAbilityE: false,
    prevAbilityR: false,
    cooldownALeft: 0,
    cooldownZLeft: 0,
    cooldownELeft: 0,
    cooldownRLeft: 0,
    abilityCatalog: { ...frameRuntime.abilityCatalog }
  };
}
