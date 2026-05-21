import { WORLD_BAR_PALETTES } from '../ui/worldbars/WorldBarPalettes.js';

export function getAsteroidWorldBarStyle(asteroid) {
  return {
    width: Math.max(34, asteroid.radius * 2.1),
    offsetY: -asteroid.radius - 18,
    bars: [
      { valueKey: 'hp', maxKey: 'maxHp', height: 4, gapAfter: 0, palette: WORLD_BAR_PALETTES.asteroidHp, showWhenZero: true }
    ]
  };
}
