import { clamp, rgba } from '../core/Math.js';

export const RADAR_SIZE = 168;
export const RADAR_MARGIN = 18;
export const RADAR_RANGE = 2200;

export function getRadarLayout(view) {
  const size = RADAR_SIZE;
  return { size, x: view.cssW - size - RADAR_MARGIN, y: view.cssH - size - RADAR_MARGIN, range: RADAR_RANGE };
}

export function hitTestRadarMove(view, me, px, py) {
  if (!view || !me) return null;
  const { x, y, size, range } = getRadarLayout(view);
  if (px < x || py < y || px > x + size || py > y + size) return null;
  const nx = clamp((px - (x + size * 0.5)) / (size * 0.46), -1, 1);
  const ny = clamp((py - (y + size * 0.5)) / (size * 0.46), -1, 1);
  return { x: me.x + nx * range, y: me.y + ny * range };
}

export function drawRadar(ctx, view, me, players, mobs, asteroids, stations, myState) {
  const { size, x, y, range } = getRadarLayout(view);

  ctx.fillStyle = rgba(8, 10, 14, 0.84);
  ctx.fillRect(x * view.dpr, y * view.dpr, size * view.dpr, size * view.dpr);
  ctx.strokeStyle = rgba(95, 125, 155, 0.65);
  ctx.lineWidth = view.dpr;
  ctx.strokeRect(x * view.dpr, y * view.dpr, size * view.dpr, size * view.dpr);

  ctx.strokeStyle = rgba(80, 100, 120, 0.35);
  ctx.beginPath();
  ctx.moveTo((x + size * 0.5) * view.dpr, y * view.dpr);
  ctx.lineTo((x + size * 0.5) * view.dpr, (y + size) * view.dpr);
  ctx.moveTo(x * view.dpr, (y + size * 0.5) * view.dpr);
  ctx.lineTo((x + size) * view.dpr, (y + size * 0.5) * view.dpr);
  ctx.stroke();

  function blip(wx, wy, color, radius = 2) {
    const dx = clamp((wx - me.x) / range, -1, 1);
    const dy = clamp((wy - me.y) / range, -1, 1);
    const sx = x + size * 0.5 + dx * size * 0.46;
    const sy = y + size * 0.5 + dy * size * 0.46;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx * view.dpr, sy * view.dpr, radius * view.dpr, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const s of stations.values()) blip(s.x, s.y, rgba(180, 120, 255, 0.9), 3);
  for (const a of asteroids.values()) blip(a.x, a.y, rgba(a.color.r, a.color.g, a.color.b, 0.7), 1.6);
  for (const mob of mobs.values()) blip(mob.x, mob.y, mob.elite ? rgba(255, 232, 160, 0.96) : rgba(mob.color.r, mob.color.g, mob.color.b, 0.9), mob.elite ? 2.8 : 2.1);
  for (const p of players.values()) {
    if (p.id === me.id) continue;
    blip(p.x, p.y, rgba(255, 120, 120, 0.92), 2.2);
  }
  blip(me.x, me.y, rgba(120, 255, 195, 1), 2.8);

  const sectorTxt = `Secteur [${(myState?.sx ?? 0) | 0},${(myState?.sy ?? 0) | 0}]`;
  const biomeName = myState?.sectorBiome?.shortName || myState?.sectorBiome?.name || '';
  const biomeColor = myState?.sectorBiome?.colorHex || '#d0d7e4';
  ctx.fillStyle = rgba(235, 242, 255, 0.82);
  ctx.font = `${12 * view.dpr}px Segoe UI`;
  ctx.textAlign = 'left';
  ctx.fillText(sectorTxt, (x + 8) * view.dpr, (y - 19) * view.dpr);
  if (biomeName) {
    ctx.fillStyle = biomeColor;
    ctx.fillText(`Biome : ${biomeName}`, (x + 8) * view.dpr, (y - 6) * view.dpr);
  }

  ctx.fillStyle = rgba(235, 242, 255, 0.9);
  ctx.font = `${12 * view.dpr}px Segoe UI`;
  ctx.textAlign = 'left';
  ctx.fillText('Radar', (x + 8) * view.dpr, (y + 14) * view.dpr);

}

