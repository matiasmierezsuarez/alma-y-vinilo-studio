'use strict';
/* Review Engine - publishing is blocked until the complete artifact graph
   is current. Review approvals are invalidated when an upstream dependency changes. */

const db = require('../db');
const dnaModule = require('./content-dna');
const scripture = require('./scripture');
const tracks = require('./tracks');
const lyrics = require('./lyrics');
const visual = require('./visual');
const packaging = require('./packaging');

function evaluate(workspaceId) {
  const ws = db.get('workspaces', workspaceId);
  if (!ws) throw new Error('Workspace no encontrado.');
  const dna = dnaModule.getLatest(workspaceId);
  const sc = scripture.getApproved(workspaceId);
  const approvedTracks = tracks.allApproved(workspaceId);
  const lyricsApproved = lyrics.approvedForWorkspace(workspaceId);
  const musicAssets = db.where('music_generations', (m) => m.workspaceId === workspaceId && m.status === 'SUCCEEDED' && m.assetUrl && m.status !== 'STALE');
  const thumbnails = db.where('visual_assets', (v) => v.workspaceId === workspaceId && v.status !== 'STALE');
  const master = visual.getMasterReference();
  const pkg = packaging.latest(workspaceId);
  const items = [];

  items.push({ category: 'Lineage', id: 'dna_current', label: 'Content DNA actual', pass: !!dna && ws.contentDnaVersion === dna.version, detail: dna ? 'Versión ' + dna.version : 'Falta desarrollar Content DNA' });
  items.push({ category: 'Lineage', id: 'scripture_current', label: 'Scripture aprobada y actual', pass: !!sc && sc.status === 'APPROVED' && (!sc.contentDnaVersion || !dna || sc.contentDnaVersion === dna.version), detail: sc ? sc.reference : 'Falta aprobar Scripture' });

  const staleTracks = approvedTracks.filter((t) => t.status === 'STALE' || (dna && t.contentDnaVersion !== dna.version) || (sc && t.scriptureId !== sc.id));
  items.push({ category: 'Lineage', id: 'track_plan_current', label: 'Track Plan vigente', pass: approvedTracks.length > 0 && staleTracks.length === 0, detail: approvedTracks.length + ' track(s) aprobados y vigentes' });

  const requiredTrackIds = new Set(approvedTracks.map((t) => t.id));
  const currentLyrics = lyricsApproved.filter((l) => requiredTrackIds.has(l.trackId));
  const missingLyrics = approvedTracks.filter((t) => !currentLyrics.some((l) => l.trackId === t.id && l.lineage && l.lineage.trackPlanVersion === t.trackPlanVersion && l.lineage.contentDnaVersion === t.contentDnaVersion && l.lineage.scriptureId === t.scriptureId));
  items.push({ category: 'Lineage', id: 'lyrics_current', label: 'Lyrics vigentes', pass: approvedTracks.length > 0 && missingLyrics.length === 0, detail: `${currentLyrics.length}/${approvedTracks.length} tracks con lyrics de la versión correcta` });

  const missingMusic = approvedTracks.filter((t) => !musicAssets.some((m) => m.trackId === t.id && m.status === 'SUCCEEDED' && m.lineage && m.lineage.trackPlanVersion === t.trackPlanVersion && m.lineage.contentDnaVersion === t.contentDnaVersion && m.lineage.scriptureId === t.scriptureId && m.lyricsVersion && lyricsApproved.some((l) => l.trackId === t.id && l.version === m.lyricsVersion && l.status === 'APPROVED')));
  items.push({ category: 'Lineage', id: 'music_current', label: 'Música vigente', pass: approvedTracks.length > 0 && missingMusic.length === 0, detail: `${approvedTracks.length - missingMusic.length}/${approvedTracks.length} tracks con música compatible` });

  const thumbnail = thumbnails.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
  items.push({ category: 'Visual', id: 'master_characters_present', label: 'Personajes maestros presentes', pass: thumbnails.some((t) => /character/i.test(t.prompt || '') || /personaj/i.test(t.prompt || '')), detail: 'El prompt de miniatura debe mencionar los dos personajes' });
  items.push({ category: 'Visual', id: 'thumbnail_generated', label: 'Miniatura generada', pass: !!thumbnail && !!thumbnail.assetUrl, detail: thumbnail && thumbnail.assetUrl ? 'Activo presente' : 'Falta registrar el activo de miniatura' });
  items.push({ category: 'Visual', id: 'visual_reference_respected', label: 'Referencia visual respetada', pass: !master || master.locked, detail: master ? (master.locked ? 'Maestra bloqueada' : 'La maestra no está bloqueada') : 'No hay imagen de referencia maestra configurada' });

  items.push({ category: 'Packaging', id: 'title_present', label: 'Título presente', pass: !!(pkg && pkg.title), detail: pkg && pkg.title ? pkg.title : 'Falta generar packaging' });
  items.push({ category: 'Packaging', id: 'thumbnail_text_reviewed', label: 'Texto de miniatura revisado', pass: !!pkg, detail: pkg ? 'Revisado en packaging' : 'Falta packaging' });
  items.push({ category: 'Packaging', id: 'thumbnail_prompt_present', label: 'Prompt de miniatura presente', pass: !!(pkg && pkg.thumbnailPrompt), detail: pkg && pkg.thumbnailPrompt ? 'Presente' : 'Falta prompt de miniatura en packaging' });
  items.push({ category: 'Packaging', id: 'description_present', label: 'Descripción presente', pass: !!(pkg && pkg.description), detail: pkg && pkg.description ? 'Presente' : 'Falta generar packaging' });
  items.push({ category: 'Packaging', id: 'tags_present', label: 'Tags presentes', pass: !!(pkg && Array.isArray(pkg.tags) && pkg.tags.length), detail: pkg && pkg.tags && pkg.tags.length ? pkg.tags.length + ' tags' : 'Faltan tags' });
  items.push({ category: 'Packaging', id: 'packaging_current', label: 'Packaging vigente', pass: !!pkg && pkg.status !== 'STALE' && pkg.lineage && pkg.lineage.contentDnaVersion === (dna ? dna.version : null) && pkg.lineage.scriptureId === (sc ? sc.id : null), detail: pkg ? (pkg.status === 'STALE' ? 'Packaging obsoleto' : 'Vigente') : 'Falta packaging' });

  items.push({ category: 'Compliance', id: 'rights_metadata', label: 'Metadatos de derechos/fuente completos', pass: !!ws.rightsMetadata, detail: ws.rightsMetadata ? 'Completados' : 'Falta registrar derechos/fuente' });
  items.push({ category: 'Compliance', id: 'ai_disclosure', label: 'Divulgación IA según plataforma', pass: ws.aiDisclosure === true, detail: ws.aiDisclosure === true ? 'Declarada' : 'Falta marcar divulgación IA' });
  items.push({ category: 'Compliance', id: 'no_fabricated_scripture', label: 'Sin citas bíblicas fabricadas', pass: !!sc, detail: sc ? 'Referencia aprobada registrada' : 'Falta Scripture aprobada' });
  items.push({ category: 'Compliance', id: 'no_missing_assets', label: 'Sin activos requeridos faltantes', pass: approvedTracks.length > 0 && missingMusic.length === 0 && !!thumbnail && !!thumbnail.assetUrl, detail: 'Audio y miniatura registrados' });

  const blocks = items.filter((i) => !i.pass);
  const status = blocks.length ? 'BLOCKED' : 'READY_FOR_REVIEW';
  const lineage = {
    workspaceId,
    contentDnaVersion: dna ? dna.version : null,
    scriptureId: sc ? sc.id : null,
    trackPlanVersion: approvedTracks.length ? Math.max(...approvedTracks.map((t) => t.trackPlanVersion || 0)) : null,
    packagingVersion: pkg ? pkg.version : null,
    visualMasterReferenceId: master ? master.id : null,
    visualAssetId: thumbnail ? thumbnail.id : null,
    visualAssetVersion: thumbnail ? thumbnail.version : null,
    tracks: approvedTracks.map((t) => {
      const lyr = currentLyrics.find((l) => l.trackId === t.id && l.lineage && l.lineage.trackPlanVersion === t.trackPlanVersion && l.lineage.contentDnaVersion === t.contentDnaVersion && l.lineage.scriptureId === t.scriptureId);
      const mus = musicAssets.find((m) => m.trackId === t.id && m.lineage && m.lineage.trackPlanVersion === t.trackPlanVersion && m.lineage.contentDnaVersion === t.contentDnaVersion && m.lineage.scriptureId === t.scriptureId && m.lyricsVersion && lyr && m.lyricsVersion === lyr.version);
      return { trackId: t.id, trackPlanVersion: t.trackPlanVersion, lyricsVersion: lyr ? lyr.version : null, musicGenerationId: mus ? mus.id : null };
    }),
  };

  const row = db.insert('review_items', {
    workspaceId,
    status,
    items,
    lineage,
    reviewId: workspaceId + '-' + Date.now().toString(36),
  });
  db.persist();
  return row;
}

function approve(workspaceId) {
  const latest = db.where('review_items', (r) => r.workspaceId === workspaceId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  if (!latest || latest.status !== 'READY_FOR_REVIEW') throw new Error('No puedes aprobar: la revisión debe estar READY_FOR_REVIEW.');
  const row = db.insert('review_items', {
    workspaceId,
    status: 'APPROVED',
    items: latest.items,
    lineage: JSON.parse(JSON.stringify(latest.lineage)),
    sourceReviewId: latest.id,
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
    lineage: latest ? JSON.parse(JSON.stringify(latest.lineage)) : null,
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
