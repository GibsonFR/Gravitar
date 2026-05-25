import { nextReputationXpForLevel, reputationLevelForXp } from '../../../../../shared/content/pirate/PirateQuestDefs.js';

export function createPlayerPirateState() {
  return {
    reputationXp: 0,
    reputationLevel: 0,
    unlockedConversionRecipeIds: [],
    activeQuestIds: [],
    completedQuestIds: [],
    questProgress: {}
  };
}

function normalizeIdList(list) {
  return Array.isArray(list) ? [...new Set(list.map((id) => String(id || '').toLowerCase()).filter(Boolean))] : [];
}

export function ensurePlayerPirateState(player) {
  if (!player) return createPlayerPirateState();
  const current = player.pirate && typeof player.pirate === 'object' ? player.pirate : {};
  const reputationXp = Math.max(0, Number(current.reputationXp || 0) || 0);
  const reputationLevel = reputationLevelForXp(reputationXp);
  player.pirate = {
    reputationXp,
    reputationLevel,
    unlockedConversionRecipeIds: normalizeIdList(current.unlockedConversionRecipeIds),
    activeQuestIds: normalizeIdList(current.activeQuestIds),
    completedQuestIds: normalizeIdList(current.completedQuestIds),
    questProgress: current.questProgress && typeof current.questProgress === 'object' ? { ...current.questProgress } : {}
  };
  for (const [questId, progress] of Object.entries(player.pirate.questProgress || {})) {
    if (!progress || typeof progress !== 'object') { delete player.pirate.questProgress[questId]; continue; }
    const cleanId = String(progress.questId || questId || '').toLowerCase();
    if (!cleanId) { delete player.pirate.questProgress[questId]; continue; }
    player.pirate.questProgress[cleanId] = {
      ...progress,
      questId: cleanId,
      current: Math.max(0, progress.current | 0 || 0),
      required: Math.max(1, progress.required | 0 || 1),
      rewardCredits: Math.max(0, progress.rewardCredits | 0 || 0),
      rewardReputationXp: Math.max(0, progress.rewardReputationXp | 0 || 0),
      targetMobId: progress.targetMobId || '',
      targetName: progress.targetName || '',
      resourceKey: progress.resourceKey || ''
    };
    if (cleanId !== questId) delete player.pirate.questProgress[questId];
  }
  return player.pirate;
}

export function addPirateReputationXp(player, amount = 0) {
  const pirate = ensurePlayerPirateState(player);
  const add = Math.max(0, Number(amount || 0) || 0);
  if (add <= 0) return pirate;
  pirate.reputationXp = Math.max(0, Number(pirate.reputationXp || 0) + add);
  pirate.reputationLevel = reputationLevelForXp(pirate.reputationXp);
  return pirate;
}

export function getPirateReputationSnapshot(player) {
  const pirate = ensurePlayerPirateState(player);
  return {
    reputationXp: Math.round(Number(pirate.reputationXp || 0)),
    reputationLevel: Math.max(0, pirate.reputationLevel | 0 || 0),
    nextReputationXp: nextReputationXpForLevel(pirate.reputationLevel | 0 || 0)
  };
}

export function hasUnlockedConversionRecipe(player, recipeId) {
  const pirate = ensurePlayerPirateState(player);
  return pirate.unlockedConversionRecipeIds.includes(String(recipeId || '').toLowerCase());
}

export function unlockConversionRecipe(player, recipeId) {
  const id = String(recipeId || '').toLowerCase();
  if (!id) return false;
  const pirate = ensurePlayerPirateState(player);
  if (pirate.unlockedConversionRecipeIds.includes(id)) return false;
  pirate.unlockedConversionRecipeIds.push(id);
  pirate.unlockedConversionRecipeIds.sort();
  return true;
}

export function acceptPirateQuest(player, quest) {
  const pirate = ensurePlayerPirateState(player);
  const questId = String(quest?.questId || '').toLowerCase();
  if (!questId || pirate.activeQuestIds.includes(questId) || pirate.completedQuestIds.includes(questId)) return false;
  pirate.activeQuestIds.push(questId);
  pirate.activeQuestIds.sort();
  pirate.questProgress[questId] = {
    questId,
    templateId: String(quest.templateId || ''),
    stationId: quest.stationId | 0 || 0,
    type: quest.type || '',
    name: quest.name || 'Quête pirate',
    resourceKey: quest.resourceKey || '',
    targetMobId: quest.targetMobId || '',
    targetName: quest.targetName || '',
    current: 0,
    required: Math.max(1, quest.required | 0 || 1),
    rewardCredits: Math.max(0, quest.rewardCredits | 0 || 0),
    rewardReputationXp: Math.max(0, quest.rewardReputationXp | 0 || 0),
    acceptedAtMs: Math.max(0, quest.acceptedAtMs | 0 || 0)
  };
  return true;
}

export function abandonPirateQuest(player, questIdRaw) {
  const pirate = ensurePlayerPirateState(player);
  const questId = String(questIdRaw || '').toLowerCase();
  if (!questId || !pirate.activeQuestIds.includes(questId)) return false;
  pirate.activeQuestIds = pirate.activeQuestIds.filter((id) => id !== questId);
  delete pirate.questProgress[questId];
  return true;
}

export function completePirateQuest(player, questIdRaw) {
  const pirate = ensurePlayerPirateState(player);
  const questId = String(questIdRaw || '').toLowerCase();
  if (!questId || !pirate.activeQuestIds.includes(questId)) return null;
  const progress = pirate.questProgress[questId];
  if (!progress) return null;
  pirate.activeQuestIds = pirate.activeQuestIds.filter((id) => id !== questId);
  if (!pirate.completedQuestIds.includes(questId)) pirate.completedQuestIds.push(questId);
  pirate.completedQuestIds.sort();
  delete pirate.questProgress[questId];
  return progress;
}


export function registerPirateQuestKill(player, mobIdRaw) {
  const mobId = String(mobIdRaw || '').toLowerCase();
  if (!player || !mobId) return [];
  const pirate = ensurePlayerPirateState(player);
  const changed = [];
  for (const questId of pirate.activeQuestIds || []) {
    const progress = pirate.questProgress?.[questId];
    if (!progress || progress.type !== 'kill_mob') continue;
    if (String(progress.targetMobId || '').toLowerCase() !== mobId) continue;
    const required = Math.max(1, progress.required | 0 || 1);
    const next = Math.min(required, Math.max(0, progress.current | 0 || 0) + 1);
    if (next === progress.current) continue;
    progress.current = next;
    changed.push({ questId, current: next, required, name: progress.name || 'Quête pirate' });
  }
  if (changed.length) player.forceFullUiSnapshot = true;
  return changed;
}
