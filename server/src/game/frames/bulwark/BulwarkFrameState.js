export function createBulwarkFrameState() {
  return {
    plateDurations: [],
    plateGainIcdLeft: 0,
    anchorLeft: 0,
    anchorArmorFlat: 0,
    anchorPulseRadius: 0,
    anchorPulseSlowPct: 0,
    anchorPulseSlowDuration: 0,
    meditationLeft: 0,
    meditationShieldQueued: 0,
    meditationFinalSlowPct: 0,
    meditationFinalSlowDuration: 0,
    meditationPulseRadius: 0,
    meditationFinalGroundedDuration: 0,
    harpoonHasteLeft: 0,
    harpoonHastePct: 0,
    stormLeft: 0,
    stormTickLeft: 0,
    stormPullTickLeft: 0,
    stormShieldTickLeft: 0,
    stormShieldGained: 0,
    stormArmorStolen: 0,
    stormExposureById: Object.create(null)
  };
}
