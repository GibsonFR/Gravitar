import { closeAutomationConfig } from '../structures/StructureAutomationConfig.js';

export function handleAutomationClose(state, player) {
  return closeAutomationConfig(player);
}
