# SKILL — ALMAYVINILO Layer 9.2 Corrective Implementation

## Mission
Close Layer 9.2: Impact Preview + dependency-aware invalidation + confirmation integration.

## First mandatory action
Run the validation suite and capture the exact five failures. Do not infer them from old notes.

Create:

| Failure | Test/route | Expected | Actual | Root cause |
|---|---|---|---|---|

Only then modify code.

## Required dependency semantics

### Content DNA change
Invalidate only artifacts that actually depend on the previous DNA lineage:
- Scripture recommendation/current dependent state as applicable
- Track Plan
- Lyrics
- Music
- Visual only when visual lineage includes that DNA
- Packaging
- Review

Never mutate historical publication snapshots.

### Scripture change
Invalidate descendants:

Track Plan -> Lyrics -> Music -> Packaging -> Review.

Visual only if Scripture is explicitly in visual lineage.

### Track mutation
Scope by concrete track identity:

Track A -> Lyrics A -> Music A -> track-specific packaging dependency -> Review.

Never invalidate Track B descendants merely because they share workspaceId.

### Lyrics mutation
Invalidate dependent Music and Review, preserving old lyrics as historical.

### Music regeneration
Keep historical generations. Only the selected/current valid generation is publishable.

## Required algorithm
Do not implement invalidation as:

workspaceId + static stage list.

Prefer:

changed artifact identity
 -> find direct descendants by explicit lineage references
 -> recursively traverse descendants
 -> classify first-hop descendants as direct
 -> classify deeper descendants as indirect
 -> apply invalidation only to traversed current descendants.

Fallback stage rules may exist only where legacy data lacks lineage. Legacy/unverified data must be explicitly marked or handled conservatively; never pretend lineage exists.

## Impact Preview contract
Preview must:
- read state only;
- never write lifecycle fields;
- return affected artifacts;
- distinguish directImpact and indirectImpact;
- return affected stages/counts;
- preserve Track isolation.

Preview and invalidation should use the same dependency resolution logic or a shared helper to prevent divergent answers.

## Confirmation contract
The UI flow is:

user proposes mutation
 -> preview
 -> if no meaningful impact, existing mutation may continue
 -> if impact, confirmation
 -> cancel: no request that mutates domain state
 -> confirm: invoke existing mutation exactly once
 -> refresh current workspace state.

Avoid introducing a second mutation implementation for confirmation.

## Route contract
Audit the exact Track Plan routes. Ensure preview and mutation routes are distinct and reachable. Do not nest mutually exclusive path checks.

Recommended pattern:
- POST /workspaces/:workspaceId/tracks/plan?preview=1
- POST /workspaces/:workspaceId/tracks/plan

or the repository's existing canonical equivalent.

The exact route must match tests and frontend callers.

## Required regression tests
At minimum:
1. Preview does not mutate.
2. Cancel does not mutate.
3. Confirm performs exactly one mutation.
4. Content DNA change invalidates only lineage descendants.
5. Scripture change invalidates Track Plan/Lyrics/Music/Packaging/Review as required.
6. Track A mutation does not affect Track B.
7. Lyrics change invalidates only dependent Music.
8. Historical publication snapshot remains unchanged.
9. Track Plan preview route is reachable.
10. Existing route contracts remain operational.

## Exit criteria
Layer 9.2 is complete only when:
- zero known validation failures remain;
- route contract passes;
- targeted regression tests pass;
- full suite passes;
- no new broad workspace-wide invalidation was introduced;
- UI confirmation is not the source of duplicate mutation.
