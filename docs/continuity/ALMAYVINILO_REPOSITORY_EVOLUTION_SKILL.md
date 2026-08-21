# SKILL — ALMAYVINILO Repository Evolution Protocol

## Purpose
Continue development across chats, agents, and sessions without losing architectural lineage.

## Canonical sources
Before implementation, inspect:
1. docs/ALMAYVINILO_STUDIO_2_FINAL_SPEC.md
2. ALMAYVINILO_STUDIO_2_LINEAGE_REFACTOR_SPEC.md
3. ALMAYVINILO_STUDIO_MASTER_IMPLEMENTATION_GUIDE.md, if present
4. current branch source code
5. current test suite
6. latest validation output.

When sources conflict, report the conflict. Do not silently invent a reconciliation.

## Session start protocol
1. Identify repository and branch.
2. Run git status.
3. Inspect latest commits.
4. Run tests or the relevant validation command.
5. State exact current failures.
6. Map failures to canonical invariants.
7. Propose the smallest corrective batch.

## Change discipline
Every change must answer:
- What invariant does this protect?
- What upstream artifact changed?
- Which exact descendants should be affected?
- Which siblings must remain unaffected?
- What historical data must remain immutable?
- Which existing mutation owns the actual state change?

## Dependency graph rule
Artifact lineage is primary evidence.

Workspace scope alone is never sufficient evidence that two artifacts depend on each other.

## Test discipline
For every fixed bug:
- reproduce with a targeted test;
- fix the production code;
- verify targeted test;
- run broader regression.

Do not delete or weaken a failing test simply to make CI green.

## Commit discipline
Keep commits focused:
- fix(route): ...
- fix(lineage): ...
- fix(invalidation): ...
- feat(ui): ...
- test(lineage): ...

Avoid mixing unrelated refactors.

## Stop conditions
Stop and report instead of guessing when:
- the exact failing test output is unavailable;
- route contracts conflict;
- a source file is truncated/incomplete;
- lineage data is ambiguous;
- fixing a failure would require changing canonical architecture.

## Handoff output after each batch
Produce:
1. What changed.
2. Files changed.
3. Tests run and results.
4. Remaining failures.
5. Current architecture status.
6. Recommended next step.
