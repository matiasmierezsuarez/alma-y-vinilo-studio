# Alma y Vinilo Studio — Layer 7: Acceptance Layer

## Objetivo

Esta capa prueba el contrato público del Workspace a través del servidor REST. A diferencia de las capas anteriores, el test no inserta directamente los artefactos de producción en la base de datos.

## Flujo contractual

```text
POST /workspaces
  -> POST /ideas (offline)
  -> POST /ideas/:id/use
  -> POST /content-dna
  -> POST /scripture/select
  -> POST /tracks/plan
  -> POST /tracks/approve
  -> POST /lyrics + approve
  -> POST /music + record asset
  -> POST /visual/thumbnail + record asset
  -> POST /packaging
  -> POST /review
  -> POST /review/approve
  -> POST /publish

Mutation:
  -> POST /scripture/select
  -> Review INVALIDATED
  -> Publish blocked

Rebuild:
  -> regenerate downstream through the same public API
  -> review/approve
  -> publish
  -> verify publication snapshot A is immutable and snapshot B uses new lineage
```

## Determinism

The acceptance test starts `server.js` on an ephemeral port and uses a temporary state directory. AI text/image generation uses the existing `offline` modes. Music is still created through the real music module and the resulting Suno-compatible generation is completed through the public asset-registration endpoint with a deterministic fixture URL.

No direct `db.insert()` calls are used by the acceptance test to create Workspace artifacts.

## Contract invariants

1. A user can move from Workspace creation to publication through the public API.
2. A published Workspace can be mutated upstream.
3. The mutation invalidates the previously approved review.
4. Publish is rejected until downstream artifacts are rebuilt and a new review is approved.
5. A second publication creates a new snapshot.
6. The first publication snapshot retains its original Scripture lineage.

## API defect intentionally exposed by this layer

The acceptance route `POST /tracks/:trackId/music/:generationId/asset` currently calls `music.recordAsset(null, generationId, ...)`, while `music.recordAsset()` verifies that the supplied Workspace ID equals the generation Workspace ID. This means the public API cannot complete a generated music asset even though the module itself supports the operation.

Layer 7 therefore serves as a release gate for this defect: the test is expected to fail until the route forwards the Workspace ID resolved from the track, or `recordAsset` safely resolves it from the generation when the caller omits it.

The required fix is:

```js
const track = tracks.get(re[1]);
if (!track) return fail(res, new Error('Track no encontrado.'));
return ok(res, {
  generation: music.recordAsset(track.workspaceId, re[2], body || {})
});
```

This defect is exactly the kind of integration regression the Acceptance Layer is intended to reveal: module-level lineage tests can pass while the user-facing API remains unable to complete the same workflow.
