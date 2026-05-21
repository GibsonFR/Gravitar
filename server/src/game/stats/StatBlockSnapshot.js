export function buildStatBlockSnapshot(stats) {
  if (!stats) return null;
  return {
    hp: stats.hp,
    maxHp: stats.maxHp,
    shield: stats.shield,
    maxShield: stats.maxShield,
    energy: stats.energy,
    maxEnergy: stats.maxEnergy
  };
}
