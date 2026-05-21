export function createPlayerDockingState() {
  return {
    interactTap: false,
    rocketTap: false,
    dockPhase: 'none',
    dockStationId: 0,
    dockProg01: 0,
    dockTimer: 0,
    dockDuration: 0.85,
    dockStartX: 0,
    dockStartY: 0,
    dockedStationId: 0,
    nextPortalAt: 0
  };
}
