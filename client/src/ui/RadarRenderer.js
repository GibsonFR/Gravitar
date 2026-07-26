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

export function drawRadar(ctx, view, me, players, mobs, asteroids, stations, structures, portals, myState) {
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
  const detectedDeposits = new Set((myState?.map?.deposits || [])
    .filter((deposit) => (deposit.sx | 0) === (me.sx | 0) && (deposit.sy | 0) === (me.sy | 0))
    .map((deposit) => deposit.id | 0));
  for (const structure of structures?.values?.() || []) {
    if (structure.type === 'resource_deposit') {
      if (detectedDeposits.has(structure.id | 0)) blip(structure.x, structure.y, structure.depositColorHex || rgba(112, 230, 190, .95), 2.5);
      continue;
    }
    if ((structure.type === 'base_core' || structure.type === 'outpost_core') && (structure.owned || myState?.map?.radarActive)) {
      blip(structure.x, structure.y, structure.owned ? rgba(95, 220, 255, .98) : rgba(255, 175, 95, .95), 3.2);
    }
  }
  if (myState?.map?.radarActive) {
    for (const portal of portals?.values?.() || []) blip(portal.x, portal.y, rgba(188, 128, 255, .95), 2.8);
  }
  blip(me.x, me.y, rgba(120, 255, 195, 1), 2.8);

  const sectorTxt = `Secteur [${(myState?.sx ?? 0) | 0},${(myState?.sy ?? 0) | 0}]`;
  const biomeName = myState?.sectorBiome?.shortName || myState?.sectorBiome?.name || 'Biome inconnu';
  const biomeColor = myState?.sectorBiome?.colorHex || '#d0d7e4';

  ctx.save();
  const headerH = 38;
  ctx.fillStyle = rgba(5, 10, 16, 0.78);
  ctx.fillRect(x * view.dpr, y * view.dpr, size * view.dpr, headerH * view.dpr);
  ctx.strokeStyle = biomeColor;
  ctx.globalAlpha = 0.62;
  ctx.beginPath();
  ctx.moveTo((x + 1) * view.dpr, (y + headerH) * view.dpr);
  ctx.lineTo((x + size - 1) * view.dpr, (y + headerH) * view.dpr);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = rgba(235, 242, 255, 0.92);
  ctx.font = `${11 * view.dpr}px Segoe UI`;
  ctx.textAlign = 'left';
  ctx.fillText(sectorTxt, (x + 8) * view.dpr, (y + 14) * view.dpr);

  ctx.fillStyle = biomeColor;
  ctx.font = `700 ${11 * view.dpr}px Segoe UI`;
  ctx.fillText(`Biome : ${biomeName}`, (x + 8) * view.dpr, (y + 30) * view.dpr);
  ctx.restore();

}

