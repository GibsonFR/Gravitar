function finite(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function distSqToPlayer(me, entity) {
  if (!me || !entity) return Number.POSITIVE_INFINITY;
  const dx = finite(entity.x) - finite(me.x);
  const dy = finite(entity.y) - finite(me.y);
  return dx * dx + dy * dy;
}

function isDamaged(entity) {
  const hp = finite(entity?.stats?.hp ?? entity?.vitals?.hp, 0);
  const maxHp = finite(entity?.stats?.maxHp ?? entity?.vitals?.maxHp, 0);
  return maxHp > 0 && hp > 0 && hp < maxHp;
}

function isActiveAutomation(entity) {
  return !!(
    entity?.automationPulse ||
    entity?.depositRemaining > 0 ||
    entity?.automationStatus ||
    entity?.activeTask ||
    entity?.crafting ||
    entity?.machineWorking
  );
}

function scoreEntity(me, entity, kind = '') {
  const d2 = distSqToPlayer(me, entity);
  let score = -d2;
  const selectedId = me?.selectedId | 0;
  const selectedKind = String(me?.selectedKind || '').toLowerCase();
  const attackId = me?.autoTargetId | 0;
  if (selectedId && selectedId === (entity?.id | 0)) score += 9000000;
  if (attackId && attackId === (entity?.id | 0)) score += 8000000;
  if (selectedKind && kind && selectedKind === kind && selectedId === (entity?.id | 0)) score += 5000000;
  if (isDamaged(entity)) score += 2000000;
  if (entity?.specialCueLeft > 0) score += 1200000;
  if (entity?.threat > 1) score += finite(entity.threat) * 250000;
  if (entity?.elite || entity?.mutated) score += 350000;
  if (entity?.kind === 'structure' || kind === 'structure') {
    if (isActiveAutomation(entity)) score += 450000;
    if (entity?.open) score += 300000;
    if (entity?.damageable !== false && isDamaged(entity)) score += 600000;
  }
  if (kind === 'loot') score += 150000;
  return score;
}

export function buildPriorityIdSet(collection, basePredicate, me, options = {}) {
  const limit = Math.max(0, options.limit | 0);
  if (!limit) return null;
  const kind = String(options.kind || '');
  const arr = [...(collection?.values?.() || [])]
    .filter(basePredicate)
    .map((entity) => ({ id: entity.id | 0, score: scoreEntity(me, entity, kind) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return new Set(arr.map((entry) => entry.id));
}

export function makePriorityPredicate(basePredicate, idSet) {
  if (!idSet) return basePredicate;
  return (entity) => basePredicate(entity) && idSet.has(entity.id | 0);
}

export function buildSnapshotPriorityPlan(state, me, basePredicates, options = {}) {
  const staticWorld = !!options.staticWorld;
  const enabled = !staticWorld && !!me;
  if (!enabled) {
    return {
      enabled: false,
      partialSections: [],
      predicates: {
        mobs: basePredicates.nearDynamic,
        asteroids: basePredicates.nearStatic,
        structures: basePredicates.nearDynamic,
        structureAutomation: basePredicates.nearDynamic,
        loots: basePredicates.nearDynamic,
        logisticDrones: basePredicates.nearDynamic
      },
      limits: {}
    };
  }

  const limits = {
    mobs: 34,
    asteroids: 52,
    structures: 56,
    structureAutomation: 48,
    loots: 42,
    logisticDrones: 28
  };

  const sets = {
    mobs: buildPriorityIdSet(state.mobs, basePredicates.nearDynamic, me, { limit: limits.mobs, kind: 'mob' }),
    asteroids: buildPriorityIdSet(state.asteroids, basePredicates.nearStatic, me, { limit: limits.asteroids, kind: 'asteroid' }),
    structures: buildPriorityIdSet(state.structures, basePredicates.nearDynamic, me, { limit: limits.structures, kind: 'structure' }),
    structureAutomation: buildPriorityIdSet(state.structures, basePredicates.nearDynamic, me, { limit: limits.structureAutomation, kind: 'structure' }),
    loots: buildPriorityIdSet(state.loots, basePredicates.nearDynamic, me, { limit: limits.loots, kind: 'loot' }),
    logisticDrones: buildPriorityIdSet(state.logisticDrones, basePredicates.nearDynamic, me, { limit: limits.logisticDrones, kind: 'logisticDrone' })
  };

  return {
    enabled: true,
    partialSections: ['mobs', 'asteroids', 'structures', 'structureAutomation', 'loots', 'logisticDrones'],
    limits,
    predicates: {
      mobs: makePriorityPredicate(basePredicates.nearDynamic, sets.mobs),
      asteroids: makePriorityPredicate(basePredicates.nearStatic, sets.asteroids),
      structures: makePriorityPredicate(basePredicates.nearDynamic, sets.structures),
      structureAutomation: makePriorityPredicate(basePredicates.nearDynamic, sets.structureAutomation),
      loots: makePriorityPredicate(basePredicates.nearDynamic, sets.loots),
      logisticDrones: makePriorityPredicate(basePredicates.nearDynamic, sets.logisticDrones)
    }
  };
}
