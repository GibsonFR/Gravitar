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

export function buildNetworkEventsFromLegacy(state, playerId, timeMs, worldSfx = [], combatFx = [], playerSfx = []) {
  const events = [];
  for (const ev of worldSfx) {
    events.push({
      id: nextEventId(state),
      type: 'sfx.world',
      source: 'worldSfx',
      targetPlayerId: playerId | 0,
      ...entityBase(ev, timeMs),
      payload: {
        sfxType: ev.type,
        variant: ev.variant | 0,
        frameId: ev.frameId || '',
        slot: ev.slot || '',
        sourceKind: ev.sourceKind || '',
        mobProfile: ev.mobProfile || '',
        mobId: ev.mobId || '',
        visualKind: ev.visualKind || ''
      }
    });
  }

  for (const ev of combatFx) {
    events.push({
      id: nextEventId(state),
      type: ev.type ? `combat.${String(ev.type)}` : 'combat.fx',
      source: 'combatFx',
      targetPlayerId: playerId | 0,
      ...entityBase(ev, timeMs),
      payload: {
        ...ev,
        x: q(ev.x),
        y: q(ev.y)
      }
    });
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
