# SKILL — REPOSITORY EVOLUTION V2

## Before any change
1. Read PRODUCT NORTH STAR.
2. Read LAYER STATUS.
3. Read the skill for the active domain.
4. Inspect current branch and latest commits.
5. Run the relevant validation.

## Change protocol
For each failure or feature:
- identify the invariant;
- identify the exact lineage/dependency scope;
- identify siblings that must remain untouched;
- implement the smallest domain fix;
- add a regression test;
- run targeted tests;
- run broader regression.

## Forbidden shortcuts
Do not:
- replace explicit lineage with workspace-wide invalidation;
- duplicate an existing domain mutation;
- weaken tests merely to make CI green;
- mutate publication snapshots;
- advance layers with known blocking regressions.

## Session handoff
After every batch report:
- current layer;
- commits;
- files changed;
- tests and results;
- remaining blockers;
- next recommended action.
