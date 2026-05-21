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
    this.localPrediction = {
      hasMoveTarget: false,
      moveX: 0,
      moveY: 0,
      hold: false,
      selectedKind: '',
      selectedId: 0,
      selectedAt: 0,
      moveAt: 0,
      localDamage: new Map()
    };
  }

  _mergeEntity(previous, next, options = {}) {
    if (!previous) return { ...next };
    if (options.preserveLocalPosition) {
      const sectorChanged = ((previous.sx | 0) !== (next.sx | 0)) || ((previous.sy | 0) !== (next.sy | 0));
      const merged = { ...previous, ...next };
      if (sectorChanged || previous._forceServerPose) {
        if (Number.isFinite(next.x) && Number.isFinite(next.y)) {
          merged.x = next.x;
          merged.y = next.y;
          merged.vx = Number.isFinite(next.vx) ? next.vx : 0;
          merged.vy = Number.isFinite(next.vy) ? next.vy : 0;
          merged._tx = next.x;
          merged._ty = next.y;
        }
        merged._forceServerPose = false;
        return merged;
      }
      // Pour le joueur local, les snapshots sont forcément en retard réseau.
      // On synchronise les PV/stats/etc., mais on ne rembobine plus x/y/vx/vy.
      merged.x = previous.x;
      merged.y = previous.y;
      merged.vx = previous.vx;
      merged.vy = previous.vy;
      const now = performance.now();
      if (now - (this.localPrediction.moveAt || 0) < 1400) {
        merged.groundMarkerX = previous.groundMarkerX;
        merged.groundMarkerY = previous.groundMarkerY;
        merged.groundMarkerTimer = previous.groundMarkerTimer;
      }
      merged._serverX = next.x;
      merged._serverY = next.y;
      merged._tx = previous.x;
      merged._ty = previous.y;
      merged._snapDistanceSq = 0;
      return this._applyLocalDamageToEntity(merged);
    }
    const merged = { ...previous, ...next };
    if (options.snapPosition) {
      if (Number.isFinite(next.x) && Number.isFinite(next.y)) {
        merged.x = next.x;
        merged.y = next.y;
        merged._tx = next.x;
        merged._ty = next.y;
        merged._snapDistanceSq = 0;
      }
      return merged;
    }
    if (Number.isFinite(next.x) && Number.isFinite(next.y)) {
      const px = Number.isFinite(previous.x) ? previous.x : next.x;
      const py = Number.isFinite(previous.y) ? previous.y : next.y;
      const dx = next.x - px;
      const dy = next.y - py;
      merged._serverX = next.x;
      merged._serverY = next.y;
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
    return this._applyLocalDamageToEntity(merged);
  }

  _entityDamageKey(entity) {
    if (!entity) return '';
    const kind = entity.kind || entity.type || (entity.mobId ? 'mob' : '');
    return `${kind}:${entity.id}`;
  }

  _applyLocalDamageToEntity(entity) {
    if (!entity?.vitals) return entity;
    const now = performance.now();
    const candidates = [
      `${entity.kind || ''}:${entity.id}`,
      `mob:${entity.id}`,
      `asteroid:${entity.id}`,
      `player:${entity.id}`
    ];
    let best = null;
    for (const key of candidates) {
      const entry = this.localPrediction.localDamage.get(key);
      if (!entry) continue;
      if (now > entry.until) {
        this.localPrediction.localDamage.delete(key);
        continue;
      }
      if (!best || entry.hp < best.hp) best = entry;
    }
    if (!best) return entity;
    entity.vitals = { ...entity.vitals, hp: Math.min(entity.vitals.hp ?? best.hp, best.hp) };
    return entity;
  }

  applyLocalDamage(kind, id, amount, x = null, y = null) {
    if (!kind || !id || !Number.isFinite(amount) || amount <= 0) return;
    let map = null;
    if (kind === 'mob') map = this.mobs;
    else if (kind === 'asteroid') map = this.asteroids;
    else if (kind === 'player') map = this.players;
    if (!map) return;
    const entity = map.get(id);
    if (!entity?.vitals) return;
    const hp = Math.max(0, (entity.vitals.hp ?? 0) - amount);
    entity.vitals = { ...entity.vitals, hp };
    this.localPrediction.localDamage.set(`${kind}:${id}`, { hp, until: performance.now() + 650 });
    this.pendingCombatFx.push({
      type: 'damage',
      amount: Math.max(1, Math.round(amount)),
      x: Number.isFinite(x) ? x : entity.x,
      y: Number.isFinite(y) ? y : entity.y,
      targetId: id,
      crit: false,
      shielded: false,
      periodic: false
    });
  }

  _syncMap(map, arr, options = {}) {
    const seen = new Set();
    for (const item of arr) {
      seen.add(item.id);
      const isOwn = item.id === this.myId;
      const snapPosition = options.snapOwnPlayer && isOwn;
      const preserveLocalPosition = options.preserveOwnPlayerPosition && isOwn;
      map.set(item.id, this._mergeEntity(map.get(item.id), item, { snapPosition, preserveLocalPosition }));
    }
    for (const id of map.keys()) {
      const item = map.get(id);
      if (!seen.has(id) && !item?.localOnly) map.delete(id);
    }
  }

  _mergeAbilityHudWithCooldowns(abilityHud, cooldowns) {
    if (!abilityHud || !cooldowns) return abilityHud;
    const out = { ...abilityHud };
    for (const slot of ['A', 'Z', 'E', 'R']) {
      if (!out[slot] || !Number.isFinite(cooldowns[slot])) continue;
      out[slot] = { ...out[slot], cooldownLeft: Math.max(0, cooldowns[slot]) };
    }
    return out;
  }

  _mergeMyState(next) {
    if (!next) return null;
    if (!next.lite || !this.myState) {
      const cooldowns = next.cooldowns || null;
      return {
        ...next,
        abilityHud: this._mergeAbilityHudWithCooldowns(next.abilityHud, cooldowns)
      };
    }
    const cooldowns = { ...(this.myState.cooldowns || {}), ...(next.cooldowns || {}) };
    return {
      ...this.myState,
      ...next,
      sessionSetup: { ...(this.myState.sessionSetup || {}), ...(next.sessionSetup || {}) },
      cooldowns,
      progression: next.progression ?? this.myState.progression,
      abilityHud: this._mergeAbilityHudWithCooldowns(next.abilityHud ?? this.myState.abilityHud, cooldowns),
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
    if (this.myState && performance.now() - (this.localPrediction.selectedAt || 0) < 10000) {
      this.myState.selectedKind = this.localPrediction.selectedKind || '';
      this.myState.selectedId = this.localPrediction.selectedId || 0;
    }
    if (msg.worldSfx?.length) this.pendingSfx.push(...msg.worldSfx);
    if (msg.combatFx?.length) this.pendingCombatFx.push(...msg.combatFx);
    if (msg.me?.sfx?.length) this.pendingSfx.push(...msg.me.sfx);
    this._syncMap(this.players, msg.players ?? [], { snapOwnPlayer: false, preserveOwnPlayerPosition: true });
    this._syncMap(this.mobs, msg.mobs ?? []);
    this._syncMap(this.asteroids, msg.asteroids ?? []);
    this._syncMap(this.stations, msg.stations ?? []);
    this._syncMap(this.portals, msg.portals ?? []);
    this._syncMap(this.projectiles, msg.projectiles ?? []);
    this._syncMap(this.areaEffects, msg.areaEffects ?? []);
    this._syncMap(this.loots, msg.loots ?? []);
  }

  _smoothMap(map, alpha, dt = 0) {
    for (const entity of map.values()) {
      if (entity.localOnly) {
        entity.x += (entity.vx || 0) * dt;
        entity.y += (entity.vy || 0) * dt;
        entity.ttl = Math.max(0, (entity.ttl ?? 0) - dt);
        if (entity.ttl <= 0) { map.delete(entity.id); continue; }
      }
      if (Number.isFinite(entity.vx) && Number.isFinite(entity.vy) && entity.id !== this.myId) {
        entity.x += entity.vx * dt;
        entity.y += entity.vy * dt;
      }
      if (!Number.isFinite(entity._tx) || !Number.isFinite(entity._ty)) continue;
      entity.x += (entity._tx - entity.x) * alpha;
      entity.y += (entity._ty - entity.y) * alpha;
    }
  }

  tickLocalUi(dt) {
    if (!this.myState || !Number.isFinite(dt) || dt <= 0) return;
    const cooldowns = this.myState.cooldowns || null;
    if (cooldowns) {
      for (const slot of ['A', 'Z', 'E', 'R']) {
        if (!Number.isFinite(cooldowns[slot])) continue;
        cooldowns[slot] = Math.max(0, cooldowns[slot] - dt);
        const hudSlot = this.myState.abilityHud?.[slot];
        if (hudSlot) hudSlot.cooldownLeft = cooldowns[slot];
      }
    }
    if (Number.isFinite(this.myState._optimisticHintLeft)) {
      this.myState._optimisticHintLeft = Math.max(0, this.myState._optimisticHintLeft - dt);
      if (this.myState._optimisticHintLeft <= 0 && this.myState.hint) this.myState.hint = '';
    }
    const me = this.getMe();
    if (me) {
      if (Number.isFinite(me.rocketCooldownLeft)) me.rocketCooldownLeft = Math.max(0, me.rocketCooldownLeft - dt);
      if (Number.isFinite(me.groundMarkerTimer)) me.groundMarkerTimer = Math.max(0, me.groundMarkerTimer - dt);
    }
  }

  setOptimisticSelection(kind, id) {
    if (!this.myState) return;
    this.myState.selectedKind = kind || '';
    this.myState.selectedId = id || 0;
    this.localPrediction.selectedKind = kind || '';
    this.localPrediction.selectedId = id || 0;
    this.localPrediction.selectedAt = performance.now();
    if (kind && id) {
      this.localPrediction.hasMoveTarget = false;
      this.localPrediction.hold = false;
    }
  }

  setOptimisticMoveTarget(x, y, options = {}) {
    const me = this.getMe();
    if (!me) return;
    this.localPrediction.hasMoveTarget = true;
    this.localPrediction.moveX = x;
    this.localPrediction.moveY = y;
    this.localPrediction.hold = !!options.fromHold;
    this.localPrediction.moveAt = performance.now();
    this.localPrediction.selectedKind = '';
    this.localPrediction.selectedId = 0;
    me.groundMarkerX = x;
    me.groundMarkerY = y;
    me.groundMarkerTimer = 0.85;
  }

  interpolate(dt) {
    const dynamicAlpha = Math.max(0.05, Math.min(1, 1 - Math.exp(-22 * Math.max(0, dt))));
    const fastAlpha = Math.max(0.08, Math.min(1, 1 - Math.exp(-32 * Math.max(0, dt))));
    this._smoothMap(this.players, dynamicAlpha, dt);
    this._smoothMap(this.mobs, dynamicAlpha, dt);
    this._smoothMap(this.projectiles, fastAlpha, dt);
    this._smoothMap(this.areaEffects, fastAlpha, dt);
    this._smoothMap(this.loots, fastAlpha, dt);
    this.tickLocalUi(dt);
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
