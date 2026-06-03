// Removed in rollback_pre_partial.
// Partial/prioritized snapshots were disabled because absence from a snapshot is meaningful
// for mobs, loots, asteroids/resources and structures without tombstones/versioning.
export function buildSnapshotPriorityPlan() {
  return {
    enabled: false,
    partialSections: [],
    limits: {},
    predicates: {}
  };
}
