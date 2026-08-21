# Alma y Vinilo Studio — Layer 8: UI / User Journey Acceptance

## Objective

Protect the workflow the user actually sees, not only the internal module graph.

The canonical journey is:

Workspace -> Idea -> Content DNA -> Scripture -> Track Plan -> Lyrics -> Music -> Visual -> Packaging -> Review -> Publish.

## Invariants

1. Every workflow domain remains reachable from the client application.
2. The progressive stage shell remains present: stage list, stage content, Back and Next controls.
3. Workflow validity must be visible to the user; invalid/stale/review state cannot be only a backend concern.
4. A user journey may not bypass the API lineage gates.
5. UI tests complement, but do not replace, API acceptance tests.

## Current implementation

`tests/workspace.ui.contract.test.js` is a dependency-free UI contract smoke test. It protects the browser shell and domain anchors without introducing a browser automation dependency into the project.

It is intentionally a first layer, not a claim of pixel-level or click-level end-to-end coverage.

## Music route contract discovered by Layer 7

The route:

`POST /tracks/:trackId/music/:generationId/asset`

must resolve the track and pass `track.workspaceId` into `music.recordAsset`.

Required server implementation:

```js
if ((re = m(/^\/tracks\/([^/]+)\/music\/([^/]+)\/asset$/)) && req.method === 'POST') {
  try {
    const track = tracks.get(re[1]);
    if (!track) return fail(res, new Error('Track no encontrado.'));
    return ok(res, {
      generation: music.recordAsset(track.workspaceId, re[2], body || {})
    });
  } catch (e) { return fail(res, e); }
}
```

This preserves the ownership validation inside `music.recordAsset`; it must not be replaced by removing validation.

## Limitation and next step

The repository currently does not provide a browser automation runner. Therefore Layer 8 currently protects the UI contract statically and relies on Layer 7 for real HTTP workflow execution.

The next evolution should add a real browser runner and execute:

1. create workspace;
2. select/use idea;
3. advance stage by stage;
4. verify disabled/blocked transitions;
5. mutate Scripture;
6. verify stale/review state is visible;
7. verify Publish is blocked;
8. rebuild and publish again.

When browser automation is introduced, these assertions should become click-level acceptance tests rather than replacing the existing API acceptance suite.
