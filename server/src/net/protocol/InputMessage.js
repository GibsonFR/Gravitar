const INPUT_MIN_INTERVAL_MS = 16;

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
    moveWorldY: clamp(finiteOr(raw.moveWorldY, 0), -10000000, 10000000)
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
