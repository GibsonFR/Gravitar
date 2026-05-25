import { RESOURCE_DEFS } from '../resources/ResourceDefs.js';
import { MOB_DEFS, MOB_IDS } from '../mobs/MobDefs.js';

export const PIRATE_REPUTATION_THRESHOLDS = Object.freeze([0, 100, 300, 700, 1400, 2500]);

export const PIRATE_QUEST_TYPES = Object.freeze({
  DELIVER_RESOURCE: 'deliver_resource',
  KILL_MOB: 'kill_mob'
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

const KILL_TEMPLATES = Object.freeze([
  { id: 'kill_ferrous_mites_t1', type: PIRATE_QUEST_TYPES.KILL_MOB, name: 'Nettoyage de mites ferreuses', targetMobId: MOB_IDS.FERROUS_MITE, required: 5, rewardCredits: 230, rewardReputationXp: 36, stationTierMin: 1 },
  { id: 'kill_scoria_sappers_t2', type: PIRATE_QUEST_TYPES.KILL_MOB, name: 'Contrat : sapeurs de scories', targetMobId: MOB_IDS.SCORIA_SAPPER, required: 4, rewardCredits: 340, rewardReputationXp: 48, stationTierMin: 2 },
  { id: 'kill_orbital_stingers_t2', type: PIRATE_QUEST_TYPES.KILL_MOB, name: 'Chasse aux dards orbitaux', targetMobId: MOB_IDS.ORBITAL_STINGER, required: 4, rewardCredits: 360, rewardReputationXp: 52, stationTierMin: 2 },
  { id: 'kill_prismatic_lancers_t3', type: PIRATE_QUEST_TYPES.KILL_MOB, name: 'Prime : lanciers prismatiques', targetMobId: MOB_IDS.PRISMATIC_LANCER, required: 3, rewardCredits: 620, rewardReputationXp: 78, stationTierMin: 3 },
  { id: 'kill_sentinel_nodules_t3', type: PIRATE_QUEST_TYPES.KILL_MOB, name: 'Sabotage de nodules sentinelles', targetMobId: MOB_IDS.SENTINEL_NODULE, required: 3, rewardCredits: 660, rewardReputationXp: 84, stationTierMin: 3 }
]);

function mobName(mobId) {
  return MOB_DEFS[mobId]?.name || mobId || 'cible';
}

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
  return [...DELIVERY_TEMPLATES, ...KILL_TEMPLATES];
}

export function createPirateQuestOffers(options = {}) {
  const stationSeed = options.stationSeed | 0;
  const pirateTier = Math.max(1, options.pirateTier | 0 || 1);
  const localKeys = new Set((options.resourceKeys || []).map((key) => String(key || '')));
  const scale = 1 + Math.max(0, pirateTier - 1) * 0.18;

  const delivery = DELIVERY_TEMPLATES
    .filter((tpl) => pirateTier >= Math.max(1, tpl.stationTierMin | 0 || 1))
    .map((tpl, index) => {
      const localBonus = localKeys.has(tpl.resourceKey) ? -2000 : 0;
      return { tpl, source: 'delivery', score: Math.abs(hashText(`${stationSeed}:${tpl.id}`)) + localBonus + index * 17 };
    })
    .sort((a, b) => a.score - b.score);

  const kill = KILL_TEMPLATES
    .filter((tpl) => pirateTier >= Math.max(1, tpl.stationTierMin | 0 || 1))
    .map((tpl, index) => ({ tpl, source: 'kill', score: Math.abs(hashText(`${stationSeed}:kill:${tpl.id}`)) + index * 31 }))
    .sort((a, b) => a.score - b.score);

  const count = Math.max(2, Math.min(4, 2 + Math.floor(pirateTier / 2)));
  const picked = [];
  if (delivery[0]) picked.push(delivery[0]);
  if (kill[0]) picked.push(kill[0]);
  for (const candidate of [...delivery.slice(1), ...kill.slice(1)].sort((a, b) => a.score - b.score)) {
    if (picked.length >= count) break;
    if (!picked.some((p) => p.tpl.id === candidate.tpl.id)) picked.push(candidate);
  }

  return picked.map(({ tpl }, index) => {
    const required = Math.max(1, Math.round(tpl.required * scale));
    const rewardCredits = Math.max(1, Math.round(tpl.rewardCredits * (1 + Math.max(0, pirateTier - 1) * 0.35)));
    const rewardReputationXp = Math.max(1, Math.round(tpl.rewardReputationXp * (1 + Math.max(0, pirateTier - 1) * 0.22)));
    const base = {
      questId: questIdFor(stationSeed, tpl.id, index),
      templateId: tpl.id,
      type: tpl.type,
      name: tpl.name,
      required,
      rewardCredits,
      rewardReputationXp,
      stationTierMin: tpl.stationTierMin | 0 || 1,
      pirateTier
    };
    if (tpl.type === PIRATE_QUEST_TYPES.KILL_MOB) {
      return {
        ...base,
        targetMobId: tpl.targetMobId,
        targetName: mobName(tpl.targetMobId),
        description: `Éliminer ${required} × ${mobName(tpl.targetMobId)} pour cette station pirate.`
      };
    }
    return {
      ...base,
      resourceKey: tpl.resourceKey,
      description: `Livrer ${required} × ${resourceName(tpl.resourceKey)} à cette station pirate.`
    };
  });}
