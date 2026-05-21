export function asteroidPoints(a, screen) {
  const points = 6 + (a.shapeSeed % 5);
  const innerMul = 0.58 + ((a.shapeSeed * 17) % 23) / 100;
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const ang = a.rot + i * Math.PI / points;
    const outer = i % 2 === 0;
    const jitter = 0.88 + 0.16 * Math.sin(a.rot * (1.2 + 0.13 * a.shapeSeed) + i * 0.9);
    const rr = a.radius * (outer ? 1 : innerMul) * jitter;
    pts.push({ x: screen.x + Math.cos(ang) * rr, y: screen.y + Math.sin(ang) * rr });
  }
  return pts;
}
