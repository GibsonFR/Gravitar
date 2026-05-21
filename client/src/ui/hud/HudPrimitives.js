import { rgba, clamp } from '../../core/Math.js';

export function drawPanel(ctx, dpr, x, y, w, h, accent = null, alpha = 0.95) {
  ctx.fillStyle = rgba(7, 10, 16, alpha);
  ctx.fillRect(x * dpr, y * dpr, w * dpr, h * dpr);
  ctx.fillStyle = rgba(22, 28, 40, 0.42);
  ctx.fillRect((x + 1) * dpr, (y + 1) * dpr, (w - 2) * dpr, Math.max(8, h * 0.36) * dpr);
  ctx.strokeStyle = accent
    ? rgba(accent.r, accent.g, accent.b, 0.72)
    : rgba(104, 132, 168, 0.44);
  ctx.lineWidth = dpr;
  ctx.strokeRect(x * dpr, y * dpr, w * dpr, h * dpr);
}

export function drawBar(ctx, dpr, x, y, w, h, ratio, fill, text, trackAlpha = 0.84) {
  ratio = clamp(ratio, 0, 1);
  ctx.fillStyle = rgba(10, 14, 20, trackAlpha);
  ctx.fillRect(x * dpr, y * dpr, w * dpr, h * dpr);
  if (ratio > 0) {
    ctx.fillStyle = rgba(fill.r, fill.g, fill.b, 0.96);
    ctx.fillRect(x * dpr, y * dpr, (w * ratio) * dpr, h * dpr);
  }
  ctx.strokeStyle = rgba(255, 255, 255, 0.08);
  ctx.lineWidth = dpr;
  ctx.strokeRect(x * dpr, y * dpr, w * dpr, h * dpr);
  if (text) {
    ctx.fillStyle = rgba(238, 244, 255, 0.92);
    ctx.font = `${10 * dpr}px Segoe UI`;
    ctx.textAlign = 'right';
    ctx.fillText(text, (x + w - 4) * dpr, (y + h - 3) * dpr);
  }
}

export function drawBadge(ctx, dpr, x, y, text, accent, options = {}) {
  const px = options.paddingX ?? 8;
  const py = options.paddingY ?? 4;
  ctx.font = `${(options.fontSize ?? 11) * dpr}px Segoe UI`;
  const width = ctx.measureText(text).width / dpr + px * 2;
  const h = options.height ?? 20;
  ctx.fillStyle = rgba(8, 12, 18, 0.96);
  ctx.fillRect(x * dpr, y * dpr, width * dpr, h * dpr);
  ctx.strokeStyle = rgba(accent.r, accent.g, accent.b, 0.86);
  ctx.lineWidth = dpr;
  ctx.strokeRect(x * dpr, y * dpr, width * dpr, h * dpr);
  ctx.fillStyle = rgba(238, 244, 255, 0.95);
  ctx.textAlign = 'left';
  ctx.fillText(text, (x + px) * dpr, (y + h - py - 2) * dpr);
  return width;
}

export function drawChip(ctx, dpr, x, y, w, h, title, value, accent) {
  drawPanel(ctx, dpr, x, y, w, h, accent, 0.9);
  ctx.fillStyle = rgba(176, 192, 214, 0.74);
  ctx.font = `${9 * dpr}px Segoe UI`;
  ctx.textAlign = 'left';
  ctx.fillText(title, (x + 8) * dpr, (y + 12) * dpr);
  ctx.fillStyle = rgba(242, 247, 255, 0.96);
  ctx.font = `${12 * dpr}px Segoe UI`;
  ctx.fillText(value, (x + 8) * dpr, (y + h - 7) * dpr);
}

export function fitLabel(label, maxChars = 14) {
  const txt = String(label || '');
  return txt.length <= maxChars ? txt : `${txt.slice(0, Math.max(0, maxChars - 1))}…`;
}
