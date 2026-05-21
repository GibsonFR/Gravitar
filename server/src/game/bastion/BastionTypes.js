export const BASTION_TYPES = Object.freeze({
  BUY: 'buy',
  SELL: 'sell',
  DAMAGE: 'damage',
  DEFENSE: 'defense',
  SPEED: 'speed',
  VISION: 'vision',
  COOLDOWN: 'cooldown',
  HACKER: 'hacker',
  EXPERIENCE: 'experience',
  FORGE: 'forge',
  MUTATION: 'mutation'
});

export const BASTION_TYPE_ORDER = Object.freeze([
  BASTION_TYPES.BUY,
  BASTION_TYPES.SELL,
  BASTION_TYPES.DAMAGE,
  BASTION_TYPES.DEFENSE,
  BASTION_TYPES.SPEED,
  BASTION_TYPES.VISION,
  BASTION_TYPES.COOLDOWN,
  BASTION_TYPES.HACKER,
  BASTION_TYPES.EXPERIENCE,
  BASTION_TYPES.FORGE,
  BASTION_TYPES.MUTATION
]);

export function getBastionTypeName(type) {
  switch (type) {
    case BASTION_TYPES.BUY: return 'Achat';
    case BASTION_TYPES.SELL: return 'Vente';
    case BASTION_TYPES.DAMAGE: return 'Dégâts';
    case BASTION_TYPES.DEFENSE: return 'Défense';
    case BASTION_TYPES.SPEED: return 'Vitesse';
    case BASTION_TYPES.VISION: return 'Vision';
    case BASTION_TYPES.COOLDOWN: return 'Recharge';
    case BASTION_TYPES.HACKER: return 'Hacker';
    case BASTION_TYPES.EXPERIENCE: return 'Expérience';
    case BASTION_TYPES.FORGE: return 'Forge';
    case BASTION_TYPES.MUTATION: return 'Mutation';
    default: return 'Bastion';
  }
}

export function getBastionGlyph(type) {
  switch (type) {
    case BASTION_TYPES.BUY: return 'ACH';
    case BASTION_TYPES.SELL: return 'VTE';
    case BASTION_TYPES.DAMAGE: return 'ATQ';
    case BASTION_TYPES.DEFENSE: return 'DEF';
    case BASTION_TYPES.SPEED: return 'VIT';
    case BASTION_TYPES.VISION: return 'VIS';
    case BASTION_TYPES.COOLDOWN: return 'CDR';
    case BASTION_TYPES.HACKER: return 'HKR';
    case BASTION_TYPES.EXPERIENCE: return 'EXP';
    case BASTION_TYPES.FORGE: return 'FRG';
    case BASTION_TYPES.MUTATION: return 'MUT';
    default: return 'BST';
  }
}

export function getBastionColor(type) {
  switch (type) {
    case BASTION_TYPES.BUY: return { r: 236, g: 186, b: 92 };
    case BASTION_TYPES.SELL: return { r: 132, g: 216, b: 126 };
    case BASTION_TYPES.DAMAGE: return { r: 228, g: 94, b: 94 };
    case BASTION_TYPES.DEFENSE: return { r: 104, g: 168, b: 240 };
    case BASTION_TYPES.SPEED: return { r: 120, g: 232, b: 170 };
    case BASTION_TYPES.VISION: return { r: 180, g: 124, b: 238 };
    case BASTION_TYPES.COOLDOWN: return { r: 108, g: 222, b: 255 };
    case BASTION_TYPES.HACKER: return { r: 255, g: 132, b: 210 };
    case BASTION_TYPES.EXPERIENCE: return { r: 255, g: 212, b: 104 };
    case BASTION_TYPES.FORGE: return { r: 255, g: 156, b: 94 };
    case BASTION_TYPES.MUTATION: return { r: 224, g: 132, b: 255 };
    default: return { r: 210, g: 210, b: 220 };
  }
}

export function getBastionMagnitude(type) {
  switch (type) {
    case BASTION_TYPES.BUY: return 12;
    case BASTION_TYPES.SELL: return 15;
    case BASTION_TYPES.DAMAGE: return 8;
    case BASTION_TYPES.DEFENSE: return 10;
    case BASTION_TYPES.SPEED: return 12;
    case BASTION_TYPES.VISION: return 20;
    case BASTION_TYPES.COOLDOWN: return 10;
    case BASTION_TYPES.HACKER: return 30;
    case BASTION_TYPES.EXPERIENCE: return 5;
    case BASTION_TYPES.FORGE: return 1;
    case BASTION_TYPES.MUTATION: return 2;
    default: return 0;
  }
}

export function getBastionEffectSummary(type, magnitude = getBastionMagnitude(type)) {
  switch (type) {
    case BASTION_TYPES.BUY: return `-${magnitude}% prix d'achat en station`;
    case BASTION_TYPES.SELL: return `+${magnitude}% prix de vente`;
    case BASTION_TYPES.DAMAGE: return `+${magnitude}% dégâts globaux`;
    case BASTION_TYPES.DEFENSE: return `-${magnitude}% dégâts subis`;
    case BASTION_TYPES.SPEED: return `+${magnitude}% vitesse de déplacement`;
    case BASTION_TYPES.VISION: return `+${magnitude}% champ visible`;
    case BASTION_TYPES.COOLDOWN: return `-${magnitude}% temps de recharge`;
    case BASTION_TYPES.HACKER: return 'Déverrouille les bastions 30 s plus tôt';
    case BASTION_TYPES.EXPERIENCE: return `+${magnitude}% expérience gagnée`;
    case BASTION_TYPES.FORGE: return 'Renforce le tag dominant du build';
    case BASTION_TYPES.MUTATION: return '+2 tags virtuels sur le build';
    default: return 'Bonus de bastion';
  }
}

export function getBastionLabel(type, tier) {
  return `Bastion ${getBastionTypeName(type)} T${tier}`;
}
