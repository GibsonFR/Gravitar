import { rgba, worldToScreen } from '../core/Math.js';

export function drawStation(ctx, view, s, camX, camY, t) {
  const p = worldToScreen(camX, camY, s.x, s.y, view.cssW, view.cssH);
  const pulse = 0.55 + 0.45 * Math.sin(t * 2.6 + s.pulse);
  const base = s.specialtyId === 'pirate' ? { r: 255, g: 86, b: 92 } : (s.tech ? { r: 160, g: 100, b: 255 } : { r: 92, g: 142, b: 214 });

  ctx.fillStyle = rgba(base.r, base.g, base.b, 0.82);
  ctx.beginPath();
  ctx.arc(p.x * view.dpr, p.y * view.dpr, s.radius * view.dpr, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = rgba(255, 255, 255, 0.95);
  ctx.lineWidth = 2 * view.dpr;
  ctx.stroke();

  const ringR = s.radius + 10 + 2.2 * pulse;
  ctx.strokeStyle = rgba(255, 255, 255, 0.45);
  ctx.lineWidth = 1.6 * view.dpr;
  ctx.beginPath();
  ctx.arc(p.x * view.dpr, p.y * view.dpr, ringR * view.dpr, 0, Math.PI * 2);
  ctx.stroke();

  const rot = t * 0.85;
  for (let i = 0; i < 4; i++) {
    const a = rot + i * Math.PI * 0.5;
    const lx = p.x + Math.cos(a) * ringR;
    const ly = p.y + Math.sin(a) * ringR;
    ctx.fillStyle = rgba(255, 255, 255, 0.7 + pulse * 0.2);
    ctx.beginPath();
    ctx.arc(lx * view.dpr, ly * view.dpr, 2.2 * view.dpr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = rgba(255, 255, 255, 0.9);
  ctx.lineWidth = 2 * view.dpr;
  if (s.specialtyId === 'pirate') {
    ctx.beginPath();
    ctx.moveTo((p.x - 10) * view.dpr, (p.y + 7) * view.dpr);
    ctx.lineTo(p.x * view.dpr, (p.y - 10) * view.dpr);
    ctx.lineTo((p.x + 10) * view.dpr, (p.y + 7) * view.dpr);
    ctx.closePath();
    ctx.stroke();
  } else if (s.tech) {
    ctx.strokeRect((p.x - 8) * view.dpr, (p.y - 8) * view.dpr, 16 * view.dpr, 16 * view.dpr);
  } else {
    ctx.beginPath();
    ctx.arc(p.x * view.dpr, p.y * view.dpr, 9 * view.dpr, 0, Math.PI * 2);
    ctx.stroke();
  }
}
