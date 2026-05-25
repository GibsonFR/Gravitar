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

export function ensurePlayerPirateState(player) {
  if (!player) return createPlayerPirateState();
  const current = player.pirate && typeof player.pirate === 'object' ? player.pirate : {};
  player.pirate = {
    reputationXp: Math.max(0, Number(current.reputationXp || 0) || 0),
    reputationLevel: Math.max(0, current.reputationLevel | 0 || 0),
    unlockedConversionRecipeIds: Array.isArray(current.unlockedConversionRecipeIds) ? [...new Set(current.unlockedConversionRecipeIds.map((id) => String(id || '').toLowerCase()).filter(Boolean))] : [],
    activeQuestIds: Array.isArray(current.activeQuestIds) ? [...new Set(current.activeQuestIds.map((id) => String(id || '').toLowerCase()).filter(Boolean))] : [],
    completedQuestIds: Array.isArray(current.completedQuestIds) ? [...new Set(current.completedQuestIds.map((id) => String(id || '').toLowerCase()).filter(Boolean))] : [],
    questProgress: current.questProgress && typeof current.questProgress === 'object' ? { ...current.questProgress } : {}
  };
  return player.pirate;
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
