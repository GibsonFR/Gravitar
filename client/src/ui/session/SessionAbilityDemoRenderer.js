import { rgba } from '../../core/Math.js';
import { drawAreaEffect } from '../../abilities/AreaEffectRenderer.js';
import { drawShip } from '../../entities/ship/ShipRenderer.js';
import { drawProjectile } from '../../projectile/ProjectileRenderer.js';
import { getShipFramePalette } from '../../entities/ship/ShipFramePalette.js';
import { VisualFxStore } from '../../fx/VisualFxStore.js';
import { getVanguardAbilityTuning, VANGUARD_PASSIVE } from '../../../../shared/content/frames/vanguard/VanguardFrameSpec.js';
import { getSigilAbilityTuning, SIGIL_PASSIVE } from '../../../../shared/content/frames/sigil/SigilFrameSpec.js';
import { getBulwarkAbilityTuning, BULWARK_PASSIVE } from '../../../../shared/content/frames/bulwark/BulwarkFrameSpec.js';

const PHASE_TO_LEVEL = Object.freeze({ 1: 1, 2: 3, 3: 6, 4: 10, 5: 15 });

const DEMO_FX = new VisualFxStore();
let demoFxKey = '';
let demoFxLastT = -1;
let demoFxLastTime = 0;

function status(id, color = null, label = '') {
  return {
    id,
    label: label || id,
    primaryColor: color || { r: 220, g: 230, b: 245 },
    secondaryColor: color || { r: 220, g: 230, b: 245 }
  };
}

function frameColor(frameId) {
  if (frameId === 'sigil') return { r: 198, g: 128, b: 255 };
  if (frameId === 'bulwark') return { r: 236, g: 196, b: 96 };
  return { r: 125, g: 233, b: 255 };
}

function phaseToInvested(slot, phase) {
  const p = Math.max(1, Math.min(5, phase | 0));
  if (slot === 'R') return p;
  return PHASE_TO_LEVEL[p] || 1;
}

function getDemoTuning(frameId, slot, phase) {
  const invested = phaseToInvested(slot, phase);
  if (frameId === 'sigil') return getSigilAbilityTuning(slot, invested, 0);
  if (frameId === 'bulwark') return getBulwarkAbilityTuning(slot, invested, 22);
  return getVanguardAbilityTuning(slot, invested, 0);
}

function pushDamageEvent(scene, id, t, at, target, amount, opts = {}) {
  if (!scene.damageEvents) scene.damageEvents = [];
  if (t < at || t > at + 0.14) return;
  scene.damageEvents.push({
    id,
    type: 'damage',
    targetId: target.id,
    x: target.x,
    y: target.y,
    amount,
    crit: !!opts.crit,
    shielded: !!opts.shielded,
    periodic: !!opts.periodic
  });
}

function addFlightProjectile(scene, id, from, to, t, start, travel, color, slot, extra = {}) {
  const p = (t - start) / travel;
  if (p < 0 || p > 1) return false;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  scene.projectiles.push(projectile(id, lerp(from.x, to.x, easeOut(p)), lerp(from.y, to.y, easeOut(p)), dx / len * (extra.speed || 900), dy / len * (extra.speed || 900), extra.radius || 4.2, color, { slot, ...extra }));
  return true;
}

function addImpactRing(scene, id, t, at, target, radius, color, extra = {}) {
  if (t < at || t > at + 0.30) return;
  const fade = 1 - (t - at) / 0.30;
  scene.areas.push(area(id, target.x, target.y, radius, color, { durationLeft: 0.22 + fade * 0.6, ...extra }));
}

function autoHitTimes(duration, cadence, first = 0.42) {
  const out = [];
  for (let at = first; at < duration - 0.20; at += cadence) out.push(Number(at.toFixed(3)));
  return out;
}

function applyVanguardRealScenario(scene, slot, phase, t, duration, label) {
  const self = scene.ships[0];
  const target = scene.ships[1];
  const color = frameColor('vanguard');
  const a = getDemoTuning('vanguard', 'A', phase);
  const z = getDemoTuning('vanguard', 'Z', phase);
  const e = getDemoTuning('vanguard', 'E', phase);
  const r = getDemoTuning('vanguard', 'R', phase);
  const wantsP10 = /P\(10\)|10/.test(label || '') || (slot === 'P' && t > 1.1);
  const wantsP6 = /P\(6\)|6/.test(label || '') || slot === 'R';
  const hits = autoHitTimes(duration, slot === 'R' ? 0.46 : 0.72, 0.36).filter((at) => t >= at).length;
  let heat = Math.min(VANGUARD_PASSIVE.maxStacks, hits + (slot === 'P' ? Math.floor(t / 0.34) : 0));
  if (wantsP6) heat = Math.max(6, heat);
  if (wantsP10) heat = 10;
  let empoweredCharges = slot === 'A' && t > 0.82 ? Math.max(0, a.empowerCharges - 1) : a.empowerCharges;
  let comboLeft = 0;
  let phaseLeft = 0;
  let ultLeft = 0;

  const autoTimes = autoHitTimes(duration, slot === 'R' ? 0.44 : 0.72, 0.38);
  for (let i = 0; i < autoTimes.length; i += 1) {
    const start = autoTimes[i];
    const from = { x: self.x + Math.cos(self.rot) * 22, y: self.y + Math.sin(self.rot) * 22 };
    addFlightProjectile(scene, 21000 + i, from, target, t, start, 0.26, color, 'AA', { speed: 930, radius: slot === 'R' || heat >= 6 ? 4.8 : 3.8, empoweredAutoUsed: heat >= 6 || slot === 'R', visualKind: '' });
    pushDamageEvent(scene, `vg-aa-${i}`, t, start + 0.26, target, heat >= 6 ? 18 : 13, { crit: heat >= 10 && i % 3 === 0 });
  }

  if (slot === 'A' || /A1/.test(label || '')) {
    const start = /Z1/.test(label || '') ? 1.12 : 0.42;
    const combo = /Z1|combo/i.test(label || '');
    addFlightProjectile(scene, 21101, { x: self.x + Math.cos(self.rot) * 24, y: self.y + Math.sin(self.rot) * 24 }, target, t, start, combo ? 0.28 : 0.38, color, 'A', { speed: a.projectileSpeed * (combo ? 1 + a.comboProjectileSpeedPct : 1), radius: Math.max(4.5, a.projectileWidth * 0.18), visualKind: 'ability' });
    const impact = start + (combo ? 0.28 : 0.38);
    addImpactRing(scene, 21102, t, impact, target, Math.max(32, a.projectileWidth * 1.7), color, { label: a.damageAmpPct > 0 ? 'Marque A' : 'Impact A' });
    pushDamageEvent(scene, 'vg-a', t, impact, target, Math.round(a.damageFlat + 13 * a.damagePct + (combo ? 13 * a.comboDamagePct : 0)), { crit: combo });
    if (t >= impact && t < impact + a.damageAmpDuration) target.statuses = [...(target.statuses || []), status('damage_amp', color, 'A')];
    if (phase >= 5 && slot === 'A' && t >= impact && t < impact + a.disarmDuration) target.statuses = [...(target.statuses || []), status('disarm', color, 'A')];
    if (t > impact) heat = Math.min(10, heat + 1);
  }

  if (slot === 'Z' || /Z1/.test(label || '')) {
    const start = 0.28;
    const dashP = clamp01((t - start) / 0.28);
    if (dashP > 0 && dashP < 1) {
      const dist = z.dashDistance;
      self.x = -160 + easeOut(dashP) * dist;
      self.vx = 760;
      self._localThrust = 1;
    }
    if (t >= start && t < start + z.moveBoostDuration) {
      self.statuses = [...(self.statuses || []), status('haste', color, 'Z')];
      comboLeft = Math.max(0, z.comboWindowDuration - (t - start));
    }
    if (z.trailSlowPct > 0 && t >= start && t < start + 1.2) scene.areas.push(area(21120, lerp(-160, self.x, 0.45), self.y, 52, color, { durationLeft: 1.0, label: 'Traînée Z', statusId: 'slow' }));
    if (wantsP10 && t >= start && t < start + VANGUARD_PASSIVE.overheatTenacityDuration) self.statuses = [...(self.statuses || []), status('tenacity', color, 'Surchauffe')];
  }

  if (slot === 'E' || /E1/.test(label || '')) {
    const start = 0.34;
    if (t >= start && t < start + e.phaseDuration) {
      phaseLeft = Math.max(0, e.phaseDuration - (t - start));
      self.statuses = [...(self.statuses || []), status('spell_shield', color, 'Phase')];
      scene.areas.push(area(21130, self.x, self.y, 70, { r: 124, g: 154, b: 255 }, { durationLeft: phaseLeft, label: 'Phase' }));
    }
    const exit = start + e.phaseDuration;
    if (e.exitRadius > 0) {
      addImpactRing(scene, 21131, t, exit, self, e.exitRadius, color, { label: 'Grounded', statusId: 'grounded' });
      if (t >= exit && t < exit + e.groundedDuration) target.statuses = [...(target.statuses || []), status('grounded', color, 'E')];
    }
    if (wantsP10 && t >= start && t < start + VANGUARD_PASSIVE.overheatTenacityDuration) self.statuses = [...(self.statuses || []), status('tenacity', color, 'Surchauffe')];
    if (phase >= 5 && wantsP10 && t > exit) empoweredCharges = Math.min(a.empowerCharges, empoweredCharges + 1);
  }

  if (slot === 'R' || /R1/.test(label || '')) {
    const start = 0.24;
    if (t >= start && t < start + r.ultDuration) {
      ultLeft = Math.max(0, r.ultDuration - (t - start));
      self.statuses = [...(self.statuses || []), status('haste', { r: 255, g: 116, b: 238 }, 'R')];
      if (phase >= 2 && t > 1.0) target.statuses = [...(target.statuses || []), status('burn', { r: 255, g: 142, b: 72 }, 'R')];
      if (phase >= 5 && /A1/.test(label || '') && t > 1.5 && t < 1.95) target.statuses = [...(target.statuses || []), status('stun', color, 'R+A')];
    }
  }

  target.vitals.hp = Math.max(18, target.vitals.hp - Math.min(70, hits * (slot === 'R' ? 7 : 4)));
  self.frameState = { kind: 'vanguard', passiveName: 'Surchauffe', passiveStacks: heat, passiveMaxStacks: VANGUARD_PASSIVE.maxStacks, passiveDecayLeft: heat > 0 ? Math.max(0, VANGUARD_PASSIVE.stackDuration - (t % VANGUARD_PASSIVE.stackDuration)) : 0, empoweredCharges, empoweredMaxCharges: a.empowerCharges, comboWindowLeft: comboLeft, moveBoostLeft: slot === 'Z' ? z.moveBoostDuration : 0, phaseLeft, ultLeft };
}

function applySigilRealScenario(scene, slot, phase, t, duration, label) {
  const self = scene.ships[0];
  const target = scene.ships[1];
  const color = frameColor('sigil');
  const a = getDemoTuning('sigil', 'A', phase);
  const z = getDemoTuning('sigil', 'Z', phase);
  const e = getDemoTuning('sigil', 'E', phase);
  const r = getDemoTuning('sigil', 'R', phase);
  const wants3 = /P\(3\)|x3|A1 x3/.test(label || '');
  const wants5 = /P\(5\)|x5|détonation/i.test(label || '');
  const aStarts = wants5 ? [0.34, 0.96, 1.58, 2.20, 2.82] : wants3 ? [0.34, 0.98, 1.62] : [0.46];
  let runes = 0;

  if (slot === 'Z' || /Z1/.test(label || '')) {
    scene.areas.push(area(22100, target.x - 12, target.y, z.zZoneRadius, color, { durationLeft: z.zZoneDuration, kind: 'test_effect_zone', phase: 'active', statusId: 'slow', label: 'Zone Z' }));
    if (t > 0.55) target.statuses = [...(target.statuses || []), status('slow', color, 'Z')];
    pushDamageEvent(scene, 'sigil-z-dot', t, Math.floor(Math.max(0, t - 0.8) / 0.5) * 0.5 + 0.8, target, Math.round(z.zZoneDamageFlatPerSecond * 0.5), { periodic: true });
  }
  if (slot === 'E' || /E1/.test(label || '')) {
    const start = 0.28;
    const dashP = clamp01((t - start) / 0.28);
    if (dashP > 0 && dashP < 1) {
      self.x = -150 + easeOut(dashP) * e.eDashDistance;
      self.y = -24 * Math.sin(dashP * Math.PI);
      self.vx = 620;
    }
    if (t >= start && t < start + e.eCamouflageDuration) self.statuses = [...(self.statuses || []), status('camouflage', color, 'E')];
    if (phase >= 5 && t > start + e.eCamouflageDuration && t < start + e.eCamouflageDuration + 0.5) self.statuses = [...(self.statuses || []), status('spell_shield', color, 'E')];
    if (/A1/.test(label || '') && t > 0.78) target.statuses = [...(target.statuses || []), status('mark', color, 'Rune')];
  }
  if (slot === 'R' || /R1/.test(label || '')) {
    const start = 0.20;
    if (t >= start && t < start + r.ultDuration) {
      self.statuses = [...(self.statuses || []), status('lifesteal', color, 'R')];
      scene.areas.push(area(22120, self.x, self.y, 96, color, { durationLeft: r.ultDuration, label: 'Convergence' }));
    }
  }
  if (slot === 'A' || /A1/.test(label || '') || slot === 'P') {
    for (let i = 0; i < aStarts.length; i += 1) {
      const start = aStarts[i];
      const from = { x: self.x + Math.cos(self.rot) * 24, y: self.y + Math.sin(self.rot) * 24 };
      addFlightProjectile(scene, 22200 + i, from, target, t, start, 0.33, color, 'A', { speed: a.aProjectileSpeed, radius: Math.max(4.2, a.aProjectileWidth * 0.17), visualKind: 'ability' });
      const impact = start + 0.33;
      if (t >= impact) runes = Math.min(SIGIL_PASSIVE.maxRunes, runes + 1);
      pushDamageEvent(scene, `sigil-a-${i}`, t, impact, target, Math.round(a.aImpactDamageFlat + 13 * a.aImpactDamagePct), { crit: i === 4 });
      addImpactRing(scene, 22280 + i, t, impact, target, 24 + i * 2, color, { label: 'Rune' });
    }
  }
  if (wants3 || runes >= SIGIL_PASSIVE.slowThreshold) target.statuses = [...(target.statuses || []), status('slow', color, '3 runes')];
  if (wants5 || runes >= SIGIL_PASSIVE.detonationThreshold) {
    target.statuses = [...(target.statuses || []), status(phase >= 5 ? 'stun' : 'mark', color, 'Détonation')];
    addImpactRing(scene, 22300, t, 3.18, target, 72, color, { label: 'Détonation', statusId: phase >= 5 ? 'stun' : 'mark' });
    pushDamageEvent(scene, 'sigil-detonate', t, 3.18, target, Math.round(SIGIL_PASSIVE.detonationDamageFlat + 13 * SIGIL_PASSIVE.detonationDamageWeaponPct), { crit: true });
  }
  const count = wants5 ? 5 : wants3 ? 3 : runes;
  for (let i = 0; i < count; i += 1) {
    const ang = i * Math.PI * 2 / Math.max(1, count) + t * 2.1;
    scene.areas.push(area(22350 + i, target.x + Math.cos(ang) * 30, target.y + Math.sin(ang) * 30, 10, color, { durationLeft: 1.0, label: i === 0 ? `${count} rune${count > 1 ? 's' : ''}` : '' }));
  }
  target.vitals.hp = Math.max(16, target.vitals.hp - count * 9 - (wants5 ? 32 : 0));
  self.frameState = { kind: 'sigil', passiveName: 'Runes', passiveStacks: 0, passiveMaxStacks: SIGIL_PASSIVE.maxRunes, detonationCooldownLeft: wants5 && t > 3.18 ? 3.5 : 0, zoneActive: slot === 'Z' || slot === 'R', veilLeft: slot === 'E' ? Math.max(0, e.eCamouflageDuration - (t - 0.28)) : 0, ultLeft: slot === 'R' ? Math.max(0, r.ultDuration - (t - 0.2)) : 0 };
}

function applyBulwarkRealScenario(scene, slot, phase, t, duration, label) {
  const self = scene.ships[0];
  const target = scene.ships[1];
  const color = frameColor('bulwark');
  const a = getDemoTuning('bulwark', 'A', phase);
  const z = getDemoTuning('bulwark', 'Z', phase);
  const e = getDemoTuning('bulwark', 'E', phase);
  const r = getDemoTuning('bulwark', 'R', phase);
  const full = /pleine|P\(5\)|cap/i.test(label || '');
  let plates = full ? BULWARK_PASSIVE.maxPlates : Math.min(BULWARK_PASSIVE.maxPlates, 1 + Math.floor(t / 0.75));

  if (slot === 'P') {
    const incoming = [0.45, 1.05, 1.65, 2.25, 2.85];
    for (let i = 0; i < incoming.length; i += 1) {
      const start = incoming[i];
      addFlightProjectile(scene, 23100 + i, { x: target.x, y: target.y }, self, t, start, 0.24, { r: 255, g: 120, b: 110 }, 'AA', { radius: 4.5 });
      pushDamageEvent(scene, `bw-in-${i}`, t, start + 0.24, self, 18, { shielded: i < 2 });
    }
    self.statuses = [...(self.statuses || []), status('armor_up', color, 'Plaques')];
    if (full || plates >= BULWARK_PASSIVE.maxPlates) self.statuses = [...self.statuses, status('tenacity', color, 'Plaques')];
  }
  if (slot === 'A' || /A1/.test(label || '')) {
    const start = 0.30;
    if (t >= start && t < start + a.anchorDuration) {
      self.statuses = [...(self.statuses || []), status('armor_up', color, 'A')];
      scene.areas.push(area(23140, self.x, self.y, Math.max(74, a.anchorPulseRadius || 86), color, { durationLeft: a.anchorDuration, label: 'Ancrage' }));
      if (phase >= 3) target.statuses = [...(target.statuses || []), status('slow', color, 'Pulse')];
    }
    if (/provocation/i.test(label || '') || phase >= 4) target.statuses = [...(target.statuses || []), status('taunt', color, 'A')];
  }
  if (slot === 'Z' || /Z1/.test(label || '')) {
    const start = 0.36;
    addFlightProjectile(scene, 23160, { x: self.x + 20, y: self.y }, target, t, start, 0.36, color, 'Z', { speed: z.harpoonProjectileSpeed, radius: 6.2, visualKind: 'ability' });
    const impact = start + 0.36;
    pushDamageEvent(scene, 'bw-z', t, impact, target, Math.round(z.harpoonDamageFlat + 13 * z.harpoonDamageWeaponPct + 22 * z.harpoonDamageArmorPct), { crit: phase >= 4 });
    if (t >= impact) {
      target.statuses = [...(target.statuses || []), status('taunt', color, 'Z')];
      if (phase >= 2) target.statuses.push(status('armor_shred', color, 'Shred'));
      if (phase >= 3) target.statuses.push(status('grounded', color, 'Grounded'));
      const pull = clamp01((t - impact) / 0.6);
      if (phase >= 5) target.x = lerp(target.x, self.x + 72, easeOut(pull));
      if (phase >= 4) self.x = lerp(self.x, target.x - 82, easeOut(pull));
    }
  }
  if (slot === 'E' || /E1/.test(label || '')) {
    const start = 0.28;
    if (t >= start && t < start + e.meditationDuration) {
      self.statuses = [...(self.statuses || []), status('tenacity', color, 'E'), status('armor_up', color, 'E')];
      scene.areas.push(area(23190, self.x, self.y, e.meditationPulseRadius || 82, { r: 120, g: 210, b: 255 }, { durationLeft: e.meditationDuration, label: 'Méditation' }));
    }
    const end = start + e.meditationDuration;
    if (phase >= 3) {
      addImpactRing(scene, 23191, t, end, self, e.meditationPulseRadius || 120, color, { label: phase >= 5 ? 'Grounded' : 'Pulse', statusId: phase >= 5 ? 'grounded' : 'slow' });
      if (t >= end && t < end + 1.2) target.statuses = [...(target.statuses || []), status(phase >= 5 ? 'grounded' : 'slow', color, 'E')];
    }
    if (t > start) self.vitals.hp = Math.min(self.vitals.maxHp, self.vitals.hp + 18);
  }
  if (slot === 'R' || /R1/.test(label || '')) {
    const start = 0.22;
    if (t >= start && t < start + r.stormDuration) {
      scene.areas.push(area(23220, self.x, self.y, r.stormRadius, color, { durationLeft: r.stormDuration, label: 'Tempête', statusId: 'slow' }));
      target.statuses = [...(target.statuses || []), status('slow', color, 'R')];
      if (/provocation/i.test(label || '') || phase >= 2) target.statuses.push(status('taunt', color, 'R'));
      if (/stun|pression/i.test(label || '') || phase >= 5 && t > start + r.stormExposureStunThreshold) target.statuses.push(status('stun', color, 'R'));
      if (phase >= 5) target.x = lerp(target.x, self.x + 95, 0.035);
      const tick = Math.floor((t - start) / 0.5) * 0.5 + start + 0.5;
      pushDamageEvent(scene, 'bw-r-dot', t, tick, target, Math.round(r.stormBaseDpsFlat * 0.5), { periodic: true });
    }
  }
  target.vitals.hp = Math.max(18, target.vitals.hp - (slot === 'R' ? Math.floor(t * 9) : slot === 'Z' && t > 0.72 ? 46 : 0));
  self.frameState = { kind: 'bulwark', passiveName: 'Plaques', passiveStacks: plates, passiveMaxStacks: BULWARK_PASSIVE.maxPlates, anchorLeft: slot === 'A' ? Math.max(0, a.anchorDuration - (t - 0.3)) : 0, meditationLeft: slot === 'E' ? Math.max(0, e.meditationDuration - (t - 0.28)) : 0, stormLeft: slot === 'R' ? Math.max(0, r.stormDuration - (t - 0.22)) : 0, stormArmorStolen: slot === 'R' ? Math.min(r.stormStealCap, Math.floor(t * r.stormArmorStealPerSecond)) : 0, stormShieldGained: slot === 'R' && phase >= 4 ? 18 : 0 };
}

function applyRealScenario(scene, frameId, slot, phase, t, duration, scenarioLabel) {
  scene.damageEvents = [];
  if (frameId === 'sigil') applySigilRealScenario(scene, slot, phase, t, duration, scenarioLabel);
  else if (frameId === 'bulwark') applyBulwarkRealScenario(scene, slot, phase, t, duration, scenarioLabel);
  else applyVanguardRealScenario(scene, slot, phase, t, duration, scenarioLabel);
}

function syncDemoFx(scene, key, localT, absoluteTime) {
  const looped = demoFxKey !== key || localT + 0.08 < demoFxLastT || absoluteTime < demoFxLastTime;
  if (looped) {
    DEMO_FX.trails.clear();
    DEMO_FX.impacts = [];
    DEMO_FX.rings = [];
    DEMO_FX.damageNumbers = [];
    DEMO_FX.castBursts = [];
    DEMO_FX.lastProjectiles.clear();
    DEMO_FX.lastAreas.clear();
    DEMO_FX.lastStatuses.clear();
  }
  demoFxKey = key;
  demoFxLastT = localT;
  demoFxLastTime = absoluteTime;
  const mock = {
    projectiles: new Map((scene.projectiles || []).map((p) => [p.id, p])),
    areaEffects: new Map((scene.areas || []).map((a) => [a.id, a])),
    players: new Map((scene.ships || []).map((p) => [p.id, p])),
    mobs: new Map(),
    asteroids: new Map(),
    getMe: () => scene.ships?.[0] || null,
    consumePendingCombatFx: () => scene.damageEvents || []
  };
  DEMO_FX.sync(mock, absoluteTime);
}


function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function easeOut(t) { return 1 - Math.pow(1 - clamp01(t), 3); }
function easeInOut(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
function dist(a, b, c, d) { return Math.hypot(a - c, b - d); }

function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  const pxW = Math.floor(w * dpr);
  const pxH = Math.floor(h * dpr);
  if (canvas.width !== pxW || canvas.height !== pxH) {
    canvas.width = pxW;
    canvas.height = pxH;
  }
  return { dpr, cssW: w, cssH: h };
}

function drawGrid(ctx, view, camX, camY) {
  const { dpr, cssW: w, cssH: h } = view;
  ctx.save();
  ctx.fillStyle = 'rgba(5, 9, 16, 0.98)';
  ctx.fillRect(0, 0, w * dpr, h * dpr);

  const grad = ctx.createRadialGradient(w * 0.55 * dpr, h * 0.48 * dpr, 0, w * 0.55 * dpr, h * 0.48 * dpr, Math.max(w, h) * 0.7 * dpr);
  grad.addColorStop(0, 'rgba(32, 50, 76, 0.22)');
  grad.addColorStop(1, 'rgba(3, 6, 11, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w * dpr, h * dpr);

  ctx.strokeStyle = 'rgba(126, 162, 214, 0.105)';
  ctx.lineWidth = dpr;
  const step = 96;
  const ox = ((-camX + w * 0.5) % step + step) % step;
  const oy = ((-camY + h * 0.5) % step + step) % step;
  for (let x = ox; x <= w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x * dpr, 0);
    ctx.lineTo(x * dpr, h * dpr);
    ctx.stroke();
  }
  for (let y = oy; y <= h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y * dpr);
    ctx.lineTo(w * dpr, y * dpr);
    ctx.stroke();
  }

  for (let i = 0; i < 58; i += 1) {
    const x = ((i * 173.31 + timeSeed(i)) % w) * dpr;
    const y = ((i * 91.77 + timeSeed(i + 9)) % h) * dpr;
    const a = 0.16 + (i % 7) * 0.035;
    ctx.fillStyle = `rgba(210,230,255,${a})`;
    ctx.fillRect(x, y, dpr, dpr);
  }
  ctx.restore();
}

function timeSeed(i) { return (Math.sin(i * 12.9898) * 43758.5453) % 211; }

function drawDemoLabel(ctx, view, text, x, y, color = 'rgba(226,236,250,.90)') {
  const dpr = view.dpr;
  ctx.save();
  ctx.font = `800 ${11 * dpr}px var(--ui-font, Segoe UI)`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = Math.max(42, ctx.measureText(text).width / dpr + 18);
  ctx.fillStyle = 'rgba(5,8,13,.78)';
  ctx.strokeStyle = 'rgba(126,162,214,.22)';
  ctx.lineWidth = dpr;
  ctx.beginPath();
  ctx.roundRect((x - w * 0.5) * dpr, (y - 11) * dpr, w * dpr, 22 * dpr, 5 * dpr);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(text, x * dpr, y * dpr);
  ctx.restore();
}

function makeVitals(hp, shield, energy, maxHp = 118, maxShield = 42, maxEnergy = 100) {
  return { hp, maxHp, shield, maxShield, energy, maxEnergy };
}

function baseShip(id, frameId, x, y, rot, opts = {}) {
  const palette = getShipFramePalette(frameId);
  return {
    id,
    pseudo: opts.pseudo || (id === 1 ? 'Preview' : 'Dummy'),
    frameId,
    x,
    y,
    vx: opts.vx || 0,
    vy: opts.vy || 0,
    rot,
    radius: opts.radius || 18,
    engine: opts.engine || 250,
    level: opts.level || 1,
    statuses: opts.statuses || [],
    frameState: opts.frameState || null,
    _localThrust: opts.thrust ?? 0,
    vitals: opts.vitals || makeVitals(118, 42, 92),
    color: palette.hull
  };
}

function enemyShip(x, y, t, opts = {}) {
  return baseShip(2, opts.frameId || 'bulwark', x, y, opts.rot ?? Math.PI, {
    pseudo: 'DUMMY',
    level: 1,
    radius: opts.radius || 18,
    statuses: opts.statuses || [],
    frameState: opts.frameState || { kind: 'bulwark', passiveStacks: 1, passiveMaxStacks: 5 },
    vitals: opts.vitals || makeVitals(opts.hp ?? 92, opts.shield ?? 20, 80, 146, 58, 96),
    thrust: opts.thrust || 0
  });
}

function projectile(id, x, y, vx, vy, radius, tint, extra = {}) {
  return {
    id,
    x,
    y,
    vx,
    vy,
    radius,
    tint,
    visualKind: 'ability',
    sourceAbilitySlot: extra.slot || 'A',
    sourceKind: 'player',
    rangeLeft: 1000,
    ...extra
  };
}

function area(id, x, y, radius, color, extra = {}) {
  return {
    id,
    x,
    y,
    radius,
    color,
    durationLeft: 3,
    kind: 'ability_demo_zone',
    ...extra
  };
}

function phaseLevel(phase) { return PHASE_TO_LEVEL[phase] || 1; }

function loopDuration(frameId, slot, scenarioIndex) {
  if (slot === 'R') return scenarioIndex >= 4 ? 7.2 : 4.8;
  if (slot === 'P') return 4.8;
  if (slot === 'A') return scenarioIndex === 1 ? 6.2 : 3.0;
  if (slot === 'Z') return scenarioIndex >= 1 ? 4.4 : 3.6;
  if (slot === 'E') return scenarioIndex >= 4 ? 5.4 : 4.2;
  return 4.8;
}

function crossedPulse(t, at, dur = 0.22) {
  const p = (t - at) / dur;
  return p >= 0 && p <= 1 ? easeOut(p) : null;
}

function after(t, at, dur = 0.6) {
  return clamp01((t - at) / dur);
}

function addAutoProjectiles(projectiles, from, to, t, color, startTimes, empowered = false) {
  for (let i = 0; i < startTimes.length; i += 1) {
    const p = crossedPulse(t, startTimes[i], 0.42);
    if (p == null) continue;
    projectiles.push(projectile(600 + i, lerp(from.x + Math.cos(from.rot) * 22, to.x, p), lerp(from.y + Math.sin(from.rot) * 22, to.y, p), 950, 0, empowered ? 5.4 : 4.2, color, { slot: 'AA', empoweredAutoUsed: empowered }));
  }
}

function autoTimeline(t, duration, start = 0.48, cadence = 0.72) {
  const out = [];
  for (let at = start; at < duration - 0.15; at += cadence) out.push(at);
  return out;
}

function countPassed(t, times, travel = 0.42) {
  let n = 0;
  for (const at of times) if (t >= at + travel) n += 1;
  return n;
}

function damagePulse(t, at, travel = 0.42) {
  const p = (t - at - travel) / 0.22;
  return p >= 0 && p <= 1 ? 1 - p : 0;
}

function addCombatAutos(projectiles, from, to, t, duration, color, opts = {}) {
  const times = opts.times || autoTimeline(t, duration, opts.start ?? 0.58, opts.cadence ?? 0.74);
  addAutoProjectiles(projectiles, from, to, t, color, times, !!opts.empowered);
  return { times, hits: countPassed(t, times), pulse: Math.max(0, ...times.map((at) => damagePulse(t, at))) };
}

function demoClock(time, frameId, slot, scenarioIndex) {
  const duration = loopDuration(frameId, slot, scenarioIndex);
  return { duration, t: time % duration, u: (time % duration) / duration };
}

function buildVanguard(slot, phase, u, t = u * 4.8, scenarioIndex = 0) {
  const color = { r: 125, g: 233, b: 255 };
  const enemyX = 180;
  const enemyY = -6;
  const cast = after(t, slot === 'A' ? 0.34 : slot === 'Z' ? 0.52 : slot === 'E' ? 0.34 : slot === 'R' ? 0.24 : 0.2, 0.42);
  const dashPulse = slot === 'Z' ? crossedPulse(t, 0.52, 0.32) : null;
  const dash = dashPulse == null ? (slot === 'Z' && t > 0.84 ? 1 : 0) : dashPulse;
  const phasePulse = slot === 'E' ? crossedPulse(t, 0.34, 0.52) : null;
  const phaseMove = phasePulse == null ? (slot === 'E' && t > 0.86 ? 1 : 0) : phasePulse;
  const ultRush = slot === 'R' && t > 0.2 ? Math.sin(t * Math.PI * 2.8) * 22 : 0;
  const x = -160 + dash * 126 + phaseMove * 82 + ultRush;
  const y = slot === 'E' ? Math.sin(phaseMove * Math.PI) * -36 : (slot === 'R' ? Math.sin(u * Math.PI * 4) * 9 : 0);
  const rot = Math.atan2(enemyY - y, enemyX - x);
  const frameState = {
    kind: 'vanguard',
    passiveStacks: slot === 'P' ? Math.floor(4 + Math.sin(u * Math.PI * 2) * 2) : 2 + phase,
    passiveMaxStacks: 10,
    empoweredCharges: slot === 'A' ? phase : 0,
    empoweredMaxCharges: 5,
    comboWindowLeft: slot === 'Z' && cast > 0.25 ? 1.1 : 0,
    moveBoostLeft: slot === 'Z' && cast > 0.25 ? 0.8 : 0,
    phaseLeft: slot === 'E' && phaseMove > 0.2 && phaseMove < 0.92 ? 0.7 : 0,
    ultLeft: slot === 'R' ? 4 : 0
  };
  const ships = [
    baseShip(1, 'vanguard', x, y, rot, { pseudo: 'Preview', level: phaseLevel(phase), thrust: slot === 'R' ? 1 : 0.72, vx: Math.cos(rot) * 120, vy: Math.sin(rot) * 120, frameState, vitals: makeVitals(118, 42, slot === 'Z' ? 87 : 92) }),
    enemyShip(enemyX, enemyY, u, { statuses: slot === 'E' && phase >= 4 ? [{ id: 'slow' }] : [], vitals: makeVitals(slot === 'A' ? 72 : 92, slot === 'R' ? 6 : 20, 70, 146, 58, 96) })
  ];
  const projectiles = [];
  const areas = [];
  const selfRef = ships[0];
  const targetRef = ships[1];
  const combat = addCombatAutos(projectiles, selfRef, targetRef, t, loopDuration('vanguard', slot, scenarioIndex), color, { empowered: slot === 'R' || slot === 'P' || scenarioIndex === 1, cadence: slot === 'R' ? 0.52 : 0.76 });
  if (combat.pulse > 0.01) targetRef.lastHitAt = timeSeed(Math.round(t * 100)) + combat.pulse;
  targetRef.vitals.hp = Math.max(18, targetRef.vitals.hp - combat.hits * (slot === 'R' ? 9 : 5));
  if (slot === 'R') addAutoProjectiles(projectiles, selfRef, targetRef, t, { r: 255, g: 116, b: 238 }, scenarioIndex >= 4 ? [0.36, 0.88, 1.40, 1.92, 2.44, 2.96, 3.48, 4.00, 4.52, 5.04, 5.56, 6.08] : [0.36, 1.02, 1.68, 2.34, 3.00, 3.66], true);

  if (slot === 'A') {
    const p = after(t, 0.34, 0.46);
    projectiles.push(projectile(101, lerp(x + 26, enemyX, p), lerp(y, enemyY, p), 1050, -20, 4.5 + phase * 0.7, color, { slot: 'A' }));
    if (p > 0.78) areas.push(area(102, enemyX, enemyY, 34 + phase * 4, color, { durationLeft: 0.8 }));
  } else if (slot === 'Z') {
    if (scenarioIndex === 1 || scenarioIndex === 3) {
      const ap = after(t, 0.88, 0.46);
      projectiles.push(projectile(108, lerp(x + 22, enemyX, ap), lerp(y, enemyY, ap), 1120, 0, 5.2, color, { slot: 'A' }));
    }
    areas.push(area(103, -160 + dash * 63, -6, 28 + phase * 5, color, { durationLeft: 1.0 }));
  } else if (slot === 'E') {
    if (scenarioIndex >= 4) addAutoProjectiles(projectiles, selfRef, targetRef, t, color, [1.72, 2.24, 2.76], true);
    areas.push(area(104, x, y, 58 + phase * 10, { r: 124, g: 154, b: 255 }, { durationLeft: 1.3 }));
  } else if (slot === 'R') {
    areas.push(area(105, x, y, 94 + phase * 12, { r: 255, g: 116, b: 238 }, { durationLeft: 4 }));
    const p = (u * 1.8) % 1;
    projectiles.push(projectile(106, lerp(x + 20, enemyX, p), lerp(y - 8, enemyY, p), 1180, 0, 5.5, { r: 255, g: 116, b: 238 }, { slot: 'R', ultAutoUsed: true }));
  } else {
    projectiles.push(projectile(107, lerp(x + 24, enemyX, (u * 1.3) % 1), lerp(y, enemyY, (u * 1.3) % 1), 950, 0, 4.2, color, { slot: 'P', empoweredAutoUsed: true }));
  }
  return { ships, projectiles, areas, camX: 0, camY: 0 };
}

function buildSigil(slot, phase, u, t = u * 4.8, scenarioIndex = 0) {
  const color = { r: 198, g: 128, b: 255 };
  const enemyX = 165;
  const enemyY = -4;
  const dash = slot === 'E' ? easeInOut(clamp01((u - 0.18) / 0.45)) : 0;
  const x = -150 + dash * 96;
  const y = dash ? -34 * Math.sin(dash * Math.PI) : 0;
  const rot = Math.atan2(enemyY - y, enemyX - x);
  const runes = slot === 'P' ? Math.floor(1 + u * 5) : phase;
  const frameState = {
    kind: 'sigil',
    passiveStacks: 0,
    passiveMaxStacks: 5,
    detonationCooldownLeft: 0,
    zoneActive: slot === 'Z' || slot === 'R',
    veilLeft: slot === 'E' ? 1.2 : 0,
    ultLeft: slot === 'R' ? 4 : 0
  };
  const ships = [
    baseShip(1, 'sigil', x, y, rot, { pseudo: 'Preview', level: phaseLevel(phase), thrust: slot === 'E' ? 0.9 : 0.42, vx: dash * 180, vy: 0, frameState, statuses: slot === 'E' ? [{ id: 'camouflage' }] : [], vitals: makeVitals(108, 48, 96, 108, 48, 112) }),
    enemyShip(enemyX, enemyY, u, { statuses: runes >= 3 ? [{ id: 'slow' }] : [], vitals: makeVitals(runes >= 5 ? 58 : 90, 20, 70, 146, 58, 96) })
  ];
  const projectiles = [];
  const areas = [];
  const selfRef = ships[0];
  const targetRef = ships[1];
  const combat = addCombatAutos(projectiles, selfRef, targetRef, t, loopDuration('sigil', slot, scenarioIndex), color, { empowered: slot === 'P' || slot === 'R' || scenarioIndex === 1, cadence: slot === 'R' ? 0.58 : 0.82 });
  if (combat.pulse > 0.01) targetRef.lastHitAt = timeSeed(Math.round(t * 100)) + combat.pulse;
  targetRef.vitals.hp = Math.max(18, targetRef.vitals.hp - combat.hits * (slot === 'R' ? 8 : 5));
  if (slot === 'R') addAutoProjectiles(projectiles, selfRef, targetRef, t, { r: 255, g: 116, b: 238 }, scenarioIndex >= 4 ? [0.36, 0.88, 1.40, 1.92, 2.44, 2.96, 3.48, 4.00, 4.52, 5.04, 5.56, 6.08] : [0.36, 1.02, 1.68, 2.34, 3.00, 3.66], true);

  if (slot === 'A') {
    const p = clamp01((u - 0.12) / 0.52);
    projectiles.push(projectile(201, lerp(x + 24, enemyX, p), lerp(y, enemyY, p), 1260, 0, 5 + phase, color, { slot: 'A' }));
    areas.push(area(202, enemyX, enemyY, 24 + phase * 4, color, { durationLeft: 0.6 }));
  } else if (slot === 'Z') {
    areas.push(area(203, enemyX - 10, enemyY, 82 + phase * 8, color, { durationLeft: 3.5, kind: 'test_effect_zone', phase: 'active', statusId: phase >= 5 ? 'suppress' : 'slow', label: phase >= 5 ? 'Suppress' : 'Slow' }));
  } else if (slot === 'E') {
    areas.push(area(204, lerp(-150, x, 0.5), 0, 52 + phase * 7, color, { durationLeft: 1.2, statusId: 'camouflage' }));
  } else if (slot === 'R') {
    areas.push(area(205, enemyX - 16, enemyY, 104 + phase * 14, color, { durationLeft: 4, kind: 'test_effect_zone', phase: 'active', statusId: 'silence', label: 'Rituel' }));
    const p = (u * 1.6) % 1;
    projectiles.push(projectile(206, lerp(x, enemyX, p), lerp(y, enemyY, p), 1150, 0, 5.5, color, { slot: 'R' }));
  } else {
    for (let i = 0; i < Math.min(5, runes); i += 1) {
      const a = i * Math.PI * 2 / 5 + u * Math.PI * 2;
      areas.push(area(207 + i, enemyX + Math.cos(a) * 32, enemyY + Math.sin(a) * 32, 14, color, { durationLeft: 1.0 }));
    }
  }
  return { ships, projectiles, areas, camX: 0, camY: 0 };
}

function buildBulwark(slot, phase, u, t = u * 4.8, scenarioIndex = 0) {
  const color = { r: 236, g: 196, b: 96 };
  const enemyX = 148;
  const enemyY = -2;
  const pull = slot === 'Z' ? easeInOut(clamp01((u - 0.22) / 0.52)) : 0;
  const x = -135 + (slot === 'Z' && phase >= 4 ? pull * 34 : 0);
  const y = 0;
  const eX = enemyX - pull * (phase >= 3 ? 72 : 34);
  const rot = Math.atan2(enemyY - y, eX - x);
  const frameState = {
    kind: 'bulwark',
    passiveStacks: slot === 'P' ? Math.floor(2 + Math.sin(u * Math.PI * 2) * 2.5) : Math.min(5, phase),
    passiveMaxStacks: 5,
    anchorLeft: slot === 'A' ? 2.4 : 0,
    meditationLeft: slot === 'E' ? 2.7 : 0,
    stormLeft: slot === 'R' ? 4 : 0,
    stormArmorStolen: slot === 'R' ? 12 : 0,
    stormShieldGained: slot === 'R' ? 24 : 0
  };
  const selfStatuses = slot === 'A' ? [{ id: 'armor_up' }] : slot === 'E' ? [{ id: 'tenacity' }] : [];
  const enemyStatuses = slot === 'Z' ? [{ id: phase >= 3 ? 'taunt' : 'slow' }] : slot === 'R' ? [{ id: 'slow' }] : [];
  const ships = [
    baseShip(1, 'bulwark', x, y, rot, { pseudo: 'Preview', level: phaseLevel(phase), thrust: 0.18, vx: pull * 70, vy: 0, frameState, statuses: selfStatuses, vitals: makeVitals(slot === 'E' ? 124 : 146, slot === 'E' ? 58 : 42, 82, 146, 58, 96) }),
    enemyShip(eX, enemyY, u, { statuses: enemyStatuses, vitals: makeVitals(slot === 'R' ? 66 : 92, slot === 'Z' ? 7 : 20, 70, 146, 58, 96) })
  ];
  const projectiles = [];
  const areas = [];
  const selfRef = ships[0];
  const targetRef = ships[1];
  const combat = addCombatAutos(projectiles, selfRef, targetRef, t, loopDuration('bulwark', slot, scenarioIndex), color, { empowered: slot === 'P' || scenarioIndex === 1, cadence: slot === 'R' ? 0.68 : 0.92 });
  if (combat.pulse > 0.01) targetRef.lastHitAt = timeSeed(Math.round(t * 100)) + combat.pulse;
  targetRef.vitals.hp = Math.max(18, targetRef.vitals.hp - combat.hits * (slot === 'R' ? 7 : 4));
  if (slot === 'R') addAutoProjectiles(projectiles, selfRef, targetRef, t, { r: 255, g: 116, b: 238 }, scenarioIndex >= 4 ? [0.36, 0.88, 1.40, 1.92, 2.44, 2.96, 3.48, 4.00, 4.52, 5.04, 5.56, 6.08] : [0.36, 1.02, 1.68, 2.34, 3.00, 3.66], true);

  if (slot === 'A') {
    areas.push(area(301, x, y, 78 + phase * 12, color, { durationLeft: 2.5, statusId: 'armor_up' }));
  } else if (slot === 'Z') {
    const p = clamp01((u - 0.08) / 0.35);
    projectiles.push(projectile(302, lerp(x + 22, enemyX, p), lerp(y, enemyY, p), 1180, 0, 4 + phase * 0.8, color, { slot: 'Z' }));
    areas.push(area(303, lerp(x, eX, 0.5), 0, 26 + phase * 5, color, { durationLeft: 1.0 }));
  } else if (slot === 'E') {
    areas.push(area(304, x, y, 88 + phase * 8, { r: 120, g: 210, b: 255 }, { durationLeft: 2.8, statusId: 'tenacity' }));
  } else if (slot === 'R') {
    areas.push(area(305, x, y, 132 + phase * 18, color, { durationLeft: 4, statusId: 'slow', label: 'Siphon' }));
  } else {
    areas.push(area(306, x, y, 52 + phase * 7, color, { durationLeft: 1.2, statusId: 'armor_up' }));
  }
  return { ships, projectiles, areas, camX: 0, camY: 0 };
}

function buildScene(frameId, slot, phase, u, t, scenarioIndex) {
  if (frameId === 'sigil') return buildSigil(slot, phase, u, t, scenarioIndex);
  if (frameId === 'bulwark') return buildBulwark(slot, phase, u, t, scenarioIndex);
  return buildVanguard(slot, phase, u, t, scenarioIndex);
}

function drawDemoHud(ctx, view, card, slot, phase, time, progress01, scenarioLabel = '') {
  const dpr = view.dpr;
  const label = card.abilities?.find((a) => a.key === slot)?.name || card.abilities?.find((a) => a.key === slot)?.label || slot;
  ctx.save();
  ctx.fillStyle = 'rgba(4, 8, 14, 0.74)';
  ctx.strokeStyle = 'rgba(126, 162, 214, 0.18)';
  ctx.lineWidth = dpr;
  ctx.beginPath();
  ctx.roundRect(14 * dpr, 14 * dpr, 238 * dpr, 54 * dpr, 8 * dpr);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(245,249,255,.96)';
  ctx.font = `900 ${13 * dpr}px var(--ui-font, Segoe UI)`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${slot} · ${label}`, 28 * dpr, 36 * dpr);
  ctx.fillStyle = 'rgba(178, 198, 224, 0.80)';
  ctx.font = `700 ${11 * dpr}px var(--ui-font, Segoe UI)`;
  ctx.fillText(`${scenarioLabel || 'Démo IA'} · phase ${phase}`, 28 * dpr, 55 * dpr);

  const pulse = progress01;
  ctx.fillStyle = 'rgba(126,162,214,.20)';
  ctx.fillRect(28 * dpr, 62 * dpr, 196 * dpr, 3 * dpr);
  ctx.fillStyle = 'rgba(236,196,96,.86)';
  ctx.fillRect(28 * dpr, 62 * dpr, 196 * pulse * dpr, 3 * dpr);
  ctx.restore();
}

export function drawSessionRealAbilityDemo(ctx, canvas, card, abilityIndex, phase, time, scenarioIndex = 0) {
  const view = resizeCanvas(canvas);
  const ability = card.abilities?.[abilityIndex] || card.abilities?.[0] || null;
  const slot = ability?.key || 'A';
  const clock = demoClock(time, card.id, slot, scenarioIndex);
  const u = clock.u;
  const t = clock.t;
  const scene = buildScene(card.id, slot, phase, u, t, scenarioIndex);
  const scenarios = typeof ability?.getScenarios === 'function' ? ability.getScenarios(phase) : [];
  const scenarioLabel = scenarios?.[scenarioIndex]?.label || '';
  applyRealScenario(scene, card.id, slot, phase, t, clock.duration, scenarioLabel);
  const fxKey = `${card.id}:${slot}:${phase}:${scenarioIndex}`;
  syncDemoFx(scene, fxKey, t, time);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid(ctx, view, scene.camX, scene.camY);

  for (const effect of scene.areas) drawAreaEffect(ctx, view, effect, scene.camX, scene.camY, time);
  DEMO_FX.drawTrails(ctx, view, scene.camX, scene.camY, time);
  for (const p of scene.projectiles) drawProjectile(ctx, view, p, scene.camX, scene.camY);
  for (const ship of scene.ships) drawShip(ctx, view, ship, scene.camX, scene.camY, time, null, scene.ships, []);
  DEMO_FX.drawImpacts(ctx, view, scene.camX, scene.camY, time);
  DEMO_FX.drawDamageNumbers(ctx, view, scene.camX, scene.camY, time);

  const screen = (world) => ({ x: (world.x - scene.camX) + view.cssW * 0.5, y: (world.y - scene.camY) + view.cssH * 0.5 });
  const self = screen(scene.ships[0]);
  const target = screen(scene.ships[1]);
  const palette = getShipFramePalette(card.id);
  if (dist(self.x, self.y, target.x, target.y) < 170) {
    drawDemoLabel(ctx, view, slot === 'Z' && card.id === 'bulwark' ? 'PULL' : slot === 'R' ? 'BURST' : 'HIT', target.x, target.y - 72, rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.94));
  }
  drawDemoHud(ctx, view, card, slot, phase, time, u, scenarioLabel);
}
