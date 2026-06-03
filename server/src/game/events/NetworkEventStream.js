function nextEventId(state) {
  state.nextNetworkEventId = (state.nextNetworkEventId | 0) + 1;
  if (state.nextNetworkEventId > 2147483000) state.nextNetworkEventId = 1;
  return state.nextNetworkEventId;
}

function q(value, decimals = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const m = 10 ** decimals;
  return Math.round(n * m) / m;
}

function entityBase(ev = {}, timeMs = 0) {
  return {
    sx: ev.sx | 0,
    sy: ev.sy | 0,
    x: q(ev.x),
    y: q(ev.y),
    serverTime: timeMs
  };
}

function baseEvent(state, type, source, playerId, timeMs, ev = {}, payload = {}) {
  return {
    id: nextEventId(state),
    type,
    source,
    targetPlayerId: playerId | 0,
    ...entityBase(ev, timeMs),
    payload
  };
}

function abilitySlotFromSfxType(type = '', fallback = '') {
  const t = String(type || '').toLowerCase();
  if (t === 'ability_a') return 'A';
  if (t === 'ability_z') return 'Z';
  if (t === 'ability_e') return 'E';
  if (t === 'ability_r') return 'R';
  return String(fallback || '').toUpperCase();
}

function eventSourcePayload(ev = {}) {
  return {
    sourceKind: ev.sourceKind || '',
    sourceId: ev.sourceId | 0 || 0,
    frameId: ev.frameId || '',
    slot: ev.slot || '',
    mobProfile: ev.mobProfile || '',
    mobId: ev.mobId || '',
    visualKind: ev.visualKind || '',
    variant: ev.variant | 0
  };
}

function buildExplicitWorldEvent(state, playerId, timeMs, ev) {
  const type = String(ev?.type || '').toLowerCase();
  const sourceKind = String(ev?.sourceKind || '').toLowerCase();
  const payload = eventSourcePayload(ev);

  if (type.startsWith('ability_')) {
    const slot = abilitySlotFromSfxType(type, ev.slot);
    return baseEvent(state, 'ability.cast', 'worldSfx', playerId, timeMs, ev, {
      ...payload,
      slot,
      abilitySfxType: type
    });
  }

  if (type === 'auto_attack') {
    return baseEvent(state, 'projectile.spawn', 'worldSfx', playerId, timeMs, ev, {
      ...payload,
      projectileKind: 'auto_attack',
      sourceKind: sourceKind || payload.sourceKind || 'player'
    });
  }

  if (type === 'rocket') {
    return baseEvent(state, 'projectile.spawn', 'worldSfx', playerId, timeMs, ev, {
      ...payload,
      projectileKind: 'rocket',
      sourceKind: sourceKind || payload.sourceKind || 'player'
    });
  }

  return null;
}

function buildExplicitCombatEvents(state, playerId, timeMs, ev) {
  const out = [];
  const type = String(ev?.type || '').toLowerCase();
  if (type === 'damage') {
    const payload = {
      targetId: ev.targetId | 0,
      targetKind: ev.targetKind || '',
      amount: q(ev.amount || 0, 1),
      shielded: !!ev.shielded,
      crit: !!ev.crit,
      periodic: !!ev.periodic,
      sourceSlot: ev.sourceSlot || '',
      visualKind: ev.visualKind || ''
    };
    out.push(baseEvent(state, 'damage.applied', 'combatFx', playerId, timeMs, ev, payload));
    if (ev.visualKind || ev.sourceSlot) {
      out.push(baseEvent(state, 'projectile.impact', 'combatFx', playerId, timeMs, ev, {
        targetId: ev.targetId | 0,
        targetKind: ev.targetKind || '',
        sourceSlot: ev.sourceSlot || '',
        visualKind: ev.visualKind || '',
        crit: !!ev.crit
      }));
    }
  } else if (type === 'structure_state') {
    out.push(baseEvent(state, 'structure.state', 'combatFx', playerId, timeMs, ev, {
      targetId: ev.targetId | 0,
      structureId: ev.structureId | 0,
      hp: q(ev.hp || 0, 0),
      maxHp: q(ev.maxHp || 0, 0),
      damageable: ev.damageable !== false,
      reason: ev.reason || ''
    }));
  }
  return out;
}

export function buildNetworkEventsFromLegacy(state, playerId, timeMs, worldSfx = [], combatFx = [], playerSfx = []) {
  const events = [];
  for (const ev of worldSfx) {
    events.push(baseEvent(state, 'sfx.world', 'worldSfx', playerId, timeMs, ev, {
      sfxType: ev.type,
      variant: ev.variant | 0,
      frameId: ev.frameId || '',
      slot: ev.slot || '',
      sourceKind: ev.sourceKind || '',
      mobProfile: ev.mobProfile || '',
      mobId: ev.mobId || '',
      visualKind: ev.visualKind || ''
    }));
    const explicit = buildExplicitWorldEvent(state, playerId, timeMs, ev);
    if (explicit) events.push(explicit);
  }

  for (const ev of combatFx) {
    events.push(baseEvent(state, ev.type ? `combat.${String(ev.type)}` : 'combat.fx', 'combatFx', playerId, timeMs, ev, {
      ...ev,
      x: q(ev.x),
      y: q(ev.y)
    }));
    events.push(...buildExplicitCombatEvents(state, playerId, timeMs, ev));
  }

  for (const ev of playerSfx) {
    events.push({
      id: nextEventId(state),
      type: 'sfx.player',
      source: 'playerSfx',
      targetPlayerId: playerId | 0,
      serverTime: timeMs,
      payload: {
        sfxType: ev.type,
        variant: ev.variant | 0,
        resourceKey: ev.resourceKey || '',
        itemId: ev.itemId || '',
        group: ev.group || ''
      }
    });
  }

  return events;
}
