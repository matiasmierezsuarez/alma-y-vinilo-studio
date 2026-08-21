# ALMAYVINILO STUDIO 2 — Lineage Refactor Implementation

Branch: `refactor/lineage-dependency-graph`
Base: `main`

## Implemented

- Added `src/modules/lineage.js` with canonical lineage creation/comparison helpers.
- Added `src/modules/invalidation.js` with dependency impact rules and persistent `STALE` / `INVALIDATED` propagation.
- Content DNA version creation/edit now invalidates downstream unpublished artifacts.
- Scripture selection now supersedes the previous approved Scripture and records `supersedesScriptureId` / `contentDnaVersion`.
- Track generation now creates an explicit `trackPlanVersion` and stores Content DNA + Scripture lineage on every Track.
- Old Track Plan rows are preserved as `SUPERSEDED` instead of being deleted.
- Lyrics versions now store Track Plan, Content DNA and Scripture lineage and refuse stale Tracks.
- Music generations now require current approved Lyrics and store Lyrics/Track Plan/DNA/Scripture lineage.
- Visual Master references now have one canonical active record; replacing the master supersedes the previous one.
- Visual assets now store Content DNA, Scripture and Visual Master lineage.
- Packaging versions now store Content DNA, Scripture, Track Plan and Visual Master lineage.
- Review now validates current lineage and only permits `READY_FOR_REVIEW -> APPROVED`.
- Review approvals are invalidated by dependency changes.
- Publishing now records the exact reviewed artifact set instead of resolving an arbitrary latest artifact after approval.
- Publication snapshots are explicitly `PUBLISHED` and retain complete lineage.
- Analytics provider snapshots are automatically anchored to the latest publication snapshot when no explicit snapshot ID is supplied.
- Learning observations resolve Content DNA and Scripture from the immutable publication snapshot instead of the current Workspace state.
- Added regression tests for lineage comparison and invalidation behavior.

## Known follow-up

The current `src/modules/analytics.js` file could not be replaced through the GitHub contents endpoint because GitHub returned a blob-SHA mismatch even though the fetched SHA remained unchanged. The Analytics provider itself was successfully updated so captures are anchored to publication snapshots, and the Learning module consumes those snapshot-linked analytics. A future cleanup can simplify the Analytics module API without changing persisted behavior.

## Important migration behavior

Existing legacy artifacts may not have lineage. The new Review rules should therefore be treated as the authoritative gate before publishing legacy workspaces. Historical publication snapshots are never invalidated by Workspace edits.
