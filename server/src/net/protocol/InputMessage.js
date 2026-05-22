const INPUT_MIN_INTERVAL_MS = 4;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function sanitizeInputMessage(raw) {
  if (!raw || raw.t !== 'input') return null;

  const viewportW = clamp(finiteOr(raw.vw, 1280), 200, 4096);
  const viewportH = clamp(finiteOr(raw.vh, 720), 200, 4096);
  const mouseLimitX = viewportW * 2;
  const mouseLimitY = viewportH * 2;

  return {
    t: 'input',
    inputSeq: Number.isFinite(raw.inputSeq) ? Math.max(0, raw.inputSeq | 0) : 0,
    vw: viewportW,
    vh: viewportH,
    msx: clamp(finiteOr(raw.msx, viewportW * 0.5), -mouseLimitX, mouseLimitX),
    msy: clamp(finiteOr(raw.msy, viewportH * 0.5), -mouseLimitY, mouseLimitY),
    a: !!raw.a,
    z: !!raw.z,
    e: !!raw.e,
    r: !!raw.r,
    interactTap: !!raw.interactTap,
    rocketTap: !!raw.rocketTap,
    primaryClick: !!raw.primaryClick,
    primaryHold: !!raw.primaryHold,
    px: clamp(finiteOr(raw.px, viewportW * 0.5), -mouseLimitX, mouseLimitX),
    py: clamp(finiteOr(raw.py, viewportH * 0.5), -mouseLimitY, mouseLimitY),
    moveWorld: !!raw.moveWorld,
    moveWorldX: clamp(finiteOr(raw.moveWorldX, 0), -10000000, 10000000),
    moveWorldY: clamp(finiteOr(raw.moveWorldY, 0), -10000000, 10000000),
    cx: Number.isFinite(raw.cx) ? clamp(raw.cx, -10000000, 10000000) : null,
    cy: Number.isFinite(raw.cy) ? clamp(raw.cy, -10000000, 10000000) : null,
    csx: Number.isFinite(raw.csx) ? clamp(raw.csx | 0, -100000, 100000) : null,
    csy: Number.isFinite(raw.csy) ? clamp(raw.csy | 0, -100000, 100000) : null,
    cvx: Number.isFinite(raw.cvx) ? clamp(raw.cvx, -5000, 5000) : null,
    cvy: Number.isFinite(raw.cvy) ? clamp(raw.cvy, -5000, 5000) : null,
    crot: Number.isFinite(raw.crot) ? raw.crot : null,
    cthrust: Number.isFinite(raw.cthrust) ? clamp(raw.cthrust, 0, 1) : null,
    targetClick: !!raw.targetClick,
    targetClickKind: ['player', 'mob', 'asteroid', 'station', ''].includes(String(raw.targetClickKind || '')) ? String(raw.targetClickKind || '') : '',
    targetClickId: Number.isFinite(raw.targetClickId) ? Math.max(0, raw.targetClickId | 0) : 0,
    selectSeq: Number.isFinite(raw.selectSeq) ? Math.max(0, raw.selectSeq | 0) : 0,
    selectedKind: ['player', 'mob', 'asteroid', 'station', ''].includes(String(raw.selectedKind || '')) ? String(raw.selectedKind || '') : '',
    selectedId: Number.isFinite(raw.selectedId) ? Math.max(0, raw.selectedId | 0) : 0,
    aimWorldX: Number.isFinite(raw.aimWorldX) ? clamp(raw.aimWorldX, -10000000, 10000000) : null,
    aimWorldY: Number.isFinite(raw.aimWorldY) ? clamp(raw.aimWorldY, -10000000, 10000000) : null,
    localMoveX: Number.isFinite(raw.localMoveX) ? clamp(raw.localMoveX, -10000000, 10000000) : null,
    localMoveY: Number.isFinite(raw.localMoveY) ? clamp(raw.localMoveY, -10000000, 10000000) : null,
    clientTime: Number.isFinite(raw.clientTime) ? raw.clientTime : 0,
    sectorSeq: Number.isFinite(raw.sectorSeq) ? Math.max(0, raw.sectorSeq | 0) : 0,
    abilitySeq: Number.isFinite(raw.abilitySeq) ? Math.max(0, raw.abilitySeq | 0) : 0
  };
}

export function canAcceptInput(player, timeMs) {
  if (!player) return false;
  const net = player.net ?? (player.net = {
    lastAcceptedInputAt: timeMs - 1000,
    lastAcceptedCommandAt: timeMs - 1000,
    droppedInputCount: 0,
    droppedCommandCount: 0
  });
  if (!Number.isFinite(net.lastAcceptedInputAt)) net.lastAcceptedInputAt = timeMs - INPUT_MIN_INTERVAL_MS;
  if ((timeMs - (net.lastAcceptedInputAt | 0)) < INPUT_MIN_INTERVAL_MS) {
    net.droppedInputCount = (net.droppedInputCount | 0) + 1;
    return false;
  }
  net.lastAcceptedInputAt = timeMs;
  return true;
}
