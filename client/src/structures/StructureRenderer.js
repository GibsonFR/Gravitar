function worldToScreen(view, x, y, camX, camY) {
  return {
    x: (x - camX + view.cssW * 0.5) * view.dpr,
    y: (y - camY + view.cssH * 0.5) * view.dpr
  };
}

function ownerPalette(s) {
  if (s.owned) {
    return {
      fill: 'rgba(64, 174, 219, 0.16)',
      edge: 'rgba(124, 232, 255, 0.82)',
      claimFill: 'rgba(68, 218, 190, 0.045)',
      claimEdge: 'rgba(104, 245, 215, 0.34)',
      grid: 'rgba(130, 255, 226, 0.09)'
    };
  }
  return {
    fill: 'rgba(196, 54, 66, 0.12)',
    edge: 'rgba(255, 96, 106, 0.78)',
    claimFill: 'rgba(255, 66, 82, 0.04)',
    claimEdge: 'rgba(255, 80, 94, 0.34)',
    grid: 'rgba(255, 98, 112, 0.08)'
  };
}


function dirOf(s) {
  const o = String(s?.orientation || 'h').toLowerCase();
  if (o === 'v' || o === 'd') return { x: 0, y: 1, label: 'bas', orientation: 'd' };
  if (o === 'u') return { x: 0, y: -1, label: 'haut', orientation: 'u' };
  if (o === 'l') return { x: -1, y: 0, label: 'gauche', orientation: 'l' };
  return { x: 1, y: 0, label: 'droite', orientation: 'r' };
}

function rotateToDir(ctx, s) {
  const d = dirOf(s);
  const angle = d.x > 0 ? 0 : d.y > 0 ? Math.PI / 2 : d.x < 0 ? Math.PI : -Math.PI / 2;
  ctx.rotate(angle);
}

function oppositeDir(d) {
  return { x: -d.x, y: -d.y };
}

function sameSector(a, b) {
  return (a?.sx | 0) === (b?.sx | 0) && (a?.sy | 0) === (b?.sy | 0);
}

const CONVEYOR_TYPES = new Set(['conveyor', 'fast_conveyor', 'splitter', 'merger']);
const ARM_TYPES = new Set(['robot_arm', 'fast_arm', 'long_arm']);

function isConveyorType(type) {
  return CONVEYOR_TYPES.has(String(type || '').toLowerCase());
}

function isArmType(type) {
  return ARM_TYPES.has(String(type || '').toLowerCase());
}

function isAutomationStructure(st) {
  return isConveyorType(st?.type) || isArmType(st?.type) || !!st?.automationKind;
}

function nearOffset(a, b, ox, oy) {
  const dx = (Number(b?.x) || 0) - ((Number(a?.x) || 0) + ox);
  const dy = (Number(b?.y) || 0) - ((Number(a?.y) || 0) + oy);
  return dx * dx + dy * dy < 22 * 22;
}

function findNeighbor(structures, s, dir) {
  if (!structures?.values) return null;
  const ox = dir.x * 64;
  const oy = dir.y * 64;
  for (const other of structures.values()) {
    if (!other || other.id === s.id || !sameSector(s, other)) continue;
    if (!isAutomationStructure(other) && !other.storagePreview && !other.machineJob && !other.machineEnabled) continue;
    if (nearOffset(s, other, ox, oy)) return other;
  }
  return null;
}

function canFeedForward(a, b) {
  if (!a || !b) return false;
  if (isArmType(a.type)) return true;
  if (isArmType(b.type)) return true;
  if (!isConveyorType(a.type) || !isConveyorType(b.type)) return true;
  if (a.type === 'splitter' || b.type === 'splitter' || a.type === 'merger' || b.type === 'merger') return true;
  const ad = dirOf(a);
  const bd = dirOf(b);
  return ad.x === bd.x && ad.y === bd.y;
}

function automationLinks(structures, s) {
  const d = dirOf(s);
  const front = findNeighbor(structures, s, d);
  const back = findNeighbor(structures, s, oppositeDir(d));
  return {
    front: !!front && canFeedForward(s, front),
    back: !!back,
    left: !!findNeighbor(structures, s, { x: -d.y, y: d.x }),
    right: !!findNeighbor(structures, s, { x: d.y, y: -d.x })
  };
}

function smoothstep01(v) {
  const x = Math.max(0, Math.min(1, Number(v) || 0));
  return x * x * (3 - 2 * x);
}

function localAutomationProgress(preview) {
  if (!preview || typeof preview !== 'object') return null;
  const totalMs = Math.max(1, Number(preview.totalMs) || 0);
  const localStartedAt = Number(preview._localStartedAt);
  if (Number.isFinite(localStartedAt) && totalMs > 0) {
    return Math.max(0, Math.min(1, (performance.now() - localStartedAt) / totalMs));
  }
  const startedAt = Number(preview.startedAt);
  if (Number.isFinite(startedAt) && totalMs > 0) {
    return Math.max(0, Math.min(1, (Date.now() - startedAt) / totalMs));
  }
  if (Number.isFinite(Number(preview.progress))) return Math.max(0, Math.min(1, Number(preview.progress)));
  return null;
}

function drawResourceChip(ctx, view, color, x, y, radius, dir, amount = 1) {
  const angle = dir.x > 0 ? 0 : dir.y > 0 ? Math.PI / 2 : dir.x < 0 ? Math.PI : -Math.PI / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = color;
  ctx.shadowBlur = 12 * view.dpr;
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255,255,255,.86)';
  ctx.lineWidth = 1.15 * view.dpr;
  ctx.beginPath();
  ctx.moveTo(radius * 1.28, 0);
  ctx.lineTo(radius * 0.34, radius * 0.92);
  ctx.lineTo(-radius * 0.92, radius * 0.62);
  ctx.lineTo(-radius * 1.18, 0);
  ctx.lineTo(-radius * 0.92, -radius * 0.62);
  ctx.lineTo(radius * 0.34, -radius * 0.92);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.42)';
  ctx.beginPath();
  ctx.ellipse(radius * 0.12, -radius * 0.22, radius * 0.46, radius * 0.18, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,18,28,.35)';
  ctx.lineWidth = 0.9 * view.dpr;
  ctx.beginPath();
  ctx.moveTo(-radius * 0.58, 0);
  ctx.lineTo(radius * 0.54, 0);
  ctx.stroke();
  ctx.restore();

  if (amount > 1) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.font = `${8 * view.dpr}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.94)';
    ctx.fillText(String(amount), x, y - radius * 1.65);
    ctx.restore();
  }
}

function drawAutomationItem(ctx, view, s, w, h, t) {
  const preview = s.automationItem || s._automationFadeItem || s.storagePreview || null;
  const used = Number(s.storageUsed || 0);
  if (!preview && used <= 0) return;
  const color = preview?.colorHex || 'rgba(230,245,255,.95)';
  const dir = dirOf(s);
  const rawProgress = localAutomationProgress(preview);
  const idlePulse = 0.5 + 0.18 * Math.sin(t * 3.0 + (s.id | 0));
  const progress = rawProgress == null
    ? (s.automationItem ? Math.max(0, Math.min(1, (performance.now() - Number(s.automationPulse || 0)) / 700)) : idlePulse)
    : rawProgress;
  const blocked = preview?.phase === 'blocked' || preview?.phase === 'arm_blocked' || s.automationStatus === 'blocked';
  const fadeUntil = Number(preview?._fadeUntil || 0);
  const fade = fadeUntil > 0 ? Math.max(0, Math.min(1, (fadeUntil - performance.now()) / 220)) : 1;
  let phase = blocked ? 1 : progress;
  if (preview?.phase === 'arm') phase = smoothstep01(progress);
  const travel = preview?.phase === 'arm' || preview?.phase === 'arm_blocked' ? 0.90 : 0.86;
  const px = dir.x * (phase - 0.5) * w * travel;
  const py = dir.y * (phase - 0.5) * h * travel;
  ctx.save();
  ctx.globalAlpha *= fade;
  drawResourceChip(ctx, view, color, px, py, Math.max(5, Math.min(w, h) * 0.105), dir, preview?.amount | 0 || 1);
  ctx.restore();
  if (blocked) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,120,120,.95)';
    ctx.lineWidth = 2.2 * view.dpr;
    ctx.beginPath();
    ctx.moveTo(px - 7 * view.dpr, py - 7 * view.dpr);
    ctx.lineTo(px + 7 * view.dpr, py + 7 * view.dpr);
    ctx.moveTo(px + 7 * view.dpr, py - 7 * view.dpr);
    ctx.lineTo(px - 7 * view.dpr, py + 7 * view.dpr);
    ctx.stroke();
    ctx.restore();
  }
}

function drawConveyorBody(ctx, view, s, w, h, t, structures) {
  const links = automationLinks(structures, s);
  ctx.save();
  rotateToDir(ctx, s);
  const rr = Math.min(10 * view.dpr, Math.min(w, h) * 0.22);
  const isFast = s.type === 'fast_conveyor';
  const isSplitter = s.type === 'splitter';
  const isMerger = s.type === 'merger';
  const laneStroke = isMerger ? 'rgba(255, 217, 138, .92)' : isFast ? 'rgba(154, 255, 255, .92)' : 'rgba(112, 225, 255, .88)';
  const laneFill = isMerger ? 'rgba(82, 58, 30, .86)' : isFast ? 'rgba(28, 92, 106, .88)' : 'rgba(29, 65, 80, .88)';

  ctx.fillStyle = 'rgba(12, 21, 30, .84)';
  ctx.strokeStyle = laneStroke;
  ctx.lineWidth = 1.8 * view.dpr;
  ctx.beginPath();
  roundedRect(ctx, -w * 0.46, -h * 0.46, w * 0.92, h * 0.92, rr);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = laneFill;
  ctx.beginPath();
  roundedRect(ctx, -w * 0.34, -h * 0.40, w * 0.68, h * 0.80, 7 * view.dpr);
  ctx.fill();

  const portR = 4.5 * view.dpr;
  const portStroke = isMerger ? 'rgba(255, 235, 176, .95)' : 'rgba(185, 248, 255, .95)';
  ctx.strokeStyle = portStroke;
  ctx.lineWidth = 1.4 * view.dpr;
  function port(x, y, fill = 'rgba(4,12,18,.75)') {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, portR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (isSplitter) {
    port(-w * 0.48, -h * 0.25, 'rgba(84,255,210,.22)');
    port(w * 0.48, -h * 0.25, 'rgba(255,232,142,.24)');
    port(w * 0.48, h * 0.25, 'rgba(255,232,142,.24)');
  } else if (isMerger) {
    port(-w * 0.48, -h * 0.25, 'rgba(84,255,210,.22)');
    port(-w * 0.48, h * 0.25, 'rgba(84,255,210,.22)');
    port(w * 0.48, -h * 0.25, 'rgba(255,232,142,.24)');
  } else {
    if (links.back) port(-w * 0.48, 0, 'rgba(84,255,210,.20)');
    if (links.front) port(w * 0.48, 0, 'rgba(255,232,142,.22)');
  }

  ctx.strokeStyle = isFast ? 'rgba(214, 255, 255, .30)' : 'rgba(185, 245, 255, .18)';
  ctx.lineWidth = 1 * view.dpr;
  if (isFast) {
    for (const y of [-h * 0.16, h * 0.16]) {
      ctx.beginPath();
      ctx.moveTo(-w * 0.26, y);
      ctx.lineTo(w * 0.26, y);
      ctx.stroke();
    }
  } else if (!isSplitter && !isMerger) {
    const step = Math.max(w * 0.11, 10 * view.dpr);
    for (let x = -w * 0.28; x <= w * 0.28; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, -h * 0.18);
      ctx.lineTo(x + w * 0.05, h * 0.18);
      ctx.stroke();
    }
  }

  const span = Math.max(12 * view.dpr, Math.min(w, h) * (isFast ? 0.28 : 0.36));
  const speed = isFast ? 132 : 80;
  const offset = ((t * speed * view.dpr) % span) - span;
  ctx.strokeStyle = isMerger ? 'rgba(255, 217, 138, .90)' : isFast ? 'rgba(168, 255, 255, .96)' : 'rgba(110, 223, 255, .74)';
  ctx.lineWidth = isFast ? 2.6 * view.dpr : 2.2 * view.dpr;
  ctx.lineCap = 'round';

  if (!isSplitter && !isMerger) {
    for (let x = -w * 0.34 + offset; x < w * 0.44; x += span) {
      ctx.beginPath();
      ctx.moveTo(x - w * 0.04, -h * 0.10);
      ctx.lineTo(x + w * (isFast ? 0.07 : 0.05), 0);
      ctx.lineTo(x - w * 0.04, h * 0.10);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = 'rgba(255, 244, 170, .96)';
  ctx.fillStyle = 'rgba(255, 244, 170, .96)';
  ctx.lineWidth = 2.4 * view.dpr;

  if (isSplitter) {
    ctx.beginPath();
    ctx.moveTo(-w * 0.46, -h * 0.25);
    ctx.lineTo(-w * 0.06, -h * 0.25);
    ctx.lineTo(w * 0.24, -h * 0.25);
    ctx.moveTo(-w * 0.06, -h * 0.25);
    ctx.lineTo(w * 0.24, h * 0.25);
    ctx.stroke();
    for (const y of [-h * 0.25, h * 0.25]) {
      ctx.beginPath();
      ctx.moveTo(w * 0.34, y);
      ctx.lineTo(w * 0.18, y - h * 0.08);
      ctx.lineTo(w * 0.18, y + h * 0.08);
      ctx.closePath();
      ctx.fill();
    }
  } else if (isMerger) {
    ctx.beginPath();
    ctx.moveTo(-w * 0.46, -h * 0.25);
    ctx.lineTo(-w * 0.10, -h * 0.25);
    ctx.moveTo(-w * 0.46, h * 0.25);
    ctx.lineTo(-w * 0.10, h * 0.25);
    ctx.lineTo(w * 0.20, -h * 0.25);
    ctx.lineTo(w * 0.34, -h * 0.25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.40, -h * 0.25);
    ctx.lineTo(w * 0.24, -h * 0.33);
    ctx.lineTo(w * 0.24, -h * 0.17);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-w * 0.18, 0);
    ctx.lineTo(w * 0.17, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.25, 0);
    ctx.lineTo(w * 0.10, -h * 0.12);
    ctx.lineTo(w * 0.10, h * 0.12);
    ctx.closePath();
    ctx.fill();
  }

  if (s.automationItem?.phase === 'blocked') {
    ctx.strokeStyle = 'rgba(255, 106, 106, .95)';
    ctx.lineWidth = 2 * view.dpr;
    ctx.strokeRect(w * 0.24, -h * 0.36, w * 0.18, h * 0.28);
  }
  ctx.restore();
}

function drawConveyorMotion(ctx, view, s, w, h, t, structures) {
  drawConveyorBody(ctx, view, s, w, h, t, structures);
}

function drawRobotArmBody(ctx, view, s, w, h) {
  const preview = s.automationItem || null;
  const p = preview ? localAutomationProgress(preview) : null;
  const phase = preview?.phase === 'arm' ? smoothstep01(p ?? 0) : (preview?.phase === 'arm_blocked' ? 1 : 0.5);
  const reachScale = s.type === 'long_arm' ? 1.15 : 1;
  const fastScale = s.type === 'fast_arm' ? 1.12 : 1;
  ctx.save();
  rotateToDir(ctx, s);

  ctx.fillStyle = 'rgba(35, 26, 16, .86)';
  ctx.strokeStyle = 'rgba(255, 211, 118, .86)';
  ctx.lineWidth = 1.8 * view.dpr;
  ctx.beginPath();
  roundedRect(ctx, -w * 0.26, -h * 0.24, w * 0.52, h * 0.48, 8 * view.dpr);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 230, 160, .28)';
  ctx.lineWidth = 1.3 * view.dpr;
  ctx.beginPath();
  ctx.moveTo(-w * 0.44, 0);
  ctx.lineTo(-w * 0.30, 0);
  ctx.moveTo(w * 0.30, 0);
  ctx.lineTo(w * 0.44, 0);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 225, 126, .22)';
  ctx.beginPath();
  ctx.arc(0, 0, Math.min(w, h) * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 225, 126, .82)';
  ctx.stroke();

  const clawX = (phase - 0.5) * w * 0.84 * reachScale;
  const jointX = clawX * 0.45;
  ctx.strokeStyle = 'rgba(255, 221, 145, .88)';
  ctx.lineWidth = 4.2 * view.dpr * (s.type === 'long_arm' ? 0.82 : 1);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(jointX, Math.sin(phase * Math.PI) * -h * 0.11);
  ctx.lineTo(clawX, 0);
  ctx.stroke();

  ctx.lineWidth = 2.2 * view.dpr;
  ctx.beginPath();
  ctx.moveTo(clawX, 0);
  ctx.lineTo(clawX - w * 0.075, -h * 0.09);
  ctx.moveTo(clawX, 0);
  ctx.lineTo(clawX - w * 0.075, h * 0.09);
  ctx.stroke();

  if (s.type === 'fast_arm') {
    ctx.strokeStyle = 'rgba(255, 245, 170, .55)';
    ctx.lineWidth = 1.2 * view.dpr;
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(w, h) * 0.26 * fastScale, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(120, 255, 220, .60)';
  ctx.beginPath();
  ctx.arc(-w * 0.42, 0, 3.2 * view.dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 205, 115, .72)';
  ctx.beginPath();
  ctx.arc(w * 0.42, 0, 3.2 * view.dpr, 0, Math.PI * 2);
  ctx.fill();

  if (preview?.phase === 'arm_blocked') {
    ctx.strokeStyle = 'rgba(255, 106, 106, .95)';
    ctx.lineWidth = 2 * view.dpr;
    ctx.beginPath();
    ctx.moveTo(w * 0.31, -h * 0.18);
    ctx.lineTo(w * 0.43, h * 0.18);
    ctx.moveTo(w * 0.43, -h * 0.18);
    ctx.lineTo(w * 0.31, h * 0.18);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRobotArmMotion(ctx, view, s, w, h) {
  drawRobotArmBody(ctx, view, s, w, h);
}

function drawDirectionArrow(ctx, view, s, w, h, label = false) {
  const d = dirOf(s);
  const len = Math.min(w, h) * 0.34;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,245,170,.95)';
  ctx.fillStyle = 'rgba(255,245,170,.95)';
  ctx.lineWidth = 2.4 * view.dpr;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-d.x * len * 0.45, -d.y * len * 0.45);
  ctx.lineTo(d.x * len * 0.55, d.y * len * 0.55);
  ctx.stroke();
  ctx.beginPath();
  const hx = d.x * len * 0.60;
  const hy = d.y * len * 0.60;
  const px = -d.y;
  const py = d.x;
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx - d.x * 10 * view.dpr + px * 6 * view.dpr, hy - d.y * 10 * view.dpr + py * 6 * view.dpr);
  ctx.lineTo(hx - d.x * 10 * view.dpr - px * 6 * view.dpr, hy - d.y * 10 * view.dpr - py * 6 * view.dpr);
  ctx.closePath();
  ctx.fill();
  if (label) {
    ctx.font = `${9 * view.dpr}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.label, 0, Math.min(w, h) * 0.36);
  }
  ctx.restore();
}

function drawStructureBar(ctx, view, s, sx, sy) {
  if (!s?.damageable || !s.vitals) return;
  const hp = s.vitals?.hp ?? 0;
  const maxHp = Math.max(1, s.vitals?.maxHp ?? 1);
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  const w = Math.max(46, Math.min(92, (s.w || s.radius * 2) * 0.5)) * view.dpr;
  const h = 4 * view.dpr;
  const x = sx - w * 0.5;
  const y = sy - ((s.h || s.radius * 2) * 0.5 + 14) * view.dpr;
  ctx.save();
  ctx.fillStyle = 'rgba(5,9,14,0.72)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = pct > 0.45 ? 'rgba(114,235,194,0.9)' : pct > 0.18 ? 'rgba(255,204,96,0.92)' : 'rgba(255,104,104,0.95)';
  ctx.fillRect(x, y, w * pct, h);
  ctx.restore();
}

function roundedRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
}

function drawClaimSquare(ctx, view, s, camX, camY) {
  const half = Number(s.claimRadius) || 0;
  if (!half) return;
  const p = worldToScreen(view, s.x || 0, s.y || 0, camX, camY);
  const size = half * 2 * view.dpr;
  const pal = ownerPalette(s);
  ctx.save();
  ctx.fillStyle = pal.claimFill;
  ctx.strokeStyle = pal.claimEdge;
  ctx.lineWidth = 1.2 * view.dpr;
  ctx.setLineDash([16 * view.dpr, 12 * view.dpr]);
  ctx.fillRect(p.x - size * 0.5, p.y - size * 0.5, size, size);
  ctx.strokeRect(p.x - size * 0.5, p.y - size * 0.5, size, size);
  ctx.setLineDash([]);
  ctx.restore();
}

function drawBuildGrid(ctx, view, camX, camY, gridSize = 64) {
  const g = gridSize * view.dpr;
  const startX = (-((camX % gridSize) + gridSize) % gridSize + view.cssW * 0.5 % gridSize) * view.dpr;
  const startY = (-((camY % gridSize) + gridSize) % gridSize + view.cssH * 0.5 % gridSize) * view.dpr;
  ctx.save();
  ctx.strokeStyle = 'rgba(132, 226, 255, 0.105)';
  ctx.lineWidth = 1 * view.dpr;
  for (let x = startX - g * 2; x < view.w + g * 2; x += g) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, view.h);
    ctx.stroke();
  }
  for (let y = startY - g * 2; y < view.h + g * 2; y += g) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(view.w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFootprintCells(ctx, view, w, h, tilesX, tilesY) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1 * view.dpr;
  for (let i = 1; i < tilesX; i += 1) {
    const x = -w * 0.5 + (w / tilesX) * i;
    ctx.beginPath();
    ctx.moveTo(x, -h * 0.5);
    ctx.lineTo(x, h * 0.5);
    ctx.stroke();
  }
  for (let i = 1; i < tilesY; i += 1) {
    const y = -h * 0.5 + (h / tilesY) * i;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, y);
    ctx.lineTo(w * 0.5, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawStructure(ctx, view, s, camX, camY, t = 0, structures = null) {
  if (!s) return;
  if (s.type === 'base_core') drawClaimSquare(ctx, view, s, camX, camY);
  const p = worldToScreen(view, s.x || 0, s.y || 0, camX, camY);
  const storage1x1 = s.type === 'storage' || s.type === 'equipment_storage' || s.type === 'ammo_storage';
  const w = (storage1x1 ? 64 : (s.w || s.radius * 2 || 80)) * view.dpr;
  const h = (storage1x1 ? 64 : (s.h || s.radius * 2 || 80)) * view.dpr;
  const pal = ownerPalette(s);
  const edge = pal.edge;
  const machineTypes = new Set(['furnace', 'high_temp_furnace', 'chemical_refinery', 'electrolyzer', 'electronics_bench', 'industrial_press']);
  const powerTypes = new Set(['solar_panel', 'fuel_generator', 'fuel_tank']);
  const storageTypes = new Set(['storage', 'equipment_storage', 'ammo_storage']);
  const fill = (s.type === 'wall' || s.type === 'door')
    ? (s.owned ? 'rgba(38, 55, 72, .74)' : 'rgba(72, 34, 40, .70)')
    : machineTypes.has(s.type)
      ? (s.owned ? 'rgba(40, 50, 60, .40)' : 'rgba(74, 36, 44, .32)')
      : powerTypes.has(s.type)
        ? (s.owned ? 'rgba(34, 52, 58, .40)' : 'rgba(74, 38, 44, .32)')
        : storageTypes.has(s.type)
          ? (s.owned ? 'rgba(34, 52, 50, .42)' : 'rgba(74, 38, 44, .30)')
          : pal.fill;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = edge;
  ctx.shadowBlur = (s.type === 'wall' || s.type === 'door') ? 5 * view.dpr : 8 * view.dpr;
  ctx.fillStyle = fill;
  ctx.strokeStyle = edge;
  ctx.lineWidth = (s.owned ? 1.8 : 1.6) * view.dpr;

  if (s.type === 'base_core') {
    const rr = 18 * view.dpr;
    ctx.beginPath();
    roundedRect(ctx, -w * 0.5, -h * 0.5, w, h, rr);
    ctx.fill();
    ctx.stroke();
    drawFootprintCells(ctx, view, w, h, 2, 2);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = s.owned ? 'rgba(176,246,255,.34)' : 'rgba(255,150,150,.32)';
    ctx.lineWidth = 1.6 * view.dpr;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.36);
    ctx.lineTo(w * 0.32, -h * 0.16);
    ctx.lineTo(w * 0.32, h * 0.18);
    ctx.lineTo(0, h * 0.38);
    ctx.lineTo(-w * 0.32, h * 0.18);
    ctx.lineTo(-w * 0.32, -h * 0.16);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(w, h) * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = s.owned ? 'rgba(126,232,255,.18)' : 'rgba(255,120,130,.15)';
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(w, h) * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else if (s.type === 'wall' || s.type === 'door') {
    const rr = Math.min(9 * view.dpr, Math.min(w, h) * 0.24);
    ctx.globalAlpha = s.type === 'door' && s.open ? 0.46 : 1;
    ctx.beginPath();
    roundedRect(ctx, -w * 0.5, -h * 0.5, w, h, rr);
    ctx.fill();
    ctx.stroke();
    drawFootprintCells(ctx, view, w, h, (w > h ? 3 : 1), (h > w ? 3 : 1));
    if (s.type === 'door') {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = s.open ? 'rgba(120,255,210,.75)' : 'rgba(160,220,255,.56)';
      ctx.lineWidth = 2 * view.dpr;
      ctx.beginPath();
      if (w >= h) {
        ctx.moveTo(-w * 0.34, 0); ctx.lineTo(w * 0.34, 0);
        ctx.moveTo(w * 0.18, -h * 0.18); ctx.lineTo(w * 0.34, 0); ctx.lineTo(w * 0.18, h * 0.18);
      } else {
        ctx.moveTo(0, -h * 0.34); ctx.lineTo(0, h * 0.34);
        ctx.moveTo(-w * 0.18, h * 0.18); ctx.lineTo(0, h * 0.34); ctx.lineTo(w * 0.18, h * 0.18);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    const rr = 14 * view.dpr;
    ctx.beginPath();
    roundedRect(ctx, -w * 0.5, -h * 0.5, w, h, rr);
    ctx.fill();
    ctx.stroke();
    const tilesX = Math.max(1, Math.round((s.w || 64) / 64));
    const tilesY = Math.max(1, Math.round((s.h || 64) / 64));
    drawFootprintCells(ctx, view, w, h, tilesX, tilesY);
    ctx.shadowBlur = 0;
    const isStorage = s.type === 'storage';
    const isEquip = s.type === 'equipment_storage';
    const isAmmo = s.type === 'ammo_storage';
    const isSolar = s.type === 'solar_panel';
    const isGenerator = s.type === 'fuel_generator';
    const isFuelTank = s.type === 'fuel_tank';
    const isFurnace = s.type === 'furnace';
    const isHighFurnace = s.type === 'high_temp_furnace';
    const isChem = s.type === 'chemical_refinery';
    const isElectro = s.type === 'electrolyzer';
    const isElectronics = s.type === 'electronics_bench';
    const isPress = s.type === 'industrial_press';
    const isConveyor = isConveyorType(s.type);
    const isRobotArm = isArmType(s.type);
    ctx.strokeStyle = isHighFurnace ? 'rgba(255,118,92,.74)'
      : isFurnace ? 'rgba(255,178,94,.72)'
      : isChem ? 'rgba(150,235,130,.68)'
      : isElectro ? 'rgba(120,220,255,.72)'
      : isElectronics ? 'rgba(145,176,255,.72)'
      : isPress ? 'rgba(220,232,242,.70)'
      : isConveyor ? 'rgba(110,215,255,.72)'
      : isRobotArm ? 'rgba(255,210,123,.72)'
      : isSolar ? 'rgba(210,255,150,.62)'
      : isGenerator ? 'rgba(255,185,96,.64)'
      : isFuelTank ? 'rgba(255,200,118,.56)'
      : isAmmo ? 'rgba(255,197,112,.58)'
      : isEquip ? 'rgba(150,185,255,.58)'
      : (s.owned ? 'rgba(145,255,220,.32)' : 'rgba(255,130,130,.30)');
    ctx.lineWidth = 1.5 * view.dpr;
    ctx.beginPath();
    if (isConveyor) {
      drawConveyorMotion(ctx, view, s, w, h, t, structures);
      ctx.beginPath();
    } else if (isRobotArm) {
      drawRobotArmMotion(ctx, view, s, w, h);
      ctx.beginPath();
    } else if (isSolar) {

      ctx.fillStyle = 'rgba(64, 120, 124, .32)';
      ctx.beginPath();
      ctx.moveTo(-w * 0.26, -h * 0.10);
      ctx.lineTo(w * 0.24, -h * 0.22);
      ctx.lineTo(w * 0.30, h * 0.08);
      ctx.lineTo(-w * 0.20, h * 0.20);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(210,255,150,.76)';
      ctx.beginPath();
      ctx.moveTo(-w * 0.26, -h * 0.10);
      ctx.lineTo(w * 0.24, -h * 0.22);
      ctx.lineTo(w * 0.30, h * 0.08);
      ctx.lineTo(-w * 0.20, h * 0.20);
      ctx.closePath();
      for (let i = 1; i <= 3; i += 1) {
        const tt = i / 4;
        const x1 = -w * 0.26 + (w * 0.50) * tt;
        const y1 = -h * 0.10 + (-h * 0.12) * tt;
        const x2 = -w * 0.20 + (w * 0.50) * tt;
        const y2 = h * 0.20 + (-h * 0.12) * tt;
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      }
      for (let i = 1; i <= 2; i += 1) {
        const tt = i / 3;
        ctx.moveTo(-w * 0.245 + w * 0.515 * tt, -h * 0.13 + h * 0.30 * tt);
        ctx.lineTo(-w * 0.195 + w * 0.515 * tt, h * 0.17 + h * 0.00 * tt);
      }
      ctx.moveTo(0, h * 0.20); ctx.lineTo(0, h * 0.36);
      ctx.moveTo(-w * 0.12, h * 0.36); ctx.lineTo(w * 0.12, h * 0.36);
      ctx.moveTo(w * 0.14, -h * 0.36); ctx.lineTo(w * 0.20, -h * 0.46);
      ctx.moveTo(w * 0.12, -h * 0.41); ctx.lineTo(w * 0.22, -h * 0.41);
    } else if (isGenerator) {

      ctx.fillStyle = 'rgba(84, 58, 30, .42)';
      ctx.fillRect(-w * 0.28, -h * 0.24, w * 0.56, h * 0.48);
      ctx.strokeStyle = 'rgba(255,185,96,.80)';
      ctx.beginPath();
      ctx.rect(-w * 0.28, -h * 0.24, w * 0.56, h * 0.48);
      ctx.moveTo(-w * 0.12, -h * 0.24); ctx.lineTo(-w * 0.12, h * 0.24);
      ctx.moveTo(w * 0.10, -h * 0.24); ctx.lineTo(w * 0.10, h * 0.24);
      ctx.moveTo(-w * 0.28, h * 0.28); ctx.lineTo(w * 0.28, h * 0.28);
      ctx.moveTo(-w * 0.22, -h * 0.30); ctx.lineTo(-w * 0.22, -h * 0.42);
      ctx.arc(-w * 0.02, 0, Math.min(w, h) * 0.12, 0, Math.PI * 2);
      ctx.moveTo(w * 0.16, -h * 0.10); ctx.lineTo(w * 0.06, h * 0.02); ctx.lineTo(w * 0.16, h * 0.02); ctx.lineTo(w * 0.06, h * 0.16);
    } else if (isFuelTank) {

      ctx.fillStyle = 'rgba(80, 60, 30, .30)';
      ctx.fillRect(-w * 0.26, -h * 0.22, w * 0.52, h * 0.44);
      ctx.strokeStyle = 'rgba(255,200,118,.72)';
      ctx.beginPath();
      ctx.moveTo(-w * 0.18, -h * 0.22); ctx.lineTo(w * 0.18, -h * 0.22);
      ctx.moveTo(-w * 0.26, -h * 0.08); ctx.quadraticCurveTo(0, -h * 0.18, w * 0.26, -h * 0.08);
      ctx.moveTo(-w * 0.26, h * 0.08); ctx.quadraticCurveTo(0, h * 0.18, w * 0.26, h * 0.08);
      ctx.moveTo(-w * 0.18, h * 0.22); ctx.lineTo(w * 0.18, h * 0.22);
      ctx.moveTo(-w * 0.08, -h * 0.32); ctx.lineTo(-w * 0.08, -h * 0.22);
      ctx.moveTo(-w * 0.06, -h * 0.02); ctx.lineTo(w * 0.10, -h * 0.02);
      ctx.moveTo(-w * 0.06, h * 0.10); ctx.lineTo(w * 0.04, h * 0.10);
      ctx.arc(w * 0.14, h * 0.12, w * 0.055, -Math.PI / 2, Math.PI / 2);
    } else if (isStorage) {

      ctx.fillStyle = 'rgba(62, 86, 66, .34)';
      ctx.fillRect(-w * 0.28, -h * 0.16, w * 0.56, h * 0.38);
      ctx.fillRect(-w * 0.24, -h * 0.28, w * 0.48, h * 0.12);
      ctx.strokeStyle = 'rgba(118,246,202,.80)';
      ctx.beginPath();
      ctx.rect(-w * 0.28, -h * 0.16, w * 0.56, h * 0.38);
      ctx.rect(-w * 0.24, -h * 0.28, w * 0.48, h * 0.12);
      ctx.moveTo(-w * 0.10, -h * 0.22); ctx.lineTo(w * 0.10, -h * 0.22);
      ctx.moveTo(0, -h * 0.16); ctx.lineTo(0, h * 0.22);
      ctx.rect(-w * 0.06, -h * 0.06, w * 0.12, h * 0.10);
      ctx.moveTo(-w * 0.18, h * 0.10); ctx.lineTo(w * 0.18, h * 0.10);
    } else if (isEquip) {

      ctx.fillStyle = 'rgba(44, 58, 90, .32)';
      ctx.fillRect(-w * 0.26, -h * 0.30, w * 0.52, h * 0.60);
      ctx.strokeStyle = 'rgba(150,185,255,.76)';
      ctx.beginPath();
      ctx.rect(-w * 0.26, -h * 0.30, w * 0.52, h * 0.60);
      ctx.moveTo(0, -h * 0.30); ctx.lineTo(0, h * 0.30);
      ctx.moveTo(-w * 0.18, -h * 0.12); ctx.lineTo(-w * 0.04, -h * 0.12);
      ctx.moveTo(-w * 0.18, h * 0.04); ctx.lineTo(-w * 0.04, h * 0.04);
      ctx.moveTo(w * 0.04, -h * 0.14); ctx.lineTo(w * 0.18, -h * 0.14);
      ctx.moveTo(w * 0.04, 0); ctx.lineTo(w * 0.18, 0);
      ctx.moveTo(w * 0.04, h * 0.14); ctx.lineTo(w * 0.18, h * 0.14);
      ctx.rect(-w * 0.16, h * 0.12, w * 0.10, h * 0.10);
    } else if (isAmmo) {

      ctx.fillStyle = 'rgba(88, 62, 30, .34)';
      ctx.fillRect(-w * 0.28, -h * 0.18, w * 0.56, h * 0.34);
      ctx.strokeStyle = 'rgba(255,197,112,.76)';
      ctx.beginPath();
      ctx.rect(-w * 0.28, -h * 0.18, w * 0.56, h * 0.34);
      ctx.rect(-w * 0.04, -h * 0.22, w * 0.08, h * 0.08);
      ctx.moveTo(-w * 0.10, h * 0.18); ctx.lineTo(-w * 0.02, -h * 0.06); ctx.lineTo(w * 0.06, h * 0.18);
      ctx.moveTo(w * 0.08, h * 0.18); ctx.lineTo(w * 0.16, -h * 0.06); ctx.lineTo(w * 0.24, h * 0.18);
      ctx.moveTo(-w * 0.24, h * 0.26); ctx.lineTo(w * 0.24, h * 0.26);
    } else if (isFurnace || isHighFurnace) {

      ctx.fillStyle = isHighFurnace ? 'rgba(92, 44, 38, .36)' : 'rgba(88, 58, 30, .34)';
      ctx.fillRect(-w * 0.28, -h * 0.18, w * 0.56, h * 0.40);
      ctx.strokeStyle = isHighFurnace ? 'rgba(255,118,92,.82)' : 'rgba(255,178,94,.80)';
      ctx.beginPath();
      ctx.rect(-w * 0.28, -h * 0.18, w * 0.56, h * 0.40);
      ctx.rect(-w * 0.10, -h * 0.04, w * 0.20, h * 0.16);
      ctx.moveTo(-w * 0.28, h * 0.24); ctx.lineTo(w * 0.28, h * 0.24);
      ctx.moveTo(-w * 0.18, -h * 0.18); ctx.lineTo(-w * 0.18, -h * (isHighFurnace ? 0.36 : 0.30));
      ctx.moveTo(w * 0.18, -h * 0.18); ctx.lineTo(w * 0.18, -h * (isHighFurnace ? 0.36 : 0.30));
      ctx.moveTo(-w * 0.10, h * 0.04); ctx.lineTo(w * 0.10, h * 0.04);
      ctx.moveTo(-w * 0.06, -h * 0.04); ctx.quadraticCurveTo(0, -h * (isHighFurnace ? 0.18 : 0.12), w * 0.06, -h * 0.04);
      if (isHighFurnace) {
        ctx.moveTo(-w * 0.22, -h * 0.36); ctx.lineTo(-w * 0.14, -h * 0.36);
        ctx.moveTo(w * 0.14, -h * 0.36); ctx.lineTo(w * 0.22, -h * 0.36);
      }
    } else if (isChem) {

      ctx.fillStyle = 'rgba(48, 78, 34, .28)';
      ctx.fillRect(-w * 0.28, -h * 0.10, w * 0.18, h * 0.32);
      ctx.fillRect(w * 0.02, -h * 0.22, w * 0.18, h * 0.44);
      ctx.strokeStyle = 'rgba(150,235,130,.78)';
      ctx.beginPath();
      ctx.rect(-w * 0.28, -h * 0.10, w * 0.18, h * 0.32);
      ctx.rect(w * 0.02, -h * 0.22, w * 0.18, h * 0.44);
      ctx.moveTo(-w * 0.10, 0); ctx.lineTo(w * 0.02, 0);
      ctx.lineTo(w * 0.02, -h * 0.10); ctx.lineTo(w * 0.12, -h * 0.10);
      ctx.moveTo(-w * 0.20, -h * 0.10); ctx.lineTo(-w * 0.20, -h * 0.26);
      ctx.moveTo(w * 0.12, -h * 0.22); ctx.lineTo(w * 0.12, -h * 0.34);
      ctx.moveTo(-w * 0.22, h * 0.10); ctx.lineTo(-w * 0.16, h * 0.18); ctx.lineTo(-w * 0.10, h * 0.10);
      ctx.moveTo(w * 0.24, h * 0.18); ctx.lineTo(w * 0.28, h * 0.24); ctx.lineTo(w * 0.32, h * 0.18);
    } else if (isElectro) {

      ctx.fillStyle = 'rgba(30, 64, 86, .26)';
      ctx.fillRect(-w * 0.26, -h * 0.20, w * 0.18, h * 0.40);
      ctx.fillRect(w * 0.08, -h * 0.20, w * 0.18, h * 0.40);
      ctx.strokeStyle = 'rgba(120,220,255,.82)';
      ctx.beginPath();
      ctx.rect(-w * 0.26, -h * 0.20, w * 0.18, h * 0.40);
      ctx.rect(w * 0.08, -h * 0.20, w * 0.18, h * 0.40);
      ctx.moveTo(-w * 0.17, -h * 0.28); ctx.lineTo(-w * 0.17, -h * 0.20);
      ctx.moveTo(w * 0.17, -h * 0.28); ctx.lineTo(w * 0.17, -h * 0.20);
      ctx.moveTo(-w * 0.20, 0); ctx.lineTo(-w * 0.14, 0);
      ctx.moveTo(w * 0.14, -h * 0.04); ctx.lineTo(w * 0.20, -h * 0.04);
      ctx.moveTo(w * 0.17, -h * 0.08); ctx.lineTo(w * 0.17, 0);
      ctx.moveTo(-w * 0.02, -h * 0.10); ctx.lineTo(-w * 0.10, h * 0.02); ctx.lineTo(0, h * 0.02); ctx.lineTo(-w * 0.08, h * 0.16);
    } else if (isElectronics) {

      ctx.fillStyle = 'rgba(32, 46, 82, .28)';
      ctx.fillRect(-w * 0.28, -h * 0.22, w * 0.56, h * 0.44);
      ctx.strokeStyle = 'rgba(145,176,255,.80)';
      ctx.beginPath();
      ctx.rect(-w * 0.28, -h * 0.22, w * 0.56, h * 0.44);
      ctx.rect(-w * 0.10, -h * 0.08, w * 0.20, h * 0.16);
      for (let i = -1; i <= 1; i += 1) {
        const yy = i * h * 0.12;
        ctx.moveTo(-w * 0.18, yy); ctx.lineTo(-w * 0.10, yy);
        ctx.moveTo(w * 0.10, yy); ctx.lineTo(w * 0.18, yy);
      }
      ctx.moveTo(-w * 0.28, -h * 0.04); ctx.lineTo(-w * 0.18, -h * 0.04);
      ctx.moveTo(w * 0.18, h * 0.04); ctx.lineTo(w * 0.28, h * 0.04);
      ctx.moveTo(0, -h * 0.22); ctx.lineTo(0, -h * 0.08);
      ctx.moveTo(0, h * 0.08); ctx.lineTo(0, h * 0.22);
    } else if (isPress) {

      ctx.fillStyle = 'rgba(66, 74, 82, .28)';
      ctx.fillRect(-w * 0.24, -h * 0.30, w * 0.48, h * 0.12);
      ctx.fillRect(-w * 0.20, h * 0.14, w * 0.40, h * 0.12);
      ctx.strokeStyle = 'rgba(220,232,242,.82)';
      ctx.beginPath();
      ctx.rect(-w * 0.24, -h * 0.30, w * 0.48, h * 0.12);
      ctx.rect(-w * 0.20, h * 0.14, w * 0.40, h * 0.12);
      ctx.moveTo(-w * 0.14, -h * 0.18); ctx.lineTo(-w * 0.14, h * 0.14);
      ctx.moveTo(w * 0.14, -h * 0.18); ctx.lineTo(w * 0.14, h * 0.14);
      ctx.moveTo(0, -h * 0.18); ctx.lineTo(0, h * 0.04);
      ctx.moveTo(-w * 0.10, h * 0.04); ctx.lineTo(w * 0.10, h * 0.04);
    } else {
      ctx.moveTo(-w * 0.34, -h * 0.22);
      ctx.lineTo(0, -h * 0.40);
      ctx.lineTo(w * 0.34, -h * 0.22);
      ctx.lineTo(w * 0.34, h * 0.24);
      ctx.lineTo(0, h * 0.42);
      ctx.lineTo(-w * 0.34, h * 0.24);
      ctx.closePath();
      ctx.moveTo(-w * 0.34, -h * 0.22);
      ctx.lineTo(0, 0);
      ctx.lineTo(w * 0.34, -h * 0.22);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, h * 0.42);
    }
    ctx.stroke();
    if (isConveyor || isRobotArm) {
      drawAutomationItem(ctx, view, s, w, h, t);
    }
  }
  ctx.restore();
  drawStructureBar(ctx, view, s, p.x, p.y);
  if (s.energy && (s.type === 'base_core' || s.type === 'solar_panel' || s.type === 'fuel_generator')) {
    const label = s.type === 'base_core'
      ? `${Math.round(Number(s.energy.production) || 0)} / ${Math.round(Number(s.energy.consumption) || 0)} ⚡`
      : `${Math.round(Number(s.energy.output) || 0)} ⚡`;
    ctx.save();
    ctx.font = `${10 * view.dpr}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(225,245,255,.82)';
    ctx.fillText(label, p.x, p.y + ((s.h || s.radius * 2 || 80) * 0.5 + 18) * view.dpr);
    ctx.restore();
  }
}

export function drawStructureBuildPreview(ctx, view, preview, camX, camY, t = 0) {
  if (!preview) return;
  drawBuildGrid(ctx, view, camX, camY, preview.gridSize || 64);
  const p = worldToScreen(view, preview.x || 0, preview.y || 0, camX, camY);
  const w = (preview.w || preview.radius * 2 || 80) * view.dpr;
  const h = (preview.h || preview.radius * 2 || 80) * view.dpr;
  const ok = !!preview.ok;
  const demolish = preview.mode === 'demolish';
  const repair = preview.mode === 'repair';
  const main = demolish
    ? (ok ? 'rgba(255, 120, 120, 0.16)' : 'rgba(255, 92, 92, 0.08)')
    : repair
      ? (ok ? 'rgba(255, 210, 94, 0.18)' : 'rgba(255, 92, 92, 0.08)')
      : (ok ? 'rgba(101, 241, 200, 0.22)' : 'rgba(255, 92, 92, 0.20)');
  const edge = demolish
    ? 'rgba(255, 124, 124, 0.95)'
    : repair
      ? (ok ? 'rgba(255, 218, 112, 0.95)' : 'rgba(255, 112, 112, 0.95)')
      : (ok ? 'rgba(117, 255, 215, 0.92)' : 'rgba(255, 112, 112, 0.95)');
  const pulse = 0.55 + 0.45 * Math.sin(t * 5.2);

  const claim = preview.type === 'base_core'
    ? { x: preview.x, y: preview.y, half: preview.claimRadius || 0 }
    : preview.ownCore ? { x: preview.ownCore.x, y: preview.ownCore.y, half: preview.ownCore.claimRadius || 0 } : null;
  if (claim?.half) {
    const cp = worldToScreen(view, claim.x, claim.y, camX, camY);
    const size = claim.half * 2 * view.dpr;
    ctx.save();
    ctx.fillStyle = ok ? 'rgba(75, 244, 202, 0.045)' : 'rgba(255, 86, 86, 0.035)';
    ctx.strokeStyle = ok ? 'rgba(92, 255, 214, 0.34)' : 'rgba(255, 104, 104, 0.28)';
    ctx.lineWidth = 1.2 * view.dpr;
    ctx.setLineDash([18 * view.dpr, 12 * view.dpr]);
    ctx.fillRect(cp.x - size * 0.5, cp.y - size * 0.5, size, size);
    ctx.strokeRect(cp.x - size * 0.5, cp.y - size * 0.5, size, size);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = edge;
  ctx.shadowBlur = (demolish || repair ? 4 : 6 + pulse * 7) * view.dpr;
  ctx.fillStyle = main;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2 * view.dpr;
  ctx.setLineDash([9 * view.dpr, 6 * view.dpr]);
  const rr = Math.min(14 * view.dpr, Math.min(w, h) * 0.24);
  ctx.beginPath();
  roundedRect(ctx, -w * 0.5, -h * 0.5, w, h, rr);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  drawFootprintCells(ctx, view, w, h, preview.tilesX || 1, preview.tilesY || 1);
  if (isConveyorType(preview.type)) {
    ctx.globalAlpha *= 0.92;
    drawConveyorBody(ctx, view, preview, w, h, t, null);
    drawDirectionArrow(ctx, view, preview, w, h, true);
  } else if (isArmType(preview.type)) {
    ctx.globalAlpha *= 0.92;
    drawRobotArmBody(ctx, view, preview, w, h);
    drawDirectionArrow(ctx, view, preview, w, h, true);
  }

  if (!ok) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 130, 130, 0.95)';
    ctx.lineWidth = 3 * view.dpr;
    ctx.beginPath();
    ctx.moveTo(-w * 0.26, -h * 0.26);
    ctx.lineTo(w * 0.26, h * 0.26);
    ctx.moveTo(w * 0.26, -h * 0.26);
    ctx.lineTo(-w * 0.26, h * 0.26);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.font = `${11 * view.dpr}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const label = preview.ok ? preview.title : (preview.reason || 'Impossible');
  const tw = ctx.measureText(label).width;
  const lx = p.x;
  const ly = p.y - h * 0.5 - 10 * view.dpr;
  ctx.fillStyle = 'rgba(4, 8, 13, 0.82)';
  ctx.fillRect(lx - tw * 0.5 - 8 * view.dpr, ly - 15 * view.dpr, tw + 16 * view.dpr, 17 * view.dpr);
  ctx.strokeStyle = preview.ok ? 'rgba(117,255,215,.42)' : 'rgba(255,112,112,.5)';
  ctx.strokeRect(lx - tw * 0.5 - 8 * view.dpr, ly - 15 * view.dpr, tw + 16 * view.dpr, 17 * view.dpr);
  ctx.fillStyle = preview.ok ? 'rgba(210, 255, 240, 0.94)' : 'rgba(255, 206, 206, 0.94)';
  ctx.fillText(label, lx, ly - 2 * view.dpr);
  ctx.restore();
}
