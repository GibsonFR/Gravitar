import { WORLD_BAR_PALETTES } from '../../ui/worldbars/WorldBarPalettes.js';

export const SHIP_WORLD_BAR_STYLE = {
  width: 34,
  offsetY: 28,
  bars: [
    { valueKey: 'hp', maxKey: 'maxHp', height: 4, gapAfter: 1, palette: WORLD_BAR_PALETTES.hp, showWhenZero: true },
    { valueKey: 'shield', maxKey: 'maxShield', height: 3, gapAfter: 0, palette: WORLD_BAR_PALETTES.shield, showWhenZero: true }
  ]
};
