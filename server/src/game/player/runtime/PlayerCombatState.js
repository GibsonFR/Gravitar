export function createPlayerCombatState() {
  return {
    nextShotAt: 0,
    rocketCooldownLeft: 0,
    lastHitAt: 0,
    kills: 0,
    deaths: 0
  };
}
