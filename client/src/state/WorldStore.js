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
    this.chatMessages = [];
    this.chatUnread = 0;
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
      localDamage: new Map(),
      sectorTransitionAt: 0,
      sectorSx: 0,
      sectorSy: 0,
      sectorX: 0,
      sectorY: 0,
      loadingUntil: 0,
      loadingLabel: '',
      remoteTransitionId: 0,
      localCooldownLocks: {},
      localUpgradeLocks: {},
      abilitySeq: 0,
      sectorSeq: 0
    };
  }

  _mergeEntity(previous, next, options = {}) {
    if (!previous) return { ...next };
    if (options.preserveLocalPosition) {
      const sectorChanged = ((previous.sx | 0) !== (next.sx | 0)) || ((previous.sy | 0) !== (next.sy | 0));
      const merged = { ...previous, ...next };
      const nowPose = performance.now();
      const keepLocalPose = nowPose < (previous._keepLocalPoseUntil || 0);
      if (keepLocalPose && !previous._forceServerPose) {
        merged.x = previous.x;
        merged.y = previous.y;
        merged.sx = previous.sx;
        merged.sy = previous.sy;
        merged.vx = previous.vx;
        merged.vy = previous.vy;
        if (Number.isFinite(previous.rot)) merged.rot = previous.rot;
        if (Number.isFinite(previous._localThrust)) merged._localThrust = previous._localThrust;
        merged._serverX = next.x;
        merged._serverY = next.y;
        merged._tx = previous.x;
        merged._ty = previous.y;
        return this._applyLocalDamageToEntity(merged);
      }
      if (sectorChanged || previous._forceServerPose) {
        const now = performance.now();
        const forceServerPose = !!previous._forceServerPose;
        const recentLocalSector = !forceServerPose && now - (this.localPrediction.sectorTransitionAt || 0) < 1500;
        const expectedSx = this.localPrediction.sectorSx | 0;
        const expectedSy = this.localPrediction.sectorSy | 0;
        const serverIsOldSector = recentLocalSector && ((next.sx | 0) !== expectedSx || (next.sy | 0) !== expectedSy);
        if (serverIsOldSector && !previous._forceServerPose) {
          // Le client vient de franchir une bordure. Les snapshots précédents peuvent encore
          // contenir l'ancien secteur ; on les ignore pour éviter le ping-pong de secteur.
          merged.x = previous.x;
          merged.y = previous.y;
          merged.sx = previous.sx;
          merged.sy = previous.sy;
          merged.vx = previous.vx;
          merged.vy = previous.vy;
          merged._serverX = next.x;
          merged._serverY = next.y;
          merged._tx = previous.x;
          merged._ty = previous.y;
          return this._applyLocalDamageToEntity(merged);
        }
        if (Number.isFinite(next.x) && Number.isFinite(next.y)) {
          merged.x = recentLocalSector ? previous.x : next.x;
          merged.y = recentLocalSector ? previous.y : next.y;
          merged.sx = recentLocalSector ? previous.sx : next.sx;
          merged.sy = recentLocalSector ? previous.sy : next.sy;
          merged.vx = recentLocalSector ? previous.vx : (Number.isFinite(next.vx) ? next.vx : 0);
          merged.vy = recentLocalSector ? previous.vy : (Number.isFinite(next.vy) ? next.vy : 0);
          merged._tx = merged.x;
          merged._ty = merged.y;
          if (forceServerPose) {
            this.localPrediction.hasMoveTarget = false;
            this.localPrediction.selectedKind = '';
            this.localPrediction.selectedId = 0;
          }
        }
        merged._forceServerPose = false;
        return this._applyLocalDamageToEntity(merged);
      }
      // Pour le joueur local, les snapshots sont forcément en retard réseau.
      // On synchronise les PV/stats/etc., mais on ne rembobine plus x/y/vx/vy.
      merged.x = previous.x;
      merged.y = previous.y;
      merged.vx = previous.vx;
      merged.vy = previous.vy;
      if (Number.isFinite(previous.rot)) merged.rot = previous.rot;
      if (Number.isFinite(previous._localThrust)) merged._localThrust = previous._localThrust;
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
    const now = performance.now();
    for (const slot of ['A', 'Z', 'E', 'R']) {
      if (!out[slot] || !Number.isFinite(cooldowns[slot])) continue;
      const locked = now < (this.localPrediction.localCooldownLocks?.[slot] || 0);
      const localLeft = this.myState?.cooldowns?.[slot];
      const localHudLeft = this.myState?.abilityHud?.[slot]?.cooldownLeft;
      if (locked && (Number.isFinite(localLeft) || Number.isFinite(localHudLeft))) {
        out[slot] = { ...out[slot], cooldownLeft: Math.max(0, Number.isFinite(localLeft) ? localLeft : localHudLeft) };
      } else {
        out[slot] = { ...out[slot], cooldownLeft: Math.max(0, cooldowns[slot]) };
      }
    }
    return out;
  }

  _mergeMyState(next) {
    if (!next) return null;
    if (!next.lite || !this.myState) {
      const now = performance.now();
      const cooldowns = { ...(next.cooldowns || {}) };
      for (const slot of ['A', 'Z', 'E', 'R']) {
        if (now < (this.localPrediction.localCooldownLocks?.[slot] || 0) && Number.isFinite(this.myState.cooldowns?.[slot])) {
          cooldowns[slot] = this.myState.cooldowns[slot];
        }
      }
      const merged = {
        ...next,
        cooldowns,
        abilityHud: this._mergeAbilityHudWithCooldowns(next.abilityHud, cooldowns)
      };
      // Pendant quelques centaines de ms après un clic de level-up, on garde le HUD
      // local optimiste. Le serveur confirmera ensuite, mais le clic ne doit pas
      // sembler refusé/rollbacké à cause d'un snapshot précédent.
      for (const slot of ['A', 'Z', 'E', 'R']) {
        if (now < (this.localPrediction.localUpgradeLocks?.[slot] || 0) && this.myState.abilityHud?.[slot] && merged.abilityHud?.[slot]) {
          merged.abilityHud[slot] = { ...merged.abilityHud[slot], ...this.myState.abilityHud[slot] };
        }
      }
      if (now < Math.max(...Object.values(this.localPrediction.localUpgradeLocks || { none: 0 }))) {
        merged.progression = this.myState.progression ?? merged.progression;
      }
      return merged;
    }
    const now = performance.now();
    const cooldowns = { ...(this.myState.cooldowns || {}), ...(next.cooldowns || {}) };
    for (const slot of ['A', 'Z', 'E', 'R']) {
      if (now < (this.localPrediction.localCooldownLocks?.[slot] || 0) && Number.isFinite(this.myState.cooldowns?.[slot])) {
        cooldowns[slot] = this.myState.cooldowns[slot];
      }
    }
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

  applyChatMessage(msg) {
    if (!msg || !msg.text) return;
    const clean = {
      id: msg.id || `${Date.now()}-${Math.random()}`,
      fromId: msg.fromId | 0,
      name: String(msg.name || 'Pilote').slice(0, 24),
      text: String(msg.text || '').slice(0, 220),
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
      const base = transition.type === 'sector' ? 220 : 450;
      this.beginPortalLoading(transition.label || 'Chargement du secteur…', Math.max(base, (transition.until || msg.time || 0) - (msg.time || 0) + 90), transition.id | 0);
      const me = this.players.get(this.myId);
      if (me && transition.forceServerPose) me._forceServerPose = true;
    }
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


  _getEntityByKind(kind, id) {
    if (!kind || !id) return null;
    if (kind === 'player') return this.players.get(id) || null;
    if (kind === 'mob') return this.mobs.get(id) || null;
    if (kind === 'asteroid') return this.asteroids.get(id) || null;
    if (kind === 'station') return this.stations.get(id) || null;
    return null;
  }

  _distancePointToSegmentSq(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const lenSq = abx * abx + aby * aby;
    if (lenSq <= 0.000001) {
      const dx = px - bx;
      const dy = py - by;
      return dx * dx + dy * dy;
    }
    const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
    const x = ax + abx * t;
    const y = ay + aby * t;
    const dx = px - x;
    const dy = py - y;
    return dx * dx + dy * dy;
  }

  _spawnLocalImpact(projectile, target) {
    const x = Number.isFinite(target?.x) ? target.x : projectile.x;
    const y = Number.isFinite(target?.y) ? target.y : projectile.y;
    this.pendingCombatFx.push({
      type: 'impact',
      x,
      y,
      targetId: target?.id ?? 0,
      visualKind: projectile.visualKind || 'auto',
      sourceSlot: projectile.sourceAbilitySlot || '',
      localOnly: true
    });
  }

  _updateLocalProjectile(projectile, dt) {
    const oldX = projectile.x;
    const oldY = projectile.y;
    projectile.x += (projectile.vx || 0) * dt;
    projectile.y += (projectile.vy || 0) * dt;
    projectile.ttl = Math.max(0, (projectile.ttl ?? 0) - dt);

    const target = this._getEntityByKind(projectile._targetKind, projectile._targetId);
    if (target && ((target.sx | 0) === (projectile.sx | 0)) && ((target.sy | 0) === (projectile.sy | 0))) {
      const r = Math.max(projectile._impactRadius || 0, (projectile.radius || 3) + (target.radius || 18) + 10);
      const d2 = this._distancePointToSegmentSq(target.x, target.y, oldX, oldY, projectile.x, projectile.y);
      if (d2 <= r * r) {
        projectile.x = target.x;
        projectile.y = target.y;
        if (!projectile._impactApplied && !projectile._visualOnly && projectile._impactDamage > 0 && projectile._targetKind !== 'station') {
          this.applyLocalDamage(projectile._targetKind, projectile._targetId, projectile._impactDamage, target.x, target.y);
          projectile._impactApplied = true;
        }
        this._spawnLocalImpact(projectile, target);
        return false;
      }

      // Visuel aim-lock : tant que la cible existe, les tirs locaux se recalibrent légèrement
      // vers sa position actuelle. Cela évite l'impression que le laser traverse à côté de la cible
      // quand le snapshot serveur arrive en retard ou que la cible a bougé entre deux frames.
      const speed = Math.max(1, Math.hypot(projectile.vx || 0, projectile.vy || 0));
      const desiredX = target.x - projectile.x;
      const desiredY = target.y - projectile.y;
      const desiredLen = Math.hypot(desiredX, desiredY);
      if (desiredLen > 0.001) {
        const blend = Math.min(0.35, Math.max(0.04, dt * 7));
        const nvx = ((projectile.vx || 0) * (1 - blend)) + (desiredX / desiredLen) * speed * blend;
        const nvy = ((projectile.vy || 0) * (1 - blend)) + (desiredY / desiredLen) * speed * blend;
        projectile.vx = nvx;
        projectile.vy = nvy;
      }
    }

    return projectile.ttl > 0;
  }

  _smoothMap(map, alpha, dt = 0) {
    for (const entity of [...map.values()]) {
      if (entity.localOnly) {
        const keep = entity.kind === 'projectile' || map === this.projectiles
          ? this._updateLocalProjectile(entity, dt)
          : (() => {
              entity.x += (entity.vx || 0) * dt;
              entity.y += (entity.vy || 0) * dt;
              entity.ttl = Math.max(0, (entity.ttl ?? 0) - dt);
              return entity.ttl > 0;
            })();
        if (!keep) { map.delete(entity.id); continue; }
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

  noteLocalAbilityCast(slot, cooldownLeft = 0) {
    if (!slot || !this.myState) return;
    const s = String(slot).toUpperCase();
    if (!['A', 'Z', 'E', 'R'].includes(s)) return;
    const now = performance.now();
    this.localPrediction.abilitySeq = (this.localPrediction.abilitySeq | 0) + 1;
    this.localPrediction.localCooldownLocks[s] = now + 900;
    if (!this.myState.cooldowns) this.myState.cooldowns = {};
    if (Number.isFinite(cooldownLeft)) this.myState.cooldowns[s] = Math.max(0, cooldownLeft);
    if (this.myState.abilityHud?.[s] && Number.isFinite(cooldownLeft)) {
      this.myState.abilityHud[s].cooldownLeft = Math.max(0, cooldownLeft);
    }
  }

  upgradeAbilityLocal(slot) {
    const s = String(slot || '').toUpperCase();
    if (!['A', 'Z', 'E', 'R'].includes(s) || !this.myState?.progression || !this.myState?.abilityHud?.[s]) return false;
    const hud = this.myState.abilityHud[s];
    if (hud.canUpgrade === false) return false;
    const prog = this.myState.progression;
    if ((prog.skillPoints ?? 0) <= 0) return false;
    const max = s === 'R' ? 5 : 15;
    const current = Math.max(0, hud.investedLevel | 0);
    if (current >= max) return false;
    prog.skillPoints = Math.max(0, (prog.skillPoints | 0) - 1);
    hud.investedLevel = current + 1;
    hud.unlocked = hud.investedLevel > 0;
    hud.phase = s === 'R' ? hud.investedLevel : (hud.investedLevel >= 15 ? 5 : hud.investedLevel >= 10 ? 4 : hud.investedLevel >= 6 ? 3 : hud.investedLevel >= 3 ? 2 : 1);
    hud.canUpgrade = prog.skillPoints > 0 && hud.investedLevel < max;
    this.localPrediction.localUpgradeLocks[s] = performance.now() + 1200;
    this.myState.hint = `${s} niveau ${hud.investedLevel}`;
    this.myState._optimisticHintLeft = 0.55;
    return true;
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

  noteLocalSectorTransition(sx, sy, x, y, options = {}) {
    this.localPrediction.sectorTransitionAt = performance.now();
    this.localPrediction.sectorSx = sx | 0;
    this.localPrediction.sectorSy = sy | 0;
    this.localPrediction.sectorX = Number.isFinite(x) ? x : 0;
    this.localPrediction.sectorY = Number.isFinite(y) ? y : 0;
    // Les cibles et l'ancien ordre de déplacement deviennent obsolètes.
    // La position de spawn doit rester relative à la frontière, sans déplacement
    // automatique qui ramène ensuite le vaisseau vers l'ancien clic.
    this.localPrediction.selectedKind = '';
    this.localPrediction.selectedId = 0;
    this.localPrediction.hasMoveTarget = false;
    this.localPrediction.hold = false;
    this.localPrediction.moveX = this.localPrediction.sectorX;
    this.localPrediction.moveY = this.localPrediction.sectorY;
  }


  beginPortalLoading(label = 'Chargement du secteur…', durationMs = 650, transitionId = 0) {
    const now = performance.now();
    const id = transitionId | 0;
    if (id && id === (this.localPrediction.remoteTransitionId | 0) && now < (this.localPrediction.loadingUntil || 0)) return;
    if (id) this.localPrediction.remoteTransitionId = id;
    this.localPrediction.loadingLabel = String(label || 'Chargement du secteur…');
    this.localPrediction.loadingUntil = Math.max(this.localPrediction.loadingUntil || 0, now + Math.max(180, durationMs));
  }

  getLoadingState() {
    const now = performance.now();
    const until = this.localPrediction.loadingUntil || 0;
    if (now >= until) return { active: false, label: '' };
    return { active: true, label: this.localPrediction.loadingLabel || 'Chargement du secteur…', leftMs: until - now };
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
