export const MOB_SFX_PROFILES = Object.freeze({
  mite: { id: 'mite', family: 'metal', autoBase: 420, abilityBase: 310, color: 'metal', amp: 0.030 },
  scoria: { id: 'scoria', family: 'volatile', autoBase: 260, abilityBase: 180, color: 'fire', amp: 0.038 },
  stinger: { id: 'stinger', family: 'crystal', autoBase: 940, abilityBase: 1120, color: 'glass', amp: 0.026 },
  lancer: { id: 'lancer', family: 'crystal', autoBase: 1180, abilityBase: 1420, color: 'prism', amp: 0.032 },
  nodule: { id: 'nodule', family: 'sentinel', autoBase: 520, abilityBase: 280, color: 'lock', amp: 0.034 },
  crusher: { id: 'crusher', family: 'metal', autoBase: 210, abilityBase: 120, color: 'heavy', amp: 0.046 },
  warden: { id: 'warden', family: 'electric', autoBase: 760, abilityBase: 920, color: 'arc', amp: 0.034 },
  specter: { id: 'specter', family: 'anomaly', autoBase: 880, abilityBase: 660, color: 'void', amp: 0.030 },
  hydra: { id: 'hydra', family: 'organic', autoBase: 360, abilityBase: 300, color: 'toxic', amp: 0.036 },
  apex: { id: 'apex', family: 'apex', autoBase: 310, abilityBase: 220, color: 'apex', amp: 0.046 },
  default: { id: 'default', family: 'generic', autoBase: 520, abilityBase: 420, color: 'soft', amp: 0.030 }
});

export function getMobSfxProfile(profileId = '') {
  const id = String(profileId || '').toLowerCase();
  return MOB_SFX_PROFILES[id] || MOB_SFX_PROFILES.default;
}
