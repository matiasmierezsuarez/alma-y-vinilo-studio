# ALMAYVINILO — NEW CHAT BOOTSTRAP PROMPT

Copy the following into a new chat:

---

We are continuing development of the repository `matiasmierezsuarez/alma-y-vinilo-studio`.

Working branch:

`refactor/lineage-dependency-graph`

Do not start a new architecture and do not restart the project. Continue from the current branch.

The canonical goal is to turn the Workspace into an explicit versioned production dependency graph:

IDEA -> CONTENT DNA -> SCRIPTURE -> TRACK PLAN -> LYRICS -> MUSIC

with Visual dependencies feeding:

PACKAGING -> REVIEW -> PUBLISH -> immutable SNAPSHOT -> ANALYTICS -> LEARNING.

Read and follow these documents before modifying code:
1. `ALMAYVINILO_STUDIO_CONTINUITY_CONTEXT.md`
2. `ALMAYVINILO_LAYER_9_2_CORRECTIVE_SKILL.md`
3. `ALMAYVINILO_REPOSITORY_EVOLUTION_SKILL.md`
4. the repository's canonical final spec and lineage refactor spec.

CURRENT STATUS:

Layer 9.2 is not closed.

The latest validation reported:
- 4 functional regressions;
- 1 route-contract failure.

Do NOT advance to Layer 9.3.

The main suspected domain area is lineage/invalidation scope, especially avoiding workspace-wide invalidation when only concrete descendants should be affected. The confirmation modal is not currently the primary architectural blocker.

FIRST TASK:
1. Inspect the current branch.
2. Run the validation/test suite that produced the five failures.
3. Report the exact names of all failing tests and the failing route contract.
4. Map each failure to its root cause before changing code.
5. Propose the smallest corrective implementation plan.
6. Then implement only after that diagnosis is explicit.

Critical invariants:
- Preview is read-only.
- Cancel is no-op.
- Confirm performs exactly one existing domain mutation.
- Track A changes never invalidate Track B descendants.
- Historical publication snapshots are immutable.
- Review/Publish cannot rely on stale or mixed lineage.
- Dependency traversal must prefer explicit artifact lineage over workspace-wide stage selection.

After each implementation batch, report:
- commits;
- files changed;
- tests run;
- pass/fail result;
- remaining blockers.

---
