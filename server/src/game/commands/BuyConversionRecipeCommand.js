import { getConversionRecipe } from '../../../../shared/content/conversion/ConversionRecipeDefs.js';
import { ensurePlayerPirateState, hasUnlockedConversionRecipe, unlockConversionRecipe } from '../player/runtime/PlayerPirateState.js';

function findRecipeOffer(station, recipeId) {
  const id = String(recipeId || '').toLowerCase();
  return (station?.stock?.conversionRecipeOffers || []).find((offer) => String(offer?.recipeId || '').toLowerCase() === id) || null;
}

export function handleBuyConversionRecipe(state, player, msg) {
  if (!player?.inv) return false;
  const recipeId = String(msg?.recipeId || '').toLowerCase();
  const recipe = getConversionRecipe(recipeId);
  if (!recipe) return false;
  const sid = Math.floor(Number(player.dockedStationId) || 0);
  if (!sid) return false;
  const station = state?.stations?.get?.(sid) ?? null;
  if (!station || !station.pirate) return false;
  if ((station.sx | 0) !== (player.sx | 0) || (station.sy | 0) !== (player.sy | 0)) return false;

  const offer = findRecipeOffer(station, recipe.id);
  if (!offer || offer.soldOut) return false;
  const pirate = ensurePlayerPirateState(player);
  if (hasUnlockedConversionRecipe(player, recipe.id)) return false;
  const reputationRequired = Math.max(0, offer.reputationRequired | 0 || recipe.reputationRequired | 0 || 0);
  if ((pirate.reputationLevel | 0) < reputationRequired) return false;
  const price = Math.max(1, offer.priceCredits | 0 || recipe.piratePrice | 0 || 1);
  if ((player.inv.credits | 0) < price) return false;

  player.inv.credits = Math.max(0, (player.inv.credits | 0) - price);
  unlockConversionRecipe(player, recipe.id);
  player.forceFullUiSnapshot = true;
  player.hint = `Recette débloquée : ${recipe.name}`;
  player._optimisticHintLeft = 1.8;
  return true;
}
