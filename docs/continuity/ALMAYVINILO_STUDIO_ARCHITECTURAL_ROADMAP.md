# ALMAYVINILO STUDIO — ARCHITECTURAL ROADMAP

## 1. Layer 9.2: safe change propagation
Close the current 4 functional regressions and 1 route-contract failure. Preview and invalidation must resolve the same dependency graph. Full regression must pass.

## 2. Lineage enforcement
Ensure important production artifacts record exact upstream lineage and can be traversed without relying on workspace-wide assumptions.

## 3. Review integrity
Review validates existence, lifecycle, freshness, and lineage coherence. Mixed or stale sets cannot pass.

## 4. Publish integrity
Publish freezes the exact reviewed artifact set into an immutable Publication Snapshot containing enough lineage to reconstruct what was published.

## 5. Historical analytics
Analytics resolves the immutable publication snapshot and exact historical creative lineage, never simply the latest Workspace state.

## 6. Learning
Measured performance becomes attributable learning about the exact creative combination that was published.

## 7. Cross-project learning
Aggregated learning informs future Workspaces as explainable, advisory recommendations without changing history.

## 8. Studio intelligence
The completed Studio safely improves future proposals from accumulated evidence while retaining human control, explicit versions, and immutable publication history.

## Advancement rule
Each phase requires explicit contracts, targeted tests, regression validation, and documented exit criteria before the next phase starts.
