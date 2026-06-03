function byteLen(obj) {
  try { return JSON.stringify(obj).length; } catch { return 0; }
}

function sectionBytes(snapshot = {}, key = '') {
  if (!snapshot || !key) return 0;
  if (snapshot[key] == null) return 0;
  return byteLen(snapshot[key]);
}

export function pruneUndefinedSnapshotFields(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  for (const key of Object.keys(snapshot)) {
    if (snapshot[key] === undefined) delete snapshot[key];
  }
  return snapshot;
}

export function attachSnapshotNetMetrics(snapshot, options = {}) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  const tracked = [
    'me',
    'players',
    'mobs',
    'asteroids',
    'stations',
    'structures',
    'structureAutomation',
    'portals',
    'projectiles',
    'logisticDrones',
    'areaEffects',
    'loots',
    'events',
    'worldSfx',
    'combatFx',
    'playerDirectory',
    'modes'
  ];
  const sectionBytesMap = {};
  const sectionCounts = {};
  for (const key of tracked) {
    if (snapshot[key] === undefined) continue;
    sectionBytesMap[key] = sectionBytes(snapshot, key);
    sectionCounts[key] = Array.isArray(snapshot[key]) ? snapshot[key].length : snapshot[key] && typeof snapshot[key] === 'object' ? 1 : 0;
  }
  snapshot.net = {
    ...(snapshot.net || {}),
    slim: {
      version: 1,
      legacyEvents: !!options.legacyEvents,
      fullUi: !!snapshot.fullUi,
      staticWorld: !!snapshot.staticWorld,
      sectionBytes: sectionBytesMap,
      sectionCounts,
      approximateBytesBeforeNet: byteLen({ ...snapshot, net: undefined }),
      partialSections: Array.isArray(options.partialSections) ? options.partialSections : [],
      priorityLimits: options.priorityLimits || null
    }
  };
  return snapshot;
}
