import { configureAutomation } from '../structures/StructureAutomationConfig.js';

export function handleAutomationConfigure(state, player, msg, timeMs) {
  return configureAutomation(state, player, msg.structureId | 0, msg, timeMs);
}
