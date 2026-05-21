export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export function distSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

export function norm(x, y) {
  const l = Math.hypot(x, y);
  return l < 1e-6 ? { x: 0, y: 0, l: 0 } : { x: x / l, y: y / l, l };
}

export function randRange(a, b) { return a + Math.random() * (b - a); }

export function rollSpawnAround(rMin, rMax) {
  const a = Math.random() * Math.PI * 2;
  const r = randRange(rMin, rMax);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

export function screenToWorld(p, sx, sy) {
  return { x: p.x + (sx - p.viewportW * 0.5), y: p.y + (sy - p.viewportH * 0.5) };
}
