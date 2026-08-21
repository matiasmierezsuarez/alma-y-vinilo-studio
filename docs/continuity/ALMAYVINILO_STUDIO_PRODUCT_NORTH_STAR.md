# ALMAYVINILO STUDIO — PRODUCT NORTH STAR

## Final objective
Alma y Vinilo Studio must become a version-aware creative production system that can create content, explain exactly how every published asset was produced, safely show the consequences of changing a decision, preserve historical truth, measure performance, and transfer learning into future projects.

## End-to-end product loop

IDEA -> CONTENT DNA -> SCRIPTURE -> TRACK PLAN -> LYRICS -> MUSIC

VISUAL decisions feed into:

PACKAGING -> REVIEW -> PUBLISH -> IMMUTABLE PUBLICATION SNAPSHOT -> ANALYTICS -> LEARNING -> FUTURE WORKSPACES

## The five questions the finished product must answer
1. What exact versions produced this published video?
2. If I change this decision, what exact artifacts become stale?
3. Is the artifact set being reviewed internally coherent and current?
4. What creative decisions actually produced the measured performance?
5. How should that learning influence the next Workspace?

## Architectural transformation
The system must evolve from a collection of versioned modules into an explicit production dependency graph.

Every important generated artifact should have:
- artifact identity;
- workspace identity;
- version;
- lifecycle state;
- explicit upstream lineage;
- source artifact identities where relevant;
- creation time.

## Non-negotiable invariants
- Published snapshots are immutable.
- Historical analytics resolve published lineage, never current Workspace state.
- Learning is attributed to exact published creative combinations.
- STALE artifacts cannot silently pass Review or Publish.
- Track-scoped changes do not invalidate sibling Tracks.
- Preview is read-only.
- Cancel is a true no-op.
- Confirm performs one domain mutation through the existing mutation path.

## Definition of success
The Studio is complete when a successful project can become reusable organizational knowledge and improve the decisions proposed in later Workspaces without rewriting historical truth.
