export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }

export function norm(x, y) {
  const l = Math.hypot(x, y);
  return l < 1e-6 ? { x: 0, y: 0, l: 0 } : { x: x / l, y: y / l, l };
}

export function rgba(r, g, b, a = 1) {
  return `rgba(${r | 0},${g | 0},${b | 0},${clamp(a, 0, 1)})`;
}

export function distSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function polar(cx, cy, r, a) {
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
}

export function worldToScreen(camX, camY, x, y, cssW, cssH) {
  return { x: (x - camX) + cssW * 0.5, y: (y - camY) + cssH * 0.5 };
}
