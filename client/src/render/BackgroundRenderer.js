import { rgba } from '../core/Math.js';
import { worldToScreen } from '../core/Math.js';

const BIOME_BACKDROPS = {
  hub: { tint: { r: 55, g: 92, b: 124 }, haze: 0.07, dust: 0.55, line: { r: 74, g: 122, b: 156 } },
  metallic: { tint: { r: 96, g: 110, b: 124 }, haze: 0.09, dust: 0.42, line: { r: 120, g: 138, b: 150 } },
  silicate: { tint: { r: 128, g: 111, b: 82 }, haze: 0.10, dust: 0.50, line: { r: 177, g: 154, b: 110 } },
  organic: { tint: { r: 54, g: 112, b: 77 }, haze: 0.13, dust: 0.66, line: { r: 86, g: 174, b: 106 } },
  volatile: { tint: { r: 42, g: 112, b: 152 }, haze: 0.12, dust: 0.60, line: { r: 80, g: 174, b: 224 } },
  nuclear: { tint: { r: 118, g: 160, b: 58 }, haze: 0.13, dust: 0.48, line: { r: 172, g: 226, b: 88 } },
  anomaly: { tint: { r: 112, g: 72, b: 154 }, haze: 0.16, dust: 0.76, line: { r: 178, g: 122, b: 234 } }
};

function backdropFor(biome) {
  const id = String(biome?.id || biome?.biomeId || '').toLowerCase();
  return BIOME_BACKDROPS[id] || BIOME_BACKDROPS.metallic;
}

function xorshift(s) {
  s ^= (s << 13); s ^= (s >> 17); s ^= (s << 5);
  return s | 0;
}

export function drawStars(ctx, view, camX, camY, density = 1, biome = null) {
  const { cssW, cssH, dpr } = view;
  const bg = backdropFor(biome);

  const g = ctx.createRadialGradient(
    cssW * 0.52 * dpr, cssH * 0.48 * dpr, 0,
    cssW * 0.52 * dpr, cssH * 0.48 * dpr, Math.max(cssW, cssH) * 0.72 * dpr
  );
  g.addColorStop(0, rgba(bg.tint.r, bg.tint.g, bg.tint.b, bg.haze));
  g.addColorStop(1, rgba(bg.tint.r, bg.tint.g, bg.tint.b, 0.0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);

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
        s = xorshift(s);
        const rx = (s & 0xffff) / 0xffff;
        s = xorshift(s);
        const ry = (s & 0xffff) / 0xffff;
        s = xorshift(s);
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

  const dustCell = 420;
  const dc0x = Math.floor(minX / dustCell);
  const dc1x = Math.floor(maxX / dustCell);
  const dc0y = Math.floor(minY / dustCell);
  const dc1y = Math.floor(maxY / dustCell);
  const dustCount = Math.max(0, Math.round(4 * density * bg.dust));
  for (let cy = dc0y; cy <= dc1y; cy++) {
    for (let cx = dc0x; cx <= dc1x; cx++) {
      let s = (cx * 83492791) ^ (cy * 2971215073) ^ 0x6b1f9;
      for (let i = 0; i < dustCount; i += 1) {
        s = xorshift(s);
        const rx = (s & 0xffff) / 0xffff;
        s = xorshift(s);
        const ry = (s & 0xffff) / 0xffff;
        s = xorshift(s);
        const rr = (s & 0xffff) / 0xffff;
        const sx = (cx * dustCell + rx * dustCell - camX * 0.72) + cssW * 0.5;
        const sy = (cy * dustCell + ry * dustCell - camY * 0.72) + cssH * 0.5;
        const r = (18 + rr * 42) * dpr;
        ctx.fillStyle = rgba(bg.tint.r, bg.tint.g, bg.tint.b, 0.018 + rr * 0.035);
        ctx.beginPath();
        ctx.arc(sx * dpr, sy * dpr, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if ((biome?.id || biome?.biomeId) === 'anomaly' || (biome?.id || biome?.biomeId) === 'nuclear') {
    ctx.save();
    ctx.strokeStyle = rgba(bg.line.r, bg.line.g, bg.line.b, (biome?.id || biome?.biomeId) === 'anomaly' ? 0.045 : 0.035);
    ctx.lineWidth = 1 * dpr;
    const gap = 74;
    const offset = ((camX * 0.11 + camY * 0.06) % gap + gap) % gap;
    for (let x = -cssH; x < cssW + cssH; x += gap) {
      ctx.beginPath();
      ctx.moveTo((x + offset) * dpr, cssH * dpr);
      ctx.lineTo((x + cssH * 0.7 + offset) * dpr, 0);
      ctx.stroke();
    }
    ctx.restore();
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
