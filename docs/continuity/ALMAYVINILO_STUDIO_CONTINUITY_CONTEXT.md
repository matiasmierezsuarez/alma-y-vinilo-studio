# ALMAYVINILO STUDIO — CONTINUITY CONTEXT

## Repository
- Repository: matiasmierezsuarez/alma-y-vinilo-studio
- Working branch: refactor/lineage-dependency-graph
- Current objective: close the pre-PR audit on the completed Layer 9.2 branch without starting Layer 9.3.

## Canonical architectural objective
The application must behave as a versioned production dependency graph:

IDEA -> CONTENT DNA -> SCRIPTURE -> TRACK PLAN -> LYRICS -> MUSIC

Visual dependencies feed into:

PACKAGING -> REVIEW -> PUBLISH -> IMMUTABLE SNAPSHOT -> ANALYTICS -> LEARNING

Do not treat this as a UI-first refactor. The domain truth is lineage + dependency + invalidation.

## Non-negotiable invariants
1. Published snapshots are immutable.
2. Every generated artifact records exact upstream lineage.
3. STALE artifacts cannot satisfy Review or Publish.
4. Review validates lineage, not only existence.
5. Analytics resolve exact published lineage, not workspace latest.
6. Learning uses published lineage.
7. Track mutations are isolated: Track A must not invalidate Track B descendants.
8. Preview is read-only.
9. Cancel is a true no-op.
10. Confirm executes the existing domain mutation exactly once.

## Current Layer 9.2 status
Layer 9.2 is closed. The full critical suite passes, including Preview/Invalidation parity, Track isolation, Review/Publish integrity, historical Analytics, Learning and Studio intelligence. The pre-PR audit also verifies explicit lineage and conservative legacy fallback behavior.

Do not start Layer 9.3 as part of this pre-PR closure task.

## Important previous implementation history
The branch already received changes around:
- src/modules/lineage.js
- src/modules/invalidation.js
- src/modules/impact-preview.js
- UI confirmation orchestration
- impact-preview contract tests
- Track A / Track B isolation tests

Treat existing code as the starting point. Do not rewrite the application and do not duplicate modules without checking existing responsibilities.

## Working principle
Before changing code:
1. inspect current branch;
2. run the failing validation command;
3. record exact failing tests/routes;
4. map each failure to a dependency edge or route contract;
5. fix the smallest domain cause;
6. add or adjust a regression test;
7. rerun targeted tests;
8. rerun the full suite.

Never fix a test by weakening its expected behavior unless the canonical specification explicitly requires a different contract.
