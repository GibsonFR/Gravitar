import { rgba, worldToScreen } from '../core/Math.js';
import { asteroidPoints } from './AsteroidShape.js';
import { drawWorldHealthBars } from '../ui/worldbars/WorldHealthBarRenderer.js';
import { getAsteroidWorldBarStyle } from './AsteroidWorldBarStyle.js';
import { drawAsteroidLabel } from './AsteroidLabelRenderer.js';

export function drawAsteroid(ctx, view, a, camX, camY) {
  const screen = worldToScreen(camX, camY, a.x, a.y, view.cssW, view.cssH);

  if (a.bastionWall) {
    const c = a.color ?? { r: 34, g: 38, b: 50 };
    const b = a.borderColor ?? { r: 236, g: 190, b: 92 };
    const w = Math.max(12, (a.w || a.radius * 2) * view.dpr);
    const h = Math.max(12, (a.h || a.radius * 2) * view.dpr);
    const x = screen.x * view.dpr - w * 0.5;
    const y = screen.y * view.dpr - h * 0.5;
    const t = performance.now() / 1000;
    ctx.save();
    ctx.fillStyle = rgba(c.r, c.g, c.b, 0.94);
    ctx.strokeStyle = rgba(b.r, b.g, b.b, 0.52 + 0.12 * Math.sin(t * 2.4 + a.id));
    ctx.lineWidth = 2 * view.dpr;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8 * view.dpr);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = rgba(255, 255, 255, 0.45);
    ctx.lineWidth = 1 * view.dpr;
    const step = 44 * view.dpr;
    for (let xx = x - h; xx < x + w + h; xx += step) {
      ctx.beginPath();
      ctx.moveTo(xx, y + h);
      ctx.lineTo(xx + h, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(b.r, b.g, b.b, 0.10);
    ctx.beginPath();
    ctx.roundRect(x + 5 * view.dpr, y + 5 * view.dpr, Math.max(1, w - 10 * view.dpr), Math.max(1, h - 10 * view.dpr), 6 * view.dpr);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (a.testCore) {
    const c = a.color ?? { r: 190, g: 210, b: 255 };
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 280 + a.id);
    ctx.save();
    ctx.fillStyle = rgba(6, 10, 15, 0.86);
    ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.56 + 0.24 * pulse);
    ctx.lineWidth = 2 * view.dpr;
    ctx.beginPath();
    ctx.arc(screen.x * view.dpr, screen.y * view.dpr, a.radius * view.dpr, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.42);
    ctx.setLineDash([4 * view.dpr, 4 * view.dpr]);
    ctx.beginPath();
    ctx.arc(screen.x * view.dpr, screen.y * view.dpr, (a.radius + 7 + pulse * 3) * view.dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = rgba(c.r, c.g, c.b, 0.88);
    ctx.beginPath();
    ctx.arc(screen.x * view.dpr, screen.y * view.dpr, 4.2 * view.dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawWorldHealthBars(ctx, view, a, camX, camY, getAsteroidWorldBarStyle(a));
    drawAsteroidLabel(ctx, view, a, camX, camY);
    return;
  }

  const pts = asteroidPoints(a, screen);

  ctx.fillStyle = rgba(a.color.r, a.color.g, a.color.b, 0.72);
  ctx.beginPath();
  ctx.moveTo(pts[0].x * view.dpr, pts[0].y * view.dpr);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * view.dpr, pts[i].y * view.dpr);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = rgba(a.color.r + 45, a.color.g + 30, a.color.b + 30, 0.95);
  ctx.lineWidth = 2 * view.dpr;
  ctx.stroke();

  drawWorldHealthBars(ctx, view, a, camX, camY, getAsteroidWorldBarStyle(a));
  drawAsteroidLabel(ctx, view, a, camX, camY);
}
