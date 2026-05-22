import { rgba } from '../../core/Math.js';
import { drawAreaEffect } from '../../abilities/AreaEffectRenderer.js';
import { drawShip } from '../../entities/ship/ShipRenderer.js';
import { drawProjectile } from '../../projectile/ProjectileRenderer.js';
import { getShipFramePalette } from '../../entities/ship/ShipFramePalette.js';
import { VisualFxStore } from '../../fx/VisualFxStore.js';
import { getShipFrameDef } from '../../../../shared/content/frames/ShipFrameRegistry.js';
import { getVanguardAbilityTuning, VANGUARD_PASSIVE } from '../../../../shared/content/frames/vanguard/VanguardFrameSpec.js';
import { getSigilAbilityTuning, SIGIL_PASSIVE } from '../../../../shared/content/frames/sigil/SigilFrameSpec.js';
import { getBulwarkAbilityTuning, BULWARK_PASSIVE } from '../../../../shared/content/frames/bulwark/BulwarkFrameSpec.js';

const PHASE_TO_LEVEL = Object.freeze({ 1: 1, 2: 3, 3: 6, 4: 10, 5: 15 });
const DEMO_FX = new VisualFxStore();
let fxKey = '';
let fxLastLocalT = -1;
let fxLastTime = 0;

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function smooth(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
function easeOut(t) { return 1 - Math.pow(1 - clamp01(t), 3); }
function dist(a, b, c, d) { return Math.hypot(a - c, b - d); }
function levelFor(slot, phase) { return slot === 'R' ? Math.max(1, Math.min(5, phase | 0)) : (PHASE_TO_LEVEL[Math.max(1, Math.min(5, phase | 0))] || 1); }
function safeNum(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function color(frameId) {
  if (frameId === 'sigil') return { r: 198, g: 128, b: 255 };
  if (frameId === 'bulwark') return { r: 236, g: 196, b: 96 };
  return { r: 125, g: 233, b: 255 };
}
function status(id, frameId, label = '') {
  const c = color(frameId);
  return { id, label: label || id, primaryColor: c, secondaryColor: c };
}
function tuning(frameId, slot, phase) {
  const lvl = levelFor(slot, phase);
  if (frameId === 'sigil') return getSigilAbilityTuning(slot, lvl, 0);
  if (frameId === 'bulwark') return getBulwarkAbilityTuning(slot, lvl, 22);
  return getVanguardAbilityTuning(slot, lvl, 0);
}
function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
  const cssW = Math.max(1, Math.floor(rect.width || 760));
  const cssH = Math.max(1, Math.floor(rect.height || 330));
  const pxW = Math.floor(cssW * dpr);
  const pxH = Math.floor(cssH * dpr);
  if (canvas.width !== pxW || canvas.height !== pxH) {
    canvas.width = pxW;
    canvas.height = pxH;
  }
  return { dpr, cssW, cssH };
}
function makeVitals(hp, shield, energy, maxHp, maxShield, maxEnergy) {
  return { hp, maxHp, shield, maxShield, energy, maxEnergy };
}
function baseShip(id, frameId, x, y, rot, opts = {}) {
  const def = getShipFrameDef(frameId);
  const stats = def?.stats || {};
  const palette = getShipFramePalette(frameId);
  const hp = safeNum(stats.maxHp, 120);
  const shield = safeNum(stats.maxShield, 40);
  const energy = safeNum(stats.maxEnergy, 100);
  return {
    id,
    pseudo: opts.pseudo || (id === 1 ? 'Preview' : 'DUMMY'),
    frameId,
    x,
    y,
    vx: opts.vx || 0,
    vy: opts.vy || 0,
    rot,
    sx: 0,
    sy: 0,
    radius: safeNum(stats.radius, 18),
    engine: safeNum(stats.engine, 240),
    level: opts.level || 1,
    statuses: opts.statuses || [],
    frameState: opts.frameState || null,
    _localThrust: opts.thrust ?? 0,
    vitals: opts.vitals || makeVitals(hp, shield, energy, hp, shield, energy),
    color: palette.hull
  };
}
function projectile(id, slot, x, y, vx, vy, r, frameId, extra = {}) {
  return {
    id,
    x,
    y,
    vx,
    vy,
    radius: r,
    tint: color(frameId),
    sourceKind: 'player',
    sourceAbilitySlot: slot,
    visualKind: slot === 'AA' ? 'auto' : 'ability',
    rangeLeft: 900,
    ...extra
  };
}
function area(id, x, y, radius, frameId, extra = {}) {
  return {
    id,
    x,
    y,
    radius,
    color: color(frameId),
    durationLeft: extra.durationLeft ?? 2,
    kind: extra.kind || 'ability_demo_zone',
    ...extra
  };
}
function pointAt(from, to, p) {
  return { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p) };
}
function addShot(scene, id, frameId, slot, from, to, t, start, travel, opts = {}) {
  const p = (t - start) / travel;
  if (p >= 0 && p <= 1) {
    const at = pointAt(from, to, easeOut(p));
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    scene.projectiles.push(projectile(id, slot, at.x, at.y, dx / len * (opts.speed || 980), dy / len * (opts.speed || 980), opts.radius || (slot === 'AA' ? 4 : 5.5), frameId, opts));
  }
  if (Math.abs(t - (start + travel)) < 0.05) {
    scene.damageEvents.push({
      id: `dmg-${id}-${Math.round(start * 100)}`,
      type: 'damage',
      targetId: to.id || 2,
      x: to.x,
      y: to.y,
      amount: opts.damage || 10,
      crit: !!opts.crit,
      shielded: !!opts.shielded,
      periodic: !!opts.periodic
    });
  }
  return t >= start + travel;
}
function addAutoSequence(scene, frameId, self, target, t, times, opts = {}) {
  let hits = 0;
  const startX = self.x + Math.cos(self.rot) * 22;
  const startY = self.y + Math.sin(self.rot) * 22;
  for (let i = 0; i < times.length; i += 1) {
    const hit = addShot(scene, 1000 + i, frameId, 'AA', { x: startX, y: startY }, target, t, times[i], opts.travel ?? 0.28, {
      radius: opts.empowered ? 5.3 : 4.2,
      speed: 1040,
      damage: opts.damage || 12,
      empoweredAutoUsed: !!opts.empowered,
      ultAutoUsed: !!opts.ult,
      crit: !!opts.crit && i % 3 === 2
    });
    if (hit) hits += 1;
  }
  return hits;
}
function addRuneMarks(scene, x, y, stacks, t) {
  const n = Math.max(0, Math.min(5, stacks | 0));
  for (let i = 0; i < n; i += 1) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5 + t * 0.8;
    scene.areas.push(area(3200 + i, x + Math.cos(a) * 34, y + Math.sin(a) * 34, 9, 'sigil', { durationLeft: 1.2 }));
  }
}
function resetFxIfNeeded(key, localT, absoluteT) {
  const loop = fxKey !== key || localT + 0.08 < fxLastLocalT || absoluteT < fxLastTime;
  if (loop) {
    DEMO_FX.trails.clear();
    DEMO_FX.impacts = [];
    DEMO_FX.rings = [];
    DEMO_FX.damageNumbers = [];
    DEMO_FX.castBursts = [];
    DEMO_FX.lastProjectiles.clear();
    DEMO_FX.lastAreas.clear();
    DEMO_FX.lastStatuses.clear();
  }
  fxKey = key;
  fxLastLocalT = localT;
  fxLastTime = absoluteT;
}
function syncFx(scene, key, localT, absoluteT) {
  resetFxIfNeeded(key, localT, absoluteT);
  const mock = {
    projectiles: new Map(scene.projectiles.map((p) => [p.id, p])),
    areaEffects: new Map(scene.areas.map((a) => [a.id, a])),
    players: new Map(scene.ships.map((p) => [p.id, p])),
    mobs: new Map(),
    asteroids: new Map(),
    getMe: () => scene.ships[0],
    consumePendingCombatFx: () => scene.damageEvents
  };
  DEMO_FX.sync(mock, absoluteT);
}
function durationFor(frameId, slot, scenarioIndex) {
  if (slot === 'R') return 6.2;
  if (slot === 'P') return 5.4;
  if (slot === 'A') return scenarioIndex > 0 ? 4.8 : 3.4;
  if (slot === 'Z') return 4.6;
  if (slot === 'E') return 4.8;
  return 4.8;
}
function clock(time, frameId, slot, scenarioIndex) {
  const duration = durationFor(frameId, slot, scenarioIndex);
  const t = time % duration;
  return { duration, t, u: t / duration };
}
function drawGrid(ctx, view, camX, camY) {
  const { dpr, cssW: w, cssH: h } = view;
  ctx.save();
  ctx.fillStyle = 'rgba(5, 9, 16, 0.98)';
  ctx.fillRect(0, 0, w * dpr, h * dpr);
  const grad = ctx.createRadialGradient(w * 0.52 * dpr, h * 0.50 * dpr, 0, w * 0.52 * dpr, h * 0.50 * dpr, Math.max(w, h) * 0.72 * dpr);
  grad.addColorStop(0, 'rgba(32, 50, 76, 0.22)');
  grad.addColorStop(1, 'rgba(3, 6, 11, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w * dpr, h * dpr);
  ctx.strokeStyle = 'rgba(126, 162, 214, 0.105)';
  ctx.lineWidth = dpr;
  const step = 96;
  const ox = ((-camX + w * 0.5) % step + step) % step;
  const oy = ((-camY + h * 0.5) % step + step) % step;
  for (let x = ox; x <= w; x += step) { ctx.beginPath(); ctx.moveTo(x * dpr, 0); ctx.lineTo(x * dpr, h * dpr); ctx.stroke(); }
  for (let y = oy; y <= h; y += step) { ctx.beginPath(); ctx.moveTo(0, y * dpr); ctx.lineTo(w * dpr, y * dpr); ctx.stroke(); }
  for (let i = 0; i < 52; i += 1) {
    const x = ((Math.sin(i * 47.13) * 10000) % w + w) % w;
    const y = ((Math.cos(i * 31.79) * 10000) % h + h) % h;
    ctx.fillStyle = `rgba(210,230,255,${0.12 + (i % 6) * 0.035})`;
    ctx.fillRect(x * dpr, y * dpr, dpr, dpr);
  }
  ctx.restore();
}
function drawMiniHud(ctx, view, card, ability, phase, scenarioLabel, progress) {
  const dpr = view.dpr;
  ctx.save();
  ctx.fillStyle = 'rgba(4, 8, 14, 0.74)';
  ctx.strokeStyle = 'rgba(126, 162, 214, 0.18)';
  ctx.lineWidth = dpr;
  ctx.beginPath();
  ctx.roundRect(14 * dpr, 14 * dpr, 245 * dpr, 56 * dpr, 8 * dpr);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(245,249,255,.96)';
  ctx.font = `900 ${12 * dpr}px var(--ui-font, Segoe UI)`;
  ctx.textAlign = 'left';
  ctx.fillText(`${ability?.key || 'A'} · ${ability?.name || ability?.label || ''}`, 28 * dpr, 36 * dpr);
  ctx.fillStyle = 'rgba(178,198,224,.82)';
  ctx.font = `700 ${10.5 * dpr}px var(--ui-font, Segoe UI)`;
  ctx.fillText(`${scenarioLabel || 'Scénario'} · phase ${phase}`, 28 * dpr, 55 * dpr);
  ctx.fillStyle = rgba(color(card.id).r, color(card.id).g, color(card.id).b, 0.30);
  ctx.fillRect(28 * dpr, 62 * dpr, 196 * dpr, 3 * dpr);
  ctx.fillStyle = rgba(color(card.id).r, color(card.id).g, color(card.id).b, 0.88);
  ctx.fillRect(28 * dpr, 62 * dpr, 196 * clamp01(progress) * dpr, 3 * dpr);
  ctx.restore();
}
function buildSceneBase(frameId, phase, slot, t) {
  const selfX = -155;
  const selfY = 0;
  const targetX = 160;
  const targetY = 0;
  const self = baseShip(1, frameId, selfX, selfY, 0, { pseudo: 'Preview', level: levelFor(slot, phase), thrust: 0.35 });
  const target = baseShip(2, frameId === 'bulwark' ? 'vanguard' : 'bulwark', targetX, targetY, Math.PI, { pseudo: 'DUMMY', level: 1, thrust: 0 });
  self.rot = Math.atan2(target.y - self.y, target.x - self.x);
  target.rot = Math.atan2(self.y - target.y, self.x - target.x);
  return { ships: [self, target], projectiles: [], areas: [], damageEvents: [], camX: 0, camY: 0, localT: t };
}
function applyVanguard(scene, slot, phase, t, scenarioLabel) {
  const self = scene.ships[0];
  const target = scene.ships[1];
  const a = tuning('vanguard', 'A', phase);
  const z = tuning('vanguard', 'Z', phase);
  const e = tuning('vanguard', 'E', phase);
  const r = tuning('vanguard', 'R', phase);
  const combo = /Z1|combo/i.test(scenarioLabel || '');
  const force10 = /P\(10\)|10/.test(scenarioLabel || '');
  const autoTimes = slot === 'R' ? [0.35, 0.78, 1.21, 1.64, 2.07, 2.50, 2.93, 3.36, 3.79, 4.22, 4.65] : [0.38, 1.08, 1.78, 2.48, 3.18, 3.88, 4.58];
  let heat = addAutoSequence(scene, 'vanguard', self, target, t, autoTimes, { damage: 13, empowered: slot === 'R' || force10, ult: slot === 'R', crit: force10 });
  if (slot === 'P') heat = Math.min(10, Math.floor(t / 0.42) + 1);
  if (/P\(6\)/.test(scenarioLabel || '')) heat = Math.max(6, Math.min(10, heat));
  if (force10) heat = 10;
  let empoweredCharges = 0;
  let comboWindowLeft = 0;
  let phaseLeft = 0;
  let ultLeft = 0;

  if (slot === 'Z' || /Z1/.test(scenarioLabel || '')) {
    const start = 0.32;
    const d = z.dashDistance || 140;
    const p = clamp01((t - start) / 0.24);
    if (p > 0 && p < 1) {
      self.x = -155 + easeOut(p) * d;
      self.vx = 900;
      self._localThrust = 1;
    } else if (t >= start + 0.24) self.x = -155 + d;
    self.rot = Math.atan2(target.y - self.y, target.x - self.x);
    if (t >= start && t < start + safeNum(z.moveBoostDuration, 1.2)) {
      self.statuses.push(status('haste', 'vanguard', 'Z'));
      comboWindowLeft = Math.max(0, safeNum(z.comboWindowDuration, 0) - (t - start));
    }
    if (safeNum(z.trailSlowPct, 0) > 0 && t >= start && t < start + 1.2) scene.areas.push(area(201, -80, 0, 48, 'vanguard', { durationLeft: 1.0, statusId: 'slow', label: 'Slow' }));
  }
  if (slot === 'A' || /A1/.test(scenarioLabel || '')) {
    const start = combo ? 0.94 : 0.48;
    const from = { x: self.x + Math.cos(self.rot) * 24, y: self.y + Math.sin(self.rot) * 24 };
    const dmg = Math.round(safeNum(a.damageFlat, 10) + 13 * safeNum(a.damagePct, 0.7) + (combo ? 13 * safeNum(a.comboDamagePct, 0) : 0));
    if (addShot(scene, 301, 'vanguard', 'A', from, target, t, start, combo ? 0.25 : 0.34, { speed: safeNum(a.projectileSpeed, 1100), radius: Math.max(5, safeNum(a.projectileWidth, 22) * 0.22), damage: dmg, crit: combo || force10 })) {
      heat = Math.min(10, heat + 1);
      empoweredCharges = safeNum(a.empowerCharges, 1);
      target.statuses.push(status('damage_amp', 'vanguard', 'A'));
      if (phase >= 5) target.statuses.push(status('disarm', 'vanguard', 'A'));
    }
  }
  if (slot === 'E' || /E1/.test(scenarioLabel || '')) {
    const start = 0.38;
    if (t >= start && t < start + safeNum(e.phaseDuration, 1.2)) {
      self.statuses.push(status('spell_shield', 'vanguard', 'E'));
      phaseLeft = Math.max(0, safeNum(e.phaseDuration, 1.2) - (t - start));
      scene.areas.push(area(401, self.x, self.y, 70, 'vanguard', { color: { r: 124, g: 154, b: 255 }, durationLeft: phaseLeft, label: 'Phase' }));
    }
    const end = start + safeNum(e.phaseDuration, 1.2);
    if (safeNum(e.exitRadius, 0) > 0 && Math.abs(t - end) < 0.30) scene.areas.push(area(402, self.x, self.y, safeNum(e.exitRadius, 90), 'vanguard', { durationLeft: 0.5, statusId: 'grounded', label: 'Grounded' }));
    if (t >= end && t < end + safeNum(e.groundedDuration, 1.2)) target.statuses.push(status('grounded', 'vanguard', 'E'));
  }
  if (slot === 'R' || /R1/.test(scenarioLabel || '')) {
    const start = 0.25;
    if (t >= start && t < start + safeNum(r.ultDuration, 4)) {
      ultLeft = Math.max(0, safeNum(r.ultDuration, 4) - (t - start));
      self.statuses.push(status('haste', 'vanguard', 'R'));
      scene.areas.push(area(501, self.x, self.y, 88, 'vanguard', { color: { r: 255, g: 116, b: 238 }, durationLeft: ultLeft, label: 'R' }));
      if (phase >= 2) target.statuses.push(status('burn', 'vanguard', 'R'));
      if (phase >= 5 && /A1/.test(scenarioLabel || '') && t > 1.2) target.statuses.push(status('stun', 'vanguard', 'R+A'));
    }
  }
  if (heat >= 6) self.statuses.push(status('tenacity', 'vanguard', 'Surchauffe'));
  const hpLoss = Math.min(82, heat * 4 + (slot === 'A' && t > 0.9 ? 24 : 0) + (slot === 'R' ? Math.floor(t * 10) : 0));
  target.vitals.hp = Math.max(18, target.vitals.maxHp - hpLoss);
  self.frameState = {
    kind: 'vanguard',
    passiveName: 'Surchauffe',
    passiveStacks: Math.max(0, Math.min(VANGUARD_PASSIVE.maxStacks, heat)),
    passiveMaxStacks: VANGUARD_PASSIVE.maxStacks,
    passiveDecayLeft: heat > 0 ? Math.max(0, VANGUARD_PASSIVE.stackDuration - (t % VANGUARD_PASSIVE.stackDuration)) : 0,
    empoweredCharges,
    empoweredMaxCharges: safeNum(a.empowerCharges, 1),
    comboWindowLeft,
    moveBoostLeft: comboWindowLeft,
    phaseLeft,
    ultLeft
  };
}
function applySigil(scene, slot, phase, t, scenarioLabel) {
  const self = scene.ships[0];
  const target = scene.ships[1];
  const a = tuning('sigil', 'A', phase);
  const z = tuning('sigil', 'Z', phase);
  const e = tuning('sigil', 'E', phase);
  const r = tuning('sigil', 'R', phase);
  let runeHits = 0;
  let runeLimit = /x5|P\(5\)|détonation/i.test(scenarioLabel || '') ? 5 : (/x3|P\(3\)/i.test(scenarioLabel || '') ? 3 : 1);
  const aTimes = Array.from({ length: runeLimit }, (_, i) => 0.42 + i * 0.58);
  if (slot !== 'A' && slot !== 'P' && !/A1/.test(scenarioLabel || '')) aTimes.length = 0;
  if (slot === 'R' || /R1/.test(scenarioLabel || '')) aTimes.push(1.2, 1.65, 2.1);
  if (slot === 'Z' || /Z1/.test(scenarioLabel || '')) {
    const start = 0.28;
    if (t >= start && t < start + safeNum(z.zZoneDuration, 3)) {
      scene.areas.push(area(801, target.x, target.y, safeNum(z.zZoneRadius, 84), 'sigil', { kind: 'test_effect_zone', phase: 'active', statusId: phase >= 5 ? 'suppress' : 'slow', label: phase >= 5 ? 'Suppress' : 'Slow', durationLeft: safeNum(z.zZoneDuration, 3) - (t - start) }));
      target.statuses.push(status('slow', 'sigil', 'Z'));
      if (safeNum(z.zRunePulseStacks, 0) > 0 && t > start + 0.8) runeHits += Math.min(2, safeNum(z.zRunePulseStacks, 1));
    }
    if (/fermeture/i.test(scenarioLabel || '') && t > 2.6) target.statuses.push(status(phase >= 5 ? 'suppress' : 'root', 'sigil', 'Z'));
  }
  if (slot === 'E' || /E1/.test(scenarioLabel || '')) {
    const start = 0.30;
    const p = clamp01((t - start) / 0.32);
    if (p > 0 && p < 1) {
      self.x = -155 + easeOut(p) * safeNum(e.eDashDistance, 90);
      self.y = -Math.sin(p * Math.PI) * 34;
      self.vx = 650;
      self._localThrust = 0.9;
    } else if (t >= start + 0.32) self.x = -155 + safeNum(e.eDashDistance, 90);
    self.rot = Math.atan2(target.y - self.y, target.x - self.x);
    if (t >= start && t < start + safeNum(e.eCamouflageDuration, 1.2)) {
      self.statuses.push(status('camouflage', 'sigil', 'E'));
      scene.areas.push(area(811, self.x, self.y, 52, 'sigil', { durationLeft: 1.1, statusId: 'camouflage', label: 'Voile' }));
    }
  }
  if (slot === 'R' || /R1/.test(scenarioLabel || '')) {
    const start = 0.25;
    if (t >= start && t < start + safeNum(r.ultDuration, 4)) {
      scene.areas.push(area(821, target.x - 8, target.y, 112, 'sigil', { kind: 'test_effect_zone', phase: 'active', statusId: 'silence', label: 'Convergence', durationLeft: safeNum(r.ultDuration, 4) - (t - start) }));
      self.statuses.push(status('lifesteal', 'sigil', 'R'));
    }
  }
  for (let i = 0; i < aTimes.length; i += 1) {
    const start = aTimes[i];
    const from = { x: self.x + Math.cos(self.rot) * 24, y: self.y + Math.sin(self.rot) * 24 };
    const dmg = Math.round(safeNum(a.aImpactDamageFlat, 10) + 12.5 * safeNum(a.aImpactDamagePct, 0.7));
    if (addShot(scene, 900 + i, 'sigil', 'A', from, target, t, start, 0.30, { speed: safeNum(a.aProjectileSpeed, 1120), radius: 5.5, damage: dmg, crit: runeHits + i >= 4 })) runeHits += 1;
  }
  if (slot === 'P') runeHits = Math.max(runeHits, Math.min(5, Math.floor(t / 0.55) + 1));
  const runes = Math.min(SIGIL_PASSIVE.maxRunes, runeHits);
  if (runes >= 3) target.statuses.push(status('slow', 'sigil', 'Runes'));
  if (runes >= 5) {
    target.statuses.push(status('stun', 'sigil', 'Détonation'));
    scene.areas.push(area(831, target.x, target.y, 64, 'sigil', { durationLeft: 0.8, label: 'Détonation' }));
  }
  addRuneMarks(scene, target.x, target.y, runes, t);
  target.vitals.hp = Math.max(18, target.vitals.maxHp - runes * 13 - (runes >= 5 ? 30 : 0));
  self.frameState = {
    kind: 'sigil',
    passiveName: 'Runes',
    passiveStacks: runes,
    passiveMaxStacks: SIGIL_PASSIVE.maxRunes,
    detonationCooldownLeft: runes >= 5 ? 1.6 : 0,
    zoneActive: slot === 'Z' || slot === 'R' || runes > 0,
    veilLeft: self.statuses.some((s) => s.id === 'camouflage') ? 1 : 0,
    ultLeft: slot === 'R' ? Math.max(0, safeNum(r.ultDuration, 4) - (t - 0.25)) : 0
  };
}
function applyBulwark(scene, slot, phase, t, scenarioLabel) {
  const self = scene.ships[0];
  const target = scene.ships[1];
  const a = tuning('bulwark', 'A', phase);
  const z = tuning('bulwark', 'Z', phase);
  const e = tuning('bulwark', 'E', phase);
  const r = tuning('bulwark', 'R', phase);
  const incoming = [0.38, 0.92, 1.46, 2.0, 2.54];
  let plates = slot === 'P' ? Math.min(BULWARK_PASSIVE.maxPlates, Math.floor(t / 0.55) + 1) : Math.min(BULWARK_PASSIVE.maxPlates, phase);
  if (/pleine|full/i.test(scenarioLabel || '')) plates = BULWARK_PASSIVE.maxPlates;
  if (slot === 'P') {
    for (let i = 0; i < incoming.length; i += 1) {
      addShot(scene, 1200 + i, 'bulwark', 'AA', { x: target.x, y: target.y }, self, t, incoming[i], 0.25, { radius: 4.4, speed: 900, damage: 16, shielded: i < 2 });
    }
    self.statuses.push(status('armor_up', 'bulwark', 'Plaques'));
  }
  if (slot === 'A' || /A1/.test(scenarioLabel || '')) {
    const start = 0.32;
    if (t >= start && t < start + safeNum(a.anchorDuration, 2.2)) {
      self.statuses.push(status('armor_up', 'bulwark', 'A'));
      scene.areas.push(area(1301, self.x, self.y, safeNum(a.anchorPulseRadius, 80) || 80, 'bulwark', { durationLeft: safeNum(a.anchorDuration, 2.2) - (t - start), label: 'Carapace' }));
      if (phase >= 3) target.statuses.push(status('slow', 'bulwark', 'Pulse'));
      if (phase >= 4) target.statuses.push(status('taunt', 'bulwark', 'A'));
    }
  }
  if (slot === 'Z' || /Z1/.test(scenarioLabel || '')) {
    const start = 0.44;
    const hit = addShot(scene, 1401, 'bulwark', 'Z', { x: self.x + 22, y: self.y }, target, t, start, 0.32, { radius: 6.2, speed: safeNum(z.harpoonProjectileSpeed, 1100), damage: Math.round(safeNum(z.harpoonDamageFlat, 12) + 12 * safeNum(z.harpoonDamageWeaponPct, 0.7) + 22 * safeNum(z.harpoonDamageArmorPct, 0)), crit: phase >= 4 });
    if (hit) {
      target.statuses.push(status('taunt', 'bulwark', 'Z'));
      if (phase >= 2) target.statuses.push(status('armor_shred', 'bulwark', 'Shred'));
      if (phase >= 3) target.statuses.push(status('grounded', 'bulwark', 'Grounded'));
    }
    const pull = clamp01((t - start - 0.32) / 0.7);
    if (pull > 0) {
      if (phase >= 5) target.x = lerp(target.x, self.x + 72, smooth(pull));
      if (phase >= 4) self.x = lerp(self.x, target.x - 84, smooth(pull));
      self.rot = Math.atan2(target.y - self.y, target.x - self.x);
      target.rot = Math.atan2(self.y - target.y, self.x - target.x);
    }
  }
  if (slot === 'E' || /E1/.test(scenarioLabel || '')) {
    const start = 0.30;
    if (t >= start && t < start + safeNum(e.meditationDuration, 2.7)) {
      self.statuses.push(status('tenacity', 'bulwark', 'E'), status('armor_up', 'bulwark', 'E'));
      scene.areas.push(area(1501, self.x, self.y, safeNum(e.meditationPulseRadius, 86) || 86, 'bulwark', { color: { r: 120, g: 210, b: 255 }, durationLeft: safeNum(e.meditationDuration, 2.7) - (t - start), label: 'Méditation' }));
      self.vitals.hp = Math.min(self.vitals.maxHp, self.vitals.hp + Math.floor((t - start) * 12));
    }
    const end = start + safeNum(e.meditationDuration, 2.7);
    if (t >= end && t < end + 1.2 && phase >= 3) target.statuses.push(status(phase >= 5 ? 'grounded' : 'slow', 'bulwark', 'E'));
  }
  if (slot === 'R' || /R1/.test(scenarioLabel || '')) {
    const start = 0.26;
    if (t >= start && t < start + safeNum(r.stormDuration, 4)) {
      scene.areas.push(area(1601, self.x, self.y, safeNum(r.stormRadius, 132), 'bulwark', { kind: 'test_effect_zone', phase: 'active', statusId: 'slow', label: 'Tempête', durationLeft: safeNum(r.stormDuration, 4) - (t - start) }));
      target.statuses.push(status('slow', 'bulwark', 'R'));
      if (phase >= 2) target.statuses.push(status('taunt', 'bulwark', 'R'));
      if (phase >= 3 && t > start + safeNum(r.stormExposureStunThreshold, 1.8)) target.statuses.push(status('stun', 'bulwark', 'R'));
      if (phase >= 4) target.x = lerp(target.x, self.x + 90, 0.04);
      if (Math.abs((t - start) % 0.5) < 0.05) scene.damageEvents.push({ id: 'storm-dot', type: 'damage', targetId: target.id, x: target.x, y: target.y, amount: Math.round(safeNum(r.stormBaseDpsFlat, 10) * 0.5), periodic: true });
    }
  }
  if (plates >= BULWARK_PASSIVE.maxPlates) self.statuses.push(status('tenacity', 'bulwark', 'Plaques'));
  target.vitals.hp = Math.max(18, target.vitals.maxHp - (slot === 'Z' && t > 0.8 ? 42 : 0) - (slot === 'R' ? Math.floor(t * 12) : 0));
  self.frameState = {
    kind: 'bulwark',
    passiveName: 'Plaques',
    passiveStacks: plates,
    passiveMaxStacks: BULWARK_PASSIVE.maxPlates,
    anchorLeft: slot === 'A' ? Math.max(0, safeNum(a.anchorDuration, 2.2) - (t - 0.32)) : 0,
    meditationLeft: slot === 'E' ? Math.max(0, safeNum(e.meditationDuration, 2.7) - (t - 0.30)) : 0,
    stormLeft: slot === 'R' ? Math.max(0, safeNum(r.stormDuration, 4) - (t - 0.26)) : 0,
    stormArmorStolen: slot === 'R' ? Math.min(safeNum(r.stormStealCap, 0), Math.floor(t * safeNum(r.stormArmorStealPerSecond, 0))) : 0,
    stormShieldGained: slot === 'R' && phase >= 4 ? 18 : 0
  };
}
function buildScenario(card, ability, phase, localT, scenarioIndex) {
  const frameId = card.id || 'vanguard';
  const slot = ability?.key || 'A';
  const scenario = typeof ability?.getScenarios === 'function' ? ability.getScenarios(phase)?.[scenarioIndex] : null;
  const label = scenario?.label || '';
  const scene = buildSceneBase(frameId, phase, slot, localT);
  if (frameId === 'sigil') applySigil(scene, slot, phase, localT, label);
  else if (frameId === 'bulwark') applyBulwark(scene, slot, phase, localT, label);
  else applyVanguard(scene, slot, phase, localT, label);
  return { scene, label };
}

export function drawSessionRealAbilityDemo(ctx, canvas, card, abilityIndex, phase, time, scenarioIndex = 0) {
  const view = resizeCanvas(canvas);
  const ability = card.abilities?.[abilityIndex] || card.abilities?.[0] || { key: 'A', label: 'A' };
  const c = clock(time, card.id, ability.key || 'A', scenarioIndex);
  const { scene, label } = buildScenario(card, ability, phase, c.t, scenarioIndex);
  syncFx(scene, `${card.id}:${ability.key}:${phase}:${scenarioIndex}`, c.t, time);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid(ctx, view, scene.camX, scene.camY);
  for (const a of scene.areas) drawAreaEffect(ctx, view, a, scene.camX, scene.camY, time);
  DEMO_FX.drawTrails(ctx, view, scene.camX, scene.camY, time);
  for (const p of scene.projectiles) drawProjectile(ctx, view, p, scene.camX, scene.camY);
  for (const s of scene.ships) drawShip(ctx, view, s, scene.camX, scene.camY, time, null, scene.ships, []);
  DEMO_FX.drawImpacts(ctx, view, scene.camX, scene.camY, time);
  DEMO_FX.drawDamageNumbers(ctx, view, scene.camX, scene.camY, time);
  drawMiniHud(ctx, view, card, ability, phase, label, c.u);
}
