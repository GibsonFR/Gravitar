import { rgba } from '../../core/Math.js';
import { drawAreaEffect } from '../../abilities/AreaEffectRenderer.js';
import { drawShip } from '../../entities/ship/ShipRenderer.js';
import { drawProjectile } from '../../projectile/ProjectileRenderer.js';
import { getShipFramePalette } from '../../entities/ship/ShipFramePalette.js';

const PHASE_TO_LEVEL = Object.freeze({ 1: 1, 2: 3, 3: 6, 4: 10, 5: 15 });

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

function buildVanguard(slot, phase, u) {
  const color = { r: 125, g: 233, b: 255 };
  const enemyX = 180;
  const enemyY = -6;
  const cast = clamp01((u - 0.15) / 0.38);
  const dash = slot === 'Z' ? easeOut(cast) : 0;
  const phaseMove = slot === 'E' ? easeInOut(clamp01((u - 0.12) / 0.45)) : 0;
  const ultRush = slot === 'R' ? Math.sin(u * Math.PI * 2) * 22 : 0;
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

  if (slot === 'A') {
    const p = clamp01((u - 0.10) / 0.48);
    projectiles.push(projectile(101, lerp(x + 26, enemyX, p), lerp(y, enemyY, p), 1050, -20, 4.5 + phase * 0.7, color, { slot: 'A' }));
    if (p > 0.78) areas.push(area(102, enemyX, enemyY, 34 + phase * 4, color, { durationLeft: 0.8 }));
  } else if (slot === 'Z') {
    areas.push(area(103, -160 + dash * 63, -6, 28 + phase * 5, color, { durationLeft: 1.0 }));
  } else if (slot === 'E') {
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

function buildSigil(slot, phase, u) {
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

function buildBulwark(slot, phase, u) {
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

function buildScene(frameId, slot, phase, u) {
  if (frameId === 'sigil') return buildSigil(slot, phase, u);
  if (frameId === 'bulwark') return buildBulwark(slot, phase, u);
  return buildVanguard(slot, phase, u);
}

function drawDemoHud(ctx, view, card, slot, phase, time) {
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
  ctx.fillText(`Démo IA · phase ${phase}`, 28 * dpr, 55 * dpr);

  const pulse = (time % 4.8) / 4.8;
  ctx.fillStyle = 'rgba(126,162,214,.20)';
  ctx.fillRect(28 * dpr, 62 * dpr, 196 * dpr, 3 * dpr);
  ctx.fillStyle = 'rgba(236,196,96,.86)';
  ctx.fillRect(28 * dpr, 62 * dpr, 196 * pulse * dpr, 3 * dpr);
  ctx.restore();
}

export function drawSessionRealAbilityDemo(ctx, canvas, card, abilityIndex, phase, time) {
  const view = resizeCanvas(canvas);
  const slot = card.abilities?.[abilityIndex]?.key || 'A';
  const u = (time % 4.8) / 4.8;
  const scene = buildScene(card.id, slot, phase, u);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid(ctx, view, scene.camX, scene.camY);

  for (const effect of scene.areas) drawAreaEffect(ctx, view, effect, scene.camX, scene.camY, time);
  for (const p of scene.projectiles) drawProjectile(ctx, view, p, scene.camX, scene.camY);
  for (const ship of scene.ships) drawShip(ctx, view, ship, scene.camX, scene.camY, time, null, scene.ships, []);

  const screen = (world) => ({ x: (world.x - scene.camX) + view.cssW * 0.5, y: (world.y - scene.camY) + view.cssH * 0.5 });
  const self = screen(scene.ships[0]);
  const target = screen(scene.ships[1]);
  const palette = getShipFramePalette(card.id);
  if (dist(self.x, self.y, target.x, target.y) < 170) {
    drawDemoLabel(ctx, view, slot === 'Z' && card.id === 'bulwark' ? 'PULL' : slot === 'R' ? 'BURST' : 'HIT', target.x, target.y - 72, rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.94));
  }
  drawDemoHud(ctx, view, card, slot, phase, time);
}
