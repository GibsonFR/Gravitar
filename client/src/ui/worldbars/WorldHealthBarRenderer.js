import { clamp, rgba, worldToScreen } from '../../core/Math.js';

function drawSingleBar(ctx, view, x, y, width, height, ratio, palette) {
  ctx.fillStyle = rgba(palette.back.r, palette.back.g, palette.back.b, palette.back.a ?? 0.72);
  ctx.fillRect(x * view.dpr, y * view.dpr, width * view.dpr, height * view.dpr);

  ctx.fillStyle = rgba(palette.fill.r, palette.fill.g, palette.fill.b, 0.95);
  ctx.fillRect(x * view.dpr, y * view.dpr, (width * ratio) * view.dpr, height * view.dpr);
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
