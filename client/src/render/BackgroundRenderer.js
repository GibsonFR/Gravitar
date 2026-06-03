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

function sectorSeedFrom(biome, camX = 0, camY = 0) {
  const sx = Number.isFinite(Number(biome?.sx)) ? (Number(biome.sx) | 0) : Math.round(camX / 4000);
  const sy = Number.isFinite(Number(biome?.sy)) ? (Number(biome.sy) | 0) : Math.round(camY / 4000);
  const biomeId = biomeIdFor(biome);
  let h = 2166136261;
  for (let i = 0; i < biomeId.length; i += 1) {
    h ^= biomeId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= Math.imul(sx | 0, 73856093);
  h ^= Math.imul(sy | 0, 19349663);
  return h | 0;
}

function seeded01(seed, salt = 0) {
  return random01FromSeed((seed ^ Math.imul((salt + 1) | 0, 0x45d9f3b)) | 0);
}

function drawDistantAstre(ctx, view, camX, camY, bg, biomeId, seed) {
  const { cssW, cssH, dpr } = view;
  const show = seeded01(seed, 12);
  if (biomeId === 'hub' && show > 0.34) return;
  if (show > 0.72) return;

  const x = cssW * (0.18 + seeded01(seed, 21) * 0.64);
  const y = cssH * (0.12 + seeded01(seed, 22) * 0.42);
  const driftX = Math.sin(seed * 0.00013 + camX * 0.000025) * cssW * 0.018;
  const driftY = Math.cos(seed * 0.00017 + camY * 0.000022) * cssH * 0.014;
  const r = (42 + seeded01(seed, 23) * 96) * dpr;
  const halo = r * (2.8 + seeded01(seed, 24) * 2.6);
  const px = (x + driftX) * dpr;
  const py = (y + driftY) * dpr;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const haloGrad = ctx.createRadialGradient(px, py, 0, px, py, halo);
  haloGrad.addColorStop(0, rgba(bg.accent.r, bg.accent.g, bg.accent.b, 0.070));
  haloGrad.addColorStop(0.45, rgba(bg.tint.r, bg.tint.g, bg.tint.b, 0.026));
  haloGrad.addColorStop(1, rgba(bg.tint.r, bg.tint.g, bg.tint.b, 0));
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(px, py, halo, 0, Math.PI * 2);
  ctx.fill();

  const bodyGrad = ctx.createRadialGradient(px - r * 0.35, py - r * 0.42, 0, px, py, r);
  const shade = biomeId === 'nuclear' ? 35 : 18;
  bodyGrad.addColorStop(0, rgba(Math.min(255, bg.accent.r + 35), Math.min(255, bg.accent.g + 35), Math.min(255, bg.accent.b + 35), 0.20));
  bodyGrad.addColorStop(0.62, rgba(Math.max(0, bg.tint.r - shade), Math.max(0, bg.tint.g - shade), Math.max(0, bg.tint.b - shade), 0.10));
  bodyGrad.addColorStop(1, rgba(0, 0, 0, 0.04));
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();

  if (biomeId === 'anomaly') {
    ctx.strokeStyle = rgba(bg.accent.r, bg.accent.g, bg.accent.b, 0.12);
    ctx.lineWidth = 1.2 * dpr;
    ctx.setLineDash([10 * dpr, 8 * dpr]);
    ctx.beginPath();
    ctx.ellipse(px, py, r * 1.85, r * 0.58, -0.35, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawDeepStarClusters(ctx, view, camX, camY, bg, biomeId, seed, density = 1) {
  const { cssW, cssH, dpr } = view;
  const cell = 720;
  const minX = camX * 0.22 - cssW;
  const maxX = camX * 0.22 + cssW;
  const minY = camY * 0.22 - cssH;
  const maxY = camY * 0.22 + cssH;
  const c0x = Math.floor(minX / cell);
  const c1x = Math.floor(maxX / cell);
  const c0y = Math.floor(minY / cell);
  const c1y = Math.floor(maxY / cell);
  const sc = bg.star || { r: 210, g: 225, b: 240 };

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let cy = c0y; cy <= c1y; cy += 1) {
    for (let cx = c0x; cx <= c1x; cx += 1) {
      let s = (Math.imul(cx, 134775813) ^ Math.imul(cy, 1103515245) ^ seed ^ 0x5f3759df) | 0;
      if (random01FromSeed(s) > 0.44 + density * 0.08) continue;
      const centerX = (cx * cell + seeded01(s, 1) * cell - camX * 0.22 + cssW * 0.5) * dpr;
      const centerY = (cy * cell + seeded01(s, 2) * cell - camY * 0.22 + cssH * 0.5) * dpr;
      const stars = 7 + Math.round(seeded01(s, 3) * 12);
      const spread = (28 + seeded01(s, 4) * 70) * dpr;
      for (let i = 0; i < stars; i += 1) {
        s = xorshift(s);
        const angle = seeded01(s, i + 10) * Math.PI * 2;
        const dist = Math.pow(seeded01(s, i + 30), 1.8) * spread;
        const px = centerX + Math.cos(angle) * dist;
        const py = centerY + Math.sin(angle) * dist;
        const size = (0.55 + seeded01(s, i + 50) * 1.45) * dpr;
        const alpha = 0.10 + seeded01(s, i + 70) * 0.22;
        ctx.fillStyle = rgba(sc.r, sc.g, sc.b, alpha);
        ctx.fillRect(px, py, size, size);
      }
    }
  }

  ctx.restore();
}

function drawShootingStars(ctx, view, camX, camY, bg, biomeId, seed, t = 0) {
  const { cssW, cssH, dpr } = view;
  if (biomeId === 'hub') return;
  const period = 9.5 + seeded01(seed, 91) * 6.0;
  const phase = ((t / period) + seeded01(seed, 92)) % 1;
  if (phase > 0.16) return;

  const alpha = Math.sin((phase / 0.16) * Math.PI) * 0.34;
  const startX = (seeded01(seed, 93) * cssW + phase * cssW * 0.45) % (cssW + 180) - 90;
  const startY = cssH * (0.10 + seeded01(seed, 94) * 0.48);
  const len = 80 + seeded01(seed, 95) * 140;
  const angle = -0.35 + seeded01(seed, 96) * 0.55;
  const x2 = startX - Math.cos(angle) * len;
  const y2 = startY - Math.sin(angle) * len;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createLinearGradient(startX * dpr, startY * dpr, x2 * dpr, y2 * dpr);
  g.addColorStop(0, rgba(bg.accent.r, bg.accent.g, bg.accent.b, alpha));
  g.addColorStop(1, rgba(bg.accent.r, bg.accent.g, bg.accent.b, 0));
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.4 * dpr;
  ctx.beginPath();
  ctx.moveTo(startX * dpr, startY * dpr);
  ctx.lineTo(x2 * dpr, y2 * dpr);
  ctx.stroke();
  ctx.restore();
}

export function drawStars(ctx, view, camX, camY, density = 1, biome = null, t = 0) {
  const { cssW, cssH, dpr } = view;
  const bg = backdropFor(biome);
  const biomeId = biomeIdFor(biome);
  const sectorSeed = sectorSeedFrom(biome, camX, camY);

  fillBaseSpace(ctx, view, bg);
  drawDistantAstre(ctx, view, camX, camY, bg, biomeId, sectorSeed);
  drawLocalNebula(ctx, view, camX, camY, bg, biomeId);
  drawDeepStarClusters(ctx, view, camX, camY, bg, biomeId, sectorSeed, density);

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
      let s = (cx * 73856093) ^ (cy * 19349663) ^ seed ^ sectorSeed;
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
  drawShootingStars(ctx, view, camX, camY, bg, biomeId, sectorSeed, t);
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
