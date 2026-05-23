import { rgba } from '../core/Math.js';
import { worldToScreen } from '../core/Math.js';

const BIOME_BACKDROPS = {
  hub: {
    base: { r: 4, g: 10, b: 18 },
    tint: { r: 38, g: 112, b: 172 },
    accent: { r: 82, g: 190, b: 255 },
    haze: 0.34,
    veil: 0.16,
    dust: 0.55,
    line: { r: 92, g: 180, b: 245 },
    star: { r: 220, g: 240, b: 255 }
  },
  metallic: {
    base: { r: 9, g: 11, b: 13 },
    tint: { r: 118, g: 128, b: 138 },
    accent: { r: 210, g: 220, b: 230 },
    haze: 0.28,
    veil: 0.13,
    dust: 0.42,
    line: { r: 180, g: 190, b: 200 },
    star: { r: 240, g: 244, b: 248 }
  },
  silicate: {
    base: { r: 18, g: 13, b: 7 },
    tint: { r: 190, g: 142, b: 70 },
    accent: { r: 255, g: 202, b: 120 },
    haze: 0.42,
    veil: 0.24,
    dust: 0.72,
    line: { r: 235, g: 172, b: 80 },
    star: { r: 255, g: 228, b: 186 }
  },
  organic: {
    base: { r: 3, g: 18, b: 10 },
    tint: { r: 35, g: 160, b: 78 },
    accent: { r: 96, g: 255, b: 132 },
    haze: 0.44,
    veil: 0.26,
    dust: 0.86,
    line: { r: 86, g: 235, b: 120 },
    star: { r: 205, g: 255, b: 214 }
  },
  volatile: {
    base: { r: 2, g: 12, b: 24 },
    tint: { r: 30, g: 148, b: 222 },
    accent: { r: 130, g: 234, b: 255 },
    haze: 0.48,
    veil: 0.28,
    dust: 0.82,
    line: { r: 120, g: 220, b: 255 },
    star: { r: 195, g: 242, b: 255 }
  },
  nuclear: {
    base: { r: 12, g: 17, b: 3 },
    tint: { r: 150, g: 220, b: 40 },
    accent: { r: 218, g: 255, b: 96 },
    haze: 0.50,
    veil: 0.30,
    dust: 0.74,
    line: { r: 205, g: 255, b: 80 },
    star: { r: 225, g: 255, b: 180 }
  },
  anomaly: {
    base: { r: 12, g: 5, b: 22 },
    tint: { r: 158, g: 78, b: 225 },
    accent: { r: 238, g: 140, b: 255 },
    haze: 0.56,
    veil: 0.34,
    dust: 0.96,
    line: { r: 220, g: 132, b: 255 },
    star: { r: 242, g: 215, b: 255 }
  }
};

function backdropFor(biome) {
  const id = String(biome?.id || biome?.biomeId || biome || '').toLowerCase();
  return BIOME_BACKDROPS[id] || BIOME_BACKDROPS.metallic;
}

function biomeIdFor(biome) {
  return String(biome?.id || biome?.biomeId || biome || '').toLowerCase();
}

function xorshift(s) {
  s ^= (s << 13); s ^= (s >> 17); s ^= (s << 5);
  return s | 0;
}

function drawBiomeVeil(ctx, view, camX, camY, bg, biomeId) {
  const { cssW, cssH, dpr } = view;
  ctx.save();

  ctx.fillStyle = rgba(bg.base.r, bg.base.g, bg.base.b, 0.96);
  ctx.fillRect(0, 0, view.w, view.h);

  const cx = (cssW * 0.48 + Math.sin(camX * 0.0007) * cssW * 0.08) * dpr;
  const cy = (cssH * 0.45 + Math.cos(camY * 0.0006) * cssH * 0.08) * dpr;
  const r0 = Math.max(cssW, cssH) * 0.12 * dpr;
  const r1 = Math.max(cssW, cssH) * 0.92 * dpr;
  const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
  g.addColorStop(0, rgba(bg.tint.r, bg.tint.g, bg.tint.b, bg.haze));
  g.addColorStop(0.45, rgba(bg.tint.r, bg.tint.g, bg.tint.b, bg.veil));
  g.addColorStop(1, rgba(bg.tint.r, bg.tint.g, bg.tint.b, 0.03));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);

  const g2 = ctx.createLinearGradient(0, 0, view.w, view.h);
  g2.addColorStop(0, rgba(bg.accent.r, bg.accent.g, bg.accent.b, biomeId === 'metallic' ? 0.08 : 0.15));
  g2.addColorStop(0.52, rgba(bg.tint.r, bg.tint.g, bg.tint.b, 0.02));
  g2.addColorStop(1, rgba(bg.tint.r, bg.tint.g, bg.tint.b, biomeId === 'metallic' ? 0.12 : 0.21));
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, view.w, view.h);

  ctx.globalCompositeOperation = 'screen';
  const cloudCell = 680;
  const minX = camX - cssW * 0.9;
  const maxX = camX + cssW * 0.9;
  const minY = camY - cssH * 0.9;
  const maxY = camY + cssH * 0.9;
  const c0x = Math.floor(minX / cloudCell);
  const c1x = Math.floor(maxX / cloudCell);
  const c0y = Math.floor(minY / cloudCell);
  const c1y = Math.floor(maxY / cloudCell);
  const cloudCount = Math.max(1, Math.round(2 + bg.dust * 4));
  for (let cyi = c0y; cyi <= c1y; cyi += 1) {
    for (let cxi = c0x; cxi <= c1x; cxi += 1) {
      let s = (cxi * 1402946737) ^ (cyi * 6542989) ^ 0x3a71f5;
      for (let i = 0; i < cloudCount; i += 1) {
        s = xorshift(s);
        const rx = (s & 0xffff) / 0xffff;
        s = xorshift(s);
        const ry = (s & 0xffff) / 0xffff;
        s = xorshift(s);
        const rr = (s & 0xffff) / 0xffff;
        const sx = (cxi * cloudCell + rx * cloudCell - camX * 0.42) + cssW * 0.5;
        const sy = (cyi * cloudCell + ry * cloudCell - camY * 0.42) + cssH * 0.5;
        const radius = (120 + rr * 260) * dpr;
        const cg = ctx.createRadialGradient(sx * dpr, sy * dpr, 0, sx * dpr, sy * dpr, radius);
        cg.addColorStop(0, rgba(bg.tint.r, bg.tint.g, bg.tint.b, 0.055 + rr * 0.045));
        cg.addColorStop(1, rgba(bg.tint.r, bg.tint.g, bg.tint.b, 0));
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(sx * dpr, sy * dpr, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

export function drawStars(ctx, view, camX, camY, density = 1, biome = null) {
  const { cssW, cssH, dpr } = view;
  const bg = backdropFor(biome);
  const biomeId = biomeIdFor(biome);

  drawBiomeVeil(ctx, view, camX, camY, bg, biomeId);

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
        const alpha = 0.14 + rr * 0.44;
        const sc = bg.star || { r: 210, g: 225, b: 240 };
        ctx.fillStyle = rgba(sc.r, sc.g, sc.b, alpha);
        ctx.fillRect(sx * dpr, sy * dpr, size * dpr, size * dpr);
      }
    }
  }

  ctx.save();
  const lineAlpha = biomeId === 'anomaly' ? 0.16 : (biomeId === 'nuclear' ? 0.13 : (biomeId === 'metallic' ? 0.075 : 0.11));
  ctx.strokeStyle = rgba(bg.line.r, bg.line.g, bg.line.b, lineAlpha);
  ctx.lineWidth = 1 * dpr;
  const gap = biomeId === 'volatile' ? 58 : (biomeId === 'organic' ? 92 : 74);
  const offset = ((camX * 0.11 + camY * 0.06) % gap + gap) % gap;
  for (let x = -cssH; x < cssW + cssH; x += gap) {
    ctx.beginPath();
    if (biomeId === 'organic') {
      const y0 = (Math.sin((x + camX * 0.05) * 0.012) * 16 + cssH) * dpr;
      ctx.moveTo((x + offset) * dpr, y0);
      ctx.bezierCurveTo((x + 120 + offset) * dpr, (cssH * 0.75) * dpr, (x + 220 + offset) * dpr, (cssH * 0.25) * dpr, (x + cssH * 0.62 + offset) * dpr, 0);
    } else {
      ctx.moveTo((x + offset) * dpr, cssH * dpr);
      ctx.lineTo((x + cssH * 0.7 + offset) * dpr, 0);
    }
    ctx.stroke();
  }
  ctx.restore();
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
