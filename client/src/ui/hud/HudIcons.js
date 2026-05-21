import { rgba } from '../../core/Math.js';

function line(ctx, dpr, ax, ay, bx, by, width, stroke) {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width * dpr;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ax * dpr, ay * dpr);
  ctx.lineTo(bx * dpr, by * dpr);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

export function drawFrameGlyph(ctx, dpr, frameId, cx, cy, size, palette) {
  ctx.strokeStyle = rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.98);
  ctx.fillStyle = rgba(palette.core.r, palette.core.g, palette.core.b, 0.92);
  ctx.lineWidth = 2 * dpr;

  if (frameId === 'sigil') {
    ctx.beginPath();
    ctx.moveTo(cx * dpr, (cy - size * 0.58) * dpr);
    ctx.lineTo((cx + size * 0.54) * dpr, cy * dpr);
    ctx.lineTo(cx * dpr, (cy + size * 0.58) * dpr);
    ctx.lineTo((cx - size * 0.54) * dpr, cy * dpr);
    ctx.closePath();
    ctx.stroke();
    line(ctx, dpr, cx, cy - size * 0.38, cx, cy + size * 0.38, 2, rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.98));
    line(ctx, dpr, cx - size * 0.32, cy, cx + size * 0.32, cy, 2, rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.98));
    return;
  }

  if (frameId === 'bulwark') {
    ctx.beginPath();
    ctx.moveTo((cx - size * 0.42) * dpr, (cy - size * 0.42) * dpr);
    ctx.lineTo((cx + size * 0.42) * dpr, (cy - size * 0.42) * dpr);
    ctx.lineTo((cx + size * 0.30) * dpr, (cy + size * 0.36) * dpr);
    ctx.lineTo(cx * dpr, (cy + size * 0.52) * dpr);
    ctx.lineTo((cx - size * 0.30) * dpr, (cy + size * 0.36) * dpr);
    ctx.closePath();
    ctx.stroke();
    line(ctx, dpr, cx, cy - size * 0.20, cx, cy + size * 0.24, 2, rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.98));
    return;
  }

  ctx.beginPath();
  ctx.moveTo(cx * dpr, (cy - size * 0.72) * dpr);
  ctx.lineTo((cx + size * 0.18) * dpr, (cy - size * 0.18) * dpr);
  ctx.lineTo((cx + size * 0.56) * dpr, (cy + size * 0.12) * dpr);
  ctx.lineTo((cx + size * 0.12) * dpr, (cy + size * 0.20) * dpr);
  ctx.lineTo(cx * dpr, (cy + size * 0.66) * dpr);
  ctx.lineTo((cx - size * 0.12) * dpr, (cy + size * 0.20) * dpr);
  ctx.lineTo((cx - size * 0.56) * dpr, (cy + size * 0.12) * dpr);
  ctx.lineTo((cx - size * 0.18) * dpr, (cy - size * 0.18) * dpr);
  ctx.closePath();
  ctx.stroke();
  line(ctx, dpr, cx, cy - size * 0.44, cx, cy + size * 0.24, 2, rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.98));
  line(ctx, dpr, cx - size * 0.34, cy + size * 0.02, cx + size * 0.34, cy + size * 0.02, 2, rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.98));
}

export function drawAbilityGlyph(ctx, dpr, frameId, slot, x, y, w, h, accent) {
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  const s = Math.min(w, h) * 0.38;
  const stroke = rgba(accent.r, accent.g, accent.b, 0.96);
  const fill = rgba(accent.r, accent.g, accent.b, 0.18);

  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2 * dpr;
  ctx.fillStyle = fill;

  if (frameId === 'vanguard') {
    if (slot === 'A') {
      ctx.beginPath();
      ctx.moveTo((cx - s * 0.80) * dpr, cy * dpr);
      ctx.lineTo((cx + s * 0.78) * dpr, cy * dpr);
      ctx.lineTo((cx + s * 0.18) * dpr, (cy - s * 0.46) * dpr);
      ctx.moveTo((cx + s * 0.78) * dpr, cy * dpr);
      ctx.lineTo((cx + s * 0.18) * dpr, (cy + s * 0.46) * dpr);
      ctx.stroke();
      return;
    }
    if (slot === 'Z') {
      line(ctx, dpr, cx - s * 0.90, cy, cx + s * 0.74, cy, 2, stroke);
      line(ctx, dpr, cx - s * 0.46, cy - s * 0.34, cx + s * 0.10, cy - s * 0.34, 2, stroke);
      line(ctx, dpr, cx - s * 0.46, cy + s * 0.34, cx + s * 0.10, cy + s * 0.34, 2, stroke);
      return;
    }
    if (slot === 'E') {
      ctx.beginPath();
      ctx.arc(cx * dpr, cy * dpr, s * dpr, Math.PI * 0.2, Math.PI * 1.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx * dpr, (cy - s * 0.85) * dpr);
      ctx.lineTo((cx + s * 0.42) * dpr, cy * dpr);
      ctx.lineTo(cx * dpr, (cy + s * 0.85) * dpr);
      ctx.lineTo((cx - s * 0.42) * dpr, cy * dpr);
      ctx.closePath();
      ctx.stroke();
      return;
    }
    if (slot === 'R') {
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI * 2 * i) / 6;
        line(ctx, dpr, cx, cy, cx + Math.cos(a) * s * 0.94, cy + Math.sin(a) * s * 0.94, 2, stroke);
      }
      ctx.beginPath();
      ctx.arc(cx * dpr, cy * dpr, (s * 0.38) * dpr, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    if (slot === 'P') {
      ctx.beginPath();
      ctx.moveTo(cx * dpr, (cy - s * 0.86) * dpr);
      ctx.bezierCurveTo((cx + s * 0.62) * dpr, (cy - s * 0.18) * dpr, (cx + s * 0.26) * dpr, (cy + s * 0.72) * dpr, cx * dpr, (cy + s * 0.92) * dpr);
      ctx.bezierCurveTo((cx - s * 0.30) * dpr, (cy + s * 0.72) * dpr, (cx - s * 0.62) * dpr, (cy - s * 0.16) * dpr, cx * dpr, (cy - s * 0.86) * dpr);
      ctx.stroke();
      line(ctx, dpr, cx, cy - s * 0.32, cx, cy + s * 0.42, 2, stroke);
      return;
    }
  }

  if (slot === 'D') {
    ctx.beginPath();
    ctx.arc(cx * dpr, cy * dpr, (s * 0.65) * dpr, 0, Math.PI * 2);
    ctx.stroke();
    line(ctx, dpr, cx - s * 0.35, cy, cx + s * 0.35, cy, 2, stroke);
    return;
  }
  if (slot === 'F') {
    ctx.beginPath();
    ctx.moveTo(cx * dpr, (cy - s * 0.78) * dpr);
    ctx.lineTo((cx + s * 0.52) * dpr, cy * dpr);
    ctx.lineTo(cx * dpr, (cy + s * 0.78) * dpr);
    ctx.lineTo((cx - s * 0.52) * dpr, cy * dpr);
    ctx.closePath();
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  ctx.arc(cx * dpr, cy * dpr, (s * 0.80) * dpr, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawStatGlyph(ctx, dpr, kind, x, y, accent) {
  const stroke = rgba(accent.r, accent.g, accent.b, 0.96);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2 * dpr;

  if (kind === 'speed') {
    line(ctx, dpr, x - 6, y, x + 6, y, 2, stroke);
    line(ctx, dpr, x + 1, y - 5, x + 6, y, 2, stroke);
    line(ctx, dpr, x + 1, y + 5, x + 6, y, 2, stroke);
    return;
  }
  if (kind === 'damage') {
    line(ctx, dpr, x - 6, y + 6, x, y - 6, 2, stroke);
    line(ctx, dpr, x, y - 6, x + 6, y + 6, 2, stroke);
    line(ctx, dpr, x - 3, y + 1, x + 3, y + 1, 2, stroke);
    return;
  }
  if (kind === 'rate') {
    ctx.beginPath();
    ctx.arc(x * dpr, y * dpr, 7 * dpr, Math.PI * 0.15, Math.PI * 1.7);
    ctx.stroke();
    line(ctx, dpr, x + 2, y - 4, x + 6, y - 1, 2, stroke);
    return;
  }
  if (kind === 'regen') {
    line(ctx, dpr, x, y - 7, x, y + 7, 2, stroke);
    line(ctx, dpr, x - 4, y - 2, x, y - 7, 2, stroke);
    line(ctx, dpr, x + 4, y - 2, x, y - 7, 2, stroke);
    return;
  }
  if (kind === 'shield') {
    ctx.beginPath();
    ctx.moveTo((x - 6) * dpr, (y - 5) * dpr);
    ctx.lineTo((x + 6) * dpr, (y - 5) * dpr);
    ctx.lineTo((x + 4) * dpr, (y + 3) * dpr);
    ctx.lineTo(x * dpr, (y + 7) * dpr);
    ctx.lineTo((x - 4) * dpr, (y + 3) * dpr);
    ctx.closePath();
    ctx.stroke();
    return;
  }
  if (kind === 'crit') {
    for (let i = 0; i < 5; i += 1) {
      const a0 = -Math.PI / 2 + (Math.PI * 2 * i) / 5;
      const a1 = a0 + Math.PI / 5;
      if (i === 0) ctx.beginPath();
      ctx.lineTo((x + Math.cos(a0) * 7) * dpr, (y + Math.sin(a0) * 7) * dpr);
      ctx.lineTo((x + Math.cos(a1) * 3) * dpr, (y + Math.sin(a1) * 3) * dpr);
    }
    ctx.closePath();
    ctx.stroke();
    return;
  }
  if (kind === 'mult') {
    line(ctx, dpr, x - 6, y - 6, x + 6, y + 6, 2, stroke);
    line(ctx, dpr, x - 6, y + 6, x + 6, y - 6, 2, stroke);
    return;
  }

  line(ctx, dpr, x - 6, y, x + 6, y, 2, stroke);
}
