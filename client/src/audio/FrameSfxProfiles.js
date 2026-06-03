export const FRAME_SFX_PROFILES = {
  vanguard: {
    id: 'vanguard',
    auto: { type: 'triangle', base: 740, end: 510, amp: 0.034, click: 0.012, color: 'warm' },
    A: { type: 'triangle', base: 620, amp: 0.036, second: 930, low: 210, color: 'mark' },
    Z: { type: 'sine', base: 360, amp: 0.040, second: 540, low: 145, color: 'dash' },
    E: { type: 'triangle', base: 520, amp: 0.034, second: 780, low: 180, color: 'phase' },
    R: { type: 'triangle', base: 240, amp: 0.052, second: 480, low: 92, color: 'ult' }
  },
  sigil: {
    id: 'sigil',
    auto: { type: 'sine', base: 1020, end: 1320, amp: 0.026, click: 0.006, color: 'glass' },
    A: { type: 'sine', base: 820, amp: 0.030, second: 1230, low: 310, color: 'rune' },
    Z: { type: 'triangle', base: 680, amp: 0.030, second: 1040, low: 240, color: 'veil' },
    E: { type: 'sine', base: 1080, amp: 0.032, second: 1620, low: 360, color: 'blink' },
    R: { type: 'sine', base: 320, amp: 0.047, second: 960, low: 120, color: 'detonate' }
  },
  bulwark: {
    id: 'bulwark',
    auto: { type: 'triangle', base: 390, end: 270, amp: 0.040, click: 0.014, color: 'heavy' },
    A: { type: 'triangle', base: 310, amp: 0.044, second: 465, low: 92, color: 'guard' },
    Z: { type: 'triangle', base: 260, amp: 0.046, second: 390, low: 78, color: 'slam' },
    E: { type: 'sine', base: 220, amp: 0.042, second: 330, low: 70, color: 'bulwark' },
    R: { type: 'triangle', base: 170, amp: 0.060, second: 340, low: 55, color: 'fortress' }
  },
  default: {
    id: 'default',
    auto: { type: 'triangle', base: 690, end: 520, amp: 0.030, click: 0.010, color: 'soft' },
    A: { type: 'triangle', base: 620, amp: 0.032, second: 920, low: 210, color: 'soft' },
    Z: { type: 'triangle', base: 440, amp: 0.034, second: 660, low: 150, color: 'soft' },
    E: { type: 'triangle', base: 760, amp: 0.032, second: 1140, low: 250, color: 'soft' },
    R: { type: 'triangle', base: 260, amp: 0.046, second: 520, low: 95, color: 'soft' }
  }
};

export function getFrameSfxProfile(frameId) {
  const id = String(frameId || '').toLowerCase();
  return FRAME_SFX_PROFILES[id] || FRAME_SFX_PROFILES.default;
}

export function getFrameAbilitySfx(frameId, slot) {
  const profile = getFrameSfxProfile(frameId);
  const s = String(slot || '').toUpperCase();
  return profile[s] || FRAME_SFX_PROFILES.default[s] || FRAME_SFX_PROFILES.default.A;
}
