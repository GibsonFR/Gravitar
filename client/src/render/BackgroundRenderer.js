import { rgba } from '../core/Math.js';
import { worldToScreen } from '../core/Math.js';

const BIOME_BACKDROPS = {
  hub: { tint: { r: 55, g: 92, b: 124 }, haze: 0.16, dust: 0.55, line: { r: 74, g: 122, b: 156 }, star: { r: 210, g: 228, b: 245 } },
  metallic: { tint: { r: 104, g: 118, b: 128 }, haze: 0.20, dust: 0.42, line: { r: 150, g: 162, b: 170 }, star: { r: 235, g: 240, b: 245 } },
  silicate: { tint: { r: 150, g: 116, b: 66 }, haze: 0.24, dust: 0.58, line: { r: 210, g: 158, b: 90 }, star: { r: 255, g: 230, b: 190 } },
  organic: { tint: { r: 36, g: 128, b: 72 }, haze: 0.26, dust: 0.76, line: { r: 76, g: 220, b: 124 }, star: { r: 202, g: 255, b: 210 } },
  volatile: { tint: { r: 38, g: 132, b: 190 }, haze: 0.28, dust: 0.70, line: { r: 100, g: 210, b: 255 }, star: { r: 190, g: 240, b: 255 } },
  nuclear: { tint: { r: 126, g: 176, b: 42 }, haze: 0.30, dust: 0.58, line: { r: 190, g: 255, b: 84 }, star: { r: 220, g: 255, b: 170 } },
  anomaly: { tint: { r: 138, g: 72, b: 190 }, haze: 0.34, dust: 0.88, line: { r: 210, g: 120, b: 255 }, star: { r: 238, g: 210, b: 255 } }
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

  ctx.fillStyle = rgba(bg.tint.r, bg.tint.g, bg.tint.b, Math.min(0.18, bg.haze * 0.38));
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
        const sc = bg.star || { r: 210, g: 225, b: 240 };
        ctx.fillStyle = rgba(sc.r, sc.g, sc.b, alpha);
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

  if (biome?.id || biome?.biomeId) {
    ctx.save();
    const biomeId = biome?.id || biome?.biomeId;
    const lineAlpha = biomeId === 'anomaly' ? 0.090 : (biomeId === 'nuclear' ? 0.075 : 0.045);
    ctx.strokeStyle = rgba(bg.line.r, bg.line.g, bg.line.b, lineAlpha);
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
