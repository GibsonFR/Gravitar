// V274c: partial/prioritized snapshots are disabled.
// Kept as a harmless placeholder so old imports or audits do not break if a branch still references this file.
export function buildSnapshotPriorityPlan() {
  return {
    enabled: false,
    partialSections: [],
    limits: {},
    predicates: {}
  };
}
