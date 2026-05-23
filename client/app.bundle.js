// client/src/core/CanvasView.js
var CanvasView = class {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.dpr = 1;
    this.renderScale = 1;
    this.w = 0;
    this.h = 0;
    this.cssW = 0;
    this.cssH = 0;
    this._resize = this._resize.bind(this);
    new ResizeObserver(this._resize).observe(canvas);
    this._resize();
  }
  setRenderScale(value) {
    this.renderScale = Math.max(0.6, Math.min(1, Number(value) || 1));
    this._resize();
  }
  _resize() {
    this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1)) * this.renderScale;
    this.cssW = Math.floor(this.canvas.clientWidth);
    this.cssH = Math.floor(this.canvas.clientHeight);
    this.w = Math.floor(this.cssW * this.dpr);
    this.h = Math.floor(this.cssH * this.dpr);
    this.canvas.width = this.w;
    this.canvas.height = this.h;
  }
};

// client/src/state/WorldStore.js
var WorldStore = class {
  constructor() {
    this.myId = 0;
    this.seed = 0;
    this.world = { halfW: 2e3, halfH: 2e3 };
    this.session = { durationMs: 36e5, elapsedMs: 0, remainingMs: 36e5 };
    this.modes = { currentMode: "endless", battleSessions: [] };
    this.playerDirectory = [];
    this.myState = null;
    this.players = /* @__PURE__ */ new Map();
    this.mobs = /* @__PURE__ */ new Map();
    this.asteroids = /* @__PURE__ */ new Map();
    this.stations = /* @__PURE__ */ new Map();
    this.structures = /* @__PURE__ */ new Map();
    this.portals = /* @__PURE__ */ new Map();
    this.projectiles = /* @__PURE__ */ new Map();
    this.areaEffects = /* @__PURE__ */ new Map();
    this.loots = /* @__PURE__ */ new Map();
    this.pendingSfx = [];
    this.pendingCombatFx = [];
    this.chatMessages = [];
    this.chatUnread = 0;
    this.pendingCommands = /* @__PURE__ */ new Map();
    this.pendingStationCommands = /* @__PURE__ */ new Map();
    this.stationOptimistic = { version: 0, actions: /* @__PURE__ */ new Map() };
    this.lastSnapAt = 0;
    this.localPrediction = {
      hasMoveTarget: false,
      moveX: 0,
      moveY: 0,
      hold: false,
      selectedKind: "",
      selectedId: 0,
      selectedAt: 0,
      selectedUntil: 0,
      attackKind: "",
      attackId: 0,
      attackAt: 0,
      attackUntil: 0,
      attackSeq: 0,
      moveAt: 0,
      localDamage: /* @__PURE__ */ new Map(),
      sectorTransitionAt: 0,
      sectorSx: 0,
      sectorSy: 0,
      sectorX: 0,
      sectorY: 0,
      loadingUntil: 0,
      loadingLabel: "",
      remoteTransitionId: 0,
      localCooldownLocks: {},
      localAbilityReadyAt: {},
      localAbilityLastCastAt: {},
      abilityMovementLockUntil: 0,
      localUpgradeLocks: {},
      abilitySeq: 0,
      sectorSeq: 0,
      localAbilityAuthorityUntil: 0,
      localFrameState: null,
      localDerived: null
    };
  }
  _applyLocalVitalAuthority(previous, merged, now) {
    if (!previous || !merged || now >= (previous._localVitalsUntil || 0)) return merged;
    if (!previous.vitals || !merged.vitals) return merged;
    const prevEnergy = Number(previous.vitals.energy);
    const nextEnergy = Number(merged.vitals.energy);
    if (Number.isFinite(prevEnergy) && Number.isFinite(nextEnergy) && nextEnergy > prevEnergy) {
      merged.vitals = { ...merged.vitals, energy: prevEnergy };
    }
    merged._localVitalsUntil = previous._localVitalsUntil;
    return merged;
  }
  _mergeEntity(previous, next, options = {}) {
    if (!previous) return { ...next };
    if (options.preserveLocalPosition) {
      const sectorChanged = (previous.sx | 0) !== (next.sx | 0) || (previous.sy | 0) !== (next.sy | 0);
      const merged2 = { ...previous, ...next };
      const nowPose = performance.now();
      const keepLocalPose = nowPose < (previous._keepLocalPoseUntil || 0);
      if (keepLocalPose && !previous._forceServerPose) {
        merged2.x = previous.x;
        merged2.y = previous.y;
        merged2.sx = previous.sx;
        merged2.sy = previous.sy;
        merged2.vx = previous.vx;
        merged2.vy = previous.vy;
        if (Number.isFinite(previous.rot)) merged2.rot = previous.rot;
        if (Number.isFinite(previous._localThrust)) merged2._localThrust = previous._localThrust;
        merged2._serverX = next.x;
        merged2._serverY = next.y;
        merged2._tx = previous.x;
        merged2._ty = previous.y;
        return this._applyLocalDamageToEntity(this._applyLocalVitalAuthority(previous, merged2, performance.now()));
      }
      if (sectorChanged || previous._forceServerPose) {
        const now2 = performance.now();
        const forceServerPose = !!previous._forceServerPose;
        const recentLocalSector = !forceServerPose && now2 - (this.localPrediction.sectorTransitionAt || 0) < 1500;
        const expectedSx = this.localPrediction.sectorSx | 0;
        const expectedSy = this.localPrediction.sectorSy | 0;
        const serverIsOldSector = recentLocalSector && ((next.sx | 0) !== expectedSx || (next.sy | 0) !== expectedSy);
        if (serverIsOldSector && !previous._forceServerPose) {
          merged2.x = previous.x;
          merged2.y = previous.y;
          merged2.sx = previous.sx;
          merged2.sy = previous.sy;
          merged2.vx = previous.vx;
          merged2.vy = previous.vy;
          merged2._serverX = next.x;
          merged2._serverY = next.y;
          merged2._tx = previous.x;
          merged2._ty = previous.y;
          return this._applyLocalDamageToEntity(this._applyLocalVitalAuthority(previous, merged2, performance.now()));
        }
        if (Number.isFinite(next.x) && Number.isFinite(next.y)) {
          merged2.x = recentLocalSector ? previous.x : next.x;
          merged2.y = recentLocalSector ? previous.y : next.y;
          merged2.sx = recentLocalSector ? previous.sx : next.sx;
          merged2.sy = recentLocalSector ? previous.sy : next.sy;
          merged2.vx = recentLocalSector ? previous.vx : Number.isFinite(next.vx) ? next.vx : 0;
          merged2.vy = recentLocalSector ? previous.vy : Number.isFinite(next.vy) ? next.vy : 0;
          merged2._tx = merged2.x;
          merged2._ty = merged2.y;
          if (forceServerPose) {
            this.localPrediction.hasMoveTarget = false;
            this.localPrediction.selectedKind = "";
            this.localPrediction.selectedId = 0;
          }
        }
        merged2._forceServerPose = false;
        return this._applyLocalDamageToEntity(this._applyLocalVitalAuthority(previous, merged2, performance.now()));
      }
      merged2.x = previous.x;
      merged2.y = previous.y;
      merged2.vx = previous.vx;
      merged2.vy = previous.vy;
      if (Number.isFinite(previous.rot)) merged2.rot = previous.rot;
      if (Number.isFinite(previous._localThrust)) merged2._localThrust = previous._localThrust;
      const now = performance.now();
      if (now - (this.localPrediction.moveAt || 0) < 1400) {
        merged2.groundMarkerX = previous.groundMarkerX;
        merged2.groundMarkerY = previous.groundMarkerY;
        merged2.groundMarkerTimer = previous.groundMarkerTimer;
      }
      merged2._serverX = next.x;
      merged2._serverY = next.y;
      merged2._tx = previous.x;
      merged2._ty = previous.y;
      merged2._snapDistanceSq = 0;
      return this._applyLocalDamageToEntity(this._applyLocalVitalAuthority(previous, merged2, performance.now()));
    }
    const merged = { ...previous, ...next };
    if (options.preserveLocalRotation && !Number.isFinite(next.rot) && Number.isFinite(previous.rot)) merged.rot = previous.rot;
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
    return this._applyLocalDamageToEntity(this._applyLocalVitalAuthority(previous, merged, performance.now()));
  }
  _entityDamageKey(entity) {
    if (!entity) return "";
    const kind = entity.kind || entity.type || (entity.mobId ? "mob" : "");
    return `${kind}:${entity.id}`;
  }
  _applyLocalDamageToEntity(entity) {
    if (!entity?.vitals) return entity;
    const now = performance.now();
    const candidates = [
      `${entity.kind || ""}:${entity.id}`,
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
    if (kind === "mob") map = this.mobs;
    else if (kind === "asteroid") map = this.asteroids;
    else if (kind === "player") map = this.players;
    else if (kind === "structure") map = this.structures;
    if (!map) return;
    const entity = map.get(id);
    if (!entity?.vitals) return;
    const hp = Math.max(0, (entity.vitals.hp ?? 0) - amount);
    entity.vitals = { ...entity.vitals, hp };
    this.localPrediction.localDamage.set(`${kind}:${id}`, { hp, until: performance.now() + 650 });
    this.pendingCombatFx.push({
      type: "damage",
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
    const seen = /* @__PURE__ */ new Set();
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
    const now = performance.now();
    for (const slot of ["A", "Z", "E", "R"]) {
      if (!out[slot] || !Number.isFinite(cooldowns[slot])) continue;
      const locked = now < (this.localPrediction.localCooldownLocks?.[slot] || 0);
      const localReady = this.localPrediction.localAbilityReadyAt?.[slot] || 0;
      const locallyOwnedCooldown = now < localReady + 220;
      const localLeft = this.myState?.cooldowns?.[slot];
      const localHudLeft = this.myState?.abilityHud?.[slot]?.cooldownLeft;
      if ((locked || locallyOwnedCooldown) && (Number.isFinite(localLeft) || Number.isFinite(localHudLeft))) {
        out[slot] = { ...out[slot], cooldownLeft: Math.max(0, Number.isFinite(localLeft) ? localLeft : localHudLeft) };
      } else {
        out[slot] = { ...out[slot], cooldownLeft: Math.max(0, cooldowns[slot]) };
      }
    }
    return out;
  }
  _applyLocalAbilityAuthority(myState) {
    if (!myState) return myState;
    const now = performance.now();
    if (now >= (this.localPrediction.localAbilityAuthorityUntil || 0)) return myState;
    const out = { ...myState };
    if (this.localPrediction.localFrameState) {
      out.frameState = { ...out.frameState || {}, ...this.localPrediction.localFrameState || {} };
    }
    if (this.localPrediction.localDerived) {
      out.derived = { ...out.derived || {} };
      if (Number.isFinite(this.localPrediction.localDerived.moveSpeed)) {
        out.derived.moveSpeed = Math.max(Number(out.derived.moveSpeed) || 0, Number(this.localPrediction.localDerived.moveSpeed) || 0);
      }
    }
    return out;
  }
  _mergeMyState(next) {
    if (!next) return null;
    if (!next.lite || !this.myState) {
      const now2 = performance.now();
      const cooldowns2 = { ...next.cooldowns || {} };
      for (const slot of ["A", "Z", "E", "R"]) {
        const localReady = this.localPrediction.localAbilityReadyAt?.[slot] || 0;
        if ((now2 < (this.localPrediction.localCooldownLocks?.[slot] || 0) || now2 < localReady + 220) && Number.isFinite(this.myState.cooldowns?.[slot])) {
          cooldowns2[slot] = this.myState.cooldowns[slot];
        }
      }
      const merged = {
        ...next,
        cooldowns: cooldowns2,
        abilityHud: this._mergeAbilityHudWithCooldowns(next.abilityHud, cooldowns2)
      };
      for (const slot of ["A", "Z", "E", "R"]) {
        if (now2 < (this.localPrediction.localUpgradeLocks?.[slot] || 0) && this.myState.abilityHud?.[slot] && merged.abilityHud?.[slot]) {
          merged.abilityHud[slot] = { ...merged.abilityHud[slot], ...this.myState.abilityHud[slot] };
        }
      }
      if (now2 < Math.max(...Object.values(this.localPrediction.localUpgradeLocks || { none: 0 }))) {
        merged.progression = this.myState.progression ?? merged.progression;
      }
      return this._applyLocalAbilityAuthority(merged);
    }
    const now = performance.now();
    const cooldowns = { ...this.myState.cooldowns || {}, ...next.cooldowns || {} };
    for (const slot of ["A", "Z", "E", "R"]) {
      if (now < (this.localPrediction.localCooldownLocks?.[slot] || 0) && Number.isFinite(this.myState.cooldowns?.[slot])) {
        cooldowns[slot] = this.myState.cooldowns[slot];
      }
    }
    const mergedLite = {
      ...this.myState,
      ...next,
      sessionSetup: { ...this.myState.sessionSetup || {}, ...next.sessionSetup || {} },
      cooldowns,
      progression: next.progression ?? this.myState.progression,
      abilityHud: this._mergeAbilityHudWithCooldowns(next.abilityHud ?? this.myState.abilityHud, cooldowns),
      statuses: next.statuses ?? this.myState.statuses,
      frameState: next.frameState ?? this.myState.frameState,
      derived: next.derived ?? this.myState.derived,
      bastions: next.bastions ?? this.myState.bastions,
      sfx: next.sfx ?? []
    };
    return this._applyLocalAbilityAuthority(mergedLite);
  }
  applyChatMessage(msg) {
    if (!msg || !msg.text) return;
    const clean = {
      id: msg.id || `${Date.now()}-${Math.random()}`,
      fromId: msg.fromId | 0,
      name: String(msg.name || "Pilote").slice(0, 24),
      text: String(msg.text || "").slice(0, 220),
      time: Number.isFinite(msg.time) ? msg.time : Date.now()
    };
    this.chatMessages.push(clean);
    if (this.chatMessages.length > 80) this.chatMessages.splice(0, this.chatMessages.length - 80);
    this.chatUnread += 1;
  }
  clearChatUnread() {
    this.chatUnread = 0;
  }
  applyHello(id) {
    this.myId = id;
  }
  applyCombatFxEvents(events) {
    if (!Array.isArray(events) || !events.length) return;
    for (const ev of events) {
      if (ev?.type !== "structure_state") continue;
      const id = ev.structureId | 0 || ev.targetId | 0;
      if (!id) continue;
      const st = this.structures.get(id);
      if (ev.reason === "destroyed") {
        if (st?.vitals) st.vitals = { ...st.vitals, hp: 0, maxHp: ev.maxHp ?? st.vitals.maxHp ?? 0 };
        this.structures.delete(id);
        continue;
      }
      if (!st) continue;
      st.vitals = { ...st.vitals || {}, hp: Math.max(0, ev.hp | 0), maxHp: Math.max(0, ev.maxHp | 0) };
      st.damageable = ev.damageable !== false;
    }
  }
  applySnapshot(msg) {
    this.lastSnapAt = performance.now();
    this.seed = msg.seed | 0;
    this.world = msg.world ?? this.world;
    this.session = msg.session ?? this.session;
    this.modes = msg.modes ?? this.modes;
    this.playerDirectory = msg.playerDirectory ?? [];
    this.myState = this._mergeMyState(msg.me ?? null);
    const transition = this.myState?.transition || null;
    if (transition) {
      const base = transition.type === "sector" ? 220 : 450;
      this.beginPortalLoading(transition.label || "Chargement du secteur\u2026", Math.max(base, (transition.until || msg.time || 0) - (msg.time || 0) + 90), transition.id | 0);
      const me = this.players.get(this.myId);
      if (me && transition.forceServerPose) me._forceServerPose = true;
    }
    if (this.myState && performance.now() < (this.localPrediction.selectedUntil || 0)) {
      this.myState.selectedKind = this.localPrediction.selectedKind || "";
      this.myState.selectedId = this.localPrediction.selectedId || 0;
    }
    if (msg.worldSfx?.length) this.pendingSfx.push(...msg.worldSfx);
    if (msg.combatFx?.length) {
      this.applyCombatFxEvents(msg.combatFx);
      this.pendingCombatFx.push(...msg.combatFx.filter((fx) => fx?.type !== "structure_state"));
    }
    if (msg.me?.sfx?.length) this.pendingSfx.push(...msg.me.sfx);
    if (Array.isArray(msg.players)) this._syncMap(this.players, msg.players, { snapOwnPlayer: false, preserveOwnPlayerPosition: true });
    if (Array.isArray(msg.mobs)) this._syncMap(this.mobs, msg.mobs);
    if (Array.isArray(msg.asteroids)) this._syncMap(this.asteroids, msg.asteroids, { preserveLocalRotation: true });
    if (Array.isArray(msg.stations)) this._syncMap(this.stations, msg.stations);
    if (Array.isArray(msg.structures)) this._syncMap(this.structures, msg.structures);
    if (Array.isArray(msg.portals)) this._syncMap(this.portals, msg.portals);
    if (Array.isArray(msg.projectiles)) this._syncMap(this.projectiles, msg.projectiles);
    if (Array.isArray(msg.areaEffects)) this._syncMap(this.areaEffects, msg.areaEffects);
    if (Array.isArray(msg.loots)) this._syncMap(this.loots, msg.loots);
  }
  _getEntityByKind(kind, id) {
    if (!kind || !id) return null;
    if (kind === "player") return this.players.get(id) || null;
    if (kind === "mob") return this.mobs.get(id) || null;
    if (kind === "asteroid") return this.asteroids.get(id) || null;
    if (kind === "station") return this.stations.get(id) || null;
    return null;
  }
  _distancePointToSegmentSq(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const lenSq = abx * abx + aby * aby;
    if (lenSq <= 1e-6) {
      const dx2 = px - bx;
      const dy2 = py - by;
      return dx2 * dx2 + dy2 * dy2;
    }
    const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
    const x = ax + abx * t;
    const y = ay + aby * t;
    const dx = px - x;
    const dy = py - y;
    return dx * dx + dy * dy;
  }
  _spawnLocalImpact(projectile2, target) {
    const x = Number.isFinite(target?.x) ? target.x : projectile2.x;
    const y = Number.isFinite(target?.y) ? target.y : projectile2.y;
    this.pendingCombatFx.push({
      type: "impact",
      x,
      y,
      targetId: target?.id ?? 0,
      visualKind: projectile2.visualKind || "auto",
      sourceSlot: projectile2.sourceAbilitySlot || "",
      localOnly: true
    });
  }
  _updateLocalProjectile(projectile2, dt) {
    const oldX = projectile2.x;
    const oldY = projectile2.y;
    projectile2.x += (projectile2.vx || 0) * dt;
    projectile2.y += (projectile2.vy || 0) * dt;
    projectile2.ttl = Math.max(0, (projectile2.ttl ?? 0) - dt);
    const target = this._getEntityByKind(projectile2._targetKind, projectile2._targetId);
    if (target && (target.sx | 0) === (projectile2.sx | 0) && (target.sy | 0) === (projectile2.sy | 0)) {
      const r = Math.max(projectile2._impactRadius || 0, (projectile2.radius || 3) + (target.radius || 18) + 10);
      const d2 = this._distancePointToSegmentSq(target.x, target.y, oldX, oldY, projectile2.x, projectile2.y);
      if (d2 <= r * r) {
        projectile2.x = target.x;
        projectile2.y = target.y;
        if (!projectile2._impactApplied && !projectile2._visualOnly && projectile2._impactDamage > 0 && projectile2._targetKind !== "station") {
          this.applyLocalDamage(projectile2._targetKind, projectile2._targetId, projectile2._impactDamage, target.x, target.y);
          projectile2._impactApplied = true;
        }
        this._spawnLocalImpact(projectile2, target);
        return false;
      }
      const speed = Math.max(1, Math.hypot(projectile2.vx || 0, projectile2.vy || 0));
      const desiredX = target.x - projectile2.x;
      const desiredY = target.y - projectile2.y;
      const desiredLen = Math.hypot(desiredX, desiredY);
      if (desiredLen > 1e-3) {
        const blend = Math.min(0.35, Math.max(0.04, dt * 7));
        const nvx = (projectile2.vx || 0) * (1 - blend) + desiredX / desiredLen * speed * blend;
        const nvy = (projectile2.vy || 0) * (1 - blend) + desiredY / desiredLen * speed * blend;
        projectile2.vx = nvx;
        projectile2.vy = nvy;
      }
    }
    return projectile2.ttl > 0;
  }
  _smoothMap(map, alpha, dt = 0) {
    for (const entity of [...map.values()]) {
      if (entity.localOnly) {
        const keep = entity.kind === "projectile" || map === this.projectiles ? this._updateLocalProjectile(entity, dt) : (() => {
          entity.x += (entity.vx || 0) * dt;
          entity.y += (entity.vy || 0) * dt;
          entity.ttl = Math.max(0, (entity.ttl ?? 0) - dt);
          return entity.ttl > 0;
        })();
        if (!keep) {
          map.delete(entity.id);
          continue;
        }
        continue;
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
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.tickPendingCommands();
    if (!this.myState) return;
    const cooldowns = this.myState.cooldowns || null;
    if (cooldowns) {
      for (const slot of ["A", "Z", "E", "R"]) {
        if (!Number.isFinite(cooldowns[slot])) continue;
        cooldowns[slot] = Math.max(0, cooldowns[slot] - dt);
        const hudSlot = this.myState.abilityHud?.[slot];
        if (hudSlot) hudSlot.cooldownLeft = cooldowns[slot];
      }
    }
    if (Number.isFinite(this.myState._optimisticHintLeft)) {
      this.myState._optimisticHintLeft = Math.max(0, this.myState._optimisticHintLeft - dt);
      if (this.myState._optimisticHintLeft <= 0 && this.myState.hint) this.myState.hint = "";
    }
    const me = this.getMe();
    if (me) {
      if (Number.isFinite(me.rocketCooldownLeft)) me.rocketCooldownLeft = Math.max(0, me.rocketCooldownLeft - dt);
      if (Number.isFinite(me.groundMarkerTimer)) me.groundMarkerTimer = Math.max(0, me.groundMarkerTimer - dt);
    }
  }
  noteLocalAbilityCast(slot, cooldownLeft = 0, meta = {}) {
    if (!slot || !this.myState) return;
    const s = String(slot).toUpperCase();
    if (!["A", "Z", "E", "R"].includes(s)) return;
    const now = performance.now();
    this.localPrediction.abilitySeq = (this.localPrediction.abilitySeq | 0) + 1;
    const authorityMs = Math.max(900, Number(meta.authorityMs) || 1700);
    this.localPrediction.localCooldownLocks[s] = Math.max(this.localPrediction.localCooldownLocks[s] || 0, now + Math.max(authorityMs, 1400));
    this.localPrediction.localAbilityAuthorityUntil = Math.max(this.localPrediction.localAbilityAuthorityUntil || 0, now + authorityMs);
    if (!this.localPrediction.localAbilityReadyAt) this.localPrediction.localAbilityReadyAt = {};
    if (!this.localPrediction.localAbilityLastCastAt) this.localPrediction.localAbilityLastCastAt = {};
    if (Number.isFinite(cooldownLeft)) {
      this.localPrediction.localAbilityReadyAt[s] = Math.max(this.localPrediction.localAbilityReadyAt[s] || 0, now + cooldownLeft * 1e3);
      this.localPrediction.localAbilityLastCastAt[s] = now;
    }
    if (!this.myState.cooldowns) this.myState.cooldowns = {};
    if (Number.isFinite(cooldownLeft)) this.myState.cooldowns[s] = Math.max(0, cooldownLeft);
    if (this.myState.abilityHud?.[s] && Number.isFinite(cooldownLeft)) {
      this.myState.abilityHud[s].cooldownLeft = Math.max(0, cooldownLeft);
    }
    this.localPrediction.localFrameState = { ...this.myState.frameState || {} };
    this.localPrediction.localDerived = { ...this.myState.derived || {} };
  }
  upgradeAbilityLocal(slot) {
    const s = String(slot || "").toUpperCase();
    if (!["A", "Z", "E", "R"].includes(s) || !this.myState?.progression || !this.myState?.abilityHud?.[s]) return false;
    const hud = this.myState.abilityHud[s];
    if (hud.canUpgrade === false) return false;
    const prog = this.myState.progression;
    if ((prog.skillPoints ?? 0) <= 0) return false;
    const max = s === "R" ? 5 : 15;
    const current = Math.max(0, hud.investedLevel | 0);
    if (current >= max) return false;
    prog.skillPoints = Math.max(0, (prog.skillPoints | 0) - 1);
    hud.investedLevel = current + 1;
    hud.unlocked = hud.investedLevel > 0;
    hud.phase = s === "R" ? hud.investedLevel : hud.investedLevel >= 15 ? 5 : hud.investedLevel >= 10 ? 4 : hud.investedLevel >= 6 ? 3 : hud.investedLevel >= 3 ? 2 : 1;
    hud.canUpgrade = prog.skillPoints > 0 && hud.investedLevel < max;
    this.localPrediction.localUpgradeLocks[s] = performance.now() + 1200;
    this.myState.hint = `${s} niveau ${hud.investedLevel}`;
    this.myState._optimisticHintLeft = 0.55;
    return true;
  }
  setLocalAttackTarget(kind, id, options = {}) {
    const k = kind || "";
    const targetId = id || 0;
    const now = performance.now();
    this.localPrediction.attackKind = k;
    this.localPrediction.attackId = targetId;
    this.localPrediction.attackAt = now;
    this.localPrediction.attackUntil = k && targetId ? now + Math.max(1200, options.lockMs || 3e4) : 0;
    this.localPrediction.attackSeq = (this.localPrediction.attackSeq | 0) + 1;
  }
  cancelLocalAttack(options = {}) {
    this.localPrediction.attackKind = "";
    this.localPrediction.attackId = 0;
    this.localPrediction.attackUntil = 0;
    if (!options.keepSeq) this.localPrediction.attackSeq = (this.localPrediction.attackSeq | 0) + 1;
  }
  setOptimisticSelection(kind, id, options = {}) {
    if (!this.myState) return;
    const k = kind || "";
    const targetId = id || 0;
    this.myState.selectedKind = k;
    this.myState.selectedId = targetId;
    this.localPrediction.selectedKind = k;
    this.localPrediction.selectedId = targetId;
    const now = performance.now();
    this.localPrediction.selectedAt = now;
    this.localPrediction.selectedUntil = k && targetId ? now + Math.max(1500, options.lockMs || 3e4) : 0;
    if (k && targetId) {
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
    if (!options.keepAttack) this.cancelLocalAttack({ keepSeq: false });
    if (!options.preserveSelection) {
      this.localPrediction.selectedKind = "";
      this.localPrediction.selectedId = 0;
      this.localPrediction.selectedUntil = 0;
      if (this.myState) {
        this.myState.selectedKind = "";
        this.myState.selectedId = 0;
      }
    }
    me.groundMarkerX = x;
    me.groundMarkerY = y;
    me.groundMarkerTimer = 0.85;
  }
  _tickAsteroids(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const maxStep = Math.min(0.05, dt);
    for (const asteroid of this.asteroids.values()) {
      if (!Number.isFinite(asteroid.rot)) asteroid.rot = 0;
      const spin = Number(asteroid.spin || 0);
      if (Number.isFinite(spin) && spin !== 0 && !asteroid.bastionWall) {
        asteroid.rot += spin * maxStep * 2.2;
      }
    }
  }
  interpolate(dt) {
    const dynamicAlpha = Math.max(0.05, Math.min(1, 1 - Math.exp(-22 * Math.max(0, dt))));
    const fastAlpha = Math.max(0.08, Math.min(1, 1 - Math.exp(-32 * Math.max(0, dt))));
    this._smoothMap(this.players, dynamicAlpha, dt);
    this._smoothMap(this.mobs, dynamicAlpha, dt);
    this._smoothMap(this.projectiles, fastAlpha, dt);
    this._smoothMap(this.areaEffects, fastAlpha, dt);
    this._smoothMap(this.loots, fastAlpha, dt);
    this._tickAsteroids(dt);
    this.tickLocalUi(dt);
  }
  noteLocalSectorTransition(sx, sy, x, y, options = {}) {
    this.localPrediction.sectorTransitionAt = performance.now();
    this.localPrediction.sectorSx = sx | 0;
    this.localPrediction.sectorSy = sy | 0;
    this.localPrediction.sectorX = Number.isFinite(x) ? x : 0;
    this.localPrediction.sectorY = Number.isFinite(y) ? y : 0;
    this.localPrediction.selectedKind = "";
    this.localPrediction.selectedId = 0;
    this.cancelLocalAttack({ keepSeq: false });
    this.localPrediction.hasMoveTarget = false;
    this.localPrediction.hold = false;
    this.localPrediction.moveX = this.localPrediction.sectorX;
    this.localPrediction.moveY = this.localPrediction.sectorY;
  }
  beginPortalLoading(label = "Chargement du secteur\u2026", durationMs = 650, transitionId = 0) {
    const now = performance.now();
    const id = transitionId | 0;
    if (id && id === (this.localPrediction.remoteTransitionId | 0) && now < (this.localPrediction.loadingUntil || 0)) return;
    if (id) this.localPrediction.remoteTransitionId = id;
    this.localPrediction.loadingLabel = String(label || "Chargement du secteur\u2026");
    this.localPrediction.loadingUntil = Math.max(this.localPrediction.loadingUntil || 0, now + Math.max(180, durationMs));
  }
  getLoadingState() {
    const now = performance.now();
    const until = this.localPrediction.loadingUntil || 0;
    if (now >= until) return { active: false, label: "" };
    return { active: true, label: this.localPrediction.loadingLabel || "Chargement du secteur\u2026", leftMs: until - now };
  }
  _forEachConverterItem(itemId, fn) {
    if (!itemId || typeof fn !== "function") return;
    const eq = this.myState?.equipment;
    const groups = [
      eq?.ownedItems,
      eq?.equippedItems,
      eq?.converters?.equipped,
      eq?.converters?.inventory,
      eq?.activeConverters
    ];
    for (const arr of groups) {
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (item?.itemId === itemId) fn(item);
      }
    }
  }
  setConverterOptimistic(itemId, enabled) {
    const id = String(itemId || "");
    if (!id || !this.myState?.equipment) return;
    const next = !!enabled;
    this._forEachConverterItem(id, (item) => {
      item.converterEnabled = next;
      item.enabled = next;
      if (item.converterRuntime) {
        item.converterRuntime.enabled = next;
        item.converterRuntime.blockedReason = next ? "" : "disabled";
        item.converterRuntime.blockedLabel = next ? "actif" : "coup\xE9";
      }
      if (next && item.blockedLabel === "coup\xE9") item.blockedLabel = "actif";
      if (!next) item.blockedLabel = "coup\xE9";
    });
    const conv = this.myState.equipment.converters;
    if (conv?.summary) {
      const equipped = Array.isArray(conv.equipped) ? conv.equipped : [];
      conv.summary.enabledCount = equipped.filter((item) => item?.converterEnabled).length;
    }
    const active = conv?.active;
    if (Array.isArray(active)) {
      for (const entry of active) {
        if (entry?.itemId !== id) continue;
        entry.enabled = next;
        entry.blockedReason = next ? "" : "disabled";
        entry.blockedLabel = next ? "actif" : "coup\xE9";
      }
    }
  }
  noteCommandPending(cmd, payload = {}, meta = {}) {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const now = performance.now();
    const entry = {
      id,
      cmd: String(cmd || ""),
      payload: { ...payload || {} },
      meta: { ...meta || {} },
      at: now,
      status: "pending"
    };
    this.pendingCommands.set(id, entry);
    const stationCmds = /* @__PURE__ */ new Set([
      "sell",
      "sell_all",
      "buy_item",
      "buy_and_assign_rocket_ammo",
      "equip_item",
      "equip_item_to_slot",
      "unequip_item",
      "sell_item",
      "assign_rocket_ammo",
      "unassign_rocket_ammo",
      "switch_rocket_slot",
      "toggle_converter",
      "set_frame"
    ]);
    if (stationCmds.has(entry.cmd)) this.pendingStationCommands.set(id, entry);
    return id;
  }
  applyCommandAck(msg) {
    const id = String(msg?.cmdId || "");
    if (!id) return;
    const entry = this.pendingCommands.get(id) || this.pendingStationCommands.get(id) || null;
    if (!entry) return;
    entry.status = msg.ok ? "ok" : "failed";
    entry.ackedAt = performance.now();
    entry.ok = !!msg.ok;
    entry.cmd = String(msg.cmd || entry.cmd || "");
    if (!msg.ok) {
      this.myState = this.myState || {};
      const reason = String(msg.error || "refus\xE9e");
      this.myState.hint = `Action station refus\xE9e : ${entry.cmd}${reason ? ` (${reason})` : ""}`;
      this.myState._optimisticHintLeft = 1.2;
    }
    if (this.pendingStationCommands.has(id)) {
      this.pendingStationCommands.delete(id);
    }
  }
  tickPendingCommands() {
    const now = performance.now();
    for (const [id, entry] of [...this.pendingCommands.entries()]) {
      const done = entry.status === "ok" || entry.status === "failed";
      if (done && now - (entry.ackedAt || entry.at) > 280 || now - entry.at > 1500) {
        this.pendingCommands.delete(id);
        this.pendingStationCommands.delete(id);
      }
    }
  }
  getStationPendingSummary() {
    this.tickPendingCommands();
    const now = performance.now();
    const pending = [...this.pendingStationCommands.values()].filter((entry) => entry.status === "pending" && now - entry.at < 900);
    const failed = [...this.pendingCommands.values()].filter((entry) => entry?.meta?.station && (entry.status === "failed" || now - entry.at >= 1200) && now - (entry.ackedAt || entry.at) < 1100);
    return {
      count: pending.length,
      failedCount: failed.length,
      latest: pending[pending.length - 1] || null,
      failed: failed[failed.length - 1] || null
    };
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
};

// client/src/net/NetClient.js
var NetClient = class {
  constructor(store, onStatus) {
    this.store = store;
    this.onStatus = onStatus;
    this.ws = null;
    this.reconnectTimer = 0;
    this.sessionTokenKey = "gravitar.sessionToken.v1";
    this.manualClose = false;
  }
  getSessionToken() {
    try {
      return localStorage.getItem(this.sessionTokenKey) || "";
    } catch {
      return "";
    }
  }
  setSessionToken(token) {
    const clean = String(token || "").trim();
    try {
      if (clean) localStorage.setItem(this.sessionTokenKey, clean);
      else localStorage.removeItem(this.sessionTokenKey);
    } catch {
    }
  }
  connect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = 0;
    }
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const token = this.getSessionToken();
    const qs = token ? `?resume=${encodeURIComponent(token)}` : "";
    this.ws = new WebSocket(`${proto}://${location.host}${qs}`);
    this.ws.onopen = () => {
      this.onStatus?.(token ? "Reconnect\xE9." : "Connect\xE9.");
    };
    this.ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.t === "hello") {
        if (msg.sessionToken) this.setSessionToken(msg.sessionToken);
        this.store.applyHello(msg.id, msg.sessionToken || "", !!msg.resumed);
      }
      if (msg.t === "snap") this.store.applySnapshot(msg);
      if (msg.t === "chat") this.store.applyChatMessage(msg);
      if (msg.t === "cmd_ack") this.store.applyCommandAck?.(msg);
    };
    this.ws.onclose = () => {
      if (this.manualClose) return;
      this.onStatus?.("D\xE9connect\xE9. Reconnexion\u2026");
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 500);
    };
  }
  send(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(obj));
  }
};

// client/src/input/InputState.js
function createInputState() {
  return {
    msx: 0,
    msy: 0,
    a: false,
    z: false,
    e: false,
    r: false,
    interactTap: false,
    rocketTap: false,
    rightDown: false,
    holdActive: false,
    downX: 0,
    downY: 0,
    clickQueued: false,
    moveWorldQueued: false,
    moveWorldX: 0,
    moveWorldY: 0,
    cameraLocked: true,
    cameraToggleQueued: false,
    suppressRightHoldUntilUp: false,
    targetClickQueued: false,
    targetKind: "",
    targetId: 0,
    inputSeq: 0,
    selectSeq: 0,
    actionSeq: 0,
    actions: [],
    forceSend: false
  };
}

// client/src/input/InputController.js
function isEditableTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || !!target.isContentEditable;
}
var InputController = class {
  constructor(canvas, input, handlers = {}) {
    this.canvas = canvas;
    this.input = input;
    const queueAction = (action) => {
      if (!Array.isArray(input.actions)) input.actions = [];
      input.actionSeq = (input.actionSeq | 0) + 1;
      input.actions.push({ seq: input.actionSeq, time: performance.now(), ...action });
      if (input.actions.length > 32) input.actions.splice(0, input.actions.length - 32);
      input.forceSend = true;
    };
    canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
    canvas.addEventListener("mousemove", (ev) => {
      const rect = canvas.getBoundingClientRect();
      input.msx = ev.clientX - rect.left;
      input.msy = ev.clientY - rect.top;
      if (input.rightDown && !input.holdActive && !input.suppressRightHoldUntilUp) {
        const dx = input.msx - input.downX;
        const dy = input.msy - input.downY;
        if (dx * dx + dy * dy >= 36) input.holdActive = true;
      }
    });
    canvas.addEventListener("mousedown", (ev) => {
      if (ev.button !== 2) return;
      const rect = canvas.getBoundingClientRect();
      input.msx = ev.clientX - rect.left;
      input.msy = ev.clientY - rect.top;
      input.rightDown = true;
      input.holdActive = false;
      input.suppressRightHoldUntilUp = false;
      input.downX = input.msx;
      input.downY = input.msy;
      const handled = handlers.onPrimaryDown?.(input.msx, input.msy);
      if (handled?.type === "target") {
        input.clickQueued = false;
        input.moveWorldQueued = false;
        input.targetClickQueued = true;
        input.targetKind = handled.kind || "";
        input.targetId = handled.id || 0;
        input.selectSeq = (input.selectSeq | 0) + 1;
        queueAction({
          type: "target",
          kind: input.targetKind,
          id: input.targetId,
          selectSeq: input.selectSeq,
          attack: handled.kind !== "station",
          targetX: handled.x,
          targetY: handled.y,
          targetSx: handled.sx,
          targetSy: handled.sy
        });
        input.suppressRightHoldUntilUp = true;
      } else if (handled?.type === "move") {
        input.clickQueued = false;
        input.moveWorldQueued = true;
        input.moveWorldX = handled.x;
        input.moveWorldY = handled.y;
        queueAction({ type: "cancelAttack", clearSelection: true });
        queueAction({ type: "move", x: handled.x, y: handled.y });
      } else {
        input.clickQueued = true;
      }
      canvas.focus();
      ev.preventDefault();
    });
    window.addEventListener("mouseup", (ev) => {
      if (ev.button === 2) {
        input.rightDown = false;
        input.holdActive = false;
        input.suppressRightHoldUntilUp = false;
      }
    });
    window.addEventListener("keydown", (ev) => {
      if (isEditableTarget(ev.target)) return;
      if (ev.repeat) return;
      const k = ev.key;
      const lower = k.toLowerCase();
      if (ev.ctrlKey && ["a", "z", "e", "r"].includes(lower)) {
        handlers.onAbilityUpgrade?.(lower.toUpperCase());
        ev.preventDefault();
        return;
      }
      if (ev.code === "Space" || k === " ") {
        input.cameraLocked = !input.cameraLocked;
        input.cameraToggleQueued = true;
        ev.preventDefault();
        return;
      }
      if (lower === "a") input.a = true;
      if (lower === "z") input.z = true;
      if (lower === "e") input.e = true;
      if (lower === "r") input.r = true;
      if (lower === "d") {
        input.interactTap = true;
        queueAction({ type: "interact" });
      }
      if (lower === "f") input.rocketTap = true;
      if (lower === "x") {
        handlers.onRocketSlotSwitch?.(0);
        ev.preventDefault();
        return;
      }
      if (lower === "c") {
        handlers.onRocketSlotSwitch?.(1);
        ev.preventDefault();
        return;
      }
      if (k === "1") handlers.onFrameSelect?.("vanguard");
      if (k === "2") handlers.onFrameSelect?.("sigil");
      if (k === "3") handlers.onFrameSelect?.("bulwark");
    });
    window.addEventListener("keyup", (ev) => {
      if (isEditableTarget(ev.target)) return;
      const lower = ev.key.toLowerCase();
      if (lower === "a") input.a = false;
      if (lower === "z") input.z = false;
      if (lower === "e") input.e = false;
      if (lower === "r") input.r = false;
    });
  }
};

// client/src/audio/SfxTypes.js
var SFX_TYPES = {
  AUTO_ATTACK: "auto_attack",
  COLLECT: "collect",
  ROCKET: "rocket",
  ABILITY_A: "ability_a",
  ABILITY_Z: "ability_z",
  ABILITY_E: "ability_e",
  ABILITY_R: "ability_r",
  DAMAGE_SHIELD: "damage_shield",
  DAMAGE_HULL: "damage_hull"
};

// client/src/audio/SfxSynth.js
function applyEnvelope(gain, now, attack, release, amp) {
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(1e-4, now);
  gain.gain.linearRampToValueAtTime(amp, now + attack);
  gain.gain.exponentialRampToValueAtTime(1e-4, now + attack + release);
}
function createTone(ctx, type, freq, start, duration, amp, destination = ctx.destination) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  osc.connect(gain);
  gain.connect(destination);
  applyEnvelope(gain, start, 4e-3, Math.max(0.03, duration - 4e-3), amp);
  osc.start(start);
  osc.stop(start + duration + 0.02);
  return { osc, gain };
}
function playAutoAttack(ctx, variant, destination = ctx.destination) {
  const now = ctx.currentTime;
  const base = 1220 - variant % 3 * 55;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(base * 1.18, now);
  osc.frequency.exponentialRampToValueAtTime(base * 0.74, now + 0.055);
  osc.connect(gain);
  gain.connect(destination);
  applyEnvelope(gain, now, 3e-3, 0.06, 0.034);
  osc.start(now);
  osc.stop(now + 0.085);
  createTone(ctx, "triangle", base * 1.95, now, 0.055, 0.012, destination);
}
function playRocket(ctx, variant, destination = ctx.destination) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(58, now + 0.16);
  osc.connect(gain);
  gain.connect(destination);
  applyEnvelope(gain, now, 4e-3, 0.19, 0.05);
  osc.start(now);
  osc.stop(now + 0.22);
  createTone(ctx, "triangle", 720 + variant % 3 * 70, now + 0.012, 0.045, 0.018, destination);
}
function playAbility(ctx, slot, destination = ctx.destination) {
  const now = ctx.currentTime;
  const table = { A: 760, Z: 440, E: 980, R: 260 };
  const base = table[slot] || 640;
  createTone(ctx, slot === "R" ? "sawtooth" : "triangle", base, now, slot === "R" ? 0.24 : 0.12, slot === "R" ? 0.045 : 0.032, destination);
  createTone(ctx, "sine", base * 1.5, now + 0.035, 0.1, 0.018, destination);
  if (slot === "R") createTone(ctx, "sawtooth", base * 0.5, now + 0.02, 0.28, 0.026, destination);
}
function playDamage(ctx, shielded, variant, destination = ctx.destination) {
  const now = ctx.currentTime;
  const base = shielded ? 520 : 155;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = shielded ? "triangle" : "square";
  osc.frequency.setValueAtTime(base * (variant ? 1.35 : 1), now);
  osc.frequency.exponentialRampToValueAtTime(base * 0.72, now + 0.045);
  osc.connect(gain);
  gain.connect(destination);
  applyEnvelope(gain, now, 2e-3, 0.055, shielded ? 0.016 : 0.02);
  osc.start(now);
  osc.stop(now + 0.08);
}
function playCollect(ctx, variant, destination = ctx.destination) {
  const now = ctx.currentTime;
  const root = 520 + variant % 6 * 38;
  createTone(ctx, "triangle", root, now, 0.07, 0.03, destination);
  createTone(ctx, "triangle", root * 1.25, now + 0.028, 0.08, 0.022, destination);
  createTone(ctx, "sine", root * 1.5, now + 0.056, 0.095, 0.016, destination);
}
function playSfxEvent(ctx, ev, destination = ctx.destination) {
  if (!ctx || !ev?.type) return;
  if (ev.type === SFX_TYPES.AUTO_ATTACK) return playAutoAttack(ctx, ev.variant | 0, destination);
  if (ev.type === SFX_TYPES.COLLECT) return playCollect(ctx, ev.variant | 0, destination);
  if (ev.type === SFX_TYPES.ROCKET) return playRocket(ctx, ev.variant | 0, destination);
  if (ev.type === SFX_TYPES.ABILITY_A) return playAbility(ctx, "A", destination);
  if (ev.type === SFX_TYPES.ABILITY_Z) return playAbility(ctx, "Z", destination);
  if (ev.type === SFX_TYPES.ABILITY_E) return playAbility(ctx, "E", destination);
  if (ev.type === SFX_TYPES.ABILITY_R) return playAbility(ctx, "R", destination);
  if (ev.type === SFX_TYPES.DAMAGE_SHIELD) return playDamage(ctx, true, ev.variant | 0, destination);
  if (ev.type === SFX_TYPES.DAMAGE_HULL) return playDamage(ctx, false, ev.variant | 0, destination);
}

// client/src/audio/MusicPlaylist.js
var TRACKS = [
  {
    id: "drift",
    tempo: 66,
    root: 146.83,
    scale: [0, 2, 3, 7, 9, 10],
    progression: [[0, 3, 7], [-2, 2, 7], [-5, 0, 5], [-7, -3, 2]],
    lead: [7, 9, 10, 14, 12, 10, 9, 7, 5, 7],
    bars: 14
  },
  {
    id: "orbit",
    tempo: 58,
    root: 174.61,
    scale: [0, 2, 5, 7, 9],
    progression: [[0, 5, 9], [-3, 2, 7], [-5, 0, 5], [-8, -3, 2]],
    lead: [9, 7, 5, 2, 0, 2, 5, 7, 12, 9],
    bars: 16
  },
  {
    id: "frontier",
    tempo: 72,
    root: 130.81,
    scale: [0, 2, 4, 7, 11],
    progression: [[0, 4, 7, 11], [-5, 0, 4, 7], [-8, -1, 4, 7], [-3, 2, 7, 11]],
    lead: [11, 14, 12, 9, 7, 4, 7, 9, 11, 16],
    bars: 12
  }
];
function midiRatio(semi) {
  return Math.pow(2, semi / 12);
}
function note(root, semi, octave = 0) {
  return root * midiRatio(semi + octave * 12);
}
function makeGain(ctx, destination, value = 0) {
  const gain = ctx.createGain();
  gain.gain.value = value;
  gain.connect(destination);
  return gain;
}
function scheduleTone(ctx, dest, freq, start, duration, opts = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const type = opts.type || "sine";
  const amp = Math.max(1e-4, opts.amp ?? 0.02);
  const attack = Math.max(0.01, opts.attack ?? 0.5);
  const release = Math.max(0.05, opts.release ?? 1.2);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (opts.detune) osc.detune.setValueAtTime(opts.detune, start);
  gain.gain.setValueAtTime(1e-4, start);
  gain.gain.linearRampToValueAtTime(amp, start + attack);
  gain.gain.exponentialRampToValueAtTime(1e-4, start + Math.max(attack + 0.05, duration + release));
  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + duration + release + 0.08);
}
function scheduleChord(ctx, dest, root, chord, start, beat, velocity = 1) {
  for (const semi of chord) {
    const f = note(root, semi, 0);
    scheduleTone(ctx, dest, f, start, beat * 3.6, { type: "sine", amp: 0.01 * velocity, attack: 1.1, release: 2.8 });
    scheduleTone(ctx, dest, f * 2, start + 0.04, beat * 2.8, { type: "triangle", amp: 45e-4 * velocity, attack: 1.3, release: 2.1, detune: -3 });
  }
  scheduleTone(ctx, dest, note(root, chord[0], -1), start, beat * 4, { type: "sine", amp: 9e-3 * velocity, attack: 1.5, release: 3.5 });
}
function scheduleTrack(ctx, destination, track, start) {
  const master = makeGain(ctx, destination, 1e-4);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1850, start);
  filter.Q.setValueAtTime(0.42, start);
  master.disconnect();
  master.connect(filter);
  filter.connect(destination);
  master.gain.setValueAtTime(1e-4, start);
  master.gain.linearRampToValueAtTime(0.38, start + 4.5);
  const beat = 60 / track.tempo;
  const bar = beat * 4;
  const total = track.bars * bar;
  for (let i = 0; i < track.bars; i += 1) {
    const chord = track.progression[i % track.progression.length];
    scheduleChord(ctx, master, track.root, chord, start + i * bar, beat, 0.9 + (i % 4 === 0 ? 0.15 : 0));
  }
  for (let i = 0; i < track.lead.length; i += 1) {
    const gap = (i % 3 === 0 ? 1.5 : 1) * beat;
    const t = start + bar * 1.5 + i * gap * 1.8;
    if (t > start + total - 3) break;
    scheduleTone(ctx, master, note(track.root, track.lead[i], 1), t, beat * (1.2 + i % 2 * 0.8), {
      type: "triangle",
      amp: 0.01,
      attack: 0.08,
      release: 1.6,
      detune: i % 2 ? 4 : -4
    });
  }
  for (let i = 0; i < Math.floor(track.bars / 2); i += 1) {
    const semi = track.scale[(i * 2 + track.id.length) % track.scale.length];
    scheduleTone(ctx, master, note(track.root, semi, 2), start + (i * 2 + 1) * bar + beat * 0.5, beat * 1.7, {
      type: "sine",
      amp: 55e-4,
      attack: 0.12,
      release: 1.8
    });
  }
  master.gain.setValueAtTime(0.38, start + Math.max(5, total - 5));
  master.gain.exponentialRampToValueAtTime(1e-4, start + total);
  return total;
}
var MusicPlaylist = class {
  constructor() {
    this.enabled = true;
    this.nextStartAt = 0;
    this.activeUntil = 0;
    this.lastTrack = "";
    this.master = null;
    this.volume = 0.42;
    this.manifestLoaded = false;
    this.manifestLoading = false;
    this.fileTracks = [];
    this.audioEl = null;
    this.audioTrack = "";
  }
  ensure(ctx) {
    if (this.master || !ctx) return;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.master.context.currentTime, 0.08);
    if (this.audioEl) this.audioEl.volume = this.volume;
  }
  async loadManifest() {
    if (this.manifestLoaded || this.manifestLoading) return;
    this.manifestLoading = true;
    try {
      const res = await fetch("/client/assets/music/index.json", { cache: "no-store" });
      if (res.ok) {
        const raw = await res.json();
        const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.tracks) ? raw.tracks : [];
        this.fileTracks = arr.map((entry) => {
          if (typeof entry === "string") {
            return { src: `/client/assets/music/${encodeURIComponent(entry)}`, id: entry };
          }
          if (entry?.src) {
            const src = String(entry.src);
            return {
              src: src.startsWith("/") || src.startsWith("http") ? src : `/client/assets/music/${encodeURIComponent(src)}`,
              id: entry.id || entry.title || src
            };
          }
          return null;
        }).filter(Boolean);
      }
    } catch {
    }
    this.manifestLoaded = true;
    this.manifestLoading = false;
  }
  isFileAudioBusy(ctx) {
    if (!this.audioEl || this.audioEl.paused || this.audioEl.ended) return false;
    this.activeUntil = Math.max(this.activeUntil, ctx.currentTime + 2);
    return true;
  }
  playFileTrack(ctx, track) {
    if (!track?.src) return false;
    try {
      if (!this.audioEl) {
        this.audioEl = new Audio();
        this.audioEl.preload = "auto";
      }
      this.audioEl.pause();
      this.audioEl.src = track.src;
      this.audioEl.volume = this.volume;
      this.audioEl.loop = false;
      this.audioTrack = track.id || track.src;
      this.audioEl.onended = () => {
        this.activeUntil = ctx.currentTime;
        this.nextStartAt = ctx.currentTime + 18 + Math.random() * 45;
      };
      this.audioEl.play().catch(() => {
      });
      this.lastTrack = this.audioTrack;
      this.activeUntil = ctx.currentTime + 999999;
      return true;
    } catch {
      return false;
    }
  }
  update(ctx) {
    if (!this.enabled || !ctx || ctx.state !== "running") return;
    this.ensure(ctx);
    if (!this.manifestLoaded) this.loadManifest();
    const now = ctx.currentTime;
    if (!this.nextStartAt) this.nextStartAt = now + 2 + Math.random() * 8;
    if (this.isFileAudioBusy(ctx)) return;
    if (now < this.nextStartAt || now < this.activeUntil) return;
    if (this.fileTracks.length) {
      const choices2 = this.fileTracks.filter((t) => t.id !== this.lastTrack);
      const track2 = choices2[Math.floor(Math.random() * choices2.length)] || this.fileTracks[0];
      if (this.playFileTrack(ctx, track2)) return;
    }
    const choices = TRACKS.filter((t) => t.id !== this.lastTrack);
    const track = choices[Math.floor(Math.random() * choices.length)] || TRACKS[0];
    const start = now + 0.12;
    const duration = scheduleTrack(ctx, this.master, track, start);
    this.lastTrack = track.id;
    this.activeUntil = start + duration;
    this.nextStartAt = this.activeUntil + 18 + Math.random() * 45;
  }
};

// client/src/audio/ReactorLoop.js
function makeNoiseBuffer(ctx) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * 1.2));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}
var ReactorLoop = class {
  constructor() {
    this.ready = false;
    this.master = null;
    this.osc = null;
    this.noise = null;
    this.filter = null;
    this.lastIntensity = 0;
    this.volume = 1;
  }
  ensure(ctx) {
    if (this.ready || !ctx) return;
    this.master = ctx.createGain();
    this.master.gain.value = 1e-4;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 240;
    this.filter.Q.value = 0.8;
    this.osc = ctx.createOscillator();
    this.osc.type = "sawtooth";
    this.osc.frequency.value = 54;
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.42;
    this.osc.connect(oscGain);
    oscGain.connect(this.filter);
    this.noise = ctx.createBufferSource();
    this.noise.buffer = makeNoiseBuffer(ctx);
    this.noise.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.22;
    this.noise.connect(noiseGain);
    noiseGain.connect(this.filter);
    this.filter.connect(this.master);
    this.master.connect(ctx.destination);
    this.osc.start();
    this.noise.start();
    this.ready = true;
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
  }
  update(ctx, me, input) {
    if (!ctx || ctx.state !== "running") return;
    this.ensure(ctx);
    const speed = Math.hypot(me?.vx || 0, me?.vy || 0);
    const thrust = Math.max(0, Math.min(1, Number(me?._localThrust) || 0));
    const target = speed > 14 ? Math.min(1, Math.max(speed / 420, thrust * 0.72)) : 0;
    const smoothing = target > this.lastIntensity ? 0.13 : 0.18;
    this.lastIntensity += (target - this.lastIntensity) * smoothing;
    if (this.lastIntensity < 0.012 && target <= 0) this.lastIntensity = 0;
    const now = ctx.currentTime;
    const amp = 1e-4 + this.lastIntensity * 0.046 * this.volume;
    this.master.gain.setTargetAtTime(amp, now, 0.045);
    this.osc.frequency.setTargetAtTime(48 + this.lastIntensity * 58, now, 0.08);
    this.filter.frequency.setTargetAtTime(180 + this.lastIntensity * 620, now, 0.1);
  }
};

// client/src/audio/AudioSystem.js
function clampDb(value, fallback = 0) {
  const n = Number(value);
  return Math.max(-60, Math.min(0, Number.isFinite(n) ? n : fallback));
}
function dbToGain(db) {
  const n = clampDb(db, -60);
  if (n <= -60) return 0;
  return Math.pow(10, n / 20);
}
var AudioSystem = class {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.music = new MusicPlaylist();
    this.reactor = new ReactorLoop();
    this.masterVolume = 0;
    this.sfxVolume = -12;
    this.sfxBus = null;
  }
  installUnlock(target = window) {
    const unlock = async () => {
      try {
        if (!this.ctx) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          this.ctx = new Ctx();
          this.ensureBuses();
        }
        if (this.ctx.state !== "running") await this.ctx.resume();
        this.unlocked = this.ctx.state === "running";
      } catch {
      }
    };
    target.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
  }
  ensureBuses() {
    if (!this.ctx || this.sfxBus) return;
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = dbToGain(this.masterVolume + this.sfxVolume);
    this.sfxBus.connect(this.ctx.destination);
  }
  applySettings(settings = {}) {
    this.masterVolume = clampDb(settings.masterVolume, this.masterVolume);
    this.sfxVolume = clampDb(settings.sfxVolume, this.sfxVolume);
    const musicDb = clampDb(settings.musicVolume, -18);
    const reactorDb = clampDb(settings.reactorVolume, -20);
    const sfxGain = dbToGain(this.masterVolume + this.sfxVolume);
    this.music.setVolume(dbToGain(this.masterVolume + musicDb));
    this.reactor.setVolume(dbToGain(this.masterVolume + reactorDb));
    if (this.sfxBus && this.ctx) this.sfxBus.gain.setTargetAtTime(sfxGain, this.ctx.currentTime, 0.06);
  }
  playPending(events) {
    if (!events?.length) return;
    if (!this.ctx || this.ctx.state !== "running") return;
    this.ensureBuses();
    for (const ev of events) playSfxEvent(this.ctx, ev, this.sfxBus || this.ctx.destination);
  }
  update(me, input) {
    if (!this.ctx || this.ctx.state !== "running") return;
    this.ensureBuses();
    this.music.update(this.ctx);
    this.reactor.update(this.ctx, me, input);
  }
};

// client/src/core/Math.js
function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
function rgba(r, g, b, a = 1) {
  return `rgba(${r | 0},${g | 0},${b | 0},${clamp(a, 0, 1)})`;
}
function distSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
function polar(cx, cy, r, a) {
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
}
function worldToScreen(camX, camY, x, y, cssW, cssH) {
  return { x: x - camX + cssW * 0.5, y: y - camY + cssH * 0.5 };
}

// client/src/render/BackgroundRenderer.js
var BIOME_BACKDROPS = {
  hub: {
    base: { r: 3, g: 8, b: 15 },
    tint: { r: 70, g: 145, b: 210 },
    accent: { r: 115, g: 205, b: 255 },
    haze: 0.05,
    dust: 0.42,
    line: { r: 75, g: 150, b: 210 },
    star: { r: 220, g: 240, b: 255 },
    pattern: "calm"
  },
  metallic: {
    base: { r: 3, g: 5, b: 8 },
    tint: { r: 95, g: 110, b: 125 },
    accent: { r: 200, g: 215, b: 225 },
    haze: 0.045,
    dust: 0.35,
    line: { r: 130, g: 145, b: 160 },
    star: { r: 235, g: 240, b: 245 },
    pattern: "fragments"
  },
  silicate: {
    base: { r: 6, g: 5, b: 4 },
    tint: { r: 145, g: 105, b: 60 },
    accent: { r: 215, g: 180, b: 115 },
    haze: 0.06,
    dust: 0.58,
    line: { r: 135, g: 105, b: 70 },
    star: { r: 255, g: 232, b: 190 },
    pattern: "dust"
  },
  organic: {
    base: { r: 2, g: 8, b: 7 },
    tint: { r: 40, g: 125, b: 80 },
    accent: { r: 100, g: 220, b: 145 },
    haze: 0.065,
    dust: 0.66,
    line: { r: 70, g: 175, b: 115 },
    star: { r: 210, g: 255, b: 220 },
    pattern: "wisps"
  },
  volatile: {
    base: { r: 2, g: 7, b: 13 },
    tint: { r: 55, g: 135, b: 190 },
    accent: { r: 145, g: 230, b: 255 },
    haze: 0.07,
    dust: 0.62,
    line: { r: 95, g: 195, b: 240 },
    star: { r: 200, g: 240, b: 255 },
    pattern: "ice"
  },
  nuclear: {
    base: { r: 5, g: 8, b: 3 },
    tint: { r: 110, g: 175, b: 45 },
    accent: { r: 205, g: 255, b: 115 },
    haze: 0.06,
    dust: 0.44,
    line: { r: 155, g: 220, b: 75 },
    star: { r: 225, g: 255, b: 190 },
    pattern: "radiation"
  },
  anomaly: {
    base: { r: 5, g: 3, b: 12 },
    tint: { r: 120, g: 70, b: 190 },
    accent: { r: 225, g: 150, b: 255 },
    haze: 0.075,
    dust: 0.72,
    line: { r: 185, g: 125, b: 255 },
    star: { r: 240, g: 215, b: 255 },
    pattern: "anomaly"
  }
};
function backdropFor(biome) {
  const id = String(biome?.id || biome?.biomeId || biome || "").toLowerCase();
  return BIOME_BACKDROPS[id] || BIOME_BACKDROPS.metallic;
}
function biomeIdFor(biome) {
  return String(biome?.id || biome?.biomeId || biome || "").toLowerCase();
}
function xorshift(s) {
  s ^= s << 13;
  s ^= s >> 17;
  s ^= s << 5;
  return s | 0;
}
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
function random01FromSeed(seed) {
  const s = xorshift(seed | 0);
  return (s >>> 0) % 1e5 / 1e5;
}
function fillBaseSpace(ctx, view, bg) {
  const g = ctx.createLinearGradient(0, 0, 0, view.h);
  g.addColorStop(0, rgba(bg.base.r, bg.base.g, bg.base.b, 0.98));
  g.addColorStop(0.55, rgba(0, 2, 5, 0.985));
  g.addColorStop(1, rgba(1, 4, 8, 0.99));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);
}
function drawLocalNebula(ctx, view, camX, camY, bg, biomeId) {
  const { cssW, cssH, dpr } = view;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const cx = (cssW * 0.58 + Math.sin(camX * 42e-5 + biomeId.length) * cssW * 0.16) * dpr;
  const cy = (cssH * 0.44 + Math.cos(camY * 37e-5 + biomeId.length * 2) * cssH * 0.14) * dpr;
  const r1 = Math.max(cssW, cssH) * (biomeId === "anomaly" ? 0.95 : 0.78) * dpr;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r1);
  g.addColorStop(0, rgba(bg.tint.r, bg.tint.g, bg.tint.b, bg.haze));
  g.addColorStop(0.42, rgba(bg.tint.r, bg.tint.g, bg.tint.b, bg.haze * 0.38));
  g.addColorStop(1, rgba(bg.tint.r, bg.tint.g, bg.tint.b, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);
  const cloudCell = 820;
  const minX = camX - cssW;
  const maxX = camX + cssW;
  const minY = camY - cssH;
  const maxY = camY + cssH;
  const c0x = Math.floor(minX / cloudCell);
  const c1x = Math.floor(maxX / cloudCell);
  const c0y = Math.floor(minY / cloudCell);
  const c1y = Math.floor(maxY / cloudCell);
  const count = Math.max(1, Math.round(1 + bg.dust * 3));
  for (let cyi = c0y; cyi <= c1y; cyi += 1) {
    for (let cxi = c0x; cxi <= c1x; cxi += 1) {
      let s = cxi * 1402946737 ^ cyi * 6542989 ^ 8335785 ^ biomeId.length * 9187;
      for (let i = 0; i < count; i += 1) {
        s = xorshift(s);
        const rx = (s & 65535) / 65535;
        s = xorshift(s);
        const ry = (s & 65535) / 65535;
        s = xorshift(s);
        const rr = (s & 65535) / 65535;
        const sx = cxi * cloudCell + rx * cloudCell - camX * 0.32 + cssW * 0.5;
        const sy = cyi * cloudCell + ry * cloudCell - camY * 0.32 + cssH * 0.5;
        const radius = (140 + rr * 310) * dpr;
        const alpha = (0.01 + bg.dust * 0.015) * (0.55 + rr * 0.45);
        const cg = ctx.createRadialGradient(sx * dpr, sy * dpr, 0, sx * dpr, sy * dpr, radius);
        cg.addColorStop(0, rgba(bg.tint.r, bg.tint.g, bg.tint.b, alpha));
        cg.addColorStop(1, rgba(bg.tint.r, bg.tint.g, bg.tint.b, 0));
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(sx * dpr, sy * dpr, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}
function drawBiomePattern(ctx, view, camX, camY, bg, biomeId) {
  const { cssW, cssH, dpr } = view;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineWidth = 1 * dpr;
  if (bg.pattern === "fragments") {
    const cell = 520;
    const c0x = Math.floor((camX - cssW) / cell);
    const c1x = Math.floor((camX + cssW) / cell);
    const c0y = Math.floor((camY - cssH) / cell);
    const c1y = Math.floor((camY + cssH) / cell);
    for (let cy = c0y; cy <= c1y; cy += 1) {
      for (let cx = c0x; cx <= c1x; cx += 1) {
        let s = cx * 73856093 ^ cy * 19349663 ^ 5059354;
        const chance = random01FromSeed(s);
        if (chance > 0.34) continue;
        const rx = random01FromSeed(s ^ 4779);
        const ry = random01FromSeed(s ^ 34765);
        const sx = (cx * cell + rx * cell - camX * 0.18 + cssW * 0.5) * dpr;
        const sy = (cy * cell + ry * cell - camY * 0.18 + cssH * 0.5) * dpr;
        const len = (34 + random01FromSeed(s ^ 39185) * 80) * dpr;
        ctx.strokeStyle = rgba(bg.line.r, bg.line.g, bg.line.b, 0.045);
        ctx.beginPath();
        ctx.moveTo(sx - len * 0.5, sy);
        ctx.lineTo(sx + len * 0.5, sy + len * 0.15);
        ctx.stroke();
      }
    }
  } else if (bg.pattern === "dust") {
    const gap = 86;
    const offset = ((camX * 0.08 + camY * 0.04) % gap + gap) % gap;
    ctx.strokeStyle = rgba(bg.line.r, bg.line.g, bg.line.b, 0.03);
    for (let x = -cssH; x < cssW + cssH; x += gap) {
      ctx.beginPath();
      ctx.moveTo((x + offset) * dpr, cssH * dpr);
      ctx.lineTo((x + cssH * 0.68 + offset) * dpr, 0);
      ctx.stroke();
    }
  } else if (bg.pattern === "wisps") {
    ctx.strokeStyle = rgba(bg.line.r, bg.line.g, bg.line.b, 0.04);
    const gap = 135;
    const offset = (camX * 0.05 % gap + gap) % gap;
    for (let x = -80; x < cssW + 120; x += gap) {
      ctx.beginPath();
      const y0 = cssH * (0.25 + 0.2 * Math.sin((x + camX * 0.025) * 0.02));
      ctx.moveTo((x + offset) * dpr, y0 * dpr);
      ctx.bezierCurveTo((x + 80 + offset) * dpr, (y0 + 95) * dpr, (x + 170 + offset) * dpr, (y0 - 60) * dpr, (x + 255 + offset) * dpr, (y0 + 28) * dpr);
      ctx.stroke();
    }
  } else if (bg.pattern === "ice") {
    ctx.strokeStyle = rgba(bg.line.r, bg.line.g, bg.line.b, 0.036);
    const gap = 120;
    const offset = ((camX * 0.07 - camY * 0.04) % gap + gap) % gap;
    for (let y = -40; y < cssH + 70; y += gap) {
      ctx.beginPath();
      ctx.moveTo(0, (y + offset) * dpr);
      ctx.lineTo(cssW * dpr, (y + 35 + offset) * dpr);
      ctx.stroke();
    }
  } else if (bg.pattern === "radiation") {
    const cx = (cssW * 0.5 + Math.sin(camX * 5e-4) * cssW * 0.18) * dpr;
    const cy = (cssH * 0.5 + Math.cos(camY * 5e-4) * cssH * 0.18) * dpr;
    ctx.strokeStyle = rgba(bg.line.r, bg.line.g, bg.line.b, 0.052);
    for (let r = 120; r < Math.max(cssW, cssH) * 0.9; r += 170) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * dpr, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (bg.pattern === "anomaly") {
    ctx.strokeStyle = rgba(bg.line.r, bg.line.g, bg.line.b, 0.056);
    const gap = 180;
    const offset = ((camX * 0.04 + camY * 0.03) % gap + gap) % gap;
    for (let x = -100; x < cssW + 140; x += gap) {
      ctx.beginPath();
      ctx.moveTo((x + offset) * dpr, cssH * dpr);
      ctx.quadraticCurveTo((x + cssH * 0.28 + offset) * dpr, cssH * 0.35 * dpr, (x + cssH * 0.75 + offset) * dpr, 0);
      ctx.stroke();
    }
  }
  ctx.restore();
}
function drawStars(ctx, view, camX, camY, density = 1, biome = null) {
  const { cssW, cssH, dpr } = view;
  const bg = backdropFor(biome);
  const biomeId = biomeIdFor(biome);
  fillBaseSpace(ctx, view, bg);
  drawLocalNebula(ctx, view, camX, camY, bg, biomeId);
  const cell = 240;
  const seed = 1337;
  const minX = camX - cssW * 0.7;
  const maxX = camX + cssW * 0.7;
  const minY = camY - cssH * 0.7;
  const maxY = camY + cssH * 0.7;
  const c0x = Math.floor(minX / cell);
  const c1x = Math.floor(maxX / cell);
  const c0y = Math.floor(minY / cell);
  const c1y = Math.floor(maxY / cell);
  for (let cy = c0y; cy <= c1y; cy++) {
    for (let cx = c0x; cx <= c1x; cx++) {
      let s = cx * 73856093 ^ cy * 19349663 ^ seed;
      for (let i = 0; i < Math.max(0, Math.round(5 * density)); i++) {
        s = xorshift(s);
        const rx = (s & 65535) / 65535;
        s = xorshift(s);
        const ry = (s & 65535) / 65535;
        s = xorshift(s);
        const rr = (s & 65535) / 65535;
        const sx = cx * cell + rx * cell - camX + cssW * 0.5;
        const sy = cy * cell + ry * cell - camY + cssH * 0.5;
        const size = 0.7 + rr * 1.5;
        const alpha = 0.15 + rr * 0.38;
        const sc = bg.star || { r: 210, g: 225, b: 240 };
        const tintMix = clamp01(0.1 + bg.haze * 0.9);
        const r = sc.r * (1 - tintMix) + bg.accent.r * tintMix;
        const g = sc.g * (1 - tintMix) + bg.accent.g * tintMix;
        const b = sc.b * (1 - tintMix) + bg.accent.b * tintMix;
        ctx.fillStyle = rgba(r, g, b, alpha);
        ctx.fillRect(sx * dpr, sy * dpr, size * dpr, size * dpr);
      }
    }
  }
  drawBiomePattern(ctx, view, camX, camY, bg, biomeId);
}
function drawGrid(ctx, view, camX, camY, world) {
  const { cssW, cssH, w, h, dpr } = view;
  const cell = 320;
  const startX = Math.floor((camX - cssW * 0.5) / cell) * cell;
  const endX = Math.floor((camX + cssW * 0.5) / cell) * cell;
  const startY = Math.floor((camY - cssH * 0.5) / cell) * cell;
  const endY = Math.floor((camY + cssH * 0.5) / cell) * cell;
  ctx.strokeStyle = rgba(35, 50, 68, 0.22);
  ctx.lineWidth = dpr;
  for (let x = startX; x <= endX; x += cell) {
    const sx = (x - camX + cssW * 0.5) * dpr;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, h);
    ctx.stroke();
  }
  for (let y = startY; y <= endY; y += cell) {
    const sy = (y - camY + cssH * 0.5) * dpr;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
    ctx.stroke();
  }
  const tl = worldToScreen(camX, camY, -world.halfW, -world.halfH, cssW, cssH);
  const br = worldToScreen(camX, camY, world.halfW, world.halfH, cssW, cssH);
  ctx.strokeStyle = rgba(70, 110, 145, 0.35);
  ctx.lineWidth = 2 * dpr;
  ctx.strokeRect(tl.x * dpr, tl.y * dpr, (br.x - tl.x) * dpr, (br.y - tl.y) * dpr);
}

// client/src/core/Colors.js
var COLORS = {
  hull: { r: 208, g: 223, b: 232 },
  outline: { r: 130, g: 225, b: 255 },
  fx: { r: 120, g: 220, b: 255 },
  core: { r: 235, g: 242, b: 255 },
  shield: { r: 120, g: 180, b: 255 },
  thrusterInner: { r: 245, g: 250, b: 255 },
  hp: { r: 235, g: 110, b: 110 },
  energy: { r: 90, g: 255, b: 195 },
  dock: { r: 176, g: 120, b: 255 },
  warning: { r: 255, g: 180, b: 110 }
};

// client/src/render/GroundMarkerRenderer.js
function drawGroundMarker(ctx, view, player, camX, camY, t) {
  if (!player || player.groundMarkerTimer <= 0) return;
  const s = worldToScreen(camX, camY, player.groundMarkerX, player.groundMarkerY, view.cssW, view.cssH);
  const alpha = clamp(player.groundMarkerTimer / 0.85, 0, 1);
  const pulse = 1 + 0.18 * Math.sin(t * 12);
  const r = 10 * pulse;
  ctx.strokeStyle = rgba(COLORS.fx.r, COLORS.fx.g, COLORS.fx.b, 0.75 * alpha);
  ctx.lineWidth = 2 * view.dpr;
  ctx.beginPath();
  ctx.arc(s.x * view.dpr, s.y * view.dpr, r * view.dpr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo((s.x - r - 5) * view.dpr, s.y * view.dpr);
  ctx.lineTo((s.x + r + 5) * view.dpr, s.y * view.dpr);
  ctx.moveTo(s.x * view.dpr, (s.y - r - 5) * view.dpr);
  ctx.lineTo(s.x * view.dpr, (s.y + r + 5) * view.dpr);
  ctx.stroke();
}

// client/src/render/SelectionRenderer.js
function drawSelectionRing(ctx, view, x, y, r, color2, camX, camY) {
  const s = worldToScreen(camX, camY, x, y, view.cssW, view.cssH);
  ctx.strokeStyle = color2;
  ctx.lineWidth = 2 * view.dpr;
  ctx.beginPath();
  ctx.arc(s.x * view.dpr, s.y * view.dpr, (r + 8) * view.dpr, 0, Math.PI * 2);
  ctx.stroke();
}

// client/src/station/StationRenderer.js
function drawStation(ctx, view, s, camX, camY, t) {
  const p = worldToScreen(camX, camY, s.x, s.y, view.cssW, view.cssH);
  const pulse = 0.55 + 0.45 * Math.sin(t * 2.6 + s.pulse);
  const base = s.specialtyId === "pirate" ? { r: 255, g: 86, b: 92 } : s.tech ? { r: 160, g: 100, b: 255 } : { r: 92, g: 142, b: 214 };
  ctx.fillStyle = rgba(base.r, base.g, base.b, 0.82);
  ctx.beginPath();
  ctx.arc(p.x * view.dpr, p.y * view.dpr, s.radius * view.dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(255, 255, 255, 0.95);
  ctx.lineWidth = 2 * view.dpr;
  ctx.stroke();
  const ringR = s.radius + 10 + 2.2 * pulse;
  ctx.strokeStyle = rgba(255, 255, 255, 0.45);
  ctx.lineWidth = 1.6 * view.dpr;
  ctx.beginPath();
  ctx.arc(p.x * view.dpr, p.y * view.dpr, ringR * view.dpr, 0, Math.PI * 2);
  ctx.stroke();
  const rot = t * 0.85;
  for (let i = 0; i < 4; i++) {
    const a = rot + i * Math.PI * 0.5;
    const lx = p.x + Math.cos(a) * ringR;
    const ly = p.y + Math.sin(a) * ringR;
    ctx.fillStyle = rgba(255, 255, 255, 0.7 + pulse * 0.2);
    ctx.beginPath();
    ctx.arc(lx * view.dpr, ly * view.dpr, 2.2 * view.dpr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = rgba(255, 255, 255, 0.9);
  ctx.lineWidth = 2 * view.dpr;
  if (s.specialtyId === "pirate") {
    ctx.beginPath();
    ctx.moveTo((p.x - 10) * view.dpr, (p.y + 7) * view.dpr);
    ctx.lineTo(p.x * view.dpr, (p.y - 10) * view.dpr);
    ctx.lineTo((p.x + 10) * view.dpr, (p.y + 7) * view.dpr);
    ctx.closePath();
    ctx.stroke();
  } else if (s.tech) {
    ctx.strokeRect((p.x - 8) * view.dpr, (p.y - 8) * view.dpr, 16 * view.dpr, 16 * view.dpr);
  } else {
    ctx.beginPath();
    ctx.arc(p.x * view.dpr, p.y * view.dpr, 9 * view.dpr, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// client/src/structures/StructureRenderer.js
function worldToScreen2(view, x, y, camX, camY) {
  return {
    x: (x - camX + view.cssW * 0.5) * view.dpr,
    y: (y - camY + view.cssH * 0.5) * view.dpr
  };
}
function ownerPalette(s) {
  if (s.owned) {
    return {
      fill: "rgba(64, 174, 219, 0.16)",
      edge: "rgba(124, 232, 255, 0.82)",
      claimFill: "rgba(68, 218, 190, 0.045)",
      claimEdge: "rgba(104, 245, 215, 0.34)",
      grid: "rgba(130, 255, 226, 0.09)"
    };
  }
  return {
    fill: "rgba(196, 54, 66, 0.12)",
    edge: "rgba(255, 96, 106, 0.78)",
    claimFill: "rgba(255, 66, 82, 0.04)",
    claimEdge: "rgba(255, 80, 94, 0.34)",
    grid: "rgba(255, 98, 112, 0.08)"
  };
}
function drawStructureBar(ctx, view, s, sx, sy) {
  if (!s?.damageable || !s.vitals) return;
  const hp = s.vitals?.hp ?? 0;
  const maxHp = Math.max(1, s.vitals?.maxHp ?? 1);
  const pct3 = Math.max(0, Math.min(1, hp / maxHp));
  const w = Math.max(46, Math.min(92, (s.w || s.radius * 2) * 0.5)) * view.dpr;
  const h = 4 * view.dpr;
  const x = sx - w * 0.5;
  const y = sy - ((s.h || s.radius * 2) * 0.5 + 14) * view.dpr;
  ctx.save();
  ctx.fillStyle = "rgba(5,9,14,0.72)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = pct3 > 0.45 ? "rgba(114,235,194,0.9)" : pct3 > 0.18 ? "rgba(255,204,96,0.92)" : "rgba(255,104,104,0.95)";
  ctx.fillRect(x, y, w * pct3, h);
  ctx.restore();
}
function roundedRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
}
function drawClaimSquare(ctx, view, s, camX, camY) {
  const half = Number(s.claimRadius) || 0;
  if (!half) return;
  const p = worldToScreen2(view, s.x || 0, s.y || 0, camX, camY);
  const size = half * 2 * view.dpr;
  const pal = ownerPalette(s);
  ctx.save();
  ctx.fillStyle = pal.claimFill;
  ctx.strokeStyle = pal.claimEdge;
  ctx.lineWidth = 1.2 * view.dpr;
  ctx.setLineDash([16 * view.dpr, 12 * view.dpr]);
  ctx.fillRect(p.x - size * 0.5, p.y - size * 0.5, size, size);
  ctx.strokeRect(p.x - size * 0.5, p.y - size * 0.5, size, size);
  ctx.setLineDash([]);
  ctx.restore();
}
function drawBuildGrid(ctx, view, camX, camY, gridSize = 64) {
  const g = gridSize * view.dpr;
  const startX = (-(camX % gridSize + gridSize) % gridSize + view.cssW * 0.5 % gridSize) * view.dpr;
  const startY = (-(camY % gridSize + gridSize) % gridSize + view.cssH * 0.5 % gridSize) * view.dpr;
  ctx.save();
  ctx.strokeStyle = "rgba(132, 226, 255, 0.105)";
  ctx.lineWidth = 1 * view.dpr;
  for (let x = startX - g * 2; x < view.w + g * 2; x += g) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, view.h);
    ctx.stroke();
  }
  for (let y = startY - g * 2; y < view.h + g * 2; y += g) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(view.w, y);
    ctx.stroke();
  }
  ctx.restore();
}
function drawFootprintCells(ctx, view, w, h, tilesX, tilesY) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1 * view.dpr;
  for (let i = 1; i < tilesX; i += 1) {
    const x = -w * 0.5 + w / tilesX * i;
    ctx.beginPath();
    ctx.moveTo(x, -h * 0.5);
    ctx.lineTo(x, h * 0.5);
    ctx.stroke();
  }
  for (let i = 1; i < tilesY; i += 1) {
    const y = -h * 0.5 + h / tilesY * i;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, y);
    ctx.lineTo(w * 0.5, y);
    ctx.stroke();
  }
  ctx.restore();
}
function drawStructure(ctx, view, s, camX, camY, t = 0) {
  if (!s) return;
  if (s.type === "base_core") drawClaimSquare(ctx, view, s, camX, camY);
  const p = worldToScreen2(view, s.x || 0, s.y || 0, camX, camY);
  const w = (s.w || s.radius * 2 || 80) * view.dpr;
  const h = (s.h || s.radius * 2 || 80) * view.dpr;
  const pal = ownerPalette(s);
  const edge = pal.edge;
  const fill = s.type === "wall" ? s.owned ? "rgba(38, 55, 72, .74)" : "rgba(72, 34, 40, .70)" : pal.fill;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = edge;
  ctx.shadowBlur = s.type === "wall" ? 5 * view.dpr : 8 * view.dpr;
  ctx.fillStyle = fill;
  ctx.strokeStyle = edge;
  ctx.lineWidth = (s.owned ? 1.8 : 1.6) * view.dpr;
  if (s.type === "base_core") {
    const rr = 18 * view.dpr;
    ctx.beginPath();
    roundedRect(ctx, -w * 0.5, -h * 0.5, w, h, rr);
    ctx.fill();
    ctx.stroke();
    drawFootprintCells(ctx, view, w, h, 2, 2);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = s.owned ? "rgba(176,246,255,.34)" : "rgba(255,150,150,.32)";
    ctx.lineWidth = 1.6 * view.dpr;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.36);
    ctx.lineTo(w * 0.32, -h * 0.16);
    ctx.lineTo(w * 0.32, h * 0.18);
    ctx.lineTo(0, h * 0.38);
    ctx.lineTo(-w * 0.32, h * 0.18);
    ctx.lineTo(-w * 0.32, -h * 0.16);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(w, h) * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = s.owned ? "rgba(126,232,255,.18)" : "rgba(255,120,130,.15)";
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(w, h) * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else if (s.type === "wall") {
    const rr = Math.min(9 * view.dpr, Math.min(w, h) * 0.24);
    ctx.beginPath();
    roundedRect(ctx, -w * 0.5, -h * 0.5, w, h, rr);
    ctx.fill();
    ctx.stroke();
    drawFootprintCells(ctx, view, w, h, w > h ? 3 : 1, h > w ? 3 : 1);
  } else {
    const rr = 14 * view.dpr;
    ctx.beginPath();
    roundedRect(ctx, -w * 0.5, -h * 0.5, w, h, rr);
    ctx.fill();
    ctx.stroke();
    drawFootprintCells(ctx, view, w, h, 2, 2);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = s.owned ? "rgba(145,255,220,.32)" : "rgba(255,130,130,.30)";
    ctx.lineWidth = 1.4 * view.dpr;
    ctx.beginPath();
    ctx.moveTo(-w * 0.34, -h * 0.22);
    ctx.lineTo(0, -h * 0.4);
    ctx.lineTo(w * 0.34, -h * 0.22);
    ctx.lineTo(w * 0.34, h * 0.24);
    ctx.lineTo(0, h * 0.42);
    ctx.lineTo(-w * 0.34, h * 0.24);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w * 0.34, -h * 0.22);
    ctx.lineTo(0, 0);
    ctx.lineTo(w * 0.34, -h * 0.22);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, h * 0.42);
    ctx.stroke();
  }
  ctx.restore();
  drawStructureBar(ctx, view, s, p.x, p.y);
}
function drawStructureBuildPreview(ctx, view, preview, camX, camY, t = 0) {
  if (!preview) return;
  drawBuildGrid(ctx, view, camX, camY, preview.gridSize || 64);
  const p = worldToScreen2(view, preview.x || 0, preview.y || 0, camX, camY);
  const w = (preview.w || preview.radius * 2 || 80) * view.dpr;
  const h = (preview.h || preview.radius * 2 || 80) * view.dpr;
  const ok = !!preview.ok;
  const demolish = preview.mode === "demolish";
  const repair = preview.mode === "repair";
  const main = demolish ? ok ? "rgba(255, 120, 120, 0.16)" : "rgba(255, 92, 92, 0.08)" : repair ? ok ? "rgba(255, 210, 94, 0.18)" : "rgba(255, 92, 92, 0.08)" : ok ? "rgba(101, 241, 200, 0.22)" : "rgba(255, 92, 92, 0.20)";
  const edge = demolish ? "rgba(255, 124, 124, 0.95)" : repair ? ok ? "rgba(255, 218, 112, 0.95)" : "rgba(255, 112, 112, 0.95)" : ok ? "rgba(117, 255, 215, 0.92)" : "rgba(255, 112, 112, 0.95)";
  const pulse = 0.55 + 0.45 * Math.sin(t * 5.2);
  const claim = preview.type === "base_core" ? { x: preview.x, y: preview.y, half: preview.claimRadius || 0 } : preview.ownCore ? { x: preview.ownCore.x, y: preview.ownCore.y, half: preview.ownCore.claimRadius || 0 } : null;
  if (claim?.half) {
    const cp = worldToScreen2(view, claim.x, claim.y, camX, camY);
    const size = claim.half * 2 * view.dpr;
    ctx.save();
    ctx.fillStyle = ok ? "rgba(75, 244, 202, 0.045)" : "rgba(255, 86, 86, 0.035)";
    ctx.strokeStyle = ok ? "rgba(92, 255, 214, 0.34)" : "rgba(255, 104, 104, 0.28)";
    ctx.lineWidth = 1.2 * view.dpr;
    ctx.setLineDash([18 * view.dpr, 12 * view.dpr]);
    ctx.fillRect(cp.x - size * 0.5, cp.y - size * 0.5, size, size);
    ctx.strokeRect(cp.x - size * 0.5, cp.y - size * 0.5, size, size);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = edge;
  ctx.shadowBlur = (demolish || repair ? 4 : 6 + pulse * 7) * view.dpr;
  ctx.fillStyle = main;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2 * view.dpr;
  ctx.setLineDash([9 * view.dpr, 6 * view.dpr]);
  const rr = Math.min(14 * view.dpr, Math.min(w, h) * 0.24);
  ctx.beginPath();
  roundedRect(ctx, -w * 0.5, -h * 0.5, w, h, rr);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  drawFootprintCells(ctx, view, w, h, preview.tilesX || 1, preview.tilesY || 1);
  if (!ok) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 130, 130, 0.95)";
    ctx.lineWidth = 3 * view.dpr;
    ctx.beginPath();
    ctx.moveTo(-w * 0.26, -h * 0.26);
    ctx.lineTo(w * 0.26, h * 0.26);
    ctx.moveTo(w * 0.26, -h * 0.26);
    ctx.lineTo(-w * 0.26, h * 0.26);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.font = `${11 * view.dpr}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const label = preview.ok ? preview.title : preview.reason || "Impossible";
  const tw = ctx.measureText(label).width;
  const lx = p.x;
  const ly = p.y - h * 0.5 - 10 * view.dpr;
  ctx.fillStyle = "rgba(4, 8, 13, 0.82)";
  ctx.fillRect(lx - tw * 0.5 - 8 * view.dpr, ly - 15 * view.dpr, tw + 16 * view.dpr, 17 * view.dpr);
  ctx.strokeStyle = preview.ok ? "rgba(117,255,215,.42)" : "rgba(255,112,112,.5)";
  ctx.strokeRect(lx - tw * 0.5 - 8 * view.dpr, ly - 15 * view.dpr, tw + 16 * view.dpr, 17 * view.dpr);
  ctx.fillStyle = preview.ok ? "rgba(210, 255, 240, 0.94)" : "rgba(255, 206, 206, 0.94)";
  ctx.fillText(label, lx, ly - 2 * view.dpr);
  ctx.restore();
}

// client/src/portal/PortalRenderer.js
function portalPalette(p) {
  if (p.mode === "test_arena") return { a: { r: 255, g: 204, b: 92 }, b: { r: 98, g: 232, b: 255 }, label: "Simulateur" };
  if (p.mode === "bastion_entry" || p.mode === "bastion_exit" || p.mode === "bastion_locator") {
    const c = p.bastionColor || { r: 250, g: 214, b: 120 };
    return { a: c, b: { r: 255, g: 245, b: 180 }, label: p.label || "Bastion" };
  }
  return { a: { r: 140, g: 210, b: 255 }, b: { r: 198, g: 128, b: 255 }, label: p.label || `[${p.targetSx},${p.targetSy}]` };
}
function drawPortals(ctx, view, store, camX, camY) {
  const t = performance.now() / 1e3;
  for (const p of store.portals.values()) {
    const s = worldToScreen(camX, camY, p.x, p.y, view.cssW, view.cssH);
    const r = p.radius ?? 38;
    const pal = portalPalette(p);
    const dpr = view.dpr;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.2 + p.id * 0.11);
    ctx.save();
    ctx.translate(s.x * dpr, s.y * dpr);
    ctx.rotate(t * (p.mode === "test_arena" ? 0.62 : 0.38));
    ctx.strokeStyle = rgba(pal.b.r, pal.b.g, pal.b.b, 0.14 + 0.12 * pulse);
    ctx.lineWidth = 13 * dpr;
    ctx.beginPath();
    ctx.arc(0, 0, (r + 7) * dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([10 * dpr, 8 * dpr]);
    ctx.strokeStyle = rgba(pal.a.r, pal.a.g, pal.a.b, 0.7);
    ctx.lineWidth = 2.4 * dpr;
    ctx.beginPath();
    ctx.arc(0, 0, r * dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.rotate(-t * 1.18);
    ctx.strokeStyle = rgba(pal.b.r, pal.b.g, pal.b.b, 0.45 + 0.28 * pulse);
    ctx.lineWidth = 2 * dpr;
    for (let i = 0; i < 4; i += 1) {
      const a = i * Math.PI * 0.5 + t * 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, (r - 8) * dpr, a, a + 0.55);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(230, 245, 255, 0.96);
    ctx.font = `${p.mode === "test_arena" || p.mode === "bastion_entry" ? 22 * dpr : 18 * dpr}px ui-sans-serif, system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.glyph ?? "?", 0, 1 * dpr);
    ctx.restore();
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `${12 * dpr}px ui-sans-serif, system-ui`;
    ctx.fillStyle = rgba(6, 9, 14, 0.72);
    const label = p.label || pal.label;
    const y = (s.y + r + 8) * dpr;
    const w = Math.max(70, ctx.measureText(label).width / dpr + 14) * dpr;
    ctx.fillRect(s.x * dpr - w * 0.5, y - 2 * dpr, w, 20 * dpr);
    ctx.strokeStyle = rgba(pal.a.r, pal.a.g, pal.a.b, 0.42);
    ctx.strokeRect(s.x * dpr - w * 0.5, y - 2 * dpr, w, 20 * dpr);
    ctx.fillStyle = rgba(235, 244, 255, 0.88);
    ctx.fillText(label, s.x * dpr, y + 2 * dpr);
    ctx.restore();
    if (p.mode === "bastion_entry" && !p.unlocked && p.unlockText) {
      const txt = String(p.unlockText).replace("Ouvre dans ", "");
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.font = `${13 * dpr}px ui-sans-serif, system-ui`;
      const ty = (s.y - r - 12) * dpr;
      const tw = Math.max(62, ctx.measureText(txt).width / dpr + 18) * dpr;
      ctx.fillStyle = rgba(8, 8, 12, 0.78);
      ctx.fillRect(s.x * dpr - tw * 0.5, ty - 20 * dpr, tw, 20 * dpr);
      ctx.strokeStyle = rgba(pal.a.r, pal.a.g, pal.a.b, 0.55);
      ctx.strokeRect(s.x * dpr - tw * 0.5, ty - 20 * dpr, tw, 20 * dpr);
      ctx.fillStyle = rgba(255, 218, 130, 0.96);
      ctx.fillText(txt, s.x * dpr, ty - 4 * dpr);
      ctx.restore();
    }
  }
}

// client/src/asteroid/AsteroidShape.js
function asteroidPoints(a, screen) {
  const points = 6 + a.shapeSeed % 5;
  const innerMul = 0.58 + a.shapeSeed * 17 % 23 / 100;
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

// client/src/ui/worldbars/WorldHealthBarRenderer.js
function drawSingleBar(ctx, view, x, y, width, height, ratio, palette) {
  ctx.fillStyle = rgba(palette.back.r, palette.back.g, palette.back.b, palette.back.a ?? 0.72);
  ctx.fillRect(x * view.dpr, y * view.dpr, width * view.dpr, height * view.dpr);
  ctx.fillStyle = rgba(palette.fill.r, palette.fill.g, palette.fill.b, 0.95);
  ctx.fillRect(x * view.dpr, y * view.dpr, width * ratio * view.dpr, height * view.dpr);
}
function drawWorldHealthBars(ctx, view, entity, camX, camY, config) {
  const vitals = entity?.vitals;
  if (!vitals || !config?.bars?.length) return;
  const screen = worldToScreen(camX, camY, entity.x, entity.y, view.cssW, view.cssH);
  const width = config.width;
  const x = screen.x - width * 0.5;
  let y = screen.y + (config.offsetY ?? 0);
  for (const bar of config.bars) {
    const value = vitals[bar.valueKey] ?? 0;
    const maxValue = Math.max(1, vitals[bar.maxKey] ?? 0);
    const ratio = clamp(value / maxValue, 0, 1);
    if (!bar.showWhenZero && ratio <= 0) {
      y += (bar.height ?? 4) + (bar.gapAfter ?? 0);
      continue;
    }
    drawSingleBar(ctx, view, x, y, width, bar.height ?? 4, ratio, bar.palette);
    y += (bar.height ?? 4) + (bar.gapAfter ?? 0);
  }
}

// client/src/ui/worldbars/WorldBarPalettes.js
var WORLD_BAR_PALETTES = {
  hp: {
    fill: COLORS.hp,
    back: { r: 8, g: 10, b: 14, a: 0.74 }
  },
  shield: {
    fill: COLORS.shield,
    back: { r: 8, g: 10, b: 14, a: 0.66 }
  },
  asteroidHp: {
    fill: { r: 255, g: 206, b: 120 },
    back: { r: 10, g: 12, b: 16, a: 0.72 }
  }
};

// client/src/asteroid/AsteroidWorldBarStyle.js
function getAsteroidWorldBarStyle(asteroid) {
  return {
    width: Math.max(34, asteroid.radius * 2.1),
    offsetY: -asteroid.radius - 18,
    bars: [
      { valueKey: "hp", maxKey: "maxHp", height: 4, gapAfter: 0, palette: WORLD_BAR_PALETTES.asteroidHp, showWhenZero: true }
    ]
  };
}

// client/src/asteroid/AsteroidLabelRenderer.js
function drawAsteroidLabel(ctx, view, a, camX, camY) {
  const name = a?.resourceName || "";
  if (!name) return;
  const p = worldToScreen(camX, camY, a.x, a.y, view.cssW, view.cssH);
  const y = p.y - (a.radius || 0) - 26;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `${12 * view.dpr}px Segoe UI`;
  const tw = ctx.measureText(name).width / view.dpr;
  ctx.fillStyle = rgba(3, 6, 11, 0.7);
  ctx.fillRect((p.x - tw * 0.5 - 6) * view.dpr, (y - 13) * view.dpr, (tw + 12) * view.dpr, 17 * view.dpr);
  ctx.strokeStyle = rgba(255, 216, 120, 0.2);
  ctx.lineWidth = view.dpr;
  ctx.strokeRect((p.x - tw * 0.5 - 6) * view.dpr, (y - 13) * view.dpr, (tw + 12) * view.dpr, 17 * view.dpr);
  ctx.fillStyle = rgba(245, 250, 255, 0.98);
  ctx.fillText(name, p.x * view.dpr, y * view.dpr);
}

// client/src/asteroid/AsteroidRenderer.js
function drawAsteroid(ctx, view, a, camX, camY) {
  const screen = worldToScreen(camX, camY, a.x, a.y, view.cssW, view.cssH);
  if (a.bastionWall) {
    const c = a.color ?? { r: 34, g: 38, b: 50 };
    const b = a.borderColor ?? { r: 236, g: 190, b: 92 };
    const w = Math.max(12, (a.w || a.radius * 2) * view.dpr);
    const h = Math.max(12, (a.h || a.radius * 2) * view.dpr);
    const x = screen.x * view.dpr - w * 0.5;
    const y = screen.y * view.dpr - h * 0.5;
    const t = performance.now() / 1e3;
    ctx.save();
    ctx.fillStyle = rgba(c.r, c.g, c.b, 0.94);
    ctx.strokeStyle = rgba(b.r, b.g, b.b, 0.52 + 0.12 * Math.sin(t * 2.4 + a.id));
    ctx.lineWidth = 2 * view.dpr;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8 * view.dpr);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = rgba(255, 255, 255, 0.45);
    ctx.lineWidth = 1 * view.dpr;
    const step = 44 * view.dpr;
    for (let xx = x - h; xx < x + w + h; xx += step) {
      ctx.beginPath();
      ctx.moveTo(xx, y + h);
      ctx.lineTo(xx + h, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(b.r, b.g, b.b, 0.1);
    ctx.beginPath();
    ctx.roundRect(x + 5 * view.dpr, y + 5 * view.dpr, Math.max(1, w - 10 * view.dpr), Math.max(1, h - 10 * view.dpr), 6 * view.dpr);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (a.testCore) {
    const c = a.color ?? { r: 190, g: 210, b: 255 };
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 280 + a.id);
    ctx.save();
    ctx.fillStyle = rgba(6, 10, 15, 0.86);
    ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.56 + 0.24 * pulse);
    ctx.lineWidth = 2 * view.dpr;
    ctx.beginPath();
    ctx.arc(screen.x * view.dpr, screen.y * view.dpr, a.radius * view.dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.42);
    ctx.setLineDash([4 * view.dpr, 4 * view.dpr]);
    ctx.beginPath();
    ctx.arc(screen.x * view.dpr, screen.y * view.dpr, (a.radius + 7 + pulse * 3) * view.dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = rgba(c.r, c.g, c.b, 0.88);
    ctx.beginPath();
    ctx.arc(screen.x * view.dpr, screen.y * view.dpr, 4.2 * view.dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawWorldHealthBars(ctx, view, a, camX, camY, getAsteroidWorldBarStyle(a));
    drawAsteroidLabel(ctx, view, a, camX, camY);
    return;
  }
  const pts = asteroidPoints(a, screen);
  ctx.fillStyle = rgba(a.color.r, a.color.g, a.color.b, 0.72);
  ctx.beginPath();
  ctx.moveTo(pts[0].x * view.dpr, pts[0].y * view.dpr);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * view.dpr, pts[i].y * view.dpr);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(a.color.r + 45, a.color.g + 30, a.color.b + 30, 0.95);
  ctx.lineWidth = 2 * view.dpr;
  ctx.stroke();
  drawWorldHealthBars(ctx, view, a, camX, camY, getAsteroidWorldBarStyle(a));
  drawAsteroidLabel(ctx, view, a, camX, camY);
}

// client/src/projectile/ProjectileRenderer.js
function ammoColor(p) {
  if (p.visualAmmoEffect === "slow") return { r: 112, g: 190, b: 255 };
  if (p.visualAmmoEffect === "burn") return { r: 255, g: 142, b: 72 };
  if (p.visualAmmoEffect === "poison") return { r: 102, g: 225, b: 120 };
  if (p.visualAmmoEffect === "stun") return { r: 255, g: 224, b: 122 };
  return p.tint ?? { r: 255, g: 176, b: 72 };
}
function drawRocket(ctx, view, p, s) {
  const dpr = view.dpr;
  const vlen = Math.hypot(p.vx || 0, p.vy || 0);
  const a = vlen > 0.01 ? Math.atan2(p.vy, p.vx) : 0;
  const c = ammoColor(p);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const body = Math.max(12, (p.radius || 6) * 2.25);
  const w = Math.max(5, (p.radius || 6) * 0.92);
  const x = s.x * dpr;
  const y = s.y * dpr;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  const pulse = 0.68 + 0.32 * Math.sin(performance.now() * 0.024 + p.id * 0.4);
  ctx.fillStyle = rgba(255, 190, 80, 0.22 * pulse);
  ctx.beginPath();
  ctx.ellipse(-body * 0.92 * dpr, 0, body * 0.72 * dpr, w * 0.86 * dpr, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(255, 122, 44, 0.58 * pulse);
  ctx.beginPath();
  ctx.moveTo(-body * 0.48 * dpr, 0);
  ctx.lineTo(-body * 1.28 * dpr, -w * 0.52 * dpr);
  ctx.lineTo(-body * 1.06 * dpr, 0);
  ctx.lineTo(-body * 1.28 * dpr, w * 0.52 * dpr);
  ctx.closePath();
  ctx.fill();
  const grad = ctx.createLinearGradient(-body * 0.55 * dpr, 0, body * 0.58 * dpr, 0);
  grad.addColorStop(0, rgba(c.r, c.g, c.b, 0.82));
  grad.addColorStop(0.45, rgba(235, 240, 244, 0.97));
  grad.addColorStop(1, rgba(255, 255, 255, 0.98));
  ctx.fillStyle = grad;
  ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.85);
  ctx.lineWidth = 1.4 * dpr;
  ctx.beginPath();
  ctx.moveTo(body * 0.62 * dpr, 0);
  ctx.lineTo(body * 0.28 * dpr, -w * 0.56 * dpr);
  ctx.lineTo(-body * 0.5 * dpr, -w * 0.5 * dpr);
  ctx.lineTo(-body * 0.66 * dpr, 0);
  ctx.lineTo(-body * 0.5 * dpr, w * 0.5 * dpr);
  ctx.lineTo(body * 0.28 * dpr, w * 0.56 * dpr);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = rgba(c.r, c.g, c.b, 0.9);
  ctx.beginPath();
  ctx.arc(body * 0.2 * dpr, 0, Math.max(1.8, w * 0.28) * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (p.splashRadius > 0) {
    ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.12);
    ctx.lineWidth = 1.2 * dpr;
    ctx.beginPath();
    ctx.arc(x, y, p.splashRadius * 0.18 * dpr, 0, Math.PI * 2);
    ctx.stroke();
  }
}
function drawAbilityProjectile(ctx, view, p, s) {
  const dpr = view.dpr;
  const c = p.tint ?? { r: 130, g: 225, b: 255 };
  const r = Math.max(3.5, p.radius || 3.5);
  const x = s.x * dpr;
  const y = s.y * dpr;
  const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.018 + p.id);
  ctx.fillStyle = rgba(c.r, c.g, c.b, 0.16 * pulse);
  ctx.beginPath();
  ctx.arc(x, y, r * 3.2 * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.88);
  ctx.lineWidth = 1.8 * dpr;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.55 * dpr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = rgba(245, 255, 255, 0.96);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.82 * dpr, 0, Math.PI * 2);
  ctx.fill();
}
function drawProjectile(ctx, view, p, camX, camY) {
  const s = worldToScreen(camX, camY, p.x, p.y, view.cssW, view.cssH);
  if (p.visualKind === "rocket") {
    drawRocket(ctx, view, p, s);
    return;
  }
  if (p.visualKind === "ability" || p.sourceAbilitySlot) {
    drawAbilityProjectile(ctx, view, p, s);
    return;
  }
  const mobShot = p.sourceKind === "mob" || String(p.visualKind || "").startsWith("mob_");
  const c = p.empoweredAutoUsed ? { r: 255, g: 210, b: 92 } : p.ultAutoUsed ? { r: 255, g: 116, b: 238 } : p.tint ?? { r: 130, g: 225, b: 255 };
  if (p.empoweredAutoUsed || p.ultAutoUsed) {
    ctx.fillStyle = rgba(c.r, c.g, c.b, 0.16);
    ctx.beginPath();
    ctx.arc(s.x * view.dpr, s.y * view.dpr, (p.radius + 11) * view.dpr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = rgba(c.r, c.g, c.b, p.crit ? 1 : 0.95);
  ctx.beginPath();
  ctx.arc(s.x * view.dpr, s.y * view.dpr, p.radius * (mobShot ? 0.82 : 1) * (p.crit ? 1.35 : 1) * view.dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(c.r, c.g, c.b, mobShot ? 0.18 : p.crit || p.empoweredAutoUsed || p.ultAutoUsed ? 0.72 : 0.26);
  ctx.lineWidth = (p.crit || p.empoweredAutoUsed || p.ultAutoUsed ? 2 : 1) * view.dpr;
  ctx.beginPath();
  ctx.arc(s.x * view.dpr, s.y * view.dpr, (p.radius + (mobShot ? 2.5 : p.crit ? 8 : 5)) * view.dpr, 0, Math.PI * 2);
  ctx.stroke();
}

// client/src/loot/LootRenderer.js
function drawLoot(ctx, view, loot, camX, camY) {
  const s = worldToScreen(camX, camY, loot.x, loot.y, view.cssW, view.cssH);
  const r = loot.radius || 6;
  ctx.save();
  if (loot.itemId || loot.bastionReward) {
    ctx.shadowColor = rgba(loot.color?.r ?? 255, loot.color?.g ?? 205, loot.color?.b ?? 98, 0.55);
    ctx.shadowBlur = 16 * view.dpr;
  }
  ctx.fillStyle = rgba(loot.color?.r ?? 169, loot.color?.g ?? 169, loot.color?.b ?? 169, 0.96);
  ctx.beginPath();
  ctx.arc(s.x * view.dpr, s.y * view.dpr, r * view.dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(255, 255, 255, 0.22);
  ctx.beginPath();
  ctx.arc((s.x - r * 0.28) * view.dpr, (s.y - r * 0.28) * view.dpr, r * 0.34 * view.dpr, 0, Math.PI * 2);
  ctx.fill();
  if (loot.itemId || loot.bastionReward) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(255, 245, 180, 0.9);
    ctx.lineWidth = 2 * view.dpr;
    ctx.strokeRect((s.x - r * 0.8) * view.dpr, (s.y - r * 0.55) * view.dpr, r * 1.6 * view.dpr, r * 1.1 * view.dpr);
    ctx.fillStyle = rgba(5, 8, 13, 0.72);
    ctx.fillRect((s.x - 48) * view.dpr, (s.y - r - 28) * view.dpr, 96 * view.dpr, 18 * view.dpr);
    ctx.strokeStyle = rgba(255, 220, 120, 0.35);
    ctx.strokeRect((s.x - 48) * view.dpr, (s.y - r - 28) * view.dpr, 96 * view.dpr, 18 * view.dpr);
    ctx.fillStyle = rgba(255, 235, 165, 0.96);
    ctx.font = `${10 * view.dpr}px Segoe UI`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(loot.itemName || "Coffre bastion", s.x * view.dpr, (s.y - r - 19) * view.dpr);
  }
  ctx.restore();
}

// client/src/entities/ship/ShipWorldBarStyle.js
var SHIP_WORLD_BAR_STYLE = {
  width: 34,
  offsetY: 28,
  bars: [
    { valueKey: "hp", maxKey: "maxHp", height: 4, gapAfter: 1, palette: WORLD_BAR_PALETTES.hp, showWhenZero: true },
    { valueKey: "shield", maxKey: "maxShield", height: 3, gapAfter: 0, palette: WORLD_BAR_PALETTES.shield, showWhenZero: true }
  ]
};

// client/src/entities/ship/ShipFramePalette.js
function getShipFramePalette(frameId) {
  if (frameId === "sigil") {
    return {
      hull: { r: 214, g: 205, b: 242 },
      outline: { r: 184, g: 140, b: 255 },
      core: { r: 240, g: 230, b: 255 }
    };
  }
  if (frameId === "bulwark") {
    return {
      hull: { r: 224, g: 215, b: 196 },
      outline: { r: 255, g: 186, b: 104 },
      core: { r: 255, g: 235, b: 196 }
    };
  }
  return {
    hull: { r: 208, g: 223, b: 232 },
    outline: { r: 130, g: 225, b: 255 },
    core: { r: 235, g: 242, b: 255 }
  };
}

// client/src/ui/session/SessionShipVisuals.js
function profile(frameId) {
  if (frameId === "sigil") {
    return { ring: 2.05, core: 0.46, spread: 0.68, thrust: 1.34, centerThruster: false };
  }
  if (frameId === "bulwark") {
    return { ring: 2.42, core: 0.62, spread: 0.5, thrust: 1.04, centerThruster: true };
  }
  return { ring: 2, core: 0.46, spread: 0.58, thrust: 1.6, centerThruster: false };
}
function getSessionShipPoints(frameId, cx, cy, radius, angle) {
  if (frameId === "sigil") {
    return [
      polar(cx, cy, radius + 7, angle),
      polar(cx, cy, radius + 1, angle + 0.48),
      polar(cx, cy, radius - 1, angle + 1.64),
      polar(cx, cy, radius + 2, angle + Math.PI),
      polar(cx, cy, radius - 1, angle - 1.64),
      polar(cx, cy, radius + 1, angle - 0.48)
    ];
  }
  if (frameId === "bulwark") {
    return [
      polar(cx, cy, radius + 9, angle),
      polar(cx, cy, radius + 4, angle + 0.34),
      polar(cx, cy, radius + 3, angle + 0.94),
      polar(cx, cy, radius - 1, angle + 1.82),
      polar(cx, cy, radius - 7, angle + 2.48),
      polar(cx, cy, radius - 10, angle + Math.PI),
      polar(cx, cy, radius - 7, angle - 2.48),
      polar(cx, cy, radius - 1, angle - 1.82),
      polar(cx, cy, radius + 3, angle - 0.94),
      polar(cx, cy, radius + 4, angle - 0.34)
    ];
  }
  return [
    polar(cx, cy, radius + 7, angle),
    polar(cx, cy, radius + 2, angle + 0.55),
    polar(cx, cy, radius - 2, angle + 2.28),
    polar(cx, cy, radius - 7, angle + Math.PI),
    polar(cx, cy, radius - 2, angle - 2.28),
    polar(cx, cy, radius + 2, angle - 0.55)
  ];
}
function getSessionShipMotionProfile(frameId) {
  return profile(frameId);
}
function drawSessionShipGlyph(ctx, dpr, x, y, radius, frameId, angle, time = 0, options = {}) {
  const palette = getShipFramePalette(frameId);
  const p = profile(frameId);
  const emphasize = options.emphasize !== false;
  const thrustPower = clamp(options.thrust ?? 0.65, 0, 1);
  const ringRadius = radius * p.ring;
  ctx.save();
  ctx.lineCap = "round";
  const aura = ctx.createRadialGradient(x * dpr, y * dpr, 0, x * dpr, y * dpr, ringRadius * 1.55 * dpr);
  aura.addColorStop(0, rgba(palette.outline.r, palette.outline.g, palette.outline.b, emphasize ? 0.18 : 0.1));
  aura.addColorStop(1, rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(x * dpr, y * dpr, ringRadius * 1.55 * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(palette.outline.r, palette.outline.g, palette.outline.b, emphasize ? 0.48 : 0.28);
  ctx.lineWidth = (emphasize ? 2 : 1.25) * dpr;
  ctx.beginPath();
  ctx.arc(x * dpr, y * dpr, ringRadius * dpr, 0, Math.PI * 2);
  ctx.stroke();
  if (frameId === "sigil") {
    ctx.strokeStyle = rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.34);
    ctx.lineWidth = 1.2 * dpr;
    for (let i = 0; i < 4; i += 1) {
      const a = time * 0.8 + i * Math.PI * 0.5;
      ctx.beginPath();
      ctx.ellipse(x * dpr, y * dpr, ringRadius * 1.05 * dpr, ringRadius * 0.44 * dpr, a, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (frameId === "bulwark") {
    ctx.strokeStyle = rgba(255, 218, 130, 0.3);
    ctx.lineWidth = 2.8 * dpr;
    const segments = 5;
    for (let i = 0; i < segments; i += 1) {
      const a0 = -Math.PI / 2 + i * Math.PI * 2 / segments + time * 0.06;
      const a1 = a0 + Math.PI * 2 / segments * 0.62;
      ctx.beginPath();
      ctx.arc(x * dpr, y * dpr, (ringRadius + 6) * dpr, a0, a1);
      ctx.stroke();
    }
  }
  const pulse = 0.82 + 0.22 * Math.sin(time * 7);
  const thrusterIndices = p.centerThruster ? [-1, 0, 1] : [-1, 1];
  for (const i of thrusterIndices) {
    const a = angle + Math.PI + i * p.spread;
    const len = radius * p.thrust * (0.8 + thrustPower * 0.65) * pulse;
    const p0 = polar(x, y, radius * 0.62, a);
    const p1 = polar(x, y, len, a);
    ctx.strokeStyle = rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.36 + thrustPower * 0.32);
    ctx.lineWidth = 2.1 * dpr;
    ctx.beginPath();
    ctx.moveTo(p0.x * dpr, p0.y * dpr);
    ctx.lineTo(p1.x * dpr, p1.y * dpr);
    ctx.stroke();
  }
  const pts = getSessionShipPoints(frameId, x, y, radius, angle);
  ctx.fillStyle = rgba(palette.hull.r, palette.hull.g, palette.hull.b, 0.96);
  ctx.beginPath();
  ctx.moveTo(pts[0].x * dpr, pts[0].y * dpr);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x * dpr, pts[i].y * dpr);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.98);
  ctx.lineWidth = (emphasize ? 2.4 : 1.8) * dpr;
  ctx.stroke();
  const core = radius * p.core;
  ctx.fillStyle = rgba(palette.core.r, palette.core.g, palette.core.b, 0.92);
  ctx.beginPath();
  ctx.arc(x * dpr, y * dpr, core * 0.5 * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// client/src/entities/ship/ShipRenderer.js
function drawShipStatusOverlays(ctx, view, p, sx, sy, t) {
  const statuses = p?.statuses ?? [];
  if (!statuses.length) return;
  const dpr = view.dpr;
  const r = p.radius + 10;
  const statusSet = new Set(statuses.map((s) => s.id));
  if (statusSet.has("root")) {
    ctx.save();
    ctx.strokeStyle = rgba(108, 232, 172, 0.62);
    ctx.lineWidth = 1.7 * dpr;
    ctx.lineCap = "round";
    for (let i = 0; i < 7; i += 1) {
      const a = -Math.PI * 0.95 + i * Math.PI / 3.1 + Math.sin(t * 2.4 + i) * 0.08;
      const x0 = sx + Math.cos(a) * (r * 0.45);
      const y0 = sy + Math.sin(a) * (r * 0.45);
      const x1 = sx + Math.cos(a) * (r + 7 + Math.sin(t * 5 + i) * 2);
      const y1 = sy + Math.sin(a) * (r + 7 + Math.cos(t * 4 + i) * 2);
      const cx = sx + Math.cos(a + 0.55) * (r * 0.85);
      const cy = sy + Math.sin(a + 0.55) * (r * 0.85);
      ctx.beginPath();
      ctx.moveTo(x0 * dpr, y0 * dpr);
      ctx.quadraticCurveTo(cx * dpr, cy * dpr, x1 * dpr, y1 * dpr);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (statusSet.has("stun")) {
    ctx.save();
    ctx.strokeStyle = rgba(255, 224, 122, 0.72);
    ctx.lineWidth = 2 * dpr;
    for (let i = 0; i < 3; i += 1) {
      const y = sy - r - 9 - i * 5;
      ctx.beginPath();
      ctx.arc(sx * dpr, y * dpr, (8 + i * 3) * dpr, Math.PI * 0.1 + t * 2, Math.PI * 1.45 + t * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (statusSet.has("suppress")) {
    ctx.save();
    ctx.strokeStyle = rgba(154, 84, 255, 0.7);
    ctx.lineWidth = 1.7 * dpr;
    ctx.setLineDash([5 * dpr, 4 * dpr]);
    ctx.beginPath();
    ctx.rect((sx - r - 8) * dpr, (sy - r - 8) * dpr, (r * 2 + 16) * dpr, (r * 2 + 16) * dpr);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(sx * dpr, sy * dpr, (r + 12 + Math.sin(t * 7) * 2) * dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (statusSet.has("silence")) {
    ctx.save();
    ctx.strokeStyle = rgba(184, 144, 255, 0.72);
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo((sx - r) * dpr, (sy + r) * dpr);
    ctx.lineTo((sx + r) * dpr, (sy - r) * dpr);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx * dpr, sy * dpr, (r + 6) * dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (statusSet.has("disarm")) {
    ctx.save();
    ctx.strokeStyle = rgba(120, 182, 255, 0.75);
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo((sx - r - 2) * dpr, sy * dpr);
    ctx.lineTo((sx + r + 2) * dpr, sy * dpr);
    ctx.moveTo((sx - r + 5) * dpr, (sy - 7) * dpr);
    ctx.lineTo((sx - r - 2) * dpr, sy * dpr);
    ctx.lineTo((sx - r + 5) * dpr, (sy + 7) * dpr);
    ctx.stroke();
    ctx.restore();
  }
  if (statusSet.has("grounded")) {
    ctx.save();
    ctx.strokeStyle = rgba(214, 164, 95, 0.66);
    ctx.lineWidth = 1.5 * dpr;
    for (let i = 0; i < 3; i += 1) {
      const yy = sy + r * 0.7 + i * 5;
      ctx.beginPath();
      ctx.moveTo((sx - r + i * 3) * dpr, yy * dpr);
      ctx.lineTo((sx + r - i * 3) * dpr, yy * dpr);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (statusSet.has("fear") || statusSet.has("charm") || statusSet.has("taunt")) {
    const c = statusSet.has("fear") ? { r: 222, g: 89, b: 170 } : statusSet.has("charm") ? { r: 255, g: 110, b: 188 } : { r: 255, g: 110, b: 110 };
    ctx.save();
    ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.78);
    ctx.fillStyle = rgba(c.r, c.g, c.b, 0.26);
    ctx.lineWidth = 1.8 * dpr;
    for (let i = 0; i < 4; i += 1) {
      const a = t * 2.2 + i * Math.PI * 0.5;
      const x = sx + Math.cos(a) * (r + 8);
      const y = sy + Math.sin(a) * (r + 8);
      ctx.beginPath();
      if (statusSet.has("charm")) {
        ctx.moveTo(x * dpr, (y + 3) * dpr);
        ctx.bezierCurveTo((x - 8) * dpr, (y - 5) * dpr, (x - 7) * dpr, (y - 12) * dpr, x * dpr, (y - 8) * dpr);
        ctx.bezierCurveTo((x + 7) * dpr, (y - 12) * dpr, (x + 8) * dpr, (y - 5) * dpr, x * dpr, (y + 3) * dpr);
      } else {
        ctx.moveTo(x * dpr, (y - 8) * dpr);
        ctx.lineTo((x + 8) * dpr, (y + 6) * dpr);
        ctx.lineTo((x - 8) * dpr, (y + 6) * dpr);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  if (statusSet.has("blind")) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.26)";
    ctx.beginPath();
    ctx.arc(sx * dpr, sy * dpr, (r + 13) * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(214, 198, 126, 0.78);
    ctx.lineWidth = 1.8 * dpr;
    ctx.beginPath();
    ctx.moveTo((sx - r) * dpr, (sy - 2) * dpr);
    ctx.quadraticCurveTo(sx * dpr, (sy - 14) * dpr, (sx + r) * dpr, (sy - 2) * dpr);
    ctx.quadraticCurveTo(sx * dpr, (sy + 10) * dpr, (sx - r) * dpr, (sy - 2) * dpr);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo((sx - r - 3) * dpr, (sy + r - 1) * dpr);
    ctx.lineTo((sx + r + 3) * dpr, (sy - r + 1) * dpr);
    ctx.stroke();
    ctx.restore();
  }
  if (statusSet.has("slow")) {
    ctx.save();
    ctx.strokeStyle = rgba(112, 190, 255, 0.64);
    ctx.lineWidth = 1.5 * dpr;
    for (let i = 0; i < 4; i += 1) {
      const yy = sy - r * 0.55 + i * r * 0.35;
      ctx.beginPath();
      ctx.moveTo((sx - r - 7) * dpr, yy * dpr);
      ctx.lineTo((sx + r + 7) * dpr, yy * dpr);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (statusSet.has("haste")) {
    ctx.save();
    ctx.strokeStyle = rgba(110, 255, 190, 0.7);
    ctx.lineWidth = 1.8 * dpr;
    for (let i = 0; i < 5; i += 1) {
      const a = (p.rot ?? -Math.PI / 2) + Math.PI + (i - 2) * 0.2;
      ctx.beginPath();
      ctx.moveTo((sx + Math.cos(a) * (r + 2)) * dpr, (sy + Math.sin(a) * (r + 2)) * dpr);
      ctx.lineTo((sx + Math.cos(a) * (r + 18)) * dpr, (sy + Math.sin(a) * (r + 18)) * dpr);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (statusSet.has("burn") || statusSet.has("poison") || statusSet.has("bleed")) {
    const c = statusSet.has("burn") ? { r: 255, g: 142, b: 72 } : statusSet.has("poison") ? { r: 102, g: 225, b: 120 } : { r: 220, g: 72, b: 84 };
    ctx.save();
    ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.52);
    ctx.lineWidth = 1.4 * dpr;
    for (let i = 0; i < 8; i += 1) {
      const a = i * Math.PI / 4 + t * 1.8;
      const len = 4 + 5 * Math.sin(t * 5 + i);
      const x0 = sx + Math.cos(a) * (r + 1);
      const y0 = sy + Math.sin(a) * (r + 1);
      const x1 = sx + Math.cos(a) * (r + 1 + len);
      const y1 = sy + Math.sin(a) * (r + 1 + len);
      ctx.beginPath();
      ctx.moveTo(x0 * dpr, y0 * dpr);
      ctx.lineTo(x1 * dpr, y1 * dpr);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (statusSet.has("tenacity")) {
    ctx.save();
    ctx.strokeStyle = rgba(190, 126, 255, 0.72);
    ctx.lineWidth = 1.6 * dpr;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(sx * dpr, sy * dpr, (r + 8 + i * 5) * dpr, Math.PI * (0.15 + i * 0.1) + t, Math.PI * (1.25 + i * 0.12) + t);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (statusSet.has("slow_resist")) {
    ctx.save();
    ctx.strokeStyle = rgba(170, 112, 255, 0.68);
    ctx.lineWidth = 1.3 * dpr;
    for (let i = 0; i < 6; i += 1) {
      const a = i * Math.PI / 3 - t * 1.4;
      const x = sx + Math.cos(a) * (r + 10);
      const y = sy + Math.sin(a) * (r + 10);
      ctx.beginPath();
      ctx.moveTo((x - Math.cos(a) * 6) * dpr, (y - Math.sin(a) * 6) * dpr);
      ctx.lineTo((x + Math.cos(a) * 6) * dpr, (y + Math.sin(a) * 6) * dpr);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (statusSet.has("armor_up")) {
    ctx.save();
    ctx.strokeStyle = rgba(120, 160, 225, 0.7);
    ctx.fillStyle = rgba(120, 160, 225, 0.08);
    ctx.lineWidth = 1.7 * dpr;
    for (let i = 0; i < 6; i += 1) {
      const a0 = -Math.PI / 2 + i * Math.PI / 3 + t * 0.15;
      const a1 = a0 + Math.PI / 5;
      ctx.beginPath();
      ctx.arc(sx * dpr, sy * dpr, (r + 8) * dpr, a0, a1);
      ctx.lineTo((sx + Math.cos(a1) * (r + 16)) * dpr, (sy + Math.sin(a1) * (r + 16)) * dpr);
      ctx.arc(sx * dpr, sy * dpr, (r + 16) * dpr, a1, a0, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  if (statusSet.has("spell_shield")) {
    ctx.save();
    ctx.strokeStyle = rgba(124, 96, 255, 0.78);
    ctx.lineWidth = 2 * dpr;
    ctx.setLineDash([3 * dpr, 5 * dpr]);
    ctx.beginPath();
    ctx.arc(sx * dpr, sy * dpr, (r + 16 + Math.sin(t * 5) * 2) * dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  if (statusSet.has("unstoppable")) {
    ctx.save();
    ctx.strokeStyle = rgba(255, 182, 96, 0.82);
    ctx.lineWidth = 2.2 * dpr;
    for (let i = 0; i < 4; i += 1) {
      const a = t * 1.8 + i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo((sx + Math.cos(a) * (r + 4)) * dpr, (sy + Math.sin(a) * (r + 4)) * dpr);
      ctx.lineTo((sx + Math.cos(a) * (r + 18)) * dpr, (sy + Math.sin(a) * (r + 18)) * dpr);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (statusSet.has("untargetable")) {
    ctx.save();
    ctx.strokeStyle = rgba(236, 236, 255, 0.72);
    ctx.fillStyle = rgba(236, 236, 255, 0.06);
    ctx.lineWidth = 1.7 * dpr;
    ctx.globalAlpha = 0.75 + 0.18 * Math.sin(t * 7);
    ctx.beginPath();
    ctx.ellipse(sx * dpr, sy * dpr, (r + 18) * dpr, (r + 8) * dpr, t * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  if (statusSet.has("invulnerable")) {
    ctx.save();
    ctx.strokeStyle = rgba(255, 246, 196, 0.88);
    ctx.fillStyle = rgba(255, 246, 196, 0.08);
    ctx.lineWidth = 2 * dpr;
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5 + t * 0.45;
      const x0 = sx + Math.cos(a) * (r + 8);
      const y0 = sy + Math.sin(a) * (r + 8);
      const x1 = sx + Math.cos(a + 0.55) * (r + 18);
      const y1 = sy + Math.sin(a + 0.55) * (r + 18);
      ctx.beginPath();
      ctx.moveTo(sx * dpr, sy * dpr);
      ctx.lineTo(x0 * dpr, y0 * dpr);
      ctx.lineTo(x1 * dpr, y1 * dpr);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  if (statusSet.has("camouflage")) {
    ctx.save();
    ctx.strokeStyle = rgba(109, 79, 255, 0.62);
    ctx.lineWidth = 1.5 * dpr;
    ctx.globalAlpha = 0.45 + 0.22 * Math.sin(t * 6);
    for (let i = 0; i < 2; i += 1) {
      ctx.beginPath();
      ctx.ellipse((sx + Math.sin(t * 2 + i) * 5) * dpr, sy * dpr, (r + 12 + i * 6) * dpr, (r + 3 + i * 4) * dpr, -0.35 + i * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (statusSet.has("true_sight")) {
    ctx.save();
    ctx.strokeStyle = rgba(120, 250, 255, 0.76);
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    ctx.moveTo((sx - r - 8) * dpr, sy * dpr);
    ctx.quadraticCurveTo(sx * dpr, (sy - r - 14) * dpr, (sx + r + 8) * dpr, sy * dpr);
    ctx.quadraticCurveTo(sx * dpr, (sy + r + 14) * dpr, (sx - r - 8) * dpr, sy * dpr);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx * dpr, sy * dpr, 4.5 * dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (statusSet.has("damage_amp") || statusSet.has("armor_shred") || statusSet.has("anti_shield") || statusSet.has("heal_cut")) {
    ctx.save();
    const color2 = statusSet.has("damage_amp") ? { r: 255, g: 94, b: 94 } : statusSet.has("anti_shield") ? { r: 255, g: 140, b: 76 } : statusSet.has("heal_cut") ? { r: 255, g: 96, b: 96 } : { r: 198, g: 118, b: 88 };
    ctx.strokeStyle = rgba(color2.r, color2.g, color2.b, 0.66);
    ctx.lineWidth = 1.5 * dpr;
    for (let i = 0; i < 4; i += 1) {
      const a = t * -1.5 + i * Math.PI / 2;
      ctx.beginPath();
      ctx.arc((sx + Math.cos(a) * (r + 9)) * dpr, (sy + Math.sin(a) * (r + 9)) * dpr, 4 * dpr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
function drawChevronBurst(ctx, dpr, sx, sy, radius, color2, count, t, forward = -Math.PI / 2) {
  ctx.save();
  ctx.strokeStyle = rgba(color2.r, color2.g, color2.b, 0.7);
  ctx.fillStyle = rgba(color2.r, color2.g, color2.b, 0.18);
  ctx.lineWidth = 1.6 * dpr;
  const n = Math.max(1, Math.min(5, count | 0));
  for (let i = 0; i < n; i += 1) {
    const a = forward + (i - (n - 1) * 0.5) * 0.23 + Math.sin(t * 5 + i) * 0.025;
    const x = sx + Math.cos(a) * radius;
    const y = sy + Math.sin(a) * radius;
    ctx.beginPath();
    ctx.moveTo((x + Math.cos(a) * 7) * dpr, (y + Math.sin(a) * 7) * dpr);
    ctx.lineTo((x + Math.cos(a + 2.4) * 6) * dpr, (y + Math.sin(a + 2.4) * 6) * dpr);
    ctx.lineTo((x + Math.cos(a - 2.4) * 6) * dpr, (y + Math.sin(a - 2.4) * 6) * dpr);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
function drawSegmentRing(ctx, dpr, sx, sy, radius, count, active, color2, t, thickness = 4) {
  const max = Math.max(1, count | 0);
  const gap = Math.PI * 2 / max * 0.18;
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < max; i += 1) {
    const a0 = -Math.PI / 2 + i * Math.PI * 2 / max + gap * 0.5 + t * 0.08;
    const a1 = -Math.PI / 2 + (i + 1) * Math.PI * 2 / max - gap * 0.5 + t * 0.08;
    const lit = i < active;
    ctx.strokeStyle = lit ? rgba(color2.r, color2.g, color2.b, 0.88) : rgba(82, 92, 112, 0.28);
    ctx.lineWidth = (lit ? thickness : thickness * 0.58) * dpr;
    ctx.beginPath();
    ctx.arc(sx * dpr, sy * dpr, (radius + (lit ? Math.sin(t * 7 + i) * 1.1 : 0)) * dpr, a0, a1);
    ctx.stroke();
  }
  ctx.restore();
}
function drawContinuousHeatAura(ctx, dpr, sx, sy, radius, stacks, maxStacks, t) {
  const max = Math.max(1, maxStacks | 0);
  const heat = Math.max(0, Math.min(1, (stacks || 0) / max));
  const pulse = 0.5 + 0.5 * Math.sin(t * 7.5);
  const alpha = 0.1 + heat * 0.46 + pulse * heat * 0.12;
  const core = { r: 84, g: 226, b: 255 };
  const hot = { r: 255, g: 202, b: 86 };
  const rr = Math.round(core.r + (hot.r - core.r) * Math.max(0, heat - 0.55) / 0.45);
  const gg = Math.round(core.g + (hot.g - core.g) * Math.max(0, heat - 0.55) / 0.45);
  const bb = Math.round(core.b + (hot.b - core.b) * Math.max(0, heat - 0.55) / 0.45);
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = rgba(rr, gg, bb, alpha);
  ctx.lineWidth = (1.6 + heat * 2.2) * dpr;
  ctx.beginPath();
  ctx.arc(sx * dpr, sy * dpr, (radius + Math.sin(t * 6) * heat * 1.6) * dpr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rgba(rr, gg, bb, 0.16 + heat * 0.26);
  ctx.lineWidth = 1.1 * dpr;
  ctx.setLineDash([7 * dpr, 9 * dpr]);
  ctx.beginPath();
  ctx.arc(sx * dpr, sy * dpr, (radius + 8 + Math.sin(t * 4.5) * heat * 2) * dpr, t * 0.55, t * 0.55 + Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  const ventCount = Math.min(6, Math.max(0, Math.ceil(heat * 6)));
  ctx.fillStyle = rgba(rr, gg, bb, 0.38 + heat * 0.34);
  for (let i = 0; i < ventCount; i += 1) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / Math.max(1, ventCount) + t * 0.4;
    const x = sx + Math.cos(a) * (radius + 13);
    const y = sy + Math.sin(a) * (radius + 13);
    ctx.beginPath();
    ctx.ellipse(x * dpr, y * dpr, (2.6 + heat * 1.2) * dpr, 1.15 * dpr, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
function drawFrameSignatureAura(ctx, view, p, sx, sy, t) {
  const fs = p.frameState;
  if (!fs) return;
  const dpr = view.dpr;
  const r = (p.radius ?? 18) + 22;
  if (fs.kind === "vanguard") {
    drawContinuousHeatAura(ctx, dpr, sx, sy, r, fs.passiveStacks ?? 0, fs.passiveMaxStacks ?? 10, t);
    if ((fs.empoweredCharges ?? 0) > 0) drawChevronBurst(ctx, dpr, sx, sy, r + 12, { r: 255, g: 210, b: 92 }, fs.empoweredCharges, t, p.rot ?? -Math.PI / 2);
    if ((fs.comboWindowLeft ?? 0) > 0) {
      ctx.save();
      ctx.strokeStyle = rgba(105, 235, 255, 0.65);
      ctx.lineWidth = 2 * dpr;
      ctx.setLineDash([7 * dpr, 5 * dpr]);
      ctx.beginPath();
      ctx.arc(sx * dpr, sy * dpr, (r + 16 + Math.sin(t * 8) * 2) * dpr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    if ((fs.phaseLeft ?? 0) > 0) {
      ctx.save();
      ctx.strokeStyle = rgba(124, 154, 255, 0.72);
      ctx.lineWidth = 1.5 * dpr;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.ellipse((sx - (i + 1) * 6) * dpr, sy * dpr, (r + i * 4) * dpr, (r * 0.56 + i * 2) * dpr, p.rot ?? 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    if ((fs.ultLeft ?? 0) > 0) {
      ctx.save();
      ctx.strokeStyle = rgba(255, 116, 238, 0.52 + 0.18 * Math.sin(t * 10));
      ctx.lineWidth = 2.2 * dpr;
      ctx.beginPath();
      ctx.arc(sx * dpr, sy * dpr, (r + 25) * dpr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    return;
  }
  if (fs.kind === "sigil") {
    drawSegmentRing(ctx, dpr, sx, sy, r, fs.passiveMaxStacks ?? 5, fs.zoneActive ? 5 : 0, { r: 198, g: 128, b: 255 }, t, 2);
    if ((fs.veilLeft ?? 0) > 0) {
      ctx.save();
      ctx.globalAlpha = 0.36 + 0.2 * Math.sin(t * 7);
      ctx.strokeStyle = rgba(197, 120, 255, 0.8);
      ctx.lineWidth = 1.5 * dpr;
      for (let i = 0; i < 4; i += 1) {
        const a = i * Math.PI / 2 + t * 1.2;
        ctx.beginPath();
        ctx.ellipse((sx + Math.cos(a) * 3) * dpr, (sy + Math.sin(a) * 3) * dpr, (r + 10) * dpr, r * 0.45 * dpr, a, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (fs.zoneActive) {
      ctx.save();
      ctx.strokeStyle = rgba(198, 128, 255, 0.64);
      ctx.lineWidth = 1.3 * dpr;
      for (let i = 0; i < 5; i += 1) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 5 + t * 0.55;
        const x = sx + Math.cos(a) * (r + 14);
        const y = sy + Math.sin(a) * (r + 14);
        ctx.beginPath();
        ctx.arc(x * dpr, y * dpr, 3.5 * dpr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    return;
  }
  if (fs.kind === "bulwark") {
    drawSegmentRing(ctx, dpr, sx, sy, r, fs.passiveMaxStacks ?? 5, fs.passiveStacks ?? 0, { r: 236, g: 196, b: 96 }, t, 5);
    if ((fs.anchorLeft ?? 0) > 0) {
      ctx.save();
      ctx.strokeStyle = rgba(236, 196, 96, 0.78);
      ctx.lineWidth = 2 * dpr;
      for (let i = 0; i < 4; i += 1) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo((sx + Math.cos(a) * (r - 6)) * dpr, (sy + Math.sin(a) * (r - 6)) * dpr);
        ctx.lineTo((sx + Math.cos(a) * (r + 16)) * dpr, (sy + Math.sin(a) * (r + 16)) * dpr);
        ctx.stroke();
      }
      ctx.restore();
    }
    if ((fs.meditationLeft ?? 0) > 0) {
      ctx.save();
      ctx.strokeStyle = rgba(120, 210, 255, 0.66);
      ctx.lineWidth = 1.7 * dpr;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(sx * dpr, sy * dpr, (r + 8 + i * 8 + Math.sin(t * 5 + i) * 2) * dpr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    if ((fs.stormLeft ?? 0) > 0) {
      ctx.save();
      ctx.strokeStyle = rgba(255, 195, 102, 0.44);
      ctx.fillStyle = rgba(255, 195, 102, 0.035);
      ctx.lineWidth = 2.2 * dpr;
      ctx.beginPath();
      ctx.arc(sx * dpr, sy * dpr, (r + 70 + Math.sin(t * 4) * 4) * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}
function drawShip(ctx, view, p, camX, camY, t, mouseWorld, players, asteroids) {
  const sx = p.x - camX + view.cssW * 0.5;
  const sy = p.y - camY + view.cssH * 0.5;
  const vitals = p.vitals;
  const ang = Number.isFinite(p.rot) ? p.rot : 0;
  const palette = getShipFramePalette(p.frameId);
  drawFrameSignatureAura(ctx, view, p, sx, sy, t);
  drawShipStatusOverlays(ctx, view, p, sx, sy, t);
  if (vitals?.shield > 1e-3) {
    const r = p.radius + 6 + 2 * (vitals.shield / Math.max(1, vitals.maxShield));
    ctx.strokeStyle = rgba(COLORS.shield.r, COLORS.shield.g, COLORS.shield.b, 0.47);
    ctx.lineWidth = 2 * view.dpr;
    ctx.beginPath();
    ctx.ellipse(sx * view.dpr, sy * view.dpr, r * view.dpr, r * view.dpr, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const speed = Math.hypot(p.vx || 0, p.vy || 0);
  const localThrust = Number.isFinite(p._localThrust) ? p._localThrust : Number.isFinite(p.localThrust) ? p.localThrust : 0;
  const thrustIntent = Math.max(localThrust, speed > 8 ? clamp((speed - 8) / Math.max(1, (p.engine || 250) * 0.55), 0.18, 1) : 0);
  if (thrustIntent > 0.03) {
    const thrust = clamp(thrustIntent, 0.12, 1);
    const pulse = 0.82 + 0.22 * Math.sin(t * 18);
    const shipProfile2 = getSessionShipMotionProfile(p.frameId);
    const spread = shipProfile2.spread ?? 0.62;
    const length = p.radius * (shipProfile2.thrust ?? 1.38) * (0.72 + thrust * 0.62) * pulse;
    const startRadius = p.radius * 0.62;
    const aBase = (Number.isFinite(p.rot) ? p.rot : speed > 1 ? Math.atan2(p.vy || 0, p.vx || 0) : 0) + Math.PI;
    const thrusters = shipProfile2.centerThruster ? [-1, 0, 1] : [-1, 1];
    for (const i of thrusters) {
      const a = aBase + i * spread;
      const p0 = polar(sx, sy, startRadius, a);
      const p1 = polar(sx, sy, length, a);
      ctx.strokeStyle = rgba(COLORS.fx.r, COLORS.fx.g, COLORS.fx.b, 0.45 + 0.35 * thrust);
      ctx.lineWidth = 2 * view.dpr;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p0.x * view.dpr, p0.y * view.dpr);
      ctx.lineTo(p1.x * view.dpr, p1.y * view.dpr);
      ctx.stroke();
      ctx.strokeStyle = rgba(COLORS.thrusterInner.r, COLORS.thrusterInner.g, COLORS.thrusterInner.b, 0.78 + 0.18 * thrust);
      ctx.lineWidth = 1.05 * view.dpr;
      ctx.beginPath();
      ctx.moveTo(p0.x * view.dpr, p0.y * view.dpr);
      ctx.lineTo((sx + Math.cos(a) * (length * 0.68)) * view.dpr, (sy + Math.sin(a) * (length * 0.68)) * view.dpr);
      ctx.stroke();
    }
  }
  const pts = getSessionShipPoints(p.frameId, sx, sy, p.radius, ang);
  ctx.fillStyle = rgba(palette.hull.r, palette.hull.g, palette.hull.b, 1);
  ctx.beginPath();
  ctx.moveTo(pts[0].x * view.dpr, pts[0].y * view.dpr);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * view.dpr, pts[i].y * view.dpr);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(palette.outline.r, palette.outline.g, palette.outline.b, 1);
  ctx.lineWidth = 2 * view.dpr;
  ctx.stroke();
  ctx.fillStyle = rgba(palette.core.r, palette.core.g, palette.core.b, 0.86);
  const shipProfile = getSessionShipMotionProfile(p.frameId);
  const coreScale = shipProfile.core ?? 0.46;
  ctx.beginPath();
  ctx.ellipse(sx * view.dpr, sy * view.dpr, p.radius * coreScale * 0.5 * view.dpr, p.radius * coreScale * 0.5 * view.dpr, 0, 0, Math.PI * 2);
  ctx.fill();
  drawWorldHealthBars(ctx, view, p, camX, camY, SHIP_WORLD_BAR_STYLE);
  const displayName = p.pseudo || `Joueur ${p.id}`;
  const labelY = sy - p.radius - 14;
  ctx.font = `700 ${12 * view.dpr}px Segoe UI`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(displayName).width / view.dpr;
  ctx.fillStyle = rgba(3, 6, 11, 0.72);
  ctx.fillRect((sx - tw * 0.5 - 7) * view.dpr, (labelY - 9) * view.dpr, (tw + 14) * view.dpr, 18 * view.dpr);
  ctx.strokeStyle = rgba(125, 233, 255, 0.22);
  ctx.lineWidth = view.dpr;
  ctx.strokeRect((sx - tw * 0.5 - 7) * view.dpr, (labelY - 9) * view.dpr, (tw + 14) * view.dpr, 18 * view.dpr);
  ctx.fillStyle = rgba(245, 250, 255, 0.98);
  ctx.fillText(displayName, sx * view.dpr, labelY * view.dpr);
  ctx.textBaseline = "alphabetic";
  if ((p.level ?? 1) > 0) {
    const bx = sx + p.radius + 8;
    const by = sy - p.radius - 18;
    ctx.fillStyle = rgba(10, 14, 20, 0.94);
    ctx.fillRect((bx - 10) * view.dpr, (by - 8) * view.dpr, 20 * view.dpr, 16 * view.dpr);
    ctx.strokeStyle = rgba(236, 196, 96, 0.92);
    ctx.lineWidth = view.dpr;
    ctx.strokeRect((bx - 10) * view.dpr, (by - 8) * view.dpr, 20 * view.dpr, 16 * view.dpr);
    ctx.fillStyle = rgba(246, 230, 174, 0.96);
    ctx.font = `${10 * view.dpr}px Segoe UI`;
    ctx.fillText(`${p.level}`, bx * view.dpr, (by + 4) * view.dpr);
  }
}

// client/src/ui/status/StatusGlyphRenderer.js
function line(ctx, dpr, ax, ay, bx, by, width, stroke) {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width * dpr;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ax * dpr, ay * dpr);
  ctx.lineTo(bx * dpr, by * dpr);
  ctx.stroke();
}
function arrow(ctx, dpr, cx, cy, s, stroke, dir = 1) {
  line(ctx, dpr, cx - s * dir, cy, cx + s * dir, cy, 2, stroke);
  line(ctx, dpr, cx + s * dir, cy, cx + s * 0.35 * dir, cy - s * 0.42, 2, stroke);
  line(ctx, dpr, cx + s * dir, cy, cx + s * 0.35 * dir, cy + s * 0.42, 2, stroke);
}
function drop(ctx, dpr, cx, cy, s, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath();
  ctx.moveTo(cx * dpr, (cy - s) * dpr);
  ctx.bezierCurveTo((cx + s * 0.75) * dpr, (cy - s * 0.18) * dpr, (cx + s * 0.52) * dpr, (cy + s * 0.78) * dpr, cx * dpr, (cy + s) * dpr);
  ctx.bezierCurveTo((cx - s * 0.52) * dpr, (cy + s * 0.78) * dpr, (cx - s * 0.75) * dpr, (cy - s * 0.18) * dpr, cx * dpr, (cy - s) * dpr);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
function drawStatusGlyph(ctx, dpr, entry, x, y, size, alpha = 1) {
  const p = entry.primaryColor ?? { r: 220, g: 220, b: 220 };
  const s = entry.secondaryColor ?? p;
  const id = String(entry.id || entry.shortName || "").toLowerCase();
  const cx = x + size * 0.5;
  const cy = y + size * 0.5;
  const r = size * 0.34;
  const stroke = rgba(s.r, s.g, s.b, 0.96 * alpha);
  const fill = rgba(p.r, p.g, p.b, 0.24 * alpha);
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.lineWidth = 1.8 * dpr;
  if (id.includes("root")) {
    line(ctx, dpr, cx - r * 0.9, cy + r * 0.65, cx + r * 0.9, cy + r * 0.65, 2, stroke);
    line(ctx, dpr, cx - r * 0.55, cy + r * 0.65, cx - r * 0.15, cy - r * 0.9, 2, stroke);
    line(ctx, dpr, cx + r * 0.55, cy + r * 0.65, cx + r * 0.15, cy - r * 0.9, 2, stroke);
    line(ctx, dpr, cx - r * 0.15, cy - r * 0.9, cx + r * 0.15, cy - r * 0.9, 2, stroke);
    return;
  }
  if (id.includes("silence")) {
    ctx.beginPath();
    ctx.arc(cx * dpr, cy * dpr, r * 0.9 * dpr, 0, Math.PI * 2);
    ctx.stroke();
    line(ctx, dpr, cx - r * 0.65, cy + r * 0.65, cx + r * 0.65, cy - r * 0.65, 2, stroke);
    return;
  }
  if (id.includes("disarm")) {
    line(ctx, dpr, cx - r * 0.8, cy + r * 0.55, cx + r * 0.8, cy - r * 0.55, 2, stroke);
    line(ctx, dpr, cx - r * 0.25, cy - r * 0.15, cx + r * 0.55, cy + r * 0.65, 1.8, stroke);
    line(ctx, dpr, cx + r * 0.45, cy + r * 0.25, cx + r * 0.8, cy + r * 0.6, 1.8, stroke);
    return;
  }
  if (id.includes("ground")) {
    line(ctx, dpr, cx - r, cy + r * 0.52, cx + r, cy + r * 0.52, 2, stroke);
    line(ctx, dpr, cx - r * 0.75, cy + r * 0.15, cx + r * 0.75, cy + r * 0.15, 1.5, stroke);
    line(ctx, dpr, cx - r * 0.45, cy - r * 0.25, cx + r * 0.45, cy - r * 0.25, 1.5, stroke);
    return;
  }
  if (id.includes("suppress")) {
    ctx.beginPath();
    ctx.rect((cx - r * 0.72) * dpr, (cy - r * 0.72) * dpr, r * 1.44 * dpr, r * 1.44 * dpr);
    ctx.stroke();
    line(ctx, dpr, cx - r * 0.72, cy, cx + r * 0.72, cy, 2, stroke);
    line(ctx, dpr, cx, cy - r * 0.72, cx, cy + r * 0.72, 2, stroke);
    return;
  }
  if (id.includes("sleep")) {
    ctx.font = `${Math.max(8, r * 1.05) * dpr}px Segoe UI`;
    ctx.fillStyle = stroke;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Z", cx * dpr, cy * dpr);
    return;
  }
  if (id.includes("fear")) {
    ctx.beginPath();
    ctx.moveTo(cx * dpr, (cy - r) * dpr);
    ctx.lineTo((cx + r * 0.85) * dpr, (cy + r * 0.65) * dpr);
    ctx.lineTo((cx - r * 0.85) * dpr, (cy + r * 0.65) * dpr);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc((cx - r * 0.25) * dpr, (cy + r * 0.05) * dpr, r * 0.08 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc((cx + r * 0.25) * dpr, (cy + r * 0.05) * dpr, r * 0.08 * dpr, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (id.includes("charm")) {
    ctx.beginPath();
    ctx.moveTo(cx * dpr, (cy + r * 0.72) * dpr);
    ctx.bezierCurveTo((cx - r * 1.15) * dpr, (cy - r * 0.05) * dpr, (cx - r * 0.55) * dpr, (cy - r * 0.86) * dpr, cx * dpr, (cy - r * 0.34) * dpr);
    ctx.bezierCurveTo((cx + r * 0.55) * dpr, (cy - r * 0.86) * dpr, (cx + r * 1.15) * dpr, (cy - r * 0.05) * dpr, cx * dpr, (cy + r * 0.72) * dpr);
    ctx.fill();
    ctx.stroke();
    return;
  }
  if (id.includes("taunt")) {
    ctx.beginPath();
    ctx.arc(cx * dpr, cy * dpr, r * 0.78 * dpr, 0, Math.PI * 2);
    ctx.stroke();
    line(ctx, dpr, cx - r * 0.45, cy - r * 0.15, cx - r * 0.05, cy - r * 0.15, 2, stroke);
    line(ctx, dpr, cx + r * 0.05, cy - r * 0.15, cx + r * 0.45, cy - r * 0.15, 2, stroke);
    line(ctx, dpr, cx - r * 0.45, cy + r * 0.35, cx + r * 0.45, cy + r * 0.35, 2, stroke);
    return;
  }
  if (id.includes("slow")) {
    arrow(ctx, dpr, cx + r * 0.35, cy, r * 0.8, stroke, -1);
    line(ctx, dpr, cx - r * 0.4, cy - r * 0.48, cx + r * 0.45, cy - r * 0.48, 1.5, stroke);
    line(ctx, dpr, cx - r * 0.4, cy + r * 0.48, cx + r * 0.45, cy + r * 0.48, 1.5, stroke);
    return;
  }
  if (id.includes("haste") || id.includes("dash")) {
    arrow(ctx, dpr, cx, cy, r * 0.95, stroke, 1);
    return;
  }
  if (id.includes("burn")) {
    ctx.beginPath();
    ctx.moveTo(cx * dpr, (cy - r * 1.05) * dpr);
    ctx.bezierCurveTo((cx + r * 0.75) * dpr, (cy - r * 0.2) * dpr, (cx + r * 0.34) * dpr, (cy + r * 0.95) * dpr, cx * dpr, (cy + r * 1.05) * dpr);
    ctx.bezierCurveTo((cx - r * 0.65) * dpr, (cy + r * 0.45) * dpr, (cx - r * 0.28) * dpr, (cy - r * 0.1) * dpr, cx * dpr, (cy - r * 1.05) * dpr);
    ctx.fill();
    ctx.stroke();
    return;
  }
  if (id.includes("poison")) {
    drop(ctx, dpr, cx, cy, r, fill, stroke);
    line(ctx, dpr, cx - r * 0.25, cy, cx + r * 0.25, cy, 1.4, stroke);
    return;
  }
  if (id.includes("bleed")) {
    drop(ctx, dpr, cx, cy, r, fill, stroke);
    return;
  }
  if (id.includes("stun")) {
    for (let i = 0; i < 6; i += 1) {
      const a0 = -Math.PI / 2 + Math.PI * 2 * i / 6;
      line(ctx, dpr, cx + Math.cos(a0) * r * 0.35, cy + Math.sin(a0) * r * 0.35, cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, 1.7, stroke);
    }
    ctx.beginPath();
    ctx.arc(cx * dpr, cy * dpr, r * 0.32 * dpr, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  if (id.includes("shield") || id.includes("armor")) {
    ctx.beginPath();
    ctx.moveTo((cx - r * 0.8) * dpr, (cy - r * 0.8) * dpr);
    ctx.lineTo((cx + r * 0.8) * dpr, (cy - r * 0.8) * dpr);
    ctx.lineTo((cx + r * 0.58) * dpr, (cy + r * 0.35) * dpr);
    ctx.lineTo(cx * dpr, (cy + r * 0.95) * dpr);
    ctx.lineTo((cx - r * 0.58) * dpr, (cy + r * 0.35) * dpr);
    ctx.closePath();
    ctx.stroke();
    return;
  }
  if (id.includes("amp") || id.includes("shred")) {
    line(ctx, dpr, cx - r * 0.8, cy + r * 0.8, cx + r * 0.8, cy - r * 0.8, 2, stroke);
    line(ctx, dpr, cx + r * 0.2, cy - r * 0.78, cx + r * 0.8, cy - r * 0.8, 2, stroke);
    line(ctx, dpr, cx + r * 0.8, cy - r * 0.8, cx + r * 0.78, cy - r * 0.2, 2, stroke);
    return;
  }
  ctx.beginPath();
  ctx.arc(cx * dpr, cy * dpr, r * dpr, 0, Math.PI * 2);
  ctx.stroke();
}

// client/src/abilities/AreaEffectRenderer.js
function fakeStatusEntry(effect) {
  return {
    id: effect.statusId || effect.label || "zone",
    primaryColor: effect.color ?? { r: 90, g: 220, b: 255 },
    secondaryColor: effect.color ?? { r: 90, g: 220, b: 255 }
  };
}
function drawAreaEffect(ctx, view, effect, camX, camY, t) {
  const sx = effect.x - camX + view.cssW * 0.5;
  const sy = effect.y - camY + view.cssH * 0.5;
  const isTestZone = effect.kind === "test_effect_zone";
  const dormant = isTestZone && effect.phase === "dormant";
  const pulse = isTestZone ? dormant ? 0.55 + 0.05 * Math.sin(t * 1.7 + effect.id * 0.02) : 0.82 + 0.18 * Math.sin(t * 3.2 + effect.id * 0.02) : 0.78 + 0.22 * Math.sin(t * 5.6 + effect.id * 0.02);
  const alpha = isTestZone ? dormant ? 0.03 : 0.115 : Math.max(0.1, Math.min(0.34, effect.durationLeft / 4 * 0.32 + 0.09));
  const baseColor = effect.color ?? { r: 90, g: 220, b: 255 };
  const color2 = dormant ? { r: Math.round(baseColor.r * 0.32 + 52), g: Math.round(baseColor.g * 0.32 + 52), b: Math.round(baseColor.b * 0.32 + 58) } : baseColor;
  const dpr = view.dpr;
  const x = sx * dpr;
  const y = sy * dpr;
  const r = effect.radius * dpr;
  const grad = ctx.createRadialGradient(x, y, Math.max(1, r * 0.1), x, y, Math.max(1, r));
  grad.addColorStop(0, rgba(color2.r, color2.g, color2.b, alpha * 0.72 * pulse));
  grad.addColorStop(0.58, rgba(color2.r, color2.g, color2.b, alpha * 0.28));
  grad.addColorStop(1, rgba(color2.r, color2.g, color2.b, 0.01));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(color2.r, color2.g, color2.b, isTestZone ? dormant ? 0.16 : 0.42 : 0.72);
  ctx.lineWidth = (isTestZone ? dormant ? 1 : 1.55 : 2) * dpr;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rgba(color2.r, color2.g, color2.b, isTestZone ? dormant ? 0.1 : 0.28 : 0.26);
  ctx.lineWidth = 1 * dpr;
  ctx.setLineDash([8 * dpr, 10 * dpr]);
  ctx.lineDashOffset = -t * (isTestZone ? 10 : 18) * dpr;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  if (isTestZone) {
    const iconSize = 31;
    const iconX = sx - iconSize * 0.5;
    const iconY = sy - iconSize * 0.5;
    ctx.fillStyle = "rgba(6,9,14,0.76)";
    ctx.strokeStyle = rgba(color2.r, color2.g, color2.b, 0.78);
    ctx.lineWidth = 1.2 * dpr;
    ctx.beginPath();
    ctx.arc(sx * dpr, sy * dpr, iconSize * 0.62 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawStatusGlyph(ctx, dpr, fakeStatusEntry(effect), iconX, iconY, iconSize, dormant ? 0.42 : 0.98);
    if (dormant) {
      const total = Math.max(0.01, effect.dormantSeconds || 10);
      const left = Math.max(0, effect.cooldownLeft || 0);
      const ratio = Math.max(0, Math.min(1, 1 - left / total));
      ctx.strokeStyle = rgba(baseColor.r, baseColor.g, baseColor.b, 0.72);
      ctx.lineWidth = 2.4 * dpr;
      ctx.beginPath();
      ctx.arc(sx * dpr, sy * dpr, iconSize * 0.78 * dpr, -Math.PI * 0.5, -Math.PI * 0.5 + ratio * Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = rgba(190, 205, 225, 0.82);
      ctx.font = `${9.5 * dpr}px Segoe UI`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${Math.ceil(left)}`, sx * dpr, sy * dpr);
    }
    const label = effect.label || effect.statusId || "";
    if (label) {
      ctx.font = `${10.5 * dpr}px Segoe UI`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const w = Math.max(46, ctx.measureText(label).width / dpr + 16);
      const bx = sx - w * 0.5;
      const by = sy - effect.radius - 20;
      ctx.fillStyle = "rgba(5,8,13,0.88)";
      ctx.strokeStyle = rgba(color2.r, color2.g, color2.b, 0.5);
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.roundRect(bx * dpr, by * dpr, w * dpr, 20 * dpr, 4 * dpr);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = dormant ? rgba(150, 160, 176, 0.76) : rgba(232, 242, 255, 0.94);
      ctx.fillText(label, sx * dpr, (by + 10) * dpr);
    }
  }
}

// client/src/mob/MobWorldBarStyle.js
var MOB_WORLD_BAR_STYLE = {
  width: 34,
  offsetY: 22,
  bars: [
    {
      valueKey: "hp",
      maxKey: "maxHp",
      height: 4,
      gapAfter: 0,
      showWhenZero: false,
      palette: {
        back: { r: 20, g: 24, b: 30, a: 0.82 },
        fill: { r: 224, g: 98, b: 98 }
      }
    }
  ]
};

// client/src/mob/MobRenderer.js
var MOB_VISUALS = {
  1: { glyph: "\u2699", shape: "mite", ring: "dash" },
  2: { glyph: "\u2739", shape: "sapper", ring: "mine" },
  3: { glyph: "\u25C8", shape: "stinger", ring: "cloak" },
  4: { glyph: "\u25C7", shape: "lancer", ring: "beam" },
  5: { glyph: "\u25A3", shape: "nodule", ring: "shield" },
  6: { glyph: "\u25C6", shape: "crusher", ring: "heavy" },
  7: { glyph: "\u03DF", shape: "warden", ring: "arc" },
  8: { glyph: "\u263D", shape: "specter", ring: "veil" },
  9: { glyph: "\u2623", shape: "hydra", ring: "toxic" },
  10: { glyph: "\u25E2", shape: "apex", ring: "hunt" }
};
function lighten(c, add = 32) {
  return { r: Math.min(255, (c?.r ?? 200) + add), g: Math.min(255, (c?.g ?? 200) + add), b: Math.min(255, (c?.b ?? 200) + add) };
}
function drawPolygon(ctx, cx, cy, r, sides, rot, dpr) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + i * Math.PI * 2 / sides;
    const x = cx + Math.cos(a) * r * dpr;
    const y = cy + Math.sin(a) * r * dpr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
function drawMobBody(ctx, screen, view, mob, t, visual) {
  const dpr = view.dpr;
  const c = mob.color || { r: 200, g: 200, b: 220 };
  const hi = lighten(c, mob.elite ? 70 : 35);
  const isSummon = (mob.summonGeneration || 0) > 0;
  const pulse = (isSummon ? 0.86 : 0.94) + Math.sin(t * 5 + mob.id % 13) * 0.045;
  const bodyR = mob.radius * pulse * (isSummon ? 0.86 : 1);
  const cx = screen.x * dpr;
  const cy = screen.y * dpr;
  const rot = (mob.rot || 0) + t * (visual.shape === "specter" ? 0.8 : 0.18);
  ctx.save();
  ctx.shadowBlur = (isSummon ? 10 : mob.elite ? 22 : 13) * dpr;
  ctx.shadowColor = rgba(c.r, c.g, c.b, mob.elite ? 0.85 : 0.55);
  ctx.fillStyle = rgba(c.r, c.g, c.b, isSummon ? 0.58 : mob.elite ? 0.94 : 0.88);
  ctx.strokeStyle = rgba(hi.r, hi.g, hi.b, isSummon ? 0.66 : 0.96);
  ctx.lineWidth = (mob.elite ? 2.5 : 1.8) * dpr;
  switch (visual.shape) {
    case "mite":
      drawPolygon(ctx, cx, cy, bodyR, 6, rot, dpr);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = rot + i * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * bodyR * 0.55 * dpr, cy + Math.sin(a) * bodyR * 0.55 * dpr);
        ctx.lineTo(cx + Math.cos(a) * (bodyR + 8) * dpr, cy + Math.sin(a) * (bodyR + 8) * dpr);
        ctx.stroke();
      }
      break;
    case "sapper":
      drawPolygon(ctx, cx, cy, bodyR, 8, rot, dpr);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.beginPath();
      ctx.arc(cx, cy, bodyR * 1.35 * dpr, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "stinger":
      drawPolygon(ctx, cx, cy, bodyR, 3, rot - Math.PI / 2, dpr);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(rot) * bodyR * 1.55 * dpr, cy + Math.sin(rot) * bodyR * 1.55 * dpr);
      ctx.stroke();
      break;
    case "lancer":
      ctx.beginPath();
      ctx.ellipse(cx, cy, bodyR * 0.75 * dpr, bodyR * 1.55 * dpr, rot, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(rot) * bodyR * 1.8 * dpr, cy - Math.sin(rot) * bodyR * 1.8 * dpr);
      ctx.lineTo(cx + Math.cos(rot) * bodyR * 1.8 * dpr, cy + Math.sin(rot) * bodyR * 1.8 * dpr);
      ctx.stroke();
      break;
    case "nodule":
      drawPolygon(ctx, cx, cy, bodyR, 4, rot + Math.PI / 4, dpr);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, bodyR * 1.45 * dpr, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "crusher":
      drawPolygon(ctx, cx, cy, bodyR * 1.08, 5, rot, dpr);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 3 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, bodyR * 1.32 * dpr, Math.PI * 0.15, Math.PI * 1.25);
      ctx.stroke();
      break;
    case "warden":
      drawPolygon(ctx, cx, cy, bodyR, 6, rot, dpr);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + i * Math.PI * 2 / 3;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * bodyR * 1.2 * dpr, cy + Math.sin(a) * bodyR * 1.2 * dpr, 2.5 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "specter":
      ctx.globalAlpha = 0.78 + Math.sin(t * 8) * 0.12;
      drawPolygon(ctx, cx, cy, bodyR, 5, rot, dpr);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([7 * dpr, 6 * dpr]);
      ctx.beginPath();
      ctx.arc(cx, cy, bodyR * 1.65 * dpr, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "hydra":
      for (let i = 0; i < 3; i++) {
        const a = rot + i * Math.PI * 2 / 3;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * bodyR * 0.52 * dpr, cy + Math.sin(a) * bodyR * 0.52 * dpr, bodyR * 0.68 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    case "apex":
      drawPolygon(ctx, cx, cy, bodyR * 1.12, 3, rot - Math.PI / 2, dpr);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, bodyR * 1.72 * dpr, t * 2, t * 2 + Math.PI * 1.35);
      ctx.stroke();
      break;
    default:
      ctx.beginPath();
      ctx.arc(cx, cy, bodyR * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
  }
  ctx.restore();
}
function drawMobRings(ctx, screen, view, mob, t, visual) {
  const dpr = view.dpr;
  const c = mob.color || { r: 200, g: 200, b: 220 };
  const cx = screen.x * dpr;
  const cy = screen.y * dpr;
  const r = (mob.radius + 11 + Math.sin(t * 3.2) * 2) * dpr;
  ctx.save();
  ctx.strokeStyle = rgba(c.r, c.g, c.b, mob.elite ? 0.9 : 0.55);
  ctx.lineWidth = (mob.elite ? 2.2 : 1.2) * dpr;
  if (["veil", "mine", "toxic"].includes(visual.ring)) ctx.setLineDash([8 * dpr, 7 * dpr]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  if ((mob.summonGeneration || 0) > 0) {
    ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.34);
    ctx.setLineDash([3 * dpr, 7 * dpr]);
    ctx.beginPath();
    ctx.arc(cx, cy, (mob.radius + 18) * dpr, t * 1.4, t * 1.4 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (mob.specialCueLeft > 0) {
    const k = Math.max(0, Math.min(1, mob.specialCueLeft));
    ctx.strokeStyle = rgba(255, 230, 150, 0.85 * k);
    ctx.lineWidth = 3 * dpr;
    ctx.beginPath();
    ctx.arc(cx, cy, (mob.radius + 26 + (1 - k) * 32) * dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = rgba(255, 230, 150, 0.95 * k);
    ctx.font = `${10 * dpr}px Segoe UI`;
    ctx.textAlign = "center";
    ctx.fillText(mob.specialCue || "CAST", cx, cy - (mob.radius + 34) * dpr);
  }
  ctx.restore();
}
function drawDemoCage(ctx, view, mob, camX, camY, t) {
  if (!mob.demoMob || !mob.demoCageRadius) return;
  const dpr = view.dpr;
  const c = mob.color || { r: 200, g: 200, b: 220 };
  const center = worldToScreen(camX, camY, mob.demoCageX ?? mob.x, mob.demoCageY ?? mob.y, view.cssW, view.cssH);
  const cx = center.x * dpr;
  const cy = center.y * dpr;
  const r = mob.demoCageRadius * dpr;
  ctx.save();
  ctx.strokeStyle = rgba(c.r, c.g, c.b, mob.elite ? 0.62 : 0.46);
  ctx.fillStyle = rgba(c.r, c.g, c.b, mob.elite ? 0.035 : 0.025);
  ctx.lineWidth = (mob.elite ? 2 : 1.3) * dpr;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([10 * dpr, 9 * dpr]);
  ctx.strokeStyle = rgba(255, 255, 255, 0.16);
  ctx.beginPath();
  ctx.arc(cx, cy, (mob.demoCageRadius - 22) * dpr, t * 0.25, t * 0.25 + Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba(120, 235, 255, 0.28);
  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r);
  ctx.stroke();
  ctx.fillStyle = rgba(220, 240, 255, 0.78);
  ctx.font = `${9 * dpr}px Segoe UI`;
  ctx.textAlign = "center";
  ctx.fillText("CAGE DE D\xC9MO \u2014 attaques redirig\xE9es vers le dummy", cx, cy + r + 14 * dpr);
  ctx.restore();
}
function drawDemoInfo(ctx, screen, view, mob) {
  if (!mob.demoMob) return;
  const dpr = view.dpr;
  const x = screen.x * dpr;
  const y = (screen.y + mob.radius + 22) * dpr;
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = `${9 * dpr}px Segoe UI`;
  ctx.fillStyle = "rgba(191,205,226,0.82)";
  ctx.fillText(mob.role || "", x, y);
  if (mob.demoVariantLabel) {
    ctx.fillStyle = mob.demoVariantLabel === "Standard" ? "rgba(191,205,226,0.82)" : "rgba(255,220,130,0.92)";
    ctx.fillText(mob.demoVariantLabel.toUpperCase(), x, y + 11 * dpr);
  } else if (mob.elite) {
    ctx.fillStyle = "rgba(255,220,130,0.92)";
    ctx.fillText("VARIANTE \xC9LITE", x, y + 11 * dpr);
  }
  ctx.restore();
}
function drawMob(ctx, view, mob, camX, camY, t) {
  const screen = worldToScreen(camX, camY, mob.x, mob.y, view.cssW, view.cssH);
  const visual = MOB_VISUALS[mob.typeId] || MOB_VISUALS[1];
  drawDemoCage(ctx, view, mob, camX, camY, t);
  drawMobRings(ctx, screen, view, mob, t, visual);
  drawMobBody(ctx, screen, view, mob, t, visual);
  drawWorldHealthBars(ctx, view, mob, camX, camY, MOB_WORLD_BAR_STYLE);
  const dpr = view.dpr;
  const c = mob.color || { r: 200, g: 200, b: 220 };
  const cx = screen.x * dpr;
  const topY = (screen.y - mob.radius - 16) * dpr;
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = `${11 * dpr}px Segoe UI`;
  ctx.fillStyle = rgba(236, 242, 250, 0.94);
  ctx.fillText(mob.name, cx, topY);
  ctx.font = `${13 * dpr}px Segoe UI Symbol`;
  ctx.fillStyle = rgba(c.r, c.g, c.b, 0.95);
  ctx.fillText(visual.glyph, cx, topY - 14 * dpr);
  if ((mob.summonGeneration || 0) > 0) {
    ctx.fillStyle = rgba(c.r, c.g, c.b, 0.82);
    ctx.font = `${9 * dpr}px Segoe UI`;
    ctx.fillText(mob.summonKind === "shadow" ? "OMBRE" : mob.summonKind === "mirror" ? "MIROIR" : "PROG\xC9NITURE", cx, topY + 11 * dpr);
  }
  if ((mob.threat ?? 1) > 1 && !(mob.summonGeneration || 0)) {
    ctx.fillStyle = rgba(255, 228, 156, 0.86);
    ctx.font = `${10 * dpr}px Segoe UI`;
    ctx.fillText(`T${mob.threat}`, cx + (mob.radius + 18) * dpr, topY - 2 * dpr);
  }
  drawDemoInfo(ctx, screen, view, mob);
  ctx.restore();
}

// shared/content/frames/ShipFrameIds.js
var SHIP_FRAME_IDS = {
  VANGUARD: "vanguard",
  SIGIL: "sigil",
  BULWARK: "bulwark"
};
var SHIP_FRAME_ORDER = [
  SHIP_FRAME_IDS.VANGUARD,
  SHIP_FRAME_IDS.SIGIL,
  SHIP_FRAME_IDS.BULWARK
];

// shared/content/frames/base/ShipFrameDefinition.js
function defineShipFrame(def) {
  return Object.freeze({
    id: def.id,
    name: def.name,
    role: def.role,
    difficulty: def.difficulty,
    shortName: def.shortName ?? def.name,
    stats: Object.freeze({ ...def.stats ?? {} }),
    levelScaling: Object.freeze({ ...def.levelScaling ?? {} }),
    abilities: Object.freeze({ ...def.abilities ?? {} })
  });
}

// shared/content/frames/vanguard/VanguardFrameDef.js
var VANGUARD_FRAME_DEF = defineShipFrame({
  id: SHIP_FRAME_IDS.VANGUARD,
  name: "Vanguard",
  shortName: "VG",
  role: "Polyvalent",
  difficulty: "Interm\xE9diaire",
  stats: {
    maxHp: 118,
    maxShield: 42,
    maxEnergy: 100,
    energyRegen: 3.1,
    hullRegen: 0.34,
    shieldRegenPerSec: 8,
    shieldRegenDelayOnHit: 3,
    engine: 250,
    radius: 18,
    magnetRange: 150,
    baseArmor: 12,
    autoAttackBaseCooldown: 0.7,
    autoAttackBaseDamage: 13,
    damageMult: 1,
    fireRateMult: 1
  },
  levelScaling: {
    hpPct: 0.06,
    shieldPct: 0.048,
    energyPct: 0.038,
    enginePct: 0.012,
    damagePct: 0.015,
    fireRatePct: 0.01,
    hullRegenPct: 0.018,
    energyRegenPct: 5e-3
  },
  abilities: {
    A: { key: "A", label: "Perc\xE9e vectorielle" },
    Z: { key: "Z", label: "Postcombustion" },
    E: { key: "E", label: "Phase inertielle" },
    R: { key: "R", label: "Fr\xE9n\xE9sie de combat" }
  }
});

// shared/content/frames/sigil/SigilFrameDef.js
var SIGIL_FRAME_DEF = defineShipFrame({
  id: SHIP_FRAME_IDS.SIGIL,
  name: "Sigil",
  shortName: "SG",
  role: "Contr\xF4le",
  difficulty: "\xC9lev\xE9e",
  stats: {
    maxHp: 108,
    maxShield: 48,
    maxEnergy: 112,
    energyRegen: 3.4,
    hullRegen: 0.3,
    shieldRegenPerSec: 9,
    shieldRegenDelayOnHit: 3,
    engine: 236,
    radius: 18,
    magnetRange: 150,
    baseArmor: 10,
    autoAttackBaseCooldown: 0.78,
    autoAttackBaseDamage: 12.5,
    damageMult: 0.96,
    fireRateMult: 0.95
  },
  levelScaling: {
    hpPct: 0.052,
    shieldPct: 0.044,
    energyPct: 0.045,
    enginePct: 0.013,
    damagePct: 0.016,
    fireRatePct: 0.01,
    hullRegenPct: 0.014,
    energyRegenPct: 6e-3
  },
  abilities: {
    A: { key: "A", label: "Impulsion runique" },
    Z: { key: "Z", label: "Sceau d'enfermement" },
    E: { key: "E", label: "Voile fractal" },
    R: { key: "R", label: "Convergence runique" }
  }
});

// shared/content/frames/bulwark/BulwarkFrameDef.js
var BULWARK_FRAME_DEF = defineShipFrame({
  id: SHIP_FRAME_IDS.BULWARK,
  name: "Bulwark",
  shortName: "BW",
  role: "Frontline",
  difficulty: "Faible",
  stats: {
    maxHp: 146,
    maxShield: 58,
    maxEnergy: 96,
    energyRegen: 2.9,
    hullRegen: 0.48,
    shieldRegenPerSec: 7,
    shieldRegenDelayOnHit: 3.2,
    engine: 230,
    radius: 18,
    magnetRange: 150,
    baseArmor: 22,
    autoAttackBaseCooldown: 0.9,
    autoAttackBaseDamage: 12,
    damageMult: 0.94,
    fireRateMult: 0.93
  },
  levelScaling: {
    hpPct: 0.07,
    shieldPct: 0.057,
    energyPct: 0.031,
    enginePct: 0.01,
    damagePct: 9e-3,
    fireRatePct: 7e-3,
    hullRegenPct: 0.022,
    energyRegenPct: 5e-3
  },
  abilities: {
    A: { key: "A", label: "Carapace h\xE9riss\xE9e" },
    Z: { key: "Z", label: "Harpon d'opprobre" },
    E: { key: "E", label: "M\xE9ditation blind\xE9e" },
    R: { key: "R", label: "Temp\xEAte de siphon" }
  }
});

// shared/content/frames/ShipFrameRegistry.js
var SHIP_FRAME_REGISTRY = Object.freeze({
  [SHIP_FRAME_IDS.VANGUARD]: VANGUARD_FRAME_DEF,
  [SHIP_FRAME_IDS.SIGIL]: SIGIL_FRAME_DEF,
  [SHIP_FRAME_IDS.BULWARK]: BULWARK_FRAME_DEF
});
function getShipFrameDef(frameId) {
  return SHIP_FRAME_REGISTRY[frameId] ?? VANGUARD_FRAME_DEF;
}

// client/src/ui/hud/HudChrome.js
function roundedRectPath(ctx, x, y, w, h, r, dpr) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
  ctx.beginPath();
  ctx.moveTo((x + rr) * dpr, y * dpr);
  ctx.arcTo((x + w) * dpr, y * dpr, (x + w) * dpr, (y + h) * dpr, rr * dpr);
  ctx.arcTo((x + w) * dpr, (y + h) * dpr, x * dpr, (y + h) * dpr, rr * dpr);
  ctx.arcTo(x * dpr, (y + h) * dpr, x * dpr, y * dpr, rr * dpr);
  ctx.arcTo(x * dpr, y * dpr, (x + w) * dpr, y * dpr, rr * dpr);
  ctx.closePath();
}
function fillRoundedRect(ctx, dpr, x, y, w, h, r, fillStyle, strokeStyle = null, lineWidth = 1) {
  roundedRectPath(ctx, x, y, w, h, r, dpr);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth * dpr;
    ctx.stroke();
  }
}
function drawMeterRow(ctx, dpr, x, y, w, h, ratio, fill, text) {
  const textReserve = text ? Math.min(94, Math.max(58, w * 0.26)) : 0;
  const trackW = Math.max(24, w - textReserve - (text ? 7 : 0));
  fillRoundedRect(ctx, dpr, x, y, trackW, h, h * 0.5, rgba(10, 14, 22, 0.94), rgba(255, 255, 255, 0.04));
  if (ratio > 1e-3) {
    fillRoundedRect(ctx, dpr, x + 1, y + 1, Math.max(0, (trackW - 2) * clamp(ratio, 0, 1)), h - 2, Math.max(1, h * 0.5 - 1), rgba(fill.r, fill.g, fill.b, 0.96));
  }
  if (text) {
    ctx.fillStyle = rgba(238, 244, 255, 0.92);
    ctx.font = `${9 * dpr}px Segoe UI`;
    ctx.textAlign = "right";
    ctx.fillText(text, (x + w - 2) * dpr, (y + h - 3) * dpr);
  }
}

// client/src/ui/StatusHudRenderer.js
function hexToRgb(hex, fallback = { r: 220, g: 220, b: 220 }) {
  const s = String(hex || "").replace("#", "").trim();
  if (s.length !== 6) return fallback;
  const n = Number.parseInt(s, 16);
  if (!Number.isFinite(n)) return fallback;
  return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 };
}
function drawTagIcon(ctx, dpr, entry, x, y, size, rowKind) {
  const p = entry.primaryColor ?? hexToRgb(entry.colorHex);
  ctx.save();
  ctx.translate((x + size * 0.5) * dpr, (y + size * 0.5) * dpr);
  ctx.strokeStyle = `rgba(${p.r},${p.g},${p.b},0.92)`;
  ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},0.18)`;
  ctx.lineWidth = Math.max(1.2, 1.8 * dpr);
  if (rowKind === "superTag") {
    ctx.rotate(Math.PI * 0.25);
    ctx.strokeRect(-size * 0.25 * dpr, -size * 0.25 * dpr, size * 0.5 * dpr, size * 0.5 * dpr);
    ctx.rotate(-Math.PI * 0.25);
  } else if (rowKind === "tag") {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      const px = Math.cos(a) * size * 0.31 * dpr;
      const py = Math.sin(a) * size * 0.31 * dpr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(246,250,255,0.98)`;
  ctx.font = `${Math.max(6.2, size * 0.25) * dpr}px Segoe UI`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(entry.short || entry.glyph || "?", 0, 0);
  ctx.restore();
}
function normalizeTagEntries(equipment) {
  const tags = (equipment?.tags || []).filter((t) => t?.active).map((t) => ({ ...t, id: `tag_${t.tagId}`, primaryColor: hexToRgb(t.colorHex), kind: "tagBuff" }));
  const superTags = (equipment?.superTags || []).filter((t) => t?.active).map((t) => ({ ...t, id: `super_${t.superTagId}`, primaryColor: hexToRgb(t.colorHex), kind: "superTagBuff" }));
  return { tags, superTags };
}
function buildHudBuffRows(statuses, layout, bastions = [], equipment = null) {
  const scale = layout?.abilityScale ?? 1;
  const baseY = layout?.statusY ?? 0;
  const { tags, superTags } = normalizeTagEntries(equipment);
  const rows = [];
  let y = baseY;
  if (statuses?.length) {
    rows.push({ entries: statuses.slice(0, 10), y, kind: "status" });
    y -= 30 * scale;
  }
  if (bastions?.length) {
    rows.push({ entries: bastions.slice(0, 10), y, kind: "bastion" });
  }
  return rows;
}
function drawStatusHud(ctx, view, statuses, layout, bastions = [], equipment = null) {
  const rows = buildHudBuffRows(statuses, layout, bastions, equipment);
  if (!rows.length) return;
  const scale = layout?.abilityScale ?? 1;
  const size = 25 * scale;
  const gap = 5 * scale;
  const centerX = layout?.centerX ?? view.cssW * 0.5;
  for (const row of rows) {
    const total = row.entries.length;
    const y = row.y;
    let x = centerX - (size * total + gap * (total - 1)) * 0.5;
    for (const entry of row.entries) {
      const p = entry.primaryColor ?? { r: 220, g: 220, b: 220 };
      const s = entry.secondaryColor ?? p;
      fillRoundedRect(ctx, view.dpr, x, y, size, size, 5, "rgba(6,9,14,0.94)", `rgba(${p.r},${p.g},${p.b},0.74)`);
      fillRoundedRect(ctx, view.dpr, x + 2, y + 2, size - 4, size - 4, 3.5, "rgba(13,18,27,0.78)", `rgba(${s.r},${s.g},${s.b},0.22)`);
      if (row.kind === "bastion") {
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},0.96)`;
        ctx.font = `${8.2 * view.dpr}px Segoe UI`;
        ctx.textAlign = "center";
        ctx.fillText(entry.glyph || "BST", (x + size * 0.5) * view.dpr, (y + size * 0.58) * view.dpr);
      } else if (row.kind === "tag" || row.kind === "superTag") {
        drawTagIcon(ctx, view.dpr, entry, x, y, size, row.kind);
      } else {
        drawStatusGlyph(ctx, view.dpr, entry, x + 3.5, y + 3.2, size - 7, 0.98);
      }
      const duration = Number(entry.durationLeft ?? 0);
      if (duration > 0) {
        const shown = duration >= 9.95 ? `${Math.ceil(duration)}` : duration.toFixed(1);
        ctx.fillStyle = "rgba(242,246,255,0.96)";
        ctx.font = `${7.2 * view.dpr}px Segoe UI`;
        ctx.textAlign = "center";
        ctx.fillText(shown, (x + size * 0.5) * view.dpr, (y + size - 2.5) * view.dpr);
      }
      const count = row.kind === "tag" ? entry.points | 0 : row.kind === "superTag" ? entry.rank | 0 : entry.stacks ?? 1;
      if (count > 1) {
        ctx.fillStyle = "rgba(8,10,14,0.92)";
        ctx.beginPath();
        ctx.arc((x + size - 5) * view.dpr, (y + 5) * view.dpr, 5 * view.dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,248,210,0.98)";
        ctx.font = `${7 * view.dpr}px Segoe UI`;
        ctx.textAlign = "center";
        ctx.fillText(`${count}`, (x + size - 5) * view.dpr, (y + 7.6) * view.dpr);
      }
      x += size + gap;
    }
  }
}

// client/src/ui/hud/HudIcons.js
function line2(ctx, dpr, ax, ay, bx, by, width, stroke) {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width * dpr;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ax * dpr, ay * dpr);
  ctx.lineTo(bx * dpr, by * dpr);
  ctx.stroke();
  ctx.lineCap = "butt";
}
function drawFrameGlyph(ctx, dpr, frameId, cx, cy, size, palette) {
  ctx.strokeStyle = rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.98);
  ctx.fillStyle = rgba(palette.core.r, palette.core.g, palette.core.b, 0.92);
  ctx.lineWidth = 2 * dpr;
  if (frameId === "sigil") {
    ctx.beginPath();
    ctx.moveTo(cx * dpr, (cy - size * 0.58) * dpr);
    ctx.lineTo((cx + size * 0.54) * dpr, cy * dpr);
    ctx.lineTo(cx * dpr, (cy + size * 0.58) * dpr);
    ctx.lineTo((cx - size * 0.54) * dpr, cy * dpr);
    ctx.closePath();
    ctx.stroke();
    line2(ctx, dpr, cx, cy - size * 0.38, cx, cy + size * 0.38, 2, rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.98));
    line2(ctx, dpr, cx - size * 0.32, cy, cx + size * 0.32, cy, 2, rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.98));
    return;
  }
  if (frameId === "bulwark") {
    ctx.beginPath();
    ctx.moveTo((cx - size * 0.42) * dpr, (cy - size * 0.42) * dpr);
    ctx.lineTo((cx + size * 0.42) * dpr, (cy - size * 0.42) * dpr);
    ctx.lineTo((cx + size * 0.3) * dpr, (cy + size * 0.36) * dpr);
    ctx.lineTo(cx * dpr, (cy + size * 0.52) * dpr);
    ctx.lineTo((cx - size * 0.3) * dpr, (cy + size * 0.36) * dpr);
    ctx.closePath();
    ctx.stroke();
    line2(ctx, dpr, cx, cy - size * 0.2, cx, cy + size * 0.24, 2, rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.98));
    return;
  }
  ctx.beginPath();
  ctx.moveTo(cx * dpr, (cy - size * 0.72) * dpr);
  ctx.lineTo((cx + size * 0.18) * dpr, (cy - size * 0.18) * dpr);
  ctx.lineTo((cx + size * 0.56) * dpr, (cy + size * 0.12) * dpr);
  ctx.lineTo((cx + size * 0.12) * dpr, (cy + size * 0.2) * dpr);
  ctx.lineTo(cx * dpr, (cy + size * 0.66) * dpr);
  ctx.lineTo((cx - size * 0.12) * dpr, (cy + size * 0.2) * dpr);
  ctx.lineTo((cx - size * 0.56) * dpr, (cy + size * 0.12) * dpr);
  ctx.lineTo((cx - size * 0.18) * dpr, (cy - size * 0.18) * dpr);
  ctx.closePath();
  ctx.stroke();
  line2(ctx, dpr, cx, cy - size * 0.44, cx, cy + size * 0.24, 2, rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.98));
  line2(ctx, dpr, cx - size * 0.34, cy + size * 0.02, cx + size * 0.34, cy + size * 0.02, 2, rgba(palette.outline.r, palette.outline.g, palette.outline.b, 0.98));
}
function drawAbilityGlyph(ctx, dpr, frameId, slot, x, y, w, h, accent) {
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  const s = Math.min(w, h) * 0.38;
  const stroke = rgba(accent.r, accent.g, accent.b, 0.96);
  const fill = rgba(accent.r, accent.g, accent.b, 0.18);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2 * dpr;
  ctx.fillStyle = fill;
  if (frameId === "vanguard") {
    if (slot === "A") {
      ctx.beginPath();
      ctx.moveTo((cx - s * 0.8) * dpr, cy * dpr);
      ctx.lineTo((cx + s * 0.78) * dpr, cy * dpr);
      ctx.lineTo((cx + s * 0.18) * dpr, (cy - s * 0.46) * dpr);
      ctx.moveTo((cx + s * 0.78) * dpr, cy * dpr);
      ctx.lineTo((cx + s * 0.18) * dpr, (cy + s * 0.46) * dpr);
      ctx.stroke();
      return;
    }
    if (slot === "Z") {
      line2(ctx, dpr, cx - s * 0.9, cy, cx + s * 0.74, cy, 2, stroke);
      line2(ctx, dpr, cx - s * 0.46, cy - s * 0.34, cx + s * 0.1, cy - s * 0.34, 2, stroke);
      line2(ctx, dpr, cx - s * 0.46, cy + s * 0.34, cx + s * 0.1, cy + s * 0.34, 2, stroke);
      return;
    }
    if (slot === "E") {
      ctx.beginPath();
      ctx.arc(cx * dpr, cy * dpr, s * dpr, Math.PI * 0.2, Math.PI * 1.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx * dpr, (cy - s * 0.85) * dpr);
      ctx.lineTo((cx + s * 0.42) * dpr, cy * dpr);
      ctx.lineTo(cx * dpr, (cy + s * 0.85) * dpr);
      ctx.lineTo((cx - s * 0.42) * dpr, cy * dpr);
      ctx.closePath();
      ctx.stroke();
      return;
    }
    if (slot === "R") {
      for (let i = 0; i < 6; i += 1) {
        const a = Math.PI * 2 * i / 6;
        line2(ctx, dpr, cx, cy, cx + Math.cos(a) * s * 0.94, cy + Math.sin(a) * s * 0.94, 2, stroke);
      }
      ctx.beginPath();
      ctx.arc(cx * dpr, cy * dpr, s * 0.38 * dpr, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    if (slot === "P") {
      ctx.beginPath();
      ctx.moveTo(cx * dpr, (cy - s * 0.86) * dpr);
      ctx.bezierCurveTo((cx + s * 0.62) * dpr, (cy - s * 0.18) * dpr, (cx + s * 0.26) * dpr, (cy + s * 0.72) * dpr, cx * dpr, (cy + s * 0.92) * dpr);
      ctx.bezierCurveTo((cx - s * 0.3) * dpr, (cy + s * 0.72) * dpr, (cx - s * 0.62) * dpr, (cy - s * 0.16) * dpr, cx * dpr, (cy - s * 0.86) * dpr);
      ctx.stroke();
      line2(ctx, dpr, cx, cy - s * 0.32, cx, cy + s * 0.42, 2, stroke);
      return;
    }
  }
  if (slot === "D") {
    ctx.beginPath();
    ctx.arc(cx * dpr, cy * dpr, s * 0.65 * dpr, 0, Math.PI * 2);
    ctx.stroke();
    line2(ctx, dpr, cx - s * 0.35, cy, cx + s * 0.35, cy, 2, stroke);
    return;
  }
  if (slot === "F") {
    ctx.beginPath();
    ctx.moveTo(cx * dpr, (cy - s * 0.78) * dpr);
    ctx.lineTo((cx + s * 0.52) * dpr, cy * dpr);
    ctx.lineTo(cx * dpr, (cy + s * 0.78) * dpr);
    ctx.lineTo((cx - s * 0.52) * dpr, cy * dpr);
    ctx.closePath();
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  ctx.arc(cx * dpr, cy * dpr, s * 0.8 * dpr, 0, Math.PI * 2);
  ctx.stroke();
}
function drawStatGlyph(ctx, dpr, kind, x, y, accent) {
  const stroke = rgba(accent.r, accent.g, accent.b, 0.96);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2 * dpr;
  if (kind === "speed") {
    line2(ctx, dpr, x - 6, y, x + 6, y, 2, stroke);
    line2(ctx, dpr, x + 1, y - 5, x + 6, y, 2, stroke);
    line2(ctx, dpr, x + 1, y + 5, x + 6, y, 2, stroke);
    return;
  }
  if (kind === "damage") {
    line2(ctx, dpr, x - 6, y + 6, x, y - 6, 2, stroke);
    line2(ctx, dpr, x, y - 6, x + 6, y + 6, 2, stroke);
    line2(ctx, dpr, x - 3, y + 1, x + 3, y + 1, 2, stroke);
    return;
  }
  if (kind === "rate") {
    ctx.beginPath();
    ctx.arc(x * dpr, y * dpr, 7 * dpr, Math.PI * 0.15, Math.PI * 1.7);
    ctx.stroke();
    line2(ctx, dpr, x + 2, y - 4, x + 6, y - 1, 2, stroke);
    return;
  }
  if (kind === "regen") {
    line2(ctx, dpr, x, y - 7, x, y + 7, 2, stroke);
    line2(ctx, dpr, x - 4, y - 2, x, y - 7, 2, stroke);
    line2(ctx, dpr, x + 4, y - 2, x, y - 7, 2, stroke);
    return;
  }
  if (kind === "shield") {
    ctx.beginPath();
    ctx.moveTo((x - 6) * dpr, (y - 5) * dpr);
    ctx.lineTo((x + 6) * dpr, (y - 5) * dpr);
    ctx.lineTo((x + 4) * dpr, (y + 3) * dpr);
    ctx.lineTo(x * dpr, (y + 7) * dpr);
    ctx.lineTo((x - 4) * dpr, (y + 3) * dpr);
    ctx.closePath();
    ctx.stroke();
    return;
  }
  if (kind === "crit") {
    for (let i = 0; i < 5; i += 1) {
      const a0 = -Math.PI / 2 + Math.PI * 2 * i / 5;
      const a1 = a0 + Math.PI / 5;
      if (i === 0) ctx.beginPath();
      ctx.lineTo((x + Math.cos(a0) * 7) * dpr, (y + Math.sin(a0) * 7) * dpr);
      ctx.lineTo((x + Math.cos(a1) * 3) * dpr, (y + Math.sin(a1) * 3) * dpr);
    }
    ctx.closePath();
    ctx.stroke();
    return;
  }
  if (kind === "mult") {
    line2(ctx, dpr, x - 6, y - 6, x + 6, y + 6, 2, stroke);
    line2(ctx, dpr, x - 6, y + 6, x + 6, y - 6, 2, stroke);
    return;
  }
  line2(ctx, dpr, x - 6, y, x + 6, y, 2, stroke);
}

// client/src/ui/hud/HudLayout.js
function getCombatHudLayout(view) {
  const scale = clamp(Math.min(view.cssW / 1500, view.cssH / 900), 0.96, 1.14);
  const safeBottom = view.cssH - 18 * scale;
  const leftX = 18 * scale;
  const leftW = 468 * scale;
  const gapY = 8 * scale;
  const combatStatsH = 112 * scale;
  const lowerH = 64 * scale;
  const vitalsW = 254 * scale;
  const playerStatsW = leftW - vitalsW - 10 * scale;
  const lowerY = safeBottom - lowerH;
  const combatStatsY = lowerY - gapY - combatStatsH;
  const combatStatsRect = { x: leftX, y: combatStatsY, w: leftW, h: combatStatsH };
  const vitalsRect = { x: leftX, y: lowerY, w: vitalsW, h: lowerH };
  const playerStatsRect = { x: leftX + vitalsW + 10 * scale, y: lowerY, w: playerStatsW, h: lowerH };
  const cardW = 80 * scale;
  const cardH = 64 * scale;
  const gap = 10 * scale;
  const passiveW = 64 * scale;
  const utilityW = 56 * scale;
  const combatStripW = passiveW + 12 * scale + 4 * cardW + 3 * gap + 12 * scale + 2 * utilityW + 8 * scale;
  const minAbilityX = leftX + leftW + 38 * scale;
  const centeredAbilityX = view.cssW * 0.5 - combatStripW * 0.5;
  let abilityX = Math.max(minAbilityX, centeredAbilityX);
  const maxCombatX = view.cssW - combatStripW - 340 * scale;
  if (abilityX > maxCombatX) abilityX = Math.max(minAbilityX, maxCombatX);
  const hudY = safeBottom - cardH;
  const equipmentGap = 22 * scale;
  const equipmentSlotSize = 46 * scale;
  const equipmentSlotGap = 8 * scale;
  const equipmentCols = 4;
  const equipmentRows = 3;
  const equipmentPad = 10 * scale;
  const equipmentTitleH = 52 * scale;
  const equipmentW = equipmentPad * 2 + equipmentCols * equipmentSlotSize + (equipmentCols - 1) * equipmentSlotGap;
  const equipmentH = equipmentPad * 2 + equipmentTitleH + equipmentRows * equipmentSlotSize + (equipmentRows - 1) * equipmentSlotGap;
  const passiveRect = { x: abilityX, y: hudY, w: passiveW, h: cardH };
  const firstAbilityX = abilityX + passiveW + 12 * scale;
  const abilityRects = {
    A: { x: firstAbilityX + 0 * (cardW + gap), y: hudY, w: cardW, h: cardH },
    Z: { x: firstAbilityX + 1 * (cardW + gap), y: hudY, w: cardW, h: cardH },
    E: { x: firstAbilityX + 2 * (cardW + gap), y: hudY, w: cardW, h: cardH },
    R: { x: firstAbilityX + 3 * (cardW + gap), y: hudY, w: cardW, h: cardH }
  };
  const utilityX = firstAbilityX + 4 * (cardW + gap) + 3 * scale;
  const utilityRects = {
    D: { x: utilityX, y: hudY, w: utilityW, h: cardH },
    F: { x: utilityX + utilityW + 8 * scale, y: hudY, w: utilityW, h: cardH }
  };
  const desiredEquipmentX = utilityX + 2 * utilityW + 8 * scale + equipmentGap;
  const equipmentX = Math.min(desiredEquipmentX, view.cssW - equipmentW - 16 * scale);
  const equipmentY = safeBottom - equipmentH;
  const equipmentRect = { x: equipmentX, y: equipmentY, w: equipmentW, h: equipmentH };
  const equipmentSlotRects = [];
  const slotStartX = equipmentX + equipmentPad;
  const slotStartY = equipmentY + equipmentPad + equipmentTitleH;
  for (let i = 0; i < equipmentCols * equipmentRows; i += 1) {
    const col = i % equipmentCols;
    const row = Math.floor(i / equipmentCols);
    equipmentSlotRects.push({
      x: slotStartX + col * (equipmentSlotSize + equipmentSlotGap),
      y: slotStartY + row * (equipmentSlotSize + equipmentSlotGap),
      w: equipmentSlotSize,
      h: equipmentSlotSize
    });
  }
  return {
    scale,
    hudX: abilityX,
    hudY,
    centerX: firstAbilityX + 2 * (cardW + gap),
    y: combatStatsY,
    statusY: Math.max(8, hudY - 34 * scale),
    hintY: hudY - 28 * scale,
    abilityY: hudY,
    abilityScale: scale,
    abilityRects,
    passiveRect,
    utilityRects,
    equipmentRect,
    equipmentSlotRects,
    vitalsRect,
    playerStatsRect,
    combatStatsRect
  };
}
function hitTestHudAbility(view, px, py) {
  const layout = getCombatHudLayout(view);
  for (const slot of ["A", "Z", "E", "R"]) {
    const r = layout.abilityRects[slot];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return slot;
  }
  return null;
}

// client/src/ui/hud/HudVitalsPanelRenderer.js
function formatOne(value) {
  return Number.isFinite(value) ? value.toFixed(value >= 10 ? 0 : 1) : "0";
}
function formatPercent(value, digits = 0) {
  return `${((value ?? 0) * 100).toFixed(digits)}%`;
}
function drawPanel(ctx, dpr, r, title, accent, alpha = 0.2) {
  fillRoundedRect(ctx, dpr, r.x, r.y, r.w, r.h, 8, rgba(6, 8, 13, 0.88), rgba(accent.r, accent.g, accent.b, alpha), 1.1);
  fillRoundedRect(ctx, dpr, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, 6, rgba(11, 14, 22, 0.9), "rgba(255,255,255,0.028)");
  if (!title) return;
  ctx.fillStyle = rgba(168, 188, 218, 0.66);
  ctx.font = `700 ${8.5 * dpr}px Segoe UI`;
  ctx.textAlign = "left";
  ctx.fillText(title, (r.x + 8) * dpr, (r.y + 11) * dpr);
}
function getCombatStatRects(layout) {
  const scale = layout?.scale ?? 1;
  const r = layout?.combatStatsRect;
  if (!r) return [];
  const x0 = r.x + 12 * scale;
  const y0 = r.y + 27 * scale;
  const col = 88 * scale;
  const row = 25 * scale;
  return buildCombatStatEntries(null, null).map((entry, i) => ({ ...entry, x: x0 + col * (i % 5), y: y0 + row * Math.floor(i / 5), w: 82 * scale, h: 21 * scale }));
}
function hitTestCombatStat(layout, x, y) {
  for (const r of getCombatStatRects(layout)) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y - 9 * (layout?.scale ?? 1) && y <= r.y + r.h) return r;
  }
  return null;
}
function drawSmallStat(ctx, dpr, x, y, label, value, glyph, accent, scale) {
  drawStatGlyph(ctx, dpr, glyph, x, y + 1 * scale, accent);
  ctx.fillStyle = rgba(132, 154, 186, 0.78);
  ctx.font = `700 ${8.2 * scale * dpr}px Segoe UI`;
  ctx.textAlign = "left";
  ctx.fillText(label, (x + 14 * scale) * dpr, y * dpr);
  ctx.fillStyle = rgba(236, 244, 255, 0.96);
  ctx.font = `800 ${10.8 * scale * dpr}px Segoe UI`;
  ctx.fillText(value, (x + 14 * scale) * dpr, (y + 12 * scale) * dpr);
}
function drawProgressionPanel(ctx, dpr, r, me, myState, palette, scale) {
  const prog = { ...myState?.progression ?? {}, frameId: me.frameId || myState?.frameId || "vanguard" };
  const xp01 = clamp((prog.xp ?? 0) / Math.max(1, prog.nextXp ?? 1), 0, 1);
  const sp = prog.skillPoints ?? 0;
  drawPanel(ctx, dpr, r, "PROGRESSION", palette.outline, 0.18);
  const cx = r.x + 23 * scale;
  const cy = r.y + 36 * scale;
  ctx.beginPath();
  ctx.arc(cx * dpr, cy * dpr, 19 * scale * dpr, -Math.PI * 0.5, Math.PI * 1.5);
  ctx.strokeStyle = rgba(57, 69, 91, 0.82);
  ctx.lineWidth = 4 * scale * dpr;
  ctx.stroke();
  if (xp01 > 1e-3) {
    ctx.beginPath();
    ctx.arc(cx * dpr, cy * dpr, 19 * scale * dpr, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * xp01);
    ctx.strokeStyle = rgba(235, 193, 79, 0.98);
    ctx.lineWidth = 4 * scale * dpr;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.lineCap = "butt";
  }
  ctx.beginPath();
  ctx.arc(cx * dpr, cy * dpr, 14.5 * scale * dpr, 0, Math.PI * 2);
  ctx.fillStyle = rgba(5, 8, 13, 0.98);
  ctx.fill();
  drawFrameGlyph(ctx, dpr, prog.frameId, cx, cy - 1 * scale, 13 * scale, palette);
  const tx = r.x + 46 * scale;
  ctx.fillStyle = rgba(240, 246, 255, 0.95);
  ctx.font = `${11 * scale * dpr}px Segoe UI`;
  ctx.textAlign = "left";
  ctx.fillText(`Niv. ${prog.level ?? 1}`, tx * dpr, (r.y + 31 * scale) * dpr);
  ctx.fillStyle = rgba(171, 190, 218, 0.82);
  ctx.font = `${8.5 * scale * dpr}px Segoe UI`;
  ctx.fillText(`${Math.floor(prog.xp ?? 0)} / ${Math.floor(prog.nextXp ?? 1)} XP`, tx * dpr, (r.y + 45 * scale) * dpr);
  drawMeterRow(ctx, dpr, tx, r.y + 51 * scale, Math.max(44 * scale, r.w - 56 * scale), 5 * scale, xp01, { r: 230, g: 188, b: 70 }, "");
  const pillW = 48 * scale;
  const pillX = r.x + r.w - pillW - 7 * scale;
  fillRoundedRect(ctx, dpr, pillX, r.y + 8 * scale, pillW, 18 * scale, 6, sp > 0 ? rgba(13, 34, 22, 0.95) : rgba(18, 22, 30, 0.84), sp > 0 ? rgba(111, 250, 159, 0.58) : rgba(105, 116, 138, 0.2));
  ctx.fillStyle = sp > 0 ? rgba(139, 252, 176, 0.98) : rgba(164, 176, 198, 0.72);
  ctx.font = `${8.2 * scale * dpr}px Segoe UI`;
  ctx.textAlign = "center";
  ctx.fillText(`${sp} pt`, (pillX + pillW * 0.5) * dpr, (r.y + 20.5 * scale) * dpr);
}
function buildCombatStatEntries(me, myState) {
  const derived = myState?.derived ?? {};
  return [
    { id: "damage", label: "D\xE9g\xE2ts", value: formatOne(derived.autoAttackDamage ?? 0), glyph: "damage", accent: { r: 255, g: 180, b: 110 }, desc: "D\xE9g\xE2ts estim\xE9s de l\u2019attaque principale avant mitigation de la cible." },
    { id: "speed", label: "Vitesse", value: formatOne(derived.moveSpeed ?? me?.engine ?? 0), glyph: "speed", accent: { r: 116, g: 226, b: 255 }, desc: "Vitesse de d\xE9placement actuelle apr\xE8s moteur, effets et bonus de bastion." },
    { id: "rate", label: "Cadence", value: `${formatOne(derived.autoAttackRate ?? 0)}/s`, glyph: "rate", accent: { r: 90, g: 255, b: 195 }, desc: "Nombre d\u2019attaques principales par seconde." },
    { id: "crit", label: "Critique", value: formatPercent(derived.critChance ?? 0), glyph: "crit", accent: { r: 248, g: 206, b: 104 }, desc: "Chance que l\u2019attaque principale inflige un critique." },
    { id: "armor", label: "Armure", value: formatOne(derived.armor ?? 0), glyph: "shield", accent: { r: 155, g: 190, b: 230 }, desc: "R\xE9duit les d\xE9g\xE2ts directs sur la coque. La p\xE9n\xE9tration ennemie l\u2019ignore partiellement." },
    { id: "hregen", label: "Coque/s", value: formatOne(derived.hullRegen ?? 0), glyph: "regen", accent: { r: 255, g: 103, b: 112 }, desc: "R\xE9g\xE9n\xE9ration de coque par seconde." },
    { id: "sregen", label: "Bouclier/s", value: formatOne(derived.shieldRegen ?? 0), glyph: "shield", accent: { r: 117, g: 181, b: 255 }, desc: "R\xE9g\xE9n\xE9ration du bouclier apr\xE8s le d\xE9lai sans d\xE9g\xE2ts." },
    { id: "eregen", label: "\xC9nergie/s", value: formatOne(derived.energyRegen ?? 0), glyph: "regen", accent: { r: 183, g: 122, b: 255 }, desc: "R\xE9g\xE9n\xE9ration d\u2019\xE9nergie par seconde." },
    { id: "dmgmult", label: "Multi. dmg", value: `x${formatOne(derived.damageMult ?? 1)}`, glyph: "damage", accent: { r: 255, g: 180, b: 110 }, desc: "Multiplicateur g\xE9n\xE9ral des d\xE9g\xE2ts du build." },
    { id: "shieldpen", label: "Pen. bouclier", value: formatPercent(derived.shieldPenPct ?? 0), glyph: "mult", accent: { r: 112, g: 220, b: 255 }, desc: "Part des d\xE9g\xE2ts qui traverse directement le bouclier pour toucher la coque." },
    { id: "cdr", label: "R\xE9cup. CD", value: `x${formatOne(derived.cooldownRecoveryMult ?? 1)}`, glyph: "rate", accent: { r: 90, g: 255, b: 195 }, desc: "Vitesse de r\xE9cup\xE9ration des cooldowns de comp\xE9tences." },
    { id: "critdmg", label: "Crit x", value: `x${formatOne(derived.critDamageMult ?? 1.5)}`, glyph: "crit", accent: { r: 248, g: 206, b: 104 }, desc: "Multiplicateur appliqu\xE9 aux critiques." },
    { id: "lifesteal", label: "Vol de vie", value: formatPercent(derived.lifestealRatio ?? 0), glyph: "regen", accent: { r: 255, g: 103, b: 112 }, desc: "Part des d\xE9g\xE2ts rendue en coque." },
    { id: "armorpen", label: "Pen. armure", value: formatOne(derived.armorPenFlat ?? 0), glyph: "damage", accent: { r: 255, g: 150, b: 100 }, desc: "Armure ignor\xE9e quand tu infliges des d\xE9g\xE2ts \xE0 la coque." },
    { id: "rockets", label: "Roquettes", value: String(derived.rocketAmmoQuantity ?? 0), glyph: "mult", accent: { r: 255, g: 182, b: 86 }, desc: "Munitions du type de roquette actuellement actif." }
  ];
}
function drawCombatStatsPanel(ctx, dpr, r, me, myState, palette, scale) {
  drawPanel(ctx, dpr, r, "STATISTIQUES", palette.outline, 0.16);
  const rects = getCombatStatRects({ combatStatsRect: r, scale });
  const stats = buildCombatStatEntries(me, myState);
  for (let i = 0; i < stats.length; i += 1) {
    const entry = stats[i];
    const pos = rects[i];
    drawSmallStat(ctx, dpr, pos.x, pos.y, entry.label, entry.value, entry.glyph, entry.accent, scale);
  }
}
function drawVitalsBars(ctx, dpr, r, me, palette, scale) {
  const vitals = me.vitals;
  const hp01 = clamp(vitals.hp / Math.max(1, vitals.maxHp), 0, 1);
  const sh01 = clamp(vitals.shield / Math.max(1, vitals.maxShield), 0, 1);
  const en01 = clamp(vitals.energy / Math.max(1, vitals.maxEnergy), 0, 1);
  drawPanel(ctx, dpr, r, "", palette.outline, 0.2);
  const x = r.x + 10 * scale;
  const valueW = 62 * scale;
  const w = r.w - 22 * scale - valueW;
  drawMeterRow(ctx, dpr, x, r.y + 12 * scale, w, 10 * scale, hp01, COLORS.hp, "");
  drawMeterRow(ctx, dpr, x, r.y + 32 * scale, w, 9 * scale, sh01, COLORS.shield, "");
  drawMeterRow(ctx, dpr, x, r.y + 50 * scale, w, 9 * scale, en01, COLORS.energy, "");
  ctx.textAlign = "right";
  ctx.font = `800 ${10.2 * scale * dpr}px Segoe UI`;
  ctx.fillStyle = "rgba(240,246,255,0.94)";
  ctx.fillText(`${Math.ceil(vitals.hp)} / ${Math.ceil(vitals.maxHp)}`, (r.x + r.w - 10 * scale) * dpr, (r.y + 20.5 * scale) * dpr);
  ctx.fillText(`${Math.ceil(vitals.shield)} / ${Math.ceil(vitals.maxShield)}`, (r.x + r.w - 10 * scale) * dpr, (r.y + 39.5 * scale) * dpr);
  ctx.fillText(`${Math.ceil(vitals.energy)} / ${Math.ceil(vitals.maxEnergy)}`, (r.x + r.w - 10 * scale) * dpr, (r.y + 57.5 * scale) * dpr);
}
function drawVitalsPanel(ctx, view, me, myState, frameDef) {
  const layout = getCombatHudLayout(view);
  if (!me?.vitals) return layout;
  const dpr = view.dpr;
  const scale = layout.scale;
  const palette = getShipFramePalette(me.frameId || myState?.frameId || "vanguard");
  drawVitalsBars(ctx, dpr, layout.vitalsRect, me, palette, scale);
  drawProgressionPanel(ctx, dpr, layout.playerStatsRect, me, myState, palette, scale);
  drawCombatStatsPanel(ctx, dpr, layout.combatStatsRect, me, myState, palette, scale);
  return layout;
}

// client/src/ui/AbilityBarRenderer.js
function drawCooldownOverlay(ctx, dpr, x, y, w, h, cooldownRatio) {
  if (cooldownRatio <= 1e-3) return;
  ctx.save();
  fillRoundedRect(ctx, dpr, x, y, w, h * cooldownRatio, 7, rgba(0, 0, 0, 0.58));
  ctx.restore();
}
function drawPips(ctx, dpr, x, y, w, level, max, accent) {
  const shown = Math.min(max, 15);
  const gap = 2;
  const pipW = Math.max(2.2, (w - gap * (shown - 1)) / shown);
  for (let i = 0; i < shown; i += 1) {
    fillRoundedRect(
      ctx,
      dpr,
      x + i * (pipW + gap),
      y,
      pipW,
      3,
      1.2,
      i < level ? rgba(accent.r, accent.g, accent.b, 0.95) : rgba(63, 69, 86, 0.82)
    );
  }
}
function drawAbilityCard(ctx, dpr, x, y, w, h, slot, active, accent, frameId) {
  const level = Math.max(0, slot?.investedLevel ?? 0);
  const unlocked = !!slot?.forceUnlocked || level > 0 && slot?.unlocked !== false;
  const maxLevel = slot?.slot === "R" ? 5 : 15;
  const cooldownMax = Math.max(slot?.cooldownMax ?? 0, slot?.cooldownLeft ?? 0, 1e-3);
  const cooldownRatio = unlocked ? clamp((slot?.cooldownLeft ?? 0) / cooldownMax, 0, 1) : 0;
  const ready = unlocked && (slot?.cooldownLeft ?? 0) <= 1e-3;
  const canCast = ready && slot?.hasEnergy !== false;
  const canUpgrade = !!slot?.canUpgrade;
  const key = String(slot?.key ?? "?");
  const isUtility = key === "D" || key === "F";
  const bgAlpha = unlocked ? 0.95 : 0.72;
  const innerAlpha = unlocked ? 0.86 : 0.42;
  const border = unlocked ? ready ? rgba(accent.r, accent.g, accent.b, 0.78) : rgba(128, 143, 176, 0.34) : canUpgrade ? rgba(103, 246, 152, 0.62) : rgba(93, 103, 125, 0.24);
  fillRoundedRect(ctx, dpr, x, y, w, h, 10, rgba(7, 10, 16, bgAlpha), border, canUpgrade ? 1.8 : 1.1);
  fillRoundedRect(ctx, dpr, x + 3, y + 3, w - 6, h - 6, 8, active ? rgba(accent.r, accent.g, accent.b, 0.18) : rgba(16, 20, 31, innerAlpha), "rgba(255,255,255,0.025)");
  if (canUpgrade) {
    ctx.fillStyle = rgba(72, 255, 139, 0.92);
    ctx.beginPath();
    ctx.moveTo((x + w - 16) * dpr, (y + 6) * dpr);
    ctx.lineTo((x + w - 7) * dpr, (y + 15) * dpr);
    ctx.lineTo((x + w - 25) * dpr, (y + 15) * dpr);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = rgba(239, 246, 255, unlocked ? 0.96 : 0.62);
  ctx.font = `700 ${12 * dpr}px Segoe UI`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(key, (x + 8) * dpr, (y + 16) * dpr);
  if (!isUtility) {
    ctx.textAlign = "right";
    ctx.font = `700 ${10 * dpr}px Segoe UI`;
    ctx.fillStyle = unlocked ? rgba(255, 215, 105, 0.95) : rgba(154, 163, 184, 0.66);
    ctx.fillText(`${level}/${maxLevel}`, (x + w - 8) * dpr, (y + 16) * dpr);
  }
  const glyphAlpha = unlocked ? 0.96 : 0.2;
  ctx.save();
  ctx.globalAlpha = glyphAlpha;
  drawAbilityGlyph(ctx, dpr, frameId, slot?.slot ?? key, x + w * 0.5 - 14, y + 20, 28, 24, accent);
  ctx.restore();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  if (isUtility) {
    ctx.fillStyle = rgba(207, 219, 238, 0.72);
    ctx.font = `${9 * dpr}px Segoe UI`;
    ctx.fillText(key === "D" ? "dock" : "rocket", (x + w * 0.5) * dpr, (y + h - 9) * dpr);
  } else if (!unlocked) {
    ctx.fillStyle = canUpgrade ? rgba(164, 255, 194, 0.95) : rgba(145, 154, 174, 0.66);
    ctx.font = `700 ${9.2 * dpr}px Segoe UI`;
    ctx.fillText(canUpgrade ? "\xC0 D\xC9BLOQUER" : "VERROUILL\xC9", (x + w * 0.5) * dpr, (y + h - 14) * dpr);
  } else {
    if (slot?.energyCost != null) {
      ctx.fillStyle = canCast ? rgba(183, 139, 255, 0.92) : rgba(238, 104, 108, 0.84);
      ctx.font = `${8.4 * dpr}px Segoe UI`;
      ctx.fillText(`${Math.round(slot.energyCost)}`, (x + w * 0.5) * dpr, (y + h - 11) * dpr);
    }
  }
  if (!isUtility) {
    const maxPips = Math.min(maxLevel, 5);
    const filledPips = Math.min(maxPips, Math.ceil(level / maxLevel * maxPips));
    drawPips(ctx, dpr, x + 9, y + h - 4, w - 18, filledPips, maxPips, unlocked ? accent : { r: 92, g: 98, b: 116 });
  }
  drawCooldownOverlay(ctx, dpr, x, y, w, h, cooldownRatio);
  if (cooldownRatio > 1e-3) {
    ctx.fillStyle = rgba(255, 238, 205, 0.96);
    ctx.textAlign = "center";
    ctx.font = `700 ${16 * dpr}px Segoe UI`;
    ctx.fillText((slot.cooldownLeft ?? 0).toFixed((slot.cooldownLeft ?? 0) >= 10 ? 0 : 1), (x + w * 0.5) * dpr, (y + h * 0.56) * dpr);
  }
}

// client/src/ui/hud/HudAbilityStripRenderer.js
var SLOT_ACCENTS = {
  A: { r: 116, g: 226, b: 255 },
  Z: { r: 118, g: 244, b: 196 },
  E: { r: 124, g: 154, b: 255 },
  R: { r: 243, g: 196, b: 104 },
  D: COLORS.dock,
  F: COLORS.warning,
  P: { r: 223, g: 179, b: 94 }
};
function drawHint(ctx, dpr, x, y, text, accent, scale) {
  ctx.font = `${9 * scale * dpr}px Segoe UI`;
  const w = ctx.measureText(text).width / dpr + 16 * scale;
  fillRoundedRect(ctx, dpr, x, y, w, 20 * scale, 7, "rgba(7,10,16,0.90)", `rgba(${accent.r},${accent.g},${accent.b},0.25)`);
  ctx.fillStyle = "rgba(232,239,252,0.90)";
  ctx.textAlign = "center";
  ctx.fillText(text, (x + w * 0.5) * dpr, (y + 13.5 * scale) * dpr);
}
function drawPassiveCard(ctx, dpr, r, me, myState, scale) {
  const accent = SLOT_ACCENTS.P;
  fillRoundedRect(ctx, dpr, r.x, r.y, r.w, r.h, 7, "rgba(8,11,18,0.92)", `rgba(${accent.r},${accent.g},${accent.b},0.36)`);
  fillRoundedRect(ctx, dpr, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 5, "rgba(12,16,26,0.93)", "rgba(255,255,255,0.03)");
  drawAbilityGlyph(ctx, dpr, me?.frameId || myState?.frameId || "vanguard", "P", r.x + 12 * scale, r.y + 9 * scale, r.w - 24 * scale, r.h - 19 * scale, accent);
  ctx.fillStyle = "rgba(244,247,255,0.92)";
  ctx.font = `${10 * scale * dpr}px Segoe UI`;
  ctx.textAlign = "left";
  ctx.fillText("P", (r.x + 5 * scale) * dpr, (r.y + 14 * scale) * dpr);
  if (myState?.frameState?.passiveMaxStacks > 0) {
    const fs = myState.frameState;
    const maxStacks = Math.min(fs.passiveMaxStacks ?? 10, 10);
    const active = Math.min(fs.passiveStacks ?? 0, maxStacks);
    const pipW = (r.w - 10 * scale - (maxStacks - 1) * 2 * scale) / maxStacks;
    for (let i = 0; i < maxStacks; i += 1) {
      fillRoundedRect(ctx, dpr, r.x + 5 * scale + i * (pipW + 2 * scale), r.y + r.h - 5 * scale, pipW, 2.4 * scale, 1.1, i < active ? "rgba(223,179,94,0.94)" : "rgba(74,78,92,0.78)");
    }
  }
}
function drawUtilityCard(ctx, dpr, r, key, label, active, accent, cooldownLeft = 0, cooldownMax = 1, scale = 1) {
  const cooling = Math.max(0, cooldownLeft) > 1e-3;
  const ratio = cooling ? Math.min(1, Math.max(0, cooldownLeft / Math.max(cooldownMax, cooldownLeft, 1e-3))) : 0;
  fillRoundedRect(ctx, dpr, r.x, r.y, r.w, r.h, 10, "rgba(7,10,16,0.93)", `rgba(${accent.r},${accent.g},${accent.b},0.50)`, active ? 1.8 : 1.1);
  fillRoundedRect(ctx, dpr, r.x + 3, r.y + 3, r.w - 6, r.h - 6, 8, active ? `rgba(${accent.r},${accent.g},${accent.b},0.16)` : "rgba(16,20,31,0.88)", "rgba(255,255,255,0.025)");
  ctx.fillStyle = "rgba(242,247,255,0.96)";
  ctx.font = `800 ${15 * scale * dpr}px Segoe UI`;
  ctx.textAlign = "left";
  ctx.fillText(key, (r.x + 8 * scale) * dpr, (r.y + 18 * scale) * dpr);
  drawAbilityGlyph(ctx, dpr, "vanguard", key, r.x + r.w * 0.5 - 16 * scale, r.y + 23 * scale, 32 * scale, 24 * scale, accent);
  ctx.fillStyle = "rgba(210,222,242,0.82)";
  ctx.font = `700 ${9.2 * scale * dpr}px Segoe UI`;
  ctx.textAlign = "center";
  ctx.fillText(label, (r.x + r.w * 0.5) * dpr, (r.y + r.h - 10 * scale) * dpr);
  if (cooling) {
    fillRoundedRect(ctx, dpr, r.x, r.y, r.w, r.h * ratio, 10, "rgba(0,0,0,0.58)");
    ctx.fillStyle = "rgba(255,238,205,0.96)";
    ctx.font = `800 ${15 * scale * dpr}px Segoe UI`;
    ctx.textAlign = "center";
    ctx.fillText(cooldownLeft.toFixed(cooldownLeft >= 10 ? 0 : 1), (r.x + r.w * 0.5) * dpr, (r.y + r.h * 0.55) * dpr);
  }
}
function slotWithEnergy(slot, me) {
  if (!slot) return slot;
  if (slot.energyCost == null) return slot;
  return { ...slot, hasEnergy: (me?.vitals?.energy ?? 0) >= slot.energyCost };
}
function drawAbilityStrip(ctx, view, me, myState, input, layout) {
  const dpr = view.dpr;
  const scale = layout?.scale ?? 1;
  const rects = layout?.abilityRects;
  if (!rects) return;
  const cards = {
    A: { ...slotWithEnergy(myState?.abilityHud?.A, me), keyHeld: input.a },
    Z: { ...slotWithEnergy(myState?.abilityHud?.Z, me), keyHeld: input.z },
    E: { ...slotWithEnergy(myState?.abilityHud?.E, me), keyHeld: input.e },
    R: { ...slotWithEnergy(myState?.abilityHud?.R, me), keyHeld: input.r }
  };
  drawPassiveCard(ctx, dpr, layout.passiveRect, me, myState, scale);
  for (const slot of ["A", "Z", "E", "R"]) {
    const r = rects[slot];
    drawAbilityCard(ctx, dpr, r.x, r.y, r.w, r.h, cards[slot], cards[slot].keyHeld, SLOT_ACCENTS[slot] ?? COLORS.fx, me?.frameId || myState?.frameId || "vanguard");
  }
  if (layout.utilityRects?.D) {
    drawUtilityCard(ctx, dpr, layout.utilityRects.D, "D", "Dock", input.interactTap, SLOT_ACCENTS.D, 0, 1, scale);
  }
  if (layout.utilityRects?.F) {
    drawUtilityCard(ctx, dpr, layout.utilityRects.F, "F", "Rocket", input.rocketTap, SLOT_ACCENTS.F, me?.rocketCooldownLeft ?? 0, 8, scale);
  }
  if (myState?.dockedStationId) drawHint(ctx, dpr, layout.hudX, layout.hintY, "Station proche : D", COLORS.fx, scale);
}

// shared/content/items/ItemCategoryIds.js
var ITEM_CATEGORY_IDS = Object.freeze({
  WEAPON: "weapon",
  LAUNCHER: "launcher",
  AMMO: "ammo",
  DEFENSE: "defense",
  ENGINE: "engine",
  MODULE: "module",
  CONVERTER: "converter"
});
var ITEM_CATEGORY_ORDER = Object.freeze([
  ITEM_CATEGORY_IDS.WEAPON,
  ITEM_CATEGORY_IDS.LAUNCHER,
  ITEM_CATEGORY_IDS.AMMO,
  ITEM_CATEGORY_IDS.DEFENSE,
  ITEM_CATEGORY_IDS.ENGINE,
  ITEM_CATEGORY_IDS.MODULE,
  ITEM_CATEGORY_IDS.CONVERTER
]);
var EQUIPMENT_CATEGORY_ORDER = Object.freeze([
  ITEM_CATEGORY_IDS.WEAPON,
  ITEM_CATEGORY_IDS.LAUNCHER,
  ITEM_CATEGORY_IDS.AMMO,
  ITEM_CATEGORY_IDS.DEFENSE,
  ITEM_CATEGORY_IDS.ENGINE,
  ITEM_CATEGORY_IDS.MODULE,
  ITEM_CATEGORY_IDS.CONVERTER
]);
function getItemCategoryName(categoryId) {
  switch (categoryId) {
    case ITEM_CATEGORY_IDS.WEAPON:
      return "Armes";
    case ITEM_CATEGORY_IDS.LAUNCHER:
      return "Lance-roquettes";
    case ITEM_CATEGORY_IDS.AMMO:
      return "Roquettes";
    case ITEM_CATEGORY_IDS.DEFENSE:
      return "Boucliers";
    case ITEM_CATEGORY_IDS.ENGINE:
      return "Propulseurs";
    case ITEM_CATEGORY_IDS.MODULE:
      return "Modules";
    case ITEM_CATEGORY_IDS.CONVERTER:
      return "Convertisseurs";
    default:
      return "Item";
  }
}

// shared/content/items/ItemTagIds.js
var ITEM_TAG_IDS = Object.freeze({
  REAVER: "reaver",
  WARDEN: "warden",
  SURGE: "surge",
  VERGE: "verge",
  SIEGE: "siege",
  SIPHON: "siphon"
});
var ITEM_TAG_ORDER = Object.freeze([
  ITEM_TAG_IDS.REAVER,
  ITEM_TAG_IDS.WARDEN,
  ITEM_TAG_IDS.SURGE,
  ITEM_TAG_IDS.VERGE,
  ITEM_TAG_IDS.SIEGE,
  ITEM_TAG_IDS.SIPHON
]);

// shared/content/items/ItemTagDefs.js
var ITEM_TAG_DEFS = Object.freeze({
  [ITEM_TAG_IDS.REAVER]: { id: ITEM_TAG_IDS.REAVER, name: "Reaver", short: "RVR", colorHex: "#ff746d" },
  [ITEM_TAG_IDS.WARDEN]: { id: ITEM_TAG_IDS.WARDEN, name: "Warden", short: "WRD", colorHex: "#69b8ff" },
  [ITEM_TAG_IDS.SURGE]: { id: ITEM_TAG_IDS.SURGE, name: "Surge", short: "SRG", colorHex: "#c07dff" },
  [ITEM_TAG_IDS.VERGE]: { id: ITEM_TAG_IDS.VERGE, name: "Verge", short: "VRG", colorHex: "#7be59d" },
  [ITEM_TAG_IDS.SIEGE]: { id: ITEM_TAG_IDS.SIEGE, name: "Siege", short: "SGE", colorHex: "#ffbb69" },
  [ITEM_TAG_IDS.SIPHON]: { id: ITEM_TAG_IDS.SIPHON, name: "Siphon", short: "SIP", colorHex: "#65e3db" }
});
function getItemTagDef(tagId) {
  return ITEM_TAG_DEFS[tagId] ?? null;
}

// client/src/ui/station/StationItemVisuals.js
var TIER_COLORS = Object.freeze({
  1: "#6f89a8",
  2: "#82b56e",
  3: "#c2a15b",
  4: "#b27ac8"
});
function getItemAccentColor(item) {
  const firstTag = item?.tags?.[0]?.tagId ? getItemTagDef(item.tags[0].tagId) : null;
  if (firstTag?.colorHex) return firstTag.colorHex;
  return TIER_COLORS[item?.tier | 0] || "#7dd6ff";
}
function getItemGlyph(item) {
  switch (item?.categoryId) {
    case ITEM_CATEGORY_IDS.WEAPON:
      return "\u2736";
    case ITEM_CATEGORY_IDS.LAUNCHER:
      return "\u2604";
    case ITEM_CATEGORY_IDS.AMMO:
      return "\u25C9";
    case ITEM_CATEGORY_IDS.DEFENSE:
      return "\u26E8";
    case ITEM_CATEGORY_IDS.ENGINE:
      return "\u27A4";
    case ITEM_CATEGORY_IDS.MODULE:
      return "\u25C6";
    case ITEM_CATEGORY_IDS.CONVERTER:
      return "\u21BB";
    default:
      return "\u2022";
  }
}
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}
function formatBonusLabel(key, value) {
  const amount = Number.isFinite(value) ? value : 0;
  if (!amount) return "";
  switch (key) {
    case "hpFlat":
      return `+${Math.round(amount)} coque`;
    case "shieldFlat":
      return `+${Math.round(amount)} bouclier`;
    case "energyFlat":
      return `+${Math.round(amount)} \xE9nergie`;
    case "energyRegenFlat":
      return `+${amount.toFixed(2)} \xE9nergie/s`;
    case "energyRegenPct":
      return `+${Math.round(amount * 100)}% r\xE9g\xE9n. \xE9nergie`;
    case "hullRegenFlat":
      return `+${amount.toFixed(2)} coque/s`;
    case "enginePct":
      return `+${Math.round(amount * 100)}% moteur`;
    case "damageMultPct":
      return `+${Math.round(amount * 100)}% d\xE9g\xE2ts`;
    case "fireRatePct":
      return `+${Math.round(amount * 100)}% cadence auto`;
    case "cooldownReductionPct":
      return `+${Math.round(amount * 100)}% CDR`;
    case "critChancePct":
      return `+${Math.round(amount * 100)}% critique auto`;
    case "critDamagePct":
      return `+${Math.round(amount * 100)}% d\xE9g\xE2ts critiques`;
    case "lifestealPct":
      return `+${Math.round(amount * 100)}% vol de vie`;
    case "healPowerPct":
      return `+${Math.round(amount * 100)}% soins`;
    case "cargoFlat":
      return `+${Math.round(amount)} soute`;
    case "rocketDamagePct":
      return `+${Math.round(amount * 100)}% d\xE9g\xE2ts roquettes`;
    case "autoRangePct":
      return `+${Math.round(amount * 100)}% port\xE9e auto`;
    case "armorFlat":
      return `+${Math.round(amount)} armure`;
    case "shieldPenPct":
      return `+${Math.round(amount * 100)}% p\xE9n\xE9tration bouclier`;
    case "armorPenFlat":
      return `+${Math.round(amount)} p\xE9n\xE9tration armure`;
    default:
      return "";
  }
}
function getItemShortTag(item) {
  const firstTag = item?.tags?.[0]?.tagId ? getItemTagDef(item.tags[0].tagId) : null;
  return firstTag?.short || "";
}
function getItemTagText(item) {
  return (item?.tags || []).map((entry) => {
    const def = getItemTagDef(entry.tagId);
    if (!def) return null;
    const pts = Math.max(1, entry.points | 0);
    return `${def.name} ${"\u25CF".repeat(pts)}`;
  }).filter(Boolean).join(" \u2022 ");
}
function getItemMetaText(item) {
  const category = getItemCategoryName(item?.categoryId);
  const tier = `T${Math.max(1, item?.tier | 0)}`;
  const state = item?.equipped ? "\xE9quip\xE9" : item?.owned ? "poss\xE9d\xE9" : "";
  return [category, tier, state].filter(Boolean).join(" \u2022 ");
}
function getItemStatLines(item) {
  const lines = [];
  const bonuses = Object.entries(item?.bonuses || {}).map(([key, value]) => formatBonusLabel(key, value)).filter(Boolean);
  lines.push(...bonuses);
  const weapon = item?.weaponProfile;
  if (weapon) {
    lines.push(`${Math.round(weapon.damage || 0)} d\xE9g\xE2ts auto`);
    lines.push(`${Number(weapon.cooldown || 0).toFixed(2)}s cadence`);
    lines.push(`${Math.round(weapon.range || 0)} port\xE9e`);
  }
  const launcher = item?.launcherProfile;
  if (launcher) {
    lines.push(`${Math.max(1, launcher.volley | 0)} roquettes / salve`);
    lines.push(`${Number(launcher.cooldown || 0).toFixed(1)}s recharge`);
    lines.push(`${Math.round(launcher.range || 0)} port\xE9e`);
  }
  const ammo = item?.ammoProfile;
  if (ammo) {
    lines.push(`${Math.round(ammo.damage || 0)} d\xE9g\xE2ts roquette`);
  }
  const converter = item?.converterProfile;
  if (converter) {
    lines.push(`${Math.max(1, converter.inputAmount | 0)} ${converter.inputKey || "?"} \u2192 ${Math.max(1, converter.outputAmount | 0)} ${converter.outputKey || "?"}`);
    lines.push(`${Number(converter.seconds || 0).toFixed(1)}s / cycle`);
    if (Number.isFinite(converter.energyPerSecond)) lines.push(`${Number(converter.energyPerSecond || 0).toFixed(2)} \xE9nergie/s`);
  }
  return lines.filter(Boolean);
}
function getAmmoPassiveLines(item) {
  const ammo = item?.ammoProfile;
  if (!ammo?.effectType) return [];
  const duration = Number(ammo.effectDuration || 0);
  const magnitude = Number(ammo.effectMagnitude || 0);
  if (ammo.effectType === "slow") return [`Ralentit les cibles touch\xE9es de ${Math.round(magnitude * 100)}% pendant ${duration.toFixed(1)}s`];
  if (ammo.effectType === "burn") return [`Br\xFBle les cibles touch\xE9es : ${magnitude.toFixed(1)} d\xE9g\xE2ts/s pendant ${duration.toFixed(1)}s`];
  if (ammo.effectType === "stun") return [`\xC9tourdit les cibles touch\xE9es pendant ${duration.toFixed(1)}s`];
  return [ammo.summary || ammo.effectType].filter(Boolean);
}
function getItemPassiveLines(item) {
  const raw = item?.passives || item?.passiveEffects || item?.passive || null;
  const lines = [];
  if (Array.isArray(raw)) lines.push(...raw.map((entry) => typeof entry === "string" ? entry : entry?.text || entry?.description || entry?.name || "").filter(Boolean));
  else if (typeof raw === "string") lines.push(raw);
  else if (raw) lines.push(raw.text || raw.description || raw.name || "Passif");
  lines.push(...getAmmoPassiveLines(item));
  return lines.filter(Boolean);
}
function getItemActiveLines(item) {
  const raw = item?.actives || item?.activeEffects || item?.active || null;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((entry) => typeof entry === "string" ? entry : entry?.text || entry?.description || entry?.name || "").filter(Boolean);
  if (typeof raw === "string") return [raw];
  return [raw.text || raw.description || raw.name || "Actif"].filter(Boolean);
}
function renderStationInfoSection(title, body, opts = {}) {
  const content = Array.isArray(body) ? body.filter(Boolean).map((line3) => `<div class="station-info-row">${escapeHtml(line3)}</div>`).join("") : String(body || "");
  const empty = opts.emptyText ? `<div class="station-info-muted">${escapeHtml(opts.emptyText)}</div>` : "";
  return `
    <section class="station-info-section">
      <div class="station-info-section__title">${escapeHtml(title)}</div>
      <div class="station-info-section__body">${content || empty}</div>
    </section>
  `;
}
function renderStationChips(lines, emptyText = "Aucun") {
  const safe = (lines || []).filter(Boolean);
  if (!safe.length) return `<span class="station-info-muted">${escapeHtml(emptyText)}</span>`;
  return safe.map((line3) => `<span class="station-info-chip">${escapeHtml(line3)}</span>`).join("");
}
function renderItemSections(item, opts = {}) {
  const tags = getItemTagText(item);
  const stats = getItemStatLines(item);
  const passive = getItemPassiveLines(item);
  const active = getItemActiveLines(item);
  const identity = [];
  if (opts.status) identity.push(opts.status);
  if (opts.source) identity.push(opts.source);
  return [
    renderStationInfoSection("Type", identity),
    renderStationInfoSection("Tags", renderStationChips(tags ? tags.split(" \u2022 ") : [], "Aucun tag")),
    renderStationInfoSection("Stats", renderStationChips(stats, "Aucune stat brute")),
    renderStationInfoSection("Passif", renderStationChips(passive, "Aucun passif")),
    renderStationInfoSection("Actif", renderStationChips(active, "Aucun actif"))
  ].join("");
}
function getItemTooltipText(item) {
  if (!item) return "Item";
  const lines = [];
  lines.push(`${item.name || "Item"} [T${Math.max(1, item?.tier | 0)}]`);
  lines.push(getItemCategoryName(item?.categoryId));
  const tagText = getItemTagText(item);
  if (tagText) lines.push(tagText);
  lines.push(...getItemStatLines(item));
  const passive = getItemPassiveLines(item);
  if (passive.length) lines.push(`Passif : ${passive.join(" \u2022 ")}`);
  const active = getItemActiveLines(item);
  if (active.length) lines.push(`Actif : ${active.join(" \u2022 ")}`);
  return lines.filter(Boolean).join("\n");
}
function buildItemIconMarkup(item, opts = {}, tagName = "button") {
  const accent = getItemAccentColor(item);
  const glyph = getItemGlyph(item);
  const shortTag = getItemShortTag(item);
  const classes = [
    "station-item-icon",
    opts.selected ? "is-selected" : "",
    item?.owned ? "is-owned" : "",
    item?.equipped ? "is-equipped" : "",
    opts.compact ? "is-compact" : ""
  ].filter(Boolean).join(" ");
  const tier = Math.max(1, item?.tier | 0);
  const badge = shortTag ? `<span class="station-item-icon__tag">${shortTag}</span>` : "";
  const equipped = item?.equipped ? '<span class="station-item-icon__equip">E</span>' : "";
  const label = opts.showName ? `<span class="station-item-icon__label">${item?.shortName || item?.name || getItemCategoryName(item?.categoryId)}</span>` : "";
  const attrs = [];
  const tooltip = getItemTooltipText(item).replace(/"/g, "&quot;");
  if (tagName === "button") {
    attrs.push('type="button"');
    attrs.push(`data-item-id="${item?.itemId || ""}"`);
    attrs.push(`aria-label="${item?.name || "Item"}"`);
    attrs.push(`title="${tooltip}"`);
  }
  return `
    <${tagName}
      class="${classes}"
      ${attrs.join(" ")}
      style="--item-accent:${accent}"
    >
      <span class="station-item-icon__tier">${tier}</span>
      ${badge}
      ${equipped}
      <span class="station-item-icon__glyph">${glyph}</span>
      ${label}
    </${tagName}>
  `;
}
function buildItemIconButton(item, opts = {}) {
  return buildItemIconMarkup(item, opts, "button");
}

// client/src/ui/hud/HudEquipmentPanelRenderer.js
function hexToRgb2(hex, fallback = { r: 130, g: 210, b: 255 }) {
  const raw = String(hex || "").replace("#", "").trim();
  if (raw.length !== 6) return fallback;
  const n = Number.parseInt(raw, 16);
  if (!Number.isFinite(n)) return fallback;
  return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 };
}
function firstByCategory(byCategory, categoryId) {
  return (byCategory.get(categoryId) || [])[0] || null;
}
function equippedByCategory(equipment) {
  const byCategory = /* @__PURE__ */ new Map();
  for (const item of equipment?.equippedItems || []) {
    const list = byCategory.get(item.categoryId) || [];
    list.push(item);
    byCategory.set(item.categoryId, list);
  }
  return byCategory;
}
function withCooldown(slot, left = 0, max = 0) {
  const cooldownLeft = Number(left || 0);
  const cooldownMax = Number(max || 0);
  if (cooldownLeft <= 1e-3) return slot;
  return { ...slot, cooldownLeft, cooldownMax: Math.max(cooldownMax, cooldownLeft, 1e-3) };
}
function activeEquipmentTags(equipment) {
  const tags = (equipment?.tags || []).filter((t) => t?.active).map((t) => ({ ...t, kind: "tag", id: `tag_${t.tagId}` }));
  const superTags = (equipment?.superTags || []).filter((t) => t?.active).map((t) => ({ ...t, kind: "superTag", id: `super_${t.superTagId}` }));
  return [...tags, ...superTags].slice(0, 8);
}
function tagEffectLines(entry) {
  if (!entry) return [];
  const stage = Math.max(0, entry.stage | 0);
  const rank = Math.max(0, entry.rank | 0);
  if (entry.kind === "superTag") {
    switch (entry.superTagId) {
      case "overdrive":
        return [`Rang ${rank}`, rank >= 2 ? "+8% critique" : "+5% critique"];
      case "juggernaut":
        return [`Rang ${rank}`, rank >= 2 ? "+12% coque, +8% d\xE9g\xE2ts" : "+8% coque, +5% d\xE9g\xE2ts"];
      case "ghostwire":
        return [`Rang ${rank}`, rank >= 2 ? "Sous 35% coque : +18% vitesse, -8% cooldown, +16% r\xE9g\xE9n. \xE9nergie" : "Sous 35% coque : +10% vitesse, -5% cooldown, +10% r\xE9g\xE9n. \xE9nergie"];
      case "napalm":
        return [`Rang ${rank}`, rank >= 2 ? "Br\xFBlure auto : 4s, 9 DPS" : "Br\xFBlure auto : 3s, 6 DPS"];
      case "bloodwall":
        return [`Rang ${rank}`, rank >= 2 ? "Soin exc\xE9dentaire \u2192 bouclier \xE0 100%" : "Soin exc\xE9dentaire \u2192 bouclier \xE0 70%"];
      default:
        return [`Rang ${rank}`];
    }
  }
  switch (entry.tagId) {
    case "reaver":
      return [
        `Palier ${stage} \u2014 ${entry.points | 0} pts`,
        stage >= 2 ? "+16% d\xE9g\xE2ts, +10% cadence" : "+8% d\xE9g\xE2ts",
        ...stage >= 3 ? ["Br\xFBlure auto : 3s, 6 DPS"] : []
      ];
    case "warden":
      return [`Palier ${stage} \u2014 ${entry.points | 0} pts`, stage >= 2 ? "+20% coque max" : "+10% coque max"];
    case "surge":
      return [`Palier ${stage} \u2014 ${entry.points | 0} pts`, stage >= 2 ? "+20% r\xE9g\xE9n. \xE9nergie, -10% cooldown" : "+20% r\xE9g\xE9n. \xE9nergie"];
    case "verge":
      return [
        `Palier ${stage} \u2014 ${entry.points | 0} pts`,
        stage >= 2 ? "+20% vitesse, +12% port\xE9e auto" : "+10% vitesse",
        ...stage >= 3 ? ["Sous 35% coque : +18% vitesse"] : []
      ];
    case "siege":
      return [`Palier ${stage} \u2014 ${entry.points | 0} pts`, stage >= 2 ? "+20% d\xE9g\xE2ts roquette, +12% port\xE9e auto" : "+20% d\xE9g\xE2ts roquette"];
    case "siphon":
      return [
        `Palier ${stage} \u2014 ${entry.points | 0} pts`,
        stage >= 2 ? "+12% vol de vie, +15% puissance soin" : "+6% vol de vie",
        ...stage >= 3 ? ["Sous 35% coque : +8% d\xE9g\xE2ts, +10% puissance soin"] : []
      ];
    default:
      return [`Palier ${stage} \u2014 ${entry.points | 0} pts`];
  }
}
function drawEquipmentTagGlyph(ctx, dpr, entry, x, y, size, scale) {
  const p = hexToRgb2(entry.colorHex, { r: 160, g: 210, b: 255 });
  const border = `rgba(${p.r},${p.g},${p.b},0.78)`;
  const bg = `rgba(${p.r},${p.g},${p.b},0.15)`;
  fillRoundedRect(ctx, dpr, x, y, size, size, 6, "rgba(6,9,14,0.94)", border, 1);
  fillRoundedRect(ctx, dpr, x + 2 * scale, y + 2 * scale, size - 4 * scale, size - 4 * scale, 4, bg, "rgba(255,255,255,0.03)");
  ctx.save();
  ctx.translate((x + size * 0.5) * dpr, (y + size * 0.5) * dpr);
  ctx.strokeStyle = `rgba(${p.r},${p.g},${p.b},0.88)`;
  ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},0.16)`;
  ctx.lineWidth = Math.max(1.1, 1.45 * dpr);
  if (entry.kind === "superTag") {
    ctx.rotate(Math.PI * 0.25);
    ctx.strokeRect(-size * 0.25 * dpr, -size * 0.25 * dpr, size * 0.5 * dpr, size * 0.5 * dpr);
    ctx.rotate(-Math.PI * 0.25);
  } else {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      const px = Math.cos(a) * size * 0.31 * dpr;
      const py = Math.sin(a) * size * 0.31 * dpr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(246,250,255,0.98)";
  ctx.font = `900 ${7 * scale * dpr}px Segoe UI`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(entry.short || "?", 0, 0);
  ctx.restore();
  const count = entry.kind === "superTag" ? entry.rank | 0 : entry.points | 0;
  if (count > 0) {
    ctx.fillStyle = "rgba(8,10,14,0.94)";
    ctx.beginPath();
    ctx.arc((x + size - 5 * scale) * dpr, (y + 5 * scale) * dpr, 5 * scale * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,248,210,0.98)";
    ctx.font = `900 ${7 * scale * dpr}px Segoe UI`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`${count}`, (x + size - 5 * scale) * dpr, (y + 7.7 * scale) * dpr);
  }
}
function getEquippedHudTagHit(layout, mx, my, myState) {
  const r = layout?.equipmentRect;
  if (!r) return null;
  const scale = layout.scale ?? 1;
  const entries = activeEquipmentTags(myState?.equipment);
  if (!entries.length) return null;
  const size = 24 * scale;
  const gap = 5 * scale;
  const startX = r.x + 10 * scale;
  const y = r.y + 25 * scale;
  for (let i = 0; i < entries.length; i += 1) {
    const x = startX + i * (size + gap);
    if (mx >= x && mx <= x + size && my >= y && my <= y + size) return { entry: entries[i], rect: { x, y, w: size, h: size } };
  }
  return null;
}
function buildEquipmentTagTooltip(hit) {
  const entry = hit?.entry;
  if (!entry) return null;
  const a = hexToRgb2(entry.colorHex, { r: 160, g: 210, b: 255 });
  const title = entry.kind === "superTag" ? `${entry.name || "Super-tag"} \u2014 super-tag` : `${entry.name || "Tag"} \u2014 tag d\u2019\xE9quipement`;
  const lines = tagEffectLines(entry);
  if (entry.kind === "superTag") {
    lines.push("Actif quand deux familles de tags sont assez pr\xE9sentes.");
  } else {
    lines.push("Actif \xE0 partir de 2 points \xE9quip\xE9s.");
  }
  return { title, accent: a, lines };
}
function buildEquippedHudSlots(myState, me = null) {
  const equipment = myState?.equipment;
  if (!equipment) return [];
  const byCategory = equippedByCategory(equipment);
  const modules = byCategory.get(ITEM_CATEGORY_IDS.MODULE) || [];
  const converters = byCategory.get(ITEM_CATEGORY_IDS.CONVERTER) || [];
  const rocketSlots = equipment.rocketAmmo?.slots || [];
  const slots = [
    { key: "defense", role: "Bouclier", topKey: "", item: firstByCategory(byCategory, ITEM_CATEGORY_IDS.DEFENSE), emptyGlyph: "\u26E8" },
    { key: "engine", role: "Propulseur", topKey: "", item: firstByCategory(byCategory, ITEM_CATEGORY_IDS.ENGINE), emptyGlyph: "\u27A4" },
    { key: "weapon", role: "Arme", topKey: "", item: firstByCategory(byCategory, ITEM_CATEGORY_IDS.WEAPON), emptyGlyph: "\u2736" },
    withCooldown({ key: "launcher", role: "Lance-roquettes", topKey: "", item: firstByCategory(byCategory, ITEM_CATEGORY_IDS.LAUNCHER), emptyGlyph: "\u2604" }, me?.rocketCooldownLeft ?? 0, me?.rocketCooldownMax ?? 8)
  ];
  const moduleCap = Math.max(3, Math.min(6, equipment.slotCaps?.[ITEM_CATEGORY_IDS.MODULE] || Math.max(3, modules.length || 3)));
  for (let i = 0; i < Math.min(3, moduleCap); i += 1) {
    const item = modules[i] || null;
    slots.push(withCooldown({
      key: `module_${i}`,
      role: `Module ${i + 1}`,
      topKey: String(i + 1),
      item,
      emptyGlyph: "\u25C6",
      moduleIndex: i + 1
    }, item?.cooldownLeft ?? item?.activeCooldownLeft ?? 0, item?.cooldownMax ?? item?.activeCooldownMax ?? 0));
  }
  const converterCap = Math.max(1, Math.min(2, equipment.slotCaps?.[ITEM_CATEGORY_IDS.CONVERTER] || Math.max(1, converters.length || 1)));
  for (let i = 0; i < converterCap; i += 1) {
    slots.push(withCooldown({
      key: `converter_${i}`,
      role: `Convertisseur ${i + 1}`,
      topKey: "",
      item: converters[i] || null,
      emptyGlyph: "\u21BB"
    }, converters[i]?.cooldownLeft ?? 0, converters[i]?.cooldownMax ?? 0));
  }
  for (const slot of rocketSlots.slice(0, 2)) {
    const baseItem = slot.item ? { ...slot.item, categoryId: ITEM_CATEGORY_IDS.AMMO, active: slot.active } : null;
    let ammoQuantity = Math.max(0, baseItem?.ammoQuantity | 0);
    if (slot.active && Number.isFinite(myState?.derived?.rocketAmmoQuantity)) ammoQuantity = Math.max(0, myState.derived.rocketAmmoQuantity | 0);
    const item = baseItem ? { ...baseItem, ammoQuantity } : null;
    slots.push({
      key: `ammo_${slot.slot}`,
      role: `Roquette ${(slot.slot | 0) + 1}`,
      topKey: (slot.slot | 0) === 0 ? "X" : "C",
      item,
      emptyGlyph: "\u25C9",
      ammo: true,
      ammoSlotIndex: slot.slot | 0,
      ammoQuantity,
      active: !!slot.active
    });
  }
  while (slots.length < 12) slots.push({ key: `reserved_${slots.length}`, role: "Slot", topKey: "", item: null, emptyGlyph: "\xB7", reserved: true });
  return slots.slice(0, 12);
}
function drawTopBadge(ctx, dpr, r, text, border, scale, tone = "rgba(242,247,255,0.94)") {
  if (!text) return;
  const w = Math.max(17 * scale, String(text).length * 8.5 * scale);
  fillRoundedRect(ctx, dpr, r.x + 4 * scale, r.y + 4 * scale, w, 15 * scale, 4, "rgba(16,20,31,0.94)", border, 1);
  ctx.fillStyle = tone;
  ctx.font = `900 ${9 * scale * dpr}px Segoe UI`;
  ctx.textAlign = "center";
  ctx.fillText(text, (r.x + 4 * scale + w * 0.5) * dpr, (r.y + 15 * scale) * dpr);
}
function drawTierBadge(ctx, dpr, r, item, a, scale) {
  if (!item) return;
  const text = `T${Math.max(1, item.tier | 0)}`;
  const w = Math.max(20 * scale, text.length * 7.8 * scale);
  fillRoundedRect(ctx, dpr, r.x + r.w - w - 4 * scale, r.y + r.h - 18 * scale, w, 14 * scale, 4, "rgba(10,13,20,0.90)", `rgba(${a.r},${a.g},${a.b},0.46)`, 0.9);
  ctx.fillStyle = `rgba(${a.r},${a.g},${a.b},0.94)`;
  ctx.font = `900 ${8 * scale * dpr}px Segoe UI`;
  ctx.textAlign = "center";
  ctx.fillText(text, (r.x + r.w - w * 0.5 - 4 * scale) * dpr, (r.y + r.h - 7.4 * scale) * dpr);
}
function drawAmmoQuantity(ctx, dpr, r, slot, a, scale) {
  if (!slot.ammo || !slot.item) return;
  const qty = Math.max(0, slot.ammoQuantity | 0);
  const text = String(qty);
  const w = Math.max(23 * scale, text.length * 8.8 * scale + 10 * scale);
  const h = 16 * scale;
  const x = r.x + r.w - w - 4 * scale;
  const y = r.y + 4 * scale;
  fillRoundedRect(ctx, dpr, x, y, w, h, 5, "rgba(5,8,14,0.97)", `rgba(${a.r},${a.g},${a.b},0.72)`, 1.15);
  ctx.fillStyle = qty > 0 ? "rgba(244,248,255,0.99)" : "rgba(255,120,120,0.96)";
  ctx.font = `900 ${10.2 * scale * dpr}px Segoe UI`;
  ctx.textAlign = "center";
  ctx.fillText(text, (x + w * 0.5) * dpr, (y + 11.6 * scale) * dpr);
}
function drawCooldown(ctx, dpr, r, left, max, scale) {
  const cooldownLeft = Number(left || 0);
  if (cooldownLeft <= 1e-3) return;
  const ratio = Math.min(1, Math.max(0, cooldownLeft / Math.max(max || 0, cooldownLeft, 1e-3)));
  fillRoundedRect(ctx, dpr, r.x, r.y, r.w, r.h * ratio, 9, "rgba(0,0,0,0.62)");
  ctx.fillStyle = "rgba(255,238,205,0.98)";
  ctx.font = `900 ${13 * scale * dpr}px Segoe UI`;
  ctx.textAlign = "center";
  ctx.fillText(cooldownLeft.toFixed(cooldownLeft >= 10 ? 0 : 1), (r.x + r.w * 0.5) * dpr, (r.y + r.h * 0.56) * dpr);
}
function drawReadyDot(ctx, dpr, r, item, scale) {
  if (!item) return;
  fillRoundedRect(ctx, dpr, r.x + r.w - 10 * scale, r.y + r.h - 10 * scale, 6 * scale, 6 * scale, 3, "rgba(103,244,176,0.92)");
}
function drawItemSlot(ctx, dpr, r, slot, scale, hovered = false) {
  if (!r) return;
  const item = slot.item;
  const accentHex = item ? getItemAccentColor(item) : "#526176";
  const a = hexToRgb2(accentHex);
  const empty = !item;
  const border = empty ? "rgba(90,116,150,0.38)" : `rgba(${a.r},${a.g},${a.b},${hovered ? 0.95 : 0.58})`;
  const bg = empty ? "rgba(8,11,18,0.88)" : `rgba(${a.r},${a.g},${a.b},0.13)`;
  fillRoundedRect(ctx, dpr, r.x, r.y, r.w, r.h, 9, "rgba(6,8,13,0.94)", border, hovered ? 1.9 : 1.15);
  fillRoundedRect(ctx, dpr, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 7, bg, "rgba(255,255,255,0.025)");
  const glyph = item ? getItemGlyph(item) : slot.emptyGlyph;
  ctx.textAlign = "center";
  ctx.fillStyle = item ? `rgba(${a.r},${a.g},${a.b},0.96)` : "rgba(112,128,152,0.64)";
  ctx.font = `900 ${22 * scale * dpr}px Segoe UI Symbol, Segoe UI`;
  ctx.fillText(glyph, (r.x + r.w * 0.5) * dpr, (r.y + r.h * 0.61) * dpr);
  const topText = slot.moduleIndex ? String(slot.moduleIndex) : slot.topKey;
  drawTopBadge(ctx, dpr, r, topText, `rgba(${a.r},${a.g},${a.b},0.58)`, scale, slot.ammo ? "rgba(255,224,128,0.96)" : "rgba(242,247,255,0.94)");
  if (item && !slot.moduleIndex && !slot.ammo) drawTierBadge(ctx, dpr, r, item, a, scale);
  if (item) {
    if (!slot.ammo) {
      const tag = getItemShortTag(item);
      if (tag) {
        const badgeW = Math.max(18 * scale, Math.min(r.w - 8 * scale, (tag.length * 6 + 10) * scale));
        fillRoundedRect(ctx, dpr, r.x + r.w - badgeW - 4 * scale, r.y + r.h - 17 * scale, badgeW, 13 * scale, 4, "rgba(10,13,20,0.92)", `rgba(${a.r},${a.g},${a.b},0.58)`, 1);
        ctx.fillStyle = `rgba(${a.r},${a.g},${a.b},0.96)`;
        ctx.font = `900 ${7.5 * scale * dpr}px Segoe UI`;
        ctx.textAlign = "center";
        ctx.fillText(tag, (r.x + r.w - badgeW * 0.5 - 4 * scale) * dpr, (r.y + r.h - 7.5 * scale) * dpr);
      }
    }
    drawAmmoQuantity(ctx, dpr, r, slot, a, scale);
    if (!slot.ammo) drawReadyDot(ctx, dpr, r, item, scale);
  }
  if (slot.active) {
    fillRoundedRect(ctx, dpr, r.x + 4 * scale, r.y + r.h - 6 * scale, r.w - 8 * scale, 3 * scale, 2, "rgba(255,212,94,0.95)");
    fillRoundedRect(ctx, dpr, r.x + 2 * scale, r.y + 2 * scale, r.w - 4 * scale, 3 * scale, 2, "rgba(255,212,94,0.65)");
  }
  drawCooldown(ctx, dpr, r, slot.cooldownLeft, slot.cooldownMax, scale);
}
function getEquippedHudHit(layout, mx, my, myState) {
  const slots = buildEquippedHudSlots(myState);
  const rects = layout?.equipmentSlotRects || [];
  for (let i = 0; i < slots.length; i += 1) {
    const r = rects[i];
    if (r && mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return { slot: slots[i], rect: r };
  }
  return null;
}
function buildEquipmentTooltip(hit) {
  if (hit?.entry) return buildEquipmentTagTooltip(hit);
  const slot = hit?.slot;
  if (!slot) return null;
  const item = slot.item;
  if (!item) {
    return {
      title: `${slot.role || "Slot"} \u2014 vide`,
      accent: { r: 128, g: 150, b: 180 },
      lines: ["Aucun item \xE9quip\xE9."]
    };
  }
  const a = hexToRgb2(getItemAccentColor(item));
  const lines = [
    `${getItemCategoryName(item.categoryId)} \u2014 T${Math.max(1, item.tier | 0)}`,
    getItemTagText(item) ? `Tags : ${getItemTagText(item)}` : "Tags : aucun"
  ];
  const stats = getItemStatLines(item);
  if (stats.length) lines.push(`Stats : ${stats.join(" \u2022 ")}`);
  const passive = getItemPassiveLines(item);
  lines.push(`Passif : ${passive.length ? passive.join(" \u2022 ") : "aucun"}`);
  const active = getItemActiveLines(item);
  lines.push(`Actif : ${active.length ? active.join(" \u2022 ") : "aucun"}`);
  if (slot.ammo) {
    lines.push(`Restantes : ${Math.max(0, slot.ammoQuantity | 0)}`);
    lines.push(`Type ${(slot.ammoSlotIndex | 0) + 1} : touche ${slot.topKey || "?"} ou clic sur le slot`);
  }
  if (slot.cooldownLeft > 1e-3) lines.push(`Recharge : ${slot.cooldownLeft.toFixed(1)}s`);
  return { title: item.name || slot.role || "Item \xE9quip\xE9", accent: a, lines };
}
function drawHudEquipmentPanel(ctx, view, myState, input, layout, me = null) {
  const r = layout?.equipmentRect;
  if (!r) return;
  const dpr = view.dpr;
  const scale = layout.scale ?? 1;
  const slots = buildEquippedHudSlots(myState, me);
  if (!slots.length) return;
  fillRoundedRect(ctx, dpr, r.x, r.y, r.w, r.h, 12, "rgba(7,10,16,0.88)", "rgba(90,116,150,0.36)", 1);
  fillRoundedRect(ctx, dpr, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 10, "rgba(12,16,26,0.76)", "rgba(255,255,255,0.025)");
  ctx.fillStyle = "rgba(151,226,255,0.90)";
  ctx.font = `900 ${9.2 * scale * dpr}px Segoe UI`;
  ctx.textAlign = "left";
  ctx.fillText("\xC9QUIPEMENT", (r.x + 10 * scale) * dpr, (r.y + 15 * scale) * dpr);
  const tagEntries = activeEquipmentTags(myState?.equipment);
  const tagSize = 24 * scale;
  const tagGap = 5 * scale;
  const tagY = r.y + 25 * scale;
  if (tagEntries.length) {
    for (let i = 0; i < tagEntries.length; i += 1) {
      drawEquipmentTagGlyph(ctx, dpr, tagEntries[i], r.x + 10 * scale + i * (tagSize + tagGap), tagY, tagSize, scale);
    }
  } else {
    ctx.fillStyle = "rgba(135,151,176,0.72)";
    ctx.font = `800 ${8.5 * scale * dpr}px Segoe UI`;
    ctx.textAlign = "left";
    ctx.fillText("Aucun tag actif", (r.x + 10 * scale) * dpr, (r.y + 40 * scale) * dpr);
  }
  const hit = getEquippedHudHit(layout, input?.msx ?? -1, input?.msy ?? -1, myState);
  for (let i = 0; i < slots.length; i += 1) {
    const rect = layout.equipmentSlotRects[i];
    const hovered = hit?.slot?.key === slots[i].key;
    drawItemSlot(ctx, dpr, rect, slots[i], scale, hovered);
  }
}

// client/src/ui/HudTooltipRenderer.js
function inside(r, x, y) {
  return r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
function fmt(v, digits = 1) {
  if (!Number.isFinite(v)) return "0";
  return v >= 10 ? v.toFixed(0) : v.toFixed(digits);
}
function pct(v, digits = 0) {
  return `${((v ?? 0) * 100).toFixed(digits)}%`;
}
function buildPassiveTooltip(myState, me) {
  const fs = myState?.frameState ?? {};
  const frameId = me?.frameId || myState?.frameId || "vanguard";
  if (frameId === "vanguard") {
    return {
      title: "Passif \u2014 Surchauffe",
      accent: { r: 223, g: 179, b: 94 },
      lines: [
        "Les attaques et comp\xE9tences qui touchent donnent 1 charge pendant 5 s.",
        `Charges : ${fs.passiveStacks ?? 0}/${fs.passiveMaxStacks ?? 10}.`,
        "Par charge : cadence, vitesse moteur et r\xE9sistance aux ralentissements.",
        "\xC0 6 charges : t\xE9nacit\xE9. \xC0 10 charges : Z/E d\xE9clenche la t\xE9nacit\xE9 de surchauffe.",
        fs.passiveDecaying ? "D\xE9croissance active : perte rapide de charges." : `D\xE9croissance dans ${fmt(fs.passiveDecayLeft ?? 0)} s.`
      ]
    };
  }
  if (frameId === "sigil") {
    return {
      title: "Passif \u2014 Runes",
      accent: { r: 198, g: 128, b: 255 },
      lines: [
        "Les tirs et sorts posent des runes sur les cibles.",
        "3 runes : ralentissement. 5 runes : d\xE9tonation automatique.",
        `D\xE9lai de d\xE9tonation : ${fmt(fs.detonationCooldownLeft ?? 0)} s.`
      ]
    };
  }
  return {
    title: "Passif \u2014 Plaques r\xE9actives",
    accent: { r: 236, g: 196, b: 96 },
    lines: [
      "Les gros d\xE9g\xE2ts re\xE7us g\xE9n\xE8rent des plaques temporaires.",
      `Plaques : ${fs.passiveStacks ?? 0}/${fs.passiveMaxStacks ?? 5}.`,
      "Chaque plaque donne armure, r\xE9duction de d\xE9g\xE2ts et t\xE9nacit\xE9.",
      "\xC0 pleine charge : bouclier et attaques renforc\xE9es par l\u2019armure."
    ]
  };
}
function vanguardAbility(slot, s) {
  const t = s.tuning ?? {};
  if (slot === "A") return [
    `Tir lin\xE9aire : ${fmt(t.damageFlat)} + ${pct(t.damagePct, 0)} des d\xE9g\xE2ts d\u2019arme.`,
    `Port\xE9e ${fmt(t.projectileRange, 0)}, largeur ${fmt(t.projectileWidth, 0)}.`,
    `Charge ${t.empowerCharges ?? 0} auto renforc\xE9e(s), cap selon phase.`,
    t.pierceCount > 0 ? "Traverse une cible suppl\xE9mentaire." : "",
    t.damageAmpPct > 0 ? `Applique Vuln\xE9rabilit\xE9 ${pct(t.damageAmpPct)} pendant ${fmt(t.damageAmpDuration)} s.` : "",
    t.disarmDuration > 0 ? `Sur cible d\xE9j\xE0 vuln\xE9rable : D\xE9sarmement ${fmt(t.disarmDuration)} s.` : ""
  ];
  if (slot === "Z") return [
    `Ru\xE9e de ${fmt(t.dashDistance, 0)} puis +${pct(t.moveBoostPct)} vitesse pendant ${fmt(t.moveBoostDuration)} s.`,
    t.trailSlowPct > 0 ? `Tra\xEEn\xE9e : Ralentissement ${pct(t.trailSlowPct)} pendant ${fmt(t.trailSlowDuration)} s.` : "",
    t.comboWindowDuration > 0 ? `Fen\xEAtre combo : prochain A +${pct(t.comboProjectileSpeedPct)} vitesse projectile et +${pct(t.comboDamagePct)} d\xE9g\xE2ts.` : "",
    t.cleanseSlowAndRoot ? "Purge ralentissement et root \xE0 l\u2019activation." : ""
  ];
  if (slot === "E") return [
    `Phase : ${pct(t.damageReductionPct)} r\xE9duction de d\xE9g\xE2ts pendant ${fmt(t.phaseDuration)} s.`,
    t.spellShieldDuration > 0 ? `\xC0 la sortie : bouclier anti-sort ${fmt(t.spellShieldDuration)} s.` : "",
    t.exitRadius > 0 ? `Onde de sortie : Grounded ${fmt(t.groundedDuration)} s dans ${fmt(t.exitRadius, 0)}.` : "",
    t.exitShieldPctMaxShield > 0 ? `Rend ${pct(t.exitShieldPctMaxShield)} du bouclier max.` : "",
    t.restoreAChargeOnMaxHeat ? "Si lanc\xE9 \xE0 10 Surchauffe : rend 1 charge de A \xE0 la fin." : ""
  ];
  return [
    `Fr\xE9n\xE9sie ${fmt(t.ultDuration)} s : +${pct(t.ultAttackSpeedPct)} cadence, +${pct(t.ultMoveSpeedPct)} vitesse.`,
    `Autos : +${pct(t.ultEmpowerPct)} d\xE9g\xE2ts pendant R.`,
    t.ultBurnDuration > 0 ? `Auto sur cible marqu\xE9e par A : Br\xFBlure ${fmt(t.ultBurnDuration)} s.` : "",
    t.unstoppableDuration > 0 ? `Z pendant R : Inarr\xEAtable ${fmt(t.unstoppableDuration)} s.` : "",
    t.ultCloseAStunDuration > 0 ? `A proche pendant R : \xC9tourdissement ${fmt(t.ultCloseAStunDuration)} s.` : ""
  ];
}
function sigilAbility(slot, s) {
  const t = s.tuning ?? {};
  if (slot === "A") return [
    `Projectile runique : ${fmt(t.aImpactDamageFlat)} + ${pct(t.aImpactDamagePct)} d\xE9g\xE2ts d\u2019arme.`,
    "Pose 1 rune. Les runes amplifient les prochaines touches.",
    t.aPierceCount > 0 ? "Phase 2 : traverse largement les cibles." : "",
    t.aRevealThreshold > 0 ? `\xC0 ${t.aRevealThreshold} runes : r\xE9v\xE8le la cible.` : "",
    t.aHealCutThreshold > 0 ? `\xC0 ${t.aHealCutThreshold} runes : anti-soin ${pct(t.aHealCutPct)}.` : "",
    t.aDetonationStasisDuration > 0 ? "D\xE9tonation maximale : stase courte." : ""
  ];
  if (slot === "Z") return [
    `Zone ${fmt(t.zZoneRadius, 0)} pendant ${fmt(t.zZoneDuration)} s.`,
    `D\xE9g\xE2ts/s : ${fmt(t.zZoneDamageFlatPerSecond)} + ${pct(t.zZoneDamageWeaponPctPerSecond)} arme.`,
    `Ralentit de ${pct(t.zZoneSlowPct)}.`,
    t.zRunePulseStacks > 0 ? "Pulse : ajoute des runes aux ennemis dans la zone." : "",
    t.zCanRecastClose ? "R\xE9activation : ferme la zone et contr\xF4le les cibles run\xE9es." : ""
  ];
  if (slot === "E") return [
    `Dash de ${fmt(t.eDashDistance, 0)} et camouflage ${fmt(t.eCamouflageDuration)} s.`,
    t.eTrailSlowPct > 0 ? `Tra\xEEn\xE9e : slow ${pct(t.eTrailSlowPct)} pendant ${fmt(t.eTrailSlowDuration)} s.` : "",
    t.aEmpowerFromVeilDamagePct > 0 ? `A lanc\xE9 depuis le voile : +${pct(t.aEmpowerFromVeilDamagePct)} d\xE9g\xE2ts.` : "",
    t.eSpellShieldOnEndDuration > 0 ? `Fin du voile : bouclier anti-sort ${fmt(t.eSpellShieldOnEndDuration)} s.` : ""
  ];
  return [
    `Convergence ${fmt(t.ultDuration)} s.`,
    `Runes durent +${pct(t.ultRuneDurationBonusPct)}.`,
    `Cooldown de A multipli\xE9 par x${fmt(t.ultACooldownMultiplier, 2)}.`,
    `Vol de vie : ${pct(t.ultLifestealPct, 1)}.`,
    t.ultDetonationStunDuration > 0 ? `D\xE9tonation max : stun ${fmt(t.ultDetonationStunDuration)} s.` : ""
  ];
}
function bulwarkAbility(slot, s) {
  const t = s.tuning ?? {};
  if (slot === "A") return [
    `Ancrage ${fmt(t.anchorDuration)} s : armure +${fmt(t.anchorArmorFlat)}.`,
    `R\xE9duction ${pct(t.anchorDamageReductionPct)} et reflet ${pct(t.anchorReflectPct)}.`,
    t.anchorPulseRadius > 0 ? `Pulse slow ${pct(t.anchorPulseSlowPct)} dans ${fmt(t.anchorPulseRadius, 0)}.` : "",
    t.anchorTauntedBonusFlat > 0 ? "Bonus de d\xE9g\xE2ts contre les cibles provoqu\xE9es." : "",
    t.anchorSingleHitCapPctMaxHp > 0 ? `Cap de gros hit : ${pct(t.anchorSingleHitCapPctMaxHp)} PV max.` : ""
  ];
  if (slot === "Z") return [
    `Harpon ${fmt(t.harpoonRange, 0)} : ${fmt(t.harpoonDamageFlat)} + ${pct(t.harpoonDamageWeaponPct)} arme + armure.`,
    `Provoque ${fmt(t.harpoonTauntDuration)} s.`,
    t.harpoonArmorShredPct > 0 ? `Shred armure ${pct(t.harpoonArmorShredPct)} pendant ${fmt(t.harpoonArmorShredDuration)} s.` : "",
    t.harpoonGroundedDuration > 0 ? `Grounded ${fmt(t.harpoonGroundedDuration)} s.` : "",
    t.harpoonDashDistance > 0 ? "Dash vers la cible touch\xE9e." : "",
    t.harpoonPullStrength > 0 ? "Tire la cible vers toi." : ""
  ];
  if (slot === "E") return [
    `M\xE9ditation ${fmt(t.meditationDuration)} s : r\xE9duction ${pct(t.meditationDamageReductionPct)}.`,
    `Soigne les PV manquants et donne un bouclier \xE0 la fin.`,
    t.meditationCastUnstoppableDuration > 0 ? `D\xE9but : Inarr\xEAtable ${fmt(t.meditationCastUnstoppableDuration)} s.` : "",
    t.meditationPulseRadius > 0 ? `Fin : slow dans ${fmt(t.meditationPulseRadius, 0)}.` : "",
    t.meditationCleanseSilenceDisarmRoot ? "Purge silence, d\xE9sarmement et root." : "",
    t.meditationFinalGroundedDuration > 0 ? `Fin : Grounded ${fmt(t.meditationFinalGroundedDuration)} s.` : ""
  ];
  return [
    `Temp\xEAte ${fmt(t.stormDuration)} s, rayon ${fmt(t.stormRadius, 0)}.`,
    `D\xE9g\xE2ts/s : ${fmt(t.stormBaseDpsFlat)} + ${pct(t.stormBaseDpsPct)} arme.`,
    `Ralentit de ${pct(t.stormSlowPct)}.`,
    t.stormTauntedDamageAmpPct > 0 ? `Cibles provoqu\xE9es : +${pct(t.stormTauntedDamageAmpPct)} d\xE9g\xE2ts subis.` : "",
    t.stormExposureStunThreshold > 0 ? `Exposition prolong\xE9e : stun ${fmt(t.stormExposureStunDuration)} s.` : "",
    t.stormPullStrength > 0 ? "La temp\xEAte attire p\xE9riodiquement les ennemis." : ""
  ];
}
function buildAbilityTooltip(myState, me, slot) {
  const s = myState?.abilityHud?.[slot];
  if (!s) return null;
  const frameId = me?.frameId || myState?.frameId || s.frameId || "vanguard";
  const def = getShipFrameDef(frameId);
  const builders = { vanguard: vanguardAbility, sigil: sigilAbility, bulwark: bulwarkAbility };
  const lines = (builders[frameId]?.(slot, s) ?? []).filter(Boolean);
  lines.push(`Niveau ${s.investedLevel ?? 0}/${slot === "R" ? 5 : 15} \u2014 phase ${s.phase ?? 0}.`);
  if (s.energyCost != null) lines.push(`Co\xFBt ${fmt(s.energyCost, 0)} \xE9nergie \u2014 Recast ${fmt(s.cooldownMax ?? 0)} s.`);
  if (!s.unlocked) lines.push(s.canUpgrade ? "Clique ou Ctrl+" + slot + " pour d\xE9bloquer." : `Verrouill\xE9 : ${s.upgradeReason || "point requis"}.`);
  return {
    title: `${slot} \u2014 ${def.abilities?.[slot]?.label ?? s.label}`,
    accent: slot === "A" ? { r: 116, g: 226, b: 255 } : slot === "Z" ? { r: 118, g: 244, b: 196 } : slot === "E" ? { r: 124, g: 154, b: 255 } : { r: 243, g: 196, b: 104 },
    lines
  };
}
var STATUS_DESC = {
  root: "Immobilise le d\xE9placement. Les attaques restent possibles.",
  stun: "Bloque mouvement, attaques, roquettes et comp\xE9tences.",
  silence: "Emp\xEAche de lancer les comp\xE9tences.",
  disarm: "Emp\xEAche les attaques principales.",
  grounded: "Emp\xEAche dash, d\xE9placement forc\xE9 et mobilit\xE9.",
  suppress: "Contr\xF4le total : mouvement, attaques et sorts bloqu\xE9s.",
  sleep: "Endormi jusqu\u2019\xE0 expiration ou d\xE9g\xE2ts.",
  fear: "Force \xE0 fuir la source et bloque les actions.",
  charm: "Force \xE0 avancer vers la source et bloque les actions.",
  taunt: "Force l\u2019auto-attaque vers la source.",
  blind: "R\xE9duit la vision et interdit de viser hors du c\xF4ne visible.",
  burn: "D\xE9g\xE2ts p\xE9riodiques.",
  poison: "D\xE9g\xE2ts p\xE9riodiques directs sur la coque.",
  bleed: "Saignement et r\xE9duction des soins re\xE7us.",
  damage_amp: "Augmente les d\xE9g\xE2ts subis.",
  armor_shred: "R\xE9duit l\u2019armure effective.",
  heal_cut: "R\xE9duit les soins re\xE7us.",
  anti_shield: "R\xE9duit ou perturbe les boucliers.",
  spell_shield: "Bloque le prochain contr\xF4le ou sort hostile.",
  unstoppable: "Ignore les contr\xF4les de d\xE9placement et d\u2019action.",
  haste: "Augmente la vitesse.",
  tenacity: "R\xE9duit la dur\xE9e des contr\xF4les.",
  slow_resist: "R\xE9duit l\u2019efficacit\xE9 des ralentissements.",
  invulnerable: "Ignore les d\xE9g\xE2ts.",
  untargetable: "Ne peut pas \xEAtre cibl\xE9.",
  camouflage: "Masque partiellement le vaisseau.",
  true_sight: "R\xE9v\xE8le les cibles furtives."
};
function colorFromHex(hex, fallback = { r: 220, g: 220, b: 220 }) {
  const raw = String(hex || "").replace("#", "").trim();
  if (raw.length !== 6) return fallback;
  const n = Number.parseInt(raw, 16);
  if (!Number.isFinite(n)) return fallback;
  return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 };
}
function buildCombatStatTooltip(myState, me, layout, mx, my) {
  const hit = hitTestCombatStat(layout, mx, my);
  if (!hit) return null;
  const entry = buildCombatStatEntries(me, myState).find((s) => s.id === hit.id);
  if (!entry) return null;
  return {
    title: `${entry.label} \u2014 ${entry.value}`,
    accent: entry.accent,
    lines: [entry.desc]
  };
}
function buildStatusTooltip(status2) {
  if (!status2) return null;
  const p = status2.primaryColor ?? colorFromHex(status2.colorHex);
  const name = status2.name || status2.label || status2.id;
  let lines;
  if (status2.kind === "tagBuff") {
    lines = [`Tag d\u2019\xE9quipement actif : ${status2.points | 0} points.`, `Palier : ${status2.stage | 0}.`, "Bonus appliqu\xE9 tant que les objets \xE9quip\xE9s gardent ce tag."];
  } else if (status2.kind === "superTagBuff") {
    lines = [`Super-tag actif : rang ${status2.rank | 0}.`, status2.empowered ? "Version renforc\xE9e active." : "Version de base active.", "N\xE9 de la combinaison de deux tags \xE9quip\xE9s."];
  } else if (status2.permanent) {
    lines = [status2.summary || "Bonus permanent de bastion.", `Source : ${status2.sourceLabel || status2.name || "Bastion"}`];
  } else {
    lines = [STATUS_DESC[status2.id] || "Effet actif.", `Dur\xE9e restante : ${fmt(status2.durationLeft ?? 0)} s.`];
  }
  if ((status2.stacks ?? 1) > 1) lines.push(`Stacks : ${status2.stacks}.`);
  if (status2.value) lines.push(`Valeur : ${pct(status2.value, 1)}.`);
  return { title: name, accent: p, lines };
}
function drawBox(ctx, view, tip, mx, my) {
  const dpr = view.dpr;
  const pad = 11;
  const lineH = 15;
  const titleH = 20;
  ctx.save();
  ctx.font = `12px Segoe UI`;
  const lines = tip.lines.filter(Boolean).slice(0, 8);
  const textW = Math.max(ctx.measureText(tip.title).width, ...lines.map((l) => ctx.measureText(l).width));
  const w = Math.min(430, Math.max(250, textW + pad * 2));
  const h = pad * 2 + titleH + lines.length * lineH + 4;
  let x = mx + 18;
  let y = my - h - 14;
  if (x + w > view.cssW - 8) x = view.cssW - w - 8;
  if (y < 8) y = my + 18;
  const a = tip.accent ?? { r: 160, g: 210, b: 255 };
  fillRoundedRect(ctx, dpr, x, y, w, h, 10, "rgba(7,10,16,0.96)", rgba(a.r, a.g, a.b, 0.6), 1.4);
  fillRoundedRect(ctx, dpr, x + 2, y + 2, w - 4, h - 4, 8, "rgba(13,18,28,0.94)", "rgba(255,255,255,0.03)");
  ctx.fillStyle = rgba(a.r, a.g, a.b, 0.95);
  ctx.font = `800 ${13 * dpr}px Segoe UI`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(tip.title, (x + pad) * dpr, (y + pad + 11) * dpr);
  ctx.fillStyle = "rgba(224,233,249,0.92)";
  ctx.font = `${11.2 * dpr}px Segoe UI`;
  let yy = y + pad + titleH + 5;
  for (const line3 of lines) {
    ctx.fillText(line3, (x + pad) * dpr, yy * dpr);
    yy += lineH;
  }
  ctx.restore();
}
function hitRow(entries, y, layout, x, yMouse) {
  if (!entries?.length) return null;
  const scale = layout?.abilityScale ?? 1;
  const size = 25 * scale;
  const gap = 5 * scale;
  const centerX = layout?.centerX ?? 0;
  const total = entries.length;
  let xx = centerX - (size * total + gap * (total - 1)) * 0.5;
  for (const s of entries) {
    if (x >= xx && x <= xx + size && yMouse >= y && yMouse <= y + size) return s;
    xx += size + gap;
  }
  return null;
}
function statusHit(myState, layout, x, y) {
  const rows = buildHudBuffRows(myState?.statuses ?? [], layout, myState?.bastions ?? [], myState?.equipment ?? null);
  for (const row of rows) {
    const hit = hitRow(row.entries, row.y, layout, x, y);
    if (hit) return hit;
  }
  return null;
}
function drawHudTooltip(ctx, view, me, myState, input, layout = getCombatHudLayout(view)) {
  if (!input) return;
  const mx = input.msx;
  const my = input.msy;
  let tip = null;
  if (inside(layout.passiveRect, mx, my)) tip = buildPassiveTooltip(myState, me);
  for (const slot of ["A", "Z", "E", "R"]) {
    if (!tip && inside(layout.abilityRects?.[slot], mx, my)) tip = buildAbilityTooltip(myState, me, slot);
  }
  if (!tip && inside(layout.utilityRects?.D, mx, my)) tip = { title: "D \u2014 Dock", accent: { r: 142, g: 204, b: 255 }, lines: ["S\u2019arrimer \xE0 la station proche.", "Maintenir ou appuyer selon le contexte."] };
  if (!tip && inside(layout.utilityRects?.F, mx, my)) tip = { title: "F \u2014 Roquette", accent: { r: 255, g: 182, b: 86 }, lines: ["Tire la roquette active.", "La munition active se r\xE8gle dans l\u2019onglet Munitions."] };
  if (!tip) tip = buildEquipmentTooltip(getEquippedHudTagHit(layout, mx, my, myState) || getEquippedHudHit(layout, mx, my, myState));
  if (!tip) tip = buildCombatStatTooltip(myState, me, layout, mx, my);
  if (!tip) tip = buildStatusTooltip(statusHit(myState, layout, mx, my));
  if (tip) drawBox(ctx, view, tip, mx, my);
}

// client/src/ui/HudRenderer.js
function getFrameDef(frameId) {
  return getShipFrameDef(frameId || "vanguard");
}
function drawHud(ctx, view, me, myState, input) {
  if (!me?.vitals) return;
  const frameDef = getFrameDef(me.frameId || myState?.frameId);
  const layout = drawVitalsPanel(ctx, view, me, myState, frameDef);
  drawAbilityStrip(ctx, view, me, myState, input, layout);
  drawHudEquipmentPanel(ctx, view, myState, input, layout, me);
  drawStatusHud(ctx, view, myState?.statuses ?? [], layout, myState?.bastions ?? [], myState?.equipment ?? null);
  if (myState?.hint) {
    ctx.fillStyle = `rgba(${COLORS.warning.r}, ${COLORS.warning.g}, ${COLORS.warning.b}, 0.88)`;
    ctx.font = `${9 * view.dpr}px Segoe UI`;
    ctx.textAlign = "center";
    ctx.fillText(myState.hint, layout.centerX * view.dpr, (layout.y - 6) * view.dpr);
  }
  drawHudTooltip(ctx, view, me, myState, input, layout);
}

// client/src/ui/RadarRenderer.js
var RADAR_SIZE = 168;
var RADAR_MARGIN = 18;
var RADAR_RANGE = 2200;
function getRadarLayout(view) {
  const size = RADAR_SIZE;
  return { size, x: view.cssW - size - RADAR_MARGIN, y: view.cssH - size - RADAR_MARGIN, range: RADAR_RANGE };
}
function hitTestRadarMove(view, me, px, py) {
  if (!view || !me) return null;
  const { x, y, size, range } = getRadarLayout(view);
  if (px < x || py < y || px > x + size || py > y + size) return null;
  const nx = clamp((px - (x + size * 0.5)) / (size * 0.46), -1, 1);
  const ny = clamp((py - (y + size * 0.5)) / (size * 0.46), -1, 1);
  return { x: me.x + nx * range, y: me.y + ny * range };
}
function drawRadar(ctx, view, me, players, mobs, asteroids, stations, myState) {
  const { size, x, y, range } = getRadarLayout(view);
  ctx.fillStyle = rgba(8, 10, 14, 0.84);
  ctx.fillRect(x * view.dpr, y * view.dpr, size * view.dpr, size * view.dpr);
  ctx.strokeStyle = rgba(95, 125, 155, 0.65);
  ctx.lineWidth = view.dpr;
  ctx.strokeRect(x * view.dpr, y * view.dpr, size * view.dpr, size * view.dpr);
  ctx.strokeStyle = rgba(80, 100, 120, 0.35);
  ctx.beginPath();
  ctx.moveTo((x + size * 0.5) * view.dpr, y * view.dpr);
  ctx.lineTo((x + size * 0.5) * view.dpr, (y + size) * view.dpr);
  ctx.moveTo(x * view.dpr, (y + size * 0.5) * view.dpr);
  ctx.lineTo((x + size) * view.dpr, (y + size * 0.5) * view.dpr);
  ctx.stroke();
  function blip(wx, wy, color2, radius = 2) {
    const dx = clamp((wx - me.x) / range, -1, 1);
    const dy = clamp((wy - me.y) / range, -1, 1);
    const sx = x + size * 0.5 + dx * size * 0.46;
    const sy = y + size * 0.5 + dy * size * 0.46;
    ctx.fillStyle = color2;
    ctx.beginPath();
    ctx.arc(sx * view.dpr, sy * view.dpr, radius * view.dpr, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const s of stations.values()) blip(s.x, s.y, rgba(180, 120, 255, 0.9), 3);
  for (const a of asteroids.values()) blip(a.x, a.y, rgba(a.color.r, a.color.g, a.color.b, 0.7), 1.6);
  for (const mob of mobs.values()) blip(mob.x, mob.y, mob.elite ? rgba(255, 232, 160, 0.96) : rgba(mob.color.r, mob.color.g, mob.color.b, 0.9), mob.elite ? 2.8 : 2.1);
  for (const p of players.values()) {
    if (p.id === me.id) continue;
    blip(p.x, p.y, rgba(255, 120, 120, 0.92), 2.2);
  }
  blip(me.x, me.y, rgba(120, 255, 195, 1), 2.8);
  const sectorTxt = `Secteur [${(myState?.sx ?? 0) | 0},${(myState?.sy ?? 0) | 0}]`;
  const biomeName = myState?.sectorBiome?.shortName || myState?.sectorBiome?.name || "Biome inconnu";
  const biomeColor = myState?.sectorBiome?.colorHex || "#d0d7e4";
  ctx.save();
  const headerH = 38;
  ctx.fillStyle = rgba(5, 10, 16, 0.78);
  ctx.fillRect(x * view.dpr, y * view.dpr, size * view.dpr, headerH * view.dpr);
  ctx.strokeStyle = biomeColor;
  ctx.globalAlpha = 0.62;
  ctx.beginPath();
  ctx.moveTo((x + 1) * view.dpr, (y + headerH) * view.dpr);
  ctx.lineTo((x + size - 1) * view.dpr, (y + headerH) * view.dpr);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = rgba(235, 242, 255, 0.92);
  ctx.font = `${11 * view.dpr}px Segoe UI`;
  ctx.textAlign = "left";
  ctx.fillText(sectorTxt, (x + 8) * view.dpr, (y + 14) * view.dpr);
  ctx.fillStyle = biomeColor;
  ctx.font = `700 ${11 * view.dpr}px Segoe UI`;
  ctx.fillText(`Biome : ${biomeName}`, (x + 8) * view.dpr, (y + 30) * view.dpr);
  ctx.restore();
}

// client/src/ui/ContextHintRenderer.js
function drawContextHint(ctx, view, me, stations) {
  if (!me) return;
  let nearest = null;
  let bestD2 = Infinity;
  for (const s of stations.values()) {
    const d2 = distSq(me.x, me.y, s.x, s.y);
    if (d2 < bestD2) {
      bestD2 = d2;
      nearest = s;
    }
  }
  if (nearest && bestD2 <= 90 * 90) {
    ctx.fillStyle = rgba(8, 10, 14, 0.82);
    const boxW = 144;
    const boxH = 24;
    const x = view.cssW * 0.5 - boxW * 0.5;
    const y = view.cssH - 98;
    ctx.fillRect(x * view.dpr, y * view.dpr, boxW * view.dpr, boxH * view.dpr);
    ctx.strokeStyle = rgba(176, 120, 255, 0.65);
    ctx.lineWidth = view.dpr;
    ctx.strokeRect(x * view.dpr, y * view.dpr, boxW * view.dpr, boxH * view.dpr);
    ctx.fillStyle = rgba(235, 242, 255, 0.95);
    ctx.textAlign = "center";
    ctx.font = `${12 * view.dpr}px Segoe UI`;
    ctx.fillText("D \u2022 amarrer", (x + boxW * 0.5) * view.dpr, (y + 16) * view.dpr);
  }
}

// client/src/ui/chrome/DockIconButton.js
function createDockIconButton({ id, title, iconMarkup }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ui-dock-icon";
  button.dataset.iconId = id;
  button.setAttribute("aria-label", title);
  button.title = title;
  const glow = document.createElement("span");
  glow.className = "ui-dock-icon__glow";
  const icon = document.createElement("span");
  icon.className = "ui-dock-icon__art";
  icon.innerHTML = iconMarkup;
  const label = document.createElement("span");
  label.className = "ui-dock-icon__label";
  label.textContent = title;
  const badge = document.createElement("span");
  badge.className = "ui-dock-icon__badge";
  badge.hidden = true;
  button.append(glow, icon, label, badge);
  return { button, badge };
}

// client/src/ui/chrome/TopRightDock.js
var TopRightDock = class {
  constructor(root) {
    this.root = root;
    this.items = /* @__PURE__ */ new Map();
    this.activeId = null;
    this.dockEl = document.createElement("div");
    this.dockEl.className = "ui-dock ui-dock--top-right";
    this.gameDockEl = document.createElement("div");
    this.gameDockEl.className = "ui-dock__group ui-dock__group--game";
    this.utilityDockEl = document.createElement("div");
    this.utilityDockEl.className = "ui-dock__group ui-dock__group--utility";
    this.dockEl.append(this.gameDockEl, this.utilityDockEl);
    this.panelHostEl = document.createElement("div");
    this.panelHostEl.className = "ui-panel-host ui-panel-host--top-right";
    this.root.append(this.dockEl, this.panelHostEl);
  }
  _groupEl(group = "game") {
    return group === "utility" ? this.utilityDockEl : this.gameDockEl;
  }
  registerToggle({ id, title, iconMarkup, onToggle, isActive, group = "game" }) {
    const { button, badge } = createDockIconButton({ id, title, iconMarkup });
    button.addEventListener("click", () => {
      if (button.disabled) return;
      if (typeof onToggle === "function") onToggle();
      this._refresh();
    });
    this._groupEl(group).appendChild(button);
    this.items.set(id, { id, button, badge, type: "toggle", isActiveFn: isActive, group });
    this._refresh();
    return id;
  }
  registerPanel({ id, title, iconMarkup, panelEl, shellClass = "", group = "game" }) {
    const { button, badge } = createDockIconButton({ id, title, iconMarkup });
    button.addEventListener("click", () => {
      if (button.disabled) return;
      this.toggle(id);
    });
    panelEl.classList.add("ui-panel-shell");
    if (shellClass) panelEl.classList.add(shellClass);
    panelEl.hidden = true;
    this._groupEl(group).appendChild(button);
    this.panelHostEl.appendChild(panelEl);
    this.items.set(id, { id, button, badge, panelEl, enabled: true, type: "panel", group });
    this._refresh();
    return id;
  }
  setEnabled(id, enabled) {
    const item = this.items.get(id);
    if (!item) return;
    item.enabled = !!enabled;
    item.button.disabled = !item.enabled;
    item.button.classList.toggle("is-disabled", !item.enabled);
    if (!item.enabled && this.activeId === id) this.activeId = null;
    this._refresh();
  }
  toggle(id) {
    this.activeId = this.activeId === id ? null : id;
    this._refresh();
  }
  setBadge(id, text) {
    const item = this.items.get(id);
    if (!item) return;
    item.badge.textContent = text || "";
    item.badge.hidden = !text;
  }
  _refresh() {
    for (const item of this.items.values()) {
      if (item.type === "toggle") {
        const active2 = typeof item.isActiveFn === "function" ? !!item.isActiveFn() : false;
        item.button.classList.toggle("is-active", active2);
        continue;
      }
      const active = item.id === this.activeId;
      item.button.classList.toggle("is-active", active);
      item.panelEl.hidden = !active;
      item.panelEl.style.display = active ? "" : "none";
    }
  }
};

// client/src/ui/cargo/CargoFormat.js
function formatInt(value) {
  return `${Math.max(0, value | 0)}`;
}
function formatCredits(value) {
  return `${Math.max(0, value | 0)} cr`;
}

// client/src/ui/cargo/CargoPanelView.js
var CargoPanelView = class {
  constructor(sendCmd) {
    this.el = document.createElement("section");
    this.el.className = "cargo-panel";
    this.sendCmd = typeof sendCmd === "function" ? sendCmd : null;
    this.el.innerHTML = `
      <div class="cargo-panel__header">
        <div>
          <div class="cargo-panel__eyebrow">Soute</div>
          <h2 class="cargo-panel__title">Cargo</h2>
          <div class="cargo-panel__credits" data-role="credits">0 cr</div>
        </div>
        <div class="cargo-panel__total-wrap">
          <div class="cargo-panel__eyebrow">Valeur totale</div>
          <div class="cargo-panel__total" data-role="totalValue">0 cr</div>
        </div>
      </div>
      <div class="cargo-panel__meter-block">
        <div class="cargo-panel__meter-topline">
          <span data-role="cargoLabel">0 / 0</span>
          <span data-role="cargoPercent">0%</span>
        </div>
        <div class="cargo-panel__meter-track">
          <div class="cargo-panel__meter-fill" data-role="cargoFill"></div>
        </div>
      </div>
      <div class="cargo-panel__table-head" data-role="head">
        <span>Ressource</span>
        <span>Qt\xE9</span>
        <span>Prix/u</span>
        <span>Total</span>
      </div>
      <div class="cargo-panel__rows" data-role="rows"></div>
    `;
    this.totalValueEl = this.el.querySelector('[data-role="totalValue"]');
    this.creditsEl = this.el.querySelector('[data-role="credits"]');
    this.cargoLabelEl = this.el.querySelector('[data-role="cargoLabel"]');
    this.cargoPercentEl = this.el.querySelector('[data-role="cargoPercent"]');
    this.cargoFillEl = this.el.querySelector('[data-role="cargoFill"]');
    this.rowsEl = this.el.querySelector('[data-role="rows"]');
    this.headEl = this.el.querySelector('[data-role="head"]');
    this.rowsEl.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("button[data-act]");
      if (!btn) return;
      if (!this.sendCmd) return;
      const row = btn.closest("[data-resource]");
      const key = row?.dataset?.resource;
      if (!key) return;
      const act = btn.dataset.act;
      if (act === "jett1") this.sendCmd("jettison", { resourceKey: key, amount: 1 });
      if (act === "jettall") {
        const amt = Number.isFinite(+row?.dataset?.amount) ? Math.floor(+row.dataset.amount) : 0;
        this.sendCmd("jettison", { resourceKey: key, amount: Math.max(0, amt) });
      }
    });
  }
  update(inv, ctx) {
    const safeInv = inv || {
      credits: 0,
      cargoUsed: 0,
      cargoMax: 0,
      cargoFill01: 0,
      totalSellValue: 0,
      resources: []
    };
    const isDocked = !!ctx?.isDocked;
    const cargoFull = (safeInv.cargoMax || 0) > 0 && (safeInv.cargoUsed || 0) >= (safeInv.cargoMax || 0);
    const canJettison = !isDocked && cargoFull;
    this.el.classList.toggle("cargo-panel--jettison", canJettison);
    this.totalValueEl.textContent = formatCredits(safeInv.totalSellValue || 0);
    this.creditsEl.textContent = formatCredits(safeInv.credits || 0);
    this.cargoLabelEl.textContent = `${formatInt(safeInv.cargoUsed || 0)} / ${formatInt(safeInv.cargoMax || 0)}`;
    this.cargoPercentEl.textContent = `${Math.round((safeInv.cargoFill01 || 0) * 100)}%`;
    this.cargoFillEl.style.width = `${Math.round((safeInv.cargoFill01 || 0) * 100)}%`;
    const rows = (safeInv.resources?.length ? safeInv.resources : []).filter((e) => (e?.amount || 0) > 0);
    this.headEl.innerHTML = canJettison ? `<span>Ressource</span><span>Qt\xE9</span><span>Prix/u</span><span>Total</span><span></span>` : `<span>Ressource</span><span>Qt\xE9</span><span>Prix/u</span><span>Total</span>`;
    this.rowsEl.innerHTML = rows.map((entry) => {
      const stocked = (entry.amount || 0) > 0;
      const actions = canJettison ? `<div class="cargo-row__actions">
            <button class="ui-btn ui-btn--ghost" data-act="jett1" ${stocked ? "" : "disabled"}>Jeter 1</button>
            <button class="ui-btn" data-act="jettall" ${stocked ? "" : "disabled"}>Tout</button>
          </div>` : "";
      return `
        <div class="cargo-row ${stocked ? "is-stocked" : ""}" data-resource="${entry.key}" data-amount="${entry.amount || 0}">
          <div class="cargo-row__resource">
            <span class="cargo-row__swatch" style="background:${entry.colorHex || "#d0d7e4"}"></span>
            <span>${entry.name}</span>
          </div>
          <span>${formatInt(entry.amount || 0)}</span>
          <span>${formatCredits(entry.sellUnitPrice || 0)}</span>
          <span>${formatCredits(entry.sellTotalValue || 0)}</span>
          ${actions}
        </div>
      `;
    }).join("") || `<div class="cargo-panel__empty">Soute vide.</div>`;
  }
};

// client/src/ui/cargo/CargoIconSvg.js
function getCargoIconSvg() {
  return `
    <svg viewBox="0 0 64 64" class="ui-icon-svg" aria-hidden="true">
      <defs>
        <linearGradient id="cargoHull" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#d9e7f5"></stop>
          <stop offset="100%" stop-color="#8ea4bf"></stop>
        </linearGradient>
        <linearGradient id="cargoGlow" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#8bf7ff" stop-opacity="0.95"></stop>
          <stop offset="100%" stop-color="#4db1ff" stop-opacity="0.15"></stop>
        </linearGradient>
      </defs>
      <path d="M16 19h32l8 10v17a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V29l8-10Z" fill="rgba(8,14,22,0.95)" stroke="rgba(123,189,255,0.55)" stroke-width="2"></path>
      <path d="M24 14h16l7 8H17l7-8Z" fill="url(#cargoHull)"></path>
      <rect x="14" y="26" width="36" height="20" rx="6" fill="url(#cargoHull)" opacity="0.95"></rect>
      <rect x="19" y="30" width="26" height="12" rx="4" fill="rgba(12,20,31,0.9)"></rect>
      <path d="M29 20h6v10h10v4H35v10h-6V34H19v-4h10z" fill="url(#cargoGlow)"></path>
      <circle cx="21" cy="48" r="2.5" fill="#7ce7ff"></circle>
      <circle cx="43" cy="48" r="2.5" fill="#7ce7ff"></circle>
    </svg>`;
}

// client/src/ui/map/MapIconSvg.js
function getMapIconSvg() {
  return `
  <svg class="ui-icon-svg" viewBox="0 0 46 46" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="gMapA" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="rgba(125,233,255,0.95)"/>
        <stop offset="1" stop-color="rgba(99,169,255,0.92)"/>
      </linearGradient>
      <linearGradient id="gMapB" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stop-color="rgba(140,255,205,0.65)"/>
        <stop offset="1" stop-color="rgba(125,233,255,0.15)"/>
      </linearGradient>
    </defs>
    <rect x="8" y="9" width="30" height="28" rx="7" fill="rgba(6,12,18,0.65)" stroke="rgba(180,220,255,0.26)"/>
    <path d="M12 14h22M12 20h22M12 26h22M12 32h22" stroke="rgba(160,210,255,0.22)" stroke-width="1"/>
    <path d="M17 12v22M23 12v22M29 12v22" stroke="rgba(160,210,255,0.18)" stroke-width="1"/>
    <path d="M14.5 30.5c5-7 10-11 17-14" fill="none" stroke="url(#gMapB)" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
    <circle cx="30.5" cy="16.5" r="2.6" fill="url(#gMapA)"/>
    <circle cx="17.2" cy="29.6" r="2.1" fill="rgba(241,197,90,0.95)"/>
    <circle cx="17.2" cy="29.6" r="5.2" fill="rgba(241,197,90,0.12)"/>
  </svg>`;
}

// client/src/ui/map/MapCanvasRenderer.js
var BASE_CELL = 20;
var MIN_CELL = 6;
var MAX_CELL = 74;
function clamp2(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function hexToRgb3(hex) {
  const raw = String(hex || "").trim();
  const m = raw.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 };
}
function rgbaFromHex(hex, alpha) {
  const c = hexToRgb3(hex);
  if (!c) return null;
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}
function biomeCellFill(visited, isKnown) {
  if (!isKnown || !visited?.biomeColorHex) return null;
  const id = String(visited.biomeId || "").toLowerCase();
  const alpha = id === "hub" ? 0.3 : 0.26;
  return rgbaFromHex(visited.biomeColorHex, alpha);
}
function computeMapLayout(w, h, opts) {
  const {
    currentSx,
    currentSy,
    zoom,
    panX,
    panY
  } = opts;
  const cell = clamp2(BASE_CELL * zoom, MIN_CELL, MAX_CELL);
  const currentCellX = w * 0.5 - cell * 0.5 + panX;
  const currentCellY = h * 0.5 - cell * 0.5 + panY;
  return {
    cell,
    currentCellX,
    currentCellY,
    currentSx: currentSx | 0,
    currentSy: currentSy | 0
  };
}
function getSectorRect(layout, sx, sy) {
  const dx = (sx | 0) - layout.currentSx;
  const dy = layout.currentSy - (sy | 0);
  return {
    x: layout.currentCellX + dx * layout.cell,
    y: layout.currentCellY + dy * layout.cell,
    w: layout.cell - 1,
    h: layout.cell - 1
  };
}
function drawGlyph(ctx, glyph, x, y, cell, color2) {
  if (!glyph || cell < 12) return;
  const fontSize = clamp2(Math.floor(cell * 0.58), 9, 26);
  ctx.font = `700 ${fontSize}px Segoe UI, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color2;
  ctx.fillText(glyph, x + cell * 0.5, y + cell * 0.51);
}
function drawSectorMap(ctx, w, h, opts) {
  const {
    layout,
    hover,
    getVisited,
    getBastion,
    visitedList,
    bastionList,
    playerList
  } = opts;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(4,8,13,0.98)";
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.5, h * 0.28, 30, w * 0.5, h * 0.55, Math.max(w, h) * 0.78);
  g.addColorStop(0, "rgba(80,165,230,0.16)");
  g.addColorStop(0.42, "rgba(32,68,105,0.08)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const unique = /* @__PURE__ */ new Map();
  for (const item of visitedList || []) {
    if (!item) continue;
    unique.set(`${item.sx | 0},${item.sy | 0}`, item);
  }
  const currentKey = `${layout.currentSx},${layout.currentSy}`;
  if (!unique.has(currentKey)) {
    unique.set(currentKey, getVisited ? getVisited(layout.currentSx, layout.currentSy) || {
      sx: layout.currentSx,
      sy: layout.currentSy,
      stationCount: 0,
      hasReturnPortal: false
    } : {
      sx: layout.currentSx,
      sy: layout.currentSy,
      stationCount: 0,
      hasReturnPortal: false
    });
  }
  const minDx = Math.floor((0 - layout.currentCellX) / layout.cell) - 1;
  const maxDx = Math.ceil((w - layout.currentCellX) / layout.cell) + 1;
  const minDy = Math.floor((0 - layout.currentCellY) / layout.cell) - 1;
  const maxDy = Math.ceil((h - layout.currentCellY) / layout.cell) + 1;
  for (let dy = minDy; dy <= maxDy; dy += 1) {
    for (let dx = minDx; dx <= maxDx; dx += 1) {
      const sx = layout.currentSx + dx;
      const sy = layout.currentSy - dy;
      const x = layout.currentCellX + dx * layout.cell;
      const y = layout.currentCellY + dy * layout.cell;
      const rectW = layout.cell - 1;
      const rectH = layout.cell - 1;
      const visited = getVisited ? getVisited(sx, sy) : null;
      const bastion = visited?.bastion || (getBastion ? getBastion(sx, sy) : null);
      const isKnown = !!visited || !!bastion || sx === layout.currentSx && sy === layout.currentSy;
      const isHub = sx === 0 && sy === 0;
      const isCurrent = sx === layout.currentSx && sy === layout.currentSy;
      let fill = isKnown ? "rgba(18,28,42,0.88)" : "rgba(8,13,20,0.66)";
      const biomeFill = biomeCellFill(visited, isKnown);
      if (biomeFill) fill = biomeFill;
      if (visited?.stationCount > 0) fill = "rgba(42,76,116,0.90)";
      if (visited?.hasReturnPortal) fill = "rgba(28,88,108,0.92)";
      if (bastion) fill = bastion.captured ? "rgba(42,82,58,0.94)" : bastion.unlocked ? "rgba(82,62,34,0.96)" : "rgba(54,43,52,0.94)";
      if (isHub) fill = "rgba(86,72,28,0.94)";
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, rectW, rectH);
      if (biomeFill && !bastion && !isHub && layout.cell >= 13) {
        const bc = hexToRgb3(visited.biomeColorHex);
        if (bc) {
          ctx.fillStyle = `rgba(${bc.r},${bc.g},${bc.b},0.08)`;
          ctx.fillRect(x + 2, y + 2, Math.max(1, rectW - 4), Math.max(1, rectH - 4));
          if (layout.cell >= 26) {
            ctx.fillStyle = `rgba(${bc.r},${bc.g},${bc.b},0.78)`;
            ctx.fillRect(x + 4, y + rectH - 5, Math.max(3, rectW - 8), 2);
          }
        }
      }
      ctx.strokeStyle = isKnown ? visited?.biomeColorHex ? rgbaFromHex(visited.biomeColorHex, 0.34) || "rgba(110,180,255,0.24)" : "rgba(110,180,255,0.24)" : "rgba(72,100,132,0.10)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, rectW - 1), Math.max(1, rectH - 1));
      let glyph = "";
      let glyphColor = "rgba(235,242,255,0.96)";
      if (isHub) {
        glyph = "H";
        glyphColor = "rgba(255,216,102,0.96)";
      } else if (bastion) {
        glyph = "\u25C8";
        const bc = bastion.color || { r: 250, g: 214, b: 120 };
        glyphColor = `rgba(${bc.r | 0},${bc.g | 0},${bc.b | 0},0.98)`;
      } else if (visited?.hasReturnPortal) {
        glyph = "P";
        glyphColor = "rgba(154,241,255,0.96)";
      } else if ((visited?.stationCount | 0) > 0) {
        glyph = "S";
        glyphColor = "rgba(232,240,255,0.96)";
      }
      drawGlyph(ctx, glyph, x, y, layout.cell, glyphColor);
      if (bastion) {
        const bc = bastion.color || { r: 250, g: 214, b: 120 };
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 520 + (bastion.id || 0));
        ctx.strokeStyle = `rgba(${bc.r | 0},${bc.g | 0},${bc.b | 0},${bastion.unlocked ? 0.62 + pulse * 0.22 : 0.34})`;
        ctx.lineWidth = bastion.captured ? 2 : 3;
        ctx.strokeRect(x + 4, y + 4, Math.max(1, rectW - 8), Math.max(1, rectH - 8));
        ctx.font = `700 ${clamp2(Math.floor(layout.cell * 0.2), 7, 12)}px Segoe UI, Arial, sans-serif`;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = `rgba(${bc.r | 0},${bc.g | 0},${bc.b | 0},0.96)`;
        ctx.fillText(`T${bastion.tier || 1}`, x + rectW - 5, y + rectH - 4);
        if (!bastion.captured && bastion.unlockText && !bastion.unlocked && layout.cell >= 28) {
          const txt = String(bastion.unlockText).replace("Ouvre dans ", "");
          ctx.font = `700 ${clamp2(Math.floor(layout.cell * 0.15), 7, 11)}px Segoe UI, Arial, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = "rgba(255,218,130,0.95)";
          ctx.fillText(txt, x + rectW * 0.5, y + 4);
        }
      }
      if (isCurrent) {
        ctx.fillStyle = "rgba(125,233,255,0.10)";
        ctx.fillRect(x + 3, y + 3, Math.max(1, rectW - 6), Math.max(1, rectH - 6));
        ctx.strokeStyle = "rgba(125,233,255,0.94)";
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 3, y + 3, Math.max(1, rectW - 6), Math.max(1, rectH - 6));
      }
      if (hover && hover.sx === sx && hover.sy === sy) {
        ctx.strokeStyle = "rgba(241,197,90,0.92)";
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 5, y + 5, Math.max(1, rectW - 10), Math.max(1, rectH - 10));
      }
    }
  }
  for (const player of playerList || []) {
    const sx = player.sx | 0;
    const sy = player.sy | 0;
    const r = getSectorRect(layout, sx, sy);
    if (r.x + r.w < 0 || r.y + r.h < 0 || r.x > w || r.y > h) continue;
    const cx = r.x + r.w * 0.5;
    const cy = r.y + r.h * 0.5;
    const rad = clamp2(layout.cell * 0.18, 4, 12);
    ctx.save();
    ctx.fillStyle = player.isMe ? "rgba(125,233,255,0.96)" : "rgba(255,236,132,0.96)";
    ctx.strokeStyle = "rgba(4,8,13,0.98)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  return layout;
}

// client/src/ui/map/MapPanelView.js
var DEFAULT_ZOOM = 0.32;
var MIN_ZOOM = 0.22;
var MAX_ZOOM = 2.3;
var ZOOM_IN_FACTOR = 1.12;
var ZOOM_OUT_FACTOR = 0.89;
function clamp3(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
var MapPanelView = class {
  constructor() {
    this.el = document.createElement("section");
    this.el.className = "map-panel";
    this.seed = 0;
    this.curSx = 0;
    this.curSy = 0;
    this.rawCurSx = 0;
    this.rawCurSy = 0;
    this.activeRadius = 50;
    this.zoom = DEFAULT_ZOOM;
    this.hasUserZoom = false;
    this.panX = 0;
    this.panY = 0;
    this.hover = null;
    this.drag = null;
    this.lastLayout = null;
    this.visitedInfo = /* @__PURE__ */ new Map();
    this.visitedList = [];
    this.bastionInfo = /* @__PURE__ */ new Map();
    this.bastionList = [];
    this.playerList = [];
    this.el.innerHTML = `
      <div class="map-panel__header">
        <div class="map-panel__header-main">
          <div class="map-panel__sub map-panel__sub--top" data-role="sub">\u2014</div>
        </div>
        <div class="map-panel__tools">
          <div class="map-panel__zoom">
            <button class="ui-btn ui-btn--ghost ui-btn--sm" data-act="zoomOut">\u2212</button>
            <div class="map-panel__zoomlabel" data-role="zoomLabel">\u2014</div>
            <button class="ui-btn ui-btn--ghost ui-btn--sm" data-act="zoomIn">+</button>
          </div>
          <div class="map-panel__legend">
            <div class="map-panel__legend-row"><span class="map-panel__glyph">S</span><span>Station</span></div>
            <div class="map-panel__legend-row"><span class="map-panel__glyph">P</span><span>Portail retour</span></div>
            <div class="map-panel__legend-row"><span class="map-panel__glyph map-panel__glyph--hub">H</span><span>Hub [0,0]</span></div>
            <div class="map-panel__legend-row"><span class="map-panel__glyph">\u25C8</span><span>Bastion</span></div>
          </div>
        </div>
      </div>

      <div class="map-panel__body">
        <canvas class="map-panel__canvas" data-role="canvas"></canvas>
        <div class="map-panel__info" data-role="info">
          <div class="map-panel__info-head">
            <div>
              <div class="map-panel__info-title">Secteur</div>
              <div class="map-panel__info-main" data-role="infoMain">\u2014</div>
            </div>
            <div class="map-panel__info-badge" data-role="infoBadge">\u2014</div>
          </div>
          <div class="map-panel__info-sections" data-role="infoSections"></div>
        </div>
      </div>
    `;
    this.canvas = this.el.querySelector('[data-role="canvas"]');
    this.subEl = this.el.querySelector('[data-role="sub"]');
    this.infoMainEl = this.el.querySelector('[data-role="infoMain"]');
    this.infoBadgeEl = this.el.querySelector('[data-role="infoBadge"]');
    this.infoSectionsEl = this.el.querySelector('[data-role="infoSections"]');
    this.zoomLabelEl = this.el.querySelector('[data-role="zoomLabel"]');
    this.el.addEventListener("click", (ev) => {
      const act = ev.target?.dataset?.act;
      if (!act) return;
      if (act === "zoomIn") this._applyZoomAtCanvasPoint(this.zoom * ZOOM_IN_FACTOR);
      if (act === "zoomOut") this._applyZoomAtCanvasPoint(this.zoom * ZOOM_OUT_FACTOR);
    });
    this._bind();
    this._refreshLabels();
  }
  resetView(render = true) {
    this.hasUserZoom = false;
    this.panX = 0;
    this.panY = 0;
    this.hover = null;
    this.drag = null;
    this.lastLayout = null;
    this.zoom = DEFAULT_ZOOM;
    this._refreshLabels();
    if (render) this._render();
  }
  recenter(render = true) {
    this.hasUserZoom = false;
    this.panX = 0;
    this.panY = 0;
    this.hover = null;
    this.drag = null;
    this.lastLayout = null;
    this.zoom = DEFAULT_ZOOM;
    this._refreshLabels();
    if (render) this._render();
  }
  _refreshLabels() {
    this.subEl.textContent = `Secteur actuel [${this.curSx},${this.curSy}]`;
    this.zoomLabelEl.textContent = `${Math.round(this.zoom * 100)}%`;
  }
  _toDisplaySy(rawSy) {
    return rawSy | 0;
  }
  _bind() {
    const onMove = (ev) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      if (this.drag) {
        this.panX = this.drag.startPanX + (x - this.drag.startX);
        this.panY = this.drag.startPanY + (y - this.drag.startY);
        this.hover = null;
        this._render();
        return;
      }
      const hover = this._pickSector(x, y);
      const changed = !this.hover && hover || this.hover && !hover || this.hover && hover && (this.hover.sx !== hover.sx || this.hover.sy !== hover.sy);
      this.hover = hover;
      if (changed) this._render();
    };
    this.canvas.addEventListener("mousemove", onMove);
    this.canvas.addEventListener("mouseleave", () => {
      this.hover = null;
      this.drag = null;
      this._render();
    });
    this.canvas.addEventListener("mousedown", (ev) => {
      if (ev.button !== 0) return;
      const rect = this.canvas.getBoundingClientRect();
      this.drag = {
        startX: ev.clientX - rect.left,
        startY: ev.clientY - rect.top,
        startPanX: this.panX,
        startPanY: this.panY
      };
    });
    window.addEventListener("mouseup", () => {
      this.drag = null;
    });
    this.canvas.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      const factor = (ev.deltaY || 0) < 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR;
      const rect = this.canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      this._applyZoomAtCanvasPoint(this.zoom * factor, x, y);
    }, { passive: false });
  }
  _applyZoomAtCanvasPoint(targetZoom, px = null, py = null) {
    const nextZoom = clamp3(targetZoom, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(nextZoom - this.zoom) < 1e-4) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width || 0));
    const h = Math.max(1, Math.round(rect.height || 0));
    const pointX = px ?? w * 0.5;
    const pointY = py ?? h * 0.5;
    const before = this.lastLayout || this._computeLayout(w, h);
    const hoverSectorX = (pointX - before.currentCellX) / before.cell;
    const hoverSectorY = (pointY - before.currentCellY) / before.cell;
    const oldZoom = this.zoom;
    this.zoom = nextZoom;
    const after = this._computeLayout(w, h);
    this.panX += before.currentCellX + hoverSectorX * before.cell - (after.currentCellX + hoverSectorX * after.cell);
    this.panY += before.currentCellY + hoverSectorY * before.cell - (after.currentCellY + hoverSectorY * after.cell);
    if (Math.abs(oldZoom - this.zoom) > 1e-4) {
      this.hasUserZoom = true;
      this._refreshLabels();
      this._render();
    }
  }
  _pickSector(px, py) {
    if (!this.lastLayout) return null;
    const dx = Math.floor((px - this.lastLayout.currentCellX) / this.lastLayout.cell);
    const dy = Math.floor((py - this.lastLayout.currentCellY) / this.lastLayout.cell);
    const sx = this.lastLayout.currentSx + dx;
    const sy = this.lastLayout.currentSy - dy;
    if (sx === this.curSx && sy === this.curSy) return { sx, sy };
    if (!this.visitedInfo.has(`${sx},${sy}`) && !this.bastionInfo.has(`${sx},${sy}`)) return null;
    return { sx, sy };
  }
  update(mapSnap, invSnap, seed, render = true) {
    this.seed = seed | 0;
    this.rawCurSx = (mapSnap?.sx ?? 0) | 0;
    this.rawCurSy = (mapSnap?.sy ?? 0) | 0;
    this.curSx = this.rawCurSx;
    this.curSy = this._toDisplaySy(this.rawCurSy);
    this.activeRadius = Math.max(0, mapSnap?.activeRadius ?? 50) | 0;
    this.visitedInfo.clear();
    this.visitedList = [];
    this.bastionInfo = /* @__PURE__ */ new Map();
    this.bastionList = [];
    this.playerList = [];
    const sectors = mapSnap?.sectors ?? [];
    for (const s of sectors) {
      const sx = (s.sx ?? 0) | 0;
      const rawSy = (s.sy ?? 0) | 0;
      const sy = this._toDisplaySy(rawSy);
      const item = {
        sx,
        sy,
        rawSy,
        level: (s.level ?? 0) | 0,
        stationCount: (s.stationCount ?? 0) | 0,
        hasReturnPortal: !!s.hasReturnPortal,
        primaryResource: s.primaryResource || "scrap",
        resourceKeys: (s.resourceKeys || [s.primaryResource || "scrap"]).slice(0, 6),
        resourceNames: (s.resourceNames || []).slice(0, 6),
        biomeId: s.biomeId || "unknown",
        biomeName: s.biomeName || "",
        biomeShortName: s.biomeShortName || "",
        biomeDescription: s.biomeDescription || "",
        biomeColorHex: s.biomeColorHex || "",
        bastion: s.bastion || null
      };
      this.visitedInfo.set(`${sx},${sy}`, item);
      this.visitedList.push(item);
    }
    for (const b of mapSnap?.bastions ?? []) {
      const sx = (b.sx ?? 0) | 0;
      const rawSy = (b.sy ?? 0) | 0;
      const sy = this._toDisplaySy(rawSy);
      const item = { ...b, sx, sy, rawSy, bastion: b };
      this.bastionInfo.set(`${sx},${sy}`, item);
      this.bastionList.push(item);
      const existing = this.visitedInfo.get(`${sx},${sy}`);
      if (existing) existing.bastion = b;
    }
    for (const p of mapSnap?.players ?? []) {
      const sx = (p.sx ?? 0) | 0;
      const rawSy = (p.sy ?? 0) | 0;
      this.playerList.push({ ...p, sx, rawSy, sy: this._toDisplaySy(rawSy), isMe: (p.id | 0) === (mapSnap?.meId | 0) });
    }
    this._refreshLabels();
    if (render) this._render();
  }
  relayout() {
    this._render();
  }
  _computeLayout(w, h) {
    return computeMapLayout(w, h, {
      currentSx: this.curSx,
      currentSy: this.curSy,
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
      activeRadius: this.activeRadius
    });
  }
  _render() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    const ctx = this.canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.lastLayout = this._computeLayout(w, h);
    drawSectorMap(ctx, w, h, {
      layout: this.lastLayout,
      hover: this.hover,
      visitedList: this.visitedList,
      bastionList: this.bastionList,
      playerList: this.playerList,
      getVisited: (sx, sy) => this.visitedInfo.get(`${sx | 0},${sy | 0}`) || null,
      getBastion: (sx, sy) => this.bastionInfo.get(`${sx | 0},${sy | 0}`) || null
    });
    const info = this._getInfo();
    this.infoMainEl.textContent = info.main;
    this.infoBadgeEl.textContent = info.badge || "Normal";
    this.infoBadgeEl.className = `map-panel__info-badge ${info.badgeClass || ""}`.trim();
    this.infoSectionsEl.innerHTML = info.html;
  }
  _esc(value) {
    return String(value ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  }
  _renderInfoSection(title, rows, emptyText = "\u2014") {
    const cleanRows = (rows || []).filter(Boolean);
    const body = cleanRows.length ? cleanRows.map((row) => `<div class="map-panel__info-row">${row}</div>`).join("") : `<div class="map-panel__info-empty">${this._esc(emptyText)}</div>`;
    return `<div class="map-panel__info-card"><div class="map-panel__info-card-title">${this._esc(title)}</div>${body}</div>`;
  }
  _chip(text, cls = "") {
    return `<span class="map-panel__chip ${cls}">${this._esc(text)}</span>`;
  }
  _getInfo() {
    const sx = this.hover?.sx ?? this.curSx | 0;
    const sy = this.hover?.sy ?? this.curSy | 0;
    const visited = this.visitedInfo.get(`${sx},${sy}`) || null;
    const bastion = visited?.bastion || this.bastionInfo.get(`${sx},${sy}`) || null;
    const herePlayers = this.playerList.filter((p) => (p.sx | 0) === (sx | 0) && (p.sy | 0) === (sy | 0));
    if (!visited && !bastion && !(sx === this.curSx && sy === this.curSy)) {
      return {
        main: `[${sx},${sy}]`,
        badge: "Inconnu",
        badgeClass: "is-unknown",
        html: this._renderInfoSection("Exploration", ['<span class="map-panel__muted">Secteur non d\xE9couvert.</span>'])
      };
    }
    const typeRows = [];
    if (sx === 0 && sy === 0) typeRows.push(`${this._chip("Hub", "is-hub")} <span>zone prot\xE9g\xE9e</span>`);
    if ((visited?.stationCount | 0) > 0) typeRows.push(`${this._chip("Station")} <span>${visited.stationCount | 0} station${(visited.stationCount | 0) > 1 ? "s" : ""}</span>`);
    if (visited?.hasReturnPortal) typeRows.push(`${this._chip("Retour")} <span>portail vers le hub</span>`);
    if (bastion) {
      const status2 = bastion.captured ? "captur\xE9" : bastion.unlocked ? "ouvert" : "verrouill\xE9";
      typeRows.push(`${this._chip("Bastion", "is-bastion")} <span>${this._esc(bastion.name || "Bastion")} \u2014 ${this._esc(status2)}</span>`);
      if (!bastion.captured && bastion.unlockText) typeRows.push(`<span class="map-panel__muted">${this._esc(bastion.unlockText)}</span>`);
      if (bastion.summary) typeRows.push(`<span class="map-panel__muted">${this._esc(bastion.summary)}</span>`);
    }
    if (visited?.biomeName) {
      typeRows.push(`${this._chip(visited.biomeShortName || "Biome")} <span>${this._esc(visited.biomeName)}</span>`);
      if (visited.biomeDescription) typeRows.push(`<span class="map-panel__muted">${this._esc(visited.biomeDescription)}</span>`);
    }
    if (!typeRows.length) typeRows.push(`${this._chip("Secteur")} <span>zone standard</span>`);
    const playerRows = herePlayers.map((p) => {
      const name = p.pseudo || `P${p.id}`;
      const lvl = p.level ? `Lv ${p.level}` : "";
      return `<div class="map-panel__player-row"><span class="map-panel__player-dot ${p.isMe ? "is-me" : ""}"></span><span>${this._esc(name)}</span><span class="map-panel__muted">${this._esc(lvl)}</span></div>`;
    });
    const resourceRows2 = (visited?.resourceKeys || []).slice(0, 6).map((key, i) => {
      const label = visited?.resourceNames?.[i] || key;
      return `<span class="map-panel__resource-pill" title="${this._esc(key)}">${this._esc(label)}</span>`;
    });
    const badge = sx === 0 && sy === 0 ? "Hub" : bastion ? bastion.captured ? "Captur\xE9" : bastion.unlocked ? "Ouvert" : "Bastion" : (visited?.stationCount | 0) > 0 ? "Station" : "Normal";
    const badgeClass = sx === 0 && sy === 0 ? "is-hub" : bastion ? "is-bastion" : "";
    const html = [
      this._renderInfoSection("Activit\xE9", playerRows, "Aucun joueur dans ce secteur."),
      this._renderInfoSection("Points utiles", typeRows),
      this._renderInfoSection("Ressources probables", resourceRows2, "Ressources inconnues.")
    ].join("");
    return { main: `[${sx},${sy}]`, badge, badgeClass, html };
  }
};

// client/src/ui/map/MapWindowView.js
var MapWindowView = class {
  constructor() {
    this.isOpen = false;
    this.hasRenderedOnce = false;
    this.mapSnap = null;
    this.invSnap = null;
    this.seed = 0;
    this.isOpening = false;
    this._openLayoutToken = 0;
    this.el = document.createElement("section");
    this.el.className = "map-modal";
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="map-modal__backdrop" data-act="close"></div>
      <div class="map-window ui-panel-shell ui-panel-shell--xl">
        <div class="map-window__header">
          <div>
            <div class="map-window__eyebrow">Navigation</div>
            <div class="map-window__title">Carte</div>
          </div>
          <button class="map-window__close" data-act="close" aria-label="Fermer">\u2715</button>
        </div>
        <div class="map-window__body" data-role="body"></div>
      </div>
    `;
    this.bodyEl = this.el.querySelector('[data-role="body"]');
    this.panel = new MapPanelView();
    this.bodyEl.appendChild(this.panel.el);
    this.el.addEventListener("click", (ev) => {
      const act = ev.target?.dataset?.act;
      if (act === "close") this.setOpen(false);
    });
  }
  toggle() {
    this.setOpen(!this.isOpen);
  }
  setOpen(open) {
    const wantOpen = !!open;
    this.isOpen = wantOpen;
    this.isOpening = wantOpen;
    this.el.hidden = !wantOpen;
    this.el.classList.toggle("is-open", wantOpen);
    this._openLayoutToken += 1;
    const token = this._openLayoutToken;
    if (wantOpen) {
      this.el.classList.add("is-preparing");
      this.panel.recenter(false);
      this.panel.update(this.mapSnap, this.invSnap, this.seed, false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!this.isOpen || token !== this._openLayoutToken) return;
          this.panel.relayout();
          this.isOpening = false;
          this.el.classList.remove("is-preparing");
        });
      });
      return;
    }
    this.el.classList.remove("is-preparing");
    this.isOpening = false;
  }
  _stabilizeOpenLayout() {
    const token = ++this._openLayoutToken;
    let prevW = -1;
    let prevH = -1;
    let stableFrames = 0;
    let frames = 0;
    const step = () => {
      if (!this.isOpen || token !== this._openLayoutToken) return;
      this.panel.relayout();
      const rect = this.panel.canvas.getBoundingClientRect();
      const w = Math.round(rect.width || 0);
      const h = Math.round(rect.height || 0);
      if (w > 1 && h > 1 && w === prevW && h === prevH) stableFrames += 1;
      else stableFrames = 0;
      prevW = w;
      prevH = h;
      frames += 1;
      if (stableFrames >= 2 || frames >= 8) {
        this.panel.relayout();
        this.isOpening = false;
        this.el.classList.remove("is-preparing");
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  update(mapSnap, invSnap, seed) {
    this.mapSnap = mapSnap || null;
    this.invSnap = invSnap || null;
    this.seed = seed | 0;
    if (!this.isOpen) return;
    this.panel.update(this.mapSnap, this.invSnap, this.seed, !this.isOpening);
  }
};

// client/src/ui/station/StationIcons.js
function getTradeIconSvg() {
  return `
    <svg class="ui-icon-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 18h24l-2 18H14L12 18Z" stroke="rgba(125,233,255,0.95)" stroke-width="2"/>
      <path d="M18 18v-3a6 6 0 0 1 12 0v3" stroke="rgba(99,169,255,0.95)" stroke-width="2" stroke-linecap="round"/>
      <path d="M18 26h12" stroke="rgba(90,240,196,0.9)" stroke-width="2" stroke-linecap="round"/>
      <path d="M24 22v8" stroke="rgba(90,240,196,0.9)" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}
function getShopIconSvg() {
  return `
    <svg class="ui-icon-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 14h28v20H10z" stroke="rgba(125,233,255,0.95)" stroke-width="2"/>
      <path d="M18 20h12" stroke="rgba(99,169,255,0.95)" stroke-width="2" stroke-linecap="round"/>
      <path d="M18 26h8" stroke="rgba(90,240,196,0.9)" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}
function getEquipmentIconSvg() {
  return `
    <svg class="ui-icon-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M23 10h2l2 5 5 2v2l-5 2-2 5h-2l-2-5-5-2v-2l5-2 2-5Z" stroke="rgba(125,233,255,0.95)" stroke-width="2"/>
      <path d="M14 31l5-5m10 10 5-5" stroke="rgba(90,240,196,0.9)" stroke-width="2" stroke-linecap="round"/>
      <path d="M18 35h12" stroke="rgba(99,169,255,0.95)" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}
function getConverterIconSvg() {
  return `
    <svg class="ui-icon-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 16h20" stroke="rgba(125,233,255,0.95)" stroke-width="2" stroke-linecap="round"/>
      <path d="M34 16l-4-4m4 4-4 4" stroke="rgba(125,233,255,0.95)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M34 32H14" stroke="rgba(90,240,196,0.9)" stroke-width="2" stroke-linecap="round"/>
      <path d="M14 32l4-4m-4 4 4 4" stroke="rgba(90,240,196,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="24" cy="24" r="3" fill="rgba(99,169,255,0.95)"/>
    </svg>
  `;
}
function getAmmoIconSvg() {
  return `
    <svg class="ui-icon-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 10h12v8H18z" stroke="rgba(125,233,255,0.95)" stroke-width="2"/>
      <path d="M20 18h8v18a4 4 0 0 1-8 0V18Z" stroke="rgba(90,240,196,0.9)" stroke-width="2"/>
      <path d="M24 24v8" stroke="rgba(99,169,255,0.95)" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

// client/src/ui/station/StationTabDefs.js
var STATION_TABS = [
  { id: "trade", title: "Commerce", iconMarkup: getTradeIconSvg() },
  { id: "refinery", title: "Raffinage", iconMarkup: getConverterIconSvg() },
  { id: "shop", title: "Boutique", iconMarkup: getShopIconSvg() },
  { id: "ammo", title: "Munitions", iconMarkup: getAmmoIconSvg() },
  { id: "equipment", title: "\xC9quipement", iconMarkup: getEquipmentIconSvg() },
  { id: "converters", title: "Convert.", iconMarkup: getConverterIconSvg() }
];

// client/src/ui/station/StationCommandQueue.js
var StationCommandQueue = class {
  constructor(sendCmd, minDelayMs = 0) {
    this.sendCmd = typeof sendCmd === "function" ? sendCmd : null;
    this.minDelayMs = Math.max(0, minDelayMs | 0);
    this.lastSentAt = 0;
    this.timer = 0;
    this.pending = [];
  }
  send(cmd, payload = {}, meta = {}) {
    if (!this.sendCmd || !cmd) return "";
    const entry = { cmd, payload, meta };
    if (this.minDelayMs <= 0) return this.dispatch(entry);
    this.pending.push(entry);
    this.flush();
    return "";
  }
  dispatch(entry) {
    this.lastSentAt = performance.now();
    return this.sendCmd(entry.cmd, entry.payload || {}, entry.meta || {}) || "";
  }
  flush() {
    if (this.timer || !this.pending.length || !this.sendCmd) return;
    const now = performance.now();
    const wait = Math.max(0, this.minDelayMs - (now - this.lastSentAt));
    if (wait > 0) {
      this.timer = window.setTimeout(() => {
        this.timer = 0;
        this.flush();
      }, wait);
      return;
    }
    const next = this.pending.shift();
    this.dispatch(next);
    if (this.pending.length) this.flush();
  }
};

// client/src/ui/station/StationTradeView.js
var StationTradeView = class {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === "function" ? sendCmd : null;
    this.cmdQueue = new StationCommandQueue(this.sendCmd);
    this.el = document.createElement("div");
    this.el.className = "station-trade";
    this.el.innerHTML = `
      <div class="station-trade__summary">
        <div class="station-trade__metric">
          <div class="station-trade__label">Cr\xE9dits</div>
          <div class="station-trade__value" data-role="credits">0 cr</div>
        </div>
        <div class="station-trade__metric">
          <div class="station-trade__label">Valeur cargo</div>
          <div class="station-trade__value" data-role="cargoValue">0 cr</div>
        </div>
        <div class="station-trade__metric">
          <div class="station-trade__label">Soute</div>
          <div class="station-trade__value" data-role="cargoFill">0 / 0</div>
        </div>
      </div>

      <div class="station-trade__table-head">
        <span>Ressource</span>
        <span>Qt\xE9</span>
        <span>Prix/u</span>
        <span>Total</span>
        <span></span>
      </div>
      <div class="station-trade__rows" data-role="rows"></div>

      <div class="station-trade__footer">
        <button class="ui-btn" data-act="sellAll">Vendre tout</button>
        <div class="station-trade__total">Total : <span data-role="total">0 cr</span></div>
      </div>
    `;
    this.creditsEl = this.el.querySelector('[data-role="credits"]');
    this.cargoValueEl = this.el.querySelector('[data-role="cargoValue"]');
    this.cargoFillEl = this.el.querySelector('[data-role="cargoFill"]');
    this.totalEl = this.el.querySelector('[data-role="total"]');
    this.rowsEl = this.el.querySelector('[data-role="rows"]');
    this.el.addEventListener("contextmenu", (ev) => ev.preventDefault());
    this.el.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 && ev.button !== 2) return;
      const btn = ev.target?.closest?.("button[data-act]");
      if (!btn) return;
      if (!this.sendCmd) return;
      if (btn.disabled) return;
      if (ev.button === 2) ev.preventDefault();
      const act = btn.dataset.act;
      if (act === "sellAll") {
        ev.preventDefault();
        this.cmdQueue.send("sell_all", {});
        return;
      }
      const row = btn.closest("[data-resource]");
      const key = row?.dataset?.resource;
      if (!key) return;
      const amt = Number.isFinite(+row?.dataset?.amount) ? Math.floor(+row.dataset.amount) : 0;
      ev.preventDefault();
      if (act === "sell1") this.cmdQueue.send("sell", { resourceKey: key, amount: 1 });
      if (act === "sellall") this.cmdQueue.send("sell", { resourceKey: key, amount: Math.max(0, amt) });
    });
  }
  update(inv, docked) {
    const safeInv = inv || { credits: 0, cargoUsed: 0, cargoMax: 0, totalSellValue: 0, resources: [] };
    this.creditsEl.textContent = formatCredits(safeInv.credits || 0);
    this.cargoValueEl.textContent = formatCredits(safeInv.totalSellValue || 0);
    this.totalEl.textContent = formatCredits(safeInv.totalSellValue || 0);
    this.cargoFillEl.textContent = `${formatInt(safeInv.cargoUsed || 0)} / ${formatInt(safeInv.cargoMax || 0)}`;
    const rows = (safeInv.resources?.length ? safeInv.resources : []).filter((e) => (e?.amount || 0) > 0);
    this.rowsEl.innerHTML = rows.map((entry) => {
      const stocked = (entry.amount || 0) > 0;
      return `
        <div class="station-trade-row ${stocked ? "is-stocked" : ""}" data-resource="${entry.key}" data-amount="${entry.amount || 0}">
          <div class="station-trade-row__resource">
            <span class="station-trade-row__swatch" style="background:${entry.colorHex || "#d0d7e4"}"></span>
            <span>${entry.name}</span>
          </div>
          <span>${formatInt(entry.amount || 0)}</span>
          <span>${formatCredits(entry.sellUnitPrice || 0)}</span>
          <span>${formatCredits(entry.sellTotalValue || 0)}</span>
          <div class="station-trade-row__actions">
            <button class="ui-btn ui-btn--ghost" data-act="sell1" ${docked && stocked ? "" : "disabled"}>Vendre 1</button>
            <button class="ui-btn" data-act="sellall" ${docked && stocked ? "" : "disabled"}>Tout</button>
          </div>
        </div>
      `;
    }).join("") || `<div class="station-trade__empty">Aucune ressource.</div>`;
    const sellAllBtn = this.el.querySelector('button[data-act="sellAll"]');
    if (sellAllBtn) sellAllBtn.disabled = !docked || !(safeInv.totalSellValue > 0);
  }
};

// client/src/ui/station/StationShopView.js
function itemKeyOf(item) {
  return String(item?.itemId || "");
}
function renderResourceCosts(item) {
  const costs = item?.resourceCosts || [];
  if (!costs.length) return '<div class="station-shop__recipe-line">Aucun co\xFBt mati\xE8re.</div>';
  return costs.map((entry) => {
    const affordable = !!entry.affordable;
    const state = affordable ? "ok" : `manque ${Math.max(0, entry.missing | 0)}`;
    return `<div class="station-shop__recipe-line" style="color:${affordable ? "#cfe8bf" : "#f0b8b0"}">${entry.name} : ${Math.max(0, entry.amount | 0)} \u2022 stock ${Math.max(0, entry.have | 0)} \u2022 ${state}</div>`;
  }).join("");
}
function getStockLines(shop) {
  if (!shop) return [];
  const pool = shop.localResourcePool || {};
  const current = (pool.currentSectorKeys || []).slice(0, 4);
  const nearby = (pool.resourceKeys || []).filter((key) => !current.includes(key)).slice(0, 4);
  return [
    `Palier station : T${Math.max(1, shop.tierGate | 0)}`,
    `Secteur : ${current.length ? current.join(", ") : "aucune"}`,
    `Voisinage : ${nearby.length ? nearby.join(", ") : "aucune"}`
  ];
}
function sortItems(items) {
  return [...items || []].sort((a, b) => {
    const ac = ITEM_CATEGORY_ORDER.indexOf(a?.categoryId);
    const bc = ITEM_CATEGORY_ORDER.indexOf(b?.categoryId);
    if (ac !== bc) return ac - bc;
    const at = a?.tier | 0;
    const bt = b?.tier | 0;
    if (at !== bt) return at - bt;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
}
var StationShopView = class {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === "function" ? sendCmd : null;
    this.cmdQueue = new StationCommandQueue(this.sendCmd);
    this.shopCategoryOrder = ITEM_CATEGORY_ORDER.filter((categoryId) => categoryId !== ITEM_CATEGORY_IDS.AMMO);
    this.activeCategory = this.shopCategoryOrder[0];
    this.selectedItemId = "";
    this.hoverItemId = "";
    this.shop = null;
    this.inv = null;
    this.docked = false;
    this.el = document.createElement("div");
    this.el.className = "station-shop";
    this.el.innerHTML = `
      <div class="station-shop__cats" data-role="cats"></div>
      <div class="station-shop__body">
        <section class="station-shop__grid-panel">
          <div class="station-shop__grid" data-role="grid"></div>
        </section>
        <aside class="station-shop__details">
          <div class="station-shop__details-head">
            <div class="station-shop__details-title" data-role="title">Boutique</div>
            <div class="station-shop__details-meta" data-role="meta">\u2014</div>
          </div>
          <div class="station-shop__details-content" data-role="content"></div>
          <div class="station-shop__footer">
            <button class="ui-btn" type="button" data-role="actionBtn">Acheter</button>
          </div>
        </aside>
      </div>
    `;
    this.catsEl = this.el.querySelector('[data-role="cats"]');
    this.gridEl = this.el.querySelector('[data-role="grid"]');
    this.titleEl = this.el.querySelector('[data-role="title"]');
    this.metaEl = this.el.querySelector('[data-role="meta"]');
    this.contentEl = this.el.querySelector('[data-role="content"]');
    this.actionBtn = this.el.querySelector('[data-role="actionBtn"]');
    this.el.addEventListener("contextmenu", (ev) => ev.preventDefault());
    this.el.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      const tabBtn = ev.target?.closest?.("button[data-cat]");
      if (tabBtn) {
        this.activeCategory = tabBtn.dataset.cat || this.shopCategoryOrder[0];
        this.selectedItemId = "";
        this.render();
        return;
      }
      const iconBtn = ev.target?.closest?.("button[data-item-id]");
      if (iconBtn) {
        this.selectedItemId = iconBtn.dataset.itemId || "";
        this.render();
      }
    });
    this.el.addEventListener("dblclick", (ev) => {
      const iconBtn = ev.target?.closest?.("button[data-item-id]");
      if (!iconBtn) return;
      this.selectedItemId = iconBtn.dataset.itemId || "";
      this.triggerAction();
    });
    this.actionBtn.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.triggerAction();
    });
  }
  getOffers() {
    const offers = sortItems(this.shop?.offers || []);
    return offers.filter((item) => item?.categoryId === this.activeCategory && item?.categoryId !== ITEM_CATEGORY_IDS.AMMO);
  }
  getFocusedItem() {
    const offers = this.shop?.offers || [];
    const key = this.selectedItemId || this.getOffers()[0]?.itemId || "";
    return offers.find((item) => itemKeyOf(item) === key) || null;
  }
  renderCats() {
    this.catsEl.innerHTML = this.shopCategoryOrder.map((categoryId) => {
      const active = categoryId === this.activeCategory ? "is-active" : "";
      return `<button class="station-shop__cat ${active}" type="button" data-cat="${categoryId}">${getItemCategoryName(categoryId)}</button>`;
    }).join("");
  }
  renderGrid() {
    const items = this.getOffers();
    this.gridEl.innerHTML = items.map((item) => {
      const selected = item.itemId === this.selectedItemId;
      return buildItemIconButton(item, { selected, showName: false, compact: true });
    }).join("") || '<div class="station-shop__empty">Aucun item propos\xE9 dans cette cat\xE9gorie.</div>';
  }
  renderDetails() {
    const item = this.getFocusedItem();
    if (!item) {
      this.titleEl.textContent = "Boutique";
      this.metaEl.textContent = "S\xE9lectionnez un item";
      this.contentEl.innerHTML = [
        renderStationInfoSection("Station", getStockLines(this.shop)),
        renderStationInfoSection("D\xE9tails item", "", { emptyText: "Aucun item s\xE9lectionn\xE9" })
      ].join("");
      this.actionBtn.disabled = true;
      this.actionBtn.textContent = "Acheter";
      return;
    }
    const credits = Math.max(0, this.inv?.credits | 0);
    const isAmmo = item.categoryId === ITEM_CATEGORY_IDS.AMMO;
    const status2 = isAmmo ? `${Math.max(0, item.ammoQuantity | 0)} en soute${item.assignedRocketSlots?.length ? ` \u2022 slot ${item.assignedRocketSlots.map((slot) => slot + 1).join("/")}` : ""}` : item.equipped ? "\xE9quip\xE9" : item.owned ? "poss\xE9d\xE9" : "\xE0 acheter";
    this.titleEl.textContent = `${item.name || "Item"} [T${Math.max(1, item.tier | 0)}]`;
    this.metaEl.textContent = `${formatCredits(item.priceCredits || 0)} / ${formatCredits(credits)} cr\xE9dits`;
    this.contentEl.innerHTML = [
      renderItemSections(item, {
        status: `\xC9tat : ${status2}`,
        source: `${item.categoryName || ""}`
      }),
      renderStationInfoSection("Co\xFBts mati\xE8res", renderResourceCosts(item))
    ].join("");
    const needsPurchase = isAmmo || !item.owned && !item.equipped;
    this.actionBtn.disabled = !this.docked || needsPurchase && !item.canAfford;
    this.actionBtn.textContent = isAmmo ? "Acheter pack" : item.equipped ? "Retirer" : item.owned ? "\xC9quiper" : "Acheter";
  }
  triggerAction() {
    const item = this.getFocusedItem();
    if (!item || !this.sendCmd) return;
    if (item.categoryId === ITEM_CATEGORY_IDS.AMMO) {
      this.cmdQueue.send("buy_item", { itemId: item.itemId });
      return;
    }
    if (item.equipped) this.cmdQueue.send("unequip_item", { itemId: item.itemId });
    else if (item.owned) this.cmdQueue.send("equip_item", { itemId: item.itemId });
    else this.cmdQueue.send("buy_item", { itemId: item.itemId });
  }
  render() {
    if (!this.shopCategoryOrder.includes(this.activeCategory)) this.activeCategory = this.shopCategoryOrder[0];
    const offers = this.shop?.offers || [];
    if (this.selectedItemId && !offers.some((item) => item.itemId === this.selectedItemId)) this.selectedItemId = "";
    this.renderCats();
    this.renderGrid();
    this.renderDetails();
  }
  update(shop, inv, docked) {
    this.shop = shop || null;
    this.inv = inv || null;
    this.docked = !!docked;
    this.render();
  }
};

// client/src/ui/station/StationEquipmentView.js
function buildSlots(equipment) {
  const ownedById = new Map((equipment?.ownedItems || []).map((item) => [item.itemId, item]));
  const equippedItems = (equipment?.equippedItems || []).map((item) => ownedById.get(item.itemId) || item);
  const takeFirst = (categoryId, used2) => {
    const idx = equippedItems.findIndex((item2) => item2?.categoryId === categoryId && !used2.has(item2.itemId));
    if (idx < 0) return null;
    const item = equippedItems[idx];
    used2.add(item.itemId);
    return item;
  };
  const used = /* @__PURE__ */ new Set();
  const slots = [];
  const oneSlots = [
    ITEM_CATEGORY_IDS.WEAPON,
    ITEM_CATEGORY_IDS.LAUNCHER,
    ITEM_CATEGORY_IDS.DEFENSE,
    ITEM_CATEGORY_IDS.ENGINE
  ];
  for (const categoryId of oneSlots) {
    slots.push({ id: categoryId, label: getItemCategoryName(categoryId), categoryId, index: 0, item: takeFirst(categoryId, used), kind: "equipment" });
  }
  const moduleCap = Math.max(0, equipment?.slotCaps?.[ITEM_CATEGORY_IDS.MODULE] || 0);
  for (let i = 0; i < moduleCap; i += 1) slots.push({ id: `module-${i}`, label: `Module ${i + 1}`, categoryId: ITEM_CATEGORY_IDS.MODULE, index: i, item: takeFirst(ITEM_CATEGORY_IDS.MODULE, used), kind: "equipment" });
  return slots;
}
function sortInventoryItems(items) {
  return [...items || []].sort((a, b) => {
    const ac = EQUIPMENT_CATEGORY_ORDER.indexOf(a?.categoryId);
    const bc = EQUIPMENT_CATEGORY_ORDER.indexOf(b?.categoryId);
    if (ac !== bc) return ac - bc;
    const at = a?.tier | 0;
    const bt = b?.tier | 0;
    if (at !== bt) return at - bt;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
}
function renderTagSummary(equipment) {
  const tags = (equipment?.tags || []).filter((entry) => entry?.active);
  const supers = equipment?.superTags || [];
  const lines = [];
  if (tags.length > 0) lines.push(`Tags : ${tags.map((entry) => `${entry.name} ${"\u25CF".repeat(Math.max(1, entry.points | 0))}`).join(" \u2022 ")}`);
  if (supers.length > 0) lines.push(`Super-tags : ${supers.map((entry) => `${entry.name} R${Math.max(1, entry.rank | 0)}`).join(" \u2022 ")}`);
  return lines;
}
var StationEquipmentView = class {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === "function" ? sendCmd : null;
    this.equipment = null;
    this.inv = null;
    this.docked = false;
    this.slots = [];
    this.selectedItemId = "";
    this.hoverItemId = "";
    this.selectedSlotId = "";
    this.hoverSlotId = "";
    this.dragItemId = "";
    this.dragSourceSlotId = "";
    this.dropSlotId = "";
    this.pointerDrag = null;
    this.dragGhostEl = null;
    this.suppressClickUntil = 0;
    this.el = document.createElement("div");
    this.el.className = "station-equipment";
    this.el.innerHTML = `
      <div class="station-equipment__frame">
        <section class="station-equipment__left">
          <div class="station-equipment__panel-head">\xC9quip\xE9</div>
          <div class="station-equipment__slots" data-role="slots"></div>
        </section>
        <section class="station-equipment__right">
          <div class="station-equipment__panel-head">Inventaire</div>
          <div class="station-equipment__inventory" data-role="inventory"></div>
        </section>
        <section class="station-equipment__details" data-role="details"></section>
      </div>
    `;
    this.slotsEl = this.el.querySelector('[data-role="slots"]');
    this.inventoryEl = this.el.querySelector('[data-role="inventory"]');
    this.detailsEl = this.el.querySelector('[data-role="details"]');
    this.el.addEventListener("contextmenu", (ev) => ev.preventDefault());
    this.el.addEventListener("mouseover", (ev) => {
      const itemBtn = ev.target?.closest?.("button[data-item-id]");
      const slotNode = ev.target?.closest?.("[data-slot-id]");
      if (itemBtn) this.hoverItemId = itemBtn.dataset.itemId || "";
      if (slotNode) this.hoverSlotId = slotNode.dataset.slotId || "";
      this.renderDetails();
    });
    this.el.addEventListener("mouseout", (ev) => {
      const leavingItem = ev.target?.closest?.("button[data-item-id], [data-slot-id]");
      if (!leavingItem) return;
      const nextInsideItem = ev.relatedTarget && typeof ev.relatedTarget.closest === "function" ? ev.relatedTarget.closest("button[data-item-id], [data-slot-id]") : null;
      if (nextInsideItem) return;
      this.hoverItemId = "";
      this.hoverSlotId = "";
      this.renderDetails();
    });
    this.el.addEventListener("dragstart", (ev) => ev.preventDefault());
    this._boundPointerMove = (ev) => this.onPointerDragMove(ev);
    this._boundPointerUp = (ev) => this.onPointerDragEnd(ev);
    this.el.addEventListener("mousedown", (ev) => {
      if (ev.button !== 0) return;
      const slotNode = ev.target?.closest?.("[data-slot-id]");
      if (slotNode) return;
      const itemBtn = ev.target?.closest?.("button[data-item-id]");
      if (itemBtn) {
        this.selectedItemId = itemBtn.dataset.itemId || "";
        this.selectedSlotId = "";
        this.render();
      }
    });
    this.el.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      const actionBtn = ev.target?.closest?.("button[data-act]");
      if (actionBtn && this.sendCmd && !actionBtn.disabled) {
        ev.preventDefault();
        ev.stopPropagation();
        this.suppressClickUntil = performance.now() + 250;
        this.runActionButton(actionBtn);
        return;
      }
      const dragNode = ev.target?.closest?.("[data-drag-item-id]");
      if (!dragNode) return;
      const itemId = dragNode.dataset.dragItemId || "";
      if (!itemId) return;
      this.pointerDrag = {
        itemId,
        sourceSlotId: dragNode.dataset.dragSourceSlotId || "",
        startX: ev.clientX,
        startY: ev.clientY,
        x: ev.clientX,
        y: ev.clientY,
        active: false
      };
      window.addEventListener("pointermove", this._boundPointerMove, { passive: false });
      window.addEventListener("pointerup", this._boundPointerUp, { passive: false, once: true });
    });
    this.el.addEventListener("click", (ev) => {
      if (performance.now() < this.suppressClickUntil) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      const actionBtn = ev.target?.closest?.("button[data-act]");
      if (actionBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        if (this.sendCmd && !actionBtn.disabled) this.runActionButton(actionBtn);
        return;
      }
      const itemBtn = ev.target?.closest?.("button[data-item-id]");
      if (itemBtn) {
        this.selectedItemId = itemBtn.dataset.itemId || "";
        this.selectedSlotId = "";
        this.render();
        return;
      }
      const slotNode = ev.target?.closest?.("[data-slot-id]");
      if (!slotNode) return;
      const clickedSlotId = slotNode.dataset.slotId || "";
      const slot = this.slots.find((entry) => entry.id === clickedSlotId) || null;
      const selectedInventoryItem = this.getInventoryItems().find((entry) => entry.itemId === this.selectedItemId) || null;
      if (selectedInventoryItem && this.canDropItemOnSlot(selectedInventoryItem, slot)) {
        this.equipItemToSlot(selectedInventoryItem.itemId, slot);
        return;
      }
      this.selectedSlotId = clickedSlotId;
      this.selectedItemId = slot?.item?.itemId || "";
      this.render();
    });
    this.el.addEventListener("dblclick", (ev) => {
      const itemBtn = ev.target?.closest?.("button[data-item-id]");
      if (itemBtn) {
        this.performPrimaryAction(itemBtn.dataset.itemId || "");
        return;
      }
      const slotNode = ev.target?.closest?.("[data-slot-id]");
      if (!slotNode) return;
      const slot = this.slots.find((entry) => entry.id === (slotNode.dataset.slotId || "")) || null;
      if (slot?.item?.itemId) this.sendStationCommand("unequip_item", { itemId: slot.item.itemId });
    });
  }
  sendStationCommand(cmd, payload = {}) {
    if (!this.sendCmd || !cmd) return "";
    return this.sendCmd(cmd, payload, { station: true, source: "equipment" }) || "";
  }
  getItemById(itemId) {
    if (!itemId) return null;
    return this.getInventoryItems().find((entry) => entry.itemId === itemId) || this.getOwnedEquipmentItem(itemId) || null;
  }
  startPointerDrag(ev) {
    if (!this.pointerDrag || this.pointerDrag.active) return;
    const item = this.getItemById(this.pointerDrag.itemId);
    this.pointerDrag.active = true;
    this.dragItemId = this.pointerDrag.itemId;
    this.dragSourceSlotId = this.pointerDrag.sourceSlotId || "";
    this.el.classList.add("is-dragging-equipment");
    this.suppressClickUntil = performance.now() + 250;
    this.dragGhostEl = document.createElement("div");
    this.dragGhostEl.className = "station-equipment__drag-ghost";
    this.dragGhostEl.innerHTML = item ? buildItemIconMarkup(item, { selected: true, compact: true }, "div") : "";
    document.body.appendChild(this.dragGhostEl);
    this.moveDragGhost(ev.clientX, ev.clientY);
  }
  moveDragGhost(x, y) {
    if (!this.dragGhostEl) return;
    this.dragGhostEl.style.transform = `translate(${Math.round(x + 14)}px, ${Math.round(y + 14)}px)`;
  }
  getDropInfoAt(x, y) {
    const oldPointerEvents = this.dragGhostEl?.style.pointerEvents;
    if (this.dragGhostEl) this.dragGhostEl.style.pointerEvents = "none";
    const node = document.elementFromPoint(x, y);
    if (this.dragGhostEl) this.dragGhostEl.style.pointerEvents = oldPointerEvents || "none";
    const slotNode = node?.closest?.("[data-slot-id]") || null;
    const inventoryDrop = node?.closest?.('[data-role="inventory"]') || null;
    return { slotNode, inventoryDrop };
  }
  onPointerDragMove(ev) {
    if (!this.pointerDrag) return;
    const dx = ev.clientX - this.pointerDrag.startX;
    const dy = ev.clientY - this.pointerDrag.startY;
    if (!this.pointerDrag.active && dx * dx + dy * dy >= 36) this.startPointerDrag(ev);
    if (!this.pointerDrag.active) return;
    ev.preventDefault();
    this.pointerDrag.x = ev.clientX;
    this.pointerDrag.y = ev.clientY;
    this.moveDragGhost(ev.clientX, ev.clientY);
    const { slotNode, inventoryDrop } = this.getDropInfoAt(ev.clientX, ev.clientY);
    if (inventoryDrop && this.pointerDrag.sourceSlotId) {
      this.clearDropTarget();
      this.el.classList.add("is-inventory-drop-target");
      return;
    }
    this.el.classList.remove("is-inventory-drop-target");
    if (!slotNode) {
      this.clearDropTarget();
      return;
    }
    const slot = this.slots.find((entry) => entry.id === (slotNode.dataset.slotId || "")) || null;
    const item = this.getItemById(this.pointerDrag.itemId);
    if (!this.canDropItemOnSlot(item, slot)) {
      this.clearDropTarget();
      return;
    }
    this.markDropTarget(slotNode, slot.id);
  }
  onPointerDragEnd(ev) {
    window.removeEventListener("pointermove", this._boundPointerMove);
    const drag = this.pointerDrag;
    this.pointerDrag = null;
    if (!drag) return;
    const wasActive = !!drag.active;
    if (wasActive) {
      ev.preventDefault();
      this.suppressClickUntil = performance.now() + 250;
    }
    this.el.classList.remove("is-dragging-equipment", "is-inventory-drop-target");
    if (this.dragGhostEl) {
      this.dragGhostEl.remove();
      this.dragGhostEl = null;
    }
    this.dragItemId = "";
    this.dragSourceSlotId = "";
    const { slotNode, inventoryDrop } = this.getDropInfoAt(ev.clientX, ev.clientY);
    this.clearDropTarget();
    if (!wasActive) return;
    if (inventoryDrop && drag.sourceSlotId) {
      this.sendStationCommand("unequip_item", { itemId: drag.itemId });
      return;
    }
    if (!slotNode) return;
    const slot = this.slots.find((entry) => entry.id === (slotNode.dataset.slotId || "")) || null;
    const item = this.getItemById(drag.itemId);
    if (!this.canDropItemOnSlot(item, slot)) return;
    this.equipItemToSlot(drag.itemId, slot);
  }
  runActionButton(actionBtn) {
    if (!actionBtn || !this.sendCmd) return;
    const act = actionBtn.dataset.act;
    const itemId = actionBtn.dataset.itemId || this.getFocusedItem()?.itemId || this.selectedItemId || "";
    const slot = Number.isFinite(Number(actionBtn.dataset.slot)) ? Math.max(0, Math.min(1, Number(actionBtn.dataset.slot) | 0)) : 0;
    if (act === "equip" && itemId) {
      this.performPrimaryAction(itemId);
      return;
    }
    if (act === "unequip" && itemId) {
      this.sendStationCommand("unequip_item", { itemId });
      return;
    }
    if (act === "sellItem" && itemId) {
      this.sendStationCommand("sell_item", { itemId });
      return;
    }
    if (act === "assignAmmo" && itemId) {
      this.sendStationCommand("assign_rocket_ammo", { itemId, slot });
      return;
    }
    if (act === "switchRocketSlot") {
      this.sendStationCommand("switch_rocket_slot", { slot });
      return;
    }
    if (act === "toggleConverter" && itemId) this.sendStationCommand("toggle_converter", { itemId });
  }
  clearDropTarget() {
    this.el.querySelectorAll(".station-equipment-slot.is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
    this.dropSlotId = "";
  }
  markDropTarget(slotNode, slotId) {
    if (!slotNode || !slotId) return;
    if (this.dropSlotId === slotId && slotNode.classList.contains("is-drop-target")) return;
    this.clearDropTarget();
    this.dropSlotId = slotId;
    slotNode.classList.add("is-drop-target");
  }
  canDropItemOnSlot(item, slot) {
    if (!this.docked || !item || !slot) return false;
    if (item.categoryId === ITEM_CATEGORY_IDS.AMMO || item.categoryId === ITEM_CATEGORY_IDS.CONVERTER) return false;
    return item.categoryId === slot.categoryId;
  }
  equipItemToSlot(itemId, slot) {
    if (!itemId || !slot || !this.sendCmd) return;
    this.selectedItemId = itemId;
    this.selectedSlotId = slot.id;
    this.sendStationCommand("equip_item_to_slot", {
      itemId,
      categoryId: slot.categoryId,
      slotId: slot.id,
      index: slot.index | 0
    });
  }
  getInventoryItems() {
    const equippedIds = new Set((this.equipment?.equippedItems || []).map((item) => item?.itemId).filter(Boolean));
    const equipmentItems = (this.equipment?.ownedItems || []).filter((item) => {
      if (!item) return false;
      if (item.categoryId === ITEM_CATEGORY_IDS.CONVERTER || item.categoryId === ITEM_CATEGORY_IDS.AMMO) return false;
      return !equippedIds.has(item.itemId);
    });
    return sortInventoryItems(equipmentItems);
  }
  getOwnedEquipmentItem(itemId) {
    if (!itemId) return null;
    return (this.equipment?.ownedItems || []).find((item) => item?.itemId === itemId) || null;
  }
  getFocusedSlot() {
    const slotId = this.hoverSlotId || this.selectedSlotId;
    return this.slots.find((entry) => entry.id === slotId) || null;
  }
  getFocusedItem() {
    const slot = this.getFocusedSlot();
    if (slot?.item) return slot.item;
    const itemId = this.hoverItemId || this.selectedItemId;
    if (itemId) return this.getInventoryItems().find((item) => item.itemId === itemId) || this.getOwnedEquipmentItem(itemId);
    return null;
  }
  performPrimaryAction(itemId) {
    if (!itemId || !this.sendCmd) return;
    const item = this.getInventoryItems().find((entry) => entry.itemId === itemId) || null;
    if (!item) return;
    if (item.categoryId === ITEM_CATEGORY_IDS.AMMO) {
      const selectedSlot = this.getFocusedSlot();
      const slot = selectedSlot?.kind === "ammo" ? selectedSlot.ammoSlot : item.assignedRocketSlots?.[0] ?? this.equipment?.rocketAmmo?.activeSlot ?? 0;
      this.sendStationCommand("assign_rocket_ammo", { itemId, slot });
      return;
    }
    if (item.equipped) this.sendStationCommand("unequip_item", { itemId });
    else {
      const selectedSlot = this.getFocusedSlot();
      const target = selectedSlot && this.canDropItemOnSlot(item, selectedSlot) ? selectedSlot : this.slots.find((slot) => this.canDropItemOnSlot(item, slot) && !slot.item) || this.slots.find((slot) => this.canDropItemOnSlot(item, slot)) || null;
      if (target) this.equipItemToSlot(itemId, target);
      else this.sendStationCommand("equip_item", { itemId });
    }
  }
  renderSlots() {
    this.slotsEl.innerHTML = this.slots.map((slot) => {
      const selected = slot.id === (this.hoverSlotId || this.selectedSlotId);
      const isDropTarget = slot.id === this.dropSlotId;
      const content = slot.item ? buildItemIconMarkup(slot.item, { selected, compact: true }, "div") : `<span class="station-equipment-slot__emptybox"></span>`;
      return `
        <div class="station-equipment-slot ${selected ? "is-selected" : ""} ${isDropTarget ? "is-drop-target" : ""} ${slot.active ? "is-active" : ""}" data-slot-id="${slot.id}" data-category-id="${slot.categoryId || ""}" ${slot.item ? `data-drag-item-id="${slot.item.itemId}" data-drag-source-slot-id="${slot.id}"` : ""} title="${slot.label}">
          <span class="station-equipment-slot__iconwrap">${content}</span>
          <span class="station-equipment-slot__label">${slot.label}${slot.active ? " *" : ""}</span>
        </div>
      `;
    }).join("");
  }
  renderInventory() {
    const items = this.getInventoryItems();
    this.inventoryEl.innerHTML = items.map((item) => {
      const selected = item.itemId === (this.hoverItemId || this.selectedItemId);
      const button = buildItemIconButton(item, { selected, showName: false, compact: true });
      return button.replace("<button", `<button data-drag-item-id="${item.itemId}" data-drag-source="inventory"`);
    }).join("") || '<div class="station-equipment__empty">Aucun item poss\xE9d\xE9.</div>';
  }
  renderSummaryDetails(slot) {
    const summaryLines = this.equipment?.summary?.effectLines || [];
    const tagLines = renderTagSummary(this.equipment);
    const slotText = slot ? `${slot.label} : ${slot.item ? slot.item.shortName || slot.item.name : "vide"}${slot.active ? " \u2022 actif" : ""}` : "Glissez un item de l\u2019inventaire vers un emplacement compatible.";
    const blocks = [
      `<div class="station-equipment__details-text">${slotText}</div>`,
      ...tagLines.map((line3) => `<div class="station-equipment__details-text">${line3}</div>`),
      ...summaryLines.length > 0 ? [`<div class="station-equipment__details-text">Effets actifs : ${summaryLines.join(" \u2022 ")}</div>`] : []
    ];
    this.detailsEl.innerHTML = blocks.join("");
  }
  renderAmmoDetails(item, slot) {
    const assignedSlots = item.assignedRocketSlots || [];
    const slotText = assignedSlots.length ? assignedSlots.map((index) => `S${index + 1}`).join(" / ") : "aucun";
    const activateButtons = assignedSlots.map((index) => `<button class="ui-btn ui-btn--ghost" type="button" data-act="switchRocketSlot" data-slot="${index}" ${this.docked ? "" : "disabled"}>Activer S${index + 1}</button>`).join("");
    this.detailsEl.innerHTML = `
      <div class="station-equipment__details-headline">
        <span class="station-equipment__details-name">${item.name}</span>
        <span class="station-equipment__details-price">Quantit\xE9 ${Math.max(0, item.ammoQuantity | 0)}</span>
      </div>
      ${renderItemSections(item, {
      status: `Slots : ${slotText}${item.active ? " \u2022 actif" : ""}`,
      source: getItemMetaText(item)
    })}
      <div class="station-equipment__details-actions">
        <button class="ui-btn" type="button" data-act="assignAmmo" data-slot="0" data-item-id="${item.itemId}" ${this.docked ? "" : "disabled"}>Assigner S1</button>
        <button class="ui-btn" type="button" data-act="assignAmmo" data-slot="1" data-item-id="${item.itemId}" ${this.docked ? "" : "disabled"}>Assigner S2</button>
        <button class="ui-btn ui-btn--ghost" type="button" data-act="sellItem" data-item-id="${item.itemId}" ${this.docked ? "" : "disabled"}>Vendre</button>
        ${activateButtons}
      </div>
    `;
  }
  renderEquipmentDetails(item) {
    const meta = `${item.categoryName || ""} \u2022 T${Math.max(1, item.tier | 0)}${item.equipped ? " \u2022 \xE9quip\xE9" : ""}`;
    let actions = "";
    if (item.equipped) {
      actions = `<button class="ui-btn ui-btn--ghost" type="button" data-act="unequip" data-item-id="${item.itemId}" ${this.docked ? "" : "disabled"}>Retirer</button>`;
    } else {
      actions = `
        <button class="ui-btn" type="button" data-act="equip" data-item-id="${item.itemId}" ${this.docked ? "" : "disabled"}>\xC9quiper</button>
        <button class="ui-btn ui-btn--ghost" type="button" data-act="sellItem" data-item-id="${item.itemId}" ${this.docked ? "" : "disabled"}>Vendre</button>
      `;
    }
    this.detailsEl.innerHTML = `
      <div class="station-equipment__details-headline">
        <span class="station-equipment__details-name">${item.name}</span>
        <span class="station-equipment__details-price">Revente ${formatCredits(item.sellPriceCredits || 0)}</span>
      </div>
      ${renderItemSections(item, {
      status: item.equipped ? "\xC9tat : \xE9quip\xE9" : "\xC9tat : en inventaire",
      source: meta
    })}
      <div class="station-equipment__details-actions">${actions}</div>
    `;
  }
  renderDetails() {
    const item = this.getFocusedItem();
    const slot = this.getFocusedSlot();
    if (!item) {
      this.renderSummaryDetails(slot);
      return;
    }
    if (item.categoryId === ITEM_CATEGORY_IDS.AMMO) {
      this.renderAmmoDetails(item, slot);
      return;
    }
    this.renderEquipmentDetails(item);
  }
  render() {
    this.slots = buildSlots(this.equipment);
    const invIds = new Set(this.getInventoryItems().map((item) => item.itemId));
    const slotIds = new Set(this.slots.map((slot) => slot?.item?.itemId).filter(Boolean));
    if (this.selectedItemId && !invIds.has(this.selectedItemId) && !slotIds.has(this.selectedItemId)) this.selectedItemId = "";
    if (this.hoverItemId && !invIds.has(this.hoverItemId) && !slotIds.has(this.hoverItemId)) this.hoverItemId = "";
    this.renderSlots();
    this.renderInventory();
    this.renderDetails();
  }
  update(equipment, inv, docked) {
    this.equipment = equipment || null;
    this.inv = inv || null;
    this.docked = !!docked;
    this.render();
  }
};

// client/src/ui/station/StationAmmoView.js
function sortAmmoItems(items) {
  return [...items || []].sort((a, b) => {
    const at = a?.tier | 0;
    const bt = b?.tier | 0;
    if (at !== bt) return at - bt;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
}
function slotIndexFromId(slotId) {
  const m = String(slotId || "").match(/(\d+)$/);
  return m ? Math.max(0, Math.min(1, Number(m[1]) | 0)) : 0;
}
var StationAmmoView = class {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === "function" ? sendCmd : null;
    this.cmdQueue = new StationCommandQueue(this.sendCmd);
    this.equipment = null;
    this.shop = null;
    this.inv = null;
    this.docked = false;
    this.selectedItemId = "";
    this.selectedSource = "inventory";
    this.selectedSlotId = "";
    this.hoverItemId = "";
    this.hoverSource = "";
    this.hoverSlotId = "";
    this.pointerDrag = null;
    this.dragGhostEl = null;
    this.dropSlotId = "";
    this.dropToInventory = false;
    this.suppressClickUntil = 0;
    this.el = document.createElement("div");
    this.el.className = "station-ammo station-ammo--dropmode";
    this.el.innerHTML = `
      <div class="station-ammo-drop">
        <section class="station-ammo-drop__slots">
          <div class="station-equipment__panel-head">Lance-roquettes</div>
          <div class="station-ammo-drop__slotlist" data-role="slots"></div>
        </section>
        <section class="station-ammo-drop__inventory" data-ammo-inventory-drop="1">
          <div class="station-equipment__panel-head">Munitions en soute</div>
          <div class="station-ammo-drop__grid" data-role="inventory"></div>
        </section>
        <section class="station-ammo-drop__shop">
          <div class="station-equipment__panel-head">Boutique munitions</div>
          <div class="station-ammo-drop__grid" data-role="shop"></div>
        </section>
        <section class="station-ammo-drop__details" data-role="details"></section>
      </div>
    `;
    this.slotsEl = this.el.querySelector('[data-role="slots"]');
    this.inventoryPanelEl = this.el.querySelector('[data-ammo-inventory-drop="1"]');
    this.inventoryEl = this.el.querySelector('[data-role="inventory"]');
    this.shopEl = this.el.querySelector('[data-role="shop"]');
    this.detailsEl = this.el.querySelector('[data-role="details"]');
    this._boundPointerMove = (ev) => this.onPointerDragMove(ev);
    this._boundPointerUp = (ev) => this.onPointerDragEnd(ev);
    this.el.addEventListener("contextmenu", (ev) => ev.preventDefault());
    this.el.addEventListener("dragstart", (ev) => ev.preventDefault());
    this.el.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      const dragNode = ev.target?.closest?.("[data-ammo-id]");
      if (dragNode) {
        const itemId = dragNode.dataset.ammoId || "";
        if (itemId) {
          ev.preventDefault();
          this.selectedItemId = itemId;
          this.selectedSource = dragNode.dataset.source || "inventory";
          this.selectedSlotId = dragNode.dataset.slotId || "";
          this.pointerDrag = {
            itemId,
            source: this.selectedSource,
            slotId: dragNode.dataset.slotId || "",
            startX: ev.clientX,
            startY: ev.clientY,
            active: false
          };
          window.addEventListener("pointermove", this._boundPointerMove, { passive: false });
          window.addEventListener("pointerup", this._boundPointerUp, { passive: false, once: true });
          this.render();
          return;
        }
      }
      const slotNode = ev.target?.closest?.("[data-ammo-slot-id]");
      if (slotNode) {
        ev.preventDefault();
        this.handleSlotClick(slotNode.dataset.ammoSlotId || "");
      }
    });
    this.el.addEventListener("click", (ev) => {
      if (performance.now() < this.suppressClickUntil) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      const itemNode = ev.target?.closest?.("[data-ammo-id]");
      if (itemNode) {
        ev.preventDefault();
        this.selectedItemId = itemNode.dataset.ammoId || "";
        this.selectedSource = itemNode.dataset.source || "inventory";
        this.selectedSlotId = itemNode.dataset.slotId || "";
        this.render();
        return;
      }
      const slotNode = ev.target?.closest?.("[data-ammo-slot-id]");
      if (slotNode) {
        ev.preventDefault();
        this.handleSlotClick(slotNode.dataset.ammoSlotId || "");
      }
    });
    this.el.addEventListener("dblclick", (ev) => {
      const itemNode = ev.target?.closest?.("[data-ammo-id]");
      if (!itemNode) return;
      ev.preventDefault();
      ev.stopPropagation();
      const itemId = itemNode.dataset.ammoId || "";
      const source = itemNode.dataset.source || "inventory";
      if (!itemId) return;
      if (source === "slot") {
        const slot = slotIndexFromId(itemNode.dataset.slotId || "0");
        this.unassignAmmo(slot);
        return;
      }
      const target = this.getSlots().find((slot) => !slot.item) || this.getSlots()[0] || null;
      if (target) this.assignAmmo(itemId, source, target.slot);
    });
    this.el.addEventListener("wheel", (ev) => {
      const scrollNode = ev.target?.closest?.(".station-ammo-drop__grid, .station-ammo-drop__details");
      if (scrollNode) ev.stopPropagation();
    }, { passive: true });
  }
  assignAmmo(itemId, source, slot) {
    if (!itemId || !this.sendCmd || !this.docked) return;
    const slotIndex = Math.max(0, Math.min(1, slot | 0));
    if (source === "shop") {
      this.cmdQueue.send("buy_and_assign_rocket_ammo", { itemId, slot: slotIndex });
      return;
    }
    this.cmdQueue.send("assign_rocket_ammo", { itemId, slot: slotIndex });
  }
  unassignAmmo(slot) {
    if (!this.sendCmd || !this.docked) return;
    this.cmdQueue.send("unassign_rocket_ammo", { slot: Math.max(0, Math.min(1, slot | 0)) });
  }
  handleSlotClick(slotId) {
    const slot = this.getSlots().find((entry) => entry.id === slotId) || null;
    if (!slot) return;
    if (this.selectedItemId && this.selectedSource !== "slot") {
      this.assignAmmo(this.selectedItemId, this.selectedSource, slot.slot);
      this.selectedSlotId = slot.id;
      this.render();
      return;
    }
    this.selectedSlotId = slot.id;
    if (slot.item) {
      this.cmdQueue.send("switch_rocket_slot", { slot: slot.slot });
      this.selectedItemId = slot.item.itemId;
      this.selectedSource = "slot";
    } else {
      this.selectedItemId = "";
      this.selectedSource = "inventory";
    }
    this.render();
  }
  getAssignedAmmoIds() {
    return new Set(this.getSlots().map((slot) => slot.item?.itemId).filter(Boolean));
  }
  getInventoryItems() {
    const assigned = this.getAssignedAmmoIds();
    return sortAmmoItems(this.equipment?.rocketAmmo?.inventory || []).filter((item) => !assigned.has(item.itemId));
  }
  getShopItems() {
    return sortAmmoItems((this.shop?.offers || []).filter((item) => item?.categoryId === "ammo"));
  }
  getSlots() {
    const rocketAmmo = this.equipment?.rocketAmmo || { slots: [], activeSlot: 0 };
    return [0, 1].map((slot) => {
      const entry = rocketAmmo.slots?.[slot] || null;
      return {
        id: `rocket-ammo-slot-${slot}`,
        label: `Roquette ${slot + 1}`,
        slot,
        active: !!entry?.active,
        item: entry?.item || null
      };
    });
  }
  getItemById(itemId, source = "") {
    if (!itemId) return null;
    const slotItem = this.getSlots().map((slot) => slot.item).find((item) => item?.itemId === itemId) || null;
    const invItem = this.getInventoryItems().find((item) => item.itemId === itemId) || null;
    const shopItem = this.getShopItems().find((item) => item.itemId === itemId) || null;
    if (source === "shop") return shopItem || invItem || slotItem;
    if (source === "slot") return slotItem || invItem || shopItem;
    return invItem || slotItem || shopItem;
  }
  getFocusedSlot() {
    return this.getSlots().find((entry) => entry.id === this.selectedSlotId) || null;
  }
  getFocusedItem() {
    if (this.selectedItemId) return this.getItemById(this.selectedItemId, this.selectedSource);
    return this.getFocusedSlot()?.item || null;
  }
  startPointerDrag(ev) {
    if (!this.pointerDrag || this.pointerDrag.active) return;
    const item = this.getItemById(this.pointerDrag.itemId, this.pointerDrag.source);
    this.pointerDrag.active = true;
    this.suppressClickUntil = performance.now() + 250;
    this.el.classList.add("is-dragging-equipment");
    this.dragGhostEl = document.createElement("div");
    this.dragGhostEl.className = "station-equipment__drag-ghost station-ammo-drop__ghost";
    this.dragGhostEl.innerHTML = item ? buildItemIconMarkup(item, { selected: true, compact: true }, "div") : "";
    document.body.appendChild(this.dragGhostEl);
    this.moveDragGhost(ev.clientX, ev.clientY);
  }
  moveDragGhost(x, y) {
    if (!this.dragGhostEl) return;
    this.dragGhostEl.style.transform = `translate(${Math.round(x + 16)}px, ${Math.round(y + 16)}px)`;
  }
  getNodeAt(x, y, selector) {
    const oldPointerEvents = this.dragGhostEl?.style.pointerEvents;
    if (this.dragGhostEl) this.dragGhostEl.style.pointerEvents = "none";
    const node = document.elementFromPoint(x, y);
    if (this.dragGhostEl) this.dragGhostEl.style.pointerEvents = oldPointerEvents || "none";
    return node?.closest?.(selector) || null;
  }
  getDropSlotAt(x, y) {
    return this.getNodeAt(x, y, "[data-ammo-slot-id]");
  }
  getInventoryDropAt(x, y) {
    return this.getNodeAt(x, y, '[data-ammo-inventory-drop="1"]');
  }
  clearDropTarget() {
    this.el.querySelectorAll(".station-ammo-drop-slot.is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
    this.inventoryPanelEl?.classList.remove("is-drop-target");
    this.dropSlotId = "";
    this.dropToInventory = false;
  }
  markDropTarget(slotNode, inventoryNode) {
    this.clearDropTarget();
    if (slotNode) {
      const slotId = slotNode.dataset?.ammoSlotId || "";
      this.dropSlotId = slotId;
      slotNode.classList.add("is-drop-target");
      return;
    }
    if (inventoryNode) {
      this.dropToInventory = true;
      inventoryNode.classList.add("is-drop-target");
    }
  }
  onPointerDragMove(ev) {
    if (!this.pointerDrag) return;
    const dx = ev.clientX - this.pointerDrag.startX;
    const dy = ev.clientY - this.pointerDrag.startY;
    if (!this.pointerDrag.active && dx * dx + dy * dy >= 25) this.startPointerDrag(ev);
    if (!this.pointerDrag.active) return;
    ev.preventDefault();
    this.moveDragGhost(ev.clientX, ev.clientY);
    const slotNode = this.getDropSlotAt(ev.clientX, ev.clientY);
    const invNode = !slotNode && this.pointerDrag.source === "slot" ? this.getInventoryDropAt(ev.clientX, ev.clientY) : null;
    if (slotNode || invNode) this.markDropTarget(slotNode, invNode);
    else this.clearDropTarget();
  }
  onPointerDragEnd(ev) {
    window.removeEventListener("pointermove", this._boundPointerMove);
    const drag = this.pointerDrag;
    this.pointerDrag = null;
    if (!drag) return;
    const wasActive = !!drag.active;
    if (wasActive) {
      ev.preventDefault();
      this.suppressClickUntil = performance.now() + 250;
    }
    this.el.classList.remove("is-dragging-equipment");
    if (this.dragGhostEl) {
      this.dragGhostEl.remove();
      this.dragGhostEl = null;
    }
    const slotNode = this.getDropSlotAt(ev.clientX, ev.clientY);
    const invNode = !slotNode && drag.source === "slot" ? this.getInventoryDropAt(ev.clientX, ev.clientY) : null;
    this.clearDropTarget();
    if (!wasActive) return;
    if (slotNode) {
      const slot = this.getSlots().find((entry) => entry.id === (slotNode.dataset.ammoSlotId || "")) || null;
      if (slot) this.assignAmmo(drag.itemId, drag.source, slot.slot);
      return;
    }
    if (invNode && drag.source === "slot") {
      this.unassignAmmo(slotIndexFromId(drag.slotId));
    }
  }
  renderSlots() {
    const selectedId = this.selectedSlotId;
    this.slotsEl.innerHTML = this.getSlots().map((slot) => {
      const selected = slot.id === selectedId;
      const content = slot.item ? buildItemIconMarkup(slot.item, { selected, compact: true }, "div") : '<span class="station-ammo-drop-slot__empty">D\xE9pose ici</span>';
      const quantity = slot.item ? `x${Math.max(0, slot.item.ammoQuantity | 0)}` : "vide";
      const dataItem = slot.item ? `data-ammo-id="${slot.item.itemId}" data-source="slot" data-slot-id="${slot.id}"` : "";
      return `
        <div class="station-ammo-drop-slot ${selected ? "is-selected" : ""} ${slot.active ? "is-active" : ""} ${slot.id === this.dropSlotId ? "is-drop-target" : ""}" data-ammo-slot-id="${slot.id}" ${dataItem}>
          <div class="station-ammo-drop-slot__icon">${content}</div>
          <div class="station-ammo-drop-slot__body">
            <div class="station-ammo-drop-slot__title">${slot.label}${slot.active ? " \u2022 actif" : ""}</div>
            <div class="station-ammo-drop-slot__name">${slot.item?.name || "Aucune munition"}</div>
            <div class="station-ammo-drop-slot__meta">${quantity}${slot.item ? " \u2022 glisse vers la soute pour retirer" : ""}</div>
          </div>
        </div>
      `;
    }).join("");
  }
  renderInventory() {
    const items = this.getInventoryItems();
    this.inventoryEl.innerHTML = items.map((item) => this.renderAmmoCard(item, "inventory")).join("") || '<div class="station-equipment__empty">Aucune roquette libre en soute.</div>';
  }
  renderShop() {
    const items = this.getShopItems();
    this.shopEl.innerHTML = items.map((item) => this.renderAmmoCard(item, "shop")).join("") || '<div class="station-equipment__empty">Aucune munition propos\xE9e.</div>';
  }
  renderAmmoCard(item, source) {
    const selected = item.itemId === this.selectedItemId && source === this.selectedSource;
    const canAfford = source !== "shop" || item.canAfford !== false;
    const icon = buildItemIconButton(item, { selected, showName: false, compact: true }).replace("<button ", `<button data-ammo-id="${item.itemId}" data-source="${source}" `);
    const price = source === "shop" ? formatCredits(item.priceCredits || 0) : `x${Math.max(0, item.ammoQuantity | 0)}`;
    const hint = source === "shop" ? canAfford ? "Glisser vers un slot pour acheter" : "Cr\xE9dits insuffisants" : "Glisser vers un slot";
    return `
      <div class="station-ammo-drop-card ${selected ? "is-selected" : ""} ${canAfford ? "" : "is-unaffordable"}" data-ammo-id="${item.itemId}" data-source="${source}">
        ${icon}
        <div class="station-ammo-drop-card__body">
          <div class="station-ammo-drop-card__name">${item.shortName || item.name}</div>
          <div class="station-ammo-drop-card__meta">T${Math.max(1, item.tier | 0)} \u2022 ${price}</div>
          <div class="station-ammo-drop-card__hint">${hint}</div>
        </div>
      </div>
    `;
  }
  renderSummaryDetails(slot) {
    const active = this.equipment?.rocketAmmo?.activeItem || null;
    const slotText = slot ? `${slot.label} : ${slot.item ? `${slot.item.name} x${Math.max(0, slot.item.ammoQuantity | 0)}` : "vide"}${slot.active ? " \u2022 actif" : ""}` : "S\xE9lectionnez une munition ou un emplacement.";
    const activeText = active ? `Active : ${active.name} x${Math.max(0, active.ammoQuantity | 0)}` : "Active : aucune";
    this.detailsEl.innerHTML = `
      <div class="station-ammo-drop__details-title">Munitions</div>
      ${renderStationInfoSection("Slots", [slotText, activeText])}
    `;
  }
  renderAmmoDetails(item, slot) {
    const source = this.selectedSource;
    const assignedSlots = item.assignedRocketSlots || [];
    const assignedText = source === "slot" ? `assign\xE9e \xE0 ${slot?.label || "un slot"}` : assignedSlots.length ? assignedSlots.map((index) => `Roquette ${index + 1}`).join(" / ") : "libre";
    this.detailsEl.innerHTML = `
      <div class="station-ammo-drop__details-head">
        <strong>${item.name}</strong>
        <span>${source === "shop" ? `Achat ${formatCredits(item.priceCredits || 0)}` : `Quantit\xE9 ${Math.max(0, item.ammoQuantity | 0)}`}</span>
      </div>
      ${renderItemSections(item, {
      status: `\xC9tat : ${assignedText}${item.active ? " \u2022 actif" : ""}`,
      source: getItemMetaText(item)
    })}
      ${source === "shop" && item.canAfford === false ? renderStationInfoSection("Achat", ["Cr\xE9dits insuffisants"]) : ""}
    `;
  }
  renderDetails() {
    const item = this.getFocusedItem();
    const slot = this.getFocusedSlot();
    if (item) this.renderAmmoDetails(item, slot);
    else this.renderSummaryDetails(slot);
  }
  render() {
    const inventoryScrollTop = this.inventoryEl?.scrollTop || 0;
    const shopScrollTop = this.shopEl?.scrollTop || 0;
    const detailsScrollTop = this.detailsEl?.scrollTop || 0;
    const existingIds = /* @__PURE__ */ new Set([
      ...this.getInventoryItems().map((item) => item.itemId),
      ...this.getShopItems().map((item) => item.itemId),
      ...this.getSlots().map((slot) => slot.item?.itemId).filter(Boolean)
    ]);
    if (this.selectedItemId && !existingIds.has(this.selectedItemId)) this.selectedItemId = "";
    if (this.hoverItemId && !existingIds.has(this.hoverItemId)) this.hoverItemId = "";
    this.renderSlots();
    this.renderInventory();
    this.renderShop();
    this.renderDetails();
    if (this.inventoryEl) this.inventoryEl.scrollTop = inventoryScrollTop;
    if (this.shopEl) this.shopEl.scrollTop = shopScrollTop;
    if (this.detailsEl) this.detailsEl.scrollTop = detailsScrollTop;
  }
  update(equipment, shop, inv, docked) {
    this.equipment = equipment || null;
    this.shop = shop || null;
    this.inv = inv || null;
    this.docked = !!docked;
    this.render();
  }
};

// client/src/ui/station/StationConvertersView.js
function sortConverters(items) {
  return [...items || []].sort((a, b) => {
    const at = a?.tier | 0;
    const bt = b?.tier | 0;
    if (at !== bt) return at - bt;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
}
function buildConverterSlots(converters) {
  const equipped = [...converters?.equipped || []];
  const slotCap = Math.max(0, converters?.slotCap | 0);
  const slots = [];
  for (let i = 0; i < slotCap; i += 1) {
    const item = equipped[i] || null;
    slots.push({ id: `converter-slot-${i}`, label: `Convertisseur ${i + 1}`, index: i, item, active: !!item?.converterEnabled });
  }
  return slots;
}
function formatRuntimeState(item) {
  if (!item?.equipped) return "hors ligne";
  if (!item.converterEnabled) return "coup\xE9";
  const blocked = String(item.converterRuntime?.blockedLabel || "");
  return blocked || "actif";
}
var StationConvertersView = class {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === "function" ? sendCmd : null;
    this.cmdQueue = new StationCommandQueue(this.sendCmd);
    this.equipment = null;
    this.converters = null;
    this.docked = false;
    this.slots = [];
    this.selectedItemId = "";
    this.hoverItemId = "";
    this.selectedSlotId = "";
    this.hoverSlotId = "";
    this.pointerDrag = null;
    this.dragGhostEl = null;
    this.dropSlotId = "";
    this.suppressClickUntil = 0;
    this.el = document.createElement("div");
    this.el.className = "station-converters";
    this.el.innerHTML = `
      <div class="station-converters__frame">
        <section class="station-converters__left">
          <div class="station-converters__panel-head">Actifs</div>
          <div class="station-converters__slots" data-role="slots"></div>
        </section>
        <section class="station-converters__right">
          <div class="station-converters__panel-head">R\xE9serve</div>
          <div class="station-converters__inventory" data-role="inventory"></div>
        </section>
        <section class="station-converters__details" data-role="details"></section>
      </div>
    `;
    this.slotsEl = this.el.querySelector('[data-role="slots"]');
    this.inventoryEl = this.el.querySelector('[data-role="inventory"]');
    this.detailsEl = this.el.querySelector('[data-role="details"]');
    this.el.addEventListener("contextmenu", (ev) => ev.preventDefault());
    this.el.addEventListener("dragstart", (ev) => ev.preventDefault());
    this._boundPointerMove = (ev) => this.onPointerDragMove(ev);
    this._boundPointerUp = (ev) => this.onPointerDragEnd(ev);
    this.el.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      const actionBtn = ev.target?.closest?.("button[data-act]");
      if (actionBtn && this.sendCmd && !actionBtn.disabled) {
        ev.preventDefault();
        ev.stopPropagation();
        this.suppressClickUntil = performance.now() + 250;
        this.runActionButton(actionBtn);
        return;
      }
      const dragNode = ev.target?.closest?.("[data-drag-converter-id]");
      if (dragNode) {
        const itemId = dragNode.dataset.dragConverterId || "";
        if (itemId) {
          this.pointerDrag = {
            itemId,
            sourceSlotId: dragNode.dataset.dragSourceSlotId || "",
            startX: ev.clientX,
            startY: ev.clientY,
            active: false
          };
          window.addEventListener("pointermove", this._boundPointerMove, { passive: false });
          window.addEventListener("pointerup", this._boundPointerUp, { passive: false, once: true });
        }
      }
      const slotNode = ev.target?.closest?.("[data-slot-id]");
      if (slotNode) {
        this.selectedSlotId = slotNode.dataset.slotId || "";
        const slot = this.slots.find((entry) => entry.id === this.selectedSlotId);
        this.selectedItemId = slot?.item?.itemId || "";
        this.render();
        return;
      }
      const itemBtn = ev.target?.closest?.("button[data-item-id]");
      if (itemBtn) {
        this.selectedItemId = itemBtn.dataset.itemId || "";
        this.selectedSlotId = "";
        this.render();
      }
    });
    this.el.addEventListener("dblclick", (ev) => {
      const slotNode = ev.target?.closest?.("[data-slot-id]");
      if (slotNode) {
        this.selectedSlotId = slotNode.dataset.slotId || "";
        const slot = this.slots.find((entry) => entry.id === this.selectedSlotId);
        if (slot?.item?.itemId) this.performPrimaryAction(slot.item.itemId);
        return;
      }
      const itemBtn = ev.target?.closest?.("button[data-item-id]");
      if (itemBtn) this.performPrimaryAction(itemBtn.dataset.itemId || "");
    });
    this.el.addEventListener("click", (ev) => {
      if (performance.now() < this.suppressClickUntil) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      const actionBtn = ev.target?.closest?.("button[data-act]");
      if (!actionBtn || !this.sendCmd || actionBtn.disabled) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.runActionButton(actionBtn);
    });
  }
  runActionButton(actionBtn) {
    if (!actionBtn || !this.sendCmd) return;
    const act = actionBtn.dataset.act;
    const itemId = actionBtn.dataset.itemId || this.getFocusedItem()?.itemId || this.selectedItemId || "";
    if (!itemId) return;
    if (act === "equip") this.cmdQueue.send("equip_item", { itemId });
    if (act === "unequip") this.cmdQueue.send("unequip_item", { itemId });
    if (act === "toggle") {
      const item = this.getItemById(itemId);
      this.cmdQueue.send("toggle_converter", { itemId, enabled: !item?.converterEnabled }, { station: true });
    }
    if (act === "sell") this.cmdQueue.send("sell_item", { itemId });
  }
  getItemById(itemId) {
    if (!itemId) return null;
    return this.getInventoryItems().find((item) => item.itemId === itemId) || this.slots.find((slot) => slot.item?.itemId === itemId)?.item || null;
  }
  startPointerDrag(ev) {
    if (!this.pointerDrag || this.pointerDrag.active) return;
    const item = this.getItemById(this.pointerDrag.itemId);
    this.pointerDrag.active = true;
    this.suppressClickUntil = performance.now() + 250;
    this.el.classList.add("is-dragging-equipment");
    this.dragGhostEl = document.createElement("div");
    this.dragGhostEl.className = "station-equipment__drag-ghost";
    this.dragGhostEl.innerHTML = item ? buildItemIconMarkup(item, { selected: true, compact: true }, "div") : "";
    document.body.appendChild(this.dragGhostEl);
    this.moveDragGhost(ev.clientX, ev.clientY);
  }
  moveDragGhost(x, y) {
    if (!this.dragGhostEl) return;
    this.dragGhostEl.style.transform = `translate(${Math.round(x + 14)}px, ${Math.round(y + 14)}px)`;
  }
  getDropInfoAt(x, y) {
    const oldPointerEvents = this.dragGhostEl?.style.pointerEvents;
    if (this.dragGhostEl) this.dragGhostEl.style.pointerEvents = "none";
    const node = document.elementFromPoint(x, y);
    if (this.dragGhostEl) this.dragGhostEl.style.pointerEvents = oldPointerEvents || "none";
    return {
      slotNode: node?.closest?.("[data-slot-id]") || null,
      inventoryDrop: node?.closest?.('[data-role="inventory"]') || null
    };
  }
  clearDropTarget() {
    this.el.querySelectorAll(".station-converters-slot.is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
    this.dropSlotId = "";
  }
  markDropTarget(slotNode, slotId) {
    if (!slotNode || !slotId) return;
    if (this.dropSlotId === slotId && slotNode.classList.contains("is-drop-target")) return;
    this.clearDropTarget();
    this.dropSlotId = slotId;
    slotNode.classList.add("is-drop-target");
  }
  onPointerDragMove(ev) {
    if (!this.pointerDrag) return;
    const dx = ev.clientX - this.pointerDrag.startX;
    const dy = ev.clientY - this.pointerDrag.startY;
    if (!this.pointerDrag.active && dx * dx + dy * dy >= 36) this.startPointerDrag(ev);
    if (!this.pointerDrag.active) return;
    ev.preventDefault();
    this.moveDragGhost(ev.clientX, ev.clientY);
    const { slotNode, inventoryDrop } = this.getDropInfoAt(ev.clientX, ev.clientY);
    if (inventoryDrop && this.pointerDrag.sourceSlotId) {
      this.clearDropTarget();
      this.el.classList.add("is-inventory-drop-target");
      return;
    }
    this.el.classList.remove("is-inventory-drop-target");
    if (!slotNode) {
      this.clearDropTarget();
      return;
    }
    this.markDropTarget(slotNode, slotNode.dataset.slotId || "");
  }
  onPointerDragEnd(ev) {
    window.removeEventListener("pointermove", this._boundPointerMove);
    const drag = this.pointerDrag;
    this.pointerDrag = null;
    if (!drag) return;
    const wasActive = !!drag.active;
    if (wasActive) {
      ev.preventDefault();
      this.suppressClickUntil = performance.now() + 250;
    }
    this.el.classList.remove("is-dragging-equipment", "is-inventory-drop-target");
    if (this.dragGhostEl) {
      this.dragGhostEl.remove();
      this.dragGhostEl = null;
    }
    const { slotNode, inventoryDrop } = this.getDropInfoAt(ev.clientX, ev.clientY);
    this.clearDropTarget();
    if (!wasActive) return;
    if (inventoryDrop && drag.sourceSlotId) {
      this.cmdQueue.send("unequip_item", { itemId: drag.itemId });
      return;
    }
    if (!slotNode) return;
    const slot = this.slots.find((entry) => entry.id === (slotNode.dataset.slotId || "")) || null;
    if (!slot) return;
    this.cmdQueue.send("equip_item_to_slot", { itemId: drag.itemId, categoryId: ITEM_CATEGORY_IDS.CONVERTER, slotId: slot.id, index: slot.index | 0 });
  }
  getInventoryItems() {
    return sortConverters(this.converters?.inventory || []);
  }
  getFocusedSlot() {
    const slotId = this.selectedSlotId;
    return this.slots.find((entry) => entry.id === slotId) || null;
  }
  getFocusedItem() {
    const itemId = this.selectedItemId;
    if (itemId) return this.getInventoryItems().find((item) => item.itemId === itemId) || this.slots.find((slot) => slot.item?.itemId === itemId)?.item || null;
    return this.getFocusedSlot()?.item || null;
  }
  performPrimaryAction(itemId) {
    if (!itemId || !this.sendCmd) return;
    const item = this.getInventoryItems().find((entry) => entry.itemId === itemId) || this.slots.find((entry) => entry.item?.itemId === itemId)?.item || null;
    if (!item || item.categoryId !== ITEM_CATEGORY_IDS.CONVERTER) return;
    if (item.equipped) this.cmdQueue.send("unequip_item", { itemId });
    else this.cmdQueue.send("equip_item", { itemId });
  }
  renderSlots() {
    this.slotsEl.innerHTML = this.slots.map((slot) => {
      const selected = slot.id === this.selectedSlotId;
      const content = slot.item ? buildItemIconMarkup(slot.item, { selected, compact: true }, "div") : '<span class="station-converters-slot__emptybox"></span>';
      const state = slot.item ? formatRuntimeState(slot.item) : "vide";
      return `
        <div class="station-converters-slot ${selected ? "is-selected" : ""} ${slot.id === this.dropSlotId ? "is-drop-target" : ""} ${slot.active ? "is-active" : ""}" data-slot-id="${slot.id}" ${slot.item ? `data-drag-converter-id="${slot.item.itemId}" data-drag-source-slot-id="${slot.id}"` : ""} title="${slot.label}">
          <span class="station-converters-slot__iconwrap">${content}</span>
          <span class="station-converters-slot__label">${slot.label} \u2022 ${state}</span>
        </div>
      `;
    }).join("");
  }
  renderInventory() {
    const items = this.getInventoryItems();
    this.inventoryEl.innerHTML = items.map((item) => {
      const selected = item.itemId === this.selectedItemId;
      return buildItemIconButton(item, { selected, showName: false, compact: true }).replace("<button", `<button data-drag-converter-id="${item.itemId}" data-drag-source="inventory"`);
    }).join("") || '<div class="station-converters__empty">Aucun convertisseur poss\xE9d\xE9.</div>';
  }
  renderSummaryDetails(slot) {
    const summary = this.converters?.summary || { equippedCount: 0, enabledCount: 0, totalCycles: 0 };
    const active = this.converters?.active || [];
    const slotText = slot ? `${slot.label} : ${slot.item ? slot.item.shortName || slot.item.name : "vide"}${slot.active ? " \u2022 actif" : ""}` : "Survolez un convertisseur.";
    const lines = [
      slotText,
      `\xC9quip\xE9s : ${Math.max(0, summary.equippedCount | 0)}`,
      `Actifs : ${Math.max(0, summary.enabledCount | 0)}`,
      `Cycles : ${Math.max(0, summary.totalCycles | 0)}`
    ];
    if (active.length > 0) {
      lines.push(...active.map((entry) => `${entry.name} \u2022 ${entry.blockedLabel || "actif"} \u2022 ${Math.round((entry.progress01 || 0) * 100)}%`));
    }
    this.detailsEl.innerHTML = renderStationInfoSection("Convertisseurs", lines);
  }
  renderConverterDetails(item) {
    const profile2 = item.converterProfile || {};
    const runtime = item.converterRuntime || { enabled: false, progress: 0, cycles: 0, blockedLabel: "coup\xE9" };
    const seconds = Math.max(0.1, profile2.seconds || 1);
    const progressPct = Math.round(Math.max(0, Math.min(1, Number(runtime.progress || 0) / seconds)) * 100);
    const runtimeState = formatRuntimeState(item);
    const meta = `T${Math.max(1, item.tier | 0)}${item.equipped ? " \u2022 \xE9quip\xE9" : ""} \u2022 ${runtimeState}`;
    const actions = item.equipped ? `
        <button class="ui-btn" type="button" data-act="toggle" data-item-id="${item.itemId}" ${this.docked ? "" : "disabled"}>${item.converterEnabled ? "Couper" : "Relancer"}</button>
        <button class="ui-btn ui-btn--ghost" type="button" data-act="unequip" data-item-id="${item.itemId}" ${this.docked ? "" : "disabled"}>Retirer</button>
      ` : `
        <button class="ui-btn" type="button" data-act="equip" data-item-id="${item.itemId}" ${this.docked ? "" : "disabled"}>\xC9quiper</button>
        <button class="ui-btn ui-btn--ghost" type="button" data-act="sell" data-item-id="${item.itemId}" ${this.docked ? "" : "disabled"}>Vendre</button>
      `;
    this.detailsEl.innerHTML = `
      <div class="station-converters__details-headline">
        <span class="station-converters__details-name">${item.name}</span>
        <span class="station-converters__details-price">Revente ${formatCredits(item.sellPriceCredits || 0)}</span>
      </div>
      ${renderItemSections(item, {
      status: `Runtime : ${runtimeState} \u2022 ${progressPct}% \u2022 cycles ${Math.max(0, runtime.cycles | 0)}`,
      source: meta
    })}
      ${renderStationInfoSection("Cycle", [`${Math.max(1, profile2.inputAmount | 0)} ${profile2.inputKey || "?"} \u2192 ${Math.max(1, profile2.outputAmount | 0)} ${profile2.outputKey || "?"}`, `${seconds.toFixed(1)}s`, `${Number(profile2.energyPerSecond || 0).toFixed(2)} \xE9nergie/s`])}
      <div class="station-converters__details-actions">${actions}</div>
    `;
  }
  renderDetails() {
    const item = this.getFocusedItem();
    const slot = this.getFocusedSlot();
    if (!item) {
      this.renderSummaryDetails(slot);
      return;
    }
    this.renderConverterDetails(item);
  }
  render() {
    this.slots = buildConverterSlots(this.converters);
    const inventoryIds = new Set(this.getInventoryItems().map((item) => item.itemId));
    const slotIds = new Set(this.slots.map((slot) => slot.item?.itemId).filter(Boolean));
    if (this.selectedItemId && !inventoryIds.has(this.selectedItemId) && !slotIds.has(this.selectedItemId)) this.selectedItemId = "";
    this.renderSlots();
    this.renderInventory();
    this.renderDetails();
  }
  update(equipment, docked) {
    this.equipment = equipment || null;
    this.converters = equipment?.converters || null;
    this.docked = !!docked;
    this.render();
  }
};

// shared/content/crafting/RefineryRecipes.js
var REFINERY_RECIPES = [
  {
    id: "iron_to_steel_plate",
    name: "Acier",
    category: "M\xE9tallurgie",
    station: "Raffinerie simple",
    seconds: 3.5,
    input: { ironOre: 8 },
    output: { steelPlate: 1 },
    description: "R\xE9duit et compacte le minerai de fer en plaque d\u2019acier utilisable pour murs, machines et tourelles."
  },
  {
    id: "copper_to_wire",
    name: "Fil de cuivre",
    category: "\xC9lectronique",
    station: "Atelier basique",
    seconds: 2.2,
    input: { copper: 3 },
    output: { copperWire: 2 },
    description: "\xC9tire le cuivre en conducteurs pour circuits, moteurs et panneaux solaires."
  },
  {
    id: "silicon_to_wafer",
    name: "Wafer de silicium",
    category: "\xC9lectronique",
    station: "Atelier basique",
    seconds: 4,
    input: { silicon: 6 },
    output: { siliconWafer: 1 },
    description: "Purifie et d\xE9coupe le silicium en wafer pour microtransistors."
  },
  {
    id: "wafer_to_microtransistor",
    name: "Microtransistor",
    category: "\xC9lectronique avanc\xE9e",
    station: "Atelier \xE9lectronique",
    seconds: 6,
    input: { siliconWafer: 2, copperWire: 2 },
    output: { microTransistor: 1 },
    description: "Assemble des transistors miniaturis\xE9s, premi\xE8re brique des circuits de contr\xF4le."
  },
  {
    id: "microtransistor_to_printed_circuit",
    name: "Circuit imprim\xE9",
    category: "\xC9lectronique avanc\xE9e",
    station: "Atelier \xE9lectronique",
    seconds: 7,
    input: { microTransistor: 2, copperWire: 2 },
    output: { printedCircuit: 1 },
    description: "Produit un circuit imprim\xE9 g\xE9n\xE9rique pour machines, radars et modules."
  },
  {
    id: "printed_circuit_to_control_circuit",
    name: "Circuit de contr\xF4le",
    category: "\xC9lectronique avanc\xE9e",
    station: "Atelier \xE9lectronique",
    seconds: 9,
    input: { printedCircuit: 2, rareEarthOre: 1 },
    output: { controlCircuit: 1 },
    description: "Ajoute composants de contr\xF4le et aimants \xE0 terres rares pour piloter machines et tourelles."
  },
  {
    id: "quartz_to_optical_glass",
    name: "Verre optique",
    category: "Optique",
    station: "Raffinerie min\xE9rale",
    seconds: 4.5,
    input: { quartz: 5 },
    output: { opticalGlass: 1 },
    description: "Fond et purifie le quartz en verre optique pour capteurs, lasers et panneaux solaires."
  },
  {
    id: "optical_glass_to_laser_lens",
    name: "Lentille laser",
    category: "Optique",
    station: "Raffinerie min\xE9rale",
    seconds: 6.5,
    input: { opticalGlass: 2, berylliumOre: 1 },
    output: { laserLens: 1 },
    description: "Taille une lentille r\xE9sistante \xE0 la chaleur pour futurs \xE9metteurs laser."
  },
  {
    id: "lithium_to_battery",
    name: "Batterie lithium-ion",
    category: "\xC9nergie",
    station: "Atelier \xE9nerg\xE9tique",
    seconds: 5.5,
    input: { lithiumOre: 4, graphite: 2, copperWire: 1 },
    output: { lithiumBattery: 1 },
    description: "Assemble une batterie rechargeable pour bases, drones et modules."
  },
  {
    id: "hydrocarbons_to_refined_fuel",
    name: "Carburant raffin\xE9",
    category: "Carburants",
    station: "Raffinerie chimique",
    seconds: 5,
    input: { hydrocarbons: 6 },
    output: { refinedFuel: 2 },
    description: "Raffine des hydrocarbures en carburant stable pour g\xE9n\xE9rateurs thermiques."
  },
  {
    id: "methane_to_propellant",
    name: "Propergol",
    category: "Carburants",
    station: "Raffinerie chimique",
    seconds: 4,
    input: { methaneIce: 5, ammoniaIce: 2 },
    output: { propellant: 1 },
    description: "Pr\xE9pare un propergol simple pour propulsion et munitions futures."
  },
  {
    id: "biomass_to_biofuel",
    name: "Biocarburant",
    category: "Biologie",
    station: "Bio-incubateur",
    seconds: 4.5,
    input: { biomass: 8, organicLipids: 2 },
    output: { biofuel: 2 },
    description: "Transforme biomasse et lipides organiques en carburant biologique."
  },
  {
    id: "uranium_to_fuel_rod",
    name: "Barre de combustible",
    category: "Nucl\xE9aire",
    station: "Stabilisateur nucl\xE9aire",
    seconds: 10,
    input: { uraniumOre: 5, thermalCeramic: 1 },
    output: { fuelRod: 1 },
    description: "Pr\xE9pare une barre de combustible pour r\xE9acteurs avanc\xE9s."
  },
  {
    id: "carbon_to_carbon_fiber",
    name: "Fibre de carbone",
    category: "Composites",
    station: "Four industriel",
    seconds: 5,
    input: { graphite: 4 },
    output: { carbonFiber: 1 },
    description: "Transforme le graphite en fibres l\xE9g\xE8res pour blindages et structures."
  },
  {
    id: "armor_composite_basic",
    name: "Blindage composite",
    category: "Composites",
    station: "Assembleur m\xE9canique",
    seconds: 8,
    input: { steelPlate: 2, titaniumOre: 2, carbonFiber: 1 },
    output: { compositeArmor: 1 },
    description: "Combine acier, titane et fibre de carbone en blindage de structure."
  }
];
var REFINERY_RECIPE_BY_ID = Object.fromEntries(REFINERY_RECIPES.map((recipe) => [recipe.id, recipe]));

// shared/content/resources/ResourceDefs.js
var ACTIVE_RESOURCE_KEYS_ORDER = [
  "scrap",
  "ironOre",
  "copper",
  "nickelOre",
  "titaniumOre",
  "aluminiumOre",
  "cobaltOre",
  "silicon",
  "quartz",
  "graphite",
  "lithiumOre",
  "boronOre",
  "berylliumOre",
  "rareEarthOre",
  "waterIce",
  "hydrogenIce",
  "methaneIce",
  "ammoniaIce",
  "hydrocarbons",
  "sulfur",
  "uraniumOre",
  "thoriumOre",
  "unstableIsotopes",
  "leadOre",
  "biomass",
  "chitin",
  "organicLipids",
  "enzymes",
  "proteinFibers",
  "spores",
  "containedAntimatter",
  "strangeMatter",
  "unknownTechFragment",
  "ancientSuperconductor",
  "precursorNanomaterial",
  "steelPlate",
  "copperWire",
  "siliconWafer",
  "microTransistor",
  "printedCircuit",
  "controlCircuit",
  "microprocessor",
  "opticalGlass",
  "laserLens",
  "lithiumBattery",
  "fuelCell",
  "refinedFuel",
  "biofuel",
  "propellant",
  "turbine",
  "industrialPump",
  "electricMotor",
  "servomotor",
  "fuelInjector",
  "fuelRod",
  "thermalCeramic",
  "carbonFiber",
  "compositeArmor"
];
var LEGACY_RESOURCE_KEYS_ORDER = [
  "ice",
  "uranite",
  "plasmaGel",
  "crystal",
  "bioFiber",
  "darkMatter",
  "nanoDust",
  "alloy",
  "circuit",
  "core",
  "flux",
  "antimatter",
  "relic",
  "ironVein",
  "nickelShard",
  "vanadiumGlass",
  "heliumIce",
  "sulfurStone",
  "carbonMesh",
  "quartzBloom",
  "lithiumSalt",
  "palladiumDust",
  "neodymCluster",
  "osmiumSpine",
  "iridiumPearl",
  "xenonPearl",
  "voidAmber",
  "phaseQuartz",
  "echoResin",
  "stellarAsh",
  "gravitonFilament",
  "chronoShard",
  "prismTear",
  "singularitySeed",
  "aetherFoam",
  "nullGlass",
  "basaltChunk",
  "manganeseNodule",
  "boronFlake",
  "phosphorite",
  "sodiumClathrate",
  "argonIce",
  "ceresClay",
  "grapheneVeil",
  "tungstenOre",
  "rutileShard",
  "galliumBloom",
  "seleniumThread",
  "hafniumPlate",
  "rutheniumDust",
  "telluricGlass",
  "mercuryIce",
  "cesiumSalt",
  "lanthanumKnot",
  "yttriumPrism",
  "zirconCore",
  "quasarPollen",
  "eventidePearl",
  "vacuumLotus",
  "entropySpore",
  "lumenMoss",
  "magnetarSkin"
];
var RESOURCE_KEYS_ORDER = [...ACTIVE_RESOURCE_KEYS_ORDER, ...LEGACY_RESOURCE_KEYS_ORDER];
var RESOURCE_DEFS = {
  "scrap": {
    "name": "Ferraille",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#b8bdc4",
    "rarity": 1,
    "baseWeight": 1,
    "spawnTier": 1,
    "shapeClass": "Junk",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": true,
    "id": "Scrap"
  },
  "ironOre": {
    "name": "Minerai de fer",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#9c8f86",
    "rarity": 1,
    "baseWeight": 1.45,
    "spawnTier": 1,
    "shapeClass": "Rock",
    "hardnessMultiplier": 0.96,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": true,
    "id": "IronOre"
  },
  "copper": {
    "name": "Cuivre",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#cd853f",
    "rarity": 1,
    "baseWeight": 1.25,
    "spawnTier": 1,
    "shapeClass": "Rock",
    "hardnessMultiplier": 0.92,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": true,
    "id": "Copper"
  },
  "nickelOre": {
    "name": "Minerai de nickel",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#d8d8c8",
    "rarity": 2,
    "baseWeight": 1,
    "spawnTier": 2,
    "shapeClass": "Rock",
    "hardnessMultiplier": 1.03,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": true,
    "id": "NickelOre"
  },
  "titaniumOre": {
    "name": "Minerai de titane",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#b7c7d9",
    "rarity": 3,
    "baseWeight": 0.72,
    "spawnTier": 4,
    "shapeClass": "Rock",
    "hardnessMultiplier": 1.13,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "TitaniumOre"
  },
  "aluminiumOre": {
    "name": "Bauxite",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#c28b65",
    "rarity": 1,
    "baseWeight": 1.05,
    "spawnTier": 1,
    "shapeClass": "Rock",
    "hardnessMultiplier": 0.95,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "AluminiumOre"
  },
  "cobaltOre": {
    "name": "Minerai de cobalt",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#4169e1",
    "rarity": 2,
    "baseWeight": 0.86,
    "spawnTier": 2,
    "shapeClass": "Rock",
    "hardnessMultiplier": 1.05,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": true,
    "id": "CobaltOre"
  },
  "silicon": {
    "name": "Silicium",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#d3d3d3",
    "rarity": 1,
    "baseWeight": 1.15,
    "spawnTier": 1,
    "shapeClass": "Rock",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": true,
    "id": "Silicon"
  },
  "quartz": {
    "name": "Quartz",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#e7d7ff",
    "rarity": 2,
    "baseWeight": 1.05,
    "spawnTier": 2,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.08,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Quartz"
  },
  "graphite": {
    "name": "Graphite",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#4d4d4d",
    "rarity": 1,
    "baseWeight": 0.98,
    "spawnTier": 1,
    "shapeClass": "Rock",
    "hardnessMultiplier": 0.9,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": true,
    "id": "Graphite"
  },
  "lithiumOre": {
    "name": "Minerai de lithium",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#ffb6c1",
    "rarity": 2,
    "baseWeight": 0.92,
    "spawnTier": 2,
    "shapeClass": "Dust",
    "hardnessMultiplier": 0.9,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "LithiumOre"
  },
  "boronOre": {
    "name": "Minerai de bore",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#d7c39a",
    "rarity": 2,
    "baseWeight": 0.8,
    "spawnTier": 2,
    "shapeClass": "Dust",
    "hardnessMultiplier": 1.02,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "BoronOre"
  },
  "berylliumOre": {
    "name": "Minerai de b\xE9ryllium",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#98e0c6",
    "rarity": 3,
    "baseWeight": 0.58,
    "spawnTier": 4,
    "shapeClass": "Rock",
    "hardnessMultiplier": 1.12,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "BerylliumOre"
  },
  "rareEarthOre": {
    "name": "Terres rares",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#48d1cc",
    "rarity": 4,
    "baseWeight": 0.5,
    "spawnTier": 5,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.12,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "RareearthOre"
  },
  "waterIce": {
    "name": "Glace d'eau",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#add8e6",
    "rarity": 1,
    "baseWeight": 1.2,
    "spawnTier": 1,
    "shapeClass": "Ice",
    "hardnessMultiplier": 0.82,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": true,
    "id": "Waterice"
  },
  "hydrogenIce": {
    "name": "Hydrog\xE8ne solide",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#e9fbff",
    "rarity": 2,
    "baseWeight": 0.86,
    "spawnTier": 2,
    "shapeClass": "Ice",
    "hardnessMultiplier": 0.8,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Hydrogenice"
  },
  "methaneIce": {
    "name": "M\xE9thane solide",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#bcecff",
    "rarity": 2,
    "baseWeight": 0.9,
    "spawnTier": 2,
    "shapeClass": "Ice",
    "hardnessMultiplier": 0.82,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Methaneice"
  },
  "ammoniaIce": {
    "name": "Ammoniac gel\xE9",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#d1f0ff",
    "rarity": 2,
    "baseWeight": 0.82,
    "spawnTier": 2,
    "shapeClass": "Ice",
    "hardnessMultiplier": 0.84,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Ammoniaice"
  },
  "hydrocarbons": {
    "name": "Hydrocarbures",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#5c4635",
    "rarity": 2,
    "baseWeight": 0.9,
    "spawnTier": 3,
    "shapeClass": "Dust",
    "hardnessMultiplier": 0.9,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Hydrocarbons"
  },
  "sulfur": {
    "name": "Soufre",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#ffe44d",
    "rarity": 1,
    "baseWeight": 1,
    "spawnTier": 1,
    "shapeClass": "Rock",
    "hardnessMultiplier": 0.9,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": true,
    "id": "Sulfur"
  },
  "uraniumOre": {
    "name": "Minerai d\u2019uranium",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#9dff38",
    "rarity": 4,
    "baseWeight": 0.55,
    "spawnTier": 6,
    "shapeClass": "Rock",
    "hardnessMultiplier": 1.14,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "UraniumOre"
  },
  "thoriumOre": {
    "name": "Minerai de thorium",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#7ef0b3",
    "rarity": 4,
    "baseWeight": 0.5,
    "spawnTier": 6,
    "shapeClass": "Rock",
    "hardnessMultiplier": 1.16,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "ThoriumOre"
  },
  "unstableIsotopes": {
    "name": "Isotopes instables",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#c9ff65",
    "rarity": 5,
    "baseWeight": 0.32,
    "spawnTier": 8,
    "shapeClass": "Exotic",
    "hardnessMultiplier": 1.2,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Unstableisotopes"
  },
  "leadOre": {
    "name": "Minerai de plomb",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#7c8491",
    "rarity": 2,
    "baseWeight": 0.72,
    "spawnTier": 3,
    "shapeClass": "Rock",
    "hardnessMultiplier": 1.07,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "LeadOre"
  },
  "biomass": {
    "name": "Biomasse",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#80d060",
    "rarity": 1,
    "baseWeight": 1.3,
    "spawnTier": 1,
    "shapeClass": "Biomass",
    "hardnessMultiplier": 0.8,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": true,
    "id": "Biomass"
  },
  "chitin": {
    "name": "Chitine",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#d8c596",
    "rarity": 2,
    "baseWeight": 0.9,
    "spawnTier": 2,
    "shapeClass": "Biomass",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": true,
    "id": "Chitin"
  },
  "organicLipids": {
    "name": "Lipides organiques",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#b6d46a",
    "rarity": 2,
    "baseWeight": 0.88,
    "spawnTier": 2,
    "shapeClass": "Biomass",
    "hardnessMultiplier": 0.85,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": true,
    "id": "Organiclipids"
  },
  "enzymes": {
    "name": "Enzymes",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#65d9a0",
    "rarity": 3,
    "baseWeight": 0.62,
    "spawnTier": 3,
    "shapeClass": "Biomass",
    "hardnessMultiplier": 0.82,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": true,
    "id": "Enzymes"
  },
  "proteinFibers": {
    "name": "Fibres prot\xE9iques",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#a0e0b6",
    "rarity": 2,
    "baseWeight": 0.9,
    "spawnTier": 2,
    "shapeClass": "Biomass",
    "hardnessMultiplier": 0.88,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": true,
    "id": "Proteinfibers"
  },
  "spores": {
    "name": "Spores",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#b0f080",
    "rarity": 2,
    "baseWeight": 0.92,
    "spawnTier": 2,
    "shapeClass": "Biomass",
    "hardnessMultiplier": 0.78,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": true,
    "id": "Spores"
  },
  "containedAntimatter": {
    "name": "Antimati\xE8re confin\xE9e",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#f5f5f5",
    "rarity": 6,
    "baseWeight": 0.14,
    "spawnTier": 10,
    "shapeClass": "Exotic",
    "hardnessMultiplier": 1.26,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Containedantimatter"
  },
  "strangeMatter": {
    "name": "Mati\xE8re \xE9trange",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#b58cff",
    "rarity": 7,
    "baseWeight": 0.08,
    "spawnTier": 12,
    "shapeClass": "Exotic",
    "hardnessMultiplier": 1.4,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Strangematter"
  },
  "unknownTechFragment": {
    "name": "Fragment de technologie inconnue",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#c7a0ff",
    "rarity": 5,
    "baseWeight": 0.24,
    "spawnTier": 9,
    "shapeClass": "Exotic",
    "hardnessMultiplier": 1.16,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Unknowntechfragment"
  },
  "ancientSuperconductor": {
    "name": "Alliage supraconducteur ancien",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#aeefff",
    "rarity": 5,
    "baseWeight": 0.22,
    "spawnTier": 9,
    "shapeClass": "Exotic",
    "hardnessMultiplier": 1.18,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Ancientsuperconductor"
  },
  "precursorNanomaterial": {
    "name": "Nanomat\xE9riau pr\xE9curseur",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#e0e0ff",
    "rarity": 6,
    "baseWeight": 0.16,
    "spawnTier": 10,
    "shapeClass": "Exotic",
    "hardnessMultiplier": 1.22,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Precursornanomaterial"
  },
  "steelPlate": {
    "name": "Plaque d\u2019acier",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#aab0b8",
    "rarity": 2,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Steelplate"
  },
  "copperWire": {
    "name": "Fil de cuivre",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#d58b58",
    "rarity": 2,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Copperwire"
  },
  "siliconWafer": {
    "name": "Wafer de silicium",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#cfd4da",
    "rarity": 2,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Siliconwafer"
  },
  "microTransistor": {
    "name": "Microtransistor",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#5ee37d",
    "rarity": 3,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Microtransistor"
  },
  "printedCircuit": {
    "name": "Circuit imprim\xE9",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#00cc66",
    "rarity": 3,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Printedcircuit"
  },
  "controlCircuit": {
    "name": "Circuit de contr\xF4le",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#33ee88",
    "rarity": 4,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Controlcircuit"
  },
  "microprocessor": {
    "name": "Microprocesseur",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#4cffb0",
    "rarity": 4,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Microprocessor"
  },
  "opticalGlass": {
    "name": "Verre optique",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#d8f4ff",
    "rarity": 2,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Opticalglass"
  },
  "laserLens": {
    "name": "Lentille laser",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#f0e0ff",
    "rarity": 3,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Laserlens"
  },
  "lithiumBattery": {
    "name": "Batterie lithium-ion",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#ff8fb3",
    "rarity": 3,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Lithiumbattery"
  },
  "fuelCell": {
    "name": "Cellule \xE0 combustible",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#8ee8ff",
    "rarity": 3,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Fuelcell"
  },
  "refinedFuel": {
    "name": "Carburant raffin\xE9",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#c08442",
    "rarity": 2,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Refinedfuel"
  },
  "biofuel": {
    "name": "Biocarburant",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#78d45a",
    "rarity": 2,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Biofuel"
  },
  "propellant": {
    "name": "Propergol",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#9edfff",
    "rarity": 3,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Propellant"
  },
  "turbine": {
    "name": "Turbine",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#b7bdc8",
    "rarity": 3,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Turbine"
  },
  "industrialPump": {
    "name": "Pompe industrielle",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#9aa4af",
    "rarity": 3,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Industrialpump"
  },
  "electricMotor": {
    "name": "Moteur \xE9lectrique",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#9cc0e0",
    "rarity": 3,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Electricmotor"
  },
  "servomotor": {
    "name": "Servomoteur",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#a0bad0",
    "rarity": 3,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Servomotor"
  },
  "fuelInjector": {
    "name": "Injecteur de carburant",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#d0a36c",
    "rarity": 3,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Fuelinjector"
  },
  "fuelRod": {
    "name": "Barre de combustible",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#b6ff5c",
    "rarity": 4,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Fuelrod"
  },
  "thermalCeramic": {
    "name": "C\xE9ramique thermique",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#d8cdb0",
    "rarity": 3,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Thermalceramic"
  },
  "carbonFiber": {
    "name": "Fibre de carbone",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#555a60",
    "rarity": 3,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Carbonfiber"
  },
  "compositeArmor": {
    "name": "Blindage composite",
    "cargoPerUnit": 1,
    "sellPrice": 0,
    "colorHex": "#78808a",
    "rarity": 4,
    "baseWeight": 0,
    "spawnTier": 0,
    "shapeClass": "Component",
    "hardnessMultiplier": 1,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Compositearmor"
  },
  "ice": {
    "name": "Glace d'eau",
    "cargoPerUnit": 1,
    "sellPrice": 4,
    "colorHex": "#add8e6",
    "rarity": 1,
    "baseWeight": 1.45,
    "spawnTier": 1,
    "shapeClass": "Ice",
    "hardnessMultiplier": 0.82,
    "armorBias": -0.6,
    "resistBias": -0.06,
    "enemyCommonDrop": true,
    "id": "Ice",
    "legacy": true
  },
  "uranite": {
    "name": "Uraninite",
    "cargoPerUnit": 1,
    "sellPrice": 24,
    "colorHex": "#adff2f",
    "rarity": 4,
    "baseWeight": 0.8,
    "spawnTier": 6,
    "shapeClass": "Rock",
    "hardnessMultiplier": 1.12,
    "armorBias": 0.45,
    "resistBias": 0.04,
    "enemyCommonDrop": false,
    "id": "Uranite",
    "legacy": true
  },
  "plasmaGel": {
    "name": "Hydrog\xE8ne liquide",
    "cargoPerUnit": 1,
    "sellPrice": 15,
    "colorHex": "#00bfff",
    "rarity": 3,
    "baseWeight": 0.95,
    "spawnTier": 4,
    "shapeClass": "Exotic",
    "hardnessMultiplier": 0.95,
    "armorBias": 0,
    "resistBias": 0.03,
    "enemyCommonDrop": true,
    "id": "PlasmaGel",
    "legacy": true
  },
  "crystal": {
    "name": "Quartz",
    "cargoPerUnit": 1,
    "sellPrice": 12,
    "colorHex": "#ee82ee",
    "rarity": 3,
    "baseWeight": 1,
    "spawnTier": 4,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.16,
    "armorBias": 0.35,
    "resistBias": 0.05,
    "enemyCommonDrop": true,
    "id": "Crystal",
    "legacy": true
  },
  "bioFiber": {
    "name": "Cellulose",
    "cargoPerUnit": 1,
    "sellPrice": 20,
    "colorHex": "#90ee90",
    "rarity": 3,
    "baseWeight": 0.9,
    "spawnTier": 5,
    "shapeClass": "Biomass",
    "hardnessMultiplier": 0.94,
    "armorBias": 0,
    "resistBias": 0.02,
    "enemyCommonDrop": false,
    "id": "BioFiber",
    "legacy": true
  },
  "darkMatter": {
    "name": "Ilm\xE9nite",
    "cargoPerUnit": 1,
    "sellPrice": 71,
    "colorHex": "#9370db",
    "rarity": 5,
    "baseWeight": 0.48,
    "spawnTier": 9,
    "shapeClass": "Exotic",
    "hardnessMultiplier": 1.18,
    "armorBias": 0.55,
    "resistBias": 0.08,
    "enemyCommonDrop": false,
    "id": "DarkMatter",
    "legacy": true
  },
  "nanoDust": {
    "name": "Silice fine",
    "cargoPerUnit": 1,
    "sellPrice": 18,
    "colorHex": "#f0e68c",
    "rarity": 2,
    "baseWeight": 1.2,
    "spawnTier": 2,
    "shapeClass": "Dust",
    "hardnessMultiplier": 0.95,
    "armorBias": -0.1,
    "resistBias": 0,
    "enemyCommonDrop": true,
    "id": "NanoDust",
    "legacy": true
  },
  "alloy": {
    "name": "Acier alli\xE9",
    "cargoPerUnit": 1,
    "sellPrice": 53,
    "colorHex": "#708090",
    "rarity": 4,
    "baseWeight": 0.65,
    "spawnTier": 7,
    "shapeClass": "Junk",
    "hardnessMultiplier": 1.08,
    "armorBias": 0.45,
    "resistBias": 0.04,
    "enemyCommonDrop": false,
    "id": "Alloy",
    "legacy": true
  },
  "circuit": {
    "name": "Circuit imprim\xE9",
    "cargoPerUnit": 1,
    "sellPrice": 53,
    "colorHex": "#00ff00",
    "rarity": 4,
    "baseWeight": 0.65,
    "spawnTier": 7,
    "shapeClass": "Junk",
    "hardnessMultiplier": 1.02,
    "armorBias": 0.15,
    "resistBias": 0.04,
    "enemyCommonDrop": false,
    "id": "Circuit",
    "legacy": true
  },
  "core": {
    "name": "Barre de combustible",
    "cargoPerUnit": 1,
    "sellPrice": 88,
    "colorHex": "#ffa500",
    "rarity": 6,
    "baseWeight": 0.33,
    "spawnTier": 10,
    "shapeClass": "Exotic",
    "hardnessMultiplier": 1.25,
    "armorBias": 0.8,
    "resistBias": 0.1,
    "enemyCommonDrop": false,
    "id": "Core",
    "legacy": true
  },
  "flux": {
    "name": "Fondant borat\xE9",
    "cargoPerUnit": 1,
    "sellPrice": 22,
    "colorHex": "#ff69b4",
    "rarity": 4,
    "baseWeight": 0.9,
    "spawnTier": 6,
    "shapeClass": "Exotic",
    "hardnessMultiplier": 1,
    "armorBias": 0.1,
    "resistBias": 0.05,
    "enemyCommonDrop": true,
    "id": "Flux",
    "legacy": true
  },
  "antimatter": {
    "name": "Antimati\xE8re",
    "cargoPerUnit": 1,
    "sellPrice": 88,
    "colorHex": "#f5f5f5",
    "rarity": 6,
    "baseWeight": 0.35,
    "spawnTier": 10,
    "shapeClass": "Exotic",
    "hardnessMultiplier": 1.22,
    "armorBias": 0.7,
    "resistBias": 0.1,
    "enemyCommonDrop": false,
    "id": "Antimatter",
    "legacy": true
  },
  "relic": {
    "name": "Or natif",
    "cargoPerUnit": 1,
    "sellPrice": 119,
    "colorHex": "#ffd700",
    "rarity": 7,
    "baseWeight": 0.08,
    "spawnTier": 15,
    "shapeClass": "Exotic",
    "hardnessMultiplier": 1.5,
    "armorBias": 1.2,
    "resistBias": 0.15,
    "enemyCommonDrop": false,
    "id": "Relic",
    "legacy": true
  },
  "ironVein": {
    "name": "H\xE9matite",
    "cargoPerUnit": 1,
    "sellPrice": 11,
    "colorHex": "#a9a9a9",
    "rarity": 1,
    "baseWeight": 1.2,
    "spawnTier": 1,
    "shapeClass": "Rock",
    "hardnessMultiplier": 0.96,
    "armorBias": 0.2,
    "resistBias": 0,
    "enemyCommonDrop": true,
    "id": "IronVein",
    "legacy": true
  },
  "nickelShard": {
    "name": "Minerai de nickel",
    "cargoPerUnit": 1,
    "sellPrice": 20,
    "colorHex": "#dcdcdc",
    "rarity": 2,
    "baseWeight": 1.05,
    "spawnTier": 2,
    "shapeClass": "Rock",
    "hardnessMultiplier": 1.02,
    "armorBias": 0.2,
    "resistBias": 0.01,
    "enemyCommonDrop": true,
    "id": "NickelShard",
    "legacy": true
  },
  "vanadiumGlass": {
    "name": "Vanadinite",
    "cargoPerUnit": 1,
    "sellPrice": 37,
    "colorHex": "#008080",
    "rarity": 3,
    "baseWeight": 0.85,
    "spawnTier": 5,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.14,
    "armorBias": 0.4,
    "resistBias": 0.05,
    "enemyCommonDrop": false,
    "id": "VanadiumGlass",
    "legacy": true
  },
  "heliumIce": {
    "name": "Glace d'h\xE9lium-3",
    "cargoPerUnit": 1,
    "sellPrice": 23,
    "colorHex": "#f0f8ff",
    "rarity": 2,
    "baseWeight": 1,
    "spawnTier": 3,
    "shapeClass": "Ice",
    "hardnessMultiplier": 0.83,
    "armorBias": -0.55,
    "resistBias": -0.06,
    "enemyCommonDrop": false,
    "id": "HeliumIce",
    "legacy": true
  },
  "sulfurStone": {
    "name": "Soufre natif",
    "cargoPerUnit": 1,
    "sellPrice": 11,
    "colorHex": "#ffff00",
    "rarity": 1,
    "baseWeight": 1.15,
    "spawnTier": 1,
    "shapeClass": "Rock",
    "hardnessMultiplier": 0.9,
    "armorBias": 0,
    "resistBias": -0.01,
    "enemyCommonDrop": true,
    "id": "SulfurStone",
    "legacy": true
  },
  "carbonMesh": {
    "name": "Fibre de carbone",
    "cargoPerUnit": 1,
    "sellPrice": 34,
    "colorHex": "#696969",
    "rarity": 3,
    "baseWeight": 0.95,
    "spawnTier": 4,
    "shapeClass": "Junk",
    "hardnessMultiplier": 1.03,
    "armorBias": 0.2,
    "resistBias": 0.02,
    "enemyCommonDrop": true,
    "id": "CarbonMesh",
    "legacy": true
  },
  "quartzBloom": {
    "name": "Quartz rose",
    "cargoPerUnit": 1,
    "sellPrice": 23,
    "colorHex": "#dda0dd",
    "rarity": 2,
    "baseWeight": 0.95,
    "spawnTier": 3,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.08,
    "armorBias": 0.3,
    "resistBias": 0.04,
    "enemyCommonDrop": false,
    "id": "QuartzBloom",
    "legacy": true
  },
  "lithiumSalt": {
    "name": "Carbonate de lithium",
    "cargoPerUnit": 1,
    "sellPrice": 23,
    "colorHex": "#ffb6c1",
    "rarity": 2,
    "baseWeight": 1,
    "spawnTier": 3,
    "shapeClass": "Dust",
    "hardnessMultiplier": 0.92,
    "armorBias": 0,
    "resistBias": 0.01,
    "enemyCommonDrop": true,
    "id": "LithiumSalt",
    "legacy": true
  },
  "palladiumDust": {
    "name": "Palladium",
    "cargoPerUnit": 1,
    "sellPrice": 50,
    "colorHex": "#eee8aa",
    "rarity": 4,
    "baseWeight": 0.8,
    "spawnTier": 6,
    "shapeClass": "Dust",
    "hardnessMultiplier": 1.05,
    "armorBias": 0.25,
    "resistBias": 0.03,
    "enemyCommonDrop": false,
    "id": "PalladiumDust",
    "legacy": true
  },
  "neodymCluster": {
    "name": "Bastn\xE4site",
    "cargoPerUnit": 1,
    "sellPrice": 50,
    "colorHex": "#48d1cc",
    "rarity": 4,
    "baseWeight": 0.75,
    "spawnTier": 6,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.08,
    "armorBias": 0.25,
    "resistBias": 0.04,
    "enemyCommonDrop": false,
    "id": "NeodymCluster",
    "legacy": true
  },
  "osmiumSpine": {
    "name": "Osmium",
    "cargoPerUnit": 1,
    "sellPrice": 53,
    "colorHex": "#6a5acd",
    "rarity": 4,
    "baseWeight": 0.65,
    "spawnTier": 7,
    "shapeClass": "Rock",
    "hardnessMultiplier": 1.2,
    "armorBias": 0.9,
    "resistBias": 0.05,
    "enemyCommonDrop": false,
    "id": "OsmiumSpine",
    "legacy": true
  },
  "iridiumPearl": {
    "name": "Iridium",
    "cargoPerUnit": 1,
    "sellPrice": 68,
    "colorHex": "#e6e6fa",
    "rarity": 5,
    "baseWeight": 0.5,
    "spawnTier": 8,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.24,
    "armorBias": 0.95,
    "resistBias": 0.06,
    "enemyCommonDrop": false,
    "id": "IridiumPearl",
    "legacy": true
  },
  "xenonPearl": {
    "name": "X\xE9non solide",
    "cargoPerUnit": 1,
    "sellPrice": 53,
    "colorHex": "#e0ffff",
    "rarity": 4,
    "baseWeight": 0.65,
    "spawnTier": 7,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.06,
    "armorBias": 0.3,
    "resistBias": 0.05,
    "enemyCommonDrop": false,
    "id": "XenonPearl",
    "legacy": true
  },
  "voidAmber": {
    "name": "Ambre",
    "cargoPerUnit": 1,
    "sellPrice": 68,
    "colorHex": "#ff8c00",
    "rarity": 5,
    "baseWeight": 0.58,
    "spawnTier": 8,
    "shapeClass": "Exotic",
    "hardnessMultiplier": 1.14,
    "armorBias": 0.45,
    "resistBias": 0.07,
    "enemyCommonDrop": false,
    "id": "VoidAmber",
    "legacy": true
  },
  "phaseQuartz": {
    "name": "Am\xE9thyste",
    "cargoPerUnit": 1,
    "sellPrice": 68,
    "colorHex": "#ba55d3",
    "rarity": 5,
    "baseWeight": 0.58,
    "spawnTier": 8,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.2,
    "armorBias": 0.45,
    "resistBias": 0.08,
    "enemyCommonDrop": false,
    "id": "PhaseQuartz",
    "legacy": true
  },
  "echoResin": {
    "name": "R\xE9sine",
    "cargoPerUnit": 1,
    "sellPrice": 34,
    "colorHex": "#2e8b57",
    "rarity": 3,
    "baseWeight": 0.9,
    "spawnTier": 4,
    "shapeClass": "Biomass",
    "hardnessMultiplier": 0.95,
    "armorBias": 0,
    "resistBias": 0.03,
    "enemyCommonDrop": false,
    "id": "EchoResin",
    "legacy": true
  },
  "stellarAsh": {
    "name": "Cendre volcanique",
    "cargoPerUnit": 1,
    "sellPrice": 34,
    "colorHex": "#778899",
    "rarity": 3,
    "baseWeight": 0.95,
    "spawnTier": 4,
    "shapeClass": "Dust",
    "hardnessMultiplier": 0.9,
    "armorBias": -0.2,
    "resistBias": -0.02,
    "enemyCommonDrop": false,
    "id": "StellarAsh",
    "legacy": true
  },
  "gravitonFilament": {
    "name": "Tungst\xE8ne fil\xE9",
    "cargoPerUnit": 1,
    "sellPrice": 88,
    "colorHex": "#87cefa",
    "rarity": 6,
    "baseWeight": 0.32,
    "spawnTier": 10,
    "shapeClass": "Exotic",
    "hardnessMultiplier": 1.23,
    "armorBias": 0.75,
    "resistBias": 0.1,
    "enemyCommonDrop": false,
    "id": "GravitonFilament",
    "legacy": true
  },
  "chronoShard": {
    "name": "Zircone",
    "cargoPerUnit": 1,
    "sellPrice": 88,
    "colorHex": "#ffe4b5",
    "rarity": 6,
    "baseWeight": 0.31,
    "spawnTier": 10,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.24,
    "armorBias": 0.8,
    "resistBias": 0.1,
    "enemyCommonDrop": false,
    "id": "ChronoShard",
    "legacy": true
  },
  "prismTear": {
    "name": "Fluorite",
    "cargoPerUnit": 1,
    "sellPrice": 91,
    "colorHex": "#ff00ff",
    "rarity": 6,
    "baseWeight": 0.27,
    "spawnTier": 11,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.28,
    "armorBias": 0.85,
    "resistBias": 0.11,
    "enemyCommonDrop": false,
    "id": "PrismTear",
    "legacy": true
  },
  "singularitySeed": {
    "name": "Silicium monocristallin",
    "cargoPerUnit": 1,
    "sellPrice": 116,
    "colorHex": "#000000",
    "rarity": 7,
    "baseWeight": 0.12,
    "spawnTier": 14,
    "shapeClass": "Exotic",
    "hardnessMultiplier": 1.45,
    "armorBias": 1.25,
    "resistBias": 0.16,
    "enemyCommonDrop": false,
    "id": "SingularitySeed",
    "legacy": true
  },
  "aetherFoam": {
    "name": "A\xE9rogel de silice",
    "cargoPerUnit": 1,
    "sellPrice": 91,
    "colorHex": "#f0ffff",
    "rarity": 6,
    "baseWeight": 0.27,
    "spawnTier": 11,
    "shapeClass": "Exotic",
    "hardnessMultiplier": 1.18,
    "armorBias": 0.45,
    "resistBias": 0.11,
    "enemyCommonDrop": false,
    "id": "AetherFoam",
    "legacy": true
  },
  "nullGlass": {
    "name": "Obsidienne",
    "cargoPerUnit": 1,
    "sellPrice": 71,
    "colorHex": "#9400d3",
    "rarity": 5,
    "baseWeight": 0.45,
    "spawnTier": 9,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.3,
    "armorBias": 1.1,
    "resistBias": 0.1,
    "enemyCommonDrop": false,
    "id": "NullGlass",
    "legacy": true
  },
  "basaltChunk": {
    "name": "Basalte",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#5c5c60",
    "rarity": 1,
    "baseWeight": 1.1,
    "spawnTier": 1,
    "shapeClass": "Rock",
    "hardnessMultiplier": 1.02,
    "armorBias": 0.3,
    "resistBias": 0.01,
    "enemyCommonDrop": true,
    "id": "BasaltChunk",
    "legacy": true
  },
  "manganeseNodule": {
    "name": "Concr\xE9tion mangan\xE9sif\xE8re",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#866a5d",
    "rarity": 2,
    "baseWeight": 1,
    "spawnTier": 2,
    "shapeClass": "Rock",
    "hardnessMultiplier": 1.05,
    "armorBias": 0.25,
    "resistBias": 0.01,
    "enemyCommonDrop": true,
    "id": "ManganeseNodule",
    "legacy": true
  },
  "boronFlake": {
    "name": "Borax",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#ffd68c",
    "rarity": 2,
    "baseWeight": 0.9,
    "spawnTier": 3,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.02,
    "armorBias": 0.1,
    "resistBias": 0.02,
    "enemyCommonDrop": false,
    "id": "BoronFlake",
    "legacy": true
  },
  "phosphorite": {
    "name": "Phosphorite",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#d7d49c",
    "rarity": 2,
    "baseWeight": 0.95,
    "spawnTier": 2,
    "shapeClass": "Rock",
    "hardnessMultiplier": 0.95,
    "armorBias": 0,
    "resistBias": 0,
    "enemyCommonDrop": false,
    "id": "Phosphorite",
    "legacy": true
  },
  "sodiumClathrate": {
    "name": "Natron",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#d2e9ff",
    "rarity": 2,
    "baseWeight": 0.95,
    "spawnTier": 3,
    "shapeClass": "Ice",
    "hardnessMultiplier": 0.86,
    "armorBias": -0.35,
    "resistBias": -0.03,
    "enemyCommonDrop": false,
    "id": "SodiumClathrate",
    "legacy": true
  },
  "argonIce": {
    "name": "Argon solide",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#c6f0ff",
    "rarity": 2,
    "baseWeight": 0.85,
    "spawnTier": 3,
    "shapeClass": "Ice",
    "hardnessMultiplier": 0.84,
    "armorBias": -0.45,
    "resistBias": -0.04,
    "enemyCommonDrop": false,
    "id": "ArgonIce",
    "legacy": true
  },
  "ceresClay": {
    "name": "Argile",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#aa876c",
    "rarity": 1,
    "baseWeight": 1.05,
    "spawnTier": 1,
    "shapeClass": "Dust",
    "hardnessMultiplier": 0.88,
    "armorBias": -0.2,
    "resistBias": -0.01,
    "enemyCommonDrop": true,
    "id": "CeresClay",
    "legacy": true
  },
  "grapheneVeil": {
    "name": "Graph\xE8ne",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#464655",
    "rarity": 3,
    "baseWeight": 0.85,
    "spawnTier": 5,
    "shapeClass": "Junk",
    "hardnessMultiplier": 1.05,
    "armorBias": 0.25,
    "resistBias": 0.03,
    "enemyCommonDrop": true,
    "id": "GrapheneVeil",
    "legacy": true
  },
  "tungstenOre": {
    "name": "Minerai de tungst\xE8ne",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#82919b",
    "rarity": 3,
    "baseWeight": 0.75,
    "spawnTier": 5,
    "shapeClass": "Rock",
    "hardnessMultiplier": 1.18,
    "armorBias": 0.65,
    "resistBias": 0.04,
    "enemyCommonDrop": false,
    "id": "TungstenOre",
    "legacy": true
  },
  "rutileShard": {
    "name": "Rutile",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#cdaa78",
    "rarity": 3,
    "baseWeight": 0.8,
    "spawnTier": 5,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.08,
    "armorBias": 0.25,
    "resistBias": 0.04,
    "enemyCommonDrop": false,
    "id": "RutileShard",
    "legacy": true
  },
  "galliumBloom": {
    "name": "Gallium",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#aebfff",
    "rarity": 4,
    "baseWeight": 0.78,
    "spawnTier": 6,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.03,
    "armorBias": 0.2,
    "resistBias": 0.04,
    "enemyCommonDrop": false,
    "id": "GalliumBloom",
    "legacy": true
  },
  "seleniumThread": {
    "name": "S\xE9l\xE9nium",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#ffbc78",
    "rarity": 4,
    "baseWeight": 0.78,
    "spawnTier": 6,
    "shapeClass": "Junk",
    "hardnessMultiplier": 1.04,
    "armorBias": 0.2,
    "resistBias": 0.04,
    "enemyCommonDrop": false,
    "id": "SeleniumThread",
    "legacy": true
  },
  "hafniumPlate": {
    "name": "Plaque d'hafnium",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#97a6b4",
    "rarity": 4,
    "baseWeight": 0.6,
    "spawnTier": 7,
    "shapeClass": "Junk",
    "hardnessMultiplier": 1.16,
    "armorBias": 0.75,
    "resistBias": 0.04,
    "enemyCommonDrop": false,
    "id": "HafniumPlate",
    "legacy": true
  },
  "rutheniumDust": {
    "name": "Ruth\xE9nium",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#b4bcc0",
    "rarity": 4,
    "baseWeight": 0.62,
    "spawnTier": 7,
    "shapeClass": "Dust",
    "hardnessMultiplier": 1.08,
    "armorBias": 0.45,
    "resistBias": 0.04,
    "enemyCommonDrop": false,
    "id": "RutheniumDust",
    "legacy": true
  },
  "telluricGlass": {
    "name": "Tellure",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#76e1cd",
    "rarity": 5,
    "baseWeight": 0.55,
    "spawnTier": 8,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.16,
    "armorBias": 0.55,
    "resistBias": 0.07,
    "enemyCommonDrop": false,
    "id": "TelluricGlass",
    "legacy": true
  },
  "mercuryIce": {
    "name": "Mercure",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#d6e0ea",
    "rarity": 5,
    "baseWeight": 0.52,
    "spawnTier": 8,
    "shapeClass": "Ice",
    "hardnessMultiplier": 1.03,
    "armorBias": 0.1,
    "resistBias": 0.05,
    "enemyCommonDrop": false,
    "id": "MercuryIce",
    "legacy": true
  },
  "cesiumSalt": {
    "name": "Formiate de c\xE9sium",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#ece1ff",
    "rarity": 4,
    "baseWeight": 0.62,
    "spawnTier": 7,
    "shapeClass": "Dust",
    "hardnessMultiplier": 0.95,
    "armorBias": 0.1,
    "resistBias": 0.04,
    "enemyCommonDrop": false,
    "id": "CesiumSalt",
    "legacy": true
  },
  "lanthanumKnot": {
    "name": "Monazite",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#ace8d6",
    "rarity": 5,
    "baseWeight": 0.5,
    "spawnTier": 8,
    "shapeClass": "Exotic",
    "hardnessMultiplier": 1.08,
    "armorBias": 0.3,
    "resistBias": 0.07,
    "enemyCommonDrop": false,
    "id": "LanthanumKnot",
    "legacy": true
  },
  "yttriumPrism": {
    "name": "X\xE9notime",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#c4faff",
    "rarity": 5,
    "baseWeight": 0.44,
    "spawnTier": 9,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.18,
    "armorBias": 0.45,
    "resistBias": 0.08,
    "enemyCommonDrop": false,
    "id": "YttriumPrism",
    "legacy": true
  },
  "zirconCore": {
    "name": "Zircon",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#ebf2ff",
    "rarity": 5,
    "baseWeight": 0.42,
    "spawnTier": 9,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.18,
    "armorBias": 0.55,
    "resistBias": 0.08,
    "enemyCommonDrop": false,
    "id": "ZirconCore",
    "legacy": true
  },
  "quasarPollen": {
    "name": "Soufre sublim\xE9",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#fff596",
    "rarity": 6,
    "baseWeight": 0.25,
    "spawnTier": 11,
    "shapeClass": "Dust",
    "hardnessMultiplier": 1.15,
    "armorBias": 0.6,
    "resistBias": 0.11,
    "enemyCommonDrop": false,
    "id": "QuasarPollen",
    "legacy": true
  },
  "eventidePearl": {
    "name": "Opale noire",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#d2b4ff",
    "rarity": 6,
    "baseWeight": 0.22,
    "spawnTier": 12,
    "shapeClass": "Crystal",
    "hardnessMultiplier": 1.25,
    "armorBias": 0.9,
    "resistBias": 0.12,
    "enemyCommonDrop": false,
    "id": "EventidePearl",
    "legacy": true
  },
  "vacuumLotus": {
    "name": "Kelp s\xE9ch\xE9",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#affff0",
    "rarity": 6,
    "baseWeight": 0.2,
    "spawnTier": 12,
    "shapeClass": "Biomass",
    "hardnessMultiplier": 1.12,
    "armorBias": 0.45,
    "resistBias": 0.12,
    "enemyCommonDrop": false,
    "id": "VacuumLotus",
    "legacy": true
  },
  "entropySpore": {
    "name": "Spores fongiques",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#82ffa0",
    "rarity": 7,
    "baseWeight": 0.16,
    "spawnTier": 13,
    "shapeClass": "Biomass",
    "hardnessMultiplier": 1.28,
    "armorBias": 0.95,
    "resistBias": 0.14,
    "enemyCommonDrop": false,
    "id": "EntropySpore",
    "legacy": true
  },
  "lumenMoss": {
    "name": "Lichen",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#98ff7c",
    "rarity": 3,
    "baseWeight": 0.78,
    "spawnTier": 5,
    "shapeClass": "Biomass",
    "hardnessMultiplier": 0.9,
    "armorBias": -0.1,
    "resistBias": 0.03,
    "enemyCommonDrop": false,
    "id": "LumenMoss",
    "legacy": true
  },
  "magnetarSkin": {
    "name": "Magn\xE9tite",
    "cargoPerUnit": 1,
    "sellPrice": 40,
    "colorHex": "#6eaaff",
    "rarity": 7,
    "baseWeight": 0.06,
    "spawnTier": 16,
    "shapeClass": "Exotic",
    "hardnessMultiplier": 1.55,
    "armorBias": 1.35,
    "resistBias": 0.17,
    "enemyCommonDrop": false,
    "id": "MagnetarSkin",
    "legacy": true
  }
};

// client/src/ui/station/StationRefineryView.js
function invAmount(inv, key) {
  const row = (inv?.resources || []).find((entry) => entry.key === key);
  return Math.max(0, row?.amount || 0);
}
function resourceName(key) {
  return RESOURCE_DEFS[key]?.name || key;
}
function resourceColor(key) {
  return RESOURCE_DEFS[key]?.colorHex || "#d0d7e4";
}
function formatCostMap(map, inv, cycles = 1) {
  return Object.entries(map || {}).map(([key, amount]) => {
    const need = Math.max(0, amount | 0) * cycles;
    const have = invAmount(inv, key);
    const ok = have >= need;
    return `
      <div class="station-shop__recipe-line" style="color:${ok ? "#cfe8bf" : "#f0b8b0"}">
        ${resourceName(key)} : ${formatInt(need)} \u2022 stock ${formatInt(have)}${ok ? "" : ` \u2022 manque ${formatInt(need - have)}`}
      </div>
    `;
  }).join("");
}
function formatOutputMap(map, cycles = 1) {
  return Object.entries(map || {}).map(([key, amount]) => {
    const out = Math.max(0, amount | 0) * cycles;
    return `
      <div class="station-shop__recipe-line" style="color:#bfe5ff">
        ${resourceName(key)} : +${formatInt(out)}
      </div>
    `;
  }).join("");
}
function canRunRecipe(recipe, inv, cycles) {
  for (const [key, amount] of Object.entries(recipe?.input || {})) {
    if (invAmount(inv, key) < Math.max(0, amount | 0) * cycles) return false;
  }
  return true;
}
var StationRefineryView = class {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === "function" ? sendCmd : null;
    this.cmdQueue = new StationCommandQueue(this.sendCmd);
    this.selectedRecipeId = REFINERY_RECIPES[0]?.id || "";
    this.cycles = 1;
    this.inv = null;
    this.docked = false;
    this.el = document.createElement("div");
    this.el.className = "station-shop station-refinery";
    this.el.innerHTML = `
      <div class="station-shop__body">
        <section class="station-shop__grid-panel">
          <div class="station-shop__grid" data-role="grid"></div>
        </section>
        <aside class="station-shop__details">
          <div class="station-shop__details-head">
            <div class="station-shop__details-title" data-role="title">Raffinage industriel</div>
            <div class="station-shop__details-meta" data-role="meta">Recettes V1</div>
          </div>
          <div class="station-shop__details-content" data-role="content"></div>
          <div class="station-shop__footer">
            <button class="ui-btn ui-btn--ghost" type="button" data-cycle="1">x1</button>
            <button class="ui-btn ui-btn--ghost" type="button" data-cycle="5">x5</button>
            <button class="ui-btn ui-btn--ghost" type="button" data-cycle="10">x10</button>
            <button class="ui-btn" type="button" data-role="actionBtn">Raffiner</button>
          </div>
        </aside>
      </div>
    `;
    this.gridEl = this.el.querySelector('[data-role="grid"]');
    this.titleEl = this.el.querySelector('[data-role="title"]');
    this.metaEl = this.el.querySelector('[data-role="meta"]');
    this.contentEl = this.el.querySelector('[data-role="content"]');
    this.actionBtn = this.el.querySelector('[data-role="actionBtn"]');
    this.el.addEventListener("contextmenu", (ev) => ev.preventDefault());
    this.el.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      const recipeBtn = ev.target?.closest?.("button[data-recipe-id]");
      if (recipeBtn) {
        this.selectedRecipeId = recipeBtn.dataset.recipeId || this.selectedRecipeId;
        this.render();
        return;
      }
      const cycleBtn = ev.target?.closest?.("button[data-cycle]");
      if (cycleBtn) {
        this.cycles = Math.max(1, Math.min(25, Number(cycleBtn.dataset.cycle) || 1));
        this.render();
        return;
      }
      const actionBtn = ev.target?.closest?.('button[data-role="actionBtn"]');
      if (actionBtn && !actionBtn.disabled) {
        ev.preventDefault();
        this.refine();
      }
    });
    this.el.addEventListener("dblclick", (ev) => {
      const recipeBtn = ev.target?.closest?.("button[data-recipe-id]");
      if (!recipeBtn) return;
      this.selectedRecipeId = recipeBtn.dataset.recipeId || this.selectedRecipeId;
      this.refine();
    });
  }
  getRecipe() {
    return REFINERY_RECIPES.find((r) => r.id === this.selectedRecipeId) || REFINERY_RECIPES[0] || null;
  }
  refine() {
    const recipe = this.getRecipe();
    if (!recipe || !this.docked || !this.sendCmd) return;
    this.cmdQueue.send("refine_resource", { recipeId: recipe.id, cycles: this.cycles });
  }
  update(inv, docked) {
    this.inv = inv || null;
    this.docked = !!docked;
    this.render();
  }
  render() {
    const inv = this.inv || { resources: [] };
    const cycles = Math.max(1, this.cycles | 0);
    const groups = /* @__PURE__ */ new Map();
    for (const recipe2 of REFINERY_RECIPES) {
      const arr = groups.get(recipe2.category) || [];
      arr.push(recipe2);
      groups.set(recipe2.category, arr);
    }
    this.gridEl.innerHTML = [...groups.entries()].map(([category, recipes]) => `
      <div class="station-shop__section">
        <div class="station-shop__section-title">${category}</div>
        <div class="station-shop__items">
          ${recipes.map((recipe2) => {
      const selected = recipe2.id === this.selectedRecipeId;
      const ok2 = canRunRecipe(recipe2, inv, cycles);
      const outKey = Object.keys(recipe2.output || {})[0] || "";
      return `
              <button class="station-item-btn ${selected ? "is-selected" : ""} ${ok2 ? "is-affordable" : ""}" type="button" data-recipe-id="${recipe2.id}" title="${recipe2.name}">
                <span class="station-item-btn__icon" style="background:${resourceColor(outKey)}; box-shadow:0 0 18px ${resourceColor(outKey)}66"></span>
                <span class="station-item-btn__name">${recipe2.name}</span>
              </button>
            `;
    }).join("")}
        </div>
      </div>
    `).join("");
    const recipe = this.getRecipe();
    if (!recipe) {
      this.contentEl.innerHTML = '<div class="station-shop__empty">Aucune recette.</div>';
      this.actionBtn.disabled = true;
      return;
    }
    const ok = canRunRecipe(recipe, inv, cycles);
    this.titleEl.textContent = recipe.name;
    this.metaEl.textContent = `${recipe.station} \u2022 ${recipe.seconds}s / cycle`;
    this.contentEl.innerHTML = `
      <div class="station-shop__info-block">
        <div class="station-shop__info-title">Entr\xE9e x${cycles}</div>
        ${formatCostMap(recipe.input, inv, cycles)}
      </div>
      <div class="station-shop__info-block">
        <div class="station-shop__info-title">Sortie</div>
        ${formatOutputMap(recipe.output, cycles)}
      </div>
      <div class="station-shop__info-block">
        <div class="station-shop__info-title">Logique industrielle</div>
        <div class="station-shop__recipe-line">${recipe.description || ""}</div>
      </div>
    `;
    this.actionBtn.disabled = !this.docked || !ok;
    this.actionBtn.textContent = ok ? `Raffiner x${cycles}` : "Ressources insuffisantes";
    for (const btn of this.el.querySelectorAll("button[data-cycle]")) {
      btn.classList.toggle("is-active", Number(btn.dataset.cycle) === cycles);
    }
  }
};

// client/src/ui/station/StationWindowView.js
var StationWindowView = class {
  constructor(sendCmd, store = null) {
    this.sendCmd = typeof sendCmd === "function" ? sendCmd : null;
    this.store = store;
    this.activeTab = "trade";
    this.el = document.createElement("section");
    this.el.className = "station-modal";
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="station-modal__backdrop" data-act="close"></div>
      <div class="station-window ui-panel-shell ui-panel-shell--xl">
        <div class="station-window__header station-window__header--minimal">
          <div class="station-window__header-actions">
            <button class="ui-btn ui-btn--ghost" data-act="undock">D\xE9samarrer</button>
            <button class="station-window__close" data-act="close" aria-label="Fermer">\u2715</button>
          </div>
        </div>

        <div class="station-window__pending" data-role="pending" hidden>
          <span class="station-window__pending-spinner"></span>
          <span data-role="pendingText">Synchronisation station\u2026</span>
        </div>

        <div class="station-window__body">
          <nav class="station-window__nav" data-role="nav"></nav>
          <div class="station-window__main" data-role="main"></div>
        </div>
      </div>
    `;
    this.titleEl = this.el.querySelector('[data-role="title"]');
    this.navEl = this.el.querySelector('[data-role="nav"]');
    this.mainEl = this.el.querySelector('[data-role="main"]');
    this.pendingEl = this.el.querySelector('[data-role="pending"]');
    this.pendingTextEl = this.el.querySelector('[data-role="pendingText"]');
    this.tradeView = new StationTradeView(sendCmd);
    this.tradeView.el.classList.add("station-page", "station-page--trade");
    this.refineryView = new StationRefineryView(sendCmd);
    this.refineryView.el.classList.add("station-page", "station-page--refinery");
    this.shopView = new StationShopView(sendCmd);
    this.shopView.el.classList.add("station-page", "station-page--shop");
    this.ammoView = new StationAmmoView(sendCmd);
    this.ammoView.el.classList.add("station-page", "station-page--ammo");
    this.equipmentView = new StationEquipmentView(sendCmd);
    this.equipmentView.el.classList.add("station-page", "station-page--equipment");
    this.convertersView = new StationConvertersView(sendCmd);
    this.convertersView.el.classList.add("station-page", "station-page--converters");
    this.pages = /* @__PURE__ */ new Map([
      ["trade", this.tradeView.el],
      ["refinery", this.refineryView.el],
      ["shop", this.shopView.el],
      ["ammo", this.ammoView.el],
      ["equipment", this.equipmentView.el],
      ["converters", this.convertersView.el]
    ]);
    this.navEl.innerHTML = STATION_TABS.map((t) => {
      return `
        <button class="station-tab" type="button" data-tab="${t.id}" title="${t.title}" aria-label="${t.title}">
          <span class="station-tab__icon">${t.iconMarkup}</span>
          <span class="station-tab__label">${t.title}</span>
        </button>
      `;
    }).join("");
    this.el.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("button[data-tab]");
      if (btn) {
        const tab = btn.dataset.tab;
        if (tab) this.setTab(tab);
        return;
      }
      const act = ev.target?.dataset?.act;
      if (!act) return;
      if (!this.sendCmd) return;
      if (act === "close" || act === "undock") this.sendCmd("undock", {});
    });
    this.setTab(this.activeTab);
  }
  updatePendingUi() {
    const summary = this.store?.getStationPendingSummary?.() || { count: 0, failedCount: 0 };
    const pending = summary.count > 0;
    const failed = summary.failedCount > 0;
    this.el.classList.toggle("has-pending-station-command", pending);
    this.el.classList.toggle("has-failed-station-command", failed);
    if (!this.pendingEl) return;
    this.pendingEl.hidden = !pending && !failed;
    if (this.pendingTextEl) {
      if (pending) this.pendingTextEl.textContent = summary.count > 1 ? `${summary.count} actions station en cours\u2026` : "Action station envoy\xE9e\u2026";
      else if (failed) this.pendingTextEl.textContent = "Action refus\xE9e ou serveur indisponible.";
    }
  }
  setTab(tabId) {
    const nextTab = this.pages.has(tabId) ? tabId : "trade";
    this.activeTab = nextTab;
    for (const b of this.navEl.querySelectorAll("button[data-tab]")) {
      b.classList.toggle("is-active", b.dataset.tab === nextTab);
    }
    const nextPage = this.pages.get(nextTab) || this.tradeView.el;
    for (const [id, pageEl] of this.pages.entries()) {
      pageEl.classList.toggle("is-active", id === nextTab);
    }
    if (this.mainEl.firstElementChild !== nextPage) {
      this.mainEl.replaceChildren(nextPage);
    }
  }
  update(myState, stationsById) {
    const docked = !!myState?.dockedStationId;
    this.el.hidden = !docked;
    if (!docked) return;
    const sid = myState?.dockedStationId || 0;
    const station = sid ? stationsById?.get?.(sid) : null;
    if (this.titleEl) this.titleEl.textContent = station?.name || "Station";
    this.updatePendingUi();
    this.tradeView.update(myState?.inv, docked);
    this.refineryView.update(myState?.inv, docked);
    this.shopView.update(myState?.stationShop, myState?.inv, docked);
    this.ammoView.update(myState?.equipment, myState?.stationShop, myState?.inv, docked);
    this.equipmentView.update(myState?.equipment, myState?.inv, docked);
    this.convertersView.update(myState?.equipment, docked);
    this.setTab(this.activeTab);
  }
};

// client/src/ui/converters/ConvertersPanelView.js
function buildConverterSlots2(converters) {
  const equipped = [...converters?.equipped || []];
  const slotCap = Math.max(0, converters?.slotCap | 0);
  const slots = [];
  for (let i = 0; i < slotCap; i += 1) {
    const item = equipped[i] || null;
    slots.push({
      id: `flight-converter-slot-${i}`,
      index: i,
      label: `Convertisseur ${i + 1}`,
      item,
      active: !!item?.converterEnabled
    });
  }
  return slots;
}
function clamp012(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}
var ConvertersPanelView = class {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === "function" ? sendCmd : null;
    this.equipment = null;
    this.converters = null;
    this.slots = [];
    this.selectedSlotId = "";
    this.hoverSlotId = "";
    this.el = document.createElement("section");
    this.el.className = "converters-panel";
    this.el.innerHTML = `
      <div class="converters-panel__header">
        <div>
          <div class="converters-panel__eyebrow">Syst\xE8mes de bord</div>
          <h2 class="converters-panel__title">Convertisseurs</h2>
          <div class="converters-panel__summary" data-role="summary">0 / 0 actifs</div>
        </div>
      </div>
      <div class="converters-panel__slots" data-role="slots"></div>
      <div class="converters-panel__runtime" data-role="runtime"></div>
      <div class="converters-panel__details" data-role="details"></div>
    `;
    this.summaryEl = this.el.querySelector('[data-role="summary"]');
    this.slotsEl = this.el.querySelector('[data-role="slots"]');
    this.runtimeEl = this.el.querySelector('[data-role="runtime"]');
    this.detailsEl = this.el.querySelector('[data-role="details"]');
    this.el.addEventListener("mouseover", (ev) => {
      const slotNode = ev.target?.closest?.("[data-slot-id]");
      if (!slotNode) return;
      this.hoverSlotId = slotNode.dataset.slotId || "";
      this.renderDetails();
    });
    this.el.addEventListener("mouseout", (ev) => {
      const leavingNode = ev.target?.closest?.("[data-slot-id]");
      if (!leavingNode) return;
      const nextInside = ev.relatedTarget && typeof ev.relatedTarget.closest === "function" ? ev.relatedTarget.closest("[data-slot-id]") : null;
      if (nextInside) return;
      this.hoverSlotId = "";
      this.renderDetails();
    });
    this.el.addEventListener("mousedown", (ev) => {
      if (ev.button !== 0) return;
      const slotNode = ev.target?.closest?.("[data-slot-id]");
      if (!slotNode) return;
      this.selectedSlotId = slotNode.dataset.slotId || "";
      this.render();
    });
    this.el.addEventListener("dblclick", (ev) => {
      const slotNode = ev.target?.closest?.("[data-slot-id]");
      if (!slotNode) return;
      const slot = this.slots.find((entry) => entry.id === (slotNode.dataset.slotId || ""));
      if (slot?.item?.itemId && this.sendCmd) this.sendCmd("toggle_converter", { itemId: slot.item.itemId, enabled: !slot.item.converterEnabled });
    });
    this.el.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("button[data-act]");
      if (!btn || !this.sendCmd) return;
      const itemId = btn.dataset.itemId || this.getFocusedSlot()?.item?.itemId || "";
      if (!itemId) return;
      if (btn.dataset.act === "toggle") {
        const item = this.getFocusedSlot()?.item || this.slots.find((slot) => slot.item?.itemId === itemId)?.item || null;
        this.sendCmd("toggle_converter", { itemId, enabled: !item?.converterEnabled });
      }
    });
  }
  getFocusedSlot() {
    const slotId = this.hoverSlotId || this.selectedSlotId;
    return this.slots.find((entry) => entry.id === slotId) || null;
  }
  renderSummary() {
    const summary = this.converters?.summary || { equippedCount: 0, enabledCount: 0, totalCycles: 0 };
    this.summaryEl.textContent = `${Math.max(0, summary.enabledCount | 0)} / ${Math.max(0, summary.equippedCount | 0)} actifs \u2022 ${Math.max(0, summary.totalCycles | 0)} cycles`;
  }
  renderSlots() {
    this.slotsEl.innerHTML = this.slots.map((slot) => {
      const selected = slot.id === (this.hoverSlotId || this.selectedSlotId);
      const icon = slot.item ? buildItemIconMarkup(slot.item, { compact: true, selected }, "div") : '<span class="converters-panel-slot__empty"></span>';
      const progress01 = slot.item?.converterRuntime && slot.item?.converterProfile ? clamp012(Number(slot.item.converterRuntime.progress || 0) / Math.max(0.1, Number(slot.item.converterProfile.seconds || 1))) : 0;
      return `
        <button class="converters-panel-slot ${selected ? "is-selected" : ""} ${slot.active ? "is-active" : ""}" type="button" data-slot-id="${slot.id}" title="${slot.label}">
          <span class="converters-panel-slot__iconwrap">${icon}</span>
          <span class="converters-panel-slot__meta">
            <span class="converters-panel-slot__label">${slot.label}</span>
            <span class="converters-panel-slot__state">${slot.item ? slot.active ? "Actif" : "Coup\xE9" : "Vide"}</span>
          </span>
          <span class="converters-panel-slot__bar"><span style="width:${Math.round(progress01 * 100)}%"></span></span>
        </button>
      `;
    }).join("") || '<div class="converters-panel__empty">Aucun slot convertisseur.</div>';
  }
  renderRuntime() {
    const active = this.converters?.active || [];
    this.runtimeEl.innerHTML = active.length ? active.map((entry) => `
          <div class="converters-runtime-row ${entry.enabled ? "is-enabled" : ""}">
            <span class="converters-runtime-row__name">${entry.name}</span>
            <span class="converters-runtime-row__flow">${Math.max(0, entry.inputAmount | 0)} ${entry.inputKey || "?"} \u2192 ${Math.max(0, entry.outputAmount | 0)} ${entry.outputKey || "?"}</span>
            <span class="converters-runtime-row__pct">${Math.round(clamp012(entry.progress01) * 100)}%</span>
          </div>
        `).join("") : '<div class="converters-panel__empty">Aucun convertisseur \xE9quip\xE9.</div>';
  }
  renderDetails() {
    const slot = this.getFocusedSlot();
    const item = slot?.item || null;
    if (!item) {
      this.detailsEl.innerHTML = `
        <div class="converters-panel__detail-line">Survole un slot convertisseur pour afficher son runtime.</div>
        <div class="converters-panel__detail-line">Depuis cette fen\xEAtre en vol, tu peux seulement couper ou relancer un convertisseur d\xE9j\xE0 \xE9quip\xE9.</div>
      `;
      return;
    }
    const profile2 = item.converterProfile || {};
    const runtime = item.converterRuntime || { enabled: false, progress: 0, cycles: 0 };
    const seconds = Math.max(0.1, Number(profile2.seconds || 1));
    const progressPct = Math.round(clamp012(Number(runtime.progress || 0) / seconds) * 100);
    this.detailsEl.innerHTML = `
      <div class="converters-panel__detail-head">
        <span class="converters-panel__detail-name">${item.name}</span>
        <span class="converters-panel__detail-state">${item.converterEnabled ? "Actif" : "Coup\xE9"}</span>
      </div>
      <div class="converters-panel__detail-line">Cycle : ${Math.max(1, profile2.inputAmount | 0)} ${profile2.inputKey || "?"} \u2192 ${Math.max(1, profile2.outputAmount | 0)} ${profile2.outputKey || "?"} \u2022 ${seconds.toFixed(1)}s</div>
      <div class="converters-panel__detail-line">Runtime : progression ${progressPct}% \u2022 cycles ${Math.max(0, runtime.cycles | 0)} \u2022 ${Number(profile2.energyPerSecond || 0).toFixed(2)} \xE9nergie/s</div>
      <div class="converters-panel__detail-line">${item.description || ""}</div>
      <div class="converters-panel__actions">
        <button class="ui-btn" type="button" data-act="toggle" data-item-id="${item.itemId}">${item.converterEnabled ? "Couper" : "Relancer"}</button>
      </div>
    `;
  }
  render() {
    this.slots = buildConverterSlots2(this.converters);
    if (this.selectedSlotId && !this.slots.some((slot) => slot.id === this.selectedSlotId)) this.selectedSlotId = "";
    if (this.hoverSlotId && !this.slots.some((slot) => slot.id === this.hoverSlotId)) this.hoverSlotId = "";
    this.renderSummary();
    this.renderSlots();
    this.renderRuntime();
    this.renderDetails();
  }
  update(equipment) {
    this.equipment = equipment || null;
    this.converters = equipment?.converters || null;
    this.render();
  }
};

// client/src/ui/converters/ConverterIconSvg.js
function getConverterIconSvg2() {
  return `
    <svg viewBox="0 0 64 64" class="ui-icon-svg" aria-hidden="true">
      <defs>
        <linearGradient id="convCore" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#e5efff"></stop>
          <stop offset="100%" stop-color="#90a7c8"></stop>
        </linearGradient>
        <linearGradient id="convGlow" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#8ff3ff" stop-opacity="0.98"></stop>
          <stop offset="100%" stop-color="#4e9dff" stop-opacity="0.18"></stop>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="22" fill="rgba(8,14,22,0.95)" stroke="rgba(123,189,255,0.52)" stroke-width="2"></circle>
      <circle cx="32" cy="32" r="10" fill="url(#convCore)"></circle>
      <path d="M32 12a20 20 0 0 1 18 11" fill="none" stroke="url(#convGlow)" stroke-width="4" stroke-linecap="round"></path>
      <path d="M53 24l-1 9-8-4" fill="url(#convGlow)"></path>
      <path d="M32 52A20 20 0 0 1 14 41" fill="none" stroke="url(#convGlow)" stroke-width="4" stroke-linecap="round"></path>
      <path d="M11 40l1-9 8 4" fill="url(#convGlow)"></path>
      <circle cx="32" cy="32" r="4.5" fill="rgba(12,20,31,0.95)"></circle>
    </svg>`;
}

// shared/content/frames/vanguard/VanguardFrameSpec.js
var VANGUARD_PASSIVE = Object.freeze({
  maxStacks: 10,
  stackDuration: 5,
  decayInterval: 0.2,
  attackSpeedPerStack: 0.04,
  moveSpeedPerStack: 0.015,
  slowResistPerStack: 0.015,
  tenacityAtSixPct: 0.2,
  overheatTenacityPct: 0.35,
  overheatTenacityDuration: 0.85
});
var Z_COOLDOWN_BREAKPOINTS = Object.freeze([2, 5, 8, 11, 14, 17, 20, 23, 26, 29]);
var VANGUARD_DEFAULT_BUILD = Object.freeze({
  A: 15,
  Z: 15,
  E: 15,
  R: 5
});
function clamp4(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
function countBreakpoints(investedLevel) {
  let count = 0;
  for (const bp of Z_COOLDOWN_BREAKPOINTS) if (investedLevel >= bp) count += 1;
  return count;
}
function getNonUltSkillLevel(investedLevel) {
  return 1 + (investedLevel - 1) * (29 / 14);
}
function getPhase(slot, investedLevel) {
  if (slot === "R") return clamp4(investedLevel, 1, 5);
  if (investedLevel >= 15) return 5;
  if (investedLevel >= 10) return 4;
  if (investedLevel >= 6) return 3;
  if (investedLevel >= 3) return 2;
  return 1;
}
function getDefaultVanguardInvestedLevel(slot) {
  return VANGUARD_DEFAULT_BUILD[slot] ?? 1;
}
function getVanguardAbilityTuning(slot, investedLevel = getDefaultVanguardInvestedLevel(slot), totalArmor = 0) {
  const maxLevel = slot === "R" ? 5 : 15;
  investedLevel = clamp4(Math.round(investedLevel || 1), 1, maxLevel);
  const phase = getPhase(slot, investedLevel);
  const skillLevel = slot === "R" ? investedLevel : getNonUltSkillLevel(investedLevel);
  const tuning2 = {
    investedLevel,
    phase,
    totalArmor,
    passive: VANGUARD_PASSIVE,
    energyCost: 0,
    baseCooldown: 0,
    castTime: 0,
    projectileRange: 0,
    projectileWidth: 0,
    projectileSpeed: 0,
    damagePct: 0,
    damageFlat: 0,
    pierceCount: 0,
    damageAmpPct: 0,
    damageAmpDuration: 0,
    refundEnergyOnCrowdControlledTarget: 0,
    disarmDuration: 0,
    empowerCharges: 0,
    empowerPct: 0,
    empowerFlat: 0,
    dashDistance: 0,
    moveBoostDuration: 0,
    moveBoostPct: 0,
    trailSlowPct: 0,
    trailSlowDuration: 0,
    comboWindowDuration: 0,
    comboProjectileSpeedPct: 0,
    comboDamagePct: 0,
    cleanseSlowAndRoot: false,
    cooldownRefundPct: 0,
    phaseDuration: 0,
    damageReductionPct: 0,
    spellShieldDuration: 0,
    exitRadius: 0,
    groundedDuration: 0,
    exitShieldPctMaxShield: 0,
    restoreAChargeOnMaxHeat: false,
    ultDuration: 0,
    ultAttackSpeedPct: 0,
    ultMoveSpeedPct: 0,
    ultEmpowerPct: 0,
    ultBurnFlat: 0,
    ultBurnWeaponPct: 0,
    ultBurnDuration: 0,
    ultCloseEnergyRestore: 0,
    ultCloseEnergyRange: 0,
    ultCloseAStunDuration: 0,
    ultCloseAStunRange: 0,
    empRadius: 0,
    empStunDuration: 0,
    secondaryWaveDamagePct: 0,
    unstoppableDuration: 0,
    extensionDuration: 0,
    extensionMaxBonusDuration: 0
  };
  if (slot === "A") {
    tuning2.castTime = 0.08;
    tuning2.projectileRange = 720;
    tuning2.projectileWidth = 22 + 0.3 * Math.floor((skillLevel - 1) * 0.5);
    tuning2.projectileSpeed = 1100;
    tuning2.energyCost = 10;
    tuning2.baseCooldown = Math.max(3.4, 5 - 0.05 * Math.floor((skillLevel - 1) / 3));
    tuning2.damagePct = 0.7 + 0.02 * (skillLevel - 1);
    tuning2.damageFlat = 10 + 2 * (skillLevel - 1);
    tuning2.empowerCharges = phase;
    tuning2.empowerPct = 0.22 + 0.012 * (skillLevel - 1);
    tuning2.empowerFlat = 4 + 1.1 * (skillLevel - 1);
    tuning2.pierceCount = phase >= 2 ? 1 : 0;
    tuning2.damageAmpPct = phase >= 3 ? 0.08 : 0;
    tuning2.damageAmpDuration = phase >= 3 ? 2 : 0;
    tuning2.refundEnergyOnCrowdControlledTarget = phase >= 4 ? 8 : 0;
    tuning2.disarmDuration = phase >= 5 ? 0.55 : 0;
    return Object.freeze(tuning2);
  }
  if (slot === "Z") {
    tuning2.dashDistance = 180 + 4 * (skillLevel - 1);
    tuning2.energyCost = 14;
    tuning2.baseCooldown = Math.max(12.5, 14 - 0.15 * countBreakpoints(Math.round(skillLevel)));
    tuning2.moveBoostPct = 0.22 + 6e-3 * (skillLevel - 1);
    tuning2.moveBoostDuration = 2 + 0.03 * (skillLevel - 1);
    tuning2.trailSlowPct = phase >= 2 ? 0.18 : 0;
    tuning2.trailSlowDuration = phase >= 2 ? 1.2 : 0;
    tuning2.comboWindowDuration = phase >= 3 ? 1.5 : 0;
    tuning2.comboProjectileSpeedPct = phase >= 3 ? 0.2 : 0;
    tuning2.comboDamagePct = phase >= 3 ? 0.12 : 0;
    tuning2.cleanseSlowAndRoot = phase >= 4;
    tuning2.cooldownRefundPct = phase >= 5 ? 0.35 : 0;
    return Object.freeze(tuning2);
  }
  if (slot === "E") {
    tuning2.castTime = 0.05;
    tuning2.energyCost = 18;
    tuning2.baseCooldown = Math.max(13.5, 18 - 0.12 * Math.floor((skillLevel - 1) / 3));
    tuning2.phaseDuration = skillLevel <= 21 ? 0.45 + 0.02 * (skillLevel - 1) : 0.85 + 0.01 * (skillLevel - 21);
    tuning2.damageReductionPct = 0.35 + 6e-3 * Math.floor((skillLevel - 1) * 0.5);
    tuning2.spellShieldDuration = phase >= 2 ? 0.45 : 0;
    tuning2.exitRadius = phase >= 3 ? 90 : 0;
    tuning2.groundedDuration = phase >= 3 ? 0.8 : 0;
    tuning2.exitShieldPctMaxShield = phase >= 4 ? 0.1 + 4e-3 * Math.max(0, skillLevel - 12) : 0;
    tuning2.restoreAChargeOnMaxHeat = phase >= 5;
    return Object.freeze(tuning2);
  }
  tuning2.energyCost = 45;
  tuning2.baseCooldown = Math.max(58, 72 - 0.5 * Math.floor((investedLevel - 1) / 2));
  tuning2.ultDuration = 6;
  tuning2.ultAttackSpeedPct = 0.16 + 8e-3 * (investedLevel - 1);
  tuning2.ultMoveSpeedPct = 0.1 + 5e-3 * (investedLevel - 1);
  tuning2.ultEmpowerPct = 0.08 + 45e-4 * (investedLevel - 1);
  tuning2.ultBurnFlat = 10;
  tuning2.ultBurnWeaponPct = 0.25;
  tuning2.ultBurnDuration = phase >= 2 ? 1.8 : 0;
  tuning2.unstoppableDuration = phase >= 3 ? 0.35 : 0;
  tuning2.ultCloseEnergyRestore = phase >= 4 ? 3 : 0;
  tuning2.ultCloseEnergyRange = phase >= 4 ? 160 : 0;
  tuning2.ultCloseAStunDuration = phase >= 5 ? 0.45 : 0;
  tuning2.ultCloseAStunRange = phase >= 5 ? 200 : 0;
  tuning2.extensionDuration = 0.8;
  tuning2.extensionMaxBonusDuration = 2.4;
  return Object.freeze(tuning2);
}

// shared/content/frames/sigil/SigilFrameSpec.js
var SIGIL_PASSIVE = Object.freeze({
  maxRunes: 5,
  runeDuration: 7,
  runeDamageFlatPerRune: 2,
  runeDamageWeaponPctPerRune: 0.08,
  slowThreshold: 3,
  slowPct: 0.12,
  detonationThreshold: 5,
  detonationConsumeRunes: 5,
  detonationCooldown: 1.2,
  detonationBonusFlat: 18,
  detonationBonusWeaponPct: 0.45,
  detonationBonusCurrentEnergyPct: 0.06
});
var PHASE_POINTS = Object.freeze([1, 3, 6, 10, 15]);
function clamp5(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
function getNormalSkillLevel(investedLevel) {
  investedLevel = clamp5(investedLevel, 1, 15);
  return 1 + (investedLevel - 1) * (29 / 14);
}
function getUltimateSkillLevel(investedLevel) {
  return clamp5(investedLevel, 1, 5);
}
function getPhase2(slot, investedLevel) {
  if (slot === "R") return clamp5(investedLevel, 1, 5);
  if (investedLevel >= PHASE_POINTS[4]) return 5;
  if (investedLevel >= PHASE_POINTS[3]) return 4;
  if (investedLevel >= PHASE_POINTS[2]) return 3;
  if (investedLevel >= PHASE_POINTS[1]) return 2;
  return 1;
}
function getSigilAbilityTuning(slot, investedLevel = 1) {
  const maxLevel = slot === "R" ? 5 : 15;
  investedLevel = clamp5(Math.round(investedLevel || 1), 1, maxLevel);
  const phase = getPhase2(slot, investedLevel);
  const lvl = slot === "R" ? getUltimateSkillLevel(investedLevel) : getNormalSkillLevel(investedLevel);
  const tuning2 = {
    investedLevel,
    phase,
    passive: SIGIL_PASSIVE,
    energyCost: 0,
    baseCooldown: 0,
    castTime: 0,
    aProjectileRange: 0,
    aProjectileWidth: 0,
    aProjectileSpeed: 0,
    aImpactDamageFlat: 0,
    aImpactDamagePct: 0,
    aPierceCount: 0,
    aImpactRunes: 1,
    aRevealThreshold: phase >= 3 ? 3 : 0,
    aRevealDuration: phase >= 3 ? 1.6 : 0,
    aHealCutThreshold: phase >= 4 ? 5 : 0,
    aHealCutPct: phase >= 4 ? 0.3 : 0,
    aHealCutDuration: phase >= 4 ? 2.5 : 0,
    aDetonationStasisDuration: phase >= 5 ? 0.4 : 0,
    zRunePulseInterval: 1,
    zRunePulseStacks: phase >= 2 ? 1 : 0,
    zCanRecastClose: phase >= 3,
    zClosePullStrength: phase >= 4 ? 120 : 0,
    zCloseControlThresholdRunes: 3,
    zCloseSuppressDuration: phase >= 5 ? 0.7 : 0,
    eTrailSlowPct: phase >= 2 ? 0.18 : 0,
    eTrailSlowDuration: phase >= 2 ? 1.2 : 0,
    aEmpowerFromVeilDamagePct: phase >= 3 ? 0.14 : 0,
    eSpellShieldOnEndDuration: phase >= 4 ? 0.4 : 0,
    eGroundedDurationOnMaxRunes: phase >= 5 ? 0.8 : 0,
    eGroundedCheckRadius: 260,
    ultRevealOnAHitDuration: phase >= 2 ? 2 : 0,
    ultHealCutThresholdRunes: phase >= 3 ? 4 : 0,
    ultHealCutPct: phase >= 3 ? 0.3 : 0,
    ultHealCutDuration: phase >= 3 ? 2 : 0,
    ultZoneCamouflageDuration: phase >= 4 ? 0.45 : 0,
    ultDetonationStunDuration: phase >= 5 ? 0.35 : 0,
    zCastRange: 0,
    zZoneRadius: 0,
    zZoneDuration: 0,
    zZoneDamageFlatPerSecond: 0,
    zZoneDamageWeaponPctPerSecond: 0,
    zZoneSlowPct: 0,
    eDashDistance: 0,
    eCamouflageDuration: 0,
    eTrailDuration: 0,
    ultDuration: 0,
    ultRuneDurationBonusPct: 0,
    ultACooldownMultiplier: 1,
    ultLifestealPct: 0
  };
  if (slot === "A") {
    tuning2.castTime = 0.12;
    tuning2.energyCost = 14;
    tuning2.baseCooldown = Math.max(3.7, 5.8 - 0.07 * (lvl - 1));
    tuning2.aProjectileRange = 760;
    tuning2.aProjectileWidth = 26 + 0.4 * Math.floor((lvl - 1) * 0.5);
    tuning2.aProjectileSpeed = 1260;
    tuning2.aImpactDamageFlat = 12 + 2.4 * (lvl - 1);
    tuning2.aImpactDamagePct = 0.62 + 0.018 * (lvl - 1);
    tuning2.aPierceCount = phase >= 2 ? 32 : 0;
  } else if (slot === "Z") {
    tuning2.energyCost = 20;
    tuning2.baseCooldown = Math.max(13.6, 16 - 0.08 * (lvl - 1));
    tuning2.zCastRange = 420;
    tuning2.zZoneRadius = 110 + 2.5 * (lvl - 1);
    tuning2.zZoneDuration = 4.8 + 0.08 * (lvl - 1);
    tuning2.zZoneDamageFlatPerSecond = 7 + 1.4 * (lvl - 1);
    tuning2.zZoneDamageWeaponPctPerSecond = 0.24 + 0.016 * (lvl - 1);
    tuning2.zZoneSlowPct = 0.22;
  } else if (slot === "E") {
    tuning2.energyCost = 24;
    tuning2.baseCooldown = Math.max(15.1, 18 - 0.1 * (lvl - 1));
    tuning2.eDashDistance = 150 + 5 * (lvl - 1);
    tuning2.eCamouflageDuration = 0.75 + 0.03 * (lvl - 1);
    tuning2.eTrailDuration = 1.2 + 0.03 * (lvl - 1);
  } else if (slot === "R") {
    tuning2.energyCost = 38;
    tuning2.baseCooldown = Math.max(57, 70 - 0.45 * (lvl - 1));
    tuning2.ultDuration = 5.6;
    tuning2.ultRuneDurationBonusPct = 0.3 + 9e-3 * (lvl - 1);
    tuning2.ultACooldownMultiplier = Math.max(0.66, 0.78 - 8e-3 * Math.floor((lvl - 1) / 2));
    tuning2.ultLifestealPct = 0.06 + 55e-4 * (lvl - 1);
  }
  return tuning2;
}

// shared/content/frames/bulwark/BulwarkFrameSpec.js
var BULWARK_PASSIVE = Object.freeze({
  maxPlates: 5,
  plateDuration: 7,
  plateGainInternalCooldown: 0.45,
  plateBurstWindow: 0.75,
  plateBurstThresholdPctMaxHp: 0.07,
  plateArmorPerPlate: 4,
  plateDamageReductionPerPlate: 0.02,
  plateTenacityPerPlate: 0.04,
  plateShieldPctMaxHp: 0.1,
  plateShieldArmorPct: 0.35,
  armorToAttackDamagePct: 0.18,
  armorToOnHitDamagePct: 0.08,
  empoweredDuration: 4,
  empoweredArmorToAttackDamagePct: 0.24,
  empoweredArmorToOnHitDamagePct: 0.12
});
function clamp6(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
function getSkillLevel(slot, investedLevel) {
  return slot === "R" ? clamp6(investedLevel, 1, 5) : 1 + (clamp6(investedLevel, 1, 15) - 1) * (29 / 14);
}
function getPhase3(slot, investedLevel) {
  if (slot === "R") return clamp6(investedLevel, 1, 5);
  if (investedLevel >= 15) return 5;
  if (investedLevel >= 10) return 4;
  if (investedLevel >= 6) return 3;
  if (investedLevel >= 3) return 2;
  return 1;
}
function getBulwarkAbilityTuning(slot, investedLevel = 1, totalArmor = 0) {
  const maxLevel = slot === "R" ? 5 : 15;
  investedLevel = clamp6(Math.round(investedLevel || 1), 1, maxLevel);
  const phase = getPhase3(slot, investedLevel);
  const lvl = getSkillLevel(slot, investedLevel);
  const tuning2 = {
    investedLevel,
    phase,
    passive: BULWARK_PASSIVE,
    energyCost: 0,
    baseCooldown: 0,
    castTime: 0,
    anchorDuration: 0,
    anchorSelfSlowPct: 0,
    anchorArmorFlat: 0,
    anchorDamageReductionPct: 0,
    anchorReflectPct: 0,
    anchorReflectMinDamage: 0,
    anchorReflectMaxDamage: 0,
    anchorPulseSlowPct: 0,
    anchorPulseSlowDuration: 0,
    anchorPulseRadius: 0,
    anchorTauntedBonusFlat: 0,
    anchorTauntedBonusArmorPct: 0,
    anchorSingleHitCapPctMaxHp: 0,
    harpoonRange: 0,
    harpoonWidth: 0,
    harpoonProjectileSpeed: 0,
    harpoonDamageFlat: 0,
    harpoonDamageWeaponPct: 0,
    harpoonDamageArmorPct: 0,
    harpoonTauntDuration: 0,
    harpoonSelfHastePct: 0,
    harpoonArmorShredPct: 0,
    harpoonArmorShredDuration: 0,
    harpoonGroundedDuration: 0,
    harpoonDashDistance: 0,
    harpoonPullStrength: 0,
    meditationDuration: 0,
    meditationHealMissingPctPerSecond: 0,
    meditationSelfSlowPct: 0,
    meditationShieldPctMaxHp: 0,
    meditationShieldArmorPct: 0,
    meditationDamageReductionPct: 0,
    meditationFinalSlowPct: 0,
    meditationFinalSlowDuration: 0,
    meditationCastUnstoppableDuration: 0,
    meditationCleanseSilenceDisarmRoot: false,
    meditationPulseRadius: 0,
    meditationFinalGroundedDuration: 0,
    stormDuration: 0,
    stormRadius: 0,
    stormInnerRadius: 0,
    stormBaseDpsFlat: 0,
    stormBaseDpsPct: 0,
    stormSlowPct: 0,
    stormTauntedDamageAmpPct: 0,
    stormExposureStunThreshold: 0,
    stormExposureStunDuration: 0,
    stormPullStrength: 0,
    stormPullInterval: 0,
    stormPullWindow: 0,
    stormArmorStealPerSecond: 0,
    stormStealCap: 0,
    stormShieldGainPctMaxShieldPerTick: 0,
    stormShieldGainTickInterval: 0,
    stormShieldGainCapPctMaxShield: 0
  };
  if (slot === "A") {
    tuning2.energyCost = 28;
    tuning2.baseCooldown = Math.max(11.9, 16 - 0.14 * (lvl - 1));
    tuning2.anchorDuration = 2.75 + 0.035 * (lvl - 1);
    tuning2.anchorSelfSlowPct = Math.max(0, 0.18 - 15e-4 * (lvl - 1));
    tuning2.anchorArmorFlat = 12 + 0.5 * (lvl - 1);
    tuning2.anchorDamageReductionPct = 0.1 + 3e-3 * (lvl - 1);
    tuning2.anchorReflectPct = 0.2 + 55e-4 * (lvl - 1);
    tuning2.anchorReflectMinDamage = 10 + 1.2 * (lvl - 1) + totalArmor * 0.15;
    tuning2.anchorReflectMaxDamage = 28 + 1.1 * (lvl - 1) + totalArmor * 0.3;
    tuning2.anchorPulseSlowPct = phase >= 3 ? 0.25 : 0;
    tuning2.anchorPulseSlowDuration = phase >= 3 ? 1 : 0;
    tuning2.anchorPulseRadius = phase >= 3 ? 150 : 0;
    tuning2.anchorTauntedBonusFlat = phase >= 4 ? 6 + 0.55 * (lvl - 1) : 0;
    tuning2.anchorTauntedBonusArmorPct = phase >= 4 ? 0.08 : 0;
    tuning2.anchorSingleHitCapPctMaxHp = phase >= 5 ? 0.2 : 0;
  } else if (slot === "Z") {
    tuning2.castTime = 0.15;
    tuning2.energyCost = 40;
    tuning2.baseCooldown = Math.max(15.9, 20 - 0.14 * (lvl - 1));
    tuning2.harpoonRange = 620 + 2 * Math.floor((lvl - 1) * 0.5);
    tuning2.harpoonWidth = 28;
    tuning2.harpoonProjectileSpeed = 1200;
    tuning2.harpoonDamageFlat = 50 + 4.5 * (lvl - 1);
    tuning2.harpoonDamageWeaponPct = 0.7 + 0.012 * (lvl - 1);
    tuning2.harpoonDamageArmorPct = 0.25 + 7e-3 * (lvl - 1);
    tuning2.harpoonTauntDuration = 2.1;
    tuning2.harpoonSelfHastePct = 0.25;
    tuning2.harpoonArmorShredPct = phase >= 2 ? 0.12 + 3e-3 * (lvl - 1) : 0;
    tuning2.harpoonArmorShredDuration = phase >= 2 ? 4 : 0;
    tuning2.harpoonGroundedDuration = phase >= 3 ? 1 + 0.015 * (lvl - 1) : 0;
    tuning2.harpoonDashDistance = phase >= 4 ? 120 : 0;
    tuning2.harpoonPullStrength = phase >= 5 ? 110 : 0;
  } else if (slot === "E") {
    tuning2.castTime = 0.12;
    tuning2.energyCost = 36;
    tuning2.baseCooldown = Math.max(14.4, 18 - 0.12 * (lvl - 1));
    tuning2.meditationDuration = 2.25 + 0.02 * (lvl - 1);
    tuning2.meditationSelfSlowPct = Math.max(0, 0.35 - 8e-4 * (lvl - 1));
    tuning2.meditationDamageReductionPct = 0.22 + 55e-4 * (lvl - 1);
    tuning2.meditationHealMissingPctPerSecond = 0.05 + 22e-4 * (lvl - 1);
    tuning2.meditationShieldPctMaxHp = 0.08 + 28e-4 * (lvl - 1);
    tuning2.meditationShieldArmorPct = 0.25 + 65e-4 * (lvl - 1);
    tuning2.meditationCastUnstoppableDuration = phase >= 2 ? 0.5 : 0;
    tuning2.meditationFinalSlowPct = phase >= 3 ? 0.2 : 0;
    tuning2.meditationFinalSlowDuration = phase >= 3 ? 1 : 0;
    tuning2.meditationPulseRadius = phase >= 3 ? 170 : 0;
    tuning2.meditationCleanseSilenceDisarmRoot = phase >= 4;
    tuning2.meditationFinalGroundedDuration = phase >= 5 ? 1.25 : 0;
  } else if (slot === "R") {
    tuning2.energyCost = 75;
    tuning2.baseCooldown = Math.max(72.5, 110 - 1.25 * (investedLevel - 1));
    tuning2.stormDuration = 5 + 0.04 * (investedLevel - 1);
    tuning2.stormRadius = 180 + 1.4 * Math.floor((investedLevel - 1) * 0.5);
    tuning2.stormInnerRadius = 90 + 0.55 * Math.floor((investedLevel - 1) * 0.5);
    tuning2.stormBaseDpsFlat = 18 + 1.6 * (investedLevel - 1);
    tuning2.stormBaseDpsPct = 0.08 + 2e-3 * (investedLevel - 1);
    tuning2.stormSlowPct = 0.2;
    tuning2.stormTauntedDamageAmpPct = phase >= 2 ? 0.12 : 0;
    tuning2.stormExposureStunThreshold = phase >= 5 ? 2.6 : 0;
    tuning2.stormExposureStunDuration = phase >= 5 ? 1 : 0;
    tuning2.stormPullStrength = phase >= 5 ? 60 : 0;
    tuning2.stormPullInterval = phase >= 5 ? 0.8 : 0;
    tuning2.stormPullWindow = phase >= 5 ? 1.6 : 0;
    tuning2.stormArmorStealPerSecond = 4;
    tuning2.stormStealCap = 14;
    tuning2.stormShieldGainPctMaxShieldPerTick = phase >= 4 ? 0.03 : 0;
    tuning2.stormShieldGainTickInterval = phase >= 4 ? 1.2 : 0;
    tuning2.stormShieldGainCapPctMaxShield = phase >= 4 ? 0.09 : 0;
  }
  return tuning2;
}

// client/src/ui/session/SessionSetupCatalog.js
var FRAME_META = Object.freeze({
  vanguard: { accent: "#7de9ff" },
  sigil: { accent: "#a977ff" },
  bulwark: { accent: "#ffc866" }
});
var STAT_LABELS = Object.freeze([
  ["maxHp", "Coque"],
  ["maxShield", "Bouclier"],
  ["maxEnergy", "\xC9nergie"],
  ["engine", "Vitesse"],
  ["baseArmor", "Armure"]
]);
var PHASE_TO_LEVEL = Object.freeze({ 1: 1, 2: 3, 3: 6, 4: 10, 5: 15 });
function fmt2(v, digits = 1) {
  if (!Number.isFinite(v)) return "0";
  return v >= 10 ? v.toFixed(0) : v.toFixed(digits);
}
function pct2(v, digits = 0) {
  return `${((v ?? 0) * 100).toFixed(digits)}%`;
}
function levelFor(slot, phase) {
  if (slot === "R") return Math.max(1, Math.min(5, phase | 0));
  return PHASE_TO_LEVEL[Math.max(1, Math.min(5, phase | 0))] || 1;
}
function getTuning(frameId, slot, phase) {
  const level = levelFor(slot, phase);
  if (frameId === "sigil") return getSigilAbilityTuning(slot, level);
  if (frameId === "bulwark") return getBulwarkAbilityTuning(slot, level, 0);
  return getVanguardAbilityTuning(slot, level, 0);
}
function vanguardLines(slot, phase) {
  const t = getTuning("vanguard", slot, phase);
  if (slot === "A") return [
    `Tir lin\xE9aire : ${fmt2(t.damageFlat)} + ${pct2(t.damagePct, 0)} des d\xE9g\xE2ts d\u2019arme.`,
    `Port\xE9e ${fmt2(t.projectileRange, 0)}, largeur ${fmt2(t.projectileWidth, 0)}.`,
    `Charge ${t.empowerCharges ?? 0} auto renforc\xE9e(s), cap selon phase.`,
    t.pierceCount > 0 ? "Traverse une cible suppl\xE9mentaire." : "",
    t.damageAmpPct > 0 ? `Applique Vuln\xE9rabilit\xE9 ${pct2(t.damageAmpPct)} pendant ${fmt2(t.damageAmpDuration)} s.` : "",
    t.disarmDuration > 0 ? `Sur cible d\xE9j\xE0 vuln\xE9rable : D\xE9sarmement ${fmt2(t.disarmDuration)} s.` : "",
    `Co\xFBt ${fmt2(t.energyCost, 0)} \xE9nergie \u2014 Recast ${fmt2(t.baseCooldown ?? 0)} s.`
  ];
  if (slot === "Z") return [
    `Ru\xE9e de ${fmt2(t.dashDistance, 0)} puis +${pct2(t.moveBoostPct)} vitesse pendant ${fmt2(t.moveBoostDuration)} s.`,
    t.trailSlowPct > 0 ? `Tra\xEEn\xE9e : Ralentissement ${pct2(t.trailSlowPct)} pendant ${fmt2(t.trailSlowDuration)} s.` : "",
    t.comboWindowDuration > 0 ? `Fen\xEAtre combo : prochain A +${pct2(t.comboProjectileSpeedPct)} vitesse projectile et +${pct2(t.comboDamagePct)} d\xE9g\xE2ts.` : "",
    t.cleanseSlowAndRoot ? "Purge ralentissement et root \xE0 l\u2019activation." : "",
    `Co\xFBt ${fmt2(t.energyCost, 0)} \xE9nergie \u2014 Recast ${fmt2(t.baseCooldown ?? 0)} s.`
  ];
  if (slot === "E") return [
    `Phase : ${pct2(t.damageReductionPct)} r\xE9duction de d\xE9g\xE2ts pendant ${fmt2(t.phaseDuration)} s.`,
    t.spellShieldDuration > 0 ? `\xC0 la sortie : bouclier anti-sort ${fmt2(t.spellShieldDuration)} s.` : "",
    t.exitRadius > 0 ? `Onde de sortie : Grounded ${fmt2(t.groundedDuration)} s dans ${fmt2(t.exitRadius, 0)}.` : "",
    t.exitShieldPctMaxShield > 0 ? `Rend ${pct2(t.exitShieldPctMaxShield)} du bouclier max.` : "",
    t.restoreAChargeOnMaxHeat ? "Si lanc\xE9 \xE0 10 Surchauffe : rend 1 charge de A \xE0 la fin." : "",
    `Co\xFBt ${fmt2(t.energyCost, 0)} \xE9nergie \u2014 Recast ${fmt2(t.baseCooldown ?? 0)} s.`
  ];
  return [
    `Fr\xE9n\xE9sie ${fmt2(t.ultDuration)} s : +${pct2(t.ultAttackSpeedPct)} cadence, +${pct2(t.ultMoveSpeedPct)} vitesse.`,
    `Autos : +${pct2(t.ultEmpowerPct)} d\xE9g\xE2ts pendant R.`,
    t.ultBurnDuration > 0 ? `Auto sur cible marqu\xE9e par A : Br\xFBlure ${fmt2(t.ultBurnDuration)} s.` : "",
    t.unstoppableDuration > 0 ? `Z pendant R : Inarr\xEAtable ${fmt2(t.unstoppableDuration)} s.` : "",
    t.ultCloseAStunDuration > 0 ? `A proche pendant R : \xC9tourdissement ${fmt2(t.ultCloseAStunDuration)} s.` : "",
    `Co\xFBt ${fmt2(t.energyCost, 0)} \xE9nergie \u2014 Recast ${fmt2(t.baseCooldown ?? 0)} s.`
  ];
}
function sigilLines(slot, phase) {
  const t = getTuning("sigil", slot, phase);
  if (slot === "A") return [
    `Projectile runique : ${fmt2(t.aImpactDamageFlat)} + ${pct2(t.aImpactDamagePct)} d\xE9g\xE2ts d\u2019arme.`,
    "Pose 1 rune. Les runes amplifient les prochaines touches.",
    t.aPierceCount > 0 ? "Phase 2 : traverse largement les cibles." : "",
    t.aRevealThreshold > 0 ? `\xC0 ${t.aRevealThreshold} runes : r\xE9v\xE8le la cible.` : "",
    t.aHealCutThreshold > 0 ? `\xC0 ${t.aHealCutThreshold} runes : anti-soin ${pct2(t.aHealCutPct)}.` : "",
    t.aDetonationStasisDuration > 0 ? "D\xE9tonation maximale : stase courte." : "",
    `Co\xFBt ${fmt2(t.energyCost, 0)} \xE9nergie \u2014 Recast ${fmt2(t.baseCooldown ?? 0)} s.`
  ];
  if (slot === "Z") return [
    `Zone ${fmt2(t.zZoneRadius, 0)} pendant ${fmt2(t.zZoneDuration)} s.`,
    `D\xE9g\xE2ts/s : ${fmt2(t.zZoneDamageFlatPerSecond)} + ${pct2(t.zZoneDamageWeaponPctPerSecond)} arme.`,
    `Ralentit de ${pct2(t.zZoneSlowPct)}.`,
    t.zRunePulseStacks > 0 ? "Pulse : ajoute des runes aux ennemis dans la zone." : "",
    t.zCanRecastClose ? "R\xE9activation : ferme la zone et contr\xF4le les cibles run\xE9es." : "",
    `Co\xFBt ${fmt2(t.energyCost, 0)} \xE9nergie \u2014 Recast ${fmt2(t.baseCooldown ?? 0)} s.`
  ];
  if (slot === "E") return [
    `Dash de ${fmt2(t.eDashDistance, 0)} et camouflage ${fmt2(t.eCamouflageDuration)} s.`,
    t.eTrailSlowPct > 0 ? `Tra\xEEn\xE9e : slow ${pct2(t.eTrailSlowPct)} pendant ${fmt2(t.eTrailSlowDuration)} s.` : "",
    t.aEmpowerFromVeilDamagePct > 0 ? `A lanc\xE9 depuis le voile : +${pct2(t.aEmpowerFromVeilDamagePct)} d\xE9g\xE2ts.` : "",
    t.eSpellShieldOnEndDuration > 0 ? `Fin du voile : bouclier anti-sort ${fmt2(t.eSpellShieldOnEndDuration)} s.` : "",
    `Co\xFBt ${fmt2(t.energyCost, 0)} \xE9nergie \u2014 Recast ${fmt2(t.baseCooldown ?? 0)} s.`
  ];
  return [
    `Convergence ${fmt2(t.ultDuration)} s.`,
    `Runes durent +${pct2(t.ultRuneDurationBonusPct)}.`,
    `Cooldown de A multipli\xE9 par x${fmt2(t.ultACooldownMultiplier, 2)}.`,
    `Vol de vie : ${pct2(t.ultLifestealPct, 1)}.`,
    t.ultDetonationStunDuration > 0 ? `D\xE9tonation max : stun ${fmt2(t.ultDetonationStunDuration)} s.` : "",
    `Co\xFBt ${fmt2(t.energyCost, 0)} \xE9nergie \u2014 Recast ${fmt2(t.baseCooldown ?? 0)} s.`
  ];
}
function bulwarkLines(slot, phase) {
  const t = getTuning("bulwark", slot, phase);
  if (slot === "A") return [
    `Ancrage ${fmt2(t.anchorDuration)} s : armure +${fmt2(t.anchorArmorFlat)}.`,
    `R\xE9duction ${pct2(t.anchorDamageReductionPct)} et reflet ${pct2(t.anchorReflectPct)}.`,
    t.anchorPulseRadius > 0 ? `Pulse slow ${pct2(t.anchorPulseSlowPct)} dans ${fmt2(t.anchorPulseRadius, 0)}.` : "",
    t.anchorTauntedBonusFlat > 0 ? "Bonus de d\xE9g\xE2ts contre les cibles provoqu\xE9es." : "",
    t.anchorSingleHitCapPctMaxHp > 0 ? `Cap de gros hit : ${pct2(t.anchorSingleHitCapPctMaxHp)} PV max.` : "",
    `Co\xFBt ${fmt2(t.energyCost, 0)} \xE9nergie \u2014 Recast ${fmt2(t.baseCooldown ?? 0)} s.`
  ];
  if (slot === "Z") return [
    `Harpon ${fmt2(t.harpoonRange, 0)} : ${fmt2(t.harpoonDamageFlat)} + ${pct2(t.harpoonDamageWeaponPct)} arme + armure.`,
    `Provoque ${fmt2(t.harpoonTauntDuration)} s.`,
    t.harpoonArmorShredPct > 0 ? `Shred armure ${pct2(t.harpoonArmorShredPct)} pendant ${fmt2(t.harpoonArmorShredDuration)} s.` : "",
    t.harpoonGroundedDuration > 0 ? `Grounded ${fmt2(t.harpoonGroundedDuration)} s.` : "",
    t.harpoonDashDistance > 0 ? "Dash vers la cible touch\xE9e." : "",
    t.harpoonPullStrength > 0 ? "Tire la cible vers toi." : "",
    `Co\xFBt ${fmt2(t.energyCost, 0)} \xE9nergie \u2014 Recast ${fmt2(t.baseCooldown ?? 0)} s.`
  ];
  if (slot === "E") return [
    `M\xE9ditation ${fmt2(t.meditationDuration)} s : r\xE9duction ${pct2(t.meditationDamageReductionPct)}.`,
    "Soigne les PV manquants et donne un bouclier \xE0 la fin.",
    t.meditationCastUnstoppableDuration > 0 ? `D\xE9but : Inarr\xEAtable ${fmt2(t.meditationCastUnstoppableDuration)} s.` : "",
    t.meditationPulseRadius > 0 ? `Fin : slow dans ${fmt2(t.meditationPulseRadius, 0)}.` : "",
    t.meditationCleanseSilenceDisarmRoot ? "Purge silence, d\xE9sarmement et root." : "",
    t.meditationFinalGroundedDuration > 0 ? `Fin : Grounded ${fmt2(t.meditationFinalGroundedDuration)} s.` : "",
    `Co\xFBt ${fmt2(t.energyCost, 0)} \xE9nergie \u2014 Recast ${fmt2(t.baseCooldown ?? 0)} s.`
  ];
  return [
    `Temp\xEAte ${fmt2(t.stormDuration)} s, rayon ${fmt2(t.stormRadius, 0)}.`,
    `D\xE9g\xE2ts/s : ${fmt2(t.stormBaseDpsFlat)} + ${pct2(t.stormBaseDpsPct)} arme.`,
    `Ralentit de ${pct2(t.stormSlowPct)}.`,
    t.stormTauntedDamageAmpPct > 0 ? `Cibles provoqu\xE9es : +${pct2(t.stormTauntedDamageAmpPct)} d\xE9g\xE2ts subis.` : "",
    t.stormExposureStunThreshold > 0 ? `Exposition prolong\xE9e : stun ${fmt2(t.stormExposureStunDuration)} s.` : "",
    t.stormPullStrength > 0 ? "La temp\xEAte attire p\xE9riodiquement les ennemis." : "",
    `Co\xFBt ${fmt2(t.energyCost, 0)} \xE9nergie \u2014 Recast ${fmt2(t.baseCooldown ?? 0)} s.`
  ];
}
function passiveEntry(frameId) {
  if (frameId === "sigil") return {
    key: "P",
    label: "Runes",
    name: "Passif \u2014 Runes",
    lines: [
      "Les tirs et sorts posent des runes sur les cibles.",
      "3 runes : ralentissement. 5 runes : d\xE9tonation automatique."
    ]
  };
  if (frameId === "bulwark") return {
    key: "P",
    label: "Plaques r\xE9actives",
    name: "Passif \u2014 Plaques r\xE9actives",
    lines: [
      "Les gros d\xE9g\xE2ts re\xE7us g\xE9n\xE8rent des plaques temporaires.",
      "Chaque plaque donne armure, r\xE9duction de d\xE9g\xE2ts et t\xE9nacit\xE9.",
      "\xC0 pleine charge : bouclier et attaques renforc\xE9es par l\u2019armure."
    ]
  };
  return {
    key: "P",
    label: "Surchauffe",
    name: "Passif \u2014 Surchauffe",
    lines: [
      "Les attaques et comp\xE9tences qui touchent donnent 1 charge pendant 5 s.",
      "Par charge : cadence, vitesse moteur et r\xE9sistance aux ralentissements.",
      "\xC0 6 charges : t\xE9nacit\xE9. \xC0 10 charges : Z/E d\xE9clenche la t\xE9nacit\xE9 de surchauffe."
    ]
  };
}
function abilityLines(frameId, slot, phase) {
  if (slot === "P") return passiveEntry(frameId).lines;
  if (frameId === "sigil") return sigilLines(slot, phase).filter(Boolean);
  if (frameId === "bulwark") return bulwarkLines(slot, phase).filter(Boolean);
  return vanguardLines(slot, phase).filter(Boolean);
}
var GUIDE = Object.freeze({
  vanguard: [
    "\xC0 retenir : Surchauffe monte quand les attaques et comp\xE9tences touchent. Les charges durent 5 s.",
    "Combo simple : Z puis A pendant la fen\xEAtre combo. Phase 3 de Z ajoute vitesse projectile et d\xE9g\xE2ts au prochain A.",
    "\xC0 10 Surchauffe, Z/E d\xE9clenche la t\xE9nacit\xE9 de surchauffe. E peut aussi rendre une charge de A en phase 5.",
    "Stuff recherch\xE9 : cadence, d\xE9g\xE2ts d\u2019arme, mobilit\xE9, \xE9nergie/recast si tu veux encha\xEEner Z + A plus souvent."
  ],
  sigil: [
    "\xC0 retenir : les tirs et sorts posent des runes. 3 runes ralentissent, 5 runes d\xE9clenchent une d\xE9tonation.",
    "Combo simple : Z pour forcer la zone, A pour ajouter les runes, puis R pour prolonger les runes et r\xE9duire le cycle de A.",
    "E sert au repositionnement : dash + camouflage, puis A depuis le voile gagne des d\xE9g\xE2ts \xE0 partir de la phase 3.",
    "Stuff recherch\xE9 : \xE9nergie, recast, d\xE9g\xE2ts d\u2019arme, effets qui aident \xE0 maintenir les cibles dans les zones."
  ],
  bulwark: [
    "\xC0 retenir : les gros d\xE9g\xE2ts re\xE7us donnent des plaques. Chaque plaque donne armure, r\xE9duction de d\xE9g\xE2ts et t\xE9nacit\xE9.",
    "Combo simple : Z pour provoquer, A pour ancrer et r\xE9duire les d\xE9g\xE2ts, R quand la cible reste au contact.",
    "E est d\xE9fensif : r\xE9duction pendant la canalisation, soin des PV manquants et bouclier \xE0 la fin.",
    "Stuff recherch\xE9 : armure, PV, bouclier, r\xE9duction de d\xE9g\xE2ts, puis d\xE9g\xE2ts d\u2019arme si tu veux convertir l\u2019armure en menace."
  ]
});
function buildStatScale() {
  const defs = SHIP_FRAME_ORDER.map((id) => getShipFrameDef(id));
  const scale = /* @__PURE__ */ new Map();
  for (const [key] of STAT_LABELS) {
    const values = defs.map((def) => Number(def?.stats?.[key] ?? 0));
    scale.set(key, { min: Math.min(...values), max: Math.max(...values) });
  }
  return scale;
}
var STAT_SCALE = buildStatScale();
function normalizeStat(key, value) {
  const scale = STAT_SCALE.get(key);
  if (!scale || scale.max <= scale.min) return 0.5;
  return (value - scale.min) / (scale.max - scale.min);
}
var SCENARIOS = Object.freeze({
  vanguard: {
    A: { 1: ["A1", "A1 + auto"], 2: ["A1", "A1 + auto"], 3: ["A1", "A1 + auto"], 4: ["A1", "A1 + auto"], 5: ["A1", "A1 + auto"] },
    Z: { 1: ["Z1"], 2: ["Z1"], 3: ["Z1", "A1 + Z1"], 4: ["Z1", "A1 + Z1", "Z1 purge"], 5: ["Z1", "A1 + Z1", "Z1 purge", "A1 impact + Z1"] },
    E: { 1: ["E1"], 2: ["E1", "E1 bouclier anti-sort"], 3: ["E1", "E1 bouclier anti-sort", "E1 grounded"], 4: ["E1", "E1 bouclier anti-sort", "E1 grounded", "E1 bouclier final"], 5: ["E1", "E1 bouclier anti-sort", "E1 grounded", "E1 bouclier final", "E1 + auto"] },
    R: { 1: ["R1 vs auto"], 2: ["R1 vs auto", "R1 contact"], 3: ["R1 vs auto", "R1 contact", "A1 + R1"], 4: ["R1 vs auto", "R1 contact", "A1 + R1", "Z1 + R1"], 5: ["R1 vs auto", "R1 contact", "A1 + R1", "Z1 + R1", "R1 kill x2"] },
    P: { 1: ["P(6)", "P(10) + Z1", "P(10) + E1"], 2: ["P(6)", "P(10) + Z1", "P(10) + E1"], 3: ["P(6)", "P(10) + Z1", "P(10) + E1"], 4: ["P(6)", "P(10) + Z1", "P(10) + E1"], 5: ["P(6)", "P(10) + Z1", "P(10) + E1"] }
  },
  sigil: {
    A: { 1: ["A1", "A1 x3", "A1 x5"], 2: ["A1", "A1 x3", "A1 x5"], 3: ["A1", "A1 x3", "A1 x5"], 4: ["A1", "A1 x3", "A1 x5"], 5: ["A1", "A1 x3", "A1 x5"] },
    Z: { 1: ["Z1"], 2: ["Z1 + A1"], 3: ["Z1 + A1"], 4: ["Z1 + A1", "Z1 fermeture"], 5: ["Z1 + A1", "Z1 fermeture"] },
    E: { 1: ["E1"], 2: ["E1"], 3: ["E1 + A1"], 4: ["E1 + A1"], 5: ["E1 + A1", "E1 bouclier anti-sort"] },
    R: { 1: ["R1 + A1"], 2: ["R1 + A1"], 3: ["R1 + A1 x3"], 4: ["R1 + A1 x3"], 5: ["R1 + d\xE9tonation"] },
    P: { 1: ["P(3)", "P(5)"], 2: ["P(3)", "P(5)"], 3: ["P(3)", "P(5)"], 4: ["P(3)", "P(5)"], 5: ["P(3)", "P(5)"] }
  },
  bulwark: {
    A: { 1: ["A1"], 2: ["A1"], 3: ["A1 pulse"], 4: ["A1 provocation"], 5: ["A1 cap gros hit"] },
    Z: { 1: ["Z1"], 2: ["Z1 shred"], 3: ["Z1 grounded"], 4: ["Z1 dash"], 5: ["Z1 pull"] },
    E: { 1: ["E1"], 2: ["E1 unstoppable"], 3: ["E1 pulse"], 4: ["E1 cleanse"], 5: ["E1 grounded"] },
    R: { 1: ["R1"], 2: ["R1 provocation"], 3: ["R1 stun"], 4: ["R1 pull"], 5: ["R1 pression"] },
    P: { 1: ["P plaques", "P pleine charge"], 2: ["P plaques", "P pleine charge"], 3: ["P plaques", "P pleine charge"], 4: ["P plaques", "P pleine charge"], 5: ["P plaques", "P pleine charge"] }
  }
});
function scenarioList(frameId, slot, phase) {
  const names = SCENARIOS[frameId]?.[slot]?.[Math.max(1, Math.min(5, phase | 0))] || ["Base"];
  return names.map((label, index) => ({ id: `${slot}-${index}`, label }));
}
function buildAbilityList(def) {
  const entries = Object.values(def.abilities || {}).map((entry) => ({
    key: entry.key,
    label: entry.label,
    name: entry.label,
    getLines: (phase) => abilityLines(def.id, entry.key, phase),
    getScenarios: (phase) => scenarioList(def.id, entry.key, phase)
  }));
  const passive = passiveEntry(def.id);
  entries.push({ ...passive, getLines: () => passive.lines, getScenarios: (phase) => scenarioList(def.id, "P", phase) });
  return entries;
}
function getSessionFrameCards() {
  return SHIP_FRAME_ORDER.map((frameId) => {
    const def = getShipFrameDef(frameId);
    const meta = FRAME_META[frameId] || {};
    return {
      id: def.id,
      name: def.name,
      shortName: def.shortName,
      role: def.role,
      difficulty: def.difficulty,
      accent: meta.accent || "#7de9ff",
      tagline: "",
      summary: "",
      guide: GUIDE[def.id] || [],
      abilities: buildAbilityList(def),
      stats: STAT_LABELS.map(([key, label]) => ({
        key,
        label,
        value: Number(def?.stats?.[key] ?? 0),
        fill01: normalizeStat(key, Number(def?.stats?.[key] ?? 0))
      }))
    };
  });
}

// client/src/fx/VisualFxStore.js
function colorForProjectile(p) {
  if (p.visualKind === "rocket") {
    if (p.visualAmmoEffect === "slow") return { r: 112, g: 190, b: 255 };
    if (p.visualAmmoEffect === "burn") return { r: 255, g: 142, b: 72 };
    if (p.visualAmmoEffect === "poison") return { r: 102, g: 225, b: 120 };
    if (p.visualAmmoEffect === "stun") return { r: 255, g: 224, b: 122 };
    return { r: 255, g: 176, b: 72 };
  }
  if (p.sourceAbilitySlot === "A") return { r: 98, g: 232, b: 255 };
  if (p.sourceAbilitySlot === "Z") return { r: 190, g: 150, b: 255 };
  if (p.sourceAbilitySlot === "E") return { r: 92, g: 255, b: 190 };
  if (p.sourceAbilitySlot === "R") return { r: 255, g: 205, b: 96 };
  return p.tint ?? { r: 130, g: 225, b: 255 };
}
function isNearSector(item, me) {
  if (!me) return true;
  return (item.sx == null || (item.sx | 0) === (me.sx | 0)) && (item.sy == null || (item.sy | 0) === (me.sy | 0));
}
var VisualFxStore = class {
  constructor() {
    this.trails = /* @__PURE__ */ new Map();
    this.impacts = [];
    this.rings = [];
    this.damageNumbers = [];
    this.castBursts = [];
    this.lastProjectiles = /* @__PURE__ */ new Map();
    this.lastAreas = /* @__PURE__ */ new Map();
    this.lastStatuses = /* @__PURE__ */ new Map();
  }
  sync(store, t) {
    const now = Number.isFinite(t) ? t : performance.now() / 1e3;
    const combatFx = store.consumePendingCombatFx?.() ?? [];
    for (const ev of combatFx) {
      if (ev?.type !== "damage") continue;
      const amount = Math.max(0, Number(ev.amount) || 0);
      if (amount <= 0) continue;
      const c = ev.crit ? { r: 255, g: 220, b: 92 } : ev.shielded ? { r: 90, g: 190, b: 255 } : ev.periodic ? { r: 125, g: 235, b: 118 } : { r: 255, g: 108, b: 92 };
      this.damageNumbers.push({
        x: ev.x + ((ev.targetId || 0) % 7 - 3) * 2.8,
        y: ev.y - 8 - (ev.targetId || 0) % 5 * 2,
        t: now,
        life: ev.crit ? 0.92 : 0.72,
        amount,
        crit: !!ev.crit,
        shielded: !!ev.shielded,
        periodic: !!ev.periodic,
        tag: ev.crit ? "CRIT" : ev.shielded ? "SHIELD" : ev.periodic ? "DOT" : "HULL",
        color: c
      });
    }
    const nextProjectiles = /* @__PURE__ */ new Map();
    for (const p of store.projectiles.values()) {
      nextProjectiles.set(p.id, { ...p });
      if (!this.lastProjectiles.has(p.id)) {
        const c = colorForProjectile(p);
        this.castBursts.push({
          x: p.x,
          y: p.y,
          t: now,
          life: p.visualKind === "rocket" ? 0.36 : 0.26,
          color: c,
          kind: p.visualKind === "rocket" ? "rocket-cast" : p.sourceAbilitySlot ? `ability-${p.sourceAbilitySlot}` : "shot-cast",
          radius: p.visualKind === "rocket" ? 24 : p.sourceAbilitySlot ? 19 : 12,
          rays: p.visualKind === "rocket" ? 12 : p.sourceAbilitySlot ? 8 : 5
        });
      }
      const trail = this.trails.get(p.id) ?? { points: [], kind: p.visualKind || "auto", color: colorForProjectile(p), born: now };
      trail.kind = p.visualKind || trail.kind;
      trail.color = colorForProjectile(p);
      trail.points.push({ x: p.x, y: p.y, t: now, r: p.radius || 3 });
      const mobShot = p.sourceKind === "mob" || String(p.visualKind || "").startsWith("mob_");
      const maxAge = mobShot ? 0.11 : trail.kind === "rocket" ? 0.42 : 0.22;
      const maxPoints = mobShot ? 5 : 16;
      trail.points = trail.points.filter((pt) => now - pt.t <= maxAge).slice(-maxPoints);
      this.trails.set(p.id, trail);
    }
    for (const [id, old] of this.lastProjectiles.entries()) {
      if (nextProjectiles.has(id)) continue;
      const color2 = colorForProjectile(old);
      const isRocket = old.visualKind === "rocket";
      this.impacts.push({
        x: old.x,
        y: old.y,
        t: now,
        life: isRocket ? 0.48 : 0.22,
        start: isRocket ? Math.max(8, old.radius || 6) : Math.max(3, old.radius || 3),
        end: isRocket ? Math.max(30, old.splashRadius || 34) : Math.max(13, (old.radius || 3) + 10),
        color: color2,
        rays: isRocket ? 12 : old.crit ? 10 : 6,
        kind: isRocket ? "rocket" : "hit"
      });
      this.trails.delete(id);
    }
    for (const [id, trail] of [...this.trails.entries()]) {
      trail.points = trail.points.filter((pt) => now - pt.t <= 0.55);
      if (!trail.points.length) this.trails.delete(id);
    }
    const nextAreas = /* @__PURE__ */ new Map();
    for (const a of store.areaEffects.values()) {
      nextAreas.set(a.id, a.durationLeft ?? 0);
      if (!this.lastAreas.has(a.id)) {
        this.rings.push({
          x: a.x,
          y: a.y,
          t: now,
          life: 0.45,
          start: Math.max(8, (a.radius || 20) * 0.18),
          end: a.radius || 40,
          color: a.color ?? { r: 90, g: 220, b: 255 },
          kind: "area-open"
        });
      }
    }
    this.lastAreas = nextAreas;
    this.syncStatusPops(store.players, "p", now, store.getMe?.());
    this.syncStatusPops(store.mobs, "m", now, store.getMe?.());
    this.syncStatusPops(store.asteroids, "a", now, store.getMe?.());
    this.impacts = this.impacts.filter((fx) => now - fx.t <= fx.life);
    this.rings = this.rings.filter((fx) => now - fx.t <= fx.life);
    this.damageNumbers = this.damageNumbers.filter((fx) => now - fx.t <= fx.life);
    this.castBursts = this.castBursts.filter((fx) => now - fx.t <= fx.life);
    this.lastProjectiles = nextProjectiles;
  }
  syncStatusPops(map, prefix, now, me) {
    for (const ent of map.values()) {
      if (!isNearSector(ent, me)) continue;
      const statuses = ent.statuses ?? [];
      const keyBase = `${prefix}:${ent.id}`;
      const old = this.lastStatuses.get(keyBase) ?? /* @__PURE__ */ new Set();
      const next = new Set(statuses.map((s) => s.id));
      for (const s of statuses) {
        if (old.has(s.id)) continue;
        this.rings.push({
          x: ent.x,
          y: ent.y,
          t: now,
          life: 0.42,
          start: Math.max(8, ent.radius || 14),
          end: Math.max(22, (ent.radius || 14) + 18),
          color: s.primaryColor ?? { r: 220, g: 220, b: 220 },
          kind: "status"
        });
      }
      this.lastStatuses.set(keyBase, next);
    }
  }
  drawTrails(ctx, view, camX, camY, t) {
    const dpr = view.dpr;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const trail of this.trails.values()) {
      const pts = trail.points;
      if (pts.length < 2) continue;
      for (let i = 1; i < pts.length; i += 1) {
        const a = pts[i - 1];
        const b = pts[i];
        const age = Math.max(0, t - b.t);
        const alpha = Math.max(0, 1 - age / (trail.kind === "rocket" ? 0.45 : 0.24)) * (i / pts.length);
        const mobTrail = String(trail.kind || "").startsWith("mob_");
        const width = (mobTrail ? 1.25 : trail.kind === "rocket" ? 6.2 : 3.2) * alpha + 0.45;
        const x0 = (a.x - camX + view.cssW * 0.5) * dpr;
        const y0 = (a.y - camY + view.cssH * 0.5) * dpr;
        const x1 = (b.x - camX + view.cssW * 0.5) * dpr;
        const y1 = (b.y - camY + view.cssH * 0.5) * dpr;
        const c = trail.color;
        ctx.strokeStyle = rgba(c.r, c.g, c.b, mobTrail ? 0.05 + alpha * 0.16 : 0.08 + alpha * 0.28);
        ctx.lineWidth = width * (mobTrail ? 1.75 : 2.8) * dpr;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.strokeStyle = rgba(255, 245, 210, mobTrail ? 0.04 + alpha * 0.15 : 0.1 + alpha * 0.34);
        ctx.lineWidth = Math.max(0.8, width * 0.52) * dpr;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  drawImpacts(ctx, view, camX, camY, t) {
    const dpr = view.dpr;
    ctx.save();
    ctx.lineCap = "round";
    for (const fx of this.castBursts) this.drawCastBurst(ctx, view, camX, camY, t, fx);
    for (const fx of this.rings) this.drawRing(ctx, view, camX, camY, t, fx);
    for (const fx of this.impacts) {
      this.drawRing(ctx, view, camX, camY, t, fx);
      const age = Math.max(0, t - fx.t);
      const k = Math.min(1, age / fx.life);
      const fade = Math.max(0, 1 - k);
      const c = fx.color;
      const sx = (fx.x - camX + view.cssW * 0.5) * dpr;
      const sy = (fx.y - camY + view.cssH * 0.5) * dpr;
      const rays = fx.rays || 6;
      const base = fx.end * (0.35 + 0.55 * k);
      for (let i = 0; i < rays; i += 1) {
        const a = Math.PI * 2 * i / rays + (fx.x * 0.017 + fx.y * 0.011);
        const r0 = (fx.start + base * 0.18) * dpr;
        const r1 = (fx.start + base) * dpr;
        ctx.strokeStyle = rgba(c.r, c.g, c.b, fade * 0.42);
        ctx.lineWidth = (fx.kind === "rocket" ? 2.2 : 1.4) * fade * dpr;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0);
        ctx.lineTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  drawCastBurst(ctx, view, camX, camY, t, fx) {
    const dpr = view.dpr;
    const age = Math.max(0, t - fx.t);
    const k = Math.min(1, age / fx.life);
    const fade = Math.max(0, 1 - k);
    const c = fx.color;
    const sx = (fx.x - camX + view.cssW * 0.5) * dpr;
    const sy = (fx.y - camY + view.cssH * 0.5) * dpr;
    const r = fx.radius * (0.25 + k * 0.95) * dpr;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rgba(c.r, c.g, c.b, fade * 0.55);
    ctx.lineWidth = Math.max(1, 2.2 * fade) * dpr;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
    const rays = fx.rays || 6;
    for (let i = 0; i < rays; i += 1) {
      const a = Math.PI * 2 * i / rays + t * 1.8;
      const r0 = r * 0.35;
      const r1 = r * (1.15 + 0.35 * k);
      ctx.strokeStyle = rgba(c.r, c.g, c.b, fade * 0.38);
      ctx.lineWidth = Math.max(0.8, 1.5 * fade) * dpr;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0);
      ctx.lineTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.restore();
  }
  drawDamageNumbers(ctx, view, camX, camY, t) {
    const dpr = view.dpr;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const fx of this.damageNumbers) {
      const age = Math.max(0, t - fx.t);
      const k = Math.min(1, age / fx.life);
      const fade = Math.max(0, 1 - k);
      const rise = (fx.crit ? 34 : 25) * (1 - Math.pow(1 - k, 1.8));
      const wobble = Math.sin(fx.t * 31.7 + age * 10.5) * 4 * (1 - k);
      const sx = (fx.x - camX + view.cssW * 0.5 + wobble) * dpr;
      const sy = (fx.y - camY + view.cssH * 0.5 - rise) * dpr;
      const c = fx.color;
      const txt = fx.amount >= 10 ? `${Math.round(fx.amount)}` : fx.amount.toFixed(1);
      const fontSize = (fx.crit ? 15 : 12.5) * (1 + 0.18 * (1 - k)) * dpr;
      ctx.font = `${fx.crit ? "800" : "700"} ${fontSize}px Segoe UI`;
      ctx.lineWidth = Math.max(2.4, 3.4 * dpr);
      ctx.strokeStyle = rgba(3, 5, 9, fade * 0.92);
      ctx.strokeText(txt, sx, sy);
      ctx.fillStyle = rgba(c.r, c.g, c.b, fade * 0.96);
      ctx.fillText(txt, sx, sy);
      if (fx.tag) {
        ctx.font = `${(fx.crit ? 8.8 : 7.2) * dpr}px Segoe UI`;
        ctx.fillStyle = rgba(c.r, c.g, c.b, fade * 0.72);
        ctx.fillText(fx.tag, sx, sy + (fx.crit ? 13 : 11) * dpr);
      }
    }
    ctx.restore();
  }
  drawRing(ctx, view, camX, camY, t, fx) {
    const dpr = view.dpr;
    const age = Math.max(0, t - fx.t);
    const k = Math.min(1, age / fx.life);
    const eased = 1 - Math.pow(1 - k, 2.4);
    const fade = Math.max(0, 1 - k);
    const r = fx.start + (fx.end - fx.start) * eased;
    const c = fx.color;
    const sx = (fx.x - camX + view.cssW * 0.5) * dpr;
    const sy = (fx.y - camY + view.cssH * 0.5) * dpr;
    ctx.strokeStyle = rgba(c.r, c.g, c.b, fade * 0.58);
    ctx.lineWidth = Math.max(1, (fx.kind === "rocket" ? 2.8 : 1.8) * fade) * dpr;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(1, r * dpr), 0, Math.PI * 2);
    ctx.stroke();
    if (fx.kind === "rocket" || fx.kind === "area-open") {
      ctx.fillStyle = rgba(c.r, c.g, c.b, fade * 0.08);
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(1, r * dpr), 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

// client/src/ui/session/SessionAbilityDemoRenderer.js
var PHASE_TO_LEVEL2 = Object.freeze({ 1: 1, 2: 3, 3: 6, 4: 10, 5: 15 });
var DEMO_FX = new VisualFxStore();
var fxKey = "";
var fxLastLocalT = -1;
var fxLastTime = 0;
function clamp013(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function smooth(t) {
  t = clamp013(t);
  return t * t * (3 - 2 * t);
}
function easeOut(t) {
  return 1 - Math.pow(1 - clamp013(t), 3);
}
function levelFor2(slot, phase) {
  return slot === "R" ? Math.max(1, Math.min(5, phase | 0)) : PHASE_TO_LEVEL2[Math.max(1, Math.min(5, phase | 0))] || 1;
}
function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function color(frameId) {
  if (frameId === "sigil") return { r: 198, g: 128, b: 255 };
  if (frameId === "bulwark") return { r: 236, g: 196, b: 96 };
  return { r: 125, g: 233, b: 255 };
}
function status(id, frameId, label = "") {
  const c = color(frameId);
  return { id, label: label || id, primaryColor: c, secondaryColor: c };
}
function tuning(frameId, slot, phase) {
  const lvl = levelFor2(slot, phase);
  if (frameId === "sigil") return getSigilAbilityTuning(slot, lvl, 0);
  if (frameId === "bulwark") return getBulwarkAbilityTuning(slot, lvl, 22);
  return getVanguardAbilityTuning(slot, lvl, 0);
}
function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
  const cssW = Math.max(1, Math.floor(rect.width || 760));
  const cssH = Math.max(1, Math.floor(rect.height || 330));
  const pxW = Math.floor(cssW * dpr);
  const pxH = Math.floor(cssH * dpr);
  if (canvas.width !== pxW || canvas.height !== pxH) {
    canvas.width = pxW;
    canvas.height = pxH;
  }
  return { dpr, cssW, cssH };
}
function makeVitals(hp, shield, energy, maxHp, maxShield, maxEnergy) {
  return { hp, maxHp, shield, maxShield, energy, maxEnergy };
}
function baseShip(id, frameId, x, y, rot, opts = {}) {
  const def = getShipFrameDef(frameId);
  const stats = def?.stats || {};
  const palette = getShipFramePalette(frameId);
  const hp = safeNum(stats.maxHp, 120);
  const shield = safeNum(stats.maxShield, 40);
  const energy = safeNum(stats.maxEnergy, 100);
  return {
    id,
    pseudo: opts.pseudo || (id === 1 ? "Preview" : "DUMMY"),
    frameId,
    x,
    y,
    vx: opts.vx || 0,
    vy: opts.vy || 0,
    rot,
    sx: 0,
    sy: 0,
    radius: safeNum(stats.radius, 18),
    engine: safeNum(stats.engine, 240),
    level: opts.level || 1,
    statuses: opts.statuses || [],
    frameState: opts.frameState || null,
    _localThrust: opts.thrust ?? 0,
    vitals: opts.vitals || makeVitals(hp, shield, energy, hp, shield, energy),
    color: palette.hull
  };
}
function projectile(id, slot, x, y, vx, vy, r, frameId, extra = {}) {
  return {
    id,
    x,
    y,
    vx,
    vy,
    radius: r,
    tint: color(frameId),
    sourceKind: "player",
    sourceAbilitySlot: slot,
    visualKind: slot === "AA" ? "auto" : "ability",
    rangeLeft: 900,
    ...extra
  };
}
function area(id, x, y, radius, frameId, extra = {}) {
  return {
    id,
    x,
    y,
    radius,
    color: color(frameId),
    durationLeft: extra.durationLeft ?? 2,
    kind: extra.kind || "ability_demo_zone",
    ...extra
  };
}
function pointAt(from, to, p) {
  return { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p) };
}
function addShot(scene, id, frameId, slot, from, to, t, start, travel, opts = {}) {
  const p = (t - start) / travel;
  if (p >= 0 && p <= 1) {
    const at = pointAt(from, to, easeOut(p));
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    scene.projectiles.push(projectile(id, slot, at.x, at.y, dx / len * (opts.speed || 980), dy / len * (opts.speed || 980), opts.radius || (slot === "AA" ? 4 : 5.5), frameId, opts));
  }
  if (Math.abs(t - (start + travel)) < 0.05) {
    scene.damageEvents.push({
      id: `dmg-${id}-${Math.round(start * 100)}`,
      type: "damage",
      targetId: to.id || 2,
      x: to.x,
      y: to.y,
      amount: opts.damage || 10,
      crit: !!opts.crit,
      shielded: !!opts.shielded,
      periodic: !!opts.periodic
    });
  }
  return t >= start + travel;
}
function addAutoSequence(scene, frameId, self, target, t, times, opts = {}) {
  let hits = 0;
  const startX = self.x + Math.cos(self.rot) * 22;
  const startY = self.y + Math.sin(self.rot) * 22;
  for (let i = 0; i < times.length; i += 1) {
    const hit = addShot(scene, 1e3 + i, frameId, "AA", { x: startX, y: startY }, target, t, times[i], opts.travel ?? 0.28, {
      radius: opts.empowered ? 5.3 : 4.2,
      speed: 1040,
      damage: opts.damage || 12,
      empoweredAutoUsed: !!opts.empowered,
      ultAutoUsed: !!opts.ult,
      crit: !!opts.crit && i % 3 === 2
    });
    if (hit) hits += 1;
  }
  return hits;
}
function addRuneMarks(scene, x, y, stacks, t) {
  const n = Math.max(0, Math.min(5, stacks | 0));
  for (let i = 0; i < n; i += 1) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5 + t * 0.8;
    scene.areas.push(area(3200 + i, x + Math.cos(a) * 34, y + Math.sin(a) * 34, 9, "sigil", { durationLeft: 1.2 }));
  }
}
function resetFxIfNeeded(key, localT, absoluteT) {
  const loop = fxKey !== key || localT + 0.08 < fxLastLocalT || absoluteT < fxLastTime;
  if (loop) {
    DEMO_FX.trails.clear();
    DEMO_FX.impacts = [];
    DEMO_FX.rings = [];
    DEMO_FX.damageNumbers = [];
    DEMO_FX.castBursts = [];
    DEMO_FX.lastProjectiles.clear();
    DEMO_FX.lastAreas.clear();
    DEMO_FX.lastStatuses.clear();
  }
  fxKey = key;
  fxLastLocalT = localT;
  fxLastTime = absoluteT;
}
function syncFx(scene, key, localT, absoluteT) {
  resetFxIfNeeded(key, localT, absoluteT);
  const mock = {
    projectiles: new Map(scene.projectiles.map((p) => [p.id, p])),
    areaEffects: new Map(scene.areas.map((a) => [a.id, a])),
    players: new Map(scene.ships.map((p) => [p.id, p])),
    mobs: /* @__PURE__ */ new Map(),
    asteroids: /* @__PURE__ */ new Map(),
    getMe: () => scene.ships[0],
    consumePendingCombatFx: () => scene.damageEvents
  };
  DEMO_FX.sync(mock, absoluteT);
}
function durationFor(frameId, slot, scenarioIndex) {
  if (slot === "R") return 6.2;
  if (slot === "P") return 5.4;
  if (slot === "A") return scenarioIndex > 0 ? 4.8 : 3.4;
  if (slot === "Z") return 4.6;
  if (slot === "E") return 4.8;
  return 4.8;
}
function clock(time, frameId, slot, scenarioIndex) {
  const duration = durationFor(frameId, slot, scenarioIndex);
  const t = time % duration;
  return { duration, t, u: t / duration };
}
function drawGrid2(ctx, view, camX, camY) {
  const { dpr, cssW: w, cssH: h } = view;
  ctx.save();
  ctx.fillStyle = "rgba(5, 9, 16, 0.98)";
  ctx.fillRect(0, 0, w * dpr, h * dpr);
  const grad = ctx.createRadialGradient(w * 0.52 * dpr, h * 0.5 * dpr, 0, w * 0.52 * dpr, h * 0.5 * dpr, Math.max(w, h) * 0.72 * dpr);
  grad.addColorStop(0, "rgba(32, 50, 76, 0.22)");
  grad.addColorStop(1, "rgba(3, 6, 11, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w * dpr, h * dpr);
  ctx.strokeStyle = "rgba(126, 162, 214, 0.105)";
  ctx.lineWidth = dpr;
  const step = 96;
  const ox = ((-camX + w * 0.5) % step + step) % step;
  const oy = ((-camY + h * 0.5) % step + step) % step;
  for (let x = ox; x <= w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x * dpr, 0);
    ctx.lineTo(x * dpr, h * dpr);
    ctx.stroke();
  }
  for (let y = oy; y <= h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y * dpr);
    ctx.lineTo(w * dpr, y * dpr);
    ctx.stroke();
  }
  for (let i = 0; i < 52; i += 1) {
    const x = (Math.sin(i * 47.13) * 1e4 % w + w) % w;
    const y = (Math.cos(i * 31.79) * 1e4 % h + h) % h;
    ctx.fillStyle = `rgba(210,230,255,${0.12 + i % 6 * 0.035})`;
    ctx.fillRect(x * dpr, y * dpr, dpr, dpr);
  }
  ctx.restore();
}
function drawMiniHud(ctx, view, card, ability, phase, scenarioLabel, progress) {
  const dpr = view.dpr;
  ctx.save();
  ctx.fillStyle = "rgba(4, 8, 14, 0.74)";
  ctx.strokeStyle = "rgba(126, 162, 214, 0.18)";
  ctx.lineWidth = dpr;
  ctx.beginPath();
  ctx.roundRect(14 * dpr, 14 * dpr, 245 * dpr, 56 * dpr, 8 * dpr);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(245,249,255,.96)";
  ctx.font = `900 ${12 * dpr}px var(--ui-font, Segoe UI)`;
  ctx.textAlign = "left";
  ctx.fillText(`${ability?.key || "A"} \xB7 ${ability?.name || ability?.label || ""}`, 28 * dpr, 36 * dpr);
  ctx.fillStyle = "rgba(178,198,224,.82)";
  ctx.font = `700 ${10.5 * dpr}px var(--ui-font, Segoe UI)`;
  ctx.fillText(`${scenarioLabel || "Sc\xE9nario"} \xB7 phase ${phase}`, 28 * dpr, 55 * dpr);
  ctx.fillStyle = rgba(color(card.id).r, color(card.id).g, color(card.id).b, 0.3);
  ctx.fillRect(28 * dpr, 62 * dpr, 196 * dpr, 3 * dpr);
  ctx.fillStyle = rgba(color(card.id).r, color(card.id).g, color(card.id).b, 0.88);
  ctx.fillRect(28 * dpr, 62 * dpr, 196 * clamp013(progress) * dpr, 3 * dpr);
  ctx.restore();
}
function buildSceneBase(frameId, phase, slot, t) {
  const selfX = -155;
  const selfY = 0;
  const targetX = 160;
  const targetY = 0;
  const self = baseShip(1, frameId, selfX, selfY, 0, { pseudo: "Preview", level: levelFor2(slot, phase), thrust: 0.35 });
  const target = baseShip(2, frameId === "bulwark" ? "vanguard" : "bulwark", targetX, targetY, Math.PI, { pseudo: "DUMMY", level: 1, thrust: 0 });
  self.rot = Math.atan2(target.y - self.y, target.x - self.x);
  target.rot = Math.atan2(self.y - target.y, self.x - target.x);
  return { ships: [self, target], projectiles: [], areas: [], damageEvents: [], camX: 0, camY: 0, localT: t };
}
function applyVanguard(scene, slot, phase, t, scenarioLabel) {
  const self = scene.ships[0];
  const target = scene.ships[1];
  const a = tuning("vanguard", "A", phase);
  const z = tuning("vanguard", "Z", phase);
  const e = tuning("vanguard", "E", phase);
  const r = tuning("vanguard", "R", phase);
  const combo = /Z1|combo/i.test(scenarioLabel || "");
  const force10 = /P\(10\)|10/.test(scenarioLabel || "");
  const autoTimes = slot === "R" ? [0.35, 0.78, 1.21, 1.64, 2.07, 2.5, 2.93, 3.36, 3.79, 4.22, 4.65] : [0.38, 1.08, 1.78, 2.48, 3.18, 3.88, 4.58];
  let heat = addAutoSequence(scene, "vanguard", self, target, t, autoTimes, { damage: 13, empowered: slot === "R" || force10, ult: slot === "R", crit: force10 });
  if (slot === "P") heat = Math.min(10, Math.floor(t / 0.42) + 1);
  if (/P\(6\)/.test(scenarioLabel || "")) heat = Math.max(6, Math.min(10, heat));
  if (force10) heat = 10;
  let empoweredCharges = 0;
  let comboWindowLeft = 0;
  let phaseLeft = 0;
  let ultLeft = 0;
  if (slot === "Z" || /Z1/.test(scenarioLabel || "")) {
    const start = 0.32;
    const d = z.dashDistance || 140;
    const p = clamp013((t - start) / 0.24);
    if (p > 0 && p < 1) {
      self.x = -155 + easeOut(p) * d;
      self.vx = 900;
      self._localThrust = 1;
    } else if (t >= start + 0.24) self.x = -155 + d;
    self.rot = Math.atan2(target.y - self.y, target.x - self.x);
    if (t >= start && t < start + safeNum(z.moveBoostDuration, 1.2)) {
      self.statuses.push(status("haste", "vanguard", "Z"));
      comboWindowLeft = Math.max(0, safeNum(z.comboWindowDuration, 0) - (t - start));
    }
    if (safeNum(z.trailSlowPct, 0) > 0 && t >= start && t < start + 1.2) scene.areas.push(area(201, -80, 0, 48, "vanguard", { durationLeft: 1, statusId: "slow", label: "Slow" }));
  }
  if (slot === "A" || /A1/.test(scenarioLabel || "")) {
    const start = combo ? 0.94 : 0.48;
    const from = { x: self.x + Math.cos(self.rot) * 24, y: self.y + Math.sin(self.rot) * 24 };
    const dmg = Math.round(safeNum(a.damageFlat, 10) + 13 * safeNum(a.damagePct, 0.7) + (combo ? 13 * safeNum(a.comboDamagePct, 0) : 0));
    if (addShot(scene, 301, "vanguard", "A", from, target, t, start, combo ? 0.25 : 0.34, { speed: safeNum(a.projectileSpeed, 1100), radius: Math.max(5, safeNum(a.projectileWidth, 22) * 0.22), damage: dmg, crit: combo || force10 })) {
      heat = Math.min(10, heat + 1);
      empoweredCharges = safeNum(a.empowerCharges, 1);
      target.statuses.push(status("damage_amp", "vanguard", "A"));
      if (phase >= 5) target.statuses.push(status("disarm", "vanguard", "A"));
    }
  }
  if (slot === "E" || /E1/.test(scenarioLabel || "")) {
    const start = 0.38;
    if (t >= start && t < start + safeNum(e.phaseDuration, 1.2)) {
      self.statuses.push(status("spell_shield", "vanguard", "E"));
      phaseLeft = Math.max(0, safeNum(e.phaseDuration, 1.2) - (t - start));
      scene.areas.push(area(401, self.x, self.y, 70, "vanguard", { color: { r: 124, g: 154, b: 255 }, durationLeft: phaseLeft, label: "Phase" }));
    }
    const end = start + safeNum(e.phaseDuration, 1.2);
    if (safeNum(e.exitRadius, 0) > 0 && Math.abs(t - end) < 0.3) scene.areas.push(area(402, self.x, self.y, safeNum(e.exitRadius, 90), "vanguard", { durationLeft: 0.5, statusId: "grounded", label: "Grounded" }));
    if (t >= end && t < end + safeNum(e.groundedDuration, 1.2)) target.statuses.push(status("grounded", "vanguard", "E"));
  }
  if (slot === "R" || /R1/.test(scenarioLabel || "")) {
    const start = 0.25;
    if (t >= start && t < start + safeNum(r.ultDuration, 4)) {
      ultLeft = Math.max(0, safeNum(r.ultDuration, 4) - (t - start));
      self.statuses.push(status("haste", "vanguard", "R"));
      scene.areas.push(area(501, self.x, self.y, 88, "vanguard", { color: { r: 255, g: 116, b: 238 }, durationLeft: ultLeft, label: "R" }));
      if (phase >= 2) target.statuses.push(status("burn", "vanguard", "R"));
      if (phase >= 5 && /A1/.test(scenarioLabel || "") && t > 1.2) target.statuses.push(status("stun", "vanguard", "R+A"));
    }
  }
  if (heat >= 6) self.statuses.push(status("tenacity", "vanguard", "Surchauffe"));
  const hpLoss = Math.min(82, heat * 4 + (slot === "A" && t > 0.9 ? 24 : 0) + (slot === "R" ? Math.floor(t * 10) : 0));
  target.vitals.hp = Math.max(18, target.vitals.maxHp - hpLoss);
  self.frameState = {
    kind: "vanguard",
    passiveName: "Surchauffe",
    passiveStacks: Math.max(0, Math.min(VANGUARD_PASSIVE.maxStacks, heat)),
    passiveMaxStacks: VANGUARD_PASSIVE.maxStacks,
    passiveDecayLeft: heat > 0 ? Math.max(0, VANGUARD_PASSIVE.stackDuration - t % VANGUARD_PASSIVE.stackDuration) : 0,
    empoweredCharges,
    empoweredMaxCharges: safeNum(a.empowerCharges, 1),
    comboWindowLeft,
    moveBoostLeft: comboWindowLeft,
    phaseLeft,
    ultLeft
  };
}
function applySigil(scene, slot, phase, t, scenarioLabel) {
  const self = scene.ships[0];
  const target = scene.ships[1];
  const a = tuning("sigil", "A", phase);
  const z = tuning("sigil", "Z", phase);
  const e = tuning("sigil", "E", phase);
  const r = tuning("sigil", "R", phase);
  let runeHits = 0;
  let runeLimit = /x5|P\(5\)|détonation/i.test(scenarioLabel || "") ? 5 : /x3|P\(3\)/i.test(scenarioLabel || "") ? 3 : 1;
  const aTimes = Array.from({ length: runeLimit }, (_, i) => 0.42 + i * 0.58);
  if (slot !== "A" && slot !== "P" && !/A1/.test(scenarioLabel || "")) aTimes.length = 0;
  if (slot === "R" || /R1/.test(scenarioLabel || "")) aTimes.push(1.2, 1.65, 2.1);
  if (slot === "Z" || /Z1/.test(scenarioLabel || "")) {
    const start = 0.28;
    if (t >= start && t < start + safeNum(z.zZoneDuration, 3)) {
      scene.areas.push(area(801, target.x, target.y, safeNum(z.zZoneRadius, 84), "sigil", { kind: "test_effect_zone", phase: "active", statusId: phase >= 5 ? "suppress" : "slow", label: phase >= 5 ? "Suppress" : "Slow", durationLeft: safeNum(z.zZoneDuration, 3) - (t - start) }));
      target.statuses.push(status("slow", "sigil", "Z"));
      if (safeNum(z.zRunePulseStacks, 0) > 0 && t > start + 0.8) runeHits += Math.min(2, safeNum(z.zRunePulseStacks, 1));
    }
    if (/fermeture/i.test(scenarioLabel || "") && t > 2.6) target.statuses.push(status(phase >= 5 ? "suppress" : "root", "sigil", "Z"));
  }
  if (slot === "E" || /E1/.test(scenarioLabel || "")) {
    const start = 0.3;
    const p = clamp013((t - start) / 0.32);
    if (p > 0 && p < 1) {
      self.x = -155 + easeOut(p) * safeNum(e.eDashDistance, 90);
      self.y = -Math.sin(p * Math.PI) * 34;
      self.vx = 650;
      self._localThrust = 0.9;
    } else if (t >= start + 0.32) self.x = -155 + safeNum(e.eDashDistance, 90);
    self.rot = Math.atan2(target.y - self.y, target.x - self.x);
    if (t >= start && t < start + safeNum(e.eCamouflageDuration, 1.2)) {
      self.statuses.push(status("camouflage", "sigil", "E"));
      scene.areas.push(area(811, self.x, self.y, 52, "sigil", { durationLeft: 1.1, statusId: "camouflage", label: "Voile" }));
    }
  }
  if (slot === "R" || /R1/.test(scenarioLabel || "")) {
    const start = 0.25;
    if (t >= start && t < start + safeNum(r.ultDuration, 4)) {
      scene.areas.push(area(821, target.x - 8, target.y, 112, "sigil", { kind: "test_effect_zone", phase: "active", statusId: "silence", label: "Convergence", durationLeft: safeNum(r.ultDuration, 4) - (t - start) }));
      self.statuses.push(status("lifesteal", "sigil", "R"));
    }
  }
  for (let i = 0; i < aTimes.length; i += 1) {
    const start = aTimes[i];
    const from = { x: self.x + Math.cos(self.rot) * 24, y: self.y + Math.sin(self.rot) * 24 };
    const dmg = Math.round(safeNum(a.aImpactDamageFlat, 10) + 12.5 * safeNum(a.aImpactDamagePct, 0.7));
    if (addShot(scene, 900 + i, "sigil", "A", from, target, t, start, 0.3, { speed: safeNum(a.aProjectileSpeed, 1120), radius: 5.5, damage: dmg, crit: runeHits + i >= 4 })) runeHits += 1;
  }
  if (slot === "P") runeHits = Math.max(runeHits, Math.min(5, Math.floor(t / 0.55) + 1));
  const runes = Math.min(SIGIL_PASSIVE.maxRunes, runeHits);
  if (runes >= 3) target.statuses.push(status("slow", "sigil", "Runes"));
  if (runes >= 5) {
    target.statuses.push(status("stun", "sigil", "D\xE9tonation"));
    scene.areas.push(area(831, target.x, target.y, 64, "sigil", { durationLeft: 0.8, label: "D\xE9tonation" }));
  }
  addRuneMarks(scene, target.x, target.y, runes, t);
  target.vitals.hp = Math.max(18, target.vitals.maxHp - runes * 13 - (runes >= 5 ? 30 : 0));
  self.frameState = {
    kind: "sigil",
    passiveName: "Runes",
    passiveStacks: runes,
    passiveMaxStacks: SIGIL_PASSIVE.maxRunes,
    detonationCooldownLeft: runes >= 5 ? 1.6 : 0,
    zoneActive: slot === "Z" || slot === "R" || runes > 0,
    veilLeft: self.statuses.some((s) => s.id === "camouflage") ? 1 : 0,
    ultLeft: slot === "R" ? Math.max(0, safeNum(r.ultDuration, 4) - (t - 0.25)) : 0
  };
}
function applyBulwark(scene, slot, phase, t, scenarioLabel) {
  const self = scene.ships[0];
  const target = scene.ships[1];
  const a = tuning("bulwark", "A", phase);
  const z = tuning("bulwark", "Z", phase);
  const e = tuning("bulwark", "E", phase);
  const r = tuning("bulwark", "R", phase);
  const incoming = [0.38, 0.92, 1.46, 2, 2.54];
  let plates = slot === "P" ? Math.min(BULWARK_PASSIVE.maxPlates, Math.floor(t / 0.55) + 1) : Math.min(BULWARK_PASSIVE.maxPlates, phase);
  if (/pleine|full/i.test(scenarioLabel || "")) plates = BULWARK_PASSIVE.maxPlates;
  if (slot === "P") {
    for (let i = 0; i < incoming.length; i += 1) {
      addShot(scene, 1200 + i, "bulwark", "AA", { x: target.x, y: target.y }, self, t, incoming[i], 0.25, { radius: 4.4, speed: 900, damage: 16, shielded: i < 2 });
    }
    self.statuses.push(status("armor_up", "bulwark", "Plaques"));
  }
  if (slot === "A" || /A1/.test(scenarioLabel || "")) {
    const start = 0.32;
    if (t >= start && t < start + safeNum(a.anchorDuration, 2.2)) {
      self.statuses.push(status("armor_up", "bulwark", "A"));
      scene.areas.push(area(1301, self.x, self.y, safeNum(a.anchorPulseRadius, 80) || 80, "bulwark", { durationLeft: safeNum(a.anchorDuration, 2.2) - (t - start), label: "Carapace" }));
      if (phase >= 3) target.statuses.push(status("slow", "bulwark", "Pulse"));
      if (phase >= 4) target.statuses.push(status("taunt", "bulwark", "A"));
    }
  }
  if (slot === "Z" || /Z1/.test(scenarioLabel || "")) {
    const start = 0.44;
    const hit = addShot(scene, 1401, "bulwark", "Z", { x: self.x + 22, y: self.y }, target, t, start, 0.32, { radius: 6.2, speed: safeNum(z.harpoonProjectileSpeed, 1100), damage: Math.round(safeNum(z.harpoonDamageFlat, 12) + 12 * safeNum(z.harpoonDamageWeaponPct, 0.7) + 22 * safeNum(z.harpoonDamageArmorPct, 0)), crit: phase >= 4 });
    if (hit) {
      target.statuses.push(status("taunt", "bulwark", "Z"));
      if (phase >= 2) target.statuses.push(status("armor_shred", "bulwark", "Shred"));
      if (phase >= 3) target.statuses.push(status("grounded", "bulwark", "Grounded"));
    }
    const pull = clamp013((t - start - 0.32) / 0.7);
    if (pull > 0) {
      if (phase >= 5) target.x = lerp(target.x, self.x + 72, smooth(pull));
      if (phase >= 4) self.x = lerp(self.x, target.x - 84, smooth(pull));
      self.rot = Math.atan2(target.y - self.y, target.x - self.x);
      target.rot = Math.atan2(self.y - target.y, self.x - target.x);
    }
  }
  if (slot === "E" || /E1/.test(scenarioLabel || "")) {
    const start = 0.3;
    if (t >= start && t < start + safeNum(e.meditationDuration, 2.7)) {
      self.statuses.push(status("tenacity", "bulwark", "E"), status("armor_up", "bulwark", "E"));
      scene.areas.push(area(1501, self.x, self.y, safeNum(e.meditationPulseRadius, 86) || 86, "bulwark", { color: { r: 120, g: 210, b: 255 }, durationLeft: safeNum(e.meditationDuration, 2.7) - (t - start), label: "M\xE9ditation" }));
      self.vitals.hp = Math.min(self.vitals.maxHp, self.vitals.hp + Math.floor((t - start) * 12));
    }
    const end = start + safeNum(e.meditationDuration, 2.7);
    if (t >= end && t < end + 1.2 && phase >= 3) target.statuses.push(status(phase >= 5 ? "grounded" : "slow", "bulwark", "E"));
  }
  if (slot === "R" || /R1/.test(scenarioLabel || "")) {
    const start = 0.26;
    if (t >= start && t < start + safeNum(r.stormDuration, 4)) {
      scene.areas.push(area(1601, self.x, self.y, safeNum(r.stormRadius, 132), "bulwark", { kind: "test_effect_zone", phase: "active", statusId: "slow", label: "Temp\xEAte", durationLeft: safeNum(r.stormDuration, 4) - (t - start) }));
      target.statuses.push(status("slow", "bulwark", "R"));
      if (phase >= 2) target.statuses.push(status("taunt", "bulwark", "R"));
      if (phase >= 3 && t > start + safeNum(r.stormExposureStunThreshold, 1.8)) target.statuses.push(status("stun", "bulwark", "R"));
      if (phase >= 4) target.x = lerp(target.x, self.x + 90, 0.04);
      if (Math.abs((t - start) % 0.5) < 0.05) scene.damageEvents.push({ id: "storm-dot", type: "damage", targetId: target.id, x: target.x, y: target.y, amount: Math.round(safeNum(r.stormBaseDpsFlat, 10) * 0.5), periodic: true });
    }
  }
  if (plates >= BULWARK_PASSIVE.maxPlates) self.statuses.push(status("tenacity", "bulwark", "Plaques"));
  target.vitals.hp = Math.max(18, target.vitals.maxHp - (slot === "Z" && t > 0.8 ? 42 : 0) - (slot === "R" ? Math.floor(t * 12) : 0));
  self.frameState = {
    kind: "bulwark",
    passiveName: "Plaques",
    passiveStacks: plates,
    passiveMaxStacks: BULWARK_PASSIVE.maxPlates,
    anchorLeft: slot === "A" ? Math.max(0, safeNum(a.anchorDuration, 2.2) - (t - 0.32)) : 0,
    meditationLeft: slot === "E" ? Math.max(0, safeNum(e.meditationDuration, 2.7) - (t - 0.3)) : 0,
    stormLeft: slot === "R" ? Math.max(0, safeNum(r.stormDuration, 4) - (t - 0.26)) : 0,
    stormArmorStolen: slot === "R" ? Math.min(safeNum(r.stormStealCap, 0), Math.floor(t * safeNum(r.stormArmorStealPerSecond, 0))) : 0,
    stormShieldGained: slot === "R" && phase >= 4 ? 18 : 0
  };
}
function buildScenario(card, ability, phase, localT, scenarioIndex) {
  const frameId = card.id || "vanguard";
  const slot = ability?.key || "A";
  const scenario = typeof ability?.getScenarios === "function" ? ability.getScenarios(phase)?.[scenarioIndex] : null;
  const label = scenario?.label || "";
  const scene = buildSceneBase(frameId, phase, slot, localT);
  if (frameId === "sigil") applySigil(scene, slot, phase, localT, label);
  else if (frameId === "bulwark") applyBulwark(scene, slot, phase, localT, label);
  else applyVanguard(scene, slot, phase, localT, label);
  return { scene, label };
}
function drawSessionRealAbilityDemo(ctx, canvas, card, abilityIndex, phase, time, scenarioIndex = 0) {
  const view = resizeCanvas(canvas);
  const ability = card.abilities?.[abilityIndex] || card.abilities?.[0] || { key: "A", label: "A" };
  const c = clock(time, card.id, ability.key || "A", scenarioIndex);
  const { scene, label } = buildScenario(card, ability, phase, c.t, scenarioIndex);
  syncFx(scene, `${card.id}:${ability.key}:${phase}:${scenarioIndex}`, c.t, time);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid2(ctx, view, scene.camX, scene.camY);
  for (const a of scene.areas) drawAreaEffect(ctx, view, a, scene.camX, scene.camY, time);
  DEMO_FX.drawTrails(ctx, view, scene.camX, scene.camY, time);
  for (const p of scene.projectiles) drawProjectile(ctx, view, p, scene.camX, scene.camY);
  for (const s of scene.ships) drawShip(ctx, view, s, scene.camX, scene.camY, time, null, scene.ships, []);
  DEMO_FX.drawImpacts(ctx, view, scene.camX, scene.camY, time);
  DEMO_FX.drawDamageNumbers(ctx, view, scene.camX, scene.camY, time);
  drawMiniHud(ctx, view, card, ability, phase, label, c.u);
}

// client/src/ui/session/SessionSetupOverlay.js
var STORAGE_KEY = "spacefrontier.session.setup";
var STEPS = ["auth", "mode", "ship", "waiting"];
function normalizePseudo(value) {
  let raw = String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (!raw) raw = "Pilote";
  raw = raw.slice(0, 18).trim();
  return raw || "Pilote";
}
function loadStoredSetup() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      pseudo: normalizePseudo(parsed.pseudo || "Pilote"),
      frameId: String(parsed.frameId || "vanguard"),
      frameByMode: parsed.frameByMode && typeof parsed.frameByMode === "object" ? parsed.frameByMode : {},
      mode: String(parsed.mode || "endless"),
      battleSessionId: String(parsed.battleSessionId || ""),
      testWorldId: String(parsed.testWorldId || "test-hub"),
      accountName: normalizePseudo(parsed.accountName || parsed.pseudo || "Pilote")
    };
  } catch {
    return { pseudo: "Pilote", frameId: "vanguard", frameByMode: {}, mode: "endless", battleSessionId: "", testWorldId: "test-hub", accountName: "Pilote" };
  }
}
function storeSetup(payload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
  }
}
var SessionSetupOverlay = class {
  constructor(onCommit, onCancelWaiting = null, onAuth = null) {
    this.onCommit = onCommit;
    this.onCancelWaiting = typeof onCancelWaiting === "function" ? onCancelWaiting : null;
    this.onAuth = typeof onAuth === "function" ? onAuth : null;
    this.cards = getSessionFrameCards();
    const stored = loadStoredSetup();
    this.frameByMode = stored.frameByMode && typeof stored.frameByMode === "object" ? { ...stored.frameByMode } : {};
    this.selectedMode = ["endless", "test_server", "test_world", "battle_next", "battle_server"].includes(stored.mode) ? stored.mode : "endless";
    const initialFrameId = this.frameByMode[this.getModeProfileKey(this.selectedMode)] || stored.frameId || "vanguard";
    this.selectedFrameId = this.cards.some((card) => card.id === initialFrameId) ? initialFrameId : this.cards[0]?.id || "vanguard";
    this.selectedBattleSessionId = stored.battleSessionId || "";
    this.selectedTestWorldId = stored.testWorldId || "test-hub";
    this.selectedAbilityIndex = 0;
    this.selectedPreviewPhase = 1;
    this.selectedInfoTab = "ability";
    this.selectedScenarioIndex = 0;
    this.previewRaf = 0;
    this.previewErrorLogged = false;
    this.previewSuspended = true;
    this.accountAction = "guest";
    this.step = "auth";
    this.modes = null;
    this.serverPending = true;
    this.waitingAck = false;
    this.inputDirty = false;
    this.authStatus = null;
    this.authRequestPending = false;
    this.authenticatedAccountName = "";
    this.authenticatedPassword = "";
    this.el = document.createElement("div");
    this.el.className = "session-setup";
    this.el.innerHTML = `
      <div class="session-setup__backdrop"></div>
      <div class="session-setup__shell session-setup__shell--flow">
        <div class="session-setup__steps">
          <span data-step-dot="auth">Compte</span>
          <span data-step-dot="mode">Serveur</span>
          <span data-step-dot="ship">Vaisseau</span>
        </div>

        <section class="session-setup__page session-setup__page--auth" data-step="auth">
          <div class="session-setup__eyebrow">Acc\xE8s</div>
          <h1 class="session-setup__title">Connexion</h1>
          <p class="session-setup__subtitle">Choisis un acc\xE8s invit\xE9 ou un compte sauvegard\xE9. Le pseudo du compte devient aussi le pseudo du vaisseau.</p>
          <div class="session-setup__auth-status" data-auth-status></div>
          <div class="session-setup__auth-grid session-setup__auth-grid--three">
            <div class="session-setup__auth-card">
              <h2>Invit\xE9</h2>
              <p class="session-setup__hint">Acc\xE8s libre aux modes, sans sauvegarde de progression ni statistiques persistantes.</p>
              <label class="session-setup__label" for="session-pseudo">Pseudo</label>
              <input id="session-pseudo" class="session-setup__input" maxlength="18" autocomplete="off" spellcheck="false" />
              <button type="button" class="session-setup__primary" data-auth-start="guest">Continuer en invit\xE9</button>
            </div>
            <div class="session-setup__auth-card">
              <h2>Connexion</h2>
              <p class="session-setup__hint">Utilise un compte existant.</p>
              <label class="session-setup__label">Pseudo</label>
              <input class="session-setup__input session-login-name" maxlength="18" autocomplete="username" spellcheck="false" />
              <label class="session-setup__label">Mot de passe</label>
              <input class="session-setup__input session-login-password" maxlength="80" type="password" autocomplete="current-password" />
              <button type="button" data-auth-start="login" class="session-setup__primary">Se connecter</button>
            </div>
            <div class="session-setup__auth-card">
              <h2>Cr\xE9er un compte</h2>
              <p class="session-setup__hint">Pseudo + mot de passe. Aucun email demand\xE9.</p>
              <label class="session-setup__label">Pseudo</label>
              <input class="session-setup__input session-register-name" maxlength="18" autocomplete="username" spellcheck="false" />
              <label class="session-setup__label">Mot de passe</label>
              <input class="session-setup__input session-register-password" maxlength="80" type="password" autocomplete="new-password" />
              <button type="button" data-auth-start="register" class="session-setup__primary">Cr\xE9er le compte</button>
            </div>
          </div>
        </section>

        <section class="session-setup__page session-setup__page--mode" data-step="mode">
          <div class="session-setup__eyebrow">Serveurs</div>
          <h1 class="session-setup__title">Choisir un serveur</h1>
          <div class="session-setup__server-list">
            <button type="button" data-mode="endless" class="session-setup__server-card session-setup__server-card--endless">
              <div class="session-setup__server-main">
                <b>Endless</b>
              </div>
              <div class="session-setup__server-meta">
                <span class="session-setup__endless-count">0 joueur</span>
              </div>
            </button>
            <div class="session-setup__server-section-title">Test</div>
            <div class="session-setup__test-world-list"></div>
            <div class="session-setup__server-section-title">Battle Royale</div>
            <div class="session-setup__battle-server-list"></div>
            <div class="session-setup__queue-card">
              <div class="session-setup__server-main">
                <b>Prochain Battle Royale</b>
                <span class="session-setup__battle-next">Ouverture bient\xF4t</span>
              </div>
              <div class="session-setup__server-meta">
                <span class="session-setup__battle-waiting-count">0 en attente</span>
              </div>
              <button type="button" data-mode="battle_next" class="session-setup__queue-button">Rejoindre la file</button>
            </div>
          </div>
          <div class="session-setup__mode-footer">
            <div class="session-setup__selection-summary" data-selection-summary>S\xE9lection : Endless</div>
            <button type="button" class="session-setup__secondary" data-step-back>Retour</button>
            <button type="button" class="session-setup__primary" data-step-next>Continuer</button>
          </div>
        </section>

        <section class="session-setup__page session-setup__page--ship" data-step="ship">
          <section class="session-setup__left session-setup__left--ship">
            <div class="session-setup__ship-head">
              <div>
                <div class="session-setup__eyebrow">Vaisseaux</div>
                <h1 class="session-setup__title session-setup__title--compact">S\xE9lection</h1>
              </div>
              
            </div>
            <div class="session-setup__ship-list"></div>
          </section>
          <section class="session-setup__right session-setup__right--ship">
            <div class="session-setup__hero session-setup__hero--compact">
              <canvas class="session-setup__glyph" width="128" height="128"></canvas>
              <div>
                <div class="session-setup__ship-name"></div>
                <div class="session-setup__ship-meta"></div>
                <div class="session-setup__tagline"></div>
              </div>
            </div>
            <div class="session-setup__ship-main">
              <div class="session-setup__preview-wrap">
                <canvas class="session-setup__preview" width="760" height="330"></canvas>
                <div class="session-setup__scenario-buttons"></div>
              </div>
              <aside class="session-setup__side-panel">
                <div class="session-setup__stats"></div>
                <div class="session-setup__info-tabs">
                  <button type="button" class="session-setup__info-tab is-selected" data-info-tab="ability">Comp\xE9tence</button>
                  <button type="button" class="session-setup__info-tab" data-info-tab="guide">Guide</button>
                </div>
                <div class="session-setup__info-panel is-active" data-info-panel="ability">
                  <div class="session-setup__ability-detail">
                    <div class="session-setup__ability-detail-key"></div>
                    <div>
                      <div class="session-setup__ability-detail-title"></div>
                      <div class="session-setup__ability-detail-text"></div>
                    </div>
                  </div>
                </div>
                <div class="session-setup__info-panel" data-info-panel="guide">
                  <div class="session-setup__ship-guide">
                    <div class="session-setup__guide-title">Guide</div>
                    <div class="session-setup__guide-lines"></div>
                  </div>
                </div>
              </aside>
            </div>
            <div class="session-setup__ability-controls">
              <div class="session-setup__abilities"></div>
              <div class="session-setup__phase-buttons"></div>
            </div>
            <div class="session-setup__footer">
              <button type="button" class="session-setup__secondary" data-step-back>Retour</button>
              <button type="button" class="session-setup__launch">D\xE9ployer</button>
            </div>
          </section>
        </section>

        <section class="session-setup__page session-setup__page--waiting" data-step="waiting">
          <div class="session-setup__waiting-card">
            <div class="session-setup__eyebrow">File Battle Royale</div>
            <h1 class="session-setup__title">En attente du prochain serveur</h1>
            <p class="session-setup__subtitle">Tu n\u2019es pas d\xE9ploy\xE9 dans un secteur jouable. Le vaisseau sera plac\xE9 dans le hub du serveur Battle d\xE8s son ouverture.</p>
            <div class="session-setup__waiting-timer" data-waiting-timer>Ouverture bient\xF4t</div>
            <button type="button" class="session-setup__secondary" data-wait-cancel>Quitter</button>
          </div>
        </section>
      </div>
    `;
    this.inputEl = this.el.querySelector("#session-pseudo");
    this.modePseudoEl = this.el.querySelector(".session-pseudo-mirror");
    this.currentPseudoEl = this.el.querySelector(".session-setup__current-pseudo");
    this.selectionSummaryEl = this.el.querySelector("[data-selection-summary]");
    this.loginNameEl = this.el.querySelector(".session-login-name");
    this.loginPasswordEl = this.el.querySelector(".session-login-password");
    this.registerNameEl = this.el.querySelector(".session-register-name");
    this.registerPasswordEl = this.el.querySelector(".session-register-password");
    this.authStatusEl = this.el.querySelector("[data-auth-status]");
    this.waitingTimerEl = this.el.querySelector("[data-waiting-timer]");
    this.shipListEl = this.el.querySelector(".session-setup__ship-list");
    this.modeButtons = [...this.el.querySelectorAll("[data-mode]")];
    this.battleServerListEl = this.el.querySelector(".session-setup__battle-server-list");
    this.testWorldListEl = this.el.querySelector(".session-setup__test-world-list");
    this.endlessCountEl = this.el.querySelector(".session-setup__endless-count");
    this.testCountEl = this.el.querySelector(".session-setup__test-count");
    this.battleWaitingCountEl = this.el.querySelector(".session-setup__battle-waiting-count");
    this.battleNextEl = this.el.querySelector(".session-setup__battle-next");
    const selectBattleFromEvent = (ev) => {
      const btn = ev.target?.closest?.('[data-mode="battle_server"][data-server-id]');
      if (!btn || !this.battleServerListEl?.contains(btn)) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.selectMode("battle_server", btn.dataset.serverId || "");
    };
    this.battleServerListEl?.addEventListener("click", selectBattleFromEvent);
    this.battleServerListEl?.addEventListener("pointerdown", selectBattleFromEvent);
    const selectTestWorldFromEvent = (ev) => {
      const btn = ev.target?.closest?.('[data-mode="test_world"][data-test-world-id]');
      if (!btn || !this.testWorldListEl?.contains(btn)) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.selectMode("test_world", btn.dataset.testWorldId || "test-hub");
    };
    this.testWorldListEl?.addEventListener("click", selectTestWorldFromEvent);
    this.testWorldListEl?.addEventListener("pointerdown", selectTestWorldFromEvent);
    this.glyphEl = this.el.querySelector(".session-setup__glyph");
    this.previewEl = this.el.querySelector(".session-setup__preview");
    this.previewCtx = this.previewEl?.getContext("2d") || null;
    this.nameEl = this.el.querySelector(".session-setup__ship-name");
    this.metaEl = this.el.querySelector(".session-setup__ship-meta");
    this.taglineEl = this.el.querySelector(".session-setup__tagline");
    this.summaryEl = null;
    this.statsEl = this.el.querySelector(".session-setup__stats");
    this.abilitiesEl = this.el.querySelector(".session-setup__abilities");
    this.phaseButtonsEl = this.el.querySelector(".session-setup__phase-buttons");
    this.abilityDetailKeyEl = this.el.querySelector(".session-setup__ability-detail-key");
    this.abilityDetailTitleEl = this.el.querySelector(".session-setup__ability-detail-title");
    this.abilityDetailTextEl = this.el.querySelector(".session-setup__ability-detail-text");
    this.guideLinesEl = this.el.querySelector(".session-setup__guide-lines");
    this.infoTabs = [...this.el.querySelectorAll("[data-info-tab]")];
    this.infoPanels = [...this.el.querySelectorAll("[data-info-panel]")];
    this.scenarioButtonsEl = this.el.querySelector(".session-setup__scenario-buttons");
    this.launchBtn = this.el.querySelector(".session-setup__launch");
    this.shipHelpEl = this.el.querySelector(".session-setup__ship-help");
    this.inputEl.value = stored.pseudo;
    if (this.modePseudoEl) this.modePseudoEl.value = stored.pseudo;
    if (this.currentPseudoEl) this.currentPseudoEl.textContent = stored.pseudo;
    this.loginNameEl.value = stored.accountName || stored.pseudo;
    this.registerNameEl.value = stored.accountName || stored.pseudo;
    this.el.querySelectorAll("[data-auth-start]").forEach((btn) => btn.addEventListener("click", () => this.startAuth(btn.dataset.authStart || "guest")));
    this.el.querySelectorAll("[data-step-back]").forEach((btn) => btn.addEventListener("click", () => this.goBack()));
    this.el.querySelectorAll("[data-step-next]").forEach((btn) => btn.addEventListener("click", () => this.continueFromMode()));
    this.el.querySelector("[data-wait-cancel]")?.addEventListener("click", () => {
      this.selectedMode = "endless";
      this.selectedBattleSessionId = "";
      this.waitingAck = false;
      this.onCancelWaiting?.();
      this.goToStep("mode");
      this.renderModeList();
    });
    this.launchBtn.addEventListener("click", () => this.commit());
    this.infoTabs.forEach((btn) => btn.addEventListener("click", () => {
      this.selectedInfoTab = btn.dataset.infoTab || "ability";
      this.renderDetails();
    }));
    this.startPreviewLoop();
    for (const btn of this.modeButtons) btn.addEventListener("click", () => this.selectMode(btn.dataset.mode, btn.dataset.serverId || ""));
    const syncPseudo = (from, to) => {
      this.inputDirty = true;
      const pseudo = normalizePseudo(from.value);
      if (to) to.value = pseudo;
      if (this.currentPseudoEl) this.currentPseudoEl.textContent = pseudo;
      this.saveStored();
    };
    this.inputEl.addEventListener("input", () => syncPseudo(this.inputEl, this.modePseudoEl));
    this.modePseudoEl?.addEventListener("input", () => syncPseudo(this.modePseudoEl, this.inputEl));
    this.loginNameEl.addEventListener("input", () => this.saveStored());
    this.registerNameEl.addEventListener("input", () => this.saveStored());
    this.el.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      if (this.step === "auth") this.startAuth(this.accountAction || "guest");
      else if (this.step === "mode") this.continueFromMode();
      else if (this.step === "ship") this.commit();
    });
    this.renderShipList();
    this.renderModeList();
    this.renderDetails();
    this.goToStep("auth");
    this.applyVisibility();
  }
  getModeProfileKey(mode = this.selectedMode) {
    const m = String(mode || "endless");
    if (m === "battle_next" || m === "battle_server") return "battle";
    if (m === "test_server" || m === "test_world" || m === "stress_server") return "test";
    return "endless";
  }
  saveStored() {
    storeSetup({
      pseudo: normalizePseudo(this.inputEl.value),
      frameId: this.selectedFrameId,
      frameByMode: { ...this.frameByMode, [this.getModeProfileKey()]: this.selectedFrameId },
      mode: this.selectedMode,
      battleSessionId: this.selectedBattleSessionId || "",
      testWorldId: this.selectedTestWorldId || "test-hub",
      accountName: normalizePseudo(this.loginNameEl?.value || this.registerNameEl?.value || this.inputEl.value)
    });
  }
  setAuthStatus(message, ok = null) {
    this.authStatus = message ? { message, ok } : null;
    if (!this.authStatusEl) return;
    this.authStatusEl.textContent = message || "";
    this.authStatusEl.classList.toggle("is-visible", !!message);
    this.authStatusEl.classList.toggle("is-error", ok === false);
    this.authStatusEl.classList.toggle("is-ok", ok === true);
  }
  startAuth(action) {
    this.accountAction = action || "guest";
    if (this.accountAction === "guest") {
      const pseudo = normalizePseudo(this.inputEl.value);
      this.inputEl.value = pseudo;
      if (this.modePseudoEl) this.modePseudoEl.value = pseudo;
      if (this.currentPseudoEl) this.currentPseudoEl.textContent = pseudo;
      this.setAuthStatus("Mode invit\xE9 s\xE9lectionn\xE9.", true);
      this.goToStep("mode");
      return;
    }
    const isRegister = this.accountAction === "register";
    const nameEl = isRegister ? this.registerNameEl : this.loginNameEl;
    const passEl = isRegister ? this.registerPasswordEl : this.loginPasswordEl;
    const name = normalizePseudo(nameEl.value);
    const pass = String(passEl.value || "");
    if (name.length < 2) {
      this.setAuthStatus("Pseudo trop court.", false);
      return;
    }
    if (pass.length < 4) {
      this.setAuthStatus("Mot de passe trop court.", false);
      return;
    }
    nameEl.value = name;
    this.inputEl.value = name;
    if (this.modePseudoEl) this.modePseudoEl.value = name;
    if (this.currentPseudoEl) this.currentPseudoEl.textContent = name;
    this.authRequestPending = true;
    this.authenticatedAccountName = "";
    this.authenticatedPassword = "";
    this.setAuthStatus(isRegister ? "Cr\xE9ation du compte\u2026" : "Connexion\u2026", null);
    this.onAuth?.({
      pseudo: name,
      accountAction: this.accountAction,
      accountName: name,
      accountPassword: pass
    });
  }
  goToStep(step) {
    if (!STEPS.includes(step)) return;
    this.step = step;
    this.previewSuspended = step !== "ship" || this.waitingAck;
    this.el.querySelectorAll("[data-step]").forEach((page) => page.classList.toggle("is-active", page.dataset.step === step));
    this.el.querySelectorAll("[data-step-dot]").forEach((dot) => dot.classList.toggle("is-active", dot.dataset.stepDot === step));
    this.renderModeList();
    this.renderDetails();
  }
  goBack() {
    const index = STEPS.indexOf(this.step);
    this.goToStep(STEPS[Math.max(0, index - 1)] || "auth");
  }
  continueFromMode() {
    if (this.selectedMode === "battle_server" && !this.selectedBattleSessionId) {
      if (this.selectionSummaryEl) this.selectionSummaryEl.textContent = "S\xE9lectionne un serveur Battle ouvert ou choisis Endless.";
      return;
    }
    this.goToStep("ship");
  }
  renderShipList() {
    this.shipListEl.innerHTML = "";
    for (const card of this.cards) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "session-setup__ship-card";
      if (card.id === this.selectedFrameId) button.classList.add("is-selected");
      button.style.setProperty("--ship-accent", card.accent);
      button.innerHTML = `
        <canvas class="session-setup__ship-card-glyph" width="72" height="72"></canvas>
        <span class="session-setup__ship-card-copy">
          <span class="session-setup__ship-card-name">${card.name}</span>
        </span>
      `;
      button.addEventListener("click", () => this.selectFrame(card.id));
      this.shipListEl.appendChild(button);
      const canvas = button.querySelector("canvas");
      const ctx = canvas?.getContext("2d");
      if (ctx) drawSessionShipGlyph(ctx, 1, 36, 36, 13, card.id, -0.46, performance.now() / 1e3, { thrust: 0.35, emphasize: card.id === this.selectedFrameId });
    }
  }
  renderAbilityControls(card) {
    if (!this.abilitiesEl || !this.phaseButtonsEl) return;
    this.abilitiesEl.innerHTML = "";
    card.abilities.forEach((ability, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "session-setup__ability";
      if (index === this.selectedAbilityIndex) button.classList.add("is-selected");
      button.innerHTML = `
        <span class="session-setup__ability-key">${ability.key}</span>
        <span class="session-setup__ability-label">${ability.label}</span>
      `;
      button.addEventListener("click", () => {
        this.selectedAbilityIndex = index;
        this.selectedScenarioIndex = 0;
        this.renderDetails();
      });
      this.abilitiesEl.appendChild(button);
    });
    this.phaseButtonsEl.innerHTML = "";
    for (let i = 1; i <= 5; i += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "session-setup__phase-button";
      if (i === this.selectedPreviewPhase) button.classList.add("is-selected");
      button.textContent = `Phase ${i}`;
      button.addEventListener("click", () => {
        this.selectedPreviewPhase = i;
        this.selectedScenarioIndex = 0;
        this.renderDetails();
      });
      this.phaseButtonsEl.appendChild(button);
    }
  }
  formatDuration(ms) {
    const total = Math.max(0, Math.ceil(Number(ms || 0) / 1e3));
    const h = Math.floor(total / 3600);
    const m = Math.floor(total % 3600 / 60);
    const sec = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  renderModeList() {
    for (const btn of this.modeButtons) {
      const mode = btn.dataset.mode;
      const serverId = btn.dataset.serverId || "";
      btn.classList.toggle("is-selected", mode === this.selectedMode && (!serverId || serverId === this.selectedBattleSessionId));
    }
    if (this.endlessCountEl) {
      const n = this.modes?.endlessPlayerCount ?? 0;
      this.endlessCountEl.textContent = `${n} joueur${n > 1 ? "s" : ""}`;
    }
    if (this.testCountEl) {
      const n = this.modes?.testPlayerCount ?? 0;
      this.testCountEl.textContent = `${n} joueur${n > 1 ? "s" : ""}`;
    }
    if (this.battleWaitingCountEl) {
      const n = this.modes?.battleWaitingCount ?? 0;
      this.battleWaitingCountEl.textContent = `${n} en attente`;
    }
    const nextText = `Ouverture dans ${this.formatDuration(this.modes?.battleNextInMs || 0)}`;
    if (this.battleNextEl) this.battleNextEl.textContent = nextText;
    if (this.waitingTimerEl) this.waitingTimerEl.textContent = nextText;
    if (this.testWorldListEl) {
      const worlds = Array.isArray(this.modes?.testWorlds) && this.modes.testWorlds.length ? this.modes.testWorlds : [
        { id: "test-hub", title: "Server Test", subtitle: "", playerCount: this.modes?.testPlayerCount ?? 0 }
      ];
      this.testWorldListEl.innerHTML = "";
      for (const world of worlds) {
        const id = String(world.id || "test-hub");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "session-setup__server-card session-setup__server-card--test";
        btn.dataset.mode = "test_world";
        btn.dataset.testWorldId = id;
        if (this.selectedMode === "test_world" && this.selectedTestWorldId === id) btn.classList.add("is-selected");
        const n = world.playerCount ?? 0;
        btn.innerHTML = `
          <div class="session-setup__server-main">
            <b>${world.title || "Server Test"}</b>
          </div>
          <div class="session-setup__server-meta">
            <span>${n} joueur${n > 1 ? "s" : ""}</span>
          </div>
        `;
        btn.addEventListener("click", () => this.selectMode("test_world", id));
        this.testWorldListEl.appendChild(btn);
      }
    }
    if (this.battleServerListEl) {
      const sessions = [...this.modes?.battleSessions ?? []].filter((s) => s && s.state === "lobby" && s.joinable !== false).sort((a, b) => Number(b.startsAtMs || 0) - Number(a.startsAtMs || 0));
      if (this.selectedMode === "battle_server" && this.selectedBattleSessionId && !sessions.some((s) => String(s.id || "") === this.selectedBattleSessionId)) {
        this.selectedMode = "endless";
        this.selectedBattleSessionId = "";
      }
      if (!sessions.length) {
        this.battleServerListEl.innerHTML = '<div class="session-setup__server-empty">Aucun serveur Battle ouvert.</div>';
      } else {
        this.battleServerListEl.innerHTML = "";
        for (const session of sessions) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "session-setup__server-card session-setup__server-card--battle";
          btn.dataset.mode = "battle_server";
          btn.dataset.serverId = session.id || "";
          if (this.selectedMode === "battle_server" && this.selectedBattleSessionId === String(session.id || "")) btn.classList.add("is-selected");
          const timeLabel = `d\xE9but dans ${this.formatDuration(session.remainingMs)}`;
          btn.innerHTML = `
            <div class="session-setup__server-main">
              <b>Battle Royale #${session.seq ?? "?"}</b>
            </div>
            <div class="session-setup__server-meta">
              <span>${session.playerCount ?? 0} joueur${(session.playerCount ?? 0) > 1 ? "s" : ""}</span>
              <span>${timeLabel}</span>
              <span class="session-setup__server-join" data-mode="battle_server" data-server-id="${session.id || ""}">S\xE9lectionner</span>
            </div>
          `;
          btn.addEventListener("click", () => this.selectMode("battle_server", session.id || ""));
          this.battleServerListEl.appendChild(btn);
        }
      }
    }
    if (this.selectionSummaryEl) {
      let label = "Battle Royale";
      if (this.selectedMode === "endless") label = "Endless";
      else if (this.selectedMode === "test_world" || this.selectedMode === "test_server") label = "Server Test";
      else if (this.selectedMode === "stress_server") label = "Stress";
      else if (this.selectedMode === "battle_next") label = "File Battle Royale";
      this.selectionSummaryEl.textContent = `S\xE9lection : ${label}`;
    }
    if (this.currentPseudoEl) this.currentPseudoEl.textContent = this.getActiveAccountName();
  }
  selectMode(mode, battleSessionId = "") {
    if (!["endless", "test_server", "test_world", "stress_server", "battle_next", "battle_server"].includes(mode)) return;
    this.frameByMode[this.getModeProfileKey(this.selectedMode)] = this.selectedFrameId;
    this.selectedMode = mode;
    this.selectedBattleSessionId = mode === "battle_server" ? String(battleSessionId || "") : "";
    if (mode === "test_world") this.selectedTestWorldId = String(battleSessionId || "test-hub");
    const savedFrame = this.frameByMode[this.getModeProfileKey(mode)];
    if (savedFrame && this.cards.some((card) => card.id === savedFrame)) this.selectedFrameId = savedFrame;
    this.saveStored();
    this.renderShipList();
    this.renderModeList();
    this.renderDetails();
  }
  getSelectedCard() {
    return this.cards.find((card) => card.id === this.selectedFrameId) || this.cards[0];
  }
  selectFrame(frameId) {
    if (!this.cards.some((card) => card.id === frameId)) return;
    this.selectedFrameId = frameId;
    this.frameByMode[this.getModeProfileKey()] = frameId;
    this.selectedScenarioIndex = 0;
    this.saveStored();
    this.renderShipList();
    this.renderModeList();
    this.renderDetails();
  }
  renderScenarioControls(card, ability) {
    if (!this.scenarioButtonsEl) return;
    const scenarios = typeof ability?.getScenarios === "function" ? ability.getScenarios(this.selectedPreviewPhase) : [];
    const list = Array.isArray(scenarios) && scenarios.length ? scenarios : [{ id: "base", label: "Base" }];
    if (this.selectedScenarioIndex >= list.length) this.selectedScenarioIndex = 0;
    this.scenarioButtonsEl.innerHTML = "";
    for (let i = 0; i < list.length; i += 1) {
      const sc = list[i];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "session-setup__scenario-button";
      if (i === this.selectedScenarioIndex) btn.classList.add("is-selected");
      btn.textContent = sc.label || sc.id || `Sc\xE9nario ${i + 1}`;
      btn.addEventListener("click", () => {
        this.selectedScenarioIndex = i;
        this.renderDetails();
      });
      this.scenarioButtonsEl.appendChild(btn);
    }
  }
  updateInfoTabs() {
    for (const btn of this.infoTabs || []) btn.classList.toggle("is-selected", (btn.dataset.infoTab || "") === this.selectedInfoTab);
    for (const panel of this.infoPanels || []) panel.classList.toggle("is-active", (panel.dataset.infoPanel || "") === this.selectedInfoTab);
  }
  renderDetails() {
    const card = this.getSelectedCard();
    if (!card) return;
    if (this.selectedAbilityIndex >= card.abilities.length) this.selectedAbilityIndex = 0;
    this.el.style.setProperty("--session-accent", card.accent);
    this.nameEl.textContent = card.name;
    this.metaEl.textContent = "";
    this.taglineEl.textContent = "";
    this.statsEl.innerHTML = card.stats.map((stat) => `
      <div class="session-setup__stat-row">
        <div class="session-setup__stat-top"><span>${stat.label}</span><span>${stat.value}</span></div>
        <div class="session-setup__stat-bar"><div class="session-setup__stat-fill" style="width:${Math.round(28 + stat.fill01 * 72)}%"></div></div>
      </div>
    `).join("");
    this.renderAbilityControls(card);
    const ability = card.abilities[this.selectedAbilityIndex] || card.abilities[0];
    this.renderScenarioControls(card, ability);
    this.updateInfoTabs();
    if (this.abilityDetailKeyEl) this.abilityDetailKeyEl.textContent = ability?.key || "";
    if (this.abilityDetailTitleEl) this.abilityDetailTitleEl.textContent = ability?.name || ability?.label || "";
    if (this.abilityDetailTextEl) {
      const lines = typeof ability?.getLines === "function" ? ability.getLines(this.selectedPreviewPhase) : ability?.lines || [ability?.text || ""];
      this.abilityDetailTextEl.innerHTML = lines.filter(Boolean).map((line3) => `<div>${line3}</div>`).join("");
    }
    if (this.guideLinesEl) {
      this.guideLinesEl.innerHTML = (card.guide || []).map((line3) => `<div>${line3}</div>`).join("");
    }
    if (!this.previewSuspended) this.safeDrawPreview(performance.now() / 1e3);
  }
  startPreviewLoop() {
    let lastPreviewAt = 0;
    const tick = (now) => {
      this.previewRaf = requestAnimationFrame(tick);
      if (this.previewSuspended || this.step !== "ship" || this.el.classList.contains("is-hidden")) return;
      if (now - lastPreviewAt < 1e3 / 30) return;
      lastPreviewAt = now;
      this.safeDrawPreview(now / 1e3);
    };
    this.previewRaf = requestAnimationFrame(tick);
  }
  safeDrawPreview(time) {
    try {
      this.drawPreview(time);
    } catch (err) {
      if (!this.previewErrorLogged) {
        this.previewErrorLogged = true;
        console.error("[SessionSetupOverlay] preview disabled after renderer error", err);
      }
      const canvas = this.previewEl;
      const ctx = this.previewCtx;
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
      const w = Math.max(1, Math.floor(rect.width || 760));
      const h = Math.max(1, Math.floor(rect.height || 330));
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(5, 9, 16, 0.98)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(235, 242, 255, 0.86)";
      ctx.font = `700 ${13 * dpr}px var(--ui-font, Segoe UI)`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Pr\xE9visualisation indisponible", canvas.width * 0.5, canvas.height * 0.5);
    }
  }
  drawPreview(time) {
    const card = this.getSelectedCard();
    if (!card) return;
    if (this.glyphEl instanceof HTMLCanvasElement) {
      const rect = this.glyphEl.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
      const w = Math.max(1, Math.floor(rect.width || 92));
      const h = Math.max(1, Math.floor(rect.height || 92));
      if (this.glyphEl.width !== Math.floor(w * dpr) || this.glyphEl.height !== Math.floor(h * dpr)) {
        this.glyphEl.width = Math.floor(w * dpr);
        this.glyphEl.height = Math.floor(h * dpr);
      }
      const ctx = this.glyphEl.getContext("2d");
      ctx.clearRect(0, 0, this.glyphEl.width, this.glyphEl.height);
      drawSessionShipGlyph(ctx, dpr, w * 0.5, h * 0.5, Math.min(w, h) * 0.18, card.id, -0.48 + Math.sin(time * 1.2) * 0.06, time, { thrust: 0.54, emphasize: true });
    }
    if (this.previewCtx && this.previewEl) {
      drawSessionRealAbilityDemo(this.previewCtx, this.previewEl, card, this.selectedAbilityIndex, this.selectedPreviewPhase, time, this.selectedScenarioIndex);
    }
  }
  getActiveAccountName() {
    if (this.accountAction === "login") return normalizePseudo(this.loginNameEl.value);
    if (this.accountAction === "register") return normalizePseudo(this.registerNameEl.value);
    return normalizePseudo(this.inputEl.value);
  }
  getActivePassword() {
    if (this.accountAction === "login") return this.loginPasswordEl.value;
    if (this.accountAction === "register") return this.registerPasswordEl.value;
    return "";
  }
  commit() {
    const pseudo = this.accountAction === "guest" ? normalizePseudo(this.inputEl.value) : this.getActiveAccountName();
    const payload = {
      pseudo,
      frameId: this.selectedFrameId,
      frameByMode: { ...this.frameByMode, [this.getModeProfileKey()]: this.selectedFrameId },
      mode: this.selectedMode,
      battleSessionId: this.selectedBattleSessionId || "",
      testWorldId: this.selectedTestWorldId || "test-hub",
      accountAction: this.accountAction === "guest" ? "guest" : "login",
      accountName: this.accountAction === "guest" ? "" : this.authenticatedAccountName || this.getActiveAccountName(),
      accountPassword: this.accountAction === "guest" ? "" : this.authenticatedPassword || this.getActivePassword()
    };
    this.inputEl.value = payload.pseudo;
    if (this.modePseudoEl) this.modePseudoEl.value = payload.pseudo;
    if (this.currentPseudoEl) this.currentPseudoEl.textContent = payload.pseudo;
    storeSetup(payload);
    this.inputDirty = false;
    this.waitingAck = true;
    this.previewSuspended = true;
    if (this.previewRaf) {
      cancelAnimationFrame(this.previewRaf);
      this.previewRaf = 0;
    }
    this.launchBtn.disabled = true;
    this.launchBtn.textContent = payload.mode === "battle_next" ? "Mise en attente\u2026" : "D\xE9ploiement\u2026";
    this.onCommit?.(payload);
  }
  sync(storeState, connected, modes = null) {
    this.modes = modes;
    const pending = !!connected && (storeState?.sessionSetup?.pending ?? true);
    const queuedNext = !!modes?.battleQueuedNext;
    const requestedStep = String(storeState?.sessionSetup?.step || "");
    const auth = storeState?.sessionSetup?.authStatus || null;
    if (auth?.message && auth.message !== this.authStatus?.message) {
      this.setAuthStatus(auth.message, auth.ok !== false);
      if (auth.ok === false) {
        this.authRequestPending = false;
        this.authenticatedAccountName = "";
        this.authenticatedPassword = "";
        this.waitingAck = false;
        this.goToStep("auth");
      } else if (this.authRequestPending && this.step === "auth") {
        this.authRequestPending = false;
        this.authenticatedAccountName = this.getActiveAccountName();
        this.authenticatedPassword = this.getActivePassword();
        this.accountAction = "login";
        this.goToStep("mode");
      }
    }
    if (pending && (queuedNext || requestedStep === "waiting") && this.step !== "waiting") this.goToStep("waiting");
    else if (pending && requestedStep === "mode" && !["mode", "ship"].includes(this.step)) this.goToStep("mode");
    else if (pending && !queuedNext && !requestedStep && !this.serverPending && this.step !== "auth") this.goToStep("auth");
    this.serverPending = pending;
    if (storeState?.pseudo && !this.waitingAck && !this.inputDirty && document.activeElement !== this.inputEl && document.activeElement !== this.modePseudoEl) {
      const syncedPseudo = normalizePseudo(storeState.pseudo);
      this.inputEl.value = syncedPseudo;
      if (this.modePseudoEl) this.modePseudoEl.value = syncedPseudo;
      if (this.currentPseudoEl) this.currentPseudoEl.textContent = syncedPseudo;
      if (!this.loginNameEl.value) this.loginNameEl.value = syncedPseudo;
      if (!this.registerNameEl.value) this.registerNameEl.value = syncedPseudo;
    }
    if (!this.serverPending) {
      this.waitingAck = false;
      this.previewSuspended = true;
      this.launchBtn.disabled = false;
      this.launchBtn.textContent = "D\xE9ployer";
    } else if (this.step === "ship" && !this.waitingAck) {
      this.previewSuspended = false;
      this.launchBtn.disabled = false;
      if (!this.previewRaf) this.startPreviewLoop();
    }
    this.renderModeList();
    this.applyVisibility(queuedNext);
  }
  applyVisibility(queuedNext = false) {
    this.el.classList.toggle("is-hidden", !this.serverPending && !queuedNext);
  }
};

// client/src/ui/status/WorldStatusRenderer.js
function drawWorldStatuses(ctx, view, entity, camX, camY, t) {
  const statuses = entity?.statuses ?? [];
  if (!statuses.length) return;
  const shown = statuses.slice(0, 4);
  const sx = entity.x - camX + view.cssW * 0.5;
  const sy = entity.y - camY + view.cssH * 0.5;
  const size = 17;
  const gap = 3;
  const total = shown.length * size + (shown.length - 1) * gap;
  const x0 = sx - total * 0.5;
  const y = sy - (entity.radius || 14) - 24 - 1.2 * Math.sin(t * 5 + entity.id * 0.13);
  for (let i = 0; i < shown.length; i += 1) {
    const entry = shown[i];
    const p = entry.primaryColor ?? { r: 220, g: 220, b: 220 };
    const x = x0 + i * (size + gap);
    ctx.fillStyle = "rgba(6,9,14,0.88)";
    ctx.strokeStyle = rgba(p.r, p.g, p.b, 0.68);
    ctx.lineWidth = view.dpr;
    const rr = 4 * view.dpr;
    const xx = x * view.dpr, yy = y * view.dpr, ww = size * view.dpr, hh = size * view.dpr;
    ctx.beginPath();
    ctx.moveTo(xx + rr, yy);
    ctx.lineTo(xx + ww - rr, yy);
    ctx.quadraticCurveTo(xx + ww, yy, xx + ww, yy + rr);
    ctx.lineTo(xx + ww, yy + hh - rr);
    ctx.quadraticCurveTo(xx + ww, yy + hh, xx + ww - rr, yy + hh);
    ctx.lineTo(xx + rr, yy + hh);
    ctx.quadraticCurveTo(xx, yy + hh, xx, yy + hh - rr);
    ctx.lineTo(xx, yy + rr);
    ctx.quadraticCurveTo(xx, yy, xx + rr, yy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawStatusGlyph(ctx, view.dpr, entry, x + 2, y + 2, size - 4, 0.95);
    const frac = Math.max(0, Math.min(1, (entry.durationLeft ?? 0) / Math.max(1e-3, entry.baseDuration ?? entry.durationLeft ?? 1)));
    ctx.strokeStyle = rgba(p.r, p.g, p.b, 0.82);
    ctx.lineWidth = 1.2 * view.dpr;
    ctx.beginPath();
    ctx.arc((x + size - 4) * view.dpr, (y + 4) * view.dpr, 3.2 * view.dpr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.stroke();
    if ((entry.stacks ?? 1) > 1) {
      ctx.font = `${7.5 * view.dpr}px Segoe UI`;
      ctx.fillStyle = rgba(255, 245, 210, 0.92);
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${entry.stacks}`, (x + size - 2) * view.dpr, (y + size + 1) * view.dpr);
    }
  }
}

// client/src/ui/players/PlayersPanelView.js
function fmtSector(p) {
  if (p?.inBastion) return "Bastion";
  return `[${p?.sx | 0},${p?.sy | 0}]`;
}
function fmtBastions(p) {
  const list = p?.bastions || [];
  if (!list.length) return '<span class="players-panel__empty">aucun</span>';
  return list.map((b) => `<span class="players-panel__tag" title="${escapeHtml2(b.name || b.sourceLabel || "Bastion")}">${escapeHtml2(b.glyph || "BST")}</span>`).join("");
}
function escapeHtml2(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function fmtTimer(session) {
  const ms = Math.max(0, session?.remainingMs ?? 0);
  const totalSec = Math.ceil(ms / 1e3);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
var PlayersPanelView = class {
  constructor() {
    this.el = document.createElement("aside");
    this.el.className = "players-panel";
    this.open = true;
    this.activeTab = "players";
    this.lastChatCount = -1;
    this.lastUnread = -1;
    this.sendChat = null;
    this.el.innerHTML = `
      <div class="players-panel__tabs">
        <button class="players-panel__toggle is-active" type="button" data-role="tab-players">Players</button>
        <button class="players-panel__toggle players-panel__toggle--chat" type="button" data-role="tab-chat">Chat <span class="players-panel__unread" data-role="chat-unread"></span></button>
      </div>
      <div class="players-panel__body" data-role="body">
        <section class="players-panel__page is-active" data-role="page-players">
          <div class="players-panel__top">
            <div class="players-panel__title">Pilotes</div>
            <div class="players-panel__timer" data-role="timer">60:00</div>
          </div>
          <div class="players-panel__list" data-role="list"></div>
        </section>
        <section class="players-panel__page players-panel__page--chat" data-role="page-chat">
          <div class="players-panel__top">
            <div class="players-panel__title">Chat</div>
            <div class="players-panel__timer players-panel__timer--chat">Entr\xE9e</div>
          </div>
          <div class="players-panel__chat-log" data-role="chat-log"></div>
          <form class="players-panel__chat-form" data-role="chat-form" autocomplete="off">
            <input class="players-panel__chat-input" data-role="chat-input" maxlength="220" placeholder="\xC9crire un message\u2026" />
          </form>
        </section>
      </div>
    `;
    this.bodyEl = this.el.querySelector('[data-role="body"]');
    this.listEl = this.el.querySelector('[data-role="list"]');
    this.timerEl = this.el.querySelector('[data-role="timer"]');
    this.tabPlayersEl = this.el.querySelector('[data-role="tab-players"]');
    this.tabChatEl = this.el.querySelector('[data-role="tab-chat"]');
    this.pagePlayersEl = this.el.querySelector('[data-role="page-players"]');
    this.pageChatEl = this.el.querySelector('[data-role="page-chat"]');
    this.chatLogEl = this.el.querySelector('[data-role="chat-log"]');
    this.chatFormEl = this.el.querySelector('[data-role="chat-form"]');
    this.chatInputEl = this.el.querySelector('[data-role="chat-input"]');
    this.chatUnreadEl = this.el.querySelector('[data-role="chat-unread"]');
    this.tabPlayersEl.addEventListener("click", () => this.setTab("players"));
    this.tabChatEl.addEventListener("click", () => this.setTab("chat", { focus: true }));
    this.chatFormEl.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const text = this.chatInputEl.value.trim();
      if (!text) return;
      this.sendChat?.(text);
      this.chatInputEl.value = "";
    });
    this.chatInputEl.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Escape") {
        this.chatInputEl.blur();
        this.setTab("players");
        ev.preventDefault();
      }
    });
  }
  setTab(tab, options = {}) {
    this.activeTab = tab === "chat" ? "chat" : "players";
    this.tabPlayersEl.classList.toggle("is-active", this.activeTab === "players");
    this.tabChatEl.classList.toggle("is-active", this.activeTab === "chat");
    this.pagePlayersEl.classList.toggle("is-active", this.activeTab === "players");
    this.pageChatEl.classList.toggle("is-active", this.activeTab === "chat");
    this.el.classList.remove("is-collapsed");
    this.open = true;
    if (this.activeTab === "chat") {
      options.store?.clearChatUnread?.();
      if (options.focus) setTimeout(() => this.chatInputEl.focus(), 0);
    }
  }
  bindChat(sendChat) {
    this.sendChat = sendChat;
    window.addEventListener("keydown", (ev) => {
      const tag = String(ev.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || ev.target?.isContentEditable) return;
      if (ev.key === "Enter") {
        this.setTab("chat", { focus: true });
        ev.preventDefault();
      }
    });
  }
  update(players, session, myId = 0, modes = null, store = null) {
    if (modes?.currentMode === "battle") {
      const br = modes.battleSessions?.find?.((s) => s.id === modes.battleSessionId);
      this.timerEl.textContent = br ? `BR ${fmtTimer({ remainingMs: br.remainingMs })}` : modes.battleQueuedNext ? `BR ${fmtTimer({ remainingMs: modes.battleNextInMs })}` : "BR";
    } else if (modes?.currentMode === "test") {
      this.timerEl.textContent = modes?.testWorldTitle ? `TEST \xB7 ${modes.testWorldTitle.replace(/^Update /, "U")}` : "TEST";
    } else {
      this.timerEl.textContent = "Endless";
    }
    const arr = Array.isArray(players) ? [...players] : [];
    arr.sort((a, b) => (b.level | 0) - (a.level | 0) || ((a.id | 0) === (myId | 0) ? -1 : (b.id | 0) === (myId | 0) ? 1 : 0) || String(a.pseudo || "").localeCompare(String(b.pseudo || "")));
    if (!arr.length) {
      this.listEl.innerHTML = '<div class="players-panel__emptyline">Aucun pilote d\xE9ploy\xE9</div>';
    } else {
      this.listEl.innerHTML = arr.map((p) => `
        <div class="players-panel__row ${(p.id | 0) === (myId | 0) ? "is-me" : ""}">
          <div class="players-panel__main">
            <span class="players-panel__name">${escapeHtml2(p.pseudo || `Joueur ${p.id}`)}</span>
            <span class="players-panel__ship">${escapeHtml2(p.frameName || p.frameId || "Vaisseau")}</span>
          </div>
          <div class="players-panel__meta">
            <span>Lv ${p.level | 0}</span>
            <span>${escapeHtml2(fmtSector(p))}</span>
          </div>
          <div class="players-panel__tags">${fmtBastions(p)}</div>
        </div>
      `).join("");
    }
    if (store) this.updateChat(store);
  }
  updateChat(store) {
    const messages = store?.chatMessages || [];
    const unread = store?.chatUnread || 0;
    if (this.activeTab === "chat" && unread > 0) store.clearChatUnread?.();
    const shownUnread = this.activeTab === "chat" ? 0 : unread;
    if (shownUnread > 0) {
      this.chatUnreadEl.textContent = shownUnread > 9 ? "9+" : String(shownUnread);
      this.tabChatEl.classList.add("has-unread");
    } else {
      this.chatUnreadEl.textContent = "";
      this.tabChatEl.classList.remove("has-unread");
    }
    if (messages.length === this.lastChatCount && shownUnread === this.lastUnread) return;
    this.lastChatCount = messages.length;
    this.lastUnread = shownUnread;
    if (!messages.length) {
      this.chatLogEl.innerHTML = '<div class="players-panel__emptyline">Aucun message</div>';
      return;
    }
    this.chatLogEl.innerHTML = messages.slice(-60).map((m) => `
      <div class="players-panel__chat-msg">
        <span class="players-panel__chat-name">${escapeHtml2(m.name)}</span>
        <span class="players-panel__chat-text">${escapeHtml2(m.text)}</span>
      </div>
    `).join("");
    this.chatLogEl.scrollTop = this.chatLogEl.scrollHeight;
  }
};

// client/src/ui/options/OptionsPanelView.js
var DEFAULT_SETTINGS = Object.freeze({
  masterVolume: 0,
  musicVolume: -18,
  reactorVolume: -20,
  sfxVolume: -12,
  starDensity: 1,
  showGrid: true,
  showFx: true,
  renderScale: 1
});
var AUDIO_KEYS = /* @__PURE__ */ new Set(["masterVolume", "musicVolume", "reactorVolume", "sfxVolume"]);
function clamp014(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}
function clamp7(v, min, max) {
  const n = Number(v);
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
}
function normalizeAudioDb(key, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS[key];
  if ((n === 0 || n <= -60) && key !== "masterVolume") return DEFAULT_SETTINGS[key];
  if (n > 0 && n <= 1) return Math.round(-60 + n * 60);
  return clamp7(n, -60, 0);
}
function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem("spacefrontier.options") || "{}");
    const merged = { ...DEFAULT_SETTINGS, ...raw };
    for (const key of AUDIO_KEYS) merged[key] = normalizeAudioDb(key, merged[key]);
    merged.starDensity = clamp014(merged.starDensity);
    merged.renderScale = clamp7(merged.renderScale, 0.6, 1);
    merged.showGrid = merged.showGrid !== false;
    merged.showFx = merged.showFx !== false;
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
var OptionsPanelView = class {
  constructor(onChange) {
    this.onChange = typeof onChange === "function" ? onChange : null;
    this.settings = loadSettings();
    this.el = document.createElement("section");
    this.el.className = "options-panel";
    this.el.innerHTML = `
      <div class="options-panel__head">
        <h2>Options</h2>
        <span>Audio \xB7 Graphismes \xB7 Contr\xF4les</span>
      </div>
      <div class="options-panel__body">
        <section class="options-section">
          <div class="options-section__title">Audio</div>
          ${this.renderAudioSlider("Sortie g\xE9n\xE9rale", "masterVolume")}
          ${this.renderAudioSlider("Musique", "musicVolume")}
          ${this.renderAudioSlider("R\xE9acteur", "reactorVolume")}
          ${this.renderAudioSlider("Effets", "sfxVolume")}
        </section>
        <section class="options-section">
          <div class="options-section__title">Graphismes</div>
          ${this.renderSlider("\xC9toiles", "starDensity")}
          ${this.renderSlider("\xC9chelle rendu", "renderScale", 0.6, 1, 0.05)}
          ${this.renderToggle("Grille secteur", "showGrid")}
          ${this.renderToggle("Effets visuels", "showFx")}
        </section>
        <section class="options-section">
          <div class="options-section__title">Contr\xF4les</div>
          <div class="options-controls">
            <div><span>Construire</span><b>clic gauche</b></div>
            <div><span>Orienter</span><b>O</b></div>
            <div><span>Annuler</span><b>\xC9chap</b></div>
            <div><span>D\xE9construction</span><b>menu Build</b></div>
          </div>
        </section>
      </div>
    `;
    this.el.addEventListener("input", (ev) => {
      const key = ev.target?.dataset?.key;
      if (!key) return;
      if (ev.target.type === "range") {
        this.settings[key] = AUDIO_KEYS.has(key) ? clamp7(ev.target.value, -60, 0) : key === "renderScale" ? clamp7(ev.target.value, 0.6, 1) : clamp014(ev.target.value);
      }
      this.save();
      this.refreshValue(key);
    });
    this.el.addEventListener("change", (ev) => {
      const key = ev.target?.dataset?.key;
      if (!key) return;
      if (ev.target.type === "checkbox") this.settings[key] = !!ev.target.checked;
      this.save();
    });
    this.refreshAll();
  }
  renderSlider(label, key, min = 0, max = 1, step = 0.01) {
    const value = this.settings[key];
    return `<label class="options-row"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-key="${key}"><b data-value="${key}">0%</b></label>`;
  }
  renderAudioSlider(label, key) {
    const value = this.settings[key];
    return `<label class="options-row"><span>${label}</span><input type="range" min="-60" max="0" step="1" value="${value}" data-key="${key}"><b data-value="${key}">0 dB</b></label>`;
  }
  renderToggle(label, key) {
    return `<label class="options-row options-row--toggle"><span>${label}</span><input type="checkbox" ${this.settings[key] ? "checked" : ""} data-key="${key}"></label>`;
  }
  refreshValue(key) {
    const node = this.el.querySelector(`[data-value="${key}"]`);
    if (!node) return;
    if (AUDIO_KEYS.has(key)) {
      const db = clamp7(this.settings[key], -60, 0);
      node.textContent = db <= -60 ? "muet" : `${db} dB`;
      return;
    }
    node.textContent = `${Math.round((Number(this.settings[key]) || 0) * 100)}%`;
  }
  refreshAll() {
    for (const key of ["masterVolume", "musicVolume", "reactorVolume", "sfxVolume", "starDensity", "renderScale"]) this.refreshValue(key);
  }
  save() {
    localStorage.setItem("spacefrontier.options", JSON.stringify(this.settings));
    this.onChange?.(this.settings);
  }
  getSettings() {
    return { ...this.settings };
  }
};

// client/src/ui/options/OptionsIconSvg.js
function getOptionsIconSvg() {
  return `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="optGear" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#e7f3ff"/>
          <stop offset="1" stop-color="#7fdcff"/>
        </linearGradient>
      </defs>
      <path fill="none" stroke="url(#optGear)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M32 10l4 7 8-1 4 7-5 6 5 6-4 7-8-1-4 7-8-7-8 1-4-7 5-6-5-6 4-7 8 1z" opacity=".92"/>
      <circle cx="32" cy="32" r="8" fill="rgba(125,233,255,.18)" stroke="#dff7ff" stroke-width="4"/>
    </svg>
  `;
}

// client/src/ui/base/BasePanelView.js
var BASE_TILE = 64;
var SECTOR_HALF = 2e3;
var BUILD_RANGE = 1200;
var EDGE_RESERVE_TILES = 1;
var EDGE_RESERVE = BASE_TILE * EDGE_RESERVE_TILES;
var RESOURCE_LABELS = {
  ironOre: "Minerai de fer",
  copper: "Cuivre",
  aluminiumOre: "Minerai d\u2019aluminium",
  titaniumOre: "Minerai de titane",
  steelPlate: "Acier",
  copperWire: "Fil de cuivre"
};
function iconSvg(kind) {
  if (kind === "core") return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 7l21 12v26L32 57 11 45V19L32 7z" fill="rgba(101,215,255,.12)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="32" r="12" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="32" cy="32" r="4" fill="currentColor" opacity=".85"/><path d="M32 12v8M32 44v8M14 22l7 4M43 38l7 4M14 42l7-4M43 26l7-4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".75"/></svg>`;
  if (kind === "wall") return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="22" width="52" height="20" rx="3" fill="rgba(120,190,255,.12)" stroke="currentColor" stroke-width="3"/><path d="M14 22v20M24 22v20M34 22v20M44 22v20M54 22v20" stroke="currentColor" stroke-width="2" opacity=".72"/><path d="M10 32h44" stroke="currentColor" stroke-width="2" opacity=".45"/></svg>`;
  if (kind === "storage") return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M13 21l19-10 19 10v22L32 53 13 43V21z" fill="rgba(111,240,197,.12)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M13 21l19 11 19-11M32 32v21" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".82"/><path d="M22 26l19-10M22 39l20-11" stroke="currentColor" stroke-width="2" opacity=".28"/></svg>`;
  if (kind === "repair") return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M39 12l13 13-7 7-5-5-18 18-10 3 3-10 18-18-5-5 11-3z" fill="rgba(112,240,197,.12)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M18 49h30" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".75"/></svg>`;
  if (kind === "demolish") return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 16h24l-2 34H22L20 16z" fill="rgba(255,120,120,.10)" stroke="currentColor" stroke-width="3"/><path d="M17 16h30M26 16l2-5h8l2 5M27 25v17M37 25v17" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;
  if (kind === "power") return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M35 6L16 36h14l-3 22 21-34H34l1-18z" fill="rgba(255,213,95,.13)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`;
  return "";
}
var BUILD_STRUCTURES = [
  {
    type: "base_core",
    category: "construction",
    title: "Noyau de base",
    subtitle: "2 \xD7 2 tiles",
    icon: "core",
    orientation: "h",
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    claimRadius: BASE_TILE * 8,
    hp: 1200,
    role: "D\xE9finit une zone carr\xE9e de construction. Tier 1 compact, am\xE9liorable plus tard.",
    stats: ["Zone : 16 \xD7 16 tiles", "Structure non bloquante", "1 noyau actif par joueur"],
    cost: { ironOre: 35, copper: 12, aluminiumOre: 8 }
  },
  {
    type: "wall",
    category: "construction",
    title: "Mur m\xE9tallique",
    subtitle: "3 \xD7 1 tiles",
    icon: "wall",
    orientation: "h",
    rotatable: true,
    tilesX: 3,
    tilesY: 1,
    w: 192,
    h: 64,
    hp: 760,
    role: "Bloque les d\xE9placements et prot\xE8ge l\u2019int\xE9rieur de la base.",
    stats: ["Solide", "Orientable avec O", "Peut \xEAtre coll\xE9 aux autres murs"],
    cost: { ironOre: 12, copper: 2 }
  },
  {
    type: "storage",
    category: "storage",
    title: "Coffre spatial",
    subtitle: "2 \xD7 2 tiles",
    icon: "storage",
    orientation: "h",
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    role: "Stockage local de ressources. Non bloquant et non destructible directement.",
    stats: ["Interaction avec D", "Accessible au propri\xE9taire", "Pillable si le noyau est d\xE9truit"],
    cost: { ironOre: 14, copper: 8, aluminiumOre: 4 }
  }
];
var BUILD_CATEGORIES = [
  { id: "construction", label: "Construction", icon: "core" },
  { id: "storage", label: "Stockage", icon: "storage" },
  { id: "power", label: "\xC9nergie", icon: "power", disabled: true },
  { id: "repair", label: "R\xE9parer", icon: "repair" },
  { id: "demolish", label: "D\xE9molition", icon: "demolish" }
];
function escapeHtml3(txt) {
  return String(txt || "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
}
function structureDef(type) {
  return BUILD_STRUCTURES.find((s) => s.type === type) || null;
}
function formatCost(cost = {}) {
  const entries = Object.entries(cost || {}).filter(([, v]) => Number(v) > 0);
  if (!entries.length) return "Aucun co\xFBt";
  return entries.map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key] || key}`).join(" \xB7 ");
}
function orientedSize(def, orientation = "h") {
  const vertical = def.type === "wall" && orientation === "v";
  return {
    w: vertical ? def.h : def.w,
    h: vertical ? def.w : def.h,
    tilesX: vertical ? def.tilesY : def.tilesX,
    tilesY: vertical ? def.tilesX : def.tilesY
  };
}
function snapFootprint(rawX, rawY, size, grid = BASE_TILE) {
  const left = Math.round(((Number(rawX) || 0) - size.w * 0.5) / grid) * grid;
  const top = Math.round(((Number(rawY) || 0) - size.h * 0.5) / grid) * grid;
  return { x: left + size.w * 0.5, y: top + size.h * 0.5 };
}
function rectFor(def, x, y, orientation = "h") {
  const size = orientedSize(def, orientation);
  return { left: x - size.w * 0.5, right: x + size.w * 0.5, top: y - size.h * 0.5, bottom: y + size.h * 0.5, ...size };
}
function rectsOverlap(a, b, pad = 0) {
  const eps = 1e-3;
  return a.left + pad < b.right - eps && a.right - pad > b.left + eps && a.top + pad < b.bottom - eps && a.bottom - pad > b.top + eps;
}
function entityRect(e) {
  const w = Number(e?.w) || (Number(e?.radius) || 0) * 2;
  const h = Number(e?.h) || (Number(e?.radius) || 0) * 2;
  return { left: (e?.x || 0) - w * 0.5, right: (e?.x || 0) + w * 0.5, top: (e?.y || 0) - h * 0.5, bottom: (e?.y || 0) + h * 0.5, w, h };
}
function sameSector(a, b) {
  return (a?.sx | 0) === (b?.sx | 0) && (a?.sy | 0) === (b?.sy | 0);
}
function claimRect(core) {
  const half = Math.max(1, Number(core?.claimRadius) || BASE_TILE * 8);
  return { left: (core?.x || 0) - half, right: (core?.x || 0) + half, top: (core?.y || 0) - half, bottom: (core?.y || 0) + half, w: half * 2, h: half * 2 };
}
function isRectInside(a, b) {
  const eps = 1e-3;
  return a.left >= b.left - eps && a.right <= b.right + eps && a.top >= b.top - eps && a.bottom <= b.bottom + eps;
}
function sectorBuildRect() {
  return { left: -SECTOR_HALF + EDGE_RESERVE, right: SECTOR_HALF - EDGE_RESERVE, top: -SECTOR_HALF + EDGE_RESERVE, bottom: SECTOR_HALF - EDGE_RESERVE };
}
function findOwnCore(store, me, rect) {
  let best = null;
  let bestD2 = Infinity;
  for (const st of store?.structures?.values?.() || []) {
    if (st?.type !== "base_core" || !st.owned || !sameSector(st, me)) continue;
    if (!isRectInside(rect, claimRect(st))) continue;
    const dx = (st.x || 0) - (rect.left + rect.right) * 0.5;
    const dy = (st.y || 0) - (rect.top + rect.bottom) * 0.5;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      best = st;
      bestD2 = d2;
    }
  }
  return best;
}
function hasOwnCore(store) {
  for (const st of store?.structures?.values?.() || []) {
    if (st?.type === "base_core" && st.owned) return true;
  }
  return false;
}
function validatePreview(store, me, def, x, y, orientation) {
  if (!me) return { ok: false, reason: "Aucun vaisseau actif" };
  const r = rectFor(def, x, y, orientation);
  const dist = Math.hypot(x - (me.x || 0), y - (me.y || 0));
  if (dist > BUILD_RANGE) return { ok: false, reason: "Trop loin" };
  if (!isRectInside(r, sectorBuildRect())) return { ok: false, reason: "Bord du secteur" };
  const ownCore = def.type === "base_core" ? null : findOwnCore(store, me, r);
  if (def.type === "base_core") {
    if (hasOwnCore(store)) return { ok: false, reason: "Noyau d\xE9j\xE0 pos\xE9" };
    const claim = { left: x - (def.claimRadius || 0), right: x + (def.claimRadius || 0), top: y - (def.claimRadius || 0), bottom: y + (def.claimRadius || 0) };
    if (!isRectInside(claim, sectorBuildRect())) return { ok: false, reason: "Zone trop proche du bord" };
  } else if (!ownCore) {
    return { ok: false, reason: "Hors base" };
  }
  for (const st of store?.structures?.values?.() || []) {
    if (!sameSector(st, me)) continue;
    if (rectsOverlap(r, entityRect(st), 0)) return { ok: false, reason: "Occup\xE9" };
  }
  for (const a of store?.asteroids?.values?.() || []) {
    if (!sameSector(a, me)) continue;
    if (!a.solid && !a.bastionWall) continue;
    if (rectsOverlap(r, entityRect(a), 0)) return { ok: false, reason: "Obstacle" };
  }
  for (const station of store?.stations?.values?.() || []) {
    if (!sameSector(station, me)) continue;
    const d = Math.hypot((station.x || 0) - x, (station.y || 0) - y);
    if (d < (station.radius || 80) + Math.max(r.w, r.h) * 0.5 + 80) return { ok: false, reason: "Station proche" };
  }
  return { ok: true, reason: "OK", ownCore };
}
function structureHealthRatio(st) {
  const hp = Number(st?.vitals?.hp ?? st?.stats?.hp ?? 0);
  const maxHp = Number(st?.vitals?.maxHp ?? st?.stats?.maxHp ?? 0);
  return { hp, maxHp, damaged: maxHp > 0 && hp > 0 && hp < maxHp };
}
function findRepairableStructureAt(store, me, x, y) {
  let best = null;
  let bestArea = Infinity;
  for (const st of store?.structures?.values?.() || []) {
    if (!st?.owned || !sameSector(st, me)) continue;
    if (st.type === "base_core") continue;
    const hp = structureHealthRatio(st);
    if (!hp.damaged) continue;
    const r = entityRect(st);
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    const area2 = Math.max(1, r.w * r.h);
    if (area2 < bestArea) {
      best = st;
      bestArea = area2;
    }
  }
  return best;
}
function findOwnedStructureAt(store, me, x, y) {
  let best = null;
  let bestArea = Infinity;
  for (const st of store?.structures?.values?.() || []) {
    if (!st?.owned || !sameSector(st, me)) continue;
    const r = entityRect(st);
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    const area2 = Math.max(1, r.w * r.h);
    if (area2 < bestArea) {
      best = st;
      bestArea = area2;
    }
  }
  return best;
}
var BasePanelView = class {
  constructor(sendCmd, onPick = null) {
    this.sendCmd = sendCmd;
    this.onPick = typeof onPick === "function" ? onPick : null;
    this.store = null;
    this.activeBuild = null;
    this.lastPreview = null;
    this.category = "construction";
    this.hoveredType = null;
    this.el = document.createElement("div");
    this.el.className = "base-panel";
    this.el.innerHTML = `
      <div class="base-panel__head">
        <div>
          <div class="base-panel__eyebrow">Construction</div>
          <div class="base-panel__title">Build</div>
        </div>
        <button class="base-panel__cancel" type="button" title="Annuler">\xD7</button>
      </div>
      <div class="base-panel__body">
        <div class="base-panel__cats"></div>
        <div class="base-panel__content">
          <div class="base-panel__grid"></div>
          <div class="base-panel__status"></div>
        </div>
        <aside class="base-panel__details"></aside>
      </div>
    `;
    this.cats = this.el.querySelector(".base-panel__cats");
    this.grid = this.el.querySelector(".base-panel__grid");
    this.status = this.el.querySelector(".base-panel__status");
    this.details = this.el.querySelector(".base-panel__details");
    this.cancelBtn = this.el.querySelector(".base-panel__cancel");
    this.cats.innerHTML = BUILD_CATEGORIES.map((c) => `
      <button class="base-panel__cat ${c.disabled ? "is-disabled" : ""}" data-category="${c.id}" title="${escapeHtml3(c.disabled ? "\xC0 venir" : c.label)}" ${c.disabled ? "disabled" : ""}>
        ${iconSvg(c.icon)}<span>${escapeHtml3(c.label)}</span>
      </button>
    `).join("");
    this.cats.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-category]");
      if (!btn || btn.disabled) return;
      this.category = btn.dataset.category;
      if (this.category === "demolish") this.selectDemolish();
      else if (this.category === "repair") this.selectRepair();
      else {
        this.hoveredType = null;
        this.refresh();
      }
    });
    this.grid.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-type]");
      if (!btn) return;
      this.select(btn.dataset.type);
    });
    this.grid.addEventListener("mouseover", (ev) => {
      const btn = ev.target.closest("button[data-type]");
      if (!btn) return;
      this.hoveredType = btn.dataset.type;
      this.renderDetails();
    });
    this.cancelBtn.addEventListener("click", () => this.cancel());
    this.refresh();
  }
  select(type) {
    const def = structureDef(type);
    if (!def) return;
    const prev = this.activeBuild;
    const orientation = prev?.type === type ? prev.orientation : def.orientation;
    this.activeBuild = { mode: "build", type, orientation };
    this.hoveredType = type;
    this.refresh();
    this.status.textContent = `${def.title} pr\xEAt`;
    this.onPick?.();
  }
  selectDemolish() {
    this.activeBuild = { mode: "demolish" };
    this.refresh();
    this.status.textContent = "D\xE9molition active";
    this.onPick?.();
  }
  selectRepair() {
    this.activeBuild = { mode: "repair" };
    this.refresh();
    this.status.textContent = "R\xE9paration active";
    this.onPick?.();
  }
  cancel() {
    this.activeBuild = null;
    this.lastPreview = null;
    this.refresh();
    this.status.textContent = "";
  }
  rotate() {
    if (!this.activeBuild || this.activeBuild.mode !== "build") return false;
    const def = structureDef(this.activeBuild.type);
    if (!def?.rotatable) return false;
    this.activeBuild.orientation = this.activeBuild.orientation === "v" ? "h" : "v";
    this.status.textContent = this.activeBuild.orientation === "v" ? "Vertical" : "Horizontal";
    return true;
  }
  hasActivePlacement() {
    return !!this.activeBuild;
  }
  getDetailDef() {
    if (this.category === "demolish" || this.category === "repair") return null;
    return structureDef(this.hoveredType || this.activeBuild?.type) || BUILD_STRUCTURES.find((s) => s.category === this.category) || null;
  }
  renderDetails() {
    if (this.category === "repair") {
      this.details.innerHTML = `
        <div class="base-panel__details-icon base-panel__details-icon--repair">${iconSvg("repair")}</div>
        <h3>R\xE9parer</h3>
        <p>R\xE9pare une structure endommag\xE9e qui t\u2019appartient. Le co\xFBt d\xE9pend du pourcentage de PV manquants.</p>
        <div class="base-panel__details-section"><strong>Noyau</strong><span>Non r\xE9parable : il se r\xE9g\xE9n\xE8re seul.</span></div>`;
      return;
    }
    if (this.category === "demolish") {
      this.details.innerHTML = `
        <div class="base-panel__details-icon base-panel__details-icon--danger">${iconSvg("demolish")}</div>
        <h3>D\xE9molition</h3>
        <p>Retire une structure qui t\u2019appartient. Les retours de mat\xE9riaux seront ajout\xE9s plus tard.</p>
        <div class="base-panel__details-section"><strong>Utilisation</strong><span>Clique une structure dans le monde.</span></div>`;
      return;
    }
    const def = this.getDetailDef();
    if (!def) {
      this.details.innerHTML = `<h3>\xC0 venir</h3><p>Cette cat\xE9gorie sera remplie dans une prochaine update.</p>`;
      return;
    }
    this.details.innerHTML = `
      <div class="base-panel__details-icon base-panel__details-icon--${escapeHtml3(def.icon)}">${iconSvg(def.icon)}</div>
      <h3>${escapeHtml3(def.title)}</h3>
      <p>${escapeHtml3(def.role || def.subtitle || "")}</p>
      <div class="base-panel__details-section"><strong>Taille</strong><span>${def.tilesX} \xD7 ${def.tilesY} tiles</span></div>
      <div class="base-panel__details-section"><strong>PV</strong><span>${def.hp ? def.hp : "aucun \u2014 non ciblable"}</span></div>
      <div class="base-panel__details-section"><strong>Co\xFBt</strong><span>${escapeHtml3(formatCost(def.cost))}</span></div>
      ${(def.stats || []).map((s) => `<div class="base-panel__details-line">${escapeHtml3(s)}</div>`).join("")}`;
  }
  refresh() {
    const activeType = this.activeBuild?.type || "";
    const activeMode = this.activeBuild?.mode || "";
    for (const btn of this.cats.querySelectorAll("button[data-category]")) {
      btn.classList.toggle("is-active", btn.dataset.category === this.category || activeMode === "demolish" && btn.dataset.category === "demolish" || activeMode === "repair" && btn.dataset.category === "repair");
    }
    if (this.category === "repair") {
      this.grid.innerHTML = `
        <button class="base-panel__btn base-panel__btn--wide ${activeMode === "repair" ? "is-active" : ""}" data-repair="1" type="button">
          <span class="base-panel__icon">${iconSvg("repair")}</span>
          <span class="base-panel__meta"><strong>R\xE9parer</strong><small>Structure endommag\xE9e</small></span>
        </button>`;
      this.grid.querySelector("[data-repair]")?.addEventListener("click", () => this.selectRepair());
    } else if (this.category === "demolish") {
      this.grid.innerHTML = `
        <button class="base-panel__btn base-panel__btn--wide ${activeMode === "demolish" ? "is-active" : ""}" data-demolish="1" type="button">
          <span class="base-panel__icon">${iconSvg("demolish")}</span>
          <span class="base-panel__meta"><strong>D\xE9molir</strong><small>Retirer une structure</small></span>
        </button>`;
      this.grid.querySelector("[data-demolish]")?.addEventListener("click", () => this.selectDemolish());
    } else {
      this.grid.innerHTML = BUILD_STRUCTURES.filter((s) => s.category === this.category).map((s) => `
          <button class="base-panel__btn ${s.type === activeType ? "is-active" : ""}" data-type="${s.type}" type="button">
            <span class="base-panel__icon base-panel__icon--${escapeHtml3(s.icon)}">${iconSvg(s.icon)}</span>
            <span class="base-panel__meta">
              <strong>${escapeHtml3(s.title)}</strong>
              <small>${escapeHtml3(s.subtitle)}</small>
            </span>
          </button>
        `).join("");
    }
    this.cancelBtn.classList.toggle("is-visible", !!this.activeBuild);
    this.renderDetails();
  }
  getPreview(store, mouseWorld) {
    this.store = store || this.store;
    if (!this.activeBuild || !mouseWorld) return null;
    const me = this.store?.getMe?.();
    if (this.activeBuild.mode === "repair") {
      const target = findRepairableStructureAt(this.store, me, mouseWorld.x, mouseWorld.y);
      const hp = structureHealthRatio(target);
      this.lastPreview = {
        mode: "repair",
        targetId: target?.id || 0,
        type: target?.type || "repair",
        title: target ? `R\xE9parer ${target.name || "structure"}` : "R\xE9paration",
        reason: target ? `${Math.ceil(hp.maxHp - hp.hp)} PV manquants` : "Aucune structure endommag\xE9e",
        ok: !!target,
        x: target?.x ?? mouseWorld.x,
        y: target?.y ?? mouseWorld.y,
        sx: me?.sx | 0,
        sy: me?.sy | 0,
        w: target?.w || BASE_TILE,
        h: target?.h || BASE_TILE,
        tilesX: Math.max(1, Math.round((target?.w || BASE_TILE) / BASE_TILE)),
        tilesY: Math.max(1, Math.round((target?.h || BASE_TILE) / BASE_TILE)),
        gridSize: BASE_TILE
      };
      return this.lastPreview;
    }
    if (this.activeBuild.mode === "demolish") {
      const target = findOwnedStructureAt(this.store, me, mouseWorld.x, mouseWorld.y);
      this.lastPreview = {
        mode: "demolish",
        targetId: target?.id || 0,
        type: target?.type || "demolish",
        title: target ? `D\xE9molir ${target.name || "structure"}` : "D\xE9molition",
        reason: target ? "OK" : "Aucune structure",
        ok: !!target,
        x: target?.x ?? mouseWorld.x,
        y: target?.y ?? mouseWorld.y,
        sx: me?.sx | 0,
        sy: me?.sy | 0,
        w: target?.w || BASE_TILE,
        h: target?.h || BASE_TILE,
        tilesX: Math.max(1, Math.round((target?.w || BASE_TILE) / BASE_TILE)),
        tilesY: Math.max(1, Math.round((target?.h || BASE_TILE) / BASE_TILE)),
        gridSize: BASE_TILE
      };
      return this.lastPreview;
    }
    const def = structureDef(this.activeBuild.type);
    if (!def) return null;
    const orientation = this.activeBuild.orientation || "h";
    const size = orientedSize(def, orientation);
    const snapped = snapFootprint(mouseWorld.x, mouseWorld.y, size, BASE_TILE);
    const rect = rectFor(def, snapped.x, snapped.y, orientation);
    const validation = validatePreview(this.store, me, def, snapped.x, snapped.y, orientation);
    this.lastPreview = {
      mode: "build",
      type: def.type,
      title: def.title,
      x: snapped.x,
      y: snapped.y,
      sx: me?.sx | 0,
      sy: me?.sy | 0,
      w: rect.w,
      h: rect.h,
      tilesX: rect.tilesX,
      tilesY: rect.tilesY,
      gridSize: BASE_TILE,
      buildRange: BUILD_RANGE,
      radius: Math.max(rect.w, rect.h) * 0.5,
      orientation,
      claimRadius: def.claimRadius || 0,
      ok: validation.ok,
      reason: validation.reason,
      ownCore: validation.ownCore ? { x: validation.ownCore.x, y: validation.ownCore.y, claimRadius: validation.ownCore.claimRadius || BASE_TILE * 8 } : null
    };
    return this.lastPreview;
  }
  placeCurrent(store, mouseWorld) {
    const preview = this.getPreview(store, mouseWorld);
    if (!preview) return false;
    if (!preview.ok) {
      this.status.textContent = preview.reason || "Impossible";
      return false;
    }
    if (preview.mode === "repair") {
      this.sendCmd("repair_structure", { structureId: preview.targetId });
      this.status.textContent = "R\xE9paration envoy\xE9e";
      return true;
    }
    if (preview.mode === "demolish") {
      this.sendCmd("remove_structure", { structureId: preview.targetId });
      this.status.textContent = "D\xE9molition envoy\xE9e";
      return true;
    }
    this.sendCmd("build_structure", { structureType: preview.type, orientation: preview.orientation, x: preview.x, y: preview.y });
    this.status.textContent = "Placement envoy\xE9";
    return true;
  }
  update(store) {
    this.store = store;
    if (this.activeBuild && this.lastPreview) {
      this.status.textContent = this.lastPreview.ok ? this.lastPreview.title : this.lastPreview.reason;
      return;
    }
    this.status.textContent = "";
  }
};

// client/src/ui/storage/StoragePanelView.js
function esc(txt) {
  return String(txt || "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
}
function resourceRows(resources = [], actionLabel, action, structureId) {
  if (!resources.length) return `<div class="storage-panel__empty">Vide.</div>`;
  return resources.map((r) => `
    <div class="storage-panel__row" data-resource="${esc(r.key)}" data-amount="${r.amount | 0}" data-structure="${structureId | 0}">
      <span class="storage-panel__swatch" style="background:${esc(r.colorHex || "#d0d7e4")}"></span>
      <span class="storage-panel__name">${esc(r.name || r.key)}</span>
      <span class="storage-panel__qty">${r.amount | 0}</span>
      <button class="ui-btn ui-btn--ghost" data-act="${action}" data-amount="1">1</button>
      <button class="ui-btn" data-act="${action}" data-amount="all">${actionLabel}</button>
    </div>
  `).join("");
}
var StoragePanelView = class {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === "function" ? sendCmd : null;
    this.lastKey = "";
    this.el = document.createElement("section");
    this.el.className = "storage-panel";
    this.el.innerHTML = "";
    this.el.addEventListener("click", (ev) => {
      const close = ev.target.closest("[data-close-storage]");
      if (close) {
        this.sendCmd?.("storage_close", {});
        return;
      }
      const btn = ev.target.closest("button[data-act]");
      if (!btn) return;
      const row = btn.closest("[data-resource]");
      const key = row?.dataset?.resource || "";
      const structureId = row?.dataset?.structure | 0;
      const rowAmount = Math.max(0, row?.dataset?.amount | 0);
      const amount = btn.dataset.amount === "all" ? rowAmount : 1;
      const act = btn.dataset.act;
      if (!key || !structureId || amount <= 0) return;
      this.sendCmd?.("storage_transfer", {
        structureId,
        resourceKey: key,
        amount,
        direction: act === "withdraw" ? "withdraw" : "deposit"
      });
    });
  }
  update(store) {
    const storage = store?.myState?.storage || null;
    this.el.classList.toggle("is-open", !!storage);
    if (!storage) {
      this.lastKey = "";
      this.el.innerHTML = "";
      return;
    }
    const cargo = store?.myState?.inv?.resources || [];
    const cargoRows = cargo.filter((r) => (r?.amount || 0) > 0);
    const key = JSON.stringify({ s: storage, c: cargoRows.map((r) => [r.key, r.amount]) });
    if (key === this.lastKey) return;
    this.lastKey = key;
    const title = storage.owned ? "Coffre" : "Coffre non claim";
    this.el.innerHTML = `
      <div class="storage-panel__head">
        <div>
          <div class="storage-panel__eyebrow">Stockage</div>
          <h2>${esc(title)}</h2>
        </div>
        <button class="storage-panel__close" data-close-storage="1" type="button">\xD7</button>
      </div>
      <div class="storage-panel__cols">
        <div class="storage-panel__col">
          <h3>Cargo</h3>
          ${resourceRows(cargoRows, "D\xE9poser", "deposit", storage.id)}
        </div>
        <div class="storage-panel__col">
          <h3>Coffre</h3>
          ${resourceRows(storage.resources || [], "Retirer", "withdraw", storage.id)}
        </div>
      </div>
    `;
  }
};

// client/src/ui/base/BaseIconSvg.js
function getBaseIconSvg() {
  return `<svg class="ui-icon-svg" viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="baseG" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#8ee8ff"/><stop offset="1" stop-color="#67f0c7"/></linearGradient></defs>
    <path d="M12 48h40V24L32 12 12 24v24z" fill="rgba(12,26,38,.68)" stroke="url(#baseG)" stroke-width="3" stroke-linejoin="round"/>
    <path d="M22 48V31h20v17" fill="none" stroke="rgba(220,250,255,.75)" stroke-width="2.5"/>
    <path d="M18 24h28M26 38h12" stroke="rgba(126,232,255,.85)" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

// shared/world/SectorDefs.js
var SECTOR = {
  size: 4e3,
  half: 2e3,
  spawnMargin: 150,
  innerMargin: 300,
  unloadAfterMs: 3e4,
  sessionActiveRadius: 50
};

// client/src/prediction/ClientPrediction.js
function finite(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}
function norm(x, y) {
  const d = Math.hypot(x, y);
  if (d <= 1e-4) return { x: 0, y: 0 };
  return { x: x / d, y: y / d };
}
function angleLerp(a, b, t) {
  if (!Number.isFinite(a)) return b;
  let d = (b - a + Math.PI) % (Math.PI * 2) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.max(0, Math.min(1, t));
}
function solidWallBounds(wall) {
  const w = finite(wall?.w, 0) || finite(wall?.radius, 0) * 2;
  const h = finite(wall?.h, 0) || finite(wall?.radius, 0) * 2;
  return {
    left: finite(wall?.x, 0) - w * 0.5,
    right: finite(wall?.x, 0) + w * 0.5,
    top: finite(wall?.y, 0) - h * 0.5,
    bottom: finite(wall?.y, 0) + h * 0.5
  };
}
function pointInsideExpandedRect(x, y, wall, pad) {
  const b = solidWallBounds(wall);
  return x >= b.left - pad && x <= b.right + pad && y >= b.top - pad && y <= b.bottom + pad;
}
function segmentHitsExpandedRect(x1, y1, x2, y2, wall, pad) {
  if (pointInsideExpandedRect(x1, y1, wall, pad) || pointInsideExpandedRect(x2, y2, wall, pad)) return true;
  const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / Math.max(8, pad * 0.45)));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (pointInsideExpandedRect(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, wall, pad)) return true;
  }
  return false;
}
function pushEntityOutOfWall(entity, wall, pad) {
  const b = solidWallBounds(wall);
  const cx = Math.max(b.left, Math.min(entity.x, b.right));
  const cy = Math.max(b.top, Math.min(entity.y, b.bottom));
  let dx = entity.x - cx;
  let dy = entity.y - cy;
  const d = Math.hypot(dx, dy);
  if (d > 1e-4 && d < pad) {
    const push = pad - d + 0.8;
    entity.x += dx / d * push;
    entity.y += dy / d * push;
    if (Math.abs(dx) > Math.abs(dy)) entity.vx = 0;
    else entity.vy = 0;
    return true;
  }
  if (entity.x > b.left - pad && entity.x < b.right + pad && entity.y > b.top - pad && entity.y < b.bottom + pad) {
    const pushLeft = Math.abs(entity.x - (b.left - pad));
    const pushRight = Math.abs(b.right + pad - entity.x);
    const pushTop = Math.abs(entity.y - (b.top - pad));
    const pushBottom = Math.abs(b.bottom + pad - entity.y);
    const minPush = Math.min(pushLeft, pushRight, pushTop, pushBottom);
    if (minPush === pushLeft) entity.x = b.left - pad - 0.8;
    else if (minPush === pushRight) entity.x = b.right + pad + 0.8;
    else if (minPush === pushTop) entity.y = b.top - pad - 0.8;
    else entity.y = b.bottom + pad + 0.8;
    entity.vx = 0;
    entity.vy = 0;
    return true;
  }
  return false;
}
function resolveLocalSolidWalls(store, me, oldX, oldY) {
  const pad = Math.max(12, finite(me?.radius, 22) + 1.5);
  const blockers = [
    ...store?.asteroids?.values?.() || [],
    ...store?.structures?.values?.() || []
  ];
  for (const wall of blockers) {
    if (wall?.kind === "structure" && wall?.type !== "wall") continue;
    if (!wall?.solid && !wall?.bastionWall) continue;
    if ((wall.sx | 0) !== (me.sx | 0) || (wall.sy | 0) !== (me.sy | 0)) continue;
    if (Number.isFinite(oldX) && Number.isFinite(oldY) && segmentHitsExpandedRect(oldX, oldY, me.x, me.y, wall, pad)) {
      me.x = oldX;
      me.y = oldY;
      me.vx = 0;
      me.vy = 0;
      if (store.localPrediction) store.localPrediction.hasMoveTarget = false;
      return true;
    }
    if (pushEntityOutOfWall(me, wall, pad)) {
      if (store.localPrediction) store.localPrediction.hasMoveTarget = false;
      return true;
    }
  }
  return false;
}
function hasBlockingStatus(me) {
  const ids = new Set((me?.statuses ?? []).map((s) => String(s.id || s.effectId || "").toLowerCase()));
  return ids.has("root") || ids.has("stun") || ids.has("suppress") || ids.has("fear") || ids.has("sleep");
}
function getTarget(store, kind, id) {
  if (!kind || !id) return null;
  if (kind === "player") return store.players.get(id) || null;
  if (kind === "mob") return store.mobs.get(id) || null;
  if (kind === "asteroid") return store.asteroids.get(id) || null;
  if (kind === "station") return store.stations.get(id) || null;
  return null;
}
function getSelectedTarget(store) {
  const kind = store.localPrediction?.selectedKind || store.myState?.selectedKind || "";
  const id = store.localPrediction?.selectedId || store.myState?.selectedId || 0;
  return { kind, id, entity: getTarget(store, kind, id) };
}
function getAttackTarget(store) {
  const now = performance.now();
  const local = store.localPrediction || {};
  const kind = now < (local.attackUntil || 0) ? local.attackKind || "" : "";
  const id = now < (local.attackUntil || 0) ? local.attackId || 0 : 0;
  return { kind, id, entity: getTarget(store, kind, id) };
}
function getCooldownMax(myState, slot) {
  const hud = myState?.abilityHud?.[slot];
  return Math.max(0.15, finite(hud?.cooldownMax, finite(hud?.tuning?.baseCooldown, 0.6)));
}
function canSpendEnergy(me, myState, slot) {
  const cost = myState?.abilityHud?.[slot]?.energyCost;
  if (!Number.isFinite(cost)) return true;
  return finite(me?.vitals?.energy, finite(me?.stats?.energy, 9999)) >= cost;
}
function spendEnergyLocal(me, myState, slot) {
  const cost = myState?.abilityHud?.[slot]?.energyCost;
  if (!Number.isFinite(cost) || !me?.vitals) return;
  me.vitals.energy = Math.max(0, finite(me.vitals.energy, 0) - cost);
  const now = performance.now();
  me._localVitalsUntil = Math.max(me._localVitalsUntil || 0, now + 1500);
}
function getLocalAbilityReadyAt(store, slot) {
  const ready = store?.localPrediction?.localAbilityReadyAt?.[slot];
  return Number.isFinite(ready) ? ready : 0;
}
function setLocalAbilityReadyAt(store, slot, readyAt) {
  if (!store?.localPrediction) return;
  if (!store.localPrediction.localAbilityReadyAt) store.localPrediction.localAbilityReadyAt = {};
  if (!store.localPrediction.localAbilityLastCastAt) store.localPrediction.localAbilityLastCastAt = {};
  store.localPrediction.localAbilityReadyAt[slot] = readyAt;
  store.localPrediction.localAbilityLastCastAt[slot] = performance.now();
}
function canCastAbilityLocalFirst(store, me, myState, slot) {
  const now = performance.now();
  const lastLocalCastAt = store?.localPrediction?.localAbilityLastCastAt?.[slot] || 0;
  const localReadyAt = getLocalAbilityReadyAt(store, slot);
  if (lastLocalCastAt > 0) return now + 15 >= localReadyAt;
  const hud = myState?.abilityHud?.[slot];
  const serverCd = finite(myState?.cooldowns?.[slot], finite(hud?.cooldownLeft, 0));
  return serverCd <= 0.03;
}
function getLocalDashDistance(myState, slot) {
  const hud = myState?.abilityHud?.[slot];
  const tuning2 = hud?.tuning || hud || {};
  const frameId = String(myState?.frameId || "").toLowerCase();
  if (Number.isFinite(tuning2.dashDistance) && tuning2.dashDistance > 0) return tuning2.dashDistance;
  if (Number.isFinite(tuning2.eDashDistance) && tuning2.eDashDistance > 0) return tuning2.eDashDistance;
  if (frameId === "vanguard" && slot === "Z") return 190;
  if (frameId === "sigil" && slot === "E") return 175;
  return 0;
}
function getLocalMoveBoost(myState, slot) {
  const hud = myState?.abilityHud?.[slot];
  const tuning2 = hud?.tuning || hud || {};
  const frameId = String(myState?.frameId || "").toLowerCase();
  if (frameId === "vanguard" && slot === "Z") {
    return {
      pct: Number.isFinite(tuning2.moveBoostPct) ? tuning2.moveBoostPct : 0.22,
      duration: Number.isFinite(tuning2.moveBoostDuration) ? tuning2.moveBoostDuration : 2
    };
  }
  return { pct: 0, duration: 0 };
}
function getAbilityLocalAuthorityMs(myState, slot) {
  const frameId = String(myState?.frameId || "").toLowerCase();
  if (frameId === "vanguard" && slot === "Z") return 2400;
  if (frameId === "sigil" && slot === "E") return 2200;
  return 1500;
}
function applyLocalFrameAbilityState(store, me, slot, worldMouse, now) {
  const myState = store.myState;
  if (!myState) return;
  const frameId = String(myState.frameId || "").toLowerCase();
  myState.frameState = { ...myState.frameState || {} };
  if (frameId === "vanguard" && slot === "Z") {
    const boost = getLocalMoveBoost(myState, slot);
    if (boost.duration > 0) {
      myState.frameState.moveBoostLeft = Math.max(Number(myState.frameState.moveBoostLeft) || 0, boost.duration);
      myState.frameState.comboWindowLeft = Math.max(Number(myState.frameState.comboWindowLeft) || 0, 1.15);
      myState.frameState.trailLeft = Math.max(Number(myState.frameState.trailLeft) || 0, 0.32);
      myState.frameState.trailStartX = Number.isFinite(me?._localDashFromX) ? me._localDashFromX : me?.x;
      myState.frameState.trailStartY = Number.isFinite(me?._localDashFromY) ? me._localDashFromY : me?.y;
      myState.frameState.trailEndX = me?.x;
      myState.frameState.trailEndY = me?.y;
    }
  }
  if (frameId === "vanguard" && slot === "E") {
    myState.frameState.phaseLeft = Math.max(Number(myState.frameState.phaseLeft) || 0, 1.1);
  }
  if (frameId === "vanguard" && slot === "R") {
    myState.frameState.ultLeft = Math.max(Number(myState.frameState.ultLeft) || 0, 4);
  }
  if (frameId === "sigil" && slot === "E") {
    myState.frameState.dashGhostLeft = Math.max(Number(myState.frameState.dashGhostLeft) || 0, 0.35);
  }
  store.localPrediction.localAbilityAuthorityUntil = Math.max(store.localPrediction.localAbilityAuthorityUntil || 0, now + getAbilityLocalAuthorityMs(myState, slot));
  store.localPrediction.localFrameState = { ...myState.frameState || {} };
  store.localPrediction.localDerived = { ...myState.derived || {} };
}
function pinLocalEntityTarget(entity) {
  if (!entity) return;
  entity._tx = entity.x;
  entity._ty = entity.y;
}
var ClientPrediction = class {
  constructor(store) {
    this.store = store;
    this.lastKeys = { A: false, Z: false, E: false, R: false, F: false, D: false };
    this.lastAttackFxAt = 0;
    this.localId = -1;
    this.localAutoCooldown = 0;
    this.lastLocalAutoTarget = null;
    this.lastSectorWrapAt = 0;
  }
  update(dt, input, view, camera) {
    const me = this.store.getMe();
    if (!me || (this.store.myState?.sessionSetup?.pending ?? true)) return;
    const loading = this.store.getLoadingState?.();
    if (loading?.active) {
      me.vx = 0;
      me.vy = 0;
      me._localThrust = 0;
      return;
    }
    const worldMouse = {
      x: camera.x + (input.msx - view.cssW * 0.5),
      y: camera.y + (input.msy - view.cssH * 0.5)
    };
    if (input.rightDown && input.holdActive) {
      this.store.cancelLocalAttack?.();
      this.store.setOptimisticMoveTarget(worldMouse.x, worldMouse.y, { fromHold: true, preserveSelection: true, keepAttack: false });
    }
    this.updateLocalFacing(me, worldMouse, dt);
    this.handleAbilityEdges(me, input, worldMouse);
    this.handleRocketEdge(me, input, worldMouse);
    this.predictMovement(me, dt);
    this.predictAutoAttackFx(me, dt);
  }
  queueNetAction(action) {
    const input = this.store?.inputRef || null;
    if (!input) return;
    if (!Array.isArray(input.actions)) input.actions = [];
    input.actionSeq = (input.actionSeq | 0) + 1;
    input.actions.push({ seq: input.actionSeq, time: performance.now(), ...action });
    if (input.actions.length > 32) input.actions.splice(0, input.actions.length - 32);
    input.forceSend = true;
  }
  handleAbilityEdges(me, input, worldMouse) {
    for (const slot of ["A", "Z", "E", "R"]) {
      const down = !!input[slot.toLowerCase()];
      if (down && !this.lastKeys[slot]) this.castAbilityOptimistic(me, slot, worldMouse);
      this.lastKeys[slot] = down;
    }
  }
  updateLocalFacing(me, worldMouse, dt) {
    if (!me) return;
    const attack = getAttackTarget(this.store);
    const selected = getSelectedTarget(this.store);
    let tx = null;
    let ty = null;
    if (attack.entity && (attack.entity.sx | 0) === (me.sx | 0) && (attack.entity.sy | 0) === (me.sy | 0)) {
      tx = attack.entity.x;
      ty = attack.entity.y;
    } else if (selected.kind === "station" && selected.entity && (selected.entity.sx | 0) === (me.sx | 0) && (selected.entity.sy | 0) === (me.sy | 0)) {
      tx = selected.entity.x;
      ty = selected.entity.y;
    } else if (this.store.localPrediction?.hasMoveTarget) {
      tx = this.store.localPrediction.moveX;
      ty = this.store.localPrediction.moveY;
    } else {
      tx = worldMouse.x;
      ty = worldMouse.y;
    }
    const dx = tx - me.x;
    const dy = ty - me.y;
    if (dx * dx + dy * dy > 1e-3) {
      const desired = Math.atan2(dy, dx);
      me.rot = angleLerp(me.rot, desired, Math.min(1, Math.max(0.18, dt * 28)));
    }
  }
  handleRocketEdge(me, input, worldMouse) {
    const down = !!input.rocketTap;
    if (down && !this.lastKeys.F) {
      if (finite(me.rocketCooldownLeft, 0) <= 0 && finite(me.vitals?.energy, 999) > 1) {
        me.rocketCooldownLeft = Math.max(0.25, finite(this.store.myState?.equipment?.launcher?.cooldown, 0.75));
        me._localActionFlashUntil = performance.now() + 160;
        this.queueNetAction({ type: "rocket", aimX: worldMouse.x, aimY: worldMouse.y });
      }
    }
    this.lastKeys.F = down;
  }
  castAbilityOptimistic(me, slot, worldMouse) {
    const myState = this.store.myState;
    const hud = myState?.abilityHud?.[slot];
    if (hud && hud.unlocked === false) return;
    if (!canCastAbilityLocalFirst(this.store, me, myState, slot)) return;
    if (!canSpendEnergy(me, myState, slot)) return;
    const cd = getCooldownMax(myState, slot);
    setLocalAbilityReadyAt(this.store, slot, performance.now() + cd * 1e3);
    if (!myState.cooldowns) myState.cooldowns = {};
    myState.cooldowns[slot] = cd;
    if (hud) hud.cooldownLeft = cd;
    const now = performance.now();
    this.store.noteLocalAbilityCast?.(slot, cd, { authorityMs: getAbilityLocalAuthorityMs(myState, slot) });
    me._keepLocalPoseUntil = Math.max(me._keepLocalPoseUntil || 0, now + 2600);
    spendEnergyLocal(me, myState, slot);
    const target = getSelectedTarget(this.store);
    const aim = target.entity || worldMouse;
    const dash = getLocalDashDistance(myState, slot);
    const dashStartX = me.x;
    const dashStartY = me.y;
    const appliedDash = dash > 0 && this.applyDash(me, worldMouse, dash);
    const dashEndX = me.x;
    const dashEndY = me.y;
    applyLocalFrameAbilityState(this.store, me, slot, worldMouse, now);
    const boost = getLocalMoveBoost(myState, slot);
    if (boost.pct > 0 && boost.duration > 0) {
      const local = this.store.localPrediction || {};
      local.localMoveBoostMult = Math.max(local.localMoveBoostMult || 1, 1 + boost.pct);
      local.localMoveBoostUntil = Math.max(local.localMoveBoostUntil || 0, performance.now() + boost.duration * 1e3);
      me._localMoveBoostUntil = local.localMoveBoostUntil;
      me._localMoveBoostMult = local.localMoveBoostMult;
      const derivedSpeed = finite(myState?.derived?.moveSpeed, finite(me.engine, 250)) * local.localMoveBoostMult;
      local.localDerived = { ...local.localDerived || myState?.derived || {}, moveSpeed: derivedSpeed };
    }
    this.spawnLocalCastArea(me, aim, slot);
    me._localActionFlashUntil = performance.now() + 180;
    this.queueNetAction({
      type: "cast",
      slot,
      aimX: aim.x,
      aimY: aim.y,
      clientAppliedDash: !!appliedDash,
      castLocalX: me.x,
      castLocalY: me.y,
      castLocalSx: me.sx | 0,
      castLocalSy: me.sy | 0,
      dashStartX,
      dashStartY,
      dashEndX,
      dashEndY,
      localAuthorityMs: getAbilityLocalAuthorityMs(myState, slot)
    });
    const label = hud?.label || slot;
    myState.hint = label;
    myState._optimisticHintLeft = 0.35;
  }
  spawnLocalCastArea(me, worldMouse, slot) {
    if (!this.store.areaEffects) return;
    if (slot !== "E" && slot !== "R") return;
    const id = this.localId--;
    this.store.areaEffects.set(id, {
      id,
      localOnly: true,
      ownerId: me.id,
      sx: me.sx | 0,
      sy: me.sy | 0,
      x: finite(worldMouse.x, me.x),
      y: finite(worldMouse.y, me.y),
      radius: slot === "R" ? 92 : 58,
      durationLeft: slot === "R" ? 0.34 : 0.22,
      ttl: slot === "R" ? 0.34 : 0.22,
      color: slot === "R" ? { r: 255, g: 205, b: 96 } : { r: 92, g: 255, b: 190 }
    });
  }
  applyDash(me, worldMouse, distPx) {
    if (hasBlockingStatus(me)) return false;
    const local = this.store.localPrediction || {};
    const d = norm(worldMouse.x - me.x, worldMouse.y - me.y);
    if (!d.x && !d.y) return false;
    const beforeX = me.x;
    const beforeY = me.y;
    const hadMoveTarget = !!local.hasMoveTarget;
    const moveX = local.moveX;
    const moveY = local.moveY;
    me.x += d.x * distPx;
    me.y += d.y * distPx;
    const dashSpeed = Math.max(finite(this.store.myState?.derived?.moveSpeed, me.engine || 250), distPx / 0.1);
    me.vx = d.x * dashSpeed;
    me.vy = d.y * dashSpeed;
    me.rot = Math.atan2(d.y, d.x);
    me._localThrust = 1;
    me._clientDashGrace = 0.7;
    me._localDashFromX = beforeX;
    me._localDashFromY = beforeY;
    if (resolveLocalSolidWalls(this.store, me, beforeX, beforeY)) {
      me._clientDashGrace = 0;
      me._localThrust = 0;
    }
    pinLocalEntityTarget(me);
    const now = performance.now();
    me._localDashUntil = now + 900;
    me._keepLocalPoseUntil = Math.max(me._keepLocalPoseUntil || 0, now + 3200);
    if (hadMoveTarget && Number.isFinite(moveX) && Number.isFinite(moveY)) {
      local.hasMoveTarget = true;
      local.moveX = moveX;
      local.moveY = moveY;
      if (Math.hypot(moveX - me.x, moveY - me.y) <= 10 && !local.hold) local.hasMoveTarget = false;
    }
    local.abilityMovementLockUntil = Math.max(local.abilityMovementLockUntil || 0, now + 1);
    this.requestServerSectorWrapIfNeeded(me);
    return true;
  }
  spawnLocalProjectile(me, targetOrPoint, opts = {}) {
    if (!this.store.projectiles) return;
    const tx = finite(targetOrPoint?.x, me.x + 500);
    const ty = finite(targetOrPoint?.y, me.y);
    const d = norm(tx - me.x, ty - me.y);
    const speed = opts.rocket ? 820 : opts.slot === "R" ? 980 : 1250;
    const id = this.localId--;
    const targetKind = opts.targetKind || targetOrPoint?.kind || "";
    const targetId = opts.targetId || targetOrPoint?.id || 0;
    const distToTarget = Math.max(20, Math.hypot(tx - me.x, ty - me.y));
    this.store.projectiles.set(id, {
      id,
      localOnly: true,
      ownerId: me.id,
      sx: me.sx | 0,
      sy: me.sy | 0,
      x: me.x + d.x * 24,
      y: me.y + d.y * 24,
      vx: d.x * speed,
      vy: d.y * speed,
      radius: opts.rocket ? 6 : 4,
      color: opts.rocket ? { r: 255, g: 188, b: 92 } : { r: 130, g: 225, b: 255 },
      tint: opts.rocket ? { r: 255, g: 188, b: 92 } : { r: 130, g: 225, b: 255 },
      visualKind: opts.rocket ? "rocket" : "auto",
      sourceAbilitySlot: opts.slot || "",
      ttl: Math.max(opts.rocket ? 0.24 : 0.12, Math.min(opts.rocket ? 0.75 : 0.42, distToTarget / Math.max(1, speed) + 0.05)),
      _tx: tx,
      _ty: ty,
      _targetKind: targetKind,
      _targetId: targetId,
      _impactDamage: finite(opts.impactDamage, 0),
      _visualOnly: !!opts.visualOnly,
      _bornClientAt: performance.now(),
      _expectedServerEchoWindow: finite(opts.expectedServerEchoWindow, 0),
      _impactApplied: false,
      _impactRadius: opts.rocket ? 34 : 24
    });
  }
  predictAutoAttackFx(me, dt) {
    this.localAutoCooldown = 0;
    this.lastLocalAutoTarget = null;
  }
  predictMovement(me, dt) {
    if (!Number.isFinite(dt) || dt <= 0 || hasBlockingStatus(me)) return;
    const local = this.store.localPrediction || {};
    const now = performance.now();
    if (now < finite(local.abilityMovementLockUntil, 0)) {
      me.vx *= Math.max(0, 1 - dt * 5);
      me.vy *= Math.max(0, 1 - dt * 5);
      me._localThrust = Math.max(finite(me._localThrust, 0), 0.75);
      pinLocalEntityTarget(me);
      return;
    }
    let tx = null;
    let ty = null;
    let stopDistance = 10;
    if (local.hasMoveTarget) {
      tx = local.moveX;
      ty = local.moveY;
      stopDistance = 10;
    } else {
      const attack = getAttackTarget(this.store);
      if (attack.entity && (attack.entity.sx | 0) === (me.sx | 0) && (attack.entity.sy | 0) === (me.sy | 0)) {
        const range = Math.max(120, finite(this.store.myState?.derived?.autoAttackRange, 620));
        const targetRadius = Math.max(0, finite(attack.entity.radius, 0));
        const dx2 = attack.entity.x - me.x;
        const dy2 = attack.entity.y - me.y;
        const d2 = Math.hypot(dx2, dy2);
        if (d2 > range + targetRadius * 0.25) {
          const desired = Math.max(60, range * 0.82 + targetRadius * 0.2);
          const n = norm(dx2, dy2);
          tx = attack.entity.x - n.x * desired;
          ty = attack.entity.y - n.y * desired;
          stopDistance = 22;
        }
      } else {
        const selected = getSelectedTarget(this.store);
        if (selected.kind === "station" && selected.entity && (selected.entity.sx | 0) === (me.sx | 0) && (selected.entity.sy | 0) === (me.sy | 0)) {
          tx = selected.entity.x;
          ty = selected.entity.y;
          stopDistance = Math.max(70, finite(selected.entity.radius, 46) + 70);
        }
      }
    }
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) {
      me.vx = Math.abs(me.vx || 0) < 1 ? 0 : (me.vx || 0) * Math.max(0, 1 - dt * 18);
      me.vy = Math.abs(me.vy || 0) < 1 ? 0 : (me.vy || 0) * Math.max(0, 1 - dt * 18);
      me._localThrust = Math.max(0, finite(me._localThrust, 0) - dt * 8);
      pinLocalEntityTarget(me);
      return;
    }
    const dx = tx - me.x;
    const dy = ty - me.y;
    const d = Math.hypot(dx, dy);
    if (d <= stopDistance) {
      if (local.hasMoveTarget && !local.hold) local.hasMoveTarget = false;
      me.vx = 0;
      me.vy = 0;
      me._localThrust = Math.max(0, finite(me._localThrust, 0) - dt * 10);
      pinLocalEntityTarget(me);
      return;
    }
    let speed = finite(this.store.myState?.derived?.moveSpeed, finite(me.engine, 250));
    const predLocal = this.store.localPrediction || {};
    if (performance.now() < finite(predLocal.localMoveBoostUntil, 0)) speed *= Math.max(1, finite(predLocal.localMoveBoostMult, 1));
    const step = Math.min(d, speed * dt);
    const oldX = me.x;
    const oldY = me.y;
    me.x += dx / d * step;
    me.y += dy / d * step;
    me.vx = dx / d * speed;
    me.vy = dy / d * speed;
    if (resolveLocalSolidWalls(this.store, me, oldX, oldY)) {
      me._localThrust = 0;
      pinLocalEntityTarget(me);
      return;
    }
    me.rot = angleLerp(me.rot, Math.atan2(dy, dx), Math.min(1, Math.max(0.22, dt * 30)));
    me._localThrust = Math.min(1, Math.max(finite(me._localThrust, 0), Math.min(1, d / 180)));
    pinLocalEntityTarget(me);
    this.requestServerSectorWrapIfNeeded(me);
  }
  requestServerSectorWrapIfNeeded(me) {
    const now = performance.now();
    if (now < finite(me._sectorLockUntil, 0)) return;
    const over = 18;
    const crossed = me.x < -2e3 - over || me.x > 2e3 + over || me.y < -2e3 - over || me.y > 2e3 + over;
    if (!crossed) return;
    const local = this.store.localPrediction || {};
    local.hasMoveTarget = false;
    local.hold = false;
    local.moveX = me.x;
    local.moveY = me.y;
    this.store.setOptimisticSelection("", 0);
    this.store.cancelLocalAttack?.({ keepSeq: false });
    me.hasMoveTarget = false;
    me.vx = 0;
    me.vy = 0;
    me._localThrust = 0;
    me._sectorLockUntil = now + 900;
    me._keepLocalPoseUntil = 0;
    local.sectorSeq = (local.sectorSeq | 0) + 1;
    this.store.beginPortalLoading?.("Chargement du secteur\u2026", 520, local.sectorSeq | 0);
  }
  reconcileSoftly(me, dt, isMoving = false) {
    return;
  }
};

// client/src/App.js
function hasLocalStatus(me, id) {
  return (me?.statuses ?? []).some((s) => s.id === id);
}
function drawBlindViewportMask(ctx, view, me, t) {
  if (!hasLocalStatus(me, "blind")) return;
  const cx = view.cssW * 0.5;
  const cy = view.cssH * 0.5;
  const pulse = 0.5 + 0.5 * Math.sin(t * 4.2);
  const clearR = 126 + pulse * 8;
  const fadeR = 220 + pulse * 14;
  const g = ctx.createRadialGradient(cx * view.dpr, cy * view.dpr, clearR * view.dpr, cx * view.dpr, cy * view.dpr, fadeR * view.dpr);
  g.addColorStop(0, "rgba(0,0,0,0.00)");
  g.addColorStop(0.34, "rgba(0,0,0,0.38)");
  g.addColorStop(0.66, "rgba(0,0,0,0.86)");
  g.addColorStop(1, "rgba(0,0,0,0.95)");
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.strokeStyle = "rgba(214,198,126,0.50)";
  ctx.lineWidth = 1.6 * view.dpr;
  ctx.setLineDash([8 * view.dpr, 7 * view.dpr]);
  ctx.beginPath();
  ctx.arc(cx * view.dpr, cy * view.dpr, clearR * view.dpr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
function startApp() {
  const canvas = document.getElementById("c");
  const statusEl = document.getElementById("status");
  const view = new CanvasView(canvas);
  const store = new WorldStore();
  const predictor = new ClientPrediction(store);
  const input = createInputState();
  store.inputRef = input;
  const audio = new AudioSystem();
  let graphicsOptions = { starDensity: 1, showGrid: true, showFx: true, renderScale: 1 };
  const fxStore = new VisualFxStore();
  const uiRoot = document.getElementById("ui-root");
  const dock = new TopRightDock(uiRoot);
  const playersPanel = new PlayersPanelView();
  uiRoot.appendChild(playersPanel.el);
  const travelOverlay = document.createElement("div");
  travelOverlay.className = "travel-loading";
  travelOverlay.innerHTML = '<div class="travel-loading__box"><div class="travel-loading__title">Chargement</div><div class="travel-loading__label">Saut de secteur\u2026</div><div class="travel-loading__bar"><span></span></div></div>';
  uiRoot.appendChild(travelOverlay);
  const net = new NetClient(store, (txt) => {
    statusEl.textContent = txt;
  });
  net.connect();
  const sendCmd = (cmd, payload = {}, meta = {}) => {
    if (cmd === "toggle_converter" && payload?.itemId && (payload.enabled === true || payload.enabled === false)) {
      store.setConverterOptimistic?.(payload.itemId, payload.enabled);
    }
    const cmdId = store.noteCommandPending?.(cmd, payload, meta) || "";
    net.send({ t: "cmd", cmd, cmdId, ...payload || {} });
    return cmdId;
  };
  playersPanel.bindChat((text) => net.send({ t: "chat", text }));
  const cargoPanel = new CargoPanelView(sendCmd);
  dock.registerPanel({ id: "cargo", title: "Cargo", iconMarkup: getCargoIconSvg(), panelEl: cargoPanel.el, group: "game" });
  const convertersPanel = new ConvertersPanelView(sendCmd);
  dock.registerPanel({ id: "converters", title: "Convert.", iconMarkup: getConverterIconSvg2(), panelEl: convertersPanel.el, shellClass: "ui-panel-shell--converters", group: "game" });
  const optionsPanel = new OptionsPanelView((settings) => {
    audio.applySettings(settings);
    graphicsOptions = { ...graphicsOptions, ...settings };
    view.setRenderScale(settings.renderScale);
  });
  graphicsOptions = { ...graphicsOptions, ...optionsPanel.getSettings() };
  audio.applySettings(optionsPanel.getSettings());
  view.setRenderScale(optionsPanel.getSettings().renderScale);
  dock.registerPanel({ id: "options", title: "Options", iconMarkup: getOptionsIconSvg(), panelEl: optionsPanel.el, group: "utility" });
  const basePanel = new BasePanelView(sendCmd, () => {
    if (dock.activeId === "base") dock.toggle("base");
  });
  dock.registerPanel({ id: "base", title: "Build", iconMarkup: getBaseIconSvg(), panelEl: basePanel.el, group: "game" });
  const storagePanel = new StoragePanelView(sendCmd);
  uiRoot.appendChild(storagePanel.el);
  window.addEventListener("keydown", (ev) => {
    const tag = String(ev.target?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || ev.target?.isContentEditable) return;
    if (!basePanel.hasActivePlacement?.()) return;
    if (ev.key === "Escape") {
      basePanel.cancel();
      ev.preventDefault();
    } else if (String(ev.key || "").toLowerCase() === "o") {
      if (basePanel.rotate()) ev.preventDefault();
    }
  });
  dock.registerToggle({
    id: "quit-session",
    title: "Quitter",
    group: "utility",
    iconMarkup: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M13 8l4 4-4 4M17 12H4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    onToggle: () => {
      if (store.myState?.sessionSetup?.pending ?? true) return;
      const br = store.modes?.currentMode === "battle" || !!store.modes?.battleSessionId || !!store.modes?.battleQueuedNext;
      const text = br ? "Quitter la session Battle Royale ? Tu perdras ton avancement dans cette Battle." : "Quitter la session Endless ? Ton vaisseau sera prot\xE9g\xE9 et tu reviendras \xE0 la s\xE9lection.";
      if (window.confirm(text)) sendCmd("quit_session", {});
    },
    isActive: () => false
  });
  const mapWindow = new MapWindowView();
  uiRoot.appendChild(mapWindow.el);
  dock.registerToggle({
    id: "map",
    title: "Carte",
    group: "game",
    iconMarkup: getMapIconSvg(),
    onToggle: () => mapWindow.toggle(),
    isActive: () => mapWindow.isOpen
  });
  const stationWindow = new StationWindowView(sendCmd, store);
  uiRoot.appendChild(stationWindow.el);
  const sessionSetup = new SessionSetupOverlay((payload) => {
    sendCmd("commit_session_setup", payload);
  }, () => {
    sendCmd("cancel_battle_queue", {});
  }, (payload) => {
    sendCmd("auth_session_account", payload);
  });
  uiRoot.appendChild(sessionSetup.el);
  new InputController(canvas, input, {
    onFrameSelect: (frameId) => {
      if (store.myState?.sessionSetup?.pending ?? true) {
        sessionSetup.selectFrame(frameId);
        return;
      }
      sendCmd("set_frame", { frameId });
    },
    onAbilityUpgrade: (slot) => {
      store.upgradeAbilityLocal?.(slot);
      sendCmd("upgrade_ability", { slot });
    },
    onRocketSlotSwitch: (slot) => sendCmd("switch_rocket_slot", { slot }),
    onPrimaryDown: handlePrimaryDown
  });
  audio.installUnlock(canvas);
  canvas.addEventListener("mousedown", (ev) => {
    if (ev.button !== 0) return;
    if (store.myState?.sessionSetup?.pending ?? true) return;
    const rect = canvas.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    if (basePanel.hasActivePlacement?.()) {
      const mouseWorld = {
        x: camera.x + (px - view.cssW * 0.5),
        y: camera.y + (py - view.cssH * 0.5)
      };
      basePanel.placeCurrent(store, mouseWorld);
      ev.preventDefault();
      return;
    }
    const radarMove = hitTestRadarMove(view, store.getMe(), px, py);
    if (radarMove) {
      input.moveWorldQueued = true;
      input.moveWorldX = radarMove.x;
      input.moveWorldY = radarMove.y;
      ev.preventDefault();
      return;
    }
    const layout = getCombatHudLayout(view);
    const equipmentHit = getEquippedHudHit(layout, px, py, store.myState);
    if (equipmentHit?.slot?.ammo) {
      sendCmd("switch_rocket_slot", { slot: equipmentHit.slot.ammoSlotIndex | 0 });
      ev.preventDefault();
      return;
    }
    const slot = hitTestHudAbility(view, px, py);
    if (!slot) return;
    const hudSlot = store.myState?.abilityHud?.[slot];
    if (hudSlot?.canUpgrade) {
      store.upgradeAbilityLocal?.(slot);
      sendCmd("upgrade_ability", { slot });
      ev.preventDefault();
    }
  });
  let lastSend = 0;
  let lastFrameTime = performance.now() / 1e3;
  const camera = { x: 0, y: 0, initialized: false, sx: null, sy: null, forceCenterFrames: 0 };
  function clampCameraToSector(me) {
    const overX = Math.min(SECTOR.half * 0.62, Math.max(420, view.cssW * 0.42));
    const overY = Math.min(SECTOR.half * 0.62, Math.max(300, view.cssH * 0.42));
    const minX = -SECTOR.half - overX;
    const maxX = SECTOR.half + overX;
    const minY = -SECTOR.half - overY;
    const maxY = SECTOR.half + overY;
    camera.x = clamp(camera.x, minX, maxX);
    camera.y = clamp(camera.y, minY, maxY);
  }
  function hardCenterCameraOnPlayer(me) {
    if (!me) return;
    camera.x = me.x;
    camera.y = me.y;
    camera.sx = me.sx | 0;
    camera.sy = me.sy | 0;
    camera.initialized = true;
    camera.forceCenterFrames = 2;
  }
  function updateCamera(me, dt) {
    if (!me) {
      camera.x = 0;
      camera.y = 0;
      camera.sx = null;
      camera.sy = null;
      camera.initialized = true;
      return;
    }
    const sx = me.sx | 0;
    const sy = me.sy | 0;
    const sectorChanged = camera.sx !== sx || camera.sy !== sy;
    if (!camera.initialized) {
      hardCenterCameraOnPlayer(me);
      return;
    }
    if (sectorChanged) {
      const oldSx = Number.isFinite(camera.sx) ? camera.sx : sx;
      const oldSy = Number.isFinite(camera.sy) ? camera.sy : sy;
      camera.x += (oldSx - sx) * SECTOR.size;
      camera.y += (oldSy - sy) * SECTOR.size;
      camera.sx = sx;
      camera.sy = sy;
      camera.forceCenterFrames = 0;
      clampCameraToSector(me);
    }
    if (input.cameraLocked || (store.myState?.sessionSetup?.pending ?? true) || camera.forceCenterFrames > 0) {
      camera.x = me.x;
      camera.y = me.y;
      camera.sx = sx;
      camera.sy = sy;
      camera.initialized = true;
      if (camera.forceCenterFrames > 0) camera.forceCenterFrames -= 1;
      return;
    }
    const edge = 42;
    const maxSpeed = 1320;
    let vx = 0;
    let vy = 0;
    if (input.msx <= edge) vx -= 1 - input.msx / edge;
    if (input.msx >= view.cssW - edge) vx += 1 - (view.cssW - input.msx) / edge;
    if (input.msy <= edge) vy -= 1 - input.msy / edge;
    if (input.msy >= view.cssH - edge) vy += 1 - (view.cssH - input.msy) / edge;
    const l = Math.hypot(vx, vy);
    if (l > 1) {
      vx /= l;
      vy /= l;
    }
    camera.x += vx * maxSpeed * dt;
    camera.y += vy * maxSpeed * dt;
    clampCameraToSector(me);
  }
  function toPlayerRelativeScreen(me, screenX, screenY) {
    if (!me) return { x: screenX, y: screenY };
    return {
      x: screenX + (camera.x - me.x),
      y: screenY + (camera.y - me.y)
    };
  }
  function pickLocalPrimaryTarget(worldX, worldY) {
    const me = store.getMe();
    if (!me) return null;
    let best = null;
    let bestD2 = Infinity;
    const sameSector2 = (e) => (e?.sx | 0) === (me.sx | 0) && (e?.sy | 0) === (me.sy | 0);
    const tryPick = (kind, e, baseR) => {
      if (!e || !sameSector2(e)) return;
      const r = Math.max(baseR, (e.radius || 0) + baseR - 12);
      const dx = (e.x || 0) - worldX;
      const dy = (e.y || 0) - worldY;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r * r && d2 < bestD2) {
        bestD2 = d2;
        best = { kind, id: e.id || 0, x: e.x || 0, y: e.y || 0, sx: e.sx | 0, sy: e.sy | 0 };
      }
    };
    for (const p of store.players.values()) {
      if (p.id === me.id) continue;
      tryPick("player", p, 42);
    }
    for (const mob of store.mobs.values()) tryPick("mob", mob, 46);
    for (const a of store.asteroids.values()) {
      if (a.bastionWall || a.unselectable) continue;
      tryPick("asteroid", a, 52);
    }
    for (const st of store.structures?.values?.() || []) {
      if (!st.attackable || !sameSector2(st)) continue;
      const w = Number(st.w) || (Number(st.radius) || 0) * 2;
      const h = Number(st.h) || (Number(st.radius) || 0) * 2;
      const px = Math.max((st.x || 0) - w * 0.5, Math.min(worldX, (st.x || 0) + w * 0.5));
      const py = Math.max((st.y || 0) - h * 0.5, Math.min(worldY, (st.y || 0) + h * 0.5));
      const d2 = (worldX - px) * (worldX - px) + (worldY - py) * (worldY - py);
      if (d2 <= 38 * 38 && d2 < bestD2) {
        bestD2 = d2;
        best = { kind: "structure", id: st.id || 0, x: st.x || 0, y: st.y || 0, sx: st.sx | 0, sy: st.sy | 0 };
      }
    }
    if (best) return best;
    for (const station of store.stations.values()) tryPick("station", station, 48);
    return best;
  }
  function pickLocalPrimaryTargetScreen(screenX, screenY) {
    const me = store.getMe();
    if (!me) return null;
    let best = null;
    let bestD2 = Infinity;
    const sameSector2 = (e) => (e?.sx | 0) === (me.sx | 0) && (e?.sy | 0) === (me.sy | 0);
    const tryPick = (kind, e, baseR) => {
      if (!e || !sameSector2(e)) return;
      if (kind === "player" && e.id === me.id) return;
      if (e.bastionWall || e.unselectable) return;
      const sx = (e.x || 0) - camera.x + view.cssW * 0.5;
      const sy = (e.y || 0) - camera.y + view.cssH * 0.5;
      const r = Math.max(baseR, (e.radius || 0) + baseR - 10);
      const dx = sx - screenX;
      const dy = sy - screenY;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r * r && d2 < bestD2) {
        bestD2 = d2;
        best = { kind, id: e.id || 0, x: e.x || 0, y: e.y || 0, sx: e.sx | 0, sy: e.sy | 0 };
      }
    };
    for (const p of store.players.values()) tryPick("player", p, 46);
    for (const mob of store.mobs.values()) tryPick("mob", mob, 52);
    for (const a of store.asteroids.values()) tryPick("asteroid", a, 58);
    for (const st of store.structures?.values?.() || []) {
      if (!st.attackable || !sameSector2(st)) continue;
      const w = Number(st.w) || (Number(st.radius) || 0) * 2;
      const h = Number(st.h) || (Number(st.radius) || 0) * 2;
      const cx = (st.x || 0) - camera.x + view.cssW * 0.5;
      const cy = (st.y || 0) - camera.y + view.cssH * 0.5;
      const left = cx - w * 0.5;
      const right = cx + w * 0.5;
      const top = cy - h * 0.5;
      const bottom = cy + h * 0.5;
      const px = Math.max(left, Math.min(screenX, right));
      const py = Math.max(top, Math.min(screenY, bottom));
      const dx = screenX - px;
      const dy = screenY - py;
      const d2 = dx * dx + dy * dy;
      if (d2 <= 42 * 42 && d2 < bestD2) {
        bestD2 = d2;
        best = { kind: "structure", id: st.id || 0, x: st.x || 0, y: st.y || 0, sx: st.sx | 0, sy: st.sy | 0 };
      }
    }
    if (best) return best;
    for (const station of store.stations.values()) tryPick("station", station, 52);
    return best;
  }
  function handlePrimaryDown(screenX, screenY) {
    if (store.myState?.sessionSetup?.pending ?? true) return null;
    const mouseWorld = {
      x: camera.x + (screenX - view.cssW * 0.5),
      y: camera.y + (screenY - view.cssH * 0.5)
    };
    const target = pickLocalPrimaryTargetScreen(screenX, screenY) || pickLocalPrimaryTarget(mouseWorld.x, mouseWorld.y);
    if (target) {
      store.setOptimisticSelection(target.kind, target.id, { lockMs: 3e4 });
      if (target.kind === "station") store.cancelLocalAttack?.();
      else store.setLocalAttackTarget?.(target.kind, target.id, { lockMs: 3e4 });
      return { type: "target", kind: target.kind, id: target.id, x: target.x, y: target.y, sx: target.sx, sy: target.sy };
    }
    store.setOptimisticMoveTarget(mouseWorld.x, mouseWorld.y, { preserveSelection: false, keepAttack: false });
    return { type: "move", x: mouseWorld.x, y: mouseWorld.y };
  }
  function applyOptimisticPrimaryClick(screenX, screenY) {
    if (store.myState?.sessionSetup?.pending ?? true) return;
    const mouseWorld = {
      x: camera.x + (screenX - view.cssW * 0.5),
      y: camera.y + (screenY - view.cssH * 0.5)
    };
    const target = pickLocalPrimaryTarget(mouseWorld.x, mouseWorld.y);
    if (target) {
      store.setOptimisticSelection(target.kind, target.id);
      if (target.kind === "station") store.cancelLocalAttack?.();
      else store.setLocalAttackTarget?.(target.kind, target.id);
      input.holdActive = false;
      input.suppressRightHoldUntilUp = true;
      input.moveWorldQueued = false;
      return;
    }
    store.setOptimisticMoveTarget(mouseWorld.x, mouseWorld.y, { preserveSelection: false, keepAttack: false });
  }
  function findNearbyPortalForLocalPlayer() {
    const me = store.getMe();
    if (!me) return null;
    let best = null;
    let bestD2 = Infinity;
    for (const portal of store.portals.values()) {
      if ((portal.sx | 0) !== (me.sx | 0) || (portal.sy | 0) !== (me.sy | 0)) continue;
      const dx = (portal.x || 0) - me.x;
      const dy = (portal.y || 0) - me.y;
      const d2 = dx * dx + dy * dy;
      const r = (me.radius || 18) + (portal.radius || 38) + 28;
      if (d2 <= r * r && d2 < bestD2) {
        best = portal;
        bestD2 = d2;
      }
    }
    return best;
  }
  function updateTravelOverlay() {
    const loading = store.getLoadingState();
    travelOverlay.classList.toggle("is-active", !!loading.active);
    if (!loading.active) return;
    const label = travelOverlay.querySelector(".travel-loading__label");
    if (label) label.textContent = loading.label || "Saut de secteur\u2026";
  }
  function clearQueuedInput() {
    input.clickQueued = false;
    input.interactTap = false;
    input.rocketTap = false;
    input.a = false;
    input.z = false;
    input.e = false;
    input.r = false;
    input.rightDown = false;
    input.holdActive = false;
    input.suppressRightHoldUntilUp = false;
  }
  function sendInput(primaryHold) {
    const me = store.getMe();
    if (input.interactTap) {
      const portal = findNearbyPortalForLocalPlayer();
      if (portal) {
        const far = Math.max(Math.abs((portal.targetSx | 0) - (portal.sx | 0)), Math.abs((portal.targetSy | 0) - (portal.sy | 0))) > 1;
        if (far || portal.mode === "test_arena" || portal.mode === "mob_bestiary") {
          store.beginPortalLoading(portal.label || `Saut \u2192 [${portal.targetSx | 0},${portal.targetSy | 0}]`, far ? 900 : 520);
        }
      }
    }
    const mouseForServer = toPlayerRelativeScreen(me, input.msx, input.msy);
    const actionBatch = Array.isArray(input.actions) && input.actions.length ? input.actions.splice(0, input.actions.length) : [];
    const aimWorldX = camera.x + (input.msx - view.cssW * 0.5);
    const aimWorldY = camera.y + (input.msy - view.cssH * 0.5);
    const clientPose = {
      cx: me?.x,
      cy: me?.y,
      csx: me?.sx,
      csy: me?.sy,
      cvx: me?.vx,
      cvy: me?.vy,
      crot: me?.rot,
      cthrust: me?._localThrust ?? 0
    };
    for (const action of actionBatch) {
      Object.assign(action, clientPose);
      if ((action.type === "cast" || action.type === "rocket") && !Number.isFinite(action.aimX)) {
        action.aimX = aimWorldX;
        action.aimY = aimWorldY;
      }
      if (action.type === "target") {
        let target = null;
        if (action.kind === "player") target = store.players.get(action.id);
        if (action.kind === "mob") target = store.mobs.get(action.id);
        if (action.kind === "asteroid") target = store.asteroids.get(action.id);
        if (action.kind === "station") target = store.stations.get(action.id);
        if (target) {
          action.targetX = target.x;
          action.targetY = target.y;
          action.targetSx = target.sx | 0;
          action.targetSy = target.sy | 0;
        }
      }
    }
    net.send({
      t: "input",
      inputSeq: input.inputSeq = (input.inputSeq | 0) + 1,
      vw: view.cssW,
      vh: view.cssH,
      msx: mouseForServer.x,
      msy: mouseForServer.y,
      // V82: les abilities/rocket/interact passent par actions[].
      // On n'envoie plus les anciens booléens maintenus sur plusieurs frames,
      // sinon le serveur peut rejouer une action après le paquet événementiel.
      a: false,
      z: false,
      e: false,
      r: false,
      interactTap: false,
      rocketTap: false,
      primaryClick: input.clickQueued,
      primaryHold,
      px: mouseForServer.x,
      py: mouseForServer.y,
      moveWorld: input.moveWorldQueued,
      moveWorldX: input.moveWorldX,
      moveWorldY: input.moveWorldY,
      targetClick: !!input.targetClickQueued,
      targetClickKind: input.targetKind || "",
      targetClickId: input.targetId || 0,
      selectSeq: input.selectSeq | 0,
      selectedKind: store.localPrediction?.selectedKind || store.myState?.selectedKind || "",
      selectedId: store.localPrediction?.selectedId || store.myState?.selectedId || 0,
      attackKind: store.localPrediction?.attackKind || "",
      attackId: store.localPrediction?.attackId || 0,
      attackSeq: store.localPrediction?.attackSeq | 0,
      actions: actionBatch,
      aimWorldX,
      aimWorldY,
      localMoveX: store.localPrediction?.moveX ?? 0,
      localMoveY: store.localPrediction?.moveY ?? 0,
      // Mode .io réactif : on laisse temporairement le client piloter sa pose.
      // Le serveur la reprend comme vérité pour éviter les rollbacks perceptibles.
      cx: me?.x,
      cy: me?.y,
      csx: me?.sx,
      csy: me?.sy,
      cvx: me?.vx,
      cvy: me?.vy,
      crot: me?.rot,
      cthrust: me?._localThrust ?? 0,
      clientTime: performance.now(),
      sectorSeq: store.localPrediction?.sectorSeq | 0,
      abilitySeq: store.localPrediction?.abilitySeq | 0
    });
    input.moveWorldQueued = false;
    input.clickQueued = false;
    input.targetClickQueued = false;
    input.interactTap = false;
    input.rocketTap = false;
  }
  function frame() {
    const t = performance.now() / 1e3;
    const ctx = view.ctx;
    audio.playPending(store.consumePendingSfx());
    const me = store.getMe();
    audio.update(me, input);
    const dt = Math.min(0.05, Math.max(0, t - lastFrameTime));
    lastFrameTime = t;
    store.interpolate(dt);
    predictor.update(dt, input, view, camera);
    updateCamera(store.getMe(), dt);
    updateTravelOverlay();
    const camX = camera.x;
    const camY = camera.y;
    const mouseWorld = { x: camX + (input.msx - view.cssW * 0.5), y: camY + (input.msy - view.cssH * 0.5) };
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, view.w, view.h);
    drawStars(ctx, view, camX, camY, graphicsOptions.starDensity, store.myState?.sectorBiome || null);
    if (graphicsOptions.showGrid) drawGrid(ctx, view, camX, camY, store.world);
    if (me) drawGroundMarker(ctx, view, me, camX, camY, t);
    for (const s of store.stations.values()) drawStation(ctx, view, s, camX, camY, t);
    for (const st of store.structures.values()) drawStructure(ctx, view, st, camX, camY, t);
    drawStructureBuildPreview(ctx, view, basePanel.getPreview(store, mouseWorld), camX, camY, t);
    drawPortals(ctx, view, store, camX, camY);
    for (const a of store.asteroids.values()) drawAsteroid(ctx, view, a, camX, camY);
    for (const mob of store.mobs.values()) drawMob(ctx, view, mob, camX, camY, t);
    if (graphicsOptions.showFx) fxStore.sync(store, t);
    for (const l of store.loots.values()) drawLoot(ctx, view, l, camX, camY);
    if (graphicsOptions.showFx) fxStore.drawTrails(ctx, view, camX, camY, t);
    for (const p of store.projectiles.values()) drawProjectile(ctx, view, p, camX, camY);
    for (const effect of store.areaEffects.values()) drawAreaEffect(ctx, view, effect, camX, camY, t);
    if (graphicsOptions.showFx) {
      fxStore.drawImpacts(ctx, view, camX, camY, t);
      fxStore.drawDamageNumbers(ctx, view, camX, camY, t);
    }
    for (const mob of store.mobs.values()) drawWorldStatuses(ctx, view, mob, camX, camY, t);
    for (const a of store.asteroids.values()) drawWorldStatuses(ctx, view, a, camX, camY, t);
    {
      const selectedKind = store.localPrediction?.selectedKind || store.myState?.selectedKind || "";
      const selectedId = store.localPrediction?.selectedId || store.myState?.selectedId || 0;
      if (selectedKind && selectedId) {
        let target = null;
        if (selectedKind === "player") target = store.players.get(selectedId);
        if (selectedKind === "mob") target = store.mobs.get(selectedId);
        if (selectedKind === "asteroid") target = store.asteroids.get(selectedId);
        if (selectedKind === "station") target = store.stations.get(selectedId);
        if (selectedKind === "structure") target = store.structures.get(selectedId);
        if (target) {
          const age = Math.max(0, Math.min(1, (performance.now() - (store.localPrediction?.selectedAt || 0)) / 260));
          const pulse = 1 + (1 - age) * 0.28;
          drawSelectionRing(ctx, view, target.x, target.y, (target.radius || 18) * pulse, rgba(255, 230, 140, 0.98), camX, camY);
        }
      }
    }
    for (const p of store.players.values()) drawShip(ctx, view, p, camX, camY, t, mouseWorld, store.players, store.asteroids);
    if (me) drawBlindViewportMask(ctx, view, me, t);
    const isDocked = !!store.myState?.dockedStationId;
    cargoPanel.update(store.myState?.inv, { isDocked });
    dock.setBadge("cargo", store.myState?.inv ? `${store.myState.inv.cargoUsed | 0}` : "");
    dock.setEnabled("cargo", !isDocked);
    convertersPanel.update(store.myState?.equipment);
    const activeConverterCount = Math.max(0, store.myState?.equipment?.converters?.summary?.enabledCount | 0);
    dock.setBadge("converters", activeConverterCount > 0 ? `${activeConverterCount}` : "");
    dock.setEnabled("converters", !!store.myState?.equipment?.converters);
    basePanel.update(store);
    storagePanel.update(store);
    playersPanel.update(store.playerDirectory, store.session, store.myId, store.modes, store);
    mapWindow.update(store.myState?.map, store.myState?.inv, store.seed);
    stationWindow.update(store.myState, store.stations);
    sessionSetup.sync(store.myState, !!store.myId, store.modes);
    if (me && !(store.myState?.sessionSetup?.pending ?? true)) {
      drawHud(ctx, view, me, store.myState, input);
      drawRadar(ctx, view, me, store.players, store.mobs, store.asteroids, store.stations, store.myState);
      drawContextHint(ctx, view, me, store.stations);
    }
    statusEl.textContent = store.myId ? "" : "Connexion\u2026";
    const now = performance.now();
    if (now - lastSend >= 4) {
      lastSend = now;
      if (store.myState?.sessionSetup?.pending ?? true) clearQueuedInput();
      else sendInput(input.rightDown && input.holdActive && !input.suppressRightHoldUntilUp && !store.getLoadingState?.().active);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// gravitar-bundle-entry.tmp.js
function showBootError(error) {
  const message = error?.stack || error?.message || String(error || "Erreur inconnue");
  console.error("[Gravitar bundled boot]", error);
  const root = document.getElementById("ui-root") || document.body;
  const box = document.createElement("div");
  box.className = "boot-error";
  box.innerHTML = `
    <div class="boot-error__panel">
      <div class="boot-error__title">Erreur au chargement du jeu</div>
      <div class="boot-error__hint">Le fallback bundle a d\xE9marr\xE9 mais le jeu a plant\xE9 pendant startApp.</div>
      <pre></pre>
    </div>
  `;
  box.querySelector("pre").textContent = message;
  root.appendChild(box);
}
try {
  startApp();
} catch (error) {
  showBootError(error);
}
