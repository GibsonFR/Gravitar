import { STATUS_EFFECT_IDS as I } from "./StatusEffectIds.js";
import { STATUS_EFFECT_FAMILIES as FAM } from "./StatusEffectFamilies.js";
import { STATUS_EFFECT_FLAGS as F } from "./StatusEffectFlags.js";
import { showHudIconForStatus, showWorldIconForStatus } from "./StatusEffectRules.js";

function color(r, g, b) { return { r, g, b }; }

function def(id, name, shortName, description, family, flags, priority, primaryColor, secondaryColor) {
  const entry = { id, name, shortName, description, family, flags, priority, primaryColor, secondaryColor };
  return Object.freeze({ ...entry, showHudIcon: showHudIconForStatus(entry), showWorldIcon: showWorldIconForStatus(entry) });
}

export const STATUS_EFFECT_DEFS = Object.freeze({
  [I.STUN]: def(I.STUN, "Stun", "Stun", "Bloque déplacement, attaques et sorts.", FAM.CONTROL_PHYSICAL, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.REDUCED_BY_TENACITY | F.BLOCKED_BY_SPELL_SHIELD, 100, color(255, 224, 122), color(255, 245, 205)),
  [I.ROOT]: def(I.ROOT, "Root", "Root", "Empêche le déplacement mais laisse les attaques et sorts possibles.", FAM.CONTROL_PHYSICAL, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.REDUCED_BY_TENACITY | F.BLOCKED_BY_SPELL_SHIELD, 88, color(132, 224, 180), color(196, 255, 225)),
  [I.SILENCE]: def(I.SILENCE, "Silence", "Sil", "Empêche l'utilisation des sorts.", FAM.ANTI_CAST, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.REDUCED_BY_TENACITY | F.BLOCKED_BY_SPELL_SHIELD, 84, color(182, 148, 255), color(225, 214, 255)),
  [I.DISARM]: def(I.DISARM, "Disarm", "Dis", "Empêche les attaques de base.", FAM.ANTI_CAST, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.REDUCED_BY_TENACITY | F.BLOCKED_BY_SPELL_SHIELD, 82, color(120, 178, 255), color(196, 221, 255)),
  [I.GROUNDED]: def(I.GROUNDED, "Grounded", "Grd", "Interdit dashs, blinks et recasts de mobilité.", FAM.CONTROL_PHYSICAL, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.BLOCKED_BY_SPELL_SHIELD, 86, color(214, 164, 95), color(255, 218, 164)),
  [I.KNOCKUP]: def(I.KNOCKUP, "Knockup", "Air", "Airborne : contrôle dur non nettoyable par Cleanse standard.", FAM.FORCED_MOVEMENT, F.PERSISTENT | F.DEBUFF | F.BLOCKED_BY_SPELL_SHIELD, 97, color(165, 214, 255), color(226, 244, 255)),
  [I.SUPPRESS]: def(I.SUPPRESS, "Suppress", "Sup", "Contrôle absolu : bloque tout et ignore le Cleanse standard.", FAM.CONTROL_PHYSICAL, F.PERSISTENT | F.DEBUFF | F.BLOCKED_BY_SPELL_SHIELD, 99, color(154, 84, 255), color(238, 128, 255)),
  [I.SLEEP]: def(I.SLEEP, "Sleep", "Slp", "Désactive la cible jusqu'à la fin du timer ou la prochaine agression extérieure.", FAM.CONTROL_MENTAL, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.REDUCED_BY_TENACITY | F.BLOCKED_BY_SPELL_SHIELD | F.BREAK_ON_EXTERNAL_HIT, 93, color(132, 164, 255), color(204, 224, 255)),
  [I.STASIS]: def(I.STASIS, "Stasis", "Sta", "État Zhonya : invulnérable et incapable d'agir.", FAM.DEFENSE, F.PERSISTENT | F.HIDDEN_FROM_WORLD_ICON, 98, color(255, 205, 74), color(255, 242, 170)),
  [I.FEAR]: def(I.FEAR, "Fear", "Fear", "Force la fuite à vitesse normale et verrouille attaques et sorts.", FAM.CONTROL_MENTAL, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.REDUCED_BY_TENACITY | F.BLOCKED_BY_SPELL_SHIELD, 91, color(222, 89, 170), color(255, 170, 220)),
  [I.CHARM]: def(I.CHARM, "Charm", "Charm", "Force l'approche vers le lanceur à vitesse normale et verrouille attaques et sorts.", FAM.CONTROL_MENTAL, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.REDUCED_BY_TENACITY | F.BLOCKED_BY_SPELL_SHIELD, 90, color(255, 110, 188), color(255, 197, 225)),
  [I.TAUNT]: def(I.TAUNT, "Taunt", "Taunt", "Force l'approche et l'auto-attaque sur le provocateur.", FAM.CONTROL_MENTAL, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.REDUCED_BY_TENACITY | F.BLOCKED_BY_SPELL_SHIELD, 92, color(255, 110, 110), color(255, 190, 190)),
  [I.BLIND]: def(I.BLIND, "Blind", "Blind", "Réduit fortement la lecture visuelle et les acquisitions de cible.", FAM.STEALTH_VISION, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.BLOCKED_BY_SPELL_SHIELD, 75, color(214, 198, 126), color(255, 234, 166)),
  [I.REVEAL]: def(I.REVEAL, "Reveal", "Rev", "Révèle camouflage et cloak de combat.", FAM.STEALTH_VISION, F.PERSISTENT | F.DEBUFF | F.BLOCKED_BY_SPELL_SHIELD, 80, color(90, 244, 255), color(188, 255, 255)),
  [I.CAMOUFLAGE]: def(I.CAMOUFLAGE, "Camouflage", "Camo", "Furtivité fantomatique : inciblable tant qu'elle n'est pas révélée.", FAM.STEALTH_VISION, F.PERSISTENT | F.BUFF | F.HIDDEN_FROM_WORLD_ICON, 65, color(109, 79, 255), color(188, 168, 255)),
  [I.COMBAT_CLOAK]: def(I.COMBAT_CLOAK, "Combat Cloak", "Cloak", "Alias legacy de Camouflage conservé pour compatibilité.", FAM.STEALTH_VISION, F.PERSISTENT | F.BUFF | F.HIDDEN_FROM_WORLD_ICON | F.HIDDEN_FROM_HUD_ICON, 20, color(98, 70, 255), color(154, 138, 255)),
  [I.TRUE_SIGHT]: def(I.TRUE_SIGHT, "True Sight", "Oracle", "Vision révélatrice : permet de détecter les unités camouflées.", FAM.STEALTH_VISION, F.PERSISTENT | F.BUFF, 68, color(120, 250, 255), color(235, 255, 255)),
  [I.UNTARGETABLE]: def(I.UNTARGETABLE, "Untargetable", "Phase", "La cible ne peut plus être verrouillée.", FAM.DEFENSE, F.PERSISTENT | F.BUFF, 89, color(236, 236, 255), color(180, 190, 255)),
  [I.INVULNERABLE]: def(I.INVULNERABLE, "Invulnerable", "Inv", "Ignore tous les dégâts entrants.", FAM.DEFENSE, F.PERSISTENT | F.BUFF, 95, color(255, 246, 196), color(255, 255, 255)),
  [I.SPELL_SHIELD]: def(I.SPELL_SHIELD, "Spell Shield", "SS", "Absorbe la prochaine application hostile.", FAM.DEFENSE, F.PERSISTENT | F.BUFF | F.HIDDEN_FROM_WORLD_ICON, 87, color(124, 96, 255), color(205, 190, 255)),
  [I.UNSTOPPABLE]: def(I.UNSTOPPABLE, "Unstoppable", "Unst", "Ignore les contrôles pendant la fenêtre d'action.", FAM.DEFENSE, F.PERSISTENT | F.BUFF | F.HIDDEN_FROM_WORLD_ICON, 94, color(255, 182, 96), color(255, 234, 170)),
  [I.DAMAGE_AMP]: def(I.DAMAGE_AMP, "Damage Amp", "Amp", "La cible subit davantage de dégâts.", FAM.VULNERABILITY, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.BLOCKED_BY_SPELL_SHIELD, 76, color(255, 94, 94), color(255, 180, 180)),
  [I.HEAL_CUT]: def(I.HEAL_CUT, "Heal Cut", "GH", "Réduit tous les soins, régénérations et sustain entrants.", FAM.VULNERABILITY, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.BLOCKED_BY_SPELL_SHIELD, 83, color(255, 96, 96), color(255, 188, 188)),
  [I.ARMOR_UP]: def(I.ARMOR_UP, "Armor Up", "Arm", "Bonus temporaire d'armure ou de blindage.", FAM.DEFENSE, F.PERSISTENT | F.BUFF, 52, color(120, 160, 225), color(210, 228, 255)),
  [I.ANTI_SHIELD]: def(I.ANTI_SHIELD, "Anti-Shield", "ASH", "Fenêtre de bonus contre les boucliers.", FAM.VULNERABILITY, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.BLOCKED_BY_SPELL_SHIELD, 54, color(255, 140, 76), color(255, 210, 160)),
  [I.ARMOR_SHRED]: def(I.ARMOR_SHRED, "Armor Shred", "Shred", "Réduction temporaire d'armure.", FAM.VULNERABILITY, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.BLOCKED_BY_SPELL_SHIELD, 57, color(198, 118, 88), color(255, 194, 170)),
  [I.SLOW]: def(I.SLOW, "Slow", "Slow", "Réduit la vitesse de déplacement.", FAM.BUFF_MOBILITY, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.BLOCKED_BY_SPELL_SHIELD, 58, color(116, 181, 255), color(214, 236, 255)),
  [I.HASTE]: def(I.HASTE, "Haste", "Haste", "Augmente la vitesse de déplacement.", FAM.BUFF_MOBILITY, F.PERSISTENT | F.BUFF, 50, color(96, 235, 255), color(220, 250, 255)),
  [I.LIFESTEAL]: def(I.LIFESTEAL, "Lifesteal", "LS", "Stat temporaire de vampirisme.", FAM.BUFF_SUSTAIN, F.PERSISTENT | F.BUFF | F.HIDDEN_FROM_WORLD_ICON | F.HIDDEN_FROM_HUD_ICON, 18, color(110, 255, 150), color(211, 255, 222)),
  [I.TENACITY]: def(I.TENACITY, "Tenacity", "Ten", "Réduit les durées de contrôles standard.", FAM.BUFF_SUSTAIN, F.PERSISTENT | F.BUFF, 60, color(182, 116, 255), color(228, 196, 255)),
  [I.SLOW_RESIST]: def(I.SLOW_RESIST, "Slow Resist", "SR", "Réduit l'intensité des ralentissements.", FAM.BUFF_MOBILITY, F.PERSISTENT | F.BUFF, 47, color(170, 112, 255), color(220, 196, 255)),
  [I.AFFLICTION]: def(I.AFFLICTION, "Affliction", "Dot", "Famille commune de DoT : bleed, poison, burn.", FAM.AFFLICTION, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.BLOCKED_BY_SPELL_SHIELD | F.HIDDEN_FROM_WORLD_ICON | F.HIDDEN_FROM_HUD_ICON, 10, color(220, 110, 110), color(255, 210, 170)),
  [I.BLEED]: def(I.BLEED, "Bleed", "Bleed", "Dégâts périodiques sanguins.", FAM.AFFLICTION, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.BLOCKED_BY_SPELL_SHIELD, 44, color(220, 72, 84), color(255, 176, 176)),
  [I.POISON]: def(I.POISON, "Poison", "Pois", "Dégâts périodiques toxiques.", FAM.AFFLICTION, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.BLOCKED_BY_SPELL_SHIELD, 44, color(102, 225, 120), color(198, 255, 184)),
  [I.BURN]: def(I.BURN, "Burn", "Burn", "Dégâts périodiques incendiaires.", FAM.AFFLICTION, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.BLOCKED_BY_SPELL_SHIELD, 44, color(255, 142, 72), color(255, 216, 160)),
  [I.MARK]: def(I.MARK, "Mark", "Mark", "Marque technique réservée aux mécaniques de kit.", FAM.UTILITY, F.PERSISTENT | F.DEBUFF | F.CLEANSEABLE | F.BLOCKED_BY_SPELL_SHIELD | F.SUPPORTS_STACKS | F.HIDDEN_FROM_WORLD_ICON | F.HIDDEN_FROM_HUD_ICON, 12, color(255, 255, 255), color(255, 208, 112)),
  [I.DETECTION]: def(I.DETECTION, "Detection", "Scan", "Alias legacy de True Sight conservé pour compatibilité.", FAM.STEALTH_VISION, F.PERSISTENT | F.BUFF | F.HIDDEN_FROM_WORLD_ICON | F.HIDDEN_FROM_HUD_ICON, 12, color(154, 255, 255), color(220, 255, 255)),
  [I.DASH]: def(I.DASH, "Dash", "Dash", "Déplacement rapide sur une courte durée.", FAM.FORCED_MOVEMENT, F.BUFF | F.HIDDEN_FROM_HUD_ICON | F.HIDDEN_FROM_WORLD_ICON, 10, color(120, 240, 255), color(255, 255, 255)),
  [I.BLINK]: def(I.BLINK, "Blink", "Blink", "Alias legacy de Dash conservé pour compatibilité.", FAM.FORCED_MOVEMENT, F.BUFF | F.HIDDEN_FROM_HUD_ICON | F.HIDDEN_FROM_WORLD_ICON, 10, color(180, 210, 255), color(255, 255, 255)),
  [I.PULL]: def(I.PULL, "Pull", "Pull", "Déplacement forcé vers une source.", FAM.FORCED_MOVEMENT, F.DEBUFF | F.BLOCKED_BY_SPELL_SHIELD | F.HIDDEN_FROM_HUD_ICON | F.HIDDEN_FROM_WORLD_ICON, 10, color(255, 174, 104), color(255, 235, 194)),
  [I.KNOCKBACK]: def(I.KNOCKBACK, "Knockback", "KB", "Repousse fortement une cible.", FAM.FORCED_MOVEMENT, F.DEBUFF | F.BLOCKED_BY_SPELL_SHIELD | F.HIDDEN_FROM_HUD_ICON | F.HIDDEN_FROM_WORLD_ICON, 10, color(255, 140, 104), color(255, 227, 200)),
  [I.BUMP]: def(I.BUMP, "Bump", "Bump", "Micro déplacement forcé ou interruption courte.", FAM.FORCED_MOVEMENT, F.DEBUFF | F.BLOCKED_BY_SPELL_SHIELD | F.HIDDEN_FROM_HUD_ICON | F.HIDDEN_FROM_WORLD_ICON, 10, color(255, 190, 104), color(255, 241, 196))
});

export function getStatusEffectDef(effectId) {
  return STATUS_EFFECT_DEFS[effectId] ?? null;
}

export const STATUS_EFFECT_LIST = Object.freeze(Object.values(STATUS_EFFECT_DEFS).sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name)));
