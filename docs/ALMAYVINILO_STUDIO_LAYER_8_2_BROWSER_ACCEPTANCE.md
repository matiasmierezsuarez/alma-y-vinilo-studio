# Alma y Vinilo Studio — Layer 8.2

## Objetivo

La Layer 8.2 convierte el flujo visible del Workspace en un contrato de aceptación.

Journey canónico:

Workspace -> Idea -> Content DNA -> Scripture -> Tracks -> Lyrics -> Music -> Visual -> Packaging -> Review -> Publish.

## Protección añadida ahora

Se añadió `tests/workspace.user-journey.contract.test.js`.

El test comprueba:

1. cada etapa canónica tiene renderer;
2. cada renderer está conectado al dispatcher de etapas;
3. existen los controles de navegación Back/Next y el shell de etapas;
4. la UI sigue apuntando a las rutas públicas necesarias para completar el journey;
5. el servidor sigue exponiendo las mismas familias de rutas;
6. Music asset registration conserva trackId y generationId en el contrato visible.

## Descubrimientos UX de la auditoría del journey

La inspección del flujo actual detectó tres puntos que una automatización de navegador debe bloquear:

### Lyrics

La etapa actualmente permite `NEXT` sin verificar que todas las letras estén aprobadas. El criterio correcto es:

- todos los tracks APPROVED deben tener una versión de Lyrics APPROVED;
- si uno falta, NEXT debe permanecer deshabilitado y la UI debe mostrar el faltante.

### Music

La etapa actualmente permite avanzar aunque no exista ningún asset de audio registrado. El criterio correcto es:

- cada track APPROVED debe tener una generación compatible con `assetUrl`;
- NEXT debe permanecer deshabilitado hasta que el conjunto esté completo;
- la UI debe mostrar cuántos tracks faltan.

### Visual

La etapa actualmente permite avanzar aunque la miniatura no tenga asset registrado. El criterio correcto es:

- debe existir un visual activo con assetUrl;
- NEXT debe permanecer deshabilitado mientras falte;
- Review sigue siendo la autoridad final, pero la navegación no debe presentar una falsa sensación de completitud.

## Music route contract

La ruta correcta es:

POST /tracks/:trackId/music/:generationId/asset

Implementación requerida en `server.js`:

```js
const track = tracks.get(re[1]);
if (!track) return fail(res, new Error('Track no encontrado.'));
return ok(res, {
  generation: music.recordAsset(track.workspaceId, re[2], body || {})
});
```

No debe usarse `null` como workspaceId. El módulo Music debe seguir validando que generation y track pertenezcan al mismo Workspace.

## Próximo nivel: browser automation real

El repositorio actual no tiene package manager ni runner de navegador, por lo que no se añadió una dependencia ficticia. La siguiente implementación debe introducir explícitamente un runner reproducible, preferentemente Playwright, con:

- instalación declarada;
- servidor arrancado en un puerto temporal;
- estado temporal aislado;
- tests headless;
- ejecución en GitHub Actions.

Escenarios mínimos:

1. crear Workspace y completar Idea -> Scripture;
2. comprobar que NEXT queda bloqueado cuando faltan requisitos;
3. registrar Music asset mediante UI;
4. registrar Visual asset mediante UI;
5. completar Review y Publish;
6. cambiar Scripture;
7. comprobar visualmente estado invalidado;
8. intentar Publish y comprobar bloqueo;
9. reconstruir y publicar una nueva versión;
10. verificar que la publicación anterior permanece visible como histórica.

## Definition of done

La Layer 8 se considerará completamente cerrada cuando el CI ejecute tanto el contrato actual como un test de navegador real sobre los escenarios anteriores.
