import { rgba } from '../../core/Math.js';
import { drawStatusGlyph } from './StatusGlyphRenderer.js';

function isSigilRuneStatus(entry) {
  const key = String(entry?.key || entry?.markKey || entry?.label || entry?.id || entry?.effectId || '').toLowerCase();
  return key.includes('sigil_runes') || key.includes('rune');
}

function drawSigilRuneOrbit(ctx, view, entity, sx, sy, t, entry) {
  const stacks = Math.max(1, Math.min(5, Number(entry?.stacks || 1) | 0));
  const dpr = view.dpr;
  const radius = Math.max(20, Number(entity?.radius || 14) + 10);
  ctx.save();
  ctx.lineWidth = 1.35 * dpr;
  for (let i = 0; i < stacks; i += 1) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / stacks + t * 1.35;
    const x = (sx + Math.cos(a) * radius) * dpr;
    const y = (sy + Math.sin(a) * radius) * dpr;
    const r = (5.2 + 1.4 * Math.sin(t * 4 + i)) * dpr;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(197,120,255,0.26)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(218,166,255,0.92)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,245,255,0.95)';
    ctx.fill();
  }
  ctx.restore();
}


export function drawWorldStatuses(ctx, view, entity, camX, camY, t) {
  const statuses = entity?.statuses ?? [];
  if (!statuses.length) return;
  const shown = statuses.slice(0, 4);
  const sx = (entity.x - camX) + view.cssW * 0.5;
  const sy = (entity.y - camY) + view.cssH * 0.5;
  const runeEntry = statuses.find(isSigilRuneStatus);
  if (runeEntry) drawSigilRuneOrbit(ctx, view, entity, sx, sy, t, runeEntry);

  const size = 17;
  const gap = 3;
  const total = shown.length * size + (shown.length - 1) * gap;
  const x0 = sx - total * 0.5;
  const y = sy - (entity.radius || 14) - 24 - 1.2 * Math.sin(t * 5 + entity.id * 0.13);
  for (let i = 0; i < shown.length; i += 1) {
    const entry = shown[i];
    const p = entry.primaryColor ?? { r: 220, g: 220, b: 220 };
    const x = x0 + i * (size + gap);
    ctx.fillStyle = 'rgba(6,9,14,0.88)';
    ctx.strokeStyle = rgba(p.r, p.g, p.b, 0.68);
    ctx.lineWidth = view.dpr;
    const rr = 4 * view.dpr;
    const xx = x * view.dpr, yy = y * view.dpr, ww = size * view.dpr, hh = size * view.dpr;
    ctx.beginPath();
    ctx.moveTo(xx + rr, yy);
    ctx.lineTo(xx + ww - rr, yy);
    ctx.quadraticCurveTo(xx + ww, yy, xx + ww, yy + rr);
    ctx.lineTo(xx + ww, yy + hh - rr);
    ctx.quadraticCurveTo(xx + ww, yy + hh, xx + ww - rr, yy + hh);
    ctx.lineTo(xx + rr, yy + hh);
    ctx.quadraticCurveTo(xx, yy + hh, xx, yy + hh - rr);
    ctx.lineTo(xx, yy + rr);
    ctx.quadraticCurveTo(xx, yy, xx + rr, yy);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    drawStatusGlyph(ctx, view.dpr, entry, x + 2, y + 2, size - 4, 0.95);
    const frac = Math.max(0, Math.min(1, (entry.durationLeft ?? 0) / Math.max(0.001, entry.baseDuration ?? entry.durationLeft ?? 1)));
    ctx.strokeStyle = rgba(p.r, p.g, p.b, 0.82);
    ctx.lineWidth = 1.2 * view.dpr;
    ctx.beginPath();
    ctx.arc((x + size - 4) * view.dpr, (y + 4) * view.dpr, 3.2 * view.dpr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.stroke();
    if ((entry.stacks ?? 1) > 1) {
      ctx.font = `${7.5 * view.dpr}px Segoe UI`;
      ctx.fillStyle = rgba(255, 245, 210, 0.92);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${entry.stacks}`, (x + size - 2) * view.dpr, (y + size + 1) * view.dpr);
    }
  }
}
