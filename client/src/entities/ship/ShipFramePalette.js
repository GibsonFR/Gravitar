export function getShipFramePalette(frameId) {
  if (frameId === 'sigil') {
    return {
      hull: { r: 214, g: 205, b: 242 },
      outline: { r: 184, g: 140, b: 255 },
      core: { r: 240, g: 230, b: 255 }
    };
  }
  if (frameId === 'bulwark') {
    return {
      hull: { r: 224, g: 215, b: 196 },
      outline: { r: 255, g: 186, b: 104 },
      core: { r: 255, g: 235, b: 196 }
    };
  }
  return {
    hull: { r: 208, g: 223, b: 232 },
    outline: { r: 130, g: 225, b: 255 },
    core: { r: 235, g: 242, b: 255 }
  };
}
