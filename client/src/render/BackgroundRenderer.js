import { rgba } from '../core/Math.js';
import { worldToScreen } from '../core/Math.js';

const BIOME_BACKDROPS = {
  hub: {
    base: { r: 3, g: 8, b: 15 },
    tint: { r: 70, g: 145, b: 210 },
    accent: { r: 115, g: 205, b: 255 },
    haze: 0.050,
    dust: 0.42,
    line: { r: 75, g: 150, b: 210 },
    star: { r: 220, g: 240, b: 255 },
    pattern: 'calm'
  },
  metallic: {
    base: { r: 3, g: 5, b: 8 },
    tint: { r: 95, g: 110, b: 125 },
    accent: { r: 200, g: 215, b: 225 },
    haze: 0.045,
    dust: 0.35,
    line: { r: 130, g: 145, b: 160 },
    star: { r: 235, g: 240, b: 245 },
    pattern: 'fragments'
  },
  silicate: {
    base: { r: 6, g: 5, b: 4 },
    tint: { r: 145, g: 105, b: 60 },
    accent: { r: 215, g: 180, b: 115 },
    haze: 0.060,
    dust: 0.58,
    line: { r: 135, g: 105, b: 70 },
    star: { r: 255, g: 232, b: 190 },
    pattern: 'dust'
  },
  organic: {
    base: { r: 2, g: 8, b: 7 },
    tint: { r: 40, g: 125, b: 80 },
    accent: { r: 100, g: 220, b: 145 },
    haze: 0.065,
    dust: 0.66,
    line: { r: 70, g: 175, b: 115 },
    star: { r: 210, g: 255, b: 220 },
    pattern: 'wisps'
  },
  volatile: {
    base: { r: 2, g: 7, b: 13 },
    tint: { r: 55, g: 135, b: 190 },
    accent: { r: 145, g: 230, b: 255 },
    haze: 0.070,
    dust: 0.62,
    line: { r: 95, g: 195, b: 240 },
    star: { r: 200, g: 240, b: 255 },
    pattern: 'ice'
  },
  nuclear: {
    base: { r: 5, g: 8, b: 3 },
    tint: { r: 110, g: 175, b: 45 },
    accent: { r: 205, g: 255, b: 115 },
    haze: 0.060,
    dust: 0.44,
    line: { r: 155, g: 220, b: 75 },
    star: { r: 225, g: 255, b: 190 },
    pattern: 'radiation'
  },
  anomaly: {
    base: { r: 5, g: 3, b: 12 },
    tint: { r: 120, g: 70, b: 190 },
    accent: { r: 225, g: 150, b: 255 },
    haze: 0.075,
    dust: 0.72,
    line: { r: 185, g: 125, b: 255 },
    star: { r: 240, g: 215, b: 255 },
    pattern: 'anomaly'
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

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function random01FromSeed(seed) {
  const s = xorshift(seed | 0);
  return ((s >>> 0) % 100000) / 100000;
}

function fillBaseSpace(ctx, view, bg) {
  const g = ctx.createLinearGradient(0, 0, 0, view.h);
  g.addColorStop(0, rgba(bg.base.r, bg.base.g, bg.base.b, 0.98));
  g.addColorStop(0.55, rgba(0, 2, 5, 0.985));
  g.addColorStop(1, rgba(1, 4, 8, 0.99));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);
}

function drawLocalNebula(ctx, view, camX, camY, bg, biomeId) {
  const { cssW, cssH, dpr } = view;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const cx = (cssW * 0.58 + Math.sin(camX * 0.00042 + biomeId.length) * cssW * 0.16) * dpr;
  const cy = (cssH * 0.44 + Math.cos(camY * 0.00037 + biomeId.length * 2) * cssH * 0.14) * dpr;
  const r1 = Math.max(cssW, cssH) * (biomeId === 'anomaly' ? 0.95 : 0.78) * dpr;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r1);
  g.addColorStop(0, rgba(bg.tint.r, bg.tint.g, bg.tint.b, bg.haze));
  g.addColorStop(0.42, rgba(bg.tint.r, bg.tint.g, bg.tint.b, bg.haze * 0.38));
  g.addColorStop(1, rgba(bg.tint.r, bg.tint.g, bg.tint.b, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);

  const cloudCell = 820;
  const minX = camX - cssW;
  const maxX = camX + cssW;
  const minY = camY - cssH;
  const maxY = camY + cssH;
  const c0x = Math.floor(minX / cloudCell);
  const c1x = Math.floor(maxX / cloudCell);
  const c0y = Math.floor(minY / cloudCell);
  const c1y = Math.floor(maxY / cloudCell);
  const count = Math.max(1, Math.round(1 + bg.dust * 3));

  for (let cyi = c0y; cyi <= c1y; cyi += 1) {
    for (let cxi = c0x; cxi <= c1x; cxi += 1) {
      let s = (cxi * 1402946737) ^ (cyi * 6542989) ^ 0x7f31a9 ^ (biomeId.length * 9187);
      for (let i = 0; i < count; i += 1) {
        s = xorshift(s);
        const rx = (s & 0xffff) / 0xffff;
        s = xorshift(s);
        const ry = (s & 0xffff) / 0xffff;
        s = xorshift(s);
        const rr = (s & 0xffff) / 0xffff;
        const sx = (cxi * cloudCell + rx * cloudCell - camX * 0.32) + cssW * 0.5;
        const sy = (cyi * cloudCell + ry * cloudCell - camY * 0.32) + cssH * 0.5;
        const radius = (140 + rr * 310) * dpr;
        const alpha = (0.010 + bg.dust * 0.015) * (0.55 + rr * 0.45);
        const cg = ctx.createRadialGradient(sx * dpr, sy * dpr, 0, sx * dpr, sy * dpr, radius);
        cg.addColorStop(0, rgba(bg.tint.r, bg.tint.g, bg.tint.b, alpha));
        cg.addColorStop(1, rgba(bg.tint.r, bg.tint.g, bg.tint.b, 0));
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(sx * dpr, sy * dpr, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

function drawBiomePattern(ctx, view, camX, camY, bg, biomeId) {
  const { cssW, cssH, dpr } = view;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineWidth = 1 * dpr;

  if (bg.pattern === 'fragments') {
    const cell = 520;
    const c0x = Math.floor((camX - cssW) / cell);
    const c1x = Math.floor((camX + cssW) / cell);
    const c0y = Math.floor((camY - cssH) / cell);
    const c1y = Math.floor((camY + cssH) / cell);
    for (let cy = c0y; cy <= c1y; cy += 1) {
      for (let cx = c0x; cx <= c1x; cx += 1) {
        let s = (cx * 73856093) ^ (cy * 19349663) ^ 0x4d331a;
        const chance = random01FromSeed(s);
        if (chance > 0.34) continue;
        const rx = random01FromSeed(s ^ 0x12ab);
        const ry = random01FromSeed(s ^ 0x87cd);
        const sx = (cx * cell + rx * cell - camX * 0.18 + cssW * 0.5) * dpr;
        const sy = (cy * cell + ry * cell - camY * 0.18 + cssH * 0.5) * dpr;
        const len = (34 + random01FromSeed(s ^ 0x9911) * 80) * dpr;
        ctx.strokeStyle = rgba(bg.line.r, bg.line.g, bg.line.b, 0.045);
        ctx.beginPath();
        ctx.moveTo(sx - len * 0.5, sy);
        ctx.lineTo(sx + len * 0.5, sy + len * 0.15);
        ctx.stroke();
      }
    }
  } else if (bg.pattern === 'dust') {
    const gap = 86;
    const offset = ((camX * 0.08 + camY * 0.04) % gap + gap) % gap;
    ctx.strokeStyle = rgba(bg.line.r, bg.line.g, bg.line.b, 0.030);
    for (let x = -cssH; x < cssW + cssH; x += gap) {
      ctx.beginPath();
      ctx.moveTo((x + offset) * dpr, cssH * dpr);
      ctx.lineTo((x + cssH * 0.68 + offset) * dpr, 0);
      ctx.stroke();
    }
  } else if (bg.pattern === 'wisps') {
    ctx.strokeStyle = rgba(bg.line.r, bg.line.g, bg.line.b, 0.040);
    const gap = 135;
    const offset = ((camX * 0.05) % gap + gap) % gap;
    for (let x = -80; x < cssW + 120; x += gap) {
      ctx.beginPath();
      const y0 = cssH * (0.25 + 0.2 * Math.sin((x + camX * 0.025) * 0.02));
      ctx.moveTo((x + offset) * dpr, y0 * dpr);
      ctx.bezierCurveTo((x + 80 + offset) * dpr, (y0 + 95) * dpr, (x + 170 + offset) * dpr, (y0 - 60) * dpr, (x + 255 + offset) * dpr, (y0 + 28) * dpr);
      ctx.stroke();
    }
  } else if (bg.pattern === 'ice') {
    ctx.strokeStyle = rgba(bg.line.r, bg.line.g, bg.line.b, 0.036);
    const gap = 120;
    const offset = ((camX * 0.07 - camY * 0.04) % gap + gap) % gap;
    for (let y = -40; y < cssH + 70; y += gap) {
      ctx.beginPath();
      ctx.moveTo(0, (y + offset) * dpr);
      ctx.lineTo(cssW * dpr, (y + 35 + offset) * dpr);
      ctx.stroke();
    }
  } else if (bg.pattern === 'radiation') {
    const cx = (cssW * 0.5 + Math.sin(camX * 0.0005) * cssW * 0.18) * dpr;
    const cy = (cssH * 0.5 + Math.cos(camY * 0.0005) * cssH * 0.18) * dpr;
    ctx.strokeStyle = rgba(bg.line.r, bg.line.g, bg.line.b, 0.052);
    for (let r = 120; r < Math.max(cssW, cssH) * 0.9; r += 170) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * dpr, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (bg.pattern === 'anomaly') {
    ctx.strokeStyle = rgba(bg.line.r, bg.line.g, bg.line.b, 0.056);
    const gap = 180;
    const offset = ((camX * 0.04 + camY * 0.03) % gap + gap) % gap;
    for (let x = -100; x < cssW + 140; x += gap) {
      ctx.beginPath();
      ctx.moveTo((x + offset) * dpr, cssH * dpr);
      ctx.quadraticCurveTo((x + cssH * 0.28 + offset) * dpr, (cssH * 0.35) * dpr, (x + cssH * 0.75 + offset) * dpr, 0);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function drawStars(ctx, view, camX, camY, density = 1, biome = null) {
  const { cssW, cssH, dpr } = view;
  const bg = backdropFor(biome);
  const biomeId = biomeIdFor(biome);

  fillBaseSpace(ctx, view, bg);
  drawLocalNebula(ctx, view, camX, camY, bg, biomeId);

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
        const size = 0.7 + rr * 1.5;
        const alpha = 0.15 + rr * 0.38;
        const sc = bg.star || { r: 210, g: 225, b: 240 };
        const tintMix = clamp01(0.10 + bg.haze * 0.9);
        const r = sc.r * (1 - tintMix) + bg.accent.r * tintMix;
        const g = sc.g * (1 - tintMix) + bg.accent.g * tintMix;
        const b = sc.b * (1 - tintMix) + bg.accent.b * tintMix;
        ctx.fillStyle = rgba(r, g, b, alpha);
        ctx.fillRect(sx * dpr, sy * dpr, size * dpr, size * dpr);
      }
    }
  }

  drawBiomePattern(ctx, view, camX, camY, bg, biomeId);
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
