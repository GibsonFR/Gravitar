import { getEquippedEquipmentDefs } from '../equipment/EquipmentBonuses.js';
import { isConverterEnabled } from '../equipment/EquipmentRules.js';
import { ITEM_CATEGORY_IDS } from '../../../../shared/content/items/ItemCategoryIds.js';
import { consumeEnergy } from '../stats/StatBlockRuntime.js';
import { addResource, canAddResource, removeResource } from '../inventory/InventorySystem.js';

function getEquippedConverters(player) {
  return getEquippedEquipmentDefs(player).filter((def) => def?.categoryId === ITEM_CATEGORY_IDS.CONVERTER && def?.converterProfile);
}

function ensureRuntime(player, converterId) {
  const table = player?.equipment?.converterRuntimeById ?? (player.equipment.converterRuntimeById = {});
  if (!table[converterId]) table[converterId] = { progress: 0, cycles: 0, blockedReason: '', blockedLabel: '' };
  return table[converterId];
}

function setBlocked(runtime, reason = '', label = '') {
  runtime.blockedReason = reason;
  runtime.blockedLabel = label;
}

function disableConverter(player, converterId, runtime, reason = 'disabled', label = 'coupé') {
  const table = player?.equipment?.converterEnabledById ?? (player.equipment.converterEnabledById = {});
  table[converterId] = false;
  runtime.enabled = false;
  setBlocked(runtime, reason, label);
}

export function updateConverters(state, dt, timeMs = 0) {
  void timeMs;
  for (const player of state.players.values()) {
    if (!player?.stats || !player?.inv || player.stats.hp <= 0) continue;
    const converters = getEquippedConverters(player);
    for (const def of converters) {
      const runtime = ensureRuntime(player, def.id);
      runtime.enabled = isConverterEnabled(player, def.id);
      if (!runtime.enabled) {
        setBlocked(runtime, 'disabled', 'coupé');
        continue;
      }

      const profile = def.converterProfile;
      if (!profile?.inputKey || !profile?.outputKey) {
        setBlocked(runtime, 'invalid_profile', 'profil invalide');
        continue;
      }

      const inputAmount = Math.max(1, profile.inputAmount | 0);
      const outputAmount = Math.max(1, profile.outputAmount | 0);
      const seconds = Math.max(0.2, profile.seconds ?? 1);
      const energyPerSecond = Math.max(0, profile.energyPerSecond ?? 0);

      if (energyPerSecond > 0) {
        const energyNeed = energyPerSecond * dt;
        if (!consumeEnergy(player.stats, energyNeed)) {
          disableConverter(player, def.id, runtime, 'no_energy', 'énergie insuffisante');
          continue;
        }
      }

      const inputAvailable = player.inv.resources?.[profile.inputKey] || 0;
      if (inputAvailable < inputAmount) {
        setBlocked(runtime, 'no_input', 'ressource insuffisante');
        continue;
      }

      if (!canAddResource(player.inv, profile.outputKey, outputAmount)) {
        setBlocked(runtime, 'cargo_full', 'soute pleine');
        continue;
      }

      runtime.progress += dt;
      setBlocked(runtime, '', '');

      let converted = false;
      while (runtime.progress >= seconds) {
        const currentInput = player.inv.resources?.[profile.inputKey] || 0;
        if (currentInput < inputAmount) {
          setBlocked(runtime, 'no_input', 'ressource insuffisante');
          break;
        }
        if (!canAddResource(player.inv, profile.outputKey, outputAmount)) {
          setBlocked(runtime, 'cargo_full', 'soute pleine');
          break;
        }

        const removed = removeResource(player.inv, profile.inputKey, inputAmount);
        if (removed < inputAmount) {
          setBlocked(runtime, 'no_input', 'ressource insuffisante');
          break;
        }

        const added = addResource(player.inv, profile.outputKey, outputAmount);
        if (added < outputAmount) {
          if (added > 0) removeResource(player.inv, profile.outputKey, added);
          addResource(player.inv, profile.inputKey, removed);
          setBlocked(runtime, 'cargo_full', 'soute pleine');
          break;
        }

        runtime.progress -= seconds;
        runtime.cycles = (runtime.cycles | 0) + 1;
        converted = true;
      }

      if (converted && !runtime.blockedReason) setBlocked(runtime, 'running', 'actif');
      if (!converted && !runtime.blockedReason) setBlocked(runtime, 'running', 'actif');
    }
  }
}
