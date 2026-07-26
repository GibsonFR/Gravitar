import { newEntityId } from '../state/GameState.js';
import { createStatBlock } from '../stats/StatBlockFactory.js';
import { FACTIONS } from '../constants.js';
import { getMobDef } from '../../../../shared/content/mobs/MobDefs.js';
import { buildScaledMobProps } from './MobScaling.js';

export function spawnMob(state, sx, sy, mobId, x, y, options = {}) {
  const def = getMobDef(mobId);
  if (!def) throw new Error(`unknown mob def: ${mobId}`);

  const scaled = buildScaledMobProps(def, options.mapLevel ?? 1, !!options.elite, !!options.mutated);
  const id = newEntityId(state);
  const mob = {
    kind: 'mob',
    id,
    mobId: def.id,
    typeId: scaled.typeId,
    faction: FACTIONS.MOB,
    sx: sx | 0,
    sy: sy | 0,
    x,
    y,
    vx: 0,
    vy: 0,
    rot: 0,
    radius: scaled.radius,
    name: scaled.elite ? `Elite ${def.name}` : (scaled.mutated ? `Muté ${def.name}` : def.name),
    shortName: scaled.shortName,
    role: scaled.role,
    variantFamily: scaled.variantFamily,
    kit: scaled.kit,
    abilities: scaled.abilities,
    color: scaled.color,
    elite: scaled.elite,
    mutated: scaled.mutated,
    behaviorId: def.behaviorId,
    threat: scaled.threat,
    stats: createStatBlock({ maxHp: scaled.maxHp }),
    moveSpeed: scaled.moveSpeed,
    aggroRange: scaled.aggroRange,
    leashRange: scaled.leashRange,
    attackRange: scaled.attackRange,
    preferredRange: scaled.preferredRange,
    retreatRange: scaled.retreatRange,
    attackCooldownMs: scaled.attackCooldownMs,
    attackDamage: scaled.attackDamage,
    xpReward: scaled.xpReward,
    contactPush: scaled.contactPush,
    projectileTint: def.projectileTint ?? def.color,
    projectileRadius: scaled.projectileRadius,
    projectileSpeed: scaled.projectileSpeed,
    projectileRange: scaled.projectileRange,
    projectileSplashRadius: scaled.projectileSplashRadius,
    onHitStatuses: scaled.onHit,
    abilityProfile: scaled.abilityProfile,
    abilityCycle: 0,
    nextSpecialAt: Math.max(0, options.spawnTimeMs ?? 0) + 1600 + Math.abs((options.seed || id) % 4200),
    specialCue: '',
    specialCueLeft: 0,
    demoMob: !!options.demoMob,
    summonGeneration: options.summonGeneration | 0,
    summonKind: options.summonKind || '',
    summonOwnerId: options.summonOwnerId || 0,
    summonExpireAt: options.summonExpireAt || 0,
    noLoot: !!options.noLoot,
    dropResource: def.dropResource,
    dropMin: scaled.dropMin,
    dropMax: scaled.dropMax,
    dropTable: Array.isArray(def.dropTable) ? def.dropTable.map((row) => ({ ...row })) : null,
    homeX: x,
    homeY: y,
    targetPlayerId: 0,
    baseRaidCoreId: options.baseRaidCoreId | 0 || 0,
    baseRaidTargetId: options.baseRaidTargetId | 0 || 0,
    nextAttackAt: Math.max(0, options.spawnTimeMs ?? 0) + 900 + Math.abs(((options.seed || id) * 31) % 2600),
    deadAt: 0,
    despawnAt: 0,
    diedAt: 0,
    killedById: 0,
    seed: options.seed | 0,
    mapLevel: options.mapLevel | 0,
    demoTargetId: options.demoTargetId || 0,
    demoTargetKind: options.demoTargetKind || '',
    demoCageX: options.demoCageX ?? undefined,
    demoCageY: options.demoCageY ?? undefined,
    demoCageRadius: options.demoCageRadius || 0,
    demoVariantLabel: options.demoVariantLabel || ''
  };

  state.mobs.set(id, mob);
  return mob;
}
