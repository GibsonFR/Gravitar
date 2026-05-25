import { getAmmoIconSvg, getQuestIconSvg, getShopIconSvg, getTradeIconSvg } from './StationIcons.js';

export const STATION_TABS = [
  { id: 'trade', title: 'Commerce', iconMarkup: getTradeIconSvg() },
  { id: 'shop', title: 'Boutique', iconMarkup: getShopIconSvg() },
  { id: 'quests', title: 'Quêtes', iconMarkup: getQuestIconSvg() },
  { id: 'ammo', title: 'Munitions', iconMarkup: getAmmoIconSvg() }
];
