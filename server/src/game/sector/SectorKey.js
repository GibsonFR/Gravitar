export function sectorKey(sx, sy) {
  return `${sx}|${sy}`;
}

export function parseSectorKey(key) {
  const p = String(key).split('|');
  return { sx: parseInt(p[0] ?? '0', 10) | 0, sy: parseInt(p[1] ?? '0', 10) | 0 };
}
