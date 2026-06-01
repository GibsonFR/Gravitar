import { ensurePlayerPirateState } from './runtime/PlayerPirateState.js';
import { getResourceDef } from '../inventory/ResourceDefs.js';
import { MOB_DEFS } from '../../../../shared/content/mobs/MobDefs.js';

function sanitizeQuestProgress(progress, player, state = null) {
  if (!progress || typeof progress !== 'object') return null;
  const questId = String(progress.questId || '').toLowerCase();
  if (!questId) return null;
  const type = progress.type || 'deliver_resource';
  const required = Math.max(1, progress.required | 0 || 1);
  const stationId = progress.stationId | 0 || 0;
  const station = stationId ? (state?.stations?.get?.(stationId) || null) : null;
  const stationSx = Number.isFinite(progress.stationSx) ? progress.stationSx | 0 : station?.sx | 0 || 0;
  const stationSy = Number.isFinite(progress.stationSy) ? progress.stationSy | 0 : station?.sy | 0 || 0;
  const isAtOriginStation = !!station && (player?.dockedStationId | 0) === stationId && (player?.sx | 0) === (station.sx | 0) && (player?.sy | 0) === (station.sy | 0);

  if (type === 'kill_mob') {
    const targetMobId = String(progress.targetMobId || '').toLowerCase();
    const mobDef = MOB_DEFS[targetMobId] || null;
    const current = Math.max(0, Math.min(required, progress.current | 0 || 0));
    return {
      questId,
      templateId: String(progress.templateId || ''),
      type,
      name: progress.name || 'Quête pirate',
      description: progress.description || '',
      stationId,
      stationName: progress.stationName || station?.name || 'Station pirate',
      stationSx,
      stationSy,
      current,
      required,
      progressPct: Math.max(0, Math.min(100, Math.round((current / required) * 100))),
      targetMobId,
      targetName: progress.targetName || mobDef?.name || targetMobId || 'Cible',
      targetColorHex: mobDef?.color ? `rgb(${mobDef.color.r},${mobDef.color.g},${mobDef.color.b})` : '#ffbf7a',
      rewardCredits: Math.max(0, progress.rewardCredits | 0 || 0),
      rewardReputationXp: Math.max(0, progress.rewardReputationXp | 0 || 0),
      canComplete: current >= required && isAtOriginStation,
      ready: current >= required,
      isAtOriginStation,
      acceptedAtMs: Math.max(0, progress.acceptedAtMs | 0 || 0)
    };
  }

  const resourceKey = String(progress.resourceKey || '');
  const resourceDef = getResourceDef(resourceKey);
  const current = Math.max(0, Math.min(required, player?.inv?.resources?.[resourceKey] | 0 || 0));
  return {
    questId,
    templateId: String(progress.templateId || ''),
    type: 'deliver_resource',
    name: progress.name || 'Quête pirate',
    description: progress.description || '',
    stationId,
    stationName: progress.stationName || station?.name || 'Station pirate',
    stationSx,
    stationSy,
    current,
    required,
    progressPct: Math.max(0, Math.min(100, Math.round((current / required) * 100))),
    resourceKey,
    resourceName: resourceDef?.name || resourceKey || 'Ressource',
    resourceColorHex: resourceDef?.colorHex || '#cfd7e6',
    rewardCredits: Math.max(0, progress.rewardCredits | 0 || 0),
    rewardReputationXp: Math.max(0, progress.rewardReputationXp | 0 || 0),
    canComplete: current >= required && isAtOriginStation,
    ready: current >= required,
    isAtOriginStation,
    acceptedAtMs: Math.max(0, progress.acceptedAtMs | 0 || 0)
  };
}

export function buildActiveQuestSnapshot(player, state = null) {
  const pirate = ensurePlayerPirateState(player);
  const active = [];
  for (const questId of pirate.activeQuestIds || []) {
    const progress = pirate.questProgress?.[questId] || null;
    const snap = sanitizeQuestProgress(progress, player, state);
    if (snap) active.push(snap);
  }
  active.sort((a, b) => Number(b.ready) - Number(a.ready) || (a.acceptedAtMs || 0) - (b.acceptedAtMs || 0) || String(a.name).localeCompare(String(b.name)));
  return {
    active,
    activeCount: active.length,
    readyCount: active.filter((q) => q.ready).length,
    completableCount: active.filter((q) => q.canComplete).length
  };
}
