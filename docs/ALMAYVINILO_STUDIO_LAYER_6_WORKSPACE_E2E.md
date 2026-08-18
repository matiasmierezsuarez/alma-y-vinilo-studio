# Alma y Vinilo Studio — Layer 6: Workspace End-to-End Regression Contract

## Objective

Layer 6 converts the lineage architecture into a Workspace-level contract. The test proves that a complete approved graph can publish, that an upstream decision invalidates downstream artifacts and Review, and that rebuilding creates a second historical publication without mutating the first snapshot.

## Contract flow

1. Create Workspace.
2. Create Content DNA v1.
3. Approve Scripture A.
4. Create Track Plan/Track chain, Lyrics, Music, Visual and Packaging.
5. Create APPROVED Review with the exact lineage.
6. Publish and persist Publication Snapshot A.
7. Replace Scripture A with Scripture B.
8. Emit `SCRIPTURE_CHANGED`.
9. Assert Track, Lyrics, Music and Packaging from the previous chain are `STALE`.
10. Assert Review is `INVALIDATED` and Publish is blocked.
11. Rebuild the downstream chain for Scripture B.
12. Create a new APPROVED Review.
13. Publish again and persist Publication Snapshot B.
14. Assert Snapshot A still points to Scripture A and the original Track.
15. Assert history contains both immutable publication records.

## Added test

`tests/workspace.e2e.regression.test.js`

This test intentionally spans module boundaries instead of testing a single helper. It is a regression contract for the dependency graph.

## CI

`.github/workflows/lineage-validation.yml` now runs:

- `tests/lineage.test.js`
- `tests/invalidation.matrix.test.js`
- `tests/publication-history.test.js`
- `tests/workspace.e2e.regression.test.js`

A green workflow therefore covers unit lineage behavior, the invalidation matrix, historical publication lineage, and the Workspace mutation/rebuild contract.

## Current scope boundary

The E2E test uses the real persistence model, invalidation engine and publish engine, but seeds the production artifacts directly. A future UI/API acceptance layer should drive the same contract through public module/service entry points and the user-facing production flow.

## Acceptance criteria

Layer 6 is complete when CI passes and the following invariant holds:

> A published Workspace may evolve, but no mutation can retroactively change an existing Publication Snapshot, and no stale downstream artifact can be published under an invalidated Review.
