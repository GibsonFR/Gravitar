// Signature used to persist asteroid cooldown across sector unload/reload.

export function asteroidKey(sx, sy, x, y, resourceKey, yieldValue, secret) {
  const px = Math.round(x) | 0;
  const py = Math.round(y) | 0;
  const r = hashString(resourceKey);
  const s = secret ? 1 : 0;
  let h = 17;
  h = (h * 31 + (sx | 0)) | 0;
  h = (h * 31 + (sy | 0)) | 0;
  h = (h * 31 + px) | 0;
  h = (h * 31 + py) | 0;
  h = (h * 31 + r) | 0;
  h = (h * 31 + (yieldValue | 0)) | 0;
  h = (h * 31 + s) | 0;
  return `${sx}|${sy}|${h}`;
}

function hashString(s) {
  // Stable small hash for resource keys.
  s = String(s);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) | 0;
  return h | 0;
}
