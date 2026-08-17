'use strict';
/* Review Engine - publishing is blocked until review passes.
   Status: BLOCKED | READY_FOR_REVIEW | APPROVED | REJECTED. */

const db = require('../db');
const dnaModule = require('./content-dna');
const scripture = require('./scripture');
const tracks = require('./tracks');
const lyrics = require('./lyrics');
const packaging = require('./packaging');
const visual = require('./visual');

function evaluate(workspaceId) {
  const ws = db.get('workspaces', workspaceId);
  if (!ws) throw new Error('Workspace no encontrado.');
  const items = [];
  const approvedTracks = tracks.allApproved(workspaceId);
  const lyricsApproved = lyrics.approvedForWorkspace(workspaceId);
  const musicAssets = db.where('music_generations', (m) => m.workspaceId === workspaceId && m.status === 'SUCCEEDED' && m.assetUrl);
  const thumbnails = db.where('visual_assets', (v) => v.workspaceId === workspaceId);
  const master = visual.getMasterReference();
  const pkg = packaging.latest(workspaceId);

  /* Content */
  items.push({ category: 'Content', id: 'dna_complete', label: 'Content DNA completo', pass: !!ws.contentDnaVersion, detail: ws.contentDnaVersion ? 'Versión ' + ws.contentDnaVersion : 'Falta desarrollar el Content DNA' });
  items.push({ category: 'Content', id: 'scripture_approved', label: 'Scripture aprobada', pass: !!scripture.getApproved(workspaceId), detail: scripture.currentReference(workspaceId) || 'Falta aprobar Scripture' });
  items.push({ category: 'Content', id: 'track_plan_complete', label: 'Track plan completo', pass: approvedTracks.length > 0, detail: approvedTracks.length + ' track(s) aprobados' });
  items.push({ category: 'Content', id: 'lyrics_complete', label: 'Lyrics completas donde se requieren', pass: approvedTracks.length === 0 || lyricsApproved.length >= approvedTracks.length, detail: lyricsApproved.length + '/' + approvedTracks.length + ' tracks con lyrics aprobadas' });
  items.push({ category: 'Content', id: 'music_assets_complete', label: 'Activos de música completos', pass: approvedTracks.length === 0 || musicAssets.length >= approvedTracks.length, detail: musicAssets.length + '/' + approvedTracks.length + ' tracks con audio registrado' });

  /* Visual */
  items.push({ category: 'Visual', id: 'master_characters_present', label: 'Personajes maestros presentes', pass: thumbnails.some((t) => /character/i.test(t.prompt || '')), detail: 'El prompt de miniatura debe mencionar los dos personajes' });
  items.push({ category: 'Visual', id: 'thumbnail_generated', label: 'Miniatura generada', pass: thumbnails.some((t) => t.assetUrl), detail: thumbnails.some((t) => t.assetUrl) ? 'Activo presente' : 'Falta registrar el activo de miniatura' });
  items.push({ category: 'Visual', id: 'visual_reference_respected', label: 'Referencia visual respetada', pass: !master || master.locked, detail: master ? (master.locked ? 'Maestra bloqueada' : 'La maestra no está bloqueada') : 'No hay imagen de referencia maestra configurada' });

  /* Packaging */
  items.push({ category: 'Packaging', id: 'title_present', label: 'Título presente', pass: !!(pkg && pkg.title), detail: pkg && pkg.title ? pkg.title : 'Falta generar packaging' });
  items.push({ category: 'Packaging', id: 'thumbnail_text_reviewed', label: 'Texto de miniatura revisado', pass: !!pkg, detail: pkg ? 'Revisado en packaging' : 'Falta packaging' });
  items.push({ category: 'Packaging', id: 'thumbnail_prompt_present', label: 'Prompt de miniatura presente', pass: !!(pkg && pkg.thumbnailPrompt), detail: pkg && pkg.thumbnailPrompt ? 'Presente' : 'Falta prompt de miniatura en packaging' });
  items.push({ category: 'Packaging', id: 'description_present', label: 'Descripción presente', pass: !!(pkg && pkg.description), detail: pkg && pkg.description ? 'Presente' : 'Falta descripción' });
  items.push({ category: 'Packaging', id: 'tags_present', label: 'Tags presentes', pass: !!(pkg && Array.isArray(pkg.tags) && pkg.tags.length), detail: pkg && pkg.tags && pkg.tags.length ? pkg.tags.length + ' tags' : 'Faltan tags' });

  /* Compliance */
  items.push({ category: 'Compliance', id: 'rights_metadata', label: 'Metadatos de derechos/fuente completos', pass: !!ws.rightsMetadata, detail: ws.rightsMetadata ? 'Completados' : 'Falta registrar derechos/fuente' });
  items.push({ category: 'Compliance', id: 'ai_disclosure', label: 'Divulgación IA según plataforma', pass: ws.aiDisclosure === true, detail: ws.aiDisclosure === true ? 'Declarada' : 'Falta marcar divulgación IA' });
  items.push({ category: 'Compliance', id: 'no_fabricated_scripture', label: 'Sin citas bíblicas fabricadas', pass: !!scripture.getApproved(workspaceId), detail: 'El sistema solo almacena referencias aprobadas; no fabrica citas' });
  items.push({ category: 'Compliance', id: 'no_missing_assets', label: 'Sin activos requeridos faltantes', pass: approvedTracks.length === 0 || (musicAssets.length >= approvedTracks.length && thumbnails.some((t) => t.assetUrl)), detail: 'Audio y miniatura registrados' });

  const blocks = items.filter((i) => !i.pass);
  const status = blocks.length ? 'BLOCKED' : 'READY_FOR_REVIEW';
  const row = db.insert('review_items', {
    workspaceId,
    status,
    items,
    reviewId: workspaceId + '-' + Date.now().toString(36),
  });
  db.persist();
  return row;
}

function approve(workspaceId) {
  const latest = db.where('review_items', (r) => r.workspaceId === workspaceId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  if (!latest || latest.status === 'BLOCKED') throw new Error('No puedes aprobar: hay bloqueos. Corrige y vuelve a evaluar.');
  const row = db.insert('review_items', {
    workspaceId,
    status: 'APPROVED',
    items: latest.items,
    approvedAt: new Date().toISOString(),
  });
  db.update('workspaces', workspaceId, { status: 'READY' });
  db.persist();
  return row;
}

function reject(workspaceId, note) {
  const latest = db.where('review_items', (r) => r.workspaceId === workspaceId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const row = db.insert('review_items', {
    workspaceId,
    status: 'REJECTED',
    note: note || '',
    items: latest ? latest.items : [],
    rejectedAt: new Date().toISOString(),
  });
  db.persist();
  return row;
}

function status(workspaceId) {
  return db.where('review_items', (r) => r.workspaceId === workspaceId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function latest(workspaceId) {
  return db.where('review_items', (r) => r.workspaceId === workspaceId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
}

module.exports = { evaluate, approve, reject, status, latest };
