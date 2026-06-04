import { NetworkEventDeduper } from '../net/NetworkEventDeduper.js';
import { EntityInterpolationStore } from './EntityInterpolationStore.js';


function isSnapshotDrivenLogisticAutomation(entity) {
  const kind = String(entity?.automationKind || '').toLowerCase();
  return kind === 'conveyor' || kind === 'robot_arm';
}

function statusIdOf(entry) {
  return String(entry?.id || entry?.effectId || entry?.type || '').toLowerCase();
}

function hasAuthoritativeControlStatus(entity) {
  const statuses = Array.isArray(entity?.statuses) ? entity.statuses : [];
  for (const st of statuses) {
    const id = statusIdOf(st);
    if (
      id === 'taunt' || id === 'charm' || id === 'fear' || id === 'stun' || id === 'suppress' ||
      id === 'sleep' || id === 'stasis' || id === 'knockup' || id === 'knockback' || id === 'pull' ||
      id === 'bump'
    ) return true;
  }
  return false;
}

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
    this.structures = new Map();
    this.automationVisuals = new Map();
    this.logisticTransferVisuals = new Map();
    this.logisticTransferEventIds = new Set();
    this.logisticTransferEventOrder = [];
    this.logisticCompletedVisualItems = new Map();
    this.portals = new Map();
    this.projectiles = new Map();
    this.projectileEventIds = new Set();
    this.projectileEventOrder = [];
    this.projectileEventTombstones = new Map();
    this.logisticDrones = new Map();
    this.areaEffects = new Map();
    this.loots = new Map();
    this.pendingSfx = [];
    this.pendingCombatFx = [];
    this.pendingProjectileImpacts = [];
    this.networkEvents = [];
    this.typedCombatEvents = [];
    this.abilityProtocolEvents = [];
    this.statusEvents = [];
    this.passiveEvents = [];
    this.eventDrivenHudStats = {
      abilityUpdates: 0,
      abilityRejects: 0,
      damageUpdates: 0,
      statusUpdates: 0,
      passiveUpdates: 0,
      lastAbilityReject: null,
      lastDamageAt: 0,
      lastStatusAt: 0,
      lastPassiveAt: 0
    };
    this.eventDeduper = new NetworkEventDeduper();
    this.chatMessages = [];
    this.chatUnread = 0;
    this.pendingCommands = new Map();
    this.pendingStationCommands = new Map();
    this.stationOptimistic = { version: 0, actions: new Map() };
    this.netStats = null;
    this.networkClock = null;
    this.inputHistory = null;
    this.softReconciliation = {
      enabled: true,
      smallThreshold: 10,
      softThreshold: 95,
      hardThreshold: 420,
      minApply: 0.08,
      maxApply: 0.34
    };
    this.interpolationStore = new EntityInterpolationStore();
    this.lastSnapAt = 0;
    this.lastServerTime = 0;
    this.lastServerTimeAt = 0;
    this.localPrediction = {
      hasMoveTarget: false,
      moveX: 0,
      moveY: 0,
      hold: false,
      selectedKind: '',
      selectedId: 0,
      selectedAt: 0,
      selectedUntil: 0,
      attackKind: '',
      attackId: 0,
      attackAt: 0,
      attackUntil: 0,
      attackSeq: 0,
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
      localAbilityReadyAt: {},
      localAbilityLastCastAt: {},
      abilityMovementLockUntil: 0,
      localUpgradeLocks: {},
      abilitySeq: 0,
      sectorSeq: 0,
      localAbilityAuthorityUntil: 0,
      localFrameState: null,
      localDerived: null,
      localPassiveAuthorityUntil: 0,
      localPassiveEventSeq: 0,
      pendingStructureMoves: new Map()
    };
  }


  setNetStats(netStats) {
    this.netStats = netStats || null;
    this.netStats?.setInterpolationStore?.(this.interpolationStore);
    this.netStats?.setEventDeduper?.(this.eventDeduper);
    this.netStats?.setEventDrivenHudSource?.(this);
  }

  setNetworkClock(clock) {
    this.networkClock = clock || null;
  }

  setInputHistory(inputHistory) {
    this.inputHistory = inputHistory || null;
  }

  getInputReconciliationStats() {
    return this.inputHistory?.stats?.() || null;
  }

  getEventDrivenHudStats() {
    return { ...(this.eventDrivenHudStats || {}) };
  }

  getEntityByEventTarget(kind, id) {
    const targetId = id | 0;
    if (!targetId) return null;
    const k = String(kind || '').toLowerCase();
    if (targetId === (this.myId | 0) || k === 'self') return this.getMe() || this.players.get(targetId) || null;
    if (k === 'player') return this.players.get(targetId) || null;
    if (k === 'mob') return this.mobs.get(targetId) || null;
    if (k === 'structure') return this.structures.get(targetId) || null;
    return this.players.get(targetId) || this.mobs.get(targetId) || this.structures.get(targetId) || null;
  }

  setAbilityCooldownFromEvent(slot, cooldownSec = 0, payload = {}) {
    const s = String(slot || '').toUpperCase();
    if (!['A', 'Z', 'E', 'R'].includes(s)) return;
    const cd = Math.max(0, Number(cooldownSec) || 0);
    if (!this.myState) return;
    if (!this.myState.cooldowns) this.myState.cooldowns = {};
    this.myState.cooldowns[s] = cd;
    if (this.myState.abilityHud?.[s]) {
      this.myState.abilityHud[s] = {
        ...this.myState.abilityHud[s],
        cooldownLeft: cd
      };
    }
    if (Number.isFinite(Number(payload.energyLeft))) {
      if (this.myState.stats) this.myState.stats.energy = Math.max(0, Number(payload.energyLeft));
      if (this.myState.vitals) this.myState.vitals.energy = Math.max(0, Number(payload.energyLeft));
      const me = this.getMe();
      if (me?.vitals) me.vitals.energy = Math.max(0, Number(payload.energyLeft));
    }
    this.eventDrivenHudStats.abilityUpdates += 1;
  }

  applyStatusAppliedEvent(ev) {
    const payload = ev?.payload || {};
    const target = this.getEntityByEventTarget(payload.targetKind, payload.targetId);
    if (!target) return;
    const effectId = String(payload.effectId || payload.key || '').trim();
    if (!effectId) return;
    const now = performance.now();
    const duration = Math.max(0, Number(payload.duration || 0));
    const status = {
      id: effectId,
      effectId,
      key: payload.key || effectId,
      label: payload.label || effectId,
      duration,
      durationLeft: duration,
      value: Number(payload.value || 0),
      stacks: Math.max(1, Number(payload.stacks || 1)),
      hostile: !!payload.hostile,
      refreshed: !!payload.refreshed,
      _eventDriven: true,
      _eventAt: now
    };
    const list = Array.isArray(target.statuses) ? [...target.statuses] : [];
    const idx = list.findIndex((st) => String(st?.effectId || st?.id || st?.key || '') === effectId || String(st?.key || '') === status.key);
    if (idx >= 0) list[idx] = { ...list[idx], ...status };
    else list.push(status);
    target.statuses = list;

    if ((payload.targetId | 0) === (this.myId | 0) && this.myState) {
      this.myState.statuses = list;
    }
    this.eventDrivenHudStats.statusUpdates += 1;
    this.eventDrivenHudStats.lastStatusAt = now;
  }

  applyPassiveChangedEvent(ev) {
    const payload = ev?.payload || {};
    const playerId = payload.playerId | 0;
    const target = (playerId && playerId !== (this.myId | 0)) ? this.players.get(playerId) : (this.getMe() || this.players.get(this.myId));
    if (!target) return;
    const now = performance.now();
    const fs = { ...(target.frameState || this.myState?.frameState || {}) };
    const passiveId = String(payload.passiveId || '').toLowerCase();

    if (passiveId === 'vanguard.heat') {
      fs.kind = fs.kind || 'vanguard';
      if (Number.isFinite(Number(payload.stacks))) fs.passiveStacks = Number(payload.stacks);
      if (Number.isFinite(Number(payload.maxStacks))) fs.passiveMaxStacks = Number(payload.maxStacks);
      fs.passiveDecaying = false;
      fs._eventDrivenReason = payload.reason || 'passive.changed';
      fs._eventDrivenAt = now;
    } else if (passiveId === 'bulwark.plates') {
      fs.kind = fs.kind || 'bulwark';
      const plates = Number(payload.plates);
      if (Number.isFinite(plates)) {
        fs.passiveStacks = plates;
        fs.plateCount = plates;
        fs.plates = plates;
      }
      if (Number.isFinite(Number(payload.maxPlates))) fs.passiveMaxStacks = Number(payload.maxPlates);
      fs._eventDrivenReason = payload.reason || 'passive.changed';
      fs._eventDrivenAt = now;
    } else {
      fs._eventDrivenReason = payload.reason || passiveId || 'passive.changed';
      fs._eventDrivenAt = now;
      for (const [key, value] of Object.entries(payload)) {
        if (['playerId', 'frameId', 'passiveId'].includes(key)) continue;
        if (Number.isFinite(Number(value)) || typeof value === 'boolean' || typeof value === 'string') fs[key] = value;
      }
    }

    target.frameState = fs;
    if ((playerId | 0) === (this.myId | 0) || !playerId) {
      this.myState = { ...(this.myState || {}), frameState: fs };
      this.localPrediction.localFrameState = { ...(this.localPrediction.localFrameState || {}), ...fs };
      this.localPrediction.localPassiveAuthorityUntil = Math.max(this.localPrediction.localPassiveAuthorityUntil || 0, now + 650);
    }
    this.eventDrivenHudStats.passiveUpdates += 1;
    this.eventDrivenHudStats.lastPassiveAt = now;
  }

  applyDamageAppliedEvent(ev) {
    const payload = ev?.payload || {};
    const target = this.getEntityByEventTarget(payload.targetKind, payload.targetId);
    if (!target?.vitals) return;
    const amount = Math.max(0, Number(payload.amount || 0));
    if (amount <= 0) return;
    const now = performance.now();
    const vitals = { ...target.vitals };
    const shield = Math.max(0, Number(vitals.shield || 0));
    const hp = Math.max(0, Number(vitals.hp ?? vitals.health ?? 0));
    if (payload.shielded && shield > 0) {
      vitals.shield = Math.max(0, shield - amount);
    } else if (shield > 0) {
      const left = Math.max(0, amount - shield);
      vitals.shield = Math.max(0, shield - amount);
      vitals.hp = Math.max(0, hp - left);
    } else {
      vitals.hp = Math.max(0, hp - amount);
    }
    vitals._eventDrivenDamageAt = now;
    target.vitals = vitals;

    if ((payload.targetId | 0) === (this.myId | 0) && this.myState?.vitals) {
      this.myState.vitals = { ...this.myState.vitals, ...vitals };
    }
    this.eventDrivenHudStats.damageUpdates += 1;
    this.eventDrivenHudStats.lastDamageAt = now;
  }

  syncLocalAbilityCooldownAuthority(myState = this.myState) {
    if (!myState?.cooldowns || !this.localPrediction) return;
    const now = performance.now();
    for (const slot of ['A', 'Z', 'E', 'R']) {
      const serverCd = Number(myState.cooldowns?.[slot]);
      const hudCd = Number(myState.abilityHud?.[slot]?.cooldownLeft);
      const authoritativeCd = Number.isFinite(serverCd) ? serverCd : hudCd;
      if (!Number.isFinite(authoritativeCd)) continue;
      const lastCast = this.localPrediction.localAbilityLastCastAt?.[slot] || 0;
      const recentLocalCast = lastCast > 0 && now - lastCast < 420;
      if (authoritativeCd <= 0.03 && !recentLocalCast) {
        if (this.localPrediction.localAbilityReadyAt) this.localPrediction.localAbilityReadyAt[slot] = 0;
        if (this.localPrediction.localAbilityLastCastAt) this.localPrediction.localAbilityLastCastAt[slot] = 0;
        if (this.localPrediction.localCooldownLocks) this.localPrediction.localCooldownLocks[slot] = 0;
        if (this.localPrediction.lastAbilityReject?.slot === slot) this.localPrediction.lastAbilityReject = null;
      }
    }
  }

  _acceptLogisticTransferEvent(ev) {
    const id = ev?.id | 0;
    if (!id) return true;
    const key = `logistic:${id}`;
    if (!this.logisticTransferEventIds) this.logisticTransferEventIds = new Set();
    if (!this.logisticTransferEventOrder) this.logisticTransferEventOrder = [];
    if (this.logisticTransferEventIds.has(key)) return false;
    this.logisticTransferEventIds.add(key);
    this.logisticTransferEventOrder.push(key);
    while (this.logisticTransferEventOrder.length > 2048) {
      const old = this.logisticTransferEventOrder.shift();
      if (old) this.logisticTransferEventIds.delete(old);
    }
    return true;
  }

  _acceptProjectileEvent(ev) {
    const id = ev?.id | 0;
    if (!id) return true;
    const key = `projectile:${id}`;
    if (!this.projectileEventIds) this.projectileEventIds = new Set();
    if (!this.projectileEventOrder) this.projectileEventOrder = [];
    if (this.projectileEventIds.has(key)) return false;
    this.projectileEventIds.add(key);
    this.projectileEventOrder.push(key);
    while (this.projectileEventOrder.length > 4096) {
      const old = this.projectileEventOrder.shift();
      if (old) this.projectileEventIds.delete(old);
    }
    return true;
  }

  applyProjectileEvents(events = []) {
    if (!Array.isArray(events) || !events.length) return;
    if (!(this.projectileEventTombstones instanceof Map)) this.projectileEventTombstones = new Map();

    const now = performance.now();
    const ordered = events
      .filter((ev) => ev && this._acceptProjectileEvent(ev))
      .sort((a, b) => (Number(a.serverTime || 0) - Number(b.serverTime || 0)) || ((a.id | 0) - (b.id | 0)));

    for (const ev of ordered) {
      const action = String(ev.action || '').toLowerCase();
      const projectileId = ev.projectileId | 0;
      if (!projectileId) continue;

      if (action === 'spawn') {
        const tombstoneUntil = Number(this.projectileEventTombstones.get(projectileId) || 0);
        if (tombstoneUntil > now) continue;

        const projectile = ev.projectile || null;
        if (!projectile) continue;
        const current = this.projectiles.get(projectileId) || {};
        const spawnX = Number(projectile.x) || 0;
        const spawnY = Number(projectile.y) || 0;
        const serverNow = this._estimateServerNow();
        const eventServerTime = Number(ev.serverTime || 0) || this.lastServerTime || Date.now();
        const elapsedMs = Math.max(0, Math.min(1200, serverNow - eventServerTime));
        const next = {
          ...current,
          ...projectile,
          id: projectileId,
          kind: 'projectile',
          x: spawnX,
          y: spawnY,
          _tx: spawnX,
          _ty: spawnY,
          _serverX: spawnX,
          _serverY: spawnY,
          _packetSpawnLocalAt: performance.now() - elapsedMs,
          _packetStartX: spawnX,
          _packetStartY: spawnY,
          _packetServerTime: eventServerTime
        };
        this.projectiles.set(projectileId, next);
        this.interpolationStore?.pushMany?.('projectile', [next], Number(ev.serverTime || this.lastServerTime || Date.now()));
        continue;
      }

      if (action === 'impact' || action === 'destroy') {
        this.projectileEventTombstones.set(projectileId, now + 2500);
        this.projectiles.delete(projectileId);
        if (action === 'impact') {
          this.pendingProjectileImpacts.push({
            projectileId,
            x: Number(ev.x || ev.projectile?.x || 0),
            y: Number(ev.y || ev.projectile?.y || 0),
            targetId: ev.target?.id | 0,
            targetKind: ev.target?.kind || '',
            projectile: ev.projectile || null,
            visualKind: ev.impact?.visualKind || ev.projectile?.visualKind || '',
            sourceSlot: ev.impact?.sourceAbilitySlot || ev.projectile?.sourceAbilitySlot || '',
            sourceAbilitySlot: ev.impact?.sourceAbilitySlot || ev.projectile?.sourceAbilitySlot || '',
            sourceFrameId: ev.projectile?.sourceFrameId || '',
            visualSlot: ev.projectile?.visualSlot || ev.impact?.sourceAbilitySlot || '',
            splashRadius: Number(ev.impact?.splashRadius || ev.projectile?.splashRadius || 0),
            radius: Number(ev.projectile?.radius || 3),
            crit: !!ev.impact?.crit,
            serverTime: Number(ev.serverTime || 0)
          });
        }
      }
    }
  }

  pruneProjectileEventState(now = performance.now()) {
    if (!(this.projectileEventTombstones instanceof Map) || !this.projectileEventTombstones.size) return;
    for (const [id, until] of this.projectileEventTombstones.entries()) {
      if (now > Number(until || 0)) this.projectileEventTombstones.delete(id);
    }
  }

  applyLogisticTransferEvents(events = []) {
    if (!Array.isArray(events) || !events.length) return;
    if (!(this.logisticTransferVisuals instanceof Map)) this.logisticTransferVisuals = new Map();
    if (!(this.logisticCompletedVisualItems instanceof Map)) this.logisticCompletedVisualItems = new Map();

    const now = performance.now();
    const serverNow = this._estimateServerNow();
    const ordered = events
      .filter((ev) => ev && this._acceptLogisticTransferEvent(ev))
      .sort((a, b) => (Number(a.serverTime || 0) - Number(b.serverTime || 0)) || ((a.id | 0) - (b.id | 0)));

    for (const ev of ordered) {
      const visualItemId = ev.visualItemId | 0;
      if (!visualItemId) continue;

      const action = String(ev.action || '').toLowerCase();
      const totalMs = Math.max(80, Number(ev.totalMs || 0) || 500);
      const elapsed = Math.max(0, serverNow - Number(ev.serverTime || serverNow));
      const localStartedAt = now - Math.min(totalMs, elapsed);

      if (action === 'conveyor_enter' || action === 'arm_pickup') {
        const completedUntil = Number(this.logisticCompletedVisualItems.get(visualItemId) || 0);
        if (completedUntil > now) continue;

        const existing = this.logisticTransferVisuals.get(visualItemId);
        if (existing && !existing._finished) {
          existing.exitEvent = existing.exitEvent || null;
          existing._localUntil = Math.max(existing._localUntil || 0, localStartedAt + totalMs + 120);
          this.logisticTransferVisuals.set(visualItemId, existing);
          continue;
        }

        this.logisticTransferVisuals.set(visualItemId, {
          ...ev,
          visualItemId,
          action,
          totalMs,
          _localStartedAt: localStartedAt,
          _localUntil: localStartedAt + totalMs + 120,
          _finished: false
        });
        continue;
      }

      if (action === 'conveyor_exit' || action === 'arm_drop') {
        const existing = this.logisticTransferVisuals.get(visualItemId);
        this.logisticCompletedVisualItems.set(visualItemId, now + 5000);

        if (!existing) {
          // Important : un packet de sortie reçu sans entrée active ne doit jamais créer
          // un résidu visuel en bout de tapis. Il sert uniquement à empêcher un vieux
          // enter en retard de relancer l'animation.
          continue;
        }

        if (action === 'arm_drop') {
          // Même logique que les tapis : l'animation active reste celle du pickup.
          // Le drop confirme seulement que le serveur a validé la dépose.
          existing.exitEvent = ev;
          existing._serverDropReceived = true;
          this.logisticTransferVisuals.set(visualItemId, existing);
          continue;
        }

        existing._localUntil = Math.min(existing._localUntil || now, now + 35);
        existing._finished = true;
        existing.exitEvent = ev;
        this.logisticTransferVisuals.set(visualItemId, existing);
      }
    }

    while (this.logisticTransferVisuals.size > 512) {
      const first = this.logisticTransferVisuals.keys().next().value;
      this.logisticTransferVisuals.delete(first);
    }
  }

  pruneLogisticTransferVisuals(now = performance.now()) {
    if (this.logisticTransferVisuals instanceof Map && this.logisticTransferVisuals.size) {
      for (const [id, ev] of this.logisticTransferVisuals.entries()) {
        if (now > Number(ev._localUntil || 0)) this.logisticTransferVisuals.delete(id);
      }
    }
    if (this.logisticCompletedVisualItems instanceof Map && this.logisticCompletedVisualItems.size) {
      for (const [id, until] of this.logisticCompletedVisualItems.entries()) {
        if (now > Number(until || 0)) this.logisticCompletedVisualItems.delete(id);
      }
    }
  }

  applyNetworkEvents(events = []) {
    const accepted = this.eventDeduper.filter(events);
    if (!accepted.length) return;
    this.networkEvents.push(...accepted);
    if (this.networkEvents.length > 512) this.networkEvents.splice(0, this.networkEvents.length - 512);

    for (const ev of accepted) {
      if (ev.type === 'sfx.world' && ev.payload) {
        this.pendingSfx.push({
          type: ev.payload.sfxType,
          sx: ev.sx | 0,
          sy: ev.sy | 0,
          x: ev.x,
          y: ev.y,
          variant: ev.payload.variant | 0,
          frameId: ev.payload.frameId || '',
          slot: ev.payload.slot || '',
          sourceKind: ev.payload.sourceKind || '',
          mobProfile: ev.payload.mobProfile || '',
          mobId: ev.payload.mobId || '',
          visualKind: ev.payload.visualKind || ''
        });
      } else if (ev.type === 'sfx.player' && ev.payload) {
        this.pendingSfx.push({
          type: ev.payload.sfxType,
          variant: ev.payload.variant | 0,
          resourceKey: ev.payload.resourceKey || '',
          itemId: ev.payload.itemId || '',
          group: ev.payload.group || ''
        });
      } else if (String(ev.type || '').startsWith('combat.')) {
        this.pendingCombatFx.push(ev.payload || ev);
      }

      if (
        ev.type === 'ability.cast' ||
        ev.type === 'ability.request' ||
        ev.type === 'ability.accepted' ||
        ev.type === 'ability.rejected' ||
        ev.type === 'ability.cooldown' ||
        ev.type === 'projectile.spawn' ||
        ev.type === 'projectile.impact' ||
        ev.type === 'damage.applied' ||
        ev.type === 'structure.state' ||
        ev.type === 'status.applied' ||
        ev.type === 'passive.changed'
      ) {
        this.typedCombatEvents.push(ev);
        if (String(ev.type || '').startsWith('ability.')) {
          this.abilityProtocolEvents.push(ev);
          this.applyAbilityProtocolEvent(ev);
        } else if (ev.type === 'damage.applied') {
          this.applyDamageAppliedEvent(ev);
        } else if (ev.type === 'status.applied') {
          this.statusEvents.push(ev);
          this.applyStatusAppliedEvent(ev);
        } else if (ev.type === 'passive.changed') {
          this.passiveEvents.push(ev);
          this.applyPassiveChangedEvent(ev);
        }
      }
    }
    if (this.typedCombatEvents.length > 512) this.typedCombatEvents.splice(0, this.typedCombatEvents.length - 512);
    if (this.abilityProtocolEvents.length > 256) this.abilityProtocolEvents.splice(0, this.abilityProtocolEvents.length - 256);
    if (this.statusEvents.length > 256) this.statusEvents.splice(0, this.statusEvents.length - 256);
    if (this.passiveEvents.length > 256) this.passiveEvents.splice(0, this.passiveEvents.length - 256);
  }

  applyAbilityProtocolEvent(ev) {
    const payload = ev?.payload || {};
    const slot = String(payload.slot || '').toUpperCase();
    if (!slot || !this.localPrediction) return;
    const now = performance.now();

    if (ev.type === 'ability.rejected') {
      const cooldownMs = Math.max(0, Number(payload.cooldownLeft || 0) * 1000);
      this.setAbilityCooldownFromEvent(slot, cooldownMs / 1000, payload);
      if (this.localPrediction.localAbilityReadyAt) this.localPrediction.localAbilityReadyAt[slot] = cooldownMs > 30 ? now + cooldownMs : 0;
      if (this.localPrediction.localAbilityLastCastAt) this.localPrediction.localAbilityLastCastAt[slot] = 0;
      if (this.localPrediction.localCooldownLocks) this.localPrediction.localCooldownLocks[slot] = cooldownMs > 30 ? now + Math.min(500, cooldownMs) : 0;
      this.localPrediction.localAbilityAuthorityUntil = Math.min(this.localPrediction.localAbilityAuthorityUntil || 0, now + 120);
      this.localPrediction.abilityMovementLockUntil = Math.min(this.localPrediction.abilityMovementLockUntil || 0, now + 120);
      this.localPrediction.lastAbilityReject = {
        slot,
        seq: payload.seq | 0,
        reason: payload.reason || 'server_rejected',
        cooldownMs,
        at: now
      };
      this.eventDrivenHudStats.abilityRejects += 1;
      this.eventDrivenHudStats.lastAbilityReject = this.localPrediction.lastAbilityReject;
      if (this.myState) {
        this.myState.lastAbilityReject = this.localPrediction.lastAbilityReject;
        this.myState._lastAbilityRejectLeft = 1.15;
        if (payload.reason && payload.reason !== 'cooldown' && payload.reason !== 'cooldown_after_local_pose') this.myState.hint = `${slot}: ${payload.reason}`;
      }
      return;
    }

    if (ev.type === 'ability.accepted' || ev.type === 'ability.cooldown') {
      const cooldownMs = Math.max(0, Number(payload.cooldownLeft || 0) * 1000);
      this.setAbilityCooldownFromEvent(slot, cooldownMs / 1000, payload);
      if (this.localPrediction.localAbilityReadyAt) this.localPrediction.localAbilityReadyAt[slot] = cooldownMs > 30 ? now + cooldownMs : 0;
      if (cooldownMs <= 30 && this.localPrediction.localAbilityLastCastAt) this.localPrediction.localAbilityLastCastAt[slot] = 0;
      this.localPrediction.lastAbilityAccept = {
        slot,
        seq: payload.seq | 0,
        cooldownMs,
        at: now
      };
    }
  }

  getRenderServerTimeMs() {
    return this.networkClock?.renderServerTimeMs?.() || this.lastServerTime || Date.now();
  }

  getEstimatedServerNowMs() {
    return this.networkClock?.estimatedServerNowMs?.() || this.lastServerTime || Date.now();
  }

  getRemotePlayerRenderServerTimeMs() {
    const clock = this.networkClock?.snapshot?.() || null;
    const delay = Math.max(38, Math.min(72, Number(clock?.interpolationDelayMs || 120) * 0.45));
    return this.getEstimatedServerNowMs() - delay;
  }

  sampleInterpolatedEntity(kind, entity, options = {}) {
    if (!entity?.id || !this.interpolationStore) return entity;
    if (options.skipLocal && (entity.id | 0) === (this.myId | 0)) return entity;
    const renderTime = Number.isFinite(Number(options.renderTimeMs)) ? Number(options.renderTimeMs) : this.getRenderServerTimeMs();
    const sampled = this.interpolationStore.sample(kind, entity.id, renderTime, options);
    if (!sampled) return entity;
    return { ...entity, ...sampled, _interpolated: true };
  }

  getRenderPlayers() {
    const out = [];
    const remotePlayerRenderTime = this.getRemotePlayerRenderServerTimeMs();
    for (const p of this.players.values()) {
      if ((p.id | 0) === (this.myId | 0)) out.push(p);
      else out.push(this.sampleInterpolatedEntity('player', p, {
        renderTimeMs: remotePlayerRenderTime,
        maxExtrapolateMs: 95,
        remotePlayerLowLatency: true
      }));
    }
    return out;
  }

  getRenderMobs() {
    const out = [];
    for (const mob of this.mobs.values()) out.push(this.sampleInterpolatedEntity('mob', mob, { maxExtrapolateMs: 110 }));
    return out;
  }

  sampleLocalPacketProjectile(projectile) {
    if (!projectile?._packetSpawnLocalAt) return projectile;
    const now = performance.now();
    const dt = Math.max(0, (now - Number(projectile._packetSpawnLocalAt || now)) / 1000);
    const x0 = Number(projectile._packetStartX);
    const y0 = Number(projectile._packetStartY);
    const vx = Number(projectile.vx || 0);
    const vy = Number(projectile.vy || 0);
    if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(vx) || !Number.isFinite(vy)) return projectile;

    const maxLifetimeMs = Math.max(0, Number(projectile.maxLifetimeMs || 0) || 0);
    const bornAt = Number(projectile.bornAt || 0);
    const serverNow = this._estimateServerNow();
    if (maxLifetimeMs > 0 && bornAt > 0 && serverNow - bornAt > maxLifetimeMs + 250) return null;

    return {
      ...projectile,
      x: x0 + vx * dt,
      y: y0 + vy * dt,
      _packetLocal: true
    };
  }

  getRenderProjectiles() {
    const out = [];
    const projectileRenderTime = this.getEstimatedServerNowMs();
    const stalePacketIds = [];
    for (const projectile of this.projectiles.values()) {
      if (projectile?._packetSpawnLocalAt) {
        const sampled = this.sampleLocalPacketProjectile(projectile);
        if (sampled) out.push(sampled);
        else stalePacketIds.push(projectile.id | 0);
        continue;
      }
      out.push(this.sampleInterpolatedEntity('projectile', projectile, {
        renderTimeMs: projectileRenderTime,
        maxExtrapolateMs: 180,
        projectileLowLatency: true
      }));
    }
    for (const id of stalePacketIds) if (id) this.projectiles.delete(id);
    return out;
  }

  _structureMoveKey(id) {
    return Number(id) | 0;
  }

  applyOptimisticStructureMove(structureId, patch = {}) {
    const id = this._structureMoveKey(structureId);
    if (!id || !this.structures.has(id)) return false;
    const st = this.structures.get(id);
    const before = {
      x: Number(st.x) || 0,
      y: Number(st.y) || 0,
      orientation: st.orientation || 'h',
      w: Number(st.w) || 0,
      h: Number(st.h) || 0
    };
    const x = Number(patch.x);
    const y = Number(patch.y);
    const orientation = String(patch.orientation || st.orientation || 'h').toLowerCase();
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const next = {
      ...st,
      x,
      y,
      _tx: x,
      _ty: y,
      _serverX: x,
      _serverY: y,
      _snapDistanceSq: 0,
      orientation
    };
    if (Number.isFinite(Number(patch.w)) && Number(patch.w) > 0) next.w = Number(patch.w);
    if (Number.isFinite(Number(patch.h)) && Number(patch.h) > 0) next.h = Number(patch.h);
    if (Number.isFinite(next.w) && Number.isFinite(next.h)) next.radius = Math.max(next.w, next.h) * 0.5;
    this.structures.set(id, next);
    this.localPrediction.pendingStructureMoves.set(id, {
      id,
      before,
      target: { x, y, orientation, w: next.w, h: next.h },
      at: performance.now(),
      until: performance.now() + 3000
    });
    return true;
  }

  _rollbackOptimisticStructureMove(id) {
    const key = this._structureMoveKey(id);
    const pending = this.localPrediction.pendingStructureMoves?.get(key);
    if (!pending || !this.structures.has(key)) return false;
    const st = this.structures.get(key);
    const before = pending.before || null;
    if (!before) return false;
    this.structures.set(key, {
      ...st,
      x: before.x,
      y: before.y,
      _tx: before.x,
      _ty: before.y,
      _serverX: before.x,
      _serverY: before.y,
      _snapDistanceSq: 0,
      orientation: before.orientation || st.orientation || 'h',
      w: before.w || st.w,
      h: before.h || st.h,
      radius: Math.max(before.w || st.w || 0, before.h || st.h || 0) * 0.5
    });
    this.localPrediction.pendingStructureMoves.delete(key);
    return true;
  }

  _serverStructureMatchesPendingMove(serverStructure, pending) {
    if (!serverStructure || !pending?.target) return false;
    const dx = Math.abs((Number(serverStructure.x) || 0) - (Number(pending.target.x) || 0));
    const dy = Math.abs((Number(serverStructure.y) || 0) - (Number(pending.target.y) || 0));
    const orientation = String(serverStructure.orientation || 'h').toLowerCase();
    const targetOrientation = String(pending.target.orientation || orientation).toLowerCase();
    return dx <= 1.5 && dy <= 1.5 && orientation === targetOrientation;
  }

  _syncStructures(arr, serverNow) {
    const seen = new Set();
    const now = performance.now();
    for (const raw of arr) {
      if (!raw?.id) continue;
      const id = raw.id;
      seen.add(id);
      const previous = this.structures.get(id);
      const normalized = this._normalizeStructureSnapshot(raw, serverNow, previous);
      const pending = this.localPrediction.pendingStructureMoves?.get(id);
      if (pending) {
        if (this._serverStructureMatchesPendingMove(normalized, pending)) {
          this.localPrediction.pendingStructureMoves.delete(id);
          this.structures.set(id, {
            ...previous,
            ...normalized,
            x: normalized.x,
            y: normalized.y,
            _tx: normalized.x,
            _ty: normalized.y,
            _serverX: normalized.x,
            _serverY: normalized.y,
            _snapDistanceSq: 0
          });
          continue;
        }
        if (now < (pending.until || 0) && previous) {
          this.structures.set(id, {
            ...previous,
            ...normalized,
            x: previous.x,
            y: previous.y,
            _tx: previous.x,
            _ty: previous.y,
            _serverX: normalized.x,
            _serverY: normalized.y,
            _snapDistanceSq: 0
          });
          continue;
        }
        this.localPrediction.pendingStructureMoves.delete(id);
      }
      const merged = this._mergeEntity(previous, normalized);
      const movedFar = previous && Number.isFinite(normalized.x) && Number.isFinite(normalized.y)
        && (((normalized.x - (previous.x || 0)) ** 2 + (normalized.y - (previous.y || 0)) ** 2) > 24 * 24);
      if (movedFar) {
        merged.x = normalized.x;
        merged.y = normalized.y;
        merged._tx = normalized.x;
        merged._ty = normalized.y;
        merged._serverX = normalized.x;
        merged._serverY = normalized.y;
        merged._snapDistanceSq = 0;
      }
      this.structures.set(id, merged);
    }
    for (const id of this.structures.keys()) {
      const item = this.structures.get(id);
      if (!seen.has(id) && !item?.localOnly) this.structures.delete(id);
    }
  }

  _isLocalPoseProtected(now = performance.now()) {
    if (now < (this.localPrediction.localAbilityAuthorityUntil || 0)) return true;
    if (now < (this.localPrediction.localPassiveAuthorityUntil || 0)) return false;
    const me = this.getMe();
    if (me && now < (me._keepLocalPoseUntil || 0)) return true;
    if (now - (this.localPrediction.sectorTransitionAt || 0) < 900) return true;
    return false;
  }

  _softReconcileLocalPose(previous, merged, serverX, serverY, now = performance.now()) {
    if (!this.softReconciliation?.enabled) return merged;
    if (!Number.isFinite(serverX) || !Number.isFinite(serverY)) return merged;
    if (!Number.isFinite(previous?.x) || !Number.isFinite(previous?.y)) return merged;

    const dx = serverX - previous.x;
    const dy = serverY - previous.y;
    const distance = Math.hypot(dx, dy);
    merged._serverDelta = distance;
    merged._serverAckInputSeq = this.inputHistory?.lastAckSeq || 0;
    merged._pendingInputCount = this.inputHistory?.stats?.().pending || 0;
    merged._reconciliationMode = 'none';

    if (distance <= this.softReconciliation.smallThreshold) return merged;
    if (this._isLocalPoseProtected(now)) {
      merged._reconciliationMode = 'protected';
      return merged;
    }

    if (distance >= this.softReconciliation.hardThreshold) {
      // Gros écart : le serveur a probablement corrigé une collision, un contrôle forcé,
      // un secteur ou un état impossible. On aligne plutôt que de traîner l'erreur.
      merged.x = serverX;
      merged.y = serverY;
      if (Number.isFinite(merged._serverVx)) merged.vx = merged._serverVx;
      if (Number.isFinite(merged._serverVy)) merged.vy = merged._serverVy;
      merged._tx = serverX;
      merged._ty = serverY;
      merged._reconciliationMode = 'hard';
      this.netStats?.recordSoftReconciliation?.(distance, distance, 'hard');
      return merged;
    }

    if (distance <= this.softReconciliation.softThreshold) {
      const pending = this.inputHistory?.stats?.().pending || 0;
      const pendingFactor = Math.max(0, Math.min(1, pending / 12));
      const t = Math.max(this.softReconciliation.minApply, Math.min(this.softReconciliation.maxApply, 0.12 + pendingFactor * 0.10 + distance / 900));
      const ax = dx * t;
      const ay = dy * t;
      merged.x = previous.x + ax;
      merged.y = previous.y + ay;
      merged._tx = merged.x;
      merged._ty = merged.y;
      merged._reconciliationMode = 'soft';
      this.netStats?.recordSoftReconciliation?.(distance, Math.hypot(ax, ay), 'soft');
      return merged;
    }

    // Écart moyen : correction plus prudente, assez visible pour résorber sans snap.
    const t = 0.18;
    const ax = dx * t;
    const ay = dy * t;
    merged.x = previous.x + ax;
    merged.y = previous.y + ay;
    merged._tx = merged.x;
    merged._ty = merged.y;
    merged._reconciliationMode = 'medium';
    this.netStats?.recordSoftReconciliation?.(distance, Math.hypot(ax, ay), 'soft');
    return merged;
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
      const sectorChanged = ((previous.sx | 0) !== (next.sx | 0)) || ((previous.sy | 0) !== (next.sy | 0));
      const merged = { ...previous, ...next };
      const serverControlled = hasAuthoritativeControlStatus(next);
      if (serverControlled && Number.isFinite(next.x) && Number.isFinite(next.y)) {
        merged.x = next.x;
        merged.y = next.y;
        merged.sx = next.sx;
        merged.sy = next.sy;
        merged.vx = Number.isFinite(next.vx) ? next.vx : 0;
        merged.vy = Number.isFinite(next.vy) ? next.vy : 0;
        if (Number.isFinite(next.rot)) merged.rot = next.rot;
        merged._serverX = next.x;
        merged._serverY = next.y;
        merged._serverVx = Number.isFinite(next.vx) ? next.vx : 0;
        merged._serverVy = Number.isFinite(next.vy) ? next.vy : 0;
        merged._tx = next.x;
        merged._ty = next.y;
        merged._snapDistanceSq = 0;
        merged._forceServerPose = false;
        merged._keepLocalPoseUntil = 0;
        merged._localDashUntil = 0;
        merged._localThrust = 0;
        this.localPrediction.hasMoveTarget = false;
        this.localPrediction.hold = false;
        this.localPrediction.selectedKind = '';
        this.localPrediction.selectedId = 0;
        this.localPrediction.attackKind = '';
        this.localPrediction.attackId = 0;
        this.localPrediction.attackUntil = 0;
        this.localPrediction.localAbilityAuthorityUntil = 0;
        return this._applyLocalDamageToEntity(this._applyLocalVitalAuthority(previous, merged, performance.now()));
      }
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
        return this._applyLocalDamageToEntity(this._applyLocalVitalAuthority(previous, merged, performance.now()));
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
          return this._applyLocalDamageToEntity(this._applyLocalVitalAuthority(previous, merged, performance.now()));
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
        return this._applyLocalDamageToEntity(this._applyLocalVitalAuthority(previous, merged, performance.now()));
      }
      // Pour le joueur local, les snapshots sont forcément en retard réseau.
      // On synchronise les PV/stats/etc., mais on ne rembobine plus x/y/vx/vy.
      if (Number.isFinite(next.x) && Number.isFinite(next.y) && this.netStats) {
        const serverDelta = Math.hypot(next.x - (previous.x || 0), next.y - (previous.y || 0));
        this.netStats.recordCorrection(serverDelta);
        merged._serverX = next.x;
        merged._serverY = next.y;
        merged._serverVx = Number.isFinite(next.vx) ? next.vx : 0;
        merged._serverVy = Number.isFinite(next.vy) ? next.vy : 0;
      }
      merged.x = previous.x;
      merged.y = previous.y;
      merged.vx = previous.vx;
      merged.vy = previous.vy;
      if (Number.isFinite(previous.rot)) merged.rot = previous.rot;
      if (Number.isFinite(previous._localThrust)) merged._localThrust = previous._localThrust;
      this._softReconcileLocalPose(previous, merged, next.x, next.y, performance.now());
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
      return this._applyLocalDamageToEntity(this._applyLocalVitalAuthority(previous, merged, performance.now()));
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
    else if (kind === 'structure') map = this.structures;
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

  _estimateServerNow() {
    if (!Number.isFinite(this.lastServerTime) || !Number.isFinite(this.lastServerTimeAt) || this.lastServerTime <= 0) return Date.now();
    return this.lastServerTime + Math.max(0, performance.now() - this.lastServerTimeAt);
  }

  _automationVisualKey(item) {
    if (!item || typeof item !== 'object') return '';
    return `${item.key || ''}:${item.phase || ''}:${Number(item.startedAt) || 0}:${Number(item.totalMs) || 0}`;
  }

  _normalizeAutomationItem(item, serverNow, previous = null) {
    if (!item || typeof item !== 'object') return item || null;
    const totalMs = Math.max(1, Number(item.totalMs) || 0);
    const startedAt = Number(item.startedAt);
    if (!Number.isFinite(startedAt) || !Number.isFinite(totalMs) || totalMs <= 0) return { ...item };
    const elapsed = Math.max(0, serverNow - startedAt);
    const previousKey = this._automationVisualKey(previous);
    const nextKey = this._automationVisualKey(item);
    let localStartedAt = performance.now() - elapsed;
    if (previousKey && previousKey === nextKey && Number.isFinite(Number(previous?._localStartedAt))) {
      localStartedAt = Number(previous._localStartedAt);
    }
    const progress = Math.max(0, Math.min(1, (performance.now() - localStartedAt) / totalMs));
    return {
      ...item,
      totalMs,
      startedAt,
      progress,
      _localStartedAt: localStartedAt,
      _localUpdatedAt: performance.now()
    };
  }

  _normalizeStructureSnapshot(st, serverNow, previous = null) {
    if (!st || typeof st !== 'object') return st;
    const out = { ...st };
    if (st.automationItem) {
      out.automationItem = this._normalizeAutomationItem(st.automationItem, serverNow, previous?.automationItem || null);
    }
    const previousItem = previous?.automationItem || null;
    if (!out.automationItem && previousItem && isFinite(Number(previousItem._localStartedAt))) {
      out._automationFadeItem = { ...previousItem, _fadeUntil: performance.now() + 220 };
    } else if (previous?._automationFadeItem && Number(previous._automationFadeItem._fadeUntil) > performance.now()) {
      out._automationFadeItem = previous._automationFadeItem;
    } else {
      out._automationFadeItem = null;
    }
    return out;
  }

  _applyStructureAutomationSnapshots(arr, serverNow) {
    if (!Array.isArray(arr) || !arr.length) return;
    for (const snap of arr) {
      const id = snap?.id;
      if (!id || !this.structures.has(id)) continue;
      const current = this.structures.get(id);
      const normalized = this._normalizeStructureSnapshot(snap, serverNow, current);
      this.structures.set(id, {
        ...current,
        storageUsed: isSnapshotDrivenLogisticAutomation(normalized) ? 0 : (normalized.storageUsed ?? current.storageUsed),
        storagePreview: isSnapshotDrivenLogisticAutomation(normalized) ? null : (normalized.storagePreview ?? null),
        automationItem: isSnapshotDrivenLogisticAutomation(normalized) ? null : (normalized.automationItem ?? null),
        _automationFadeItem: isSnapshotDrivenLogisticAutomation(normalized) ? null : (normalized._automationFadeItem ?? null),
        automationKind: normalized.automationKind ?? current.automationKind,
        automationPulse: normalized.automationPulse ?? current.automationPulse,
        automationStatus: normalized.automationStatus ?? current.automationStatus,
        depositResourceKey: normalized.depositResourceKey ?? current.depositResourceKey,
        depositLabel: normalized.depositLabel ?? current.depositLabel,
        depositColorHex: normalized.depositColorHex ?? current.depositColorHex,
        depositInfinite: normalized.depositInfinite ?? current.depositInfinite,
        depositRemaining: normalized.depositRemaining ?? current.depositRemaining,
        depositMax: normalized.depositMax ?? current.depositMax,
        depositId: normalized.depositId ?? current.depositId,
        extractionProgress: normalized.extractionProgress ?? current.extractionProgress
      });
    }
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
    const abilityAuthority = now < (this.localPrediction.localAbilityAuthorityUntil || 0);
    const passiveAuthority = now < (this.localPrediction.localPassiveAuthorityUntil || 0);
    if (!abilityAuthority && !passiveAuthority) return myState;

    const out = { ...myState };
    const localFs = this.localPrediction.localFrameState || null;
    if ((abilityAuthority || passiveAuthority) && localFs) {
      const serverFs = out.frameState || {};
      const localStacks = Number(localFs.passiveStacks);
      const serverStacks = Number(serverFs.passiveStacks);
      const keepLocalStacks = passiveAuthority && Number.isFinite(localStacks) && (!Number.isFinite(serverStacks) || localStacks > serverStacks);

      out.frameState = { ...serverFs, ...localFs };
      if (!keepLocalStacks && Number.isFinite(serverStacks)) {
        out.frameState.passiveStacks = serverStacks;
        out.frameState.passiveDecayLeft = serverFs.passiveDecayLeft;
        out.frameState.passiveDecaying = serverFs.passiveDecaying;
        this.localPrediction.localFrameState = { ...(this.localPrediction.localFrameState || {}), ...out.frameState };
      }
    }

    if ((abilityAuthority || passiveAuthority) && this.localPrediction.localDerived) {
      out.derived = { ...(out.derived || {}) };
      for (const key of ['moveSpeed', 'autoAttackRate', 'autoAttackDamage', 'tenacityPct', 'slowResistPct']) {
        if (Number.isFinite(this.localPrediction.localDerived[key])) {
          out.derived[key] = Math.max(Number(out.derived[key]) || 0, Number(this.localPrediction.localDerived[key]) || 0);
        }
      }
    }
    return out;
  }

  noteLocalPassiveEvent(reason = 'hit', amount = 1, meta = {}) {
    if (!this.myState) return false;
    const frameId = String(this.myState.frameId || meta.frameId || '').toLowerCase();
    if (!frameId) return false;
    const now = performance.now();
    const fs = { ...(this.myState.frameState || {}) };
    const add = Math.max(0, Number(amount) || 0);
    if (add <= 0) return false;

    if (frameId === 'vanguard') {
      const maxStacks = Math.max(1, Number(fs.passiveMaxStacks) || 10);
      const current = Math.max(0, Number(fs.passiveStacks) || 0);
      const nextStacks = Math.min(maxStacks, current + add);
      fs.kind = fs.kind || 'vanguard';
      fs.passiveName = fs.passiveName || 'Surchauffe';
      fs.passiveMaxStacks = maxStacks;
      fs.passiveStacks = nextStacks;
      fs.passiveDecayLeft = Math.max(Number(fs.passiveDecayLeft) || 0, 5.0);
      fs.passiveDecaying = false;
      fs._localPassiveReason = reason;
      fs._localPassiveUpdatedAt = now;

      const serverDerived = this.myState.derived || {};
      const localDerived = { ...(this.localPrediction.localDerived || serverDerived) };
      if (Number.isFinite(serverDerived.autoAttackRate)) localDerived.autoAttackRate = Math.max(Number(localDerived.autoAttackRate) || 0, Number(serverDerived.autoAttackRate) * (1 + 0.04 * nextStacks));
      if (Number.isFinite(serverDerived.moveSpeed)) localDerived.moveSpeed = Math.max(Number(localDerived.moveSpeed) || 0, Number(serverDerived.moveSpeed) * (1 + 0.015 * nextStacks));
      this.localPrediction.localDerived = localDerived;
    } else if (frameId === 'sigil') {
      const maxStacks = Math.max(1, Number(fs.passiveMaxStacks) || 5);
      fs.kind = fs.kind || 'sigil';
      fs.passiveName = fs.passiveName || 'Runes';
      fs.passiveMaxStacks = maxStacks;
      fs.passiveStacks = Math.min(maxStacks, Math.max(0, Number(fs.passiveStacks) || 0) + add);
      fs.runeDurationLeft = Math.max(Number(fs.runeDurationLeft) || 0, 7.0);
      fs._localPassiveReason = reason;
      fs._localPassiveUpdatedAt = now;
    } else if (frameId === 'bulwark') {
      fs.kind = fs.kind || 'bulwark';
      fs.passiveMaxStacks = Math.max(1, Number(fs.passiveMaxStacks) || 5);
      fs._localPassiveReason = reason;
      fs._localPassiveUpdatedAt = now;
    } else {
      return false;
    }

    this.myState.frameState = fs;
    this.localPrediction.localFrameState = { ...(this.localPrediction.localFrameState || {}), ...fs };
    this.localPrediction.localPassiveAuthorityUntil = Math.max(this.localPrediction.localPassiveAuthorityUntil || 0, now + Math.max(650, Number(meta.authorityMs) || 1250));
    this.localPrediction.localAbilityAuthorityUntil = Math.max(this.localPrediction.localAbilityAuthorityUntil || 0, now + 500);
    this.localPrediction.localPassiveEventSeq = (this.localPrediction.localPassiveEventSeq | 0) + 1;
    return true;
  }

  _mergeMyState(next) {
    if (!next) return null;
    if (!next.lite || !this.myState) {
      const now = performance.now();
      const cooldowns = { ...(next.cooldowns || {}) };
      for (const slot of ['A', 'Z', 'E', 'R']) {
        const localReady = this.localPrediction.localAbilityReadyAt?.[slot] || 0;
        const serverCd = Number(next.cooldowns?.[slot] ?? cooldowns[slot] ?? 0);
        const lastCast = this.localPrediction.localAbilityLastCastAt?.[slot] || 0;
        const recentLocalCast = lastCast > 0 && now - lastCast < 420;
        if (
          (serverCd > 0.03 || recentLocalCast) &&
          (now < (this.localPrediction.localCooldownLocks?.[slot] || 0) || now < localReady + 220) &&
          Number.isFinite(this.myState.cooldowns?.[slot])
        ) {
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
      return this._applyLocalAbilityAuthority(merged);
    }
    const now = performance.now();
    const cooldowns = { ...(this.myState.cooldowns || {}), ...(next.cooldowns || {}) };
    for (const slot of ['A', 'Z', 'E', 'R']) {
      const serverCd = Number(next.cooldowns?.[slot] ?? cooldowns[slot] ?? 0);
      const lastCast = this.localPrediction.localAbilityLastCastAt?.[slot] || 0;
      const recentLocalCast = lastCast > 0 && now - lastCast < 420;
      if ((serverCd > 0.03 || recentLocalCast) && now < (this.localPrediction.localCooldownLocks?.[slot] || 0) && Number.isFinite(this.myState.cooldowns?.[slot])) {
        cooldowns[slot] = this.myState.cooldowns[slot];
      }
    }
    const mergedLite = {
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
    return this._applyLocalAbilityAuthority(mergedLite);
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

  applyCombatFxEvents(events) {
    if (!Array.isArray(events) || !events.length) return;
    for (const ev of events) {
      const sourceId = ev?.sourceId | 0;
      const targetKind = String(ev?.targetKind || ev?.kind || '').toLowerCase();
      const sourceSlot = ev?.sourceSlot ?? ev?.visualKind ?? '';
      if (sourceId && sourceId === (this.myId | 0) && ev?.type !== 'structure_state' && targetKind !== 'asteroid') {
        this.noteLocalPassiveEvent(sourceSlot || 'server_hit', 1, { authorityMs: 900 });
      }

      if (ev?.type !== 'structure_state') continue;
      const id = ev.structureId | 0 || ev.targetId | 0;
      if (!id) continue;
      const st = this.structures.get(id);
      if (ev.reason === 'destroyed') {
        if (st?.vitals) st.vitals = { ...st.vitals, hp: 0, maxHp: ev.maxHp ?? st.vitals.maxHp ?? 0 };
        this.structures.delete(id);
        continue;
      }
      if (!st) continue;
      st.vitals = { ...(st.vitals || {}), hp: Math.max(0, ev.hp | 0), maxHp: Math.max(0, ev.maxHp | 0) };
      st.damageable = ev.damageable !== false;
    }
  }

  applyStateV2(msg) {
    const snapLocalNow = performance.now();
    this.lastSnapAt = snapLocalNow;
    this.lastServerTime = Number.isFinite(Number(msg.time)) ? Number(msg.time) : Date.now();
    this.lastServerTimeAt = snapLocalNow;
    this.myState = this._mergeMyState(msg.me ?? null);
    if (this.myState?.id) this.myId = this.myState.id | 0;

    if (Array.isArray(msg.players)) {
      for (const p of msg.players) {
        const id = p.id | 0;
        if (!id) continue;
        const current = this.players.get(id) || {};
        this.players.set(id, { ...current, ...p, _serverX: p.x, _serverY: p.y, _tx: p.x, _ty: p.y });
      }
      this.interpolationStore?.pushMany?.('player', msg.players.filter((p) => (p.id | 0) !== (this.myId | 0)), this.lastServerTime);
    }

    if (Number.isFinite(Number(msg.ackInputSeq))) this.ackInputSeq = Number(msg.ackInputSeq) | 0;
  }

  applySnapshot(msg) {
    const snapLocalNow = performance.now();
    this.lastSnapAt = snapLocalNow;
    this.lastServerTime = Number.isFinite(Number(msg.time)) ? Number(msg.time) : Date.now();
    this.lastServerTimeAt = snapLocalNow;
    this.seed = msg.seed | 0;
    this.world = msg.world ?? this.world;
    this.session = msg.session ?? this.session;
    this.modes = msg.modes ?? this.modes;
    this.playerDirectory = msg.playerDirectory ?? this.playerDirectory ?? [];
    this.myState = this._mergeMyState(msg.me ?? null);
    this.syncLocalAbilityCooldownAuthority(this.myState);
    if (hasAuthoritativeControlStatus(this.myState)) {
      this.localPrediction.hasMoveTarget = false;
      this.localPrediction.hold = false;
      this.localPrediction.selectedKind = '';
      this.localPrediction.selectedId = 0;
      this.localPrediction.attackKind = '';
      this.localPrediction.attackId = 0;
      this.localPrediction.attackUntil = 0;
      this.localPrediction.localAbilityAuthorityUntil = 0;
      this.localPrediction.localFrameState = null;
      this.localPrediction.localDerived = null;
      const me = this.players.get(this.myId);
      if (me) {
        me._forceServerPose = true;
        me._keepLocalPoseUntil = 0;
        me._localDashUntil = 0;
        me._localThrust = 0;
      }
    }
    const transition = this.myState?.transition || null;
    if (transition && !(transition.type === 'sector' && Number(this.myState?.sectorCombatLockLeft || 0) > 0)) {
      const base = transition.type === 'sector' ? 220 : 450;
      this.beginPortalLoading(transition.label || 'Chargement du secteur…', Math.max(base, (transition.until || msg.time || 0) - (msg.time || 0) + 90), transition.id | 0);
      const me = this.players.get(this.myId);
      if (me && transition.forceServerPose) me._forceServerPose = true;
    } else if (transition?.type === 'sector') {
      this.localPrediction.loadingUntil = 0;
      this.localPrediction.loadingLabel = '';
    }
    if (this.myState && performance.now() < (this.localPrediction.selectedUntil || 0)) {
      this.myState.selectedKind = this.localPrediction.selectedKind || '';
      this.myState.selectedId = this.localPrediction.selectedId || 0;
    }
    const hasNetworkEvents = Array.isArray(msg.events) && msg.events.length > 0;
    if (Array.isArray(msg.logisticTransferEvents)) this.applyLogisticTransferEvents(msg.logisticTransferEvents);
    if (Array.isArray(msg.projectileEvents)) this.applyProjectileEvents(msg.projectileEvents);
    this.pruneLogisticTransferVisuals(snapLocalNow);
    this.pruneProjectileEventState(snapLocalNow);
    if (hasNetworkEvents) this.applyNetworkEvents(msg.events);
    if (!hasNetworkEvents && msg.worldSfx?.length) this.pendingSfx.push(...msg.worldSfx);
    if (msg.combatFx?.length) {
      this.applyCombatFxEvents(msg.combatFx);
      if (!hasNetworkEvents) this.pendingCombatFx.push(...msg.combatFx.filter((fx) => fx?.type !== 'structure_state'));
    }
    if (Array.isArray(msg.players)) this.interpolationStore.pushMany('player', msg.players.filter((p) => (p.id | 0) !== (this.myId | 0)), this.lastServerTime);
    if (Array.isArray(msg.mobs)) this.interpolationStore.pushMany('mob', msg.mobs, this.lastServerTime);
    if (Array.isArray(msg.projectiles)) this.interpolationStore.pushMany('projectile', msg.projectiles, this.lastServerTime);
    if (Array.isArray(msg.logisticDrones)) this.interpolationStore.pushMany('logisticDrone', msg.logisticDrones, this.lastServerTime);
    if (Array.isArray(msg.loots)) this.interpolationStore.pushMany('loot', msg.loots, this.lastServerTime);
    if (!hasNetworkEvents && msg.me?.sfx?.length) this.pendingSfx.push(...msg.me.sfx);
    if (Array.isArray(msg.players)) this._syncMap(this.players, msg.players, { snapOwnPlayer: false, preserveOwnPlayerPosition: true });
    if (Array.isArray(msg.mobs)) this._syncMap(this.mobs, msg.mobs);
    // Les entités statiques du secteur sont volontairement envoyées moins souvent.
    // Quand le serveur omet ces tableaux, on garde la dernière version locale au lieu
    // de vider la map, ce qui évite de retransmettre 20-40 astéroïdes à chaque frame.
    if (Array.isArray(msg.asteroids)) this._syncMap(this.asteroids, msg.asteroids, { preserveLocalRotation: true });
    if (Array.isArray(msg.stations)) this._syncMap(this.stations, msg.stations);
    const structureServerNow = this._estimateServerNow();
    if (Array.isArray(msg.structures)) {
      this._syncStructures(msg.structures, structureServerNow);
    }
    if (Array.isArray(msg.structureAutomation)) this._applyStructureAutomationSnapshots(msg.structureAutomation, structureServerNow);
    if (Array.isArray(msg.portals)) this._syncMap(this.portals, msg.portals);
    if (Array.isArray(msg.projectiles)) {
      const projectileSnapshots = msg.projectiles.filter((p) => Number(this.projectileEventTombstones?.get?.(p.id | 0) || 0) <= snapLocalNow);
      for (const p of projectileSnapshots) {
        const id = p.id | 0;
        if (!id) continue;
        const current = this.projectiles.get(id) || {};
        // Les snapshots projectiles sont désormais une correction, pas la source du rendu.
        // On préserve les champs packet locaux pour éviter les snaps / doublons visuels.
        this.projectiles.set(id, {
          ...current,
          ...p,
          _packetSpawnLocalAt: current._packetSpawnLocalAt,
          _packetStartX: current._packetStartX,
          _packetStartY: current._packetStartY,
          _packetServerTime: current._packetServerTime
        });
      }
    }
    if (Array.isArray(msg.logisticDrones)) this._syncMap(this.logisticDrones, msg.logisticDrones);
    if (Array.isArray(msg.areaEffects)) this._syncMap(this.areaEffects, msg.areaEffects);
    if (Array.isArray(msg.loots)) this._syncMap(this.loots, msg.loots);
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
          if (projectile._targetKind !== 'asteroid') {
            this.noteLocalPassiveEvent(projectile.sourceAbilitySlot || projectile.visualKind || 'local_projectile_hit', 1, { authorityMs: 1250 });
          }
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
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.tickPendingCommands();
    if (!this.myState) return;
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
    if (Number.isFinite(this.myState._lastAbilityRejectLeft)) {
      this.myState._lastAbilityRejectLeft = Math.max(0, this.myState._lastAbilityRejectLeft - dt);
      if (this.myState._lastAbilityRejectLeft <= 0 && this.myState.lastAbilityReject) this.myState.lastAbilityReject = null;
    }
    const fs = this.myState.frameState;
    if (fs && Number.isFinite(fs.passiveDecayLeft)) {
      fs.passiveDecayLeft = Math.max(0, fs.passiveDecayLeft - dt);
      if (fs.passiveDecayLeft <= 0 && Number(fs.passiveStacks) > 0) {
        fs.passiveDecaying = true;
        fs._localPassiveDecayTick = (Number(fs._localPassiveDecayTick) || 0) + dt;
        while (fs._localPassiveDecayTick >= 0.20 && Number(fs.passiveStacks) > 0) {
          fs._localPassiveDecayTick -= 0.20;
          fs.passiveStacks = Math.max(0, (Number(fs.passiveStacks) || 0) - 1);
        }
      } else {
        fs.passiveDecaying = false;
        fs._localPassiveDecayTick = 0;
      }
    }
    if (fs && Number.isFinite(fs.runeDurationLeft)) fs.runeDurationLeft = Math.max(0, fs.runeDurationLeft - dt);
    if (fs && Number.isFinite(fs.detonationCooldownLeft)) fs.detonationCooldownLeft = Math.max(0, fs.detonationCooldownLeft - dt);
    const me = this.getMe();
    if (me) {
      if (Number.isFinite(me.rocketCooldownLeft)) me.rocketCooldownLeft = Math.max(0, me.rocketCooldownLeft - dt);
      if (Number.isFinite(me.groundMarkerTimer)) me.groundMarkerTimer = Math.max(0, me.groundMarkerTimer - dt);
    }
  }

  noteLocalAbilityCast(slot, cooldownLeft = 0, meta = {}) {
    if (!slot || !this.myState) return;
    const s = String(slot).toUpperCase();
    if (!['A', 'Z', 'E', 'R'].includes(s)) return;
    const now = performance.now();
    this.localPrediction.abilitySeq = (this.localPrediction.abilitySeq | 0) + 1;
    const authorityMs = Math.max(900, Number(meta.authorityMs) || 1700);
    this.localPrediction.localCooldownLocks[s] = Math.max(this.localPrediction.localCooldownLocks[s] || 0, now + Math.max(authorityMs, 1400));
    this.localPrediction.localAbilityAuthorityUntil = Math.max(this.localPrediction.localAbilityAuthorityUntil || 0, now + authorityMs);
    if (!this.localPrediction.localAbilityReadyAt) this.localPrediction.localAbilityReadyAt = {};
    if (!this.localPrediction.localAbilityLastCastAt) this.localPrediction.localAbilityLastCastAt = {};
    if (Number.isFinite(cooldownLeft)) {
      this.localPrediction.localAbilityReadyAt[s] = Math.max(this.localPrediction.localAbilityReadyAt[s] || 0, now + cooldownLeft * 1000);
      this.localPrediction.localAbilityLastCastAt[s] = now;
    }
    if (!this.myState.cooldowns) this.myState.cooldowns = {};
    if (Number.isFinite(cooldownLeft)) this.myState.cooldowns[s] = Math.max(0, cooldownLeft);
    if (this.myState.abilityHud?.[s] && Number.isFinite(cooldownLeft)) {
      this.myState.abilityHud[s].cooldownLeft = Math.max(0, cooldownLeft);
    }
    this.localPrediction.localFrameState = { ...(this.localPrediction.localFrameState || {}), ...(this.myState.frameState || {}) };
    this.localPrediction.localDerived = { ...(this.localPrediction.localDerived || {}), ...(this.myState.derived || {}) };
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

  setLocalAttackTarget(kind, id, options = {}) {
    const k = kind || '';
    const targetId = id || 0;
    const now = performance.now();
    this.localPrediction.attackKind = k;
    this.localPrediction.attackId = targetId;
    this.localPrediction.attackAt = now;
    this.localPrediction.attackUntil = k && targetId ? now + Math.max(1200, options.lockMs || 30000) : 0;
    this.localPrediction.attackSeq = (this.localPrediction.attackSeq | 0) + 1;
  }

  cancelLocalAttack(options = {}) {
    this.localPrediction.attackKind = '';
    this.localPrediction.attackId = 0;
    this.localPrediction.attackUntil = 0;
    if (!options.keepSeq) this.localPrediction.attackSeq = (this.localPrediction.attackSeq | 0) + 1;
  }

  setOptimisticSelection(kind, id, options = {}) {
    if (!this.myState) return;
    const k = kind || '';
    const targetId = id || 0;
    this.myState.selectedKind = k;
    this.myState.selectedId = targetId;
    this.localPrediction.selectedKind = k;
    this.localPrediction.selectedId = targetId;
    const now = performance.now();
    this.localPrediction.selectedAt = now;
    this.localPrediction.selectedUntil = k && targetId ? now + Math.max(1500, options.lockMs || 30000) : 0;
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
      this.localPrediction.selectedKind = '';
      this.localPrediction.selectedId = 0;
      this.localPrediction.selectedUntil = 0;
      if (this.myState) {
        this.myState.selectedKind = '';
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
    this._smoothMap(this.logisticDrones, fastAlpha, dt);
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
    // Les cibles et l'ancien ordre de déplacement deviennent obsolètes.
    // La position de spawn doit rester relative à la frontière, sans déplacement
    // automatique qui ramène ensuite le vaisseau vers l'ancien clic.
    this.localPrediction.selectedKind = '';
    this.localPrediction.selectedId = 0;
    this.cancelLocalAttack({ keepSeq: false });
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


  _forEachConverterItem(itemId, fn) {
    if (!itemId || typeof fn !== 'function') return;
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
    const id = String(itemId || '');
    if (!id || !this.myState?.equipment) return;
    const next = !!enabled;
    this._forEachConverterItem(id, (item) => {
      item.converterEnabled = next;
      item.enabled = next;
      if (item.converterRuntime) {
        item.converterRuntime.enabled = next;
        item.converterRuntime.blockedReason = next ? '' : 'disabled';
        item.converterRuntime.blockedLabel = next ? 'actif' : 'coupé';
      }
      if (next && item.blockedLabel === 'coupé') item.blockedLabel = 'actif';
      if (!next) item.blockedLabel = 'coupé';
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
        entry.blockedReason = next ? '' : 'disabled';
        entry.blockedLabel = next ? 'actif' : 'coupé';
      }
    }
  }

  noteCommandPending(cmd, payload = {}, meta = {}) {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const now = performance.now();
    const entry = {
      id,
      cmd: String(cmd || ''),
      payload: { ...(payload || {}) },
      meta: { ...(meta || {}) },
      at: now,
      status: 'pending'
    };
    this.pendingCommands.set(id, entry);
    const stationCmds = new Set([
      'sell', 'sell_all', 'buy_item', 'buy_and_assign_rocket_ammo', 'equip_item',
      'equip_item_to_slot', 'unequip_item', 'sell_item', 'assign_rocket_ammo',
      'unassign_rocket_ammo', 'switch_rocket_slot', 'toggle_converter', 'set_frame'
    ]);
    if (stationCmds.has(entry.cmd) && !entry.meta?.globalEquipment) this.pendingStationCommands.set(id, entry);
    return id;
  }


  markCommandFailed(id, error = 'failed') {
    const key = String(id || '');
    if (!key) return;
    const entry = this.pendingCommands.get(key) || this.pendingStationCommands.get(key) || null;
    if (!entry) return;
    entry.status = 'failed';
    entry.error = String(error || 'failed');
    entry.ackedAt = performance.now();
  }

  applyCommandAck(msg) {
    const id = String(msg?.cmdId || '');
    if (!id) return;
    const entry = this.pendingCommands.get(id) || this.pendingStationCommands.get(id) || null;
    if (!entry) return;
    entry.status = msg.ok ? 'ok' : 'failed';
    entry.ackedAt = performance.now();
    entry.ok = !!msg.ok;
    entry.cmd = String(msg.cmd || entry.cmd || '');
    if (!msg.ok) {
      if (entry.cmd === 'move_structure') this._rollbackOptimisticStructureMove(entry.payload?.structureId);
      this.myState = this.myState || {};
      const reason = String(msg.error || 'refusée');
      const actionLabel = entry.cmd === 'move_structure' ? 'Déplacement refusé' : (entry.cmd === 'remove_structure' ? 'Démolition refusée' : 'Action station refusée');
      this.myState.hint = entry?.meta?.globalEquipment
        ? `Action équipement refusée : ${entry.cmd}${reason ? ` (${reason})` : ''}`
        : `${actionLabel}${reason ? ` (${reason})` : ''}`;
      this.myState._optimisticHintLeft = 1.2;
    }
    // A command ack means the server answered. Stop the blocking wait immediately,
    // even on reject. Failed entries stay in pendingCommands briefly for the red badge.
    if (this.pendingStationCommands.has(id)) {
      this.pendingStationCommands.delete(id);
    }
  }

  tickPendingCommands() {
    const now = performance.now();
    for (const [id, entry] of [...this.pendingCommands.entries()]) {
      const done = entry.status === 'ok' || entry.status === 'failed';
      if ((done && now - (entry.ackedAt || entry.at) > 280) || now - entry.at > 1500) {
        this.pendingCommands.delete(id);
        this.pendingStationCommands.delete(id);
      }
    }
  }

  getStationPendingSummary() {
    this.tickPendingCommands();
    const now = performance.now();
    const pending = [...this.pendingStationCommands.values()].filter((entry) => entry.status === 'pending' && now - entry.at < 900);
    const failed = [...this.pendingCommands.values()].filter((entry) => entry?.meta?.station && (entry.status === 'failed' || now - entry.at >= 1200) && now - (entry.ackedAt || entry.at) < 1100);
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

  consumePendingProjectileImpacts() {
    const arr = this.pendingProjectileImpacts;
    this.pendingProjectileImpacts = [];
    return arr || [];
  }

  consumePendingCombatFx() {
    if (!this.pendingCombatFx.length) return [];
    const out = this.pendingCombatFx;
    this.pendingCombatFx = [];
    this.pendingProjectileImpacts = [];
    return out;
  }

  getMe() {
    return this.players.get(this.myId) ?? null;
  }
}
