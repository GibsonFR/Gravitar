function finite(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function cloneSample(entity, serverTimeMs) {
  return {
    serverTimeMs: finite(serverTimeMs, 0),
    id: entity.id,
    kind: entity.kind || entity.type || '',
    sx: entity.sx | 0,
    sy: entity.sy | 0,
    x: finite(entity.x, 0),
    y: finite(entity.y, 0),
    vx: finite(entity.vx, 0),
    vy: finite(entity.vy, 0),
    rot: Number.isFinite(Number(entity.rot)) ? Number(entity.rot) : null,
    raw: entity
  };
}

function sampleEntity(a, b, t) {
  const raw = { ...(b.raw || b) };
  raw.sx = b.sx;
  raw.sy = b.sy;
  raw.x = lerp(a.x, b.x, t);
  raw.y = lerp(a.y, b.y, t);
  raw.vx = lerp(a.vx, b.vx, t);
  raw.vy = lerp(a.vy, b.vy, t);
  if (Number.isFinite(a.rot) && Number.isFinite(b.rot)) raw.rot = angleLerp(a.rot, b.rot, t);
  return raw;
}

export class EntityInterpolationStore {
  constructor(options = {}) {
    this.maxSamples = Math.max(2, options.maxSamples || 8);
    this.maxAgeMs = Math.max(250, options.maxAgeMs || 1600);
    this.maps = new Map();
    this.lastPushAt = 0;
    this.pushCount = 0;
  }

  key(kind, id) {
    return `${kind}:${id}`;
  }

  clear() {
    this.maps.clear();
  }

  push(kind, entity, serverTimeMs) {
    if (!entity || !entity.id || !Number.isFinite(Number(entity.x)) || !Number.isFinite(Number(entity.y))) return;
    const key = this.key(kind, entity.id);
    let arr = this.maps.get(key);
    if (!arr) {
      arr = [];
      this.maps.set(key, arr);
    }
    const sample = cloneSample({ ...entity, kind }, serverTimeMs);
    const last = arr[arr.length - 1];
    if (last && sample.serverTimeMs <= last.serverTimeMs) {
      if (sample.serverTimeMs === last.serverTimeMs) arr[arr.length - 1] = sample;
      return;
    }
    arr.push(sample);
    while (arr.length > this.maxSamples) arr.shift();
    const cutoff = serverTimeMs - this.maxAgeMs;
    while (arr.length > 2 && arr[0].serverTimeMs < cutoff) arr.shift();
    this.lastPushAt = performance.now();
    this.pushCount += 1;
  }

  pushMany(kind, arr, serverTimeMs) {
    if (!Array.isArray(arr)) return;
    for (const entity of arr) this.push(kind, entity, serverTimeMs);
  }

  getSampleCount(kind = '') {
    let count = 0;
    const prefix = kind ? `${kind}:` : '';
    for (const [key, arr] of this.maps.entries()) {
      if (!prefix || key.startsWith(prefix)) count += arr.length;
    }
    return count;
  }

  sample(kind, id, renderServerTimeMs, options = {}) {
    const arr = this.maps.get(this.key(kind, id));
    if (!arr?.length) return null;
    if (arr.length === 1) return { ...(arr[0].raw || arr[0]) };

    const tServer = finite(renderServerTimeMs, 0);
    let older = null;
    let newer = null;
    for (let i = 0; i < arr.length; i += 1) {
      const s = arr[i];
      if (s.serverTimeMs <= tServer) older = s;
      if (s.serverTimeMs >= tServer) {
        newer = s;
        break;
      }
    }

    if (older && newer && older !== newer) {
      const span = Math.max(1, newer.serverTimeMs - older.serverTimeMs);
      return sampleEntity(older, newer, Math.max(0, Math.min(1, (tServer - older.serverTimeMs) / span)));
    }

    const allowExtrapolation = options.extrapolate !== false;
    const maxExtrapolateMs = Math.max(0, options.maxExtrapolateMs ?? 90);
    const last = arr[arr.length - 1];
    const prev = arr[arr.length - 2] || last;
    if (allowExtrapolation && tServer > last.serverTimeMs && tServer - last.serverTimeMs <= maxExtrapolateMs) {
      const dt = (tServer - last.serverTimeMs) / 1000;
      const raw = { ...(last.raw || last) };
      raw.x = last.x + last.vx * dt;
      raw.y = last.y + last.vy * dt;
      if (Number.isFinite(last.rot)) raw.rot = last.rot;
      return raw;
    }

    if (tServer <= arr[0].serverTimeMs) return { ...(arr[0].raw || arr[0]) };
    return { ...(last.raw || last), _interpolationLateMs: Math.max(0, tServer - last.serverTimeMs), _interpolationPrevMs: last.serverTimeMs - prev.serverTimeMs };
  }

  stats() {
    return {
      entities: this.maps.size,
      samples: this.getSampleCount(),
      playerSamples: this.getSampleCount('player'),
      mobSamples: this.getSampleCount('mob'),
      projectileSamples: this.getSampleCount('projectile'),
      pushCount: this.pushCount,
      lastPushAgeMs: this.lastPushAt ? Math.max(0, performance.now() - this.lastPushAt) : 0
    };
  }
}
