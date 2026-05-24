import { openEquipmentFabricator } from '../structures/StructureEquipmentFabricator.js';
export function handleEquipmentFabricatorOpen(state, player, msg) { return openEquipmentFabricator(state, player, msg.structureId | 0).ok; }
