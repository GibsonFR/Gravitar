import { rgba } from '../../core/Math.js';

function line(ctx, dpr, ax, ay, bx, by, width, stroke) {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width * dpr;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ax * dpr, ay * dpr);
  ctx.lineTo(bx * dpr, by * dpr);
  ctx.stroke();
}

function arrow(ctx, dpr, cx, cy, s, stroke, dir = 1) {
  line(ctx, dpr, cx - s * dir, cy, cx + s * dir, cy, 2, stroke);
  line(ctx, dpr, cx + s * dir, cy, cx + s * 0.35 * dir, cy - s * 0.42, 2, stroke);
  line(ctx, dpr, cx + s * dir, cy, cx + s * 0.35 * dir, cy + s * 0.42, 2, stroke);
}

function drop(ctx, dpr, cx, cy, s, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath();
  ctx.moveTo(cx * dpr, (cy - s) * dpr);
  ctx.bezierCurveTo((cx + s * 0.75) * dpr, (cy - s * 0.18) * dpr, (cx + s * 0.52) * dpr, (cy + s * 0.78) * dpr, cx * dpr, (cy + s) * dpr);
  ctx.bezierCurveTo((cx - s * 0.52) * dpr, (cy + s * 0.78) * dpr, (cx - s * 0.75) * dpr, (cy - s * 0.18) * dpr, cx * dpr, (cy - s) * dpr);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function drawStatusGlyph(ctx, dpr, entry, x, y, size, alpha = 1) {
  const p = entry.primaryColor ?? { r: 220, g: 220, b: 220 };
  const s = entry.secondaryColor ?? p;
  const id = String(entry.id || entry.shortName || '').toLowerCase();
  const cx = x + size * 0.5;
  const cy = y + size * 0.5;
  const r = size * 0.34;
  const stroke = rgba(s.r, s.g, s.b, 0.96 * alpha);
  const fill = rgba(p.r, p.g, p.b, 0.24 * alpha);
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.lineWidth = 1.8 * dpr;

  if (id.includes('root')) {
    line(ctx, dpr, cx - r * 0.9, cy + r * 0.65, cx + r * 0.9, cy + r * 0.65, 2, stroke);
    line(ctx, dpr, cx - r * 0.55, cy + r * 0.65, cx - r * 0.15, cy - r * 0.9, 2, stroke);
    line(ctx, dpr, cx + r * 0.55, cy + r * 0.65, cx + r * 0.15, cy - r * 0.9, 2, stroke);
    line(ctx, dpr, cx - r * 0.15, cy - r * 0.9, cx + r * 0.15, cy - r * 0.9, 2, stroke);
    return;
  }
  if (id.includes('silence')) {
    ctx.beginPath(); ctx.arc(cx * dpr, cy * dpr, r * 0.9 * dpr, 0, Math.PI * 2); ctx.stroke();
    line(ctx, dpr, cx - r * 0.65, cy + r * 0.65, cx + r * 0.65, cy - r * 0.65, 2, stroke);
    return;
  }
  if (id.includes('disarm')) {
    line(ctx, dpr, cx - r * 0.8, cy + r * 0.55, cx + r * 0.8, cy - r * 0.55, 2, stroke);
    line(ctx, dpr, cx - r * 0.25, cy - r * 0.15, cx + r * 0.55, cy + r * 0.65, 1.8, stroke);
    line(ctx, dpr, cx + r * 0.45, cy + r * 0.25, cx + r * 0.8, cy + r * 0.6, 1.8, stroke);
    return;
  }
  if (id.includes('ground')) {
    line(ctx, dpr, cx - r, cy + r * 0.52, cx + r, cy + r * 0.52, 2, stroke);
    line(ctx, dpr, cx - r * 0.75, cy + r * 0.15, cx + r * 0.75, cy + r * 0.15, 1.5, stroke);
    line(ctx, dpr, cx - r * 0.45, cy - r * 0.25, cx + r * 0.45, cy - r * 0.25, 1.5, stroke);
    return;
  }
  if (id.includes('suppress')) {
    ctx.beginPath(); ctx.rect((cx - r * 0.72) * dpr, (cy - r * 0.72) * dpr, r * 1.44 * dpr, r * 1.44 * dpr); ctx.stroke();
    line(ctx, dpr, cx - r * 0.72, cy, cx + r * 0.72, cy, 2, stroke);
    line(ctx, dpr, cx, cy - r * 0.72, cx, cy + r * 0.72, 2, stroke);
    return;
  }
  if (id.includes('sleep')) {
    ctx.font = `${Math.max(8, r * 1.05) * dpr}px Segoe UI`;
    ctx.fillStyle = stroke;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Z', cx * dpr, cy * dpr);
    return;
  }
  if (id.includes('fear')) {
    ctx.beginPath();
    ctx.moveTo(cx * dpr, (cy - r) * dpr);
    ctx.lineTo((cx + r * 0.85) * dpr, (cy + r * 0.65) * dpr);
    ctx.lineTo((cx - r * 0.85) * dpr, (cy + r * 0.65) * dpr);
    ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.arc((cx - r * 0.25) * dpr, (cy + r * 0.05) * dpr, r * 0.08 * dpr, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc((cx + r * 0.25) * dpr, (cy + r * 0.05) * dpr, r * 0.08 * dpr, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (id.includes('charm')) {
    ctx.beginPath();
    ctx.moveTo(cx * dpr, (cy + r * 0.72) * dpr);
    ctx.bezierCurveTo((cx - r * 1.15) * dpr, (cy - r * 0.05) * dpr, (cx - r * 0.55) * dpr, (cy - r * 0.86) * dpr, cx * dpr, (cy - r * 0.34) * dpr);
    ctx.bezierCurveTo((cx + r * 0.55) * dpr, (cy - r * 0.86) * dpr, (cx + r * 1.15) * dpr, (cy - r * 0.05) * dpr, cx * dpr, (cy + r * 0.72) * dpr);
    ctx.fill(); ctx.stroke();
    return;
  }
  if (id.includes('taunt')) {
    ctx.beginPath(); ctx.arc(cx * dpr, cy * dpr, r * 0.78 * dpr, 0, Math.PI * 2); ctx.stroke();
    line(ctx, dpr, cx - r * 0.45, cy - r * 0.15, cx - r * 0.05, cy - r * 0.15, 2, stroke);
    line(ctx, dpr, cx + r * 0.05, cy - r * 0.15, cx + r * 0.45, cy - r * 0.15, 2, stroke);
    line(ctx, dpr, cx - r * 0.45, cy + r * 0.35, cx + r * 0.45, cy + r * 0.35, 2, stroke);
    return;
  }
  if (id.includes('slow')) {
    arrow(ctx, dpr, cx + r * 0.35, cy, r * 0.8, stroke, -1);
    line(ctx, dpr, cx - r * 0.4, cy - r * 0.48, cx + r * 0.45, cy - r * 0.48, 1.5, stroke);
    line(ctx, dpr, cx - r * 0.4, cy + r * 0.48, cx + r * 0.45, cy + r * 0.48, 1.5, stroke);
    return;
  }
  if (id.includes('haste') || id.includes('dash')) { arrow(ctx, dpr, cx, cy, r * 0.95, stroke, 1); return; }
  if (id.includes('burn')) {
    ctx.beginPath();
    ctx.moveTo(cx * dpr, (cy - r * 1.05) * dpr);
    ctx.bezierCurveTo((cx + r * 0.75) * dpr, (cy - r * 0.2) * dpr, (cx + r * 0.34) * dpr, (cy + r * 0.95) * dpr, cx * dpr, (cy + r * 1.05) * dpr);
    ctx.bezierCurveTo((cx - r * 0.65) * dpr, (cy + r * 0.45) * dpr, (cx - r * 0.28) * dpr, (cy - r * 0.1) * dpr, cx * dpr, (cy - r * 1.05) * dpr);
    ctx.fill(); ctx.stroke();
    return;
  }
  if (id.includes('poison')) { drop(ctx, dpr, cx, cy, r, fill, stroke); line(ctx, dpr, cx - r * 0.25, cy, cx + r * 0.25, cy, 1.4, stroke); return; }
  if (id.includes('bleed')) { drop(ctx, dpr, cx, cy, r, fill, stroke); return; }
  if (id.includes('stun')) {
    for (let i = 0; i < 6; i += 1) {
      const a0 = -Math.PI / 2 + (Math.PI * 2 * i) / 6;
      line(ctx, dpr, cx + Math.cos(a0) * r * 0.35, cy + Math.sin(a0) * r * 0.35, cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, 1.7, stroke);
    }
    ctx.beginPath(); ctx.arc(cx * dpr, cy * dpr, r * 0.32 * dpr, 0, Math.PI * 2); ctx.stroke();
    return;
  }
  if (id.includes('shield') || id.includes('armor')) {
    ctx.beginPath();
    ctx.moveTo((cx - r * 0.8) * dpr, (cy - r * 0.8) * dpr);
    ctx.lineTo((cx + r * 0.8) * dpr, (cy - r * 0.8) * dpr);
    ctx.lineTo((cx + r * 0.58) * dpr, (cy + r * 0.35) * dpr);
    ctx.lineTo(cx * dpr, (cy + r * 0.95) * dpr);
    ctx.lineTo((cx - r * 0.58) * dpr, (cy + r * 0.35) * dpr);
    ctx.closePath(); ctx.stroke();
    return;
  }
  if (id.includes('amp') || id.includes('shred')) {
    line(ctx, dpr, cx - r * 0.8, cy + r * 0.8, cx + r * 0.8, cy - r * 0.8, 2, stroke);
    line(ctx, dpr, cx + r * 0.2, cy - r * 0.78, cx + r * 0.8, cy - r * 0.8, 2, stroke);
    line(ctx, dpr, cx + r * 0.8, cy - r * 0.8, cx + r * 0.78, cy - r * 0.2, 2, stroke);
    return;
  }
  ctx.beginPath(); ctx.arc(cx * dpr, cy * dpr, r * dpr, 0, Math.PI * 2); ctx.stroke();
}
