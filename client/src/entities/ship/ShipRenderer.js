import { clamp, rgba, polar } from '../../core/Math.js';
import { COLORS } from '../../core/Colors.js';
import { drawWorldHealthBars } from '../../ui/worldbars/WorldHealthBarRenderer.js';
import { SHIP_WORLD_BAR_STYLE } from './ShipWorldBarStyle.js';
import { getShipFramePalette } from './ShipFramePalette.js';



function hasStatus(entity, id) {
  return (entity?.statuses ?? []).some((s) => s.id === id);
}

function drawShipStatusOverlays(ctx, view, p, sx, sy, t) {
  const statuses = p?.statuses ?? [];
  if (!statuses.length) return;
  const dpr = view.dpr;
  const r = p.radius + 10;
  const statusSet = new Set(statuses.map((s) => s.id));

  if (statusSet.has('root')) {
    ctx.save();
    ctx.strokeStyle = rgba(108, 232, 172, 0.62);
    ctx.lineWidth = 1.7 * dpr;
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i += 1) {
      const a = -Math.PI * 0.95 + i * Math.PI / 3.1 + Math.sin(t * 2.4 + i) * 0.08;
      const x0 = sx + Math.cos(a) * (r * 0.45);
      const y0 = sy + Math.sin(a) * (r * 0.45);
      const x1 = sx + Math.cos(a) * (r + 7 + Math.sin(t * 5 + i) * 2);
      const y1 = sy + Math.sin(a) * (r + 7 + Math.cos(t * 4 + i) * 2);
      const cx = sx + Math.cos(a + 0.55) * (r * 0.85);
      const cy = sy + Math.sin(a + 0.55) * (r * 0.85);
      ctx.beginPath();
      ctx.moveTo(x0 * dpr, y0 * dpr);
      ctx.quadraticCurveTo(cx * dpr, cy * dpr, x1 * dpr, y1 * dpr);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (statusSet.has('stun')) {
    ctx.save();
    ctx.strokeStyle = rgba(255, 224, 122, 0.72);
    ctx.lineWidth = 2 * dpr;
    for (let i = 0; i < 3; i += 1) {
      const y = sy - r - 9 - i * 5;
      ctx.beginPath();
      ctx.arc(sx * dpr, y * dpr, (8 + i * 3) * dpr, Math.PI * 0.1 + t * 2, Math.PI * 1.45 + t * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (statusSet.has('suppress')) {
    ctx.save();
    ctx.strokeStyle = rgba(154, 84, 255, 0.70);
    ctx.lineWidth = 1.7 * dpr;
    ctx.setLineDash([5 * dpr, 4 * dpr]);
    ctx.beginPath();
    ctx.rect((sx - r - 8) * dpr, (sy - r - 8) * dpr, (r * 2 + 16) * dpr, (r * 2 + 16) * dpr);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(sx * dpr, sy * dpr, (r + 12 + Math.sin(t * 7) * 2) * dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (statusSet.has('silence')) {
    ctx.save();
    ctx.strokeStyle = rgba(184, 144, 255, 0.72);
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo((sx - r) * dpr, (sy + r) * dpr);
    ctx.lineTo((sx + r) * dpr, (sy - r) * dpr);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx * dpr, sy * dpr, (r + 6) * dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (statusSet.has('disarm')) {
    ctx.save();
    ctx.strokeStyle = rgba(120, 182, 255, 0.75);
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo((sx - r - 2) * dpr, sy * dpr);
    ctx.lineTo((sx + r + 2) * dpr, sy * dpr);
    ctx.moveTo((sx - r + 5) * dpr, (sy - 7) * dpr);
    ctx.lineTo((sx - r - 2) * dpr, sy * dpr);
    ctx.lineTo((sx - r + 5) * dpr, (sy + 7) * dpr);
    ctx.stroke();
    ctx.restore();
  }

  if (statusSet.has('grounded')) {
    ctx.save();
    ctx.strokeStyle = rgba(214, 164, 95, 0.66);
    ctx.lineWidth = 1.5 * dpr;
    for (let i = 0; i < 3; i += 1) {
      const yy = sy + r * 0.7 + i * 5;
      ctx.beginPath();
      ctx.moveTo((sx - r + i * 3) * dpr, yy * dpr);
      ctx.lineTo((sx + r - i * 3) * dpr, yy * dpr);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (statusSet.has('fear') || statusSet.has('charm') || statusSet.has('taunt')) {
    const c = statusSet.has('fear') ? { r: 222, g: 89, b: 170 } : statusSet.has('charm') ? { r: 255, g: 110, b: 188 } : { r: 255, g: 110, b: 110 };
    ctx.save();
    ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.78);
    ctx.fillStyle = rgba(c.r, c.g, c.b, 0.26);
    ctx.lineWidth = 1.8 * dpr;
    for (let i = 0; i < 4; i += 1) {
      const a = t * 2.2 + i * Math.PI * 0.5;
      const x = sx + Math.cos(a) * (r + 8);
      const y = sy + Math.sin(a) * (r + 8);
      ctx.beginPath();
      if (statusSet.has('charm')) {
        ctx.moveTo(x * dpr, (y + 3) * dpr);
        ctx.bezierCurveTo((x - 8) * dpr, (y - 5) * dpr, (x - 7) * dpr, (y - 12) * dpr, x * dpr, (y - 8) * dpr);
        ctx.bezierCurveTo((x + 7) * dpr, (y - 12) * dpr, (x + 8) * dpr, (y - 5) * dpr, x * dpr, (y + 3) * dpr);
      } else {
        ctx.moveTo(x * dpr, (y - 8) * dpr);
        ctx.lineTo((x + 8) * dpr, (y + 6) * dpr);
        ctx.lineTo((x - 8) * dpr, (y + 6) * dpr);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  if (statusSet.has('blind')) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.beginPath();
    ctx.arc(sx * dpr, sy * dpr, (r + 13) * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(214, 198, 126, 0.78);
    ctx.lineWidth = 1.8 * dpr;
    ctx.beginPath();
    ctx.moveTo((sx - r) * dpr, (sy - 2) * dpr);
    ctx.quadraticCurveTo(sx * dpr, (sy - 14) * dpr, (sx + r) * dpr, (sy - 2) * dpr);
    ctx.quadraticCurveTo(sx * dpr, (sy + 10) * dpr, (sx - r) * dpr, (sy - 2) * dpr);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo((sx - r - 3) * dpr, (sy + r - 1) * dpr);
    ctx.lineTo((sx + r + 3) * dpr, (sy - r + 1) * dpr);
    ctx.stroke();
    ctx.restore();
  }


  if (statusSet.has('slow')) {
    ctx.save();
    ctx.strokeStyle = rgba(112, 190, 255, 0.64);
    ctx.lineWidth = 1.5 * dpr;
    for (let i = 0; i < 4; i += 1) {
      const yy = sy - r * 0.55 + i * r * 0.35;
      ctx.beginPath();
      ctx.moveTo((sx - r - 7) * dpr, yy * dpr);
      ctx.lineTo((sx + r + 7) * dpr, yy * dpr);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (statusSet.has('haste')) {
    ctx.save();
    ctx.strokeStyle = rgba(110, 255, 190, 0.70);
    ctx.lineWidth = 1.8 * dpr;
    for (let i = 0; i < 5; i += 1) {
      const a = (p.rot ?? -Math.PI / 2) + Math.PI + (i - 2) * 0.20;
      ctx.beginPath();
      ctx.moveTo((sx + Math.cos(a) * (r + 2)) * dpr, (sy + Math.sin(a) * (r + 2)) * dpr);
      ctx.lineTo((sx + Math.cos(a) * (r + 18)) * dpr, (sy + Math.sin(a) * (r + 18)) * dpr);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (statusSet.has('burn') || statusSet.has('poison') || statusSet.has('bleed')) {
    const c = statusSet.has('burn') ? { r: 255, g: 142, b: 72 } : statusSet.has('poison') ? { r: 102, g: 225, b: 120 } : { r: 220, g: 72, b: 84 };
    ctx.save();
    ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.52);
    ctx.lineWidth = 1.4 * dpr;
    for (let i = 0; i < 8; i += 1) {
      const a = i * Math.PI / 4 + t * 1.8;
      const len = 4 + 5 * Math.sin(t * 5 + i);
      const x0 = sx + Math.cos(a) * (r + 1);
      const y0 = sy + Math.sin(a) * (r + 1);
      const x1 = sx + Math.cos(a) * (r + 1 + len);
      const y1 = sy + Math.sin(a) * (r + 1 + len);
      ctx.beginPath();
      ctx.moveTo(x0 * dpr, y0 * dpr);
      ctx.lineTo(x1 * dpr, y1 * dpr);
      ctx.stroke();
    }
    ctx.restore();
  }


  if (statusSet.has('tenacity')) {
    ctx.save();
    ctx.strokeStyle = rgba(190, 126, 255, 0.72);
    ctx.lineWidth = 1.6 * dpr;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(sx * dpr, sy * dpr, (r + 8 + i * 5) * dpr, Math.PI * (0.15 + i * 0.1) + t, Math.PI * (1.25 + i * 0.12) + t);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (statusSet.has('slow_resist')) {
    ctx.save();
    ctx.strokeStyle = rgba(170, 112, 255, 0.68);
    ctx.lineWidth = 1.3 * dpr;
    for (let i = 0; i < 6; i += 1) {
      const a = i * Math.PI / 3 - t * 1.4;
      const x = sx + Math.cos(a) * (r + 10);
      const y = sy + Math.sin(a) * (r + 10);
      ctx.beginPath();
      ctx.moveTo((x - Math.cos(a) * 6) * dpr, (y - Math.sin(a) * 6) * dpr);
      ctx.lineTo((x + Math.cos(a) * 6) * dpr, (y + Math.sin(a) * 6) * dpr);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (statusSet.has('armor_up')) {
    ctx.save();
    ctx.strokeStyle = rgba(120, 160, 225, 0.70);
    ctx.fillStyle = rgba(120, 160, 225, 0.08);
    ctx.lineWidth = 1.7 * dpr;
    for (let i = 0; i < 6; i += 1) {
      const a0 = -Math.PI / 2 + i * Math.PI / 3 + t * 0.15;
      const a1 = a0 + Math.PI / 5;
      ctx.beginPath();
      ctx.arc(sx * dpr, sy * dpr, (r + 8) * dpr, a0, a1);
      ctx.lineTo((sx + Math.cos(a1) * (r + 16)) * dpr, (sy + Math.sin(a1) * (r + 16)) * dpr);
      ctx.arc(sx * dpr, sy * dpr, (r + 16) * dpr, a1, a0, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  if (statusSet.has('spell_shield')) {
    ctx.save();
    ctx.strokeStyle = rgba(124, 96, 255, 0.78);
    ctx.lineWidth = 2 * dpr;
    ctx.setLineDash([3 * dpr, 5 * dpr]);
    ctx.beginPath();
    ctx.arc(sx * dpr, sy * dpr, (r + 16 + Math.sin(t * 5) * 2) * dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  if (statusSet.has('unstoppable')) {
    ctx.save();
    ctx.strokeStyle = rgba(255, 182, 96, 0.82);
    ctx.lineWidth = 2.2 * dpr;
    for (let i = 0; i < 4; i += 1) {
      const a = t * 1.8 + i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo((sx + Math.cos(a) * (r + 4)) * dpr, (sy + Math.sin(a) * (r + 4)) * dpr);
      ctx.lineTo((sx + Math.cos(a) * (r + 18)) * dpr, (sy + Math.sin(a) * (r + 18)) * dpr);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (statusSet.has('untargetable')) {
    ctx.save();
    ctx.strokeStyle = rgba(236, 236, 255, 0.72);
    ctx.fillStyle = rgba(236, 236, 255, 0.06);
    ctx.lineWidth = 1.7 * dpr;
    ctx.globalAlpha = 0.75 + 0.18 * Math.sin(t * 7);
    ctx.beginPath();
    ctx.ellipse(sx * dpr, sy * dpr, (r + 18) * dpr, (r + 8) * dpr, t * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (statusSet.has('invulnerable')) {
    ctx.save();
    ctx.strokeStyle = rgba(255, 246, 196, 0.88);
    ctx.fillStyle = rgba(255, 246, 196, 0.08);
    ctx.lineWidth = 2 * dpr;
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5 + t * 0.45;
      const x0 = sx + Math.cos(a) * (r + 8);
      const y0 = sy + Math.sin(a) * (r + 8);
      const x1 = sx + Math.cos(a + 0.55) * (r + 18);
      const y1 = sy + Math.sin(a + 0.55) * (r + 18);
      ctx.beginPath();
      ctx.moveTo(sx * dpr, sy * dpr);
      ctx.lineTo(x0 * dpr, y0 * dpr);
      ctx.lineTo(x1 * dpr, y1 * dpr);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  if (statusSet.has('camouflage')) {
    ctx.save();
    ctx.strokeStyle = rgba(109, 79, 255, 0.62);
    ctx.lineWidth = 1.5 * dpr;
    ctx.globalAlpha = 0.45 + 0.22 * Math.sin(t * 6);
    for (let i = 0; i < 2; i += 1) {
      ctx.beginPath();
      ctx.ellipse((sx + Math.sin(t * 2 + i) * 5) * dpr, sy * dpr, (r + 12 + i * 6) * dpr, (r + 3 + i * 4) * dpr, -0.35 + i * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (statusSet.has('true_sight')) {
    ctx.save();
    ctx.strokeStyle = rgba(120, 250, 255, 0.76);
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    ctx.moveTo((sx - r - 8) * dpr, sy * dpr);
    ctx.quadraticCurveTo(sx * dpr, (sy - r - 14) * dpr, (sx + r + 8) * dpr, sy * dpr);
    ctx.quadraticCurveTo(sx * dpr, (sy + r + 14) * dpr, (sx - r - 8) * dpr, sy * dpr);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx * dpr, sy * dpr, 4.5 * dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (statusSet.has('damage_amp') || statusSet.has('armor_shred') || statusSet.has('anti_shield') || statusSet.has('heal_cut')) {
    ctx.save();
    const color = statusSet.has('damage_amp') ? { r: 255, g: 94, b: 94 } : statusSet.has('anti_shield') ? { r: 255, g: 140, b: 76 } : statusSet.has('heal_cut') ? { r: 255, g: 96, b: 96 } : { r: 198, g: 118, b: 88 };
    ctx.strokeStyle = rgba(color.r, color.g, color.b, 0.66);
    ctx.lineWidth = 1.5 * dpr;
    for (let i = 0; i < 4; i += 1) {
      const a = t * -1.5 + i * Math.PI / 2;
      ctx.beginPath();
      ctx.arc((sx + Math.cos(a) * (r + 9)) * dpr, (sy + Math.sin(a) * (r + 9)) * dpr, 4 * dpr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}


function drawChevronBurst(ctx, dpr, sx, sy, radius, color, count, t, forward = -Math.PI / 2) {
  ctx.save();
  ctx.strokeStyle = rgba(color.r, color.g, color.b, 0.70);
  ctx.fillStyle = rgba(color.r, color.g, color.b, 0.18);
  ctx.lineWidth = 1.6 * dpr;
  const n = Math.max(1, Math.min(5, count | 0));
  for (let i = 0; i < n; i += 1) {
    const a = forward + (i - (n - 1) * 0.5) * 0.23 + Math.sin(t * 5 + i) * 0.025;
    const x = sx + Math.cos(a) * radius;
    const y = sy + Math.sin(a) * radius;
    ctx.beginPath();
    ctx.moveTo((x + Math.cos(a) * 7) * dpr, (y + Math.sin(a) * 7) * dpr);
    ctx.lineTo((x + Math.cos(a + 2.4) * 6) * dpr, (y + Math.sin(a + 2.4) * 6) * dpr);
    ctx.lineTo((x + Math.cos(a - 2.4) * 6) * dpr, (y + Math.sin(a - 2.4) * 6) * dpr);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawSegmentRing(ctx, dpr, sx, sy, radius, count, active, color, t, thickness = 4) {
  const max = Math.max(1, count | 0);
  const gap = Math.PI * 2 / max * 0.18;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < max; i += 1) {
    const a0 = -Math.PI / 2 + i * Math.PI * 2 / max + gap * 0.5 + t * 0.08;
    const a1 = -Math.PI / 2 + (i + 1) * Math.PI * 2 / max - gap * 0.5 + t * 0.08;
    const lit = i < active;
    ctx.strokeStyle = lit ? rgba(color.r, color.g, color.b, 0.88) : rgba(82, 92, 112, 0.28);
    ctx.lineWidth = (lit ? thickness : thickness * 0.58) * dpr;
    ctx.beginPath();
    ctx.arc(sx * dpr, sy * dpr, (radius + (lit ? Math.sin(t * 7 + i) * 1.1 : 0)) * dpr, a0, a1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawContinuousHeatAura(ctx, dpr, sx, sy, radius, stacks, maxStacks, t) {
  const max = Math.max(1, maxStacks | 0);
  const heat = Math.max(0, Math.min(1, (stacks || 0) / max));
  const pulse = 0.5 + 0.5 * Math.sin(t * 7.5);
  const alpha = 0.10 + heat * 0.46 + pulse * heat * 0.12;
  const core = { r: 84, g: 226, b: 255 };
  const hot = { r: 255, g: 202, b: 86 };
  const rr = Math.round(core.r + (hot.r - core.r) * Math.max(0, heat - 0.55) / 0.45);
  const gg = Math.round(core.g + (hot.g - core.g) * Math.max(0, heat - 0.55) / 0.45);
  const bb = Math.round(core.b + (hot.b - core.b) * Math.max(0, heat - 0.55) / 0.45);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(rr, gg, bb, alpha);
  ctx.lineWidth = (1.6 + heat * 2.2) * dpr;
  ctx.beginPath();
  ctx.arc(sx * dpr, sy * dpr, (radius + Math.sin(t * 6) * heat * 1.6) * dpr, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = rgba(rr, gg, bb, 0.16 + heat * 0.26);
  ctx.lineWidth = 1.1 * dpr;
  ctx.setLineDash([7 * dpr, 9 * dpr]);
  ctx.beginPath();
  ctx.arc(sx * dpr, sy * dpr, (radius + 8 + Math.sin(t * 4.5) * heat * 2) * dpr, t * 0.55, t * 0.55 + Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const ventCount = Math.min(6, Math.max(0, Math.ceil(heat * 6)));
  ctx.fillStyle = rgba(rr, gg, bb, 0.38 + heat * 0.34);
  for (let i = 0; i < ventCount; i += 1) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / Math.max(1, ventCount) + t * 0.4;
    const x = sx + Math.cos(a) * (radius + 13);
    const y = sy + Math.sin(a) * (radius + 13);
    ctx.beginPath();
    ctx.ellipse(x * dpr, y * dpr, (2.6 + heat * 1.2) * dpr, 1.15 * dpr, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}


function drawFrameSignatureAura(ctx, view, p, sx, sy, t) {
  const fs = p.frameState;
  if (!fs) return;
  const dpr = view.dpr;
  const r = (p.radius ?? 18) + 22;
  if (fs.kind === 'vanguard') {
    drawContinuousHeatAura(ctx, dpr, sx, sy, r, fs.passiveStacks ?? 0, fs.passiveMaxStacks ?? 10, t);
    if ((fs.empoweredCharges ?? 0) > 0) drawChevronBurst(ctx, dpr, sx, sy, r + 12, { r: 255, g: 210, b: 92 }, fs.empoweredCharges, t, p.rot ?? -Math.PI / 2);
    if ((fs.comboWindowLeft ?? 0) > 0) {
      ctx.save();
      ctx.strokeStyle = rgba(105, 235, 255, 0.65);
      ctx.lineWidth = 2 * dpr;
      ctx.setLineDash([7 * dpr, 5 * dpr]);
      ctx.beginPath();
      ctx.arc(sx * dpr, sy * dpr, (r + 16 + Math.sin(t * 8) * 2) * dpr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    if ((fs.phaseLeft ?? 0) > 0) {
      ctx.save();
      ctx.strokeStyle = rgba(124, 154, 255, 0.72);
      ctx.lineWidth = 1.5 * dpr;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.ellipse((sx - (i + 1) * 6) * dpr, sy * dpr, (r + i * 4) * dpr, (r * 0.56 + i * 2) * dpr, (p.rot ?? 0), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    if ((fs.ultLeft ?? 0) > 0) {
      ctx.save();
      ctx.strokeStyle = rgba(255, 116, 238, 0.52 + 0.18 * Math.sin(t * 10));
      ctx.lineWidth = 2.2 * dpr;
      ctx.beginPath();
      ctx.arc(sx * dpr, sy * dpr, (r + 25) * dpr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    return;
  }
  if (fs.kind === 'sigil') {
    drawSegmentRing(ctx, dpr, sx, sy, r, fs.passiveMaxStacks ?? 5, fs.zoneActive ? 5 : 0, { r: 198, g: 128, b: 255 }, t, 2.0);
    if ((fs.veilLeft ?? 0) > 0) {
      ctx.save();
      ctx.globalAlpha = 0.36 + 0.2 * Math.sin(t * 7);
      ctx.strokeStyle = rgba(197, 120, 255, 0.80);
      ctx.lineWidth = 1.5 * dpr;
      for (let i = 0; i < 4; i += 1) {
        const a = i * Math.PI / 2 + t * 1.2;
        ctx.beginPath();
        ctx.ellipse((sx + Math.cos(a) * 3) * dpr, (sy + Math.sin(a) * 3) * dpr, (r + 10) * dpr, (r * 0.45) * dpr, a, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (fs.zoneActive) {
      ctx.save();
      ctx.strokeStyle = rgba(198, 128, 255, 0.64);
      ctx.lineWidth = 1.3 * dpr;
      for (let i = 0; i < 5; i += 1) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 5 + t * 0.55;
        const x = sx + Math.cos(a) * (r + 14);
        const y = sy + Math.sin(a) * (r + 14);
        ctx.beginPath();
        ctx.arc(x * dpr, y * dpr, 3.5 * dpr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    return;
  }
  if (fs.kind === 'bulwark') {
    drawSegmentRing(ctx, dpr, sx, sy, r, fs.passiveMaxStacks ?? 5, fs.passiveStacks ?? 0, { r: 236, g: 196, b: 96 }, t, 5.0);
    if ((fs.anchorLeft ?? 0) > 0) {
      ctx.save();
      ctx.strokeStyle = rgba(236, 196, 96, 0.78);
      ctx.lineWidth = 2 * dpr;
      for (let i = 0; i < 4; i += 1) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo((sx + Math.cos(a) * (r - 6)) * dpr, (sy + Math.sin(a) * (r - 6)) * dpr);
        ctx.lineTo((sx + Math.cos(a) * (r + 16)) * dpr, (sy + Math.sin(a) * (r + 16)) * dpr);
        ctx.stroke();
      }
      ctx.restore();
    }
    if ((fs.meditationLeft ?? 0) > 0) {
      ctx.save();
      ctx.strokeStyle = rgba(120, 210, 255, 0.66);
      ctx.lineWidth = 1.7 * dpr;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(sx * dpr, sy * dpr, (r + 8 + i * 8 + Math.sin(t * 5 + i) * 2) * dpr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    if ((fs.stormLeft ?? 0) > 0) {
      ctx.save();
      ctx.strokeStyle = rgba(255, 195, 102, 0.44);
      ctx.fillStyle = rgba(255, 195, 102, 0.035);
      ctx.lineWidth = 2.2 * dpr;
      ctx.beginPath();
      ctx.arc(sx * dpr, sy * dpr, (r + 70 + Math.sin(t * 4) * 4) * dpr, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
}

export function drawShip(ctx, view, p, camX, camY, t, mouseWorld, players, asteroids) {
  const sx = (p.x - camX) + view.cssW * 0.5;
  const sy = (p.y - camY) + view.cssH * 0.5;
  const vitals = p.vitals;

  const ang = Number.isFinite(p.rot) ? p.rot : 0;
  const palette = getShipFramePalette(p.frameId);

  drawFrameSignatureAura(ctx, view, p, sx, sy, t);
  drawShipStatusOverlays(ctx, view, p, sx, sy, t);

  if (vitals?.shield > 0.001) {
    const r = p.radius + 6 + 2 * (vitals.shield / Math.max(1, vitals.maxShield));
    ctx.strokeStyle = rgba(COLORS.shield.r, COLORS.shield.g, COLORS.shield.b, 0.47);
    ctx.lineWidth = 2 * view.dpr;
    ctx.beginPath();
    ctx.ellipse(sx * view.dpr, sy * view.dpr, r * view.dpr, r * view.dpr, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  const speed = Math.hypot(p.vx, p.vy);
  if (speed > 8) {
    const thrust = clamp((speed - 8) / Math.max(1, p.engine * 0.55), 0.18, 1);
    const pulse = 0.82 + 0.22 * Math.sin(t * 18);
    const spread = 0.62;
    const length = p.radius * 1.38 * (0.72 + thrust * 0.62) * pulse;
    const startRadius = p.radius * 0.62;
    const aBase = Math.atan2(p.vy, p.vx) + Math.PI;
    for (const i of [-1, 1]) {
      const a = aBase + i * spread;
      const p0 = polar(sx, sy, startRadius, a);
      const p1 = polar(sx, sy, length, a);
      ctx.strokeStyle = rgba(COLORS.fx.r, COLORS.fx.g, COLORS.fx.b, 0.45 + 0.35 * thrust);
      ctx.lineWidth = 2 * view.dpr;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p0.x * view.dpr, p0.y * view.dpr);
      ctx.lineTo(p1.x * view.dpr, p1.y * view.dpr);
      ctx.stroke();
      ctx.strokeStyle = rgba(COLORS.thrusterInner.r, COLORS.thrusterInner.g, COLORS.thrusterInner.b, 0.78 + 0.18 * thrust);
      ctx.lineWidth = 1.05 * view.dpr;
      ctx.beginPath();
      ctx.moveTo(p0.x * view.dpr, p0.y * view.dpr);
      ctx.lineTo((sx + Math.cos(a) * (length * 0.68)) * view.dpr, (sy + Math.sin(a) * (length * 0.68)) * view.dpr);
      ctx.stroke();
    }
  }

  const pts = [
    polar(sx, sy, p.radius + 7, ang),
    polar(sx, sy, p.radius + 2, ang + 0.55),
    polar(sx, sy, p.radius - 2, ang + 2.28),
    polar(sx, sy, p.radius - 7, ang + Math.PI),
    polar(sx, sy, p.radius - 2, ang - 2.28),
    polar(sx, sy, p.radius + 2, ang - 0.55)
  ];

  ctx.fillStyle = rgba(palette.hull.r, palette.hull.g, palette.hull.b, 1);
  ctx.beginPath();
  ctx.moveTo(pts[0].x * view.dpr, pts[0].y * view.dpr);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * view.dpr, pts[i].y * view.dpr);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(palette.outline.r, palette.outline.g, palette.outline.b, 1);
  ctx.lineWidth = 2 * view.dpr;
  ctx.stroke();

  ctx.fillStyle = rgba(palette.core.r, palette.core.g, palette.core.b, 0.86);
  ctx.beginPath();
  ctx.ellipse(sx * view.dpr, sy * view.dpr, p.radius * 0.24 * view.dpr, p.radius * 0.24 * view.dpr, 0, 0, Math.PI * 2);
  ctx.fill();

  drawWorldHealthBars(ctx, view, p, camX, camY, SHIP_WORLD_BAR_STYLE);

  const displayName = p.pseudo || `Joueur ${p.id}`;
  const labelY = sy - p.radius - 14;
  ctx.font = `700 ${12 * view.dpr}px Segoe UI`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(displayName).width / view.dpr;
  ctx.fillStyle = rgba(3, 6, 11, 0.72);
  ctx.fillRect((sx - tw * 0.5 - 7) * view.dpr, (labelY - 9) * view.dpr, (tw + 14) * view.dpr, 18 * view.dpr);
  ctx.strokeStyle = rgba(125, 233, 255, 0.22);
  ctx.lineWidth = view.dpr;
  ctx.strokeRect((sx - tw * 0.5 - 7) * view.dpr, (labelY - 9) * view.dpr, (tw + 14) * view.dpr, 18 * view.dpr);
  ctx.fillStyle = rgba(245, 250, 255, 0.98);
  ctx.fillText(displayName, sx * view.dpr, labelY * view.dpr);
  ctx.textBaseline = 'alphabetic';

  if ((p.level ?? 1) > 0) {
    const bx = sx + p.radius + 8;
    const by = sy - p.radius - 18;
    ctx.fillStyle = rgba(10, 14, 20, 0.94);
    ctx.fillRect((bx - 10) * view.dpr, (by - 8) * view.dpr, 20 * view.dpr, 16 * view.dpr);
    ctx.strokeStyle = rgba(236, 196, 96, 0.92);
    ctx.lineWidth = view.dpr;
    ctx.strokeRect((bx - 10) * view.dpr, (by - 8) * view.dpr, 20 * view.dpr, 16 * view.dpr);
    ctx.fillStyle = rgba(246, 230, 174, 0.96);
    ctx.font = `${10 * view.dpr}px Segoe UI`;
    ctx.fillText(`${p.level}`, bx * view.dpr, (by + 4) * view.dpr);
  }
}
