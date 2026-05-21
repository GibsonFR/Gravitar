import { STATUS_EFFECT_FLAGS as F } from './StatusEffectFlags.js';

export function hasStatusFlag(def, flag) { return ((def?.flags ?? 0) & flag) !== 0; }
export function isPersistentStatus(def) { return hasStatusFlag(def, F.PERSISTENT); }
export function isBuffStatus(def) { return hasStatusFlag(def, F.BUFF); }
export function isDebuffStatus(def) { return hasStatusFlag(def, F.DEBUFF); }
export function isCleanseableStatus(def) { return hasStatusFlag(def, F.CLEANSEABLE); }
export function isReducedByTenacityStatus(def) { return hasStatusFlag(def, F.REDUCED_BY_TENACITY); }
export function isBlockedBySpellShieldStatus(def) { return hasStatusFlag(def, F.BLOCKED_BY_SPELL_SHIELD); }
export function breaksOnExternalHitStatus(def) { return hasStatusFlag(def, F.BREAK_ON_EXTERNAL_HIT); }
export function supportsStacksStatus(def) { return hasStatusFlag(def, F.SUPPORTS_STACKS); }
export function showHudIconForStatus(def) { return isPersistentStatus(def) && !hasStatusFlag(def, F.HIDDEN_FROM_HUD_ICON); }
export function showWorldIconForStatus(def) { return isPersistentStatus(def) && !hasStatusFlag(def, F.HIDDEN_FROM_WORLD_ICON); }
