import { getDefaultShipFrameId, getShipFrameDef } from '../../../../shared/content/frames/ShipFrameRegistry.js';

export function createFrameRuntime(frameId = getDefaultShipFrameId()) {
  const def = getShipFrameDef(frameId);
  return {
    id: def.id,
    name: def.name,
    role: def.role,
    difficulty: def.difficulty,
    abilityCatalog: { ...def.abilities }
  };
}
