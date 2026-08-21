# Alma y Vinilo Studio

Alma y Vinilo Studio es un sistema de producción creativa asistida por IA para un canal de YouTube de música cristiana. Organiza cada proyecto desde la idea inicial hasta la publicación, conserva el historial de decisiones y conecta el rendimiento publicado con aprendizaje reutilizable.

La aplicación no funciona como un generador genérico de prompts. La IA opera dentro de restricciones creativas controladas; el Workspace conserva las decisiones, versiones, dependencias y resultados.

## Flujo de producción

```text
IDEA
  -> CONTENT DNA
  -> SCRIPTURE
  -> TRACK PLAN
  -> LYRICS
  -> MUSIC
  -> VISUAL
  -> PACKAGING
  -> REVIEW
  -> PUBLISH
  -> ANALYTICS
  -> LEARNING
```

Cada Workspace representa un producto completo para YouTube. Sus artefactos importantes registran identidad, versión, estado de ciclo de vida y lineage upstream.

## Capacidades principales

- Desarrollo de ideas y Content DNA versionado.
- Selección de Scripture desde un catálogo curado.
- Track Plans antes de generar lyrics o música.
- Dos semillas de sonido controladas: Jazz/Vinyl y Gospel Soul/R&B.
- Dirección visual estable con referencias y activos versionados.
- Packaging para título, descripción, tags y miniatura.
- Review obligatoria antes de publicar.
- Preview de impacto antes de cambios con consecuencias.
- Invalidación dependiente del lineage, con aislamiento entre Tracks.
- Publication Snapshots inmutables.
- Analytics vinculados al snapshot exacto publicado.
- Learning y recomendaciones advisory basadas en evidencia cross-project.

## Requisitos

- Node.js 24 o compatible con las APIs usadas por el proyecto.
- Windows: `start.ps1` o `iniciar.bat` abren el servidor y el navegador.
- No se requiere `npm install`: el servidor utiliza módulos nativos de Node y providers locales del proyecto.

## Ejecutar localmente

Desde la raíz del repositorio:

```powershell
node server.js
```

Abrir [http://localhost:3051](http://localhost:3051).

En Windows también se puede usar:

```powershell
.\start.ps1
```

O ejecutar `iniciar.bat` desde el Explorador de archivos.

### Configuración del estado

Por defecto, el estado se guarda en:

```text
C:\Users\Public\Alma y Vinilo Studio 2\studio2.json
```

Para usar otro directorio de estado:

```powershell
$env:ALMA_STUDIO2_STATE_DIR = "C:\ruta\al\estado"
node server.js
```

El puerto por defecto es `3051`. Se puede cambiar con `PORT`:

```powershell
$env:PORT = "3052"
node server.js
```

## Proveedores de IA

La aplicación funciona con fallbacks offline deterministas para desarrollo y pruebas. Los providers externos se encuentran en `src/providers/` y se mantienen separados de la lógica de dominio.

La configuración de modelos se encuentra en [config/llm.json](config/llm.json). La integración con OpenRouter puede configurarse desde la interfaz de la aplicación o mediante la configuración documentada en el proyecto.

## Arquitectura

```text
server.js             API HTTP y servidor estático
app.js                Interfaz del Workspace
src/db.js             Persistencia JSON versionada
src/modules/          Lógica de dominio por etapa
src/providers/        Adaptadores de IA, música, imágenes y publicación
config/               Semillas, reglas y DNA visual
tests/                Contratos y regresiones ejecutables
docs/                 Especificaciones y documentación de continuidad
```

La dependencia de producción se expresa como un grafo explícito:

```text
changed artifact
  -> direct descendants
  -> recursive descendants
  -> stale or invalidated current artifacts
```

La pertenencia a un Workspace por sí sola no demuestra dependencia. El lineage explícito es la fuente principal; los datos legacy sin lineage se tratan mediante fallback conservador y explícito.

## Contratos importantes

- Preview es estrictamente read-only.
- Cancelar un cambio no ejecuta mutaciones de dominio.
- Confirmar ejecuta una sola vez la mutación existente.
- Un cambio en Track A no invalida descendientes de Track B.
- Los artefactos `STALE` no pueden pasar Review ni Publish.
- Publish consume el conjunto exacto aprobado por Review.
- Los snapshots publicados nunca se reescriben.
- Analytics y Learning resuelven el lineage histórico publicado, no el Workspace latest.
- Las recomendaciones cross-project son explicables y advisory; no modifican históricos.

## Pruebas

La suite crítica se ejecuta directamente con Node:

```powershell
node tests/lineage.test.js
node tests/lineage.enforcement.test.js
node tests/dependency-resolver.contract.test.js
node tests/invalidation.matrix.test.js
node tests/invalidation.track-isolation.test.js
node tests/impact-preview.contract.test.js
node tests/review.integrity.test.js
node tests/publish.integrity.test.js
node tests/publication-history.test.js
node tests/analytics.historical.test.js
node tests/learning.integrity.test.js
node tests/studio.intelligence.test.js
node tests/workspace.e2e.regression.test.js
node tests/workspace.acceptance.api.test.js
node tests/workspace.ui.contract.test.js
node tests/workspace.user-journey.contract.test.js
```

El workflow de GitHub Actions ejecuta esta misma suite en Node 24:

[`.github/workflows/lineage-validation.yml`](.github/workflows/lineage-validation.yml)

## Documentacion

- [Especificacion final](docs/ALMAYVINILO_STUDIO_2_FINAL_SPEC.md)
- [Implementacion del lineage](docs/ALMAYVINILO_STUDIO_2_LINEAGE_IMPLEMENTATION.md)
- [Especificacion de API](docs/API_SPEC.md)
- [Modelo de datos](docs/DATA_MODEL.md)
- [Flujo UX](docs/UX_FLOW.md)
- [Roadmap arquitectonico](docs/continuity/ALMAYVINILO_STUDIO_ARCHITECTURAL_ROADMAP.md)
- [Estado de capas](docs/continuity/ALMAYVINILO_STUDIO_LAYER_STATUS.md)
- [North Star del producto](docs/continuity/ALMAYVINILO_STUDIO_PRODUCT_NORTH_STAR.md)

## Estado del proyecto

La rama `refactor/lineage-dependency-graph` contiene el cierre de la refactorizacion de lineage, invalidacion, Review, Publish, Analytics, Learning y Studio intelligence. Layer 9.2 esta cerrada y la rama cuenta con contratos de regresion para la validacion pre-PR.
