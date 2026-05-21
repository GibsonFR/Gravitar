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

  _syncMap(map, arr) {
    map.clear();
    for (const item of arr) map.set(item.id, item);
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
    this.myState = msg.me ?? null;
    if (msg.worldSfx?.length) this.pendingSfx.push(...msg.worldSfx);
    if (msg.combatFx?.length) this.pendingCombatFx.push(...msg.combatFx);
    if (this.myState?.sfx?.length) this.pendingSfx.push(...this.myState.sfx);
    this._syncMap(this.players, msg.players ?? []);
    this._syncMap(this.mobs, msg.mobs ?? []);
    this._syncMap(this.asteroids, msg.asteroids ?? []);
    this._syncMap(this.stations, msg.stations ?? []);
    this._syncMap(this.portals, msg.portals ?? []);
    this._syncMap(this.projectiles, msg.projectiles ?? []);
    this._syncMap(this.areaEffects, msg.areaEffects ?? []);
    this._syncMap(this.loots, msg.loots ?? []);
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
