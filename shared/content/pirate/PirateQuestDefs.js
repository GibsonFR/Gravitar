import { RESOURCE_DEFS } from '../resources/ResourceDefs.js';

export const PIRATE_REPUTATION_THRESHOLDS = Object.freeze([0, 100, 300, 700, 1400, 2500]);

export const PIRATE_QUEST_TYPES = Object.freeze({
  DELIVER_RESOURCE: 'deliver_resource'
});

const DELIVERY_TEMPLATES = Object.freeze([
  { id: 'deliver_iron_ore_t1', type: PIRATE_QUEST_TYPES.DELIVER_RESOURCE, name: 'Livraison de fer', resourceKey: 'ironOre', required: 45, rewardCredits: 160, rewardReputationXp: 24, stationTierMin: 1 },
  { id: 'deliver_copper_t1', type: PIRATE_QUEST_TYPES.DELIVER_RESOURCE, name: 'Cargaison de cuivre', resourceKey: 'copper', required: 45, rewardCredits: 160, rewardReputationXp: 24, stationTierMin: 1 },
  { id: 'deliver_graphite_t1', type: PIRATE_QUEST_TYPES.DELIVER_RESOURCE, name: 'Graphite discret', resourceKey: 'graphite', required: 35, rewardCredits: 210, rewardReputationXp: 30, stationTierMin: 1 },
  { id: 'deliver_quartz_t1', type: PIRATE_QUEST_TYPES.DELIVER_RESOURCE, name: 'Quartz non déclaré', resourceKey: 'quartz', required: 36, rewardCredits: 190, rewardReputationXp: 28, stationTierMin: 1 },
  { id: 'deliver_propellant_t2', type: PIRATE_QUEST_TYPES.DELIVER_RESOURCE, name: 'Propergol sous le manteau', resourceKey: 'propellant', required: 22, rewardCredits: 360, rewardReputationXp: 48, stationTierMin: 2 },
  { id: 'deliver_titanium_t2', type: PIRATE_QUEST_TYPES.DELIVER_RESOURCE, name: 'Titane hors registre', resourceKey: 'titaniumOre', required: 22, rewardCredits: 420, rewardReputationXp: 52, stationTierMin: 2 },
  { id: 'deliver_control_circuit_t3', type: PIRATE_QUEST_TYPES.DELIVER_RESOURCE, name: 'Circuits effacés', resourceKey: 'controlCircuit', required: 6, rewardCredits: 740, rewardReputationXp: 86, stationTierMin: 3 },
  { id: 'deliver_unknown_fragment_t3', type: PIRATE_QUEST_TYPES.DELIVER_RESOURCE, name: 'Fragments interdits', resourceKey: 'unknownTechFragment', required: 3, rewardCredits: 920, rewardReputationXp: 110, stationTierMin: 3 }
]);

function hashText(str) {
  let h = 2166136261 | 0;
  for (let i = 0; i < String(str || '').length; i += 1) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

function resourceName(resourceKey) {
  return RESOURCE_DEFS[resourceKey]?.name || resourceKey;
}

function questIdFor(stationSeed, templateId, index) {
  const h = Math.abs(hashText(`${stationSeed}:${templateId}:${index}`));
  return `pq_${String(templateId || 'quest').toLowerCase()}_${h.toString(36)}`.replace(/[^a-z0-9_\-]/g, '_');
}

export function reputationLevelForXp(xp) {
  const value = Math.max(0, Number(xp || 0) || 0);
  let level = 0;
  for (let i = 0; i < PIRATE_REPUTATION_THRESHOLDS.length; i += 1) {
    if (value >= PIRATE_REPUTATION_THRESHOLDS[i]) level = i;
  }
  return level;
}

export function nextReputationXpForLevel(level) {
  const idx = Math.max(0, Math.min(PIRATE_REPUTATION_THRESHOLDS.length - 1, (level | 0) + 1));
  return PIRATE_REPUTATION_THRESHOLDS[idx] ?? PIRATE_REPUTATION_THRESHOLDS[PIRATE_REPUTATION_THRESHOLDS.length - 1];
}

export function listPirateQuestTemplates() {
  return DELIVERY_TEMPLATES.slice();
}

export function createPirateQuestOffers(options = {}) {
  const stationSeed = options.stationSeed | 0;
  const pirateTier = Math.max(1, options.pirateTier | 0 || 1);
  const localKeys = new Set((options.resourceKeys || []).map((key) => String(key || '')));
  const eligible = DELIVERY_TEMPLATES
    .filter((tpl) => pirateTier >= Math.max(1, tpl.stationTierMin | 0 || 1))
    .map((tpl, index) => {
      const localBonus = localKeys.has(tpl.resourceKey) ? -2000 : 0;
      return { tpl, score: Math.abs(hashText(`${stationSeed}:${tpl.id}`)) + localBonus + index * 17 };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, Math.max(2, Math.min(3, 1 + pirateTier)));

  return eligible.map(({ tpl }, index) => {
    const scale = 1 + Math.max(0, pirateTier - 1) * 0.18;
    const required = Math.max(1, Math.round(tpl.required * scale));
    const rewardCredits = Math.max(1, Math.round(tpl.rewardCredits * (1 + Math.max(0, pirateTier - 1) * 0.35)));
    const rewardReputationXp = Math.max(1, Math.round(tpl.rewardReputationXp * (1 + Math.max(0, pirateTier - 1) * 0.22)));
    return {
      questId: questIdFor(stationSeed, tpl.id, index),
      templateId: tpl.id,
      type: tpl.type,
      name: tpl.name,
      description: `Livrer ${required} × ${resourceName(tpl.resourceKey)} à cette station pirate.`,
      resourceKey: tpl.resourceKey,
      required,
      rewardCredits,
      rewardReputationXp,
      stationTierMin: tpl.stationTierMin | 0 || 1,
      pirateTier
    };
  });
}
