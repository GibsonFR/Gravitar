import { rgba } from '../core/Math.js';
import { worldToScreen } from '../core/Math.js';

export function drawStars(ctx, view, camX, camY, density = 1) {
  const { cssW, cssH, dpr } = view;
  const cell = 240;
  const seed = 1337;
  const minX = camX - cssW * 0.7;
  const maxX = camX + cssW * 0.7;
  const minY = camY - cssH * 0.7;
  const maxY = camY + cssH * 0.7;
  const c0x = Math.floor(minX / cell);
  const c1x = Math.floor(maxX / cell);
  const c0y = Math.floor(minY / cell);
  const c1y = Math.floor(maxY / cell);

  for (let cy = c0y; cy <= c1y; cy++) {
    for (let cx = c0x; cx <= c1x; cx++) {
      let s = (cx * 73856093) ^ (cy * 19349663) ^ seed;
      for (let i = 0; i < Math.max(0, Math.round(5 * density)); i++) {
        s ^= (s << 13); s ^= (s >> 17); s ^= (s << 5);
        const rx = (s & 0xffff) / 0xffff;
        s ^= (s << 13); s ^= (s >> 17); s ^= (s << 5);
        const ry = (s & 0xffff) / 0xffff;
        s ^= (s << 13); s ^= (s >> 17); s ^= (s << 5);
        const rr = (s & 0xffff) / 0xffff;
        const sx = (cx * cell + rx * cell - camX) + cssW * 0.5;
        const sy = (cy * cell + ry * cell - camY) + cssH * 0.5;
        const size = 0.8 + rr * 1.8;
        const alpha = 0.12 + rr * 0.40;
        ctx.fillStyle = rgba(210, 225, 240, alpha);
        ctx.fillRect(sx * dpr, sy * dpr, size * dpr, size * dpr);
      }
    }
  }
}

export function drawGrid(ctx, view, camX, camY, world) {
  const { cssW, cssH, w, h, dpr } = view;

  const cell = 320;
  const startX = Math.floor((camX - cssW * 0.5) / cell) * cell;
  const endX = Math.floor((camX + cssW * 0.5) / cell) * cell;
  const startY = Math.floor((camY - cssH * 0.5) / cell) * cell;
  const endY = Math.floor((camY + cssH * 0.5) / cell) * cell;

  ctx.strokeStyle = rgba(35, 50, 68, 0.22);
  ctx.lineWidth = dpr;
  for (let x = startX; x <= endX; x += cell) {
    const sx = (x - camX + cssW * 0.5) * dpr;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, h);
    ctx.stroke();
  }
  for (let y = startY; y <= endY; y += cell) {
    const sy = (y - camY + cssH * 0.5) * dpr;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
    ctx.stroke();
  }

  const tl = worldToScreen(camX, camY, -world.halfW, -world.halfH, cssW, cssH);
  const br = worldToScreen(camX, camY, world.halfW, world.halfH, cssW, cssH);
  ctx.strokeStyle = rgba(70, 110, 145, 0.35);
  ctx.lineWidth = 2 * dpr;
  ctx.strokeRect(tl.x * dpr, tl.y * dpr, (br.x - tl.x) * dpr, (br.y - tl.y) * dpr);
}
