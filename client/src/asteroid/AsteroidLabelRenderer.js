import { rgba, worldToScreen } from '../core/Math.js';

export function drawAsteroidLabel(ctx, view, a, camX, camY) {
  const name = a?.resourceName || '';
  if (!name) return;

  const p = worldToScreen(camX, camY, a.x, a.y, view.cssW, view.cssH);
  const y = p.y - (a.radius || 0) - 26;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${12 * view.dpr}px Segoe UI`;

  const tw = ctx.measureText(name).width / view.dpr;
  ctx.fillStyle = rgba(3, 6, 11, 0.70);
  ctx.fillRect((p.x - tw * 0.5 - 6) * view.dpr, (y - 13) * view.dpr, (tw + 12) * view.dpr, 17 * view.dpr);
  ctx.strokeStyle = rgba(255, 216, 120, 0.20);
  ctx.lineWidth = view.dpr;
  ctx.strokeRect((p.x - tw * 0.5 - 6) * view.dpr, (y - 13) * view.dpr, (tw + 12) * view.dpr, 17 * view.dpr);
  ctx.fillStyle = rgba(245, 250, 255, 0.98);
  ctx.fillText(name, p.x * view.dpr, y * view.dpr);
}
