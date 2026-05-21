export const MOB_WORLD_BAR_STYLE = {
  width: 34,
  offsetY: 22,
  bars: [
    {
      valueKey: 'hp',
      maxKey: 'maxHp',
      height: 4,
      gapAfter: 0,
      showWhenZero: false,
      palette: {
        back: { r: 20, g: 24, b: 30, a: 0.82 },
        fill: { r: 224, g: 98, b: 98 }
      }
    }
  ]
};
