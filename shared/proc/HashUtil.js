export function hash2D_Mix(seed, x, y) {
  let h = seed | 0;
  h = Math.imul(h, 397) ^ (x | 0);
  h = Math.imul(h, 397) ^ (y | 0);
  h ^= ((x | 0) << 7) ^ ((y | 0) >> 3);
  h = Math.imul(h, 486187739);
  return h | 0;
}

export function hash2D_XorShift(seed, x, y) {
  let h = seed | 0;
  h = (Math.imul(h, 397) ^ (x | 0)) | 0;
  h = (Math.imul(h, 397) ^ (y | 0)) | 0;
  h ^= (h << 13);
  h ^= (h >> 17);
  h ^= (h << 5);
  return h | 0;
}
