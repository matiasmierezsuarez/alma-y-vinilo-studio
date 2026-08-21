# SKILL — REVIEW AND PUBLISH INTEGRITY

## Mission
Prevent stale, mixed, or historically incorrect artifact sets from being approved or published.

## Review contract
Review must validate:
- required artifacts exist;
- lifecycle permits use;
- artifacts are not STALE;
- artifacts resolve to a coherent intended lineage;
- track-specific dependencies are not mixed;
- publication history remains untouched.

Existence alone is never sufficient.

## Publish contract
Publish consumes the exact reviewed artifact set and creates an immutable Publication Snapshot.

The snapshot must preserve enough references to reconstruct the creative state that produced the publication.

## Immutability
Later Workspace changes, regeneration, invalidation, or learning updates must never mutate a historical publication snapshot.

## Tests
Required examples:
- stale artifact cannot pass review;
- mixed lineage cannot pass review;
- publish stores exact reviewed references;
- later Workspace mutation leaves snapshot unchanged.
