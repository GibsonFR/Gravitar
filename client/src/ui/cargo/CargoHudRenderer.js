import { rgba } from '../../core/Math.js';

export function drawCargoHud(ctx, view, inv) {
  if (!inv) return;

  const x = 12;
  const y = 12;
  const w = 190;
  const h = 48;

  ctx.fillStyle = rgba(8, 10, 14, 0.78);
  ctx.fillRect(x * view.dpr, y * view.dpr, w * view.dpr, h * view.dpr);
  ctx.strokeStyle = rgba(95, 125, 155, 0.55);
  ctx.lineWidth = view.dpr;
  ctx.strokeRect(x * view.dpr, y * view.dpr, w * view.dpr, h * view.dpr);

  ctx.font = `${12 * view.dpr}px Segoe UI`;
  ctx.textAlign = 'left';
  ctx.fillStyle = rgba(230, 240, 255, 0.92);
  ctx.fillText(`Fer: ${inv.fer | 0}`, (x + 10) * view.dpr, (y + 18) * view.dpr);

  ctx.fillStyle = rgba(200, 215, 230, 0.78);
  ctx.fillText(`Cargo: ${(inv.cargoUsed | 0)} / ${(inv.cargoMax | 0)}`, (x + 10) * view.dpr, (y + 38) * view.dpr);
}
