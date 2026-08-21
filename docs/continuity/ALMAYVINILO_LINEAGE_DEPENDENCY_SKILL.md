# SKILL — LINEAGE AND DEPENDENCY

## Mission
Implement and protect the canonical production dependency graph.

## Core rule
Workspace membership is not dependency evidence. Explicit lineage is primary.

## Required flow
changed artifact -> direct descendants -> recursive descendants.

Classify first-hop descendants as direct impact and deeper descendants as indirect impact.

The same resolver must power:
- impact preview;
- invalidation;
- future review freshness checks where applicable.

## Track isolation
A mutation of Track A may affect only descendants whose lineage resolves to Track A. Sharing a workspace is insufficient to invalidate Track B.

## Legacy fallback
If explicit lineage is missing, fallback behavior must be explicit and conservative. Never silently claim exact dependency knowledge where none exists.

## Tests
Every dependency edge added or changed requires a targeted regression test.
