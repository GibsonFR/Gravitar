export function defineShipFrame(def) {
  return Object.freeze({
    id: def.id,
    name: def.name,
    role: def.role,
    difficulty: def.difficulty,
    shortName: def.shortName ?? def.name,
    stats: Object.freeze({ ...(def.stats ?? {}) }),
    levelScaling: Object.freeze({ ...(def.levelScaling ?? {}) }),
    abilities: Object.freeze({ ...(def.abilities ?? {}) })
  });
}
