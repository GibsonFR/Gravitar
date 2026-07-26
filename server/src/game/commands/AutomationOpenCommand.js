import { openAutomationConfig } from '../structures/StructureAutomationConfig.js';

export function handleAutomationOpen(state, player, msg) {
  return openAutomationConfig(state, player, msg.structureId | 0);
}
