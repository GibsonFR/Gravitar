export const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

const SESSION_SEED = Math.floor((Date.now() ^ (Math.random() * 0x7fffffff)) & 0x7fffffff);

export const WORLD_SEED = process.env.SEED ? (Number(process.env.SEED) | 0) : SESSION_SEED;

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav'
};
