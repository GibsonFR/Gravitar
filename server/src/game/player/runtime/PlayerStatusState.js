import { createStatusRack } from '../../status/StatusRack.js';

export function createPlayerStatusState() {
  return {
    status: createStatusRack()
  };
}
