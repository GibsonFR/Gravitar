export class WorldStore {
  constructor() {
    this.myId = 0;
    this.seed = 0;
    this.world = { halfW: 2000, halfH: 2000 };
    this.session = { durationMs: 3600000, elapsedMs: 0, remainingMs: 3600000 };
    this.modes = { currentMode: 'endless', battleSessions: [] };
    this.playerDirectory = [];
    this.myState = null;
    this.players = new Map();
    this.mobs = new Map();
    this.asteroids = new Map();
    this.stations = new Map();
    this.portals = new Map();
    this.projectiles = new Map();
    this.areaEffects = new Map();
    this.loots = new Map();
    this.pendingSfx = [];
    this.pendingCombatFx = [];
    this.lastSnapAt = 0;
  }

  _mergeEntity(previous, next) {
    if (!previous) return { ...next };
    const merged = { ...previous, ...next };
    if (Number.isFinite(next.x) && Number.isFinite(next.y)) {
      const px = Number.isFinite(previous.x) ? previous.x : next.x;
      const py = Number.isFinite(previous.y) ? previous.y : next.y;
      const dx = next.x - px;
      const dy = next.y - py;
      merged._tx = next.x;
      merged._ty = next.y;
      merged._snapDistanceSq = dx * dx + dy * dy;
      if (!Number.isFinite(previous._tx) || merged._snapDistanceSq > 900 * 900) {
        merged.x = next.x;
        merged.y = next.y;
      } else {
        merged.x = px;
        merged.y = py;
      }
    }
    return merged;
  }

  _syncMap(map, arr) {
    const seen = new Set();
    for (const item of arr) {
      seen.add(item.id);
      map.set(item.id, this._mergeEntity(map.get(item.id), item));
    }
    for (const id of map.keys()) {
      if (!seen.has(id)) map.delete(id);
    }
  }

  _mergeMyState(next) {
    if (!next) return null;
    if (!next.lite || !this.myState) return next;
    return {
      ...this.myState,
      ...next,
      sessionSetup: { ...(this.myState.sessionSetup || {}), ...(next.sessionSetup || {}) },
      cooldowns: { ...(this.myState.cooldowns || {}), ...(next.cooldowns || {}) },
      progression: next.progression ?? this.myState.progression,
      abilityHud: next.abilityHud ?? this.myState.abilityHud,
      statuses: next.statuses ?? this.myState.statuses,
      frameState: next.frameState ?? this.myState.frameState,
      derived: next.derived ?? this.myState.derived,
      bastions: next.bastions ?? this.myState.bastions,
      sfx: next.sfx ?? []
    };
  }

  applyHello(id) {
    this.myId = id;
  }

  applySnapshot(msg) {
    this.lastSnapAt = performance.now();
    this.seed = msg.seed | 0;
    this.world = msg.world ?? this.world;
    this.session = msg.session ?? this.session;
    this.modes = msg.modes ?? this.modes;
    this.playerDirectory = msg.playerDirectory ?? [];
    this.myState = this._mergeMyState(msg.me ?? null);
    if (msg.worldSfx?.length) this.pendingSfx.push(...msg.worldSfx);
    if (msg.combatFx?.length) this.pendingCombatFx.push(...msg.combatFx);
    if (msg.me?.sfx?.length) this.pendingSfx.push(...msg.me.sfx);
    this._syncMap(this.players, msg.players ?? []);
    this._syncMap(this.mobs, msg.mobs ?? []);
    this._syncMap(this.asteroids, msg.asteroids ?? []);
    this._syncMap(this.stations, msg.stations ?? []);
    this._syncMap(this.portals, msg.portals ?? []);
    this._syncMap(this.projectiles, msg.projectiles ?? []);
    this._syncMap(this.areaEffects, msg.areaEffects ?? []);
    this._syncMap(this.loots, msg.loots ?? []);
  }

  _smoothMap(map, alpha) {
    for (const entity of map.values()) {
      if (!Number.isFinite(entity._tx) || !Number.isFinite(entity._ty)) continue;
      entity.x += (entity._tx - entity.x) * alpha;
      entity.y += (entity._ty - entity.y) * alpha;
    }
  }

  interpolate(dt) {
    const dynamicAlpha = Math.max(0.05, Math.min(1, 1 - Math.exp(-22 * Math.max(0, dt))));
    const fastAlpha = Math.max(0.08, Math.min(1, 1 - Math.exp(-32 * Math.max(0, dt))));
    this._smoothMap(this.players, dynamicAlpha);
    this._smoothMap(this.mobs, dynamicAlpha);
    this._smoothMap(this.projectiles, fastAlpha);
    this._smoothMap(this.areaEffects, fastAlpha);
    this._smoothMap(this.loots, fastAlpha);
  }

  consumePendingSfx() {
    if (!this.pendingSfx.length) return [];
    const out = this.pendingSfx;
    this.pendingSfx = [];
    return out;
  }

  consumePendingCombatFx() {
    if (!this.pendingCombatFx.length) return [];
    const out = this.pendingCombatFx;
    this.pendingCombatFx = [];
    return out;
  }

  getMe() {
    return this.players.get(this.myId) ?? null;
  }
}
