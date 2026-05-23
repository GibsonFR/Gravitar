import { getRefineryRecipe } from '../../../../shared/content/crafting/RefineryRecipes.js';
import { addResource, canAddResource, removeResource } from '../inventory/InventorySystem.js';
import { getResourceDef } from '../inventory/ResourceDefs.js';
import { getDockedStation } from '../station/StationAccess.js';
import { setPlayerHint } from '../player/PlayerUiHints.js';

function normalizeCycles(value) {
  const n = Number.isFinite(value) ? Math.floor(value) : Math.floor(Number(value) || 0);
  return Math.max(1, Math.min(25, n));
}

function getResourceAmount(inv, key) {
  return Math.max(0, inv?.resources?.[key] || 0);
}

function canAfford(inv, input, cycles) {
  for (const [key, amount] of Object.entries(input || {})) {
    const need = Math.max(0, amount | 0) * cycles;
    if (need > 0 && getResourceAmount(inv, key) < need) return false;
  }
  return true;
}

function canStoreOutputs(inv, output, cycles) {
  let extraCargo = 0;
  for (const [key, amount] of Object.entries(output || {})) {
    const def = getResourceDef(key);
    if (!def) return false;
    extraCargo += (def.cargoPerUnit || 1) * Math.max(0, amount | 0) * cycles;
  }
  return (inv.cargoUsed + extraCargo) <= inv.cargoMax;
}

export function handleRefineResource(state, player, msg, timeMs) {
  void timeMs;
  const station = getDockedStation(state, player);
  if (!station) {
    setPlayerHint(player, 'Raffinage disponible uniquement en station', 1.8);
    return false;
  }

  const recipe = getRefineryRecipe(msg?.recipeId);
  if (!recipe) {
    setPlayerHint(player, 'Recette de raffinage inconnue', 1.8);
    return false;
  }

  const cycles = normalizeCycles(msg?.cycles);
  const inv = player?.inv;
  if (!inv?.resources) return false;

  if (!canAfford(inv, recipe.input, cycles)) {
    setPlayerHint(player, 'Ressources insuffisantes', 1.8);
    return false;
  }

  if (!canStoreOutputs(inv, recipe.output, cycles)) {
    setPlayerHint(player, 'Soute pleine', 1.8);
    return false;
  }

  const removed = [];
  for (const [key, amount] of Object.entries(recipe.input || {})) {
    const need = Math.max(0, amount | 0) * cycles;
    if (need <= 0) continue;
    const got = removeResource(inv, key, need);
    removed.push([key, got]);
    if (got < need) {
      for (const [rk, ra] of removed) if (ra > 0) addResource(inv, rk, ra);
      setPlayerHint(player, 'Ressources insuffisantes', 1.8);
      return false;
    }
  }

  const added = [];
  for (const [key, amount] of Object.entries(recipe.output || {})) {
    const out = Math.max(0, amount | 0) * cycles;
    if (out <= 0) continue;
    if (!canAddResource(inv, key, out)) {
      for (const [ak, aa] of added) if (aa > 0) removeResource(inv, ak, aa);
      for (const [rk, ra] of removed) if (ra > 0) addResource(inv, rk, ra);
      setPlayerHint(player, 'Soute pleine', 1.8);
      return false;
    }
    const ok = addResource(inv, key, out);
    added.push([key, ok]);
    if (ok < out) {
      for (const [ak, aa] of added) if (aa > 0) removeResource(inv, ak, aa);
      for (const [rk, ra] of removed) if (ra > 0) addResource(inv, rk, ra);
      setPlayerHint(player, 'Soute pleine', 1.8);
      return false;
    }
  }

  const firstOut = Object.keys(recipe.output || {})[0] || '';
  const outDef = firstOut ? getResourceDef(firstOut) : null;
  setPlayerHint(player, `${recipe.name || outDef?.name || 'Raffinage'} x${cycles}`, 1.4);
  return true;
}
