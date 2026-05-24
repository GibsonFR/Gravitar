import { craftEquipmentItem } from '../structures/StructureEquipmentFabricator.js';
export function handleEquipmentFabricatorCraft(state, player, msg, timeMs) { return craftEquipmentItem(state, player, msg.structureId | 0, msg.recipeId || '', msg.mode || 'standard', timeMs).ok; }
