import { clamp, rgba, worldToScreen } from '../../core/Math.js';

function drawSingleBar(ctx, view, x, y, width, height, ratio, palette) {
  ctx.fillStyle = rgba(palette.back.r, palette.back.g, palette.back.b, palette.back.a ?? 0.72);
  ctx.fillRect(x * view.dpr, y * view.dpr, width * view.dpr, height * view.dpr);

  ctx.fillStyle = rgba(palette.fill.r, palette.fill.g, palette.fill.b, 0.95);
  ctx.fillRect(x * view.dpr, y * view.dpr, (width * ratio) * view.dpr, height * view.dpr);
}

function getSigilRuneStatus(entity) {
  const statuses = entity?.statuses ?? [];
  return statuses.find((s) => s?.id === 'mark' && (s.markKey === 'sigil_runes' || s.label === 'Rune')) || null;
}

function hexPath(ctx, x, y, radius, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = rotation + Math.PI / 6 + i * Math.PI / 3;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawSigilRuneOrbit(ctx, view, screenX, screenY, entity) {
  const rune = getSigilRuneStatus(entity);
  if (!rune) return;

  const max = Math.max(1, rune.maxStacks ?? 5);
  const stacks = clamp(rune.stacks ?? 0, 0, max);
  if (stacks <= 0) return;

  const dpr = view.dpr;
  const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
  const idOffset = ((entity?.id ?? 0) % 31) * 0.071;
  const radius = Math.max(18, Math.min(46, (entity?.radius ?? 18) + 13));
  const size = Math.max(3.2, Math.min(6.2, radius * 0.16));
  const phase = t * 1.85 + idOffset;

  ctx.save();
  ctx.translate(screenX * dpr, screenY * dpr);
  ctx.scale(dpr, dpr);

  ctx.strokeStyle = rgba(166, 94, 230, 0.18);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < max; i += 1) {
    const filled = i < stacks;
    const a = phase + i * (Math.PI * 2 / max);
    const wobble = Math.sin(t * 3.4 + i * 1.7 + idOffset) * 1.6;
    const x = Math.cos(a) * (radius + wobble);
    const y = Math.sin(a) * (radius + wobble);
    const pulse = filled ? (0.86 + 0.14 * Math.sin(t * 5.0 + i)) : 0.72;
    const r = size * pulse;

    if (filled) {
      ctx.shadowColor = rgba(202, 118, 255, 0.55);
      ctx.shadowBlur = 8;
      ctx.fillStyle = rgba(128, 53, 184, 0.82);
      hexPath(ctx, x, y, r + 1.2, -a * 0.35);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = rgba(216, 144, 255, 0.95);
      hexPath(ctx, x, y, r, a * 0.55);
      ctx.fill();
      ctx.strokeStyle = rgba(255, 236, 255, 0.82);
      ctx.lineWidth = 1.05;
      ctx.stroke();
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = rgba(43, 32, 56, 0.30);
      hexPath(ctx, x, y, r * 0.85, a * 0.55);
      ctx.fill();
      ctx.strokeStyle = rgba(166, 94, 230, 0.30);
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawTempShieldOverlay(ctx, view, x, y, width, height, ratio) {
  if (ratio <= 0) return;
  const dpr = view.dpr;
  const overlayH = Math.max(1.5, height * 0.42);
  const yy = y - overlayH - 1;
  ctx.fillStyle = rgba(126, 222, 255, 0.26);
  ctx.fillRect(x * dpr, yy * dpr, width * dpr, overlayH * dpr);
  ctx.fillStyle = rgba(188, 244, 255, 0.92);
  ctx.fillRect(x * dpr, yy * dpr, (width * ratio) * dpr, overlayH * dpr);
}

export function drawWorldHealthBars(ctx, view, entity, camX, camY, config) {
  const vitals = entity?.vitals;
  if (!vitals || !config?.bars?.length) return;

  const screen = worldToScreen(camX, camY, entity.x, entity.y, view.cssW, view.cssH);
  drawSigilRuneOrbit(ctx, view, screen.x, screen.y, entity);

  const width = config.width;
  const x = screen.x - width * 0.5;
  let y = screen.y + (config.offsetY ?? 0);

  for (const bar of config.bars) {
    const value = vitals[bar.valueKey] ?? 0;
    const maxValue = Math.max(1, vitals[bar.maxKey] ?? 0);
    const ratio = clamp(value / maxValue, 0, 1);
    if (!bar.showWhenZero && ratio <= 0) {
      y += (bar.height ?? 4) + (bar.gapAfter ?? 0);
      continue;
    }

    const barHeight = bar.height ?? 4;
    drawSingleBar(ctx, view, x, y, width, barHeight, ratio, bar.palette);
    if (bar.valueKey === 'shield') {
      const tempShield = Math.max(0, vitals.tempShield ?? 0);
      const tempRatio = clamp(tempShield / maxValue, 0, 1);
      drawTempShieldOverlay(ctx, view, x, y, width, barHeight, tempRatio);
    }
    y += barHeight + (bar.gapAfter ?? 0);
  }
}
