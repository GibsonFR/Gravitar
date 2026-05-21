import { clamp, rgba } from '../../core/Math.js';

export function roundedRectPath(ctx, x, y, w, h, r, dpr) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
  ctx.beginPath();
  ctx.moveTo((x + rr) * dpr, y * dpr);
  ctx.arcTo((x + w) * dpr, y * dpr, (x + w) * dpr, (y + h) * dpr, rr * dpr);
  ctx.arcTo((x + w) * dpr, (y + h) * dpr, x * dpr, (y + h) * dpr, rr * dpr);
  ctx.arcTo(x * dpr, (y + h) * dpr, x * dpr, y * dpr, rr * dpr);
  ctx.arcTo(x * dpr, y * dpr, (x + w) * dpr, y * dpr, rr * dpr);
  ctx.closePath();
}

export function fillRoundedRect(ctx, dpr, x, y, w, h, r, fillStyle, strokeStyle = null, lineWidth = 1) {
  roundedRectPath(ctx, x, y, w, h, r, dpr);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth * dpr;
    ctx.stroke();
  }
}

function drawTrimLine(ctx, dpr, ax, ay, bx, by, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width * dpr;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ax * dpr, ay * dpr);
  ctx.lineTo(bx * dpr, by * dpr);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

export function drawHudPlate(ctx, dpr, x, y, w, h, accent) {
  const cx = x + w * 0.5;
  const orbW = 154;
  const orbH = 98;
  const railY = y + h - 72;
  const wingY = y + h - 86;

  fillRoundedRect(ctx, dpr, x + 6, railY, w - 12, 66, 26, rgba(4, 7, 12, 0.94), rgba(87, 103, 132, 0.22));
  fillRoundedRect(ctx, dpr, x + 14, wingY, 168, 78, 24, rgba(6, 9, 15, 0.96), rgba(92, 110, 139, 0.22));
  fillRoundedRect(ctx, dpr, x + w - 182, wingY, 168, 78, 24, rgba(6, 9, 15, 0.96), rgba(92, 110, 139, 0.22));
  fillRoundedRect(ctx, dpr, cx - 112, y + 40, 224, 24, 12, rgba(8, 12, 18, 0.92), rgba(255, 255, 255, 0.04));
  fillRoundedRect(ctx, dpr, cx - orbW * 0.5, y, orbW, orbH, 34, rgba(8, 12, 18, 0.98), rgba(accent.r, accent.g, accent.b, 0.48));
  fillRoundedRect(ctx, dpr, cx - orbW * 0.5 + 4, y + 4, orbW - 8, 18, 12, rgba(255, 255, 255, 0.03));

  drawTrimLine(ctx, dpr, x + 170, wingY + 14, cx - 86, y + 58, rgba(110, 124, 154, 0.24));
  drawTrimLine(ctx, dpr, x + w - 170, wingY + 14, cx + 86, y + 58, rgba(110, 124, 154, 0.24));
  drawTrimLine(ctx, dpr, x + 34, wingY + 18, x + 152, wingY + 18, rgba(255, 255, 255, 0.04));
  drawTrimLine(ctx, dpr, x + w - 152, wingY + 18, x + w - 34, wingY + 18, rgba(255, 255, 255, 0.04));
}

export function drawOrbPanel(ctx, dpr, cx, cy, radius, palette, xp01, levelText) {
  const outerR = radius + 11;
  const arcR = radius + 19;
  ctx.beginPath();
  ctx.arc(cx * dpr, cy * dpr, arcR * dpr, Math.PI * 0.78, Math.PI * 2.22, false);
  ctx.strokeStyle = rgba(92, 106, 132, 0.28);
  ctx.lineWidth = 6 * dpr;
  ctx.stroke();

  if (xp01 > 0.001) {
    ctx.beginPath();
    ctx.arc(cx * dpr, cy * dpr, arcR * dpr, Math.PI * 0.78, Math.PI * (0.78 + 1.44 * clamp(xp01, 0, 1)), false);
    ctx.strokeStyle = rgba(220, 183, 78, 0.98);
    ctx.lineWidth = 6 * dpr;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  ctx.beginPath();
  ctx.arc(cx * dpr, cy * dpr, outerR * dpr, 0, Math.PI * 2);
  ctx.fillStyle = rgba(4, 7, 12, 0.98);
  ctx.fill();
  ctx.strokeStyle = rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.74);
  ctx.lineWidth = 2 * dpr;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx * dpr, cy * dpr, radius * dpr, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(cx * dpr, (cy - 5) * dpr, 2 * dpr, cx * dpr, cy * dpr, radius * dpr);
  g.addColorStop(0, rgba(250, 252, 255, 0.96));
  g.addColorStop(0.18, rgba(palette.core.r, palette.core.g, palette.core.b, 0.94));
  g.addColorStop(0.55, rgba(palette.hull.r, palette.hull.g, palette.hull.b, 0.86));
  g.addColorStop(1, rgba(15, 20, 32, 0.98));
  ctx.fillStyle = g;
  ctx.fill();

  fillRoundedRect(ctx, dpr, cx - 18, cy + radius - 2, 36, 18, 7, rgba(8, 12, 18, 0.98), rgba(219, 183, 78, 0.56));
  ctx.fillStyle = rgba(247, 236, 197, 0.98);
  ctx.font = `${10 * dpr}px Segoe UI`;
  ctx.textAlign = 'center';
  ctx.fillText(levelText, cx * dpr, (cy + radius + 10) * dpr);
}

export function drawMeterRow(ctx, dpr, x, y, w, h, ratio, fill, text) {
  const textReserve = text ? Math.min(94, Math.max(58, w * 0.26)) : 0;
  const trackW = Math.max(24, w - textReserve - (text ? 7 : 0));
  fillRoundedRect(ctx, dpr, x, y, trackW, h, h * 0.5, rgba(10, 14, 22, 0.94), rgba(255, 255, 255, 0.04));
  if (ratio > 0.001) {
    fillRoundedRect(ctx, dpr, x + 1, y + 1, Math.max(0, (trackW - 2) * clamp(ratio, 0, 1)), h - 2, Math.max(1, h * 0.5 - 1), rgba(fill.r, fill.g, fill.b, 0.96));
  }
  if (text) {
    ctx.fillStyle = rgba(238, 244, 255, 0.92);
    ctx.font = `${9 * dpr}px Segoe UI`;
    ctx.textAlign = 'right';
    ctx.fillText(text, (x + w - 2) * dpr, (y + h - 3) * dpr);
  }
}

export function drawPips(ctx, dpr, x, y, count, filled, accent, options = {}) {
  const size = options.size ?? 7;
  const gap = options.gap ?? 4;
  const radius = Math.max(1.6, size * 0.34);
  for (let i = 0; i < count; i += 1) {
    const px = x + i * (size + gap) + size * 0.5;
    const py = y + size * 0.5;
    ctx.beginPath();
    ctx.arc(px * dpr, py * dpr, radius * dpr, 0, Math.PI * 2);
    ctx.fillStyle = i < filled ? rgba(accent.r, accent.g, accent.b, 0.96) : rgba(62, 70, 88, 0.82);
    ctx.fill();
  }
}
