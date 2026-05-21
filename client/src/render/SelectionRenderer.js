import { worldToScreen } from '../core/Math.js';

export function drawSelectionRing(ctx, view, x, y, r, color, camX, camY) {
  const s = worldToScreen(camX, camY, x, y, view.cssW, view.cssH);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * view.dpr;
  ctx.beginPath();
  ctx.arc(s.x * view.dpr, s.y * view.dpr, (r + 8) * view.dpr, 0, Math.PI * 2);
  ctx.stroke();
}
