function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scaledColor(color, factor) {
  return {
    r: clamp(Math.round(color.r * factor), 0, 255),
    g: clamp(Math.round(color.g * factor), 0, 255),
    b: clamp(Math.round(color.b * factor), 0, 255)
  };
}

export function rollMobElite(rng, mapLevel, def) {
  if (!rng) return false;
  const baseChance = 0.025 + Math.max(0, mapLevel - (def.sectorMinLevel ?? 1)) * 0.012;
  return rng.nextDouble() < clamp(baseChance, 0.025, 0.17);
}

export function buildScaledMobProps(def, mapLevel = 1, elite = false, mutated = false) {
  const levelDelta = Math.max(0, (mapLevel | 0) - (def.sectorMinLevel ?? 1));
  const tierScale = 1 + Math.min(0.55, levelDelta * 0.055);
  const mutationScale = mutated ? 1.14 : 1;
  const eliteScale = elite ? (def.eliteScale ?? 1.2) : 1;
  const scale = tierScale * mutationScale * eliteScale;
  const eliteBoost = elite ? 1.08 : 1;

  return {
    typeId: def.typeId ?? 0,
    role: def.role ?? '',
    variantFamily: def.variantFamily ?? '',
    shortName: def.shortName ?? def.name,
    kit: def.kit ?? '',
    abilities: def.abilities ?? [],
    abilityProfile: def.abilityProfile ?? '',
    onHit: def.onHit ?? null,
    maxHp: Math.round(def.maxHp * scale * eliteBoost),
    moveSpeed: def.moveSpeed * (elite ? 1.04 : 1) * (mutated ? 1.03 : 1),
    aggroRange: def.aggroRange + levelDelta * 12 + (elite ? 26 : 0) + (mutated ? 18 : 0),
    leashRange: def.leashRange + levelDelta * 16 + (elite ? 30 : 0) + (mutated ? 22 : 0),
    attackRange: def.attackRange + (elite ? 10 : 0) + (mutated ? 4 : 0),
    preferredRange: (def.preferredRange ?? def.attackRange) + (elite ? 12 : 0) + (mutated ? 4 : 0),
    retreatRange: (def.retreatRange ?? Math.max(36, def.attackRange * 0.45)) + (elite ? 6 : 0),
    // V92: les mobs mêlée ne doivent pas fondre le joueur en contact.
    // On garde les patterns dangereux, mais avec une cadence lisible.
    attackCooldownMs: Math.max(
      def.behaviorId === 'rusher' ? 1650 : 980,
      Math.round(def.attackCooldownMs * (elite ? 1.04 : 1) * (mutated ? 1.02 : 1) * Math.max(0.98, 1 - levelDelta * 0.002))
    ),
    attackDamage: def.attackDamage * scale * (def.behaviorId === 'rusher' ? 0.72 : 0.88),
    xpReward: Math.round(def.xpReward * (elite ? 2.1 : 1) * (1 + levelDelta * 0.09)),
    contactPush: def.contactPush * (elite ? 1.08 : 1),
    projectileSpeed: Math.round((def.projectileSpeed ?? 0) * (1 + Math.min(0.12, levelDelta * 0.012))),
    projectileRange: Math.round((def.projectileRange ?? 0) * (1 + Math.min(0.2, levelDelta * 0.025))),
    projectileRadius: (def.projectileRadius ?? 0) + (elite ? 1 : 0) + (mutated ? 0.5 : 0),
    projectileSplashRadius: (def.projectileSplashRadius ?? 0) + (elite ? 4 : 0) + (mutated ? 2 : 0),
    color: elite ? scaledColor(def.color, 1.16) : (mutated ? scaledColor(def.color, 1.08) : def.color),
    radius: def.radius + (elite ? 3 : 0) + (mutated ? 1 : 0),
    dropMin: def.dropMin + (elite ? 1 : 0) + (mutated ? 1 : 0),
    dropMax: def.dropMax + (elite ? 1 : 0) + (mutated ? 1 : 0),
    threat: Math.max(1, (def.threat ?? 1) + (elite ? 1 : 0) + (mutated ? 1 : 0) + Math.floor(levelDelta / 4)),
    elite,
    mutated
  };
}
