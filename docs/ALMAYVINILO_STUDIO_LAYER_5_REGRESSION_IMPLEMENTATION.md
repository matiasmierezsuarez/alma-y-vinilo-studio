# Alma y Vinilo Studio — Capa 5: Implementación de regresión de lineage

## Objetivo

Convertir el modelo de lineage en garantías ejecutables. Después de esta capa, un cambio upstream debe producir invalidación verificable y las publicaciones históricas deben conservar el conjunto exacto de artefactos con el que fueron publicadas.

## Cambios implementados

### 1. Music -> Review

`src/modules/music.js` ahora emite `MUSIC_CHANGED` cuando:

- se crea una nueva generación de música;
- se registra o reemplaza el asset de una generación.

Impacto:

`MUSIC_CHANGED -> review`

Una Review `APPROVED` o `READY_FOR_REVIEW` pasa a `INVALIDATED`.

### 2. Visual asset -> Review

`src/modules/visual.js` ahora emite `VISUAL_ASSET_CHANGED` cuando:

- se genera un nuevo asset visual;
- se registra o reemplaza su URL/asset final.

Impacto:

`VISUAL_ASSET_CHANGED -> review`

### 3. Eventos precisos de Track

`src/modules/tracks.js` ya no utiliza `SOUND_SEED_CHANGED` como proxy para cambios de voz.

Reglas:

- solo `soundSeed` -> `SOUND_SEED_CHANGED`
- solo `vocalMode` -> `VOCAL_MODE_CHANGED`
- cualquier cambio mixto o estructural -> `TRACK_CHANGED`

Esto mantiene la semántica declarada de la matriz central.

### 4. Analytics histórico

`src/modules/analytics.js` resuelve primero el último `publication_snapshot` del Workspace.

Para un Workspace publicado:

`publication_snapshot.artifacts -> contentDnaVersion + scriptureId -> objetos históricos exactos`

Para un Workspace todavía no publicado se mantiene el fallback al estado actual.

El resultado de `analytics.link()` ahora incluye `publicationSnapshotId` cuando existe publicación histórica.

### 5. Matriz ejecutable

Se agregó:

`tests/invalidation.matrix.test.js`

Cubre los 11 eventos declarados:

- CONTENT_DNA_CHANGED
- SCRIPTURE_CHANGED
- TRACK_PLAN_CHANGED
- TRACK_CHANGED
- LYRICS_CHANGED
- MUSIC_CHANGED
- SOUND_SEED_CHANGED
- VOCAL_MODE_CHANGED
- VISUAL_MASTER_CHANGED
- VISUAL_ASSET_CHANGED
- PACKAGING_CHANGED

Cada caso verifica el impacto declarado y, cuando corresponde, que Review quede `INVALIDATED`.

### 6. Historia de publicación

Se agregó:

`tests/publication-history.test.js`

El test verifica que después de publicar con DNA v1 y Scripture A, crear DNA v2 y seleccionar Scripture B no cambia el lineage utilizado por Analytics para la publicación anterior.

### 7. GitHub Actions

`.github/workflows/lineage-validation.yml` ahora ejecuta:

- `tests/lineage.test.js`
- `tests/invalidation.matrix.test.js`
- `tests/publication-history.test.js`

El workflow utiliza Node.js 24 para evitar la advertencia de deprecación de Node.js 20.

## Garantías resultantes

### Regla A — Invalidación

Un evento declarado en `IMPACT` debe tener:

1. un emisor real;
2. un impacto verificable;
3. una prueba de regresión.

### Regla B — Review

Si cambia cualquier artefacto downstream incluido en la matriz, una Review previamente aprobada no puede seguir siendo válida.

### Regla C — Publish

Publish sigue dependiendo de:

1. Review `APPROVED`;
2. lineage exacto de la Review;
3. disponibilidad del conjunto exacto de artefactos revisados.

### Regla D — Historia

Una publicación no debe reinterpretarse con el estado actual del Workspace.

`Publication Snapshot` es la frontera entre:

- estado histórico publicado;
- evolución futura del Workspace.

## Próxima ampliación recomendada

La siguiente capa debería introducir un test end-to-end completo:

`DNA -> Scripture -> Track Plan -> Lyrics -> Music -> Visual -> Packaging -> Review -> Publish -> upstream mutation -> Publish blocked -> rebuild -> Review -> Publish`

Ese flujo probaría el comportamiento completo entre módulos, además de la matriz unitaria actual.
