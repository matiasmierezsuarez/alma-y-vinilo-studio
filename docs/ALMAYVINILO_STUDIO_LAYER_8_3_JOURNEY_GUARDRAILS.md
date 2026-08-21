# Alma y Vinilo Studio — Layer 8.3 Journey Guardrails

## Objetivo

La navegación entre etapas debe depender del estado real de los artefactos, no de habilitar `NEXT` manualmente.

## Reglas

- Lyrics → Music: todos los tracks requeridos deben tener letra aprobada.
- Music → Visual: todos los tracks requeridos deben tener un audio registrado con `assetUrl`.
- Visual → Packaging: debe existir un asset visual activo con `assetUrl`.
- La ruta `POST /tracks/:trackId/music/:generationId/asset` debe resolver el Track y pasar `track.workspaceId` a `music.recordAsset`.

## Contrato UI

Cada etapa debe calcular `{ complete, completed, total, message }` y delegar el estado de navegación en un helper único. Cuando `complete=false`, `NEXT` debe estar deshabilitado y la interfaz debe explicar qué falta.

## Contrato de regresión

Los tests de aceptación deben comprobar tanto el bloqueo como la habilitación posterior al completar el requisito. El flujo de Music debe usar la ruta HTTP real para registrar el asset y debe fallar si el `workspaceId` de la generación no coincide con el del Track.

## Estado de implementación

Este documento acompaña la implementación funcional de los guardrails y debe mantenerse sincronizado con los tests de journey y acceptance.
