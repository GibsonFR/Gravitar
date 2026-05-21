const BASE_CELL = 20;
const MIN_CELL = 6;
const MAX_CELL = 74;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
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
      const bastion = visited?.bastion || (getBastion ? getBastion(sx, sy) : null);
      const isKnown = !!visited || !!bastion || (sx === layout.currentSx && sy === layout.currentSy);
      const isHub = sx === 0 && sy === 0;
      const isCurrent = sx === layout.currentSx && sy === layout.currentSy;

      let fill = isKnown ? 'rgba(18,28,42,0.88)' : 'rgba(8,13,20,0.66)';
      if (visited?.stationCount > 0) fill = 'rgba(42,76,116,0.90)';
      if (visited?.hasReturnPortal) fill = 'rgba(28,88,108,0.92)';
      if (bastion) fill = bastion.captured ? 'rgba(42,82,58,0.94)' : (bastion.unlocked ? 'rgba(82,62,34,0.96)' : 'rgba(54,43,52,0.94)');
      if (isHub) fill = 'rgba(86,72,28,0.94)';

      ctx.fillStyle = fill;
      ctx.fillRect(x, y, rectW, rectH);

      ctx.strokeStyle = isKnown ? 'rgba(110,180,255,0.24)' : 'rgba(72,100,132,0.10)';
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
      } else if ((visited?.stationCount | 0) > 0) {
        glyph = 'S';
        glyphColor = 'rgba(232,240,255,0.96)';
      }

      drawGlyph(ctx, glyph, x, y, layout.cell, glyphColor);

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
