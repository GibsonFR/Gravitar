const BASE_CELL = 20;
const MIN_CELL = 6;
const MAX_CELL = 74;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function hexToRgb(hex) {
  const raw = String(hex || '').trim();
  const m = raw.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbaFromHex(hex, alpha) {
  const c = hexToRgb(hex);
  if (!c) return null;
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}

function biomeCellFill(visited, isKnown) {
  if (!isKnown || !visited?.biomeColorHex) return null;
  const id = String(visited.biomeId || '').toLowerCase();
  const alpha = id === 'hub' ? 0.30 : 0.26;
  return rgbaFromHex(visited.biomeColorHex, alpha);
}



function drawLogisticLink(ctx, layout, link) {
  const a = getSectorRect(layout, link.fromSx | 0, link.fromSy | 0);
  const b = getSectorRect(layout, link.toSx | 0, link.toSy | 0);
  const ax = a.x + a.w * 0.5;
  const ay = a.y + a.h * 0.5;
  const bx = b.x + b.w * 0.5;
  const by = b.y + b.h * 0.5;
  ctx.save();
  ctx.strokeStyle = link.active ? 'rgba(126, 220, 255, 0.48)' : 'rgba(255, 175, 110, 0.28)';
  ctx.lineWidth = clamp(layout.cell * 0.08, 1.2, 4);
  ctx.setLineDash([Math.max(3, layout.cell * 0.22), Math.max(3, layout.cell * 0.14)]);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.restore();
}

function drawLogisticSectorOverlay(ctx, layout, x, y, rectW, rectH, info) {
  if (!info) return;
  const hasStation = (info.stationCount | 0) > 0;
  const hasDemand = (info.unmetRequests | 0) > 0;
  const activeFlights = info.activeFlights | 0;
  const providerCount = (info.providerCount | 0) + (info.bufferCount | 0);
  if (!hasStation && !hasDemand && !activeFlights && !providerCount) return;
  ctx.save();
  if (hasStation) {
    ctx.strokeStyle = info.poweredStations > 0 ? 'rgba(126, 220, 255, .72)' : 'rgba(255, 176, 110, .58)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 6, y + 6, Math.max(1, rectW - 12), Math.max(1, rectH - 12));
  }
  const badges = [];
  if (hasStation) badges.push({ text: 'D', color: 'rgba(126,220,255,.96)' });
  if (providerCount) badges.push({ text: '↑', color: 'rgba(165,240,188,.96)' });
  if ((info.requesterCount | 0) > 0) badges.push({ text: hasDemand ? '!' : '↓', color: hasDemand ? 'rgba(255,188,112,.98)' : 'rgba(190,210,255,.92)' });
  if (activeFlights) badges.push({ text: String(Math.min(9, activeFlights)), color: 'rgba(255,230,150,.98)' });
  if (layout.cell >= 18 && badges.length) {
    const size = clamp(layout.cell * 0.22, 8, 14);
    ctx.font = `800 ${size}px Segoe UI, Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let bx = x + 3;
    const by = y + 3;
    for (const badge of badges.slice(0, 4)) {
      ctx.fillStyle = 'rgba(4,8,13,.78)';
      ctx.fillRect(bx - 1, by - 1, size + 4, size + 3);
      ctx.fillStyle = badge.color;
      ctx.fillText(badge.text, bx + 1, by);
      bx += size + 6;
    }
  }
  ctx.restore();
}

function drawLogisticFlightRoute(ctx, layout, flight) {
  if (!flight) return;
  const a = getSectorRect(layout, flight.homeSx ?? flight.fromSx, flight.homeSy ?? flight.fromSy);
  const b = getSectorRect(layout, flight.toSx | 0, flight.toSy | 0);
  const c = getSectorRect(layout, flight.sx | 0, flight.sy | 0);
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 224, 120, .42)';
  ctx.lineWidth = clamp(layout.cell * 0.06, 1, 3);
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(a.x + a.w * 0.5, a.y + a.h * 0.5);
  ctx.lineTo(b.x + b.w * 0.5, b.y + b.h * 0.5);
  ctx.stroke();
  const rad = clamp(layout.cell * 0.15, 3, 8);
  ctx.fillStyle = 'rgba(255, 230, 150, .98)';
  ctx.strokeStyle = 'rgba(4,8,13,.92)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c.x + c.w * 0.5, c.y + c.h * 0.5, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function computeMapLayout(w, h, opts) {
  const {
    currentSx,
    currentSy,
    zoom,
    panX,
    panY,
  } = opts;

  const cell = clamp(BASE_CELL * zoom, MIN_CELL, MAX_CELL);
  const currentCellX = w * 0.5 - cell * 0.5 + panX;
  const currentCellY = h * 0.5 - cell * 0.5 + panY;

  return {
    cell,
    currentCellX,
    currentCellY,
    currentSx: currentSx | 0,
    currentSy: currentSy | 0,
  };
}

function getSectorRect(layout, sx, sy) {
  const dx = (sx | 0) - layout.currentSx;
  const dy = layout.currentSy - (sy | 0);
  return {
    x: layout.currentCellX + dx * layout.cell,
    y: layout.currentCellY + dy * layout.cell,
    w: layout.cell - 1,
    h: layout.cell - 1,
  };
}

function drawGlyph(ctx, glyph, x, y, cell, color) {
  if (!glyph || cell < 12) return;
  const fontSize = clamp(Math.floor(cell * 0.58), 9, 26);
  ctx.font = `700 ${fontSize}px Segoe UI, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(glyph, x + cell * 0.5, y + cell * 0.51);
}

export function drawSectorMap(ctx, w, h, opts) {
  const {
    layout,
    hover,
    getVisited,
    getBastion,
    visitedList,
    bastionList,
    playerList,
    logisticSectors,
    logisticLinks,
    logisticFlights,
  } = opts;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(4,8,13,0.98)';
  ctx.fillRect(0, 0, w, h);

  const g = ctx.createRadialGradient(w * 0.5, h * 0.28, 30, w * 0.5, h * 0.55, Math.max(w, h) * 0.78);
  g.addColorStop(0, 'rgba(80,165,230,0.16)');
  g.addColorStop(0.42, 'rgba(32,68,105,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const unique = new Map();
  for (const item of visitedList || []) {
    if (!item) continue;
    unique.set(`${item.sx | 0},${item.sy | 0}`, item);
  }

  const currentKey = `${layout.currentSx},${layout.currentSy}`;
  if (!unique.has(currentKey)) {
    unique.set(currentKey, getVisited ? getVisited(layout.currentSx, layout.currentSy) || {
      sx: layout.currentSx,
      sy: layout.currentSy,
      stationCount: 0,
      hasReturnPortal: false,
    } : {
      sx: layout.currentSx,
      sy: layout.currentSy,
      stationCount: 0,
      hasReturnPortal: false,
    });
  }

  for (const link of (logisticLinks || [])) drawLogisticLink(ctx, layout, link);

  const minDx = Math.floor((0 - layout.currentCellX) / layout.cell) - 1;
  const maxDx = Math.ceil((w - layout.currentCellX) / layout.cell) + 1;
  const minDy = Math.floor((0 - layout.currentCellY) / layout.cell) - 1;
  const maxDy = Math.ceil((h - layout.currentCellY) / layout.cell) + 1;

  for (let dy = minDy; dy <= maxDy; dy += 1) {
    for (let dx = minDx; dx <= maxDx; dx += 1) {
      const sx = layout.currentSx + dx;
      const sy = layout.currentSy - dy;
      const x = layout.currentCellX + dx * layout.cell;
      const y = layout.currentCellY + dy * layout.cell;
      const rectW = layout.cell - 1;
      const rectH = layout.cell - 1;
      const visited = getVisited ? getVisited(sx, sy) : null;
      const logisticInfo = logisticSectors?.get?.(`${sx},${sy}`) || null;
      const bastion = visited?.bastion || (getBastion ? getBastion(sx, sy) : null);
      const isKnown = !!visited || !!bastion || !!logisticInfo || (sx === layout.currentSx && sy === layout.currentSy);
      const isHub = sx === 0 && sy === 0;
      const isCurrent = sx === layout.currentSx && sy === layout.currentSy;

      let fill = isKnown ? 'rgba(18,28,42,0.88)' : 'rgba(8,13,20,0.66)';
      const biomeFill = biomeCellFill(visited, isKnown);
      if (biomeFill) fill = biomeFill;
      if (logisticInfo && !visited && !bastion) fill = 'rgba(12, 34, 46, 0.82)';
      if (visited?.stationCount > 0) fill = 'rgba(42,76,116,0.90)';
      if (visited?.pirateStationCount > 0) fill = 'rgba(92,54,28,0.94)';
      if (visited?.hasReturnPortal) fill = 'rgba(28,88,108,0.92)';
      if (bastion) fill = bastion.captured ? 'rgba(42,82,58,0.94)' : (bastion.unlocked ? 'rgba(82,62,34,0.96)' : 'rgba(54,43,52,0.94)');
      if (isHub) fill = 'rgba(86,72,28,0.94)';

      ctx.fillStyle = fill;
      ctx.fillRect(x, y, rectW, rectH);

      if (biomeFill && !bastion && !isHub && layout.cell >= 13) {
        const bc = hexToRgb(visited.biomeColorHex);
        if (bc) {
          ctx.fillStyle = `rgba(${bc.r},${bc.g},${bc.b},0.08)`;
          ctx.fillRect(x + 2, y + 2, Math.max(1, rectW - 4), Math.max(1, rectH - 4));
          if (layout.cell >= 26) {
            ctx.fillStyle = `rgba(${bc.r},${bc.g},${bc.b},0.78)`;
            ctx.fillRect(x + 4, y + rectH - 5, Math.max(3, rectW - 8), 2);
          }
        }
      }

      ctx.strokeStyle = isKnown ? (visited?.biomeColorHex ? (rgbaFromHex(visited.biomeColorHex, 0.34) || 'rgba(110,180,255,0.24)') : 'rgba(110,180,255,0.24)') : 'rgba(72,100,132,0.10)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, rectW - 1), Math.max(1, rectH - 1));

      let glyph = '';
      let glyphColor = 'rgba(235,242,255,0.96)';
      if (isHub) {
        glyph = 'H';
        glyphColor = 'rgba(255,216,102,0.96)';
      } else if (bastion) {
        glyph = '◈';
        const bc = bastion.color || { r: 250, g: 214, b: 120 };
        glyphColor = `rgba(${bc.r | 0},${bc.g | 0},${bc.b | 0},0.98)`;
      } else if (visited?.hasReturnPortal) {
        glyph = 'P';
        glyphColor = 'rgba(154,241,255,0.96)';
      } else if ((visited?.pirateStationCount | 0) > 0) {
        glyph = '☠';
        glyphColor = 'rgba(255,190,105,0.98)';
      } else if ((visited?.stationCount | 0) > 0) {
        glyph = 'S';
        glyphColor = 'rgba(232,240,255,0.96)';
      }

      drawGlyph(ctx, glyph, x, y, layout.cell, glyphColor);
      drawLogisticSectorOverlay(ctx, layout, x, y, rectW, rectH, logisticInfo);

      if (bastion) {
        const bc = bastion.color || { r: 250, g: 214, b: 120 };
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 520 + (bastion.id || 0));
        ctx.strokeStyle = `rgba(${bc.r | 0},${bc.g | 0},${bc.b | 0},${bastion.unlocked ? 0.62 + pulse * 0.22 : 0.34})`;
        ctx.lineWidth = bastion.captured ? 2 : 3;
        ctx.strokeRect(x + 4, y + 4, Math.max(1, rectW - 8), Math.max(1, rectH - 8));
        ctx.font = `700 ${clamp(Math.floor(layout.cell * 0.20), 7, 12)}px Segoe UI, Arial, sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = `rgba(${bc.r | 0},${bc.g | 0},${bc.b | 0},0.96)`;
        ctx.fillText(`T${bastion.tier || 1}`, x + rectW - 5, y + rectH - 4);
        if (!bastion.captured && bastion.unlockText && !bastion.unlocked && layout.cell >= 28) {
          const txt = String(bastion.unlockText).replace('Ouvre dans ', '');
          ctx.font = `700 ${clamp(Math.floor(layout.cell * 0.15), 7, 11)}px Segoe UI, Arial, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = 'rgba(255,218,130,0.95)';
          ctx.fillText(txt, x + rectW * 0.5, y + 4);
        }
      }

      if (isCurrent) {
        ctx.fillStyle = 'rgba(125,233,255,0.10)';
        ctx.fillRect(x + 3, y + 3, Math.max(1, rectW - 6), Math.max(1, rectH - 6));
        ctx.strokeStyle = 'rgba(125,233,255,0.94)';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 3, y + 3, Math.max(1, rectW - 6), Math.max(1, rectH - 6));
      }

      if (hover && hover.sx === sx && hover.sy === sy) {
        ctx.strokeStyle = 'rgba(241,197,90,0.92)';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 5, y + 5, Math.max(1, rectW - 10), Math.max(1, rectH - 10));
      }
    }
  }


  for (const flight of (logisticFlights || [])) drawLogisticFlightRoute(ctx, layout, flight);

  for (const player of (playerList || [])) {
    const sx = player.sx | 0;
    const sy = player.sy | 0;
    const r = getSectorRect(layout, sx, sy);
    if (r.x + r.w < 0 || r.y + r.h < 0 || r.x > w || r.y > h) continue;
    const cx = r.x + r.w * 0.5;
    const cy = r.y + r.h * 0.5;
    const rad = clamp(layout.cell * 0.18, 4, 12);
    ctx.save();
    ctx.fillStyle = player.isMe ? 'rgba(125,233,255,0.96)' : 'rgba(255,236,132,0.96)';
    ctx.strokeStyle = 'rgba(4,8,13,0.98)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  return layout;
}
