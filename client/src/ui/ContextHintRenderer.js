import { distSq, rgba } from '../core/Math.js';

export function drawContextHint(ctx, view, me, stations) {
  if (!me) return;
  let nearest = null;
  let bestD2 = Infinity;
  for (const s of stations.values()) {
    const d2 = distSq(me.x, me.y, s.x, s.y);
    if (d2 < bestD2) { bestD2 = d2; nearest = s; }
  }
  if (nearest && bestD2 <= 90 * 90) {
    ctx.fillStyle = rgba(8, 10, 14, 0.82);
    const boxW = 144;
    const boxH = 24;
    const x = view.cssW * 0.5 - boxW * 0.5;
    const y = view.cssH - 98;
    ctx.fillRect(x * view.dpr, y * view.dpr, boxW * view.dpr, boxH * view.dpr);
    ctx.strokeStyle = rgba(176, 120, 255, 0.65);
    ctx.lineWidth = view.dpr;
    ctx.strokeRect(x * view.dpr, y * view.dpr, boxW * view.dpr, boxH * view.dpr);
    ctx.fillStyle = rgba(235, 242, 255, 0.95);
    ctx.textAlign = 'center';
    ctx.font = `${12 * view.dpr}px Segoe UI`;
    ctx.fillText('D • amarrer', (x + boxW * 0.5) * view.dpr, (y + 16) * view.dpr);
  }
}
