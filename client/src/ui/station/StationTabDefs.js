import { getAmmoIconSvg, getEquipmentIconSvg, getShopIconSvg, getTradeIconSvg } from './StationIcons.js';

export const STATION_TABS = [
  { id: 'trade', title: 'Commerce', iconMarkup: getTradeIconSvg() },
  { id: 'shop', title: 'Boutique', iconMarkup: getShopIconSvg() },
  { id: 'ammo', title: 'Munitions', iconMarkup: getAmmoIconSvg() },
  { id: 'equipment', title: 'Équipement', iconMarkup: getEquipmentIconSvg() }
];
