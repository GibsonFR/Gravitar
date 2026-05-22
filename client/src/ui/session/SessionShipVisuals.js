import { clamp, polar, rgba } from '../../core/Math.js';
import { getShipFramePalette } from '../../entities/ship/ShipFramePalette.js';

function profile(frameId) {
  if (frameId === 'sigil') {
    return { ring: 2.05, core: 0.46, spread: 0.68, thrust: 1.34, centerThruster: false };
  }
  if (frameId === 'bulwark') {
    return { ring: 2.42, core: 0.62, spread: 0.50, thrust: 1.04, centerThruster: true };
  }
  return { ring: 2.0, core: 0.46, spread: 0.58, thrust: 1.60, centerThruster: false };
}

export function getSessionShipPoints(frameId, cx, cy, radius, angle) {
  if (frameId === 'sigil') {
    return [
      polar(cx, cy, radius + 7, angle),
      polar(cx, cy, radius + 1, angle + 0.48),
      polar(cx, cy, radius - 1, angle + 1.64),
      polar(cx, cy, radius + 2, angle + Math.PI),
      polar(cx, cy, radius - 1, angle - 1.64),
      polar(cx, cy, radius + 1, angle - 0.48)
    ];
  }
  if (frameId === 'bulwark') {
    return [
      polar(cx, cy, radius + 9, angle),
      polar(cx, cy, radius + 4, angle + 0.34),
      polar(cx, cy, radius + 3, angle + 0.94),
      polar(cx, cy, radius - 1, angle + 1.82),
      polar(cx, cy, radius - 7, angle + 2.48),
      polar(cx, cy, radius - 10, angle + Math.PI),
      polar(cx, cy, radius - 7, angle - 2.48),
      polar(cx, cy, radius - 1, angle - 1.82),
      polar(cx, cy, radius + 3, angle - 0.94),
      polar(cx, cy, radius + 4, angle - 0.34)
    ];
  }
  return [
    polar(cx, cy, radius + 7, angle),
    polar(cx, cy, radius + 2, angle + 0.55),
    polar(cx, cy, radius - 2, angle + 2.28),
    polar(cx, cy, radius - 7, angle + Math.PI),
    polar(cx, cy, radius - 2, angle - 2.28),
    polar(cx, cy, radius + 2, angle - 0.55)
  ];
}

export function getSessionShipMotionProfile(frameId) {
  return profile(frameId);
}

export function drawSessionShipGlyph(ctx, dpr, x, y, radius, frameId, angle, time = 0, options = {}) {
  const palette = getShipFramePalette(frameId);
  const p = profile(frameId);
  const emphasize = options.emphasize !== false;
  const thrustPower = clamp(options.thrust ?? 0.65, 0, 1);
  const ringRadius = radius * p.ring;

  ctx.save();
  ctx.lineCap = 'round';

  const aura = ctx.createRadialGradient(x * dpr, y * dpr, 0, x * dpr, y * dpr, ringRadius * 1.55 * dpr);
  aura.addColorStop(0, rgba(palette.outline.r, palette.outline.g, palette.outline.b, emphasize ? 0.18 : 0.10));
  aura.addColorStop(1, rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(x * dpr, y * dpr, ringRadius * 1.55 * dpr, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = rgba(palette.outline.r, palette.outline.g, palette.outline.b, emphasize ? 0.48 : 0.28);
  ctx.lineWidth = (emphasize ? 2 : 1.25) * dpr;
  ctx.beginPath();
  ctx.arc(x * dpr, y * dpr, ringRadius * dpr, 0, Math.PI * 2);
  ctx.stroke();

  if (frameId === 'sigil') {
    ctx.strokeStyle = rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.34);
    ctx.lineWidth = 1.2 * dpr;
    for (let i = 0; i < 4; i += 1) {
      const a = time * 0.8 + i * Math.PI * 0.5;
      ctx.beginPath();
      ctx.ellipse(x * dpr, y * dpr, ringRadius * 1.05 * dpr, ringRadius * 0.44 * dpr, a, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (frameId === 'bulwark') {
    ctx.strokeStyle = rgba(255, 218, 130, 0.30);
    ctx.lineWidth = 2.8 * dpr;
    const segments = 5;
    for (let i = 0; i < segments; i += 1) {
      const a0 = -Math.PI / 2 + i * Math.PI * 2 / segments + time * 0.06;
      const a1 = a0 + Math.PI * 2 / segments * 0.62;
      ctx.beginPath();
      ctx.arc(x * dpr, y * dpr, (ringRadius + 6) * dpr, a0, a1);
      ctx.stroke();
    }
  }

  const pulse = 0.82 + 0.22 * Math.sin(time * 7);
  const thrusterIndices = p.centerThruster ? [-1, 0, 1] : [-1, 1];
  for (const i of thrusterIndices) {
    const a = angle + Math.PI + i * p.spread;
    const len = radius * p.thrust * (0.8 + thrustPower * 0.65) * pulse;
    const p0 = polar(x, y, radius * 0.62, a);
    const p1 = polar(x, y, len, a);
    ctx.strokeStyle = rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.36 + thrustPower * 0.32);
    ctx.lineWidth = 2.1 * dpr;
    ctx.beginPath();
    ctx.moveTo(p0.x * dpr, p0.y * dpr);
    ctx.lineTo(p1.x * dpr, p1.y * dpr);
    ctx.stroke();
  }

  const pts = getSessionShipPoints(frameId, x, y, radius, angle);
  ctx.fillStyle = rgba(palette.hull.r, palette.hull.g, palette.hull.b, 0.96);
  ctx.beginPath();
  ctx.moveTo(pts[0].x * dpr, pts[0].y * dpr);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x * dpr, pts[i].y * dpr);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.98);
  ctx.lineWidth = (emphasize ? 2.4 : 1.8) * dpr;
  ctx.stroke();

  const core = radius * p.core;
  ctx.fillStyle = rgba(palette.core.r, palette.core.g, palette.core.b, 0.92);
  ctx.beginPath();
  ctx.arc(x * dpr, y * dpr, core * 0.5 * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGrid(ctx, dpr, w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(125, 170, 220, 0.10)';
  ctx.lineWidth = dpr;
  const step = 96;
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath(); ctx.moveTo(x * dpr, 0); ctx.lineTo(x * dpr, h * dpr); ctx.stroke();
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y * dpr); ctx.lineTo(w * dpr, y * dpr); ctx.stroke();
  }
  ctx.restore();
}

function drawDummy(ctx, dpr, x, y, time) {
  ctx.save();
  ctx.strokeStyle = 'rgba(220, 232, 255, 0.62)';
  ctx.fillStyle = 'rgba(140, 150, 165, 0.42)';
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  ctx.arc(x * dpr, y * dpr, 28 * dpr, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 220, 120, 0.55)';
  ctx.lineWidth = 2.5 * dpr;
  ctx.beginPath();
  ctx.arc(x * dpr, y * dpr, (34 + Math.sin(time * 6) * 1.5) * dpr, -0.4, 1.8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(245, 249, 255, 0.88)';
  ctx.font = `${10 * dpr}px Segoe UI`;
  ctx.textAlign = 'center';
  ctx.fillText('DUMMY', x * dpr, (y + 48) * dpr);
  ctx.restore();
}

function arrow(ctx, dpr, x0, y0, x1, y1, color) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3 * dpr;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0 * dpr, y0 * dpr);
  ctx.lineTo(x1 * dpr, y1 * dpr);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1 * dpr, y1 * dpr);
  ctx.lineTo((x1 - Math.cos(a - 0.45) * 13) * dpr, (y1 - Math.sin(a - 0.45) * 13) * dpr);
  ctx.lineTo((x1 - Math.cos(a + 0.45) * 13) * dpr, (y1 - Math.sin(a + 0.45) * 13) * dpr);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawSessionAbilityPreview(ctx, canvas, card, abilityIndex, phase, time) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.fillStyle = 'rgba(7, 12, 20, 0.96)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid(ctx, dpr, w, h);

  const palette = getShipFramePalette(card.id);
  const loop = (time % 4.5) / 4.5;
  const startX = w * 0.34;
  const y = h * 0.55;
  const targetX = w * 0.68;
  const targetY = y - 10;
  const slot = card.abilities?.[abilityIndex]?.key || 'A';
  const isPassive = slot === 'P';
  const isUlt = slot === 'R';
  const angle = Math.atan2(targetY - y, targetX - startX);
  let shipX = startX;
  let shipY = y;

  if ((card.id === 'vanguard' && slot === 'Z') || (card.id === 'sigil' && slot === 'E')) {
    const dash = Math.sin(Math.min(1, loop * 2.4) * Math.PI * 0.5);
    shipX = startX + dash * 120;
    shipY = y - dash * 8;
    arrow(ctx, dpr, startX - 16, y, startX + 135, y - 10, rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.62));
  }

  drawDummy(ctx, dpr, targetX, targetY, time);
  drawSessionShipGlyph(ctx, dpr, shipX, shipY, 24, card.id, angle, time, { thrust: 0.76, emphasize: true });

  ctx.strokeStyle = rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.78);
  ctx.fillStyle = rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.12);
  ctx.lineWidth = 2 * dpr;

  if (isPassive) {
    for (let i = 0; i < 5; i += 1) {
      const a = time * 1.2 + i * Math.PI * 2 / 5;
      ctx.beginPath();
      ctx.arc((shipX + Math.cos(a) * 48) * dpr, (shipY + Math.sin(a) * 48) * dpr, 5 * dpr, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
  } else if (isUlt) {
    const r = 72 + Math.sin(time * 5) * 4;
    ctx.beginPath();
    ctx.arc(shipX * dpr, shipY * dpr, r * dpr, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    for (let i = 0; i < 10; i += 1) {
      const a = i * Math.PI * 2 / 10 + time * 1.5;
      ctx.beginPath();
      ctx.moveTo(shipX * dpr, shipY * dpr);
      ctx.lineTo((shipX + Math.cos(a) * (r + 24)) * dpr, (shipY + Math.sin(a) * (r + 24)) * dpr);
      ctx.stroke();
    }
  } else if (slot === 'A') {
    const progress = Math.min(1, loop * 2.1);
    const px = shipX + (targetX - shipX) * progress;
    const py = shipY + (targetY - shipY) * progress;
    ctx.beginPath();
    ctx.moveTo(shipX * dpr, shipY * dpr);
    ctx.lineTo(targetX * dpr, targetY * dpr);
    ctx.stroke();
    ctx.fillStyle = rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.82);
    ctx.beginPath();
    ctx.arc(px * dpr, py * dpr, (5 + phase * 0.8) * dpr, 0, Math.PI * 2);
    ctx.fill();
  } else if (slot === 'Z') {
    const cx = card.id === 'sigil' ? targetX - 12 : targetX - 55;
    const cy = targetY + 8;
    ctx.beginPath();
    ctx.arc(cx * dpr, cy * dpr, (42 + phase * 8 + Math.sin(time * 4) * 3) * dpr, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  } else if (slot === 'E') {
    ctx.beginPath();
    ctx.ellipse(shipX * dpr, shipY * dpr, (64 + phase * 7) * dpr, 28 * dpr, angle, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }

  ctx.fillStyle = 'rgba(238,245,255,0.88)';
  ctx.font = `${12 * dpr}px Segoe UI`;
  ctx.textAlign = 'left';
  const label = card.abilities?.[abilityIndex]?.name || card.abilities?.[abilityIndex]?.label || 'Aptitude';
  ctx.fillText(`${slot} · ${label}`, 18 * dpr, 26 * dpr);
  ctx.fillStyle = 'rgba(178, 198, 224, 0.76)';
  ctx.font = `${11 * dpr}px Segoe UI`;
  ctx.fillText(`Phase ${phase}`, 18 * dpr, 44 * dpr);
  ctx.restore();
}
