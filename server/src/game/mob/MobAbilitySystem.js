import { STATUS_EFFECT_IDS as I } from '../../../../shared/content/status/StatusEffectIds.js';
import { applyStatus } from '../status/StatusRack.js';
import { applyDamage } from '../combat/DamageSystem.js';
import { spawnProjectile } from '../projectile/ProjectileSystem.js';
import { distSq, norm } from '../util/Math.js';
import { queueWorldSfx } from '../audio/WorldSfxState.js';
import { spawnMob } from './MobFactory.js';
import { MOB_IDS } from '../../../../shared/content/mobs/MobDefs.js';
import { SFX_EVENT_TYPES } from '../audio/SfxEventTypes.js';

function status(effectId, duration, value = undefined, extras = {}) {
  return { effectId, duration, value, hostile: true, ...extras };
}

function applyMobStatus(state, mob, target, effectId, duration, value = undefined, extras = {}) {
  return applyStatus(target, effectId, duration, {
    timeMs: state.nowMs ?? Date.now(),
    sourceId: mob.id,
    hostile: true,
    value,
    ...extras
  });
}


const SUMMON_PROFILE_FALLBACK = {
  mite: MOB_IDS.FERROUS_MITE,
  scoria: MOB_IDS.SCORIA_SAPPER,
  stinger: MOB_IDS.ORBITAL_STINGER,
  lancer: MOB_IDS.PRISMATIC_LANCER,
  nodule: MOB_IDS.SENTINEL_NODULE,
  crusher: MOB_IDS.PLASMA_CRUSHER,
  warden: MOB_IDS.ARC_WARDEN,
  specter: MOB_IDS.VECTOR_SPECTER,
  hydra: MOB_IDS.SHRAPNEL_HYDRA,
  apex: MOB_IDS.APEX_PREDATOR
};

function countSummons(state, mob, kind, radius = 460) {
  const rr = radius * radius;
  let count = 0;
  for (const other of state.mobs.values()) {
    if (!other || other.stats?.hp <= 0 || other.id === mob.id) continue;
    if (other.sx !== mob.sx || other.sy !== mob.sy) continue;
    if ((other.summonOwnerId | 0) !== (mob.id | 0)) continue;
    if (kind && other.summonKind !== kind) continue;
    if (distSq(other.x, other.y, mob.x, mob.y) <= rr) count++;
  }
  return count;
}

function sanitizeSummon(mob, scale = 0.35) {
  mob.summonGeneration = (mob.summonGeneration | 0) || 1;
  mob.stats.maxHp = Math.max(12, Math.round((mob.stats.maxHp || 40) * scale));
  mob.stats.hp = mob.stats.maxHp;
  mob.stats.shield = Math.min(mob.stats.shield || 0, Math.round((mob.stats.maxShield || 0) * 0.35));
  mob.attackDamage *= 0.68;
  mob.xpReward = Math.max(1, Math.round((mob.xpReward || 1) * 0.25));
  mob.dropMin = 0;
  mob.dropMax = 0;
  mob.noLoot = true;
  mob.attackCooldownMs = Math.round((mob.attackCooldownMs || 1200) * 1.45);
  // évite les invocations récursives infinies comme dans la version originale.
  if (mob.abilityProfile === 'stinger') mob.abilityProfile = 'stinger_image';
  if (mob.abilityProfile === 'specter') mob.abilityProfile = 'specter_image';
  if (mob.abilityProfile === 'hydra') mob.abilityProfile = 'hydra_child';
}

function spawnMobSummon(state, owner, mobId, kind, angle, distance, scale, timeMs, labelSuffix = '') {
  const x = owner.x + Math.cos(angle) * distance;
  const y = owner.y + Math.sin(angle) * distance;
  const summon = spawnMob(state, owner.sx, owner.sy, mobId, x, y, {
    mapLevel: Math.max(1, owner.mapLevel || owner.threat || 1),
    mutated: false,
    elite: false,
    seed: ((owner.seed || owner.id) * 131 + Math.round(angle * 1000)) | 0,
    spawnTimeMs: timeMs,
    demoMob: !!owner.demoMob,
    demoTargetId: owner.demoTargetId || 0,
    demoTargetKind: owner.demoTargetKind || '',
    demoCageX: owner.demoCageX ?? owner.x,
    demoCageY: owner.demoCageY ?? owner.y,
    demoCageRadius: owner.demoCageRadius || 0,
    demoVariantLabel: labelSuffix,
    summonGeneration: (owner.summonGeneration | 0) + 1,
    summonKind: kind,
    summonOwnerId: owner.id,
    summonExpireAt: timeMs + (owner.demoMob ? 16000 : 22000)
  });
  sanitizeSummon(summon, scale);
  if (labelSuffix) summon.name = `${summon.name} ${labelSuffix}`;
  summon.specialCue = kind;
  summon.specialCueLeft = 1.2;
  return summon;
}

function spawnMirrorImages(state, mob, target, timeMs, kind, count, mobId, label) {
  const cap = mob.demoMob ? 2 : (mob.elite || mob.mutated ? 3 : 2);
  if (countSummons(state, mob, kind, 420) >= cap) return false;
  const base = Math.atan2((target?.y ?? mob.y) - mob.y, (target?.x ?? mob.x) - mob.x);
  for (let i = 0; i < count; i++) {
    const sign = i % 2 === 0 ? -1 : 1;
    const angle = base + sign * (0.95 + 0.2 * i);
    spawnMobSummon(state, mob, mobId, kind, angle, 42 + i * 8, 0.28, timeMs, label);
  }
  applyStatus(mob, I.UNTARGETABLE, 0.22, { timeMs, sourceId: mob.id });
  applyStatus(mob, I.CAMOUFLAGE, 1.35, { timeMs, sourceId: mob.id });
  mob.x += Math.cos(base + Math.PI / 2) * 65;
  mob.y += Math.sin(base + Math.PI / 2) * 65;
  return true;
}

function spawnBrood(state, mob, target, timeMs, kind, count, mobId, scale = 0.38) {
  const cap = mob.demoMob ? 2 : (mob.elite || mob.mutated ? 5 : 2);
  if (countSummons(state, mob, kind, 480) >= cap) return false;
  const base = Math.atan2((target?.y ?? mob.y) - mob.y, (target?.x ?? mob.x) - mob.x);
  const n = Math.min(count, cap - countSummons(state, mob, kind, 480));
  for (let i = 0; i < n; i++) {
    const angle = base + (i - (n - 1) / 2) * 0.75 + Math.PI;
    spawnMobSummon(state, mob, mobId, kind, angle, 44 + i * 12, scale, timeMs, 'progéniture');
  }
  mob.stats.shield = Math.min(mob.stats.maxShield || 80, (mob.stats.shield || 0) + 10 + Math.max(1, mob.threat || 1) * 2);
  return n > 0;
}

function areaAround(state, mob, radius, fn) {
  const rr = radius * radius;
  if (mob.demoMob) {
    const target = mob.demoTargetKind === 'asteroid' ? state.asteroids.get(mob.demoTargetId) : state.mobs.get(mob.demoTargetId);
    if (target && target.stats?.hp > 0 && distSq(mob.x, mob.y, target.x, target.y) <= rr) fn(target);
    return;
  }
  for (const p of state.players.values()) {
    if ((p.sx | 0) !== (mob.sx | 0) || (p.sy | 0) !== (mob.sy | 0)) continue;
    if (distSq(mob.x, mob.y, p.x, p.y) <= rr) fn(p);
  }
}

export function getMobOnHitStatuses(mob) {
  const rank = Math.max(1, mob.mapLevel || mob.threat || 1);
  const base = Array.isArray(mob.onHitStatuses) ? [...mob.onHitStatuses] : [];
  switch (mob.abilityProfile) {
    case 'mite':
      if ((mob.abilityCycle | 0) % 3 === 0) base.push(status(I.SLOW, 1.1, 0.24), status(I.GROUNDED, 0.75));
      break;
    case 'scoria':
      base.push(status(I.BURN, 3, undefined, { periodicDamage: 2.8 + rank * 0.18, tickEvery: 1 }), status(I.HEAL_CUT, 2.2, 0.28));
      break;
    case 'stinger':
      if ((mob.abilityCycle | 0) % 2 === 0) base.push(status(I.BLIND, 1.1), status(I.DAMAGE_AMP, 2.4, 0.15));
      break;
    case 'lancer':
      base.push(status(I.REVEAL, 3.2), status(I.DAMAGE_AMP, 2.1, 0.18));
      break;
    case 'nodule':
      base.push(status(I.GROUNDED, 1.1));
      break;
    case 'crusher':
      if ((mob.abilityCycle | 0) % 2 === 0) base.push(status(I.STUN, 0.32), status(I.GROUNDED, 0.8));
      break;
    case 'warden':
      base.push(status(I.GROUNDED, 0.65));
      if ((mob.abilityCycle | 0) % 3 === 0) base.push(status(I.STUN, 0.24));
      break;
    case 'specter':
      if ((mob.abilityCycle | 0) % 2 === 0) base.push(status(I.FEAR, 0.55)); else base.push(status(I.CHARM, 0.55));
      break;
    case 'hydra':
      base.push(status(I.POISON, 4, undefined, { periodicDamage: 4.2 + rank * 0.28, tickEvery: 1 }), status(I.SLOW, 1.2, 0.2));
      break;
    case 'apex':
      base.push(status(I.BLEED, 3.5, undefined, { periodicDamage: 4.8 + rank * 0.3, tickEvery: 1 }), status(I.REVEAL, 3));
      if ((mob.abilityCycle | 0) % 4 === 0) base.push(status(I.FEAR, 0.65));
      break;
  }
  return base;
}

export function tickMobPassive(state, mob, target, dt, timeMs) {
  if (mob.specialCueLeft > 0) mob.specialCueLeft = Math.max(0, mob.specialCueLeft - dt);
  if (!target) return;
  const d2 = distSq(mob.x, mob.y, target.x, target.y);
  switch (mob.abilityProfile) {
    case 'mite':
      if (d2 < 190 * 190) applyStatus(mob, I.HASTE, 0.35, { timeMs, sourceId: mob.id, value: 0.16 });
      break;
    case 'nodule':
      if ((timeMs | 0) > (mob.nextPassiveAt ?? 0)) {
        mob.nextPassiveAt = timeMs + 1300;
        mob.stats.shield = Math.min(mob.stats.maxShield || 45, (mob.stats.shield || 0) + 7 + (mob.threat || 1));
        mob.specialCue = 'shield'; mob.specialCueLeft = 0.45;
      }
      break;
    case 'apex':
      if (target.stats && target.stats.hp / Math.max(1, target.stats.maxHp) < 0.35) applyStatus(mob, I.HASTE, 0.45, { timeMs, sourceId: mob.id, value: 0.2 });
      break;
  }
}

export function tryMobSpecial(state, mob, target, timeMs) {
  if (!target || timeMs < (mob.nextSpecialAt ?? 0)) return false;
  const dist = Math.hypot(target.x - mob.x, target.y - mob.y);
  const rank = Math.max(1, mob.mapLevel || mob.threat || 1);
  mob.abilityCycle = (mob.abilityCycle ?? 0) + 1;
  const dir = norm(target.x - mob.x, target.y - mob.y);
  const cue = (text, cd) => {
    mob.specialCue = text;
    mob.specialCueLeft = 1.15;
    const profileMul = { scoria: 1.35, lancer: 1.45, warden: 1.35, specter: 1.3, hydra: 1.35, apex: 1.25 }[mob.abilityProfile] ?? 1.2;
    mob.nextSpecialAt = timeMs + Math.round(cd * profileMul * (mob.demoMob ? 2.35 : 1.25));
    queueWorldSfx(state, SFX_EVENT_TYPES.ABILITY_A, mob.sx, mob.sy, mob.x, mob.y, 0);
    return true;
  };

  switch (mob.abilityProfile) {
    case 'mite':
      if (mob.summonGeneration <= 0 && (mob.mutated || mob.elite) && ((mob.abilityCycle | 0) % 4 === 0)) {
        if (spawnBrood(state, mob, target, timeMs, 'brood', mob.demoMob ? 1 : 1, MOB_IDS.FERROUS_MITE, 0.32)) return cue('Brood', 8400);
      }
      if (dist < 360) {
        mob.vx += dir.x * (260 + rank * 14); mob.vy += dir.y * (260 + rank * 14);
        applyStatus(mob, I.HASTE, 1.3, { timeMs, sourceId: mob.id, value: 0.28 });
        return cue('Charge', 4200);
      }
      break;
    case 'scoria':
      if (dist < 560) {
        const spreadCount = mob.demoMob ? 2 : 3;
        for (let k = 0; k < spreadCount; k++) {
          const i = k - (spreadCount - 1) / 2;
          const a = Math.atan2(dir.y, dir.x) + i * 0.34;
          spawnProjectile(state, mob, mob.x + Math.cos(a) * 400, mob.y + Math.sin(a) * 400, mob.projectileTint, mob.attackDamage * 0.75, 6, 260, 480, 78, timeMs, { sourceKind: 'mob', visualKind: 'mob_bomb', onHitStatuses: getMobOnHitStatuses(mob), onSplashStatuses: getMobOnHitStatuses(mob), maxLifetimeMs: mob.demoMob ? 1900 : 2600 });
        }
        return cue('Mines', 6100);
      }
      break;
    case 'stinger':
      if (dist >= 140 && mob.summonGeneration <= 0 && ((mob.abilityCycle | 0) % 3 === 0 || mob.mutated || mob.elite)) {
        if (spawnMirrorImages(state, mob, target, timeMs, 'mirror', mob.demoMob ? 1 : 2, MOB_IDS.ORBITAL_STINGER, 'miroir')) return cue('Split', 8000);
      }
      if (dist > 160) {
        applyStatus(mob, I.UNTARGETABLE, 0.18, { timeMs, sourceId: mob.id });
        applyStatus(mob, I.CAMOUFLAGE, 1.35, { timeMs, sourceId: mob.id });
        mob.x += -dir.y * 90; mob.y += dir.x * 90;
        return cue('Cloak', 6200);
      }
      break;
    case 'lancer':
      if (dist < 850) {
        spawnProjectile(state, mob, target.x, target.y, mob.projectileTint, mob.attackDamage * 1.9, 6, 760, 920, 0, timeMs, { sourceKind: 'mob', visualKind: 'mob_lance', onHitStatuses: getMobOnHitStatuses(mob), maxLifetimeMs: mob.demoMob ? 1600 : 2200 });
        return cue('Lance', 7200);
      }
      break;
    case 'nodule':
      if (dist < 400) {
        areaAround(state, mob, 145 + rank * 3, (p) => { applyMobStatus(state, mob, p, I.GROUNDED, 1.2); applyMobStatus(state, mob, p, I.SLOW, 1.5, 0.28); });
        applyStatus(mob, I.ARMOR_UP, 2.5, { timeMs, sourceId: mob.id, value: 0.32 });
        return cue('Lockfield', 7600);
      }
      break;
    case 'crusher':
      if (dist < 260) {
        areaAround(state, mob, 130 + rank * 4, (p) => { applyDamage(state, p, mob.attackDamage * 0.65, null, { timeMs }); applyMobStatus(state, mob, p, I.STUN, 0.35); applyMobStatus(state, mob, p, I.GROUNDED, 0.9); });
        return cue('EMP', 6200);
      }
      break;
    case 'warden':
      if (dist < 520) {
        const bolts = mob.demoMob ? 3 : 5;
        for (let i = 0; i < bolts; i++) {
          const a = Math.atan2(dir.y, dir.x) + (i - (bolts - 1) / 2) * 0.2;
          spawnProjectile(state, mob, mob.x + Math.cos(a) * 460, mob.y + Math.sin(a) * 460, mob.projectileTint, mob.attackDamage * 0.65, 4.5, 430, 620, 30, timeMs, { sourceKind: 'mob', visualKind: 'mob_arc', onHitStatuses: getMobOnHitStatuses(mob), onSplashStatuses: getMobOnHitStatuses(mob), maxLifetimeMs: mob.demoMob ? 1900 : 2600 });
        }
        return cue('Arc', 6800);
      }
      break;
    case 'specter':
      if (dist >= 120 && mob.summonGeneration <= 0 && ((mob.abilityCycle | 0) % 3 === 1 || mob.mutated || mob.elite)) {
        if (spawnMirrorImages(state, mob, target, timeMs, 'shadow', mob.demoMob ? 1 : 2, MOB_IDS.VECTOR_SPECTER, 'ombre')) {
          areaAround(state, mob, 135, (p) => { applyMobStatus(state, mob, p, I.CHARM, 0.55); applyMobStatus(state, mob, p, I.FEAR, 0.40); });
          return cue('Eclipse', 8600);
        }
      }
      if (dist < 420) {
        areaAround(state, mob, 150, (p) => { applyMobStatus(state, mob, p, (mob.abilityCycle % 2) ? I.FEAR : I.CHARM, 0.8); applyMobStatus(state, mob, p, I.DAMAGE_AMP, 2.2, 0.18); });
        applyStatus(mob, I.CAMOUFLAGE, 1.2, { timeMs, sourceId: mob.id });
        return cue('Veil', 7600);
      }
      break;
    case 'hydra':
      if (mob.summonGeneration <= 0 && ((mob.abilityCycle | 0) % 3 === 0 || mob.mutated || mob.elite)) {
        if (spawnBrood(state, mob, target, timeMs, 'brood', mob.demoMob ? 1 : (mob.elite || mob.mutated ? 2 : 1), MOB_IDS.FERROUS_MITE, 0.34)) {
          spawnProjectile(state, mob, target.x, target.y, mob.projectileTint, mob.attackDamage * 1.15, 10, 210, 480, 105, timeMs, { sourceKind: 'mob', visualKind: 'mob_toxic', onHitStatuses: getMobOnHitStatuses(mob), onSplashStatuses: getMobOnHitStatuses(mob), maxLifetimeMs: mob.demoMob ? 1900 : 2600 });
          return cue('Brood', 9000);
        }
      }
      if (dist < 500) {
        spawnProjectile(state, mob, target.x, target.y, mob.projectileTint, mob.attackDamage * 1.35, 10, 230, 520, 115, timeMs, { sourceKind: 'mob', visualKind: 'mob_toxic', onHitStatuses: getMobOnHitStatuses(mob), onSplashStatuses: getMobOnHitStatuses(mob), maxLifetimeMs: mob.demoMob ? 1900 : 2600 });
        return cue('Mire', 8200);
      }
      break;
    case 'apex':
      if (dist < 520) {
        applyStatus(mob, I.HASTE, 1.8, { timeMs, sourceId: mob.id, value: 0.24 });
        applyStatus(mob, I.LIFESTEAL, 1.8, { timeMs, sourceId: mob.id, value: 0.12 });
        if (dist < 240) { applyMobStatus(state, mob, target, I.FEAR, 0.7); applyMobStatus(state, mob, target, I.BLEED, 3.5, undefined, { periodicDamage: 6 + rank * 0.35, tickEvery: 1 }); }
        return cue('Hunt', 7200);
      }
      break;
  }
  return false;
}
