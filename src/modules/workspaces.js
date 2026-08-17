'use strict';
/* Workspace module - one workspace is one complete YouTube content product.
   Status flow: NOT_STARTED -> IN_PROGRESS -> READY -> PUBLISHED -> LEARNING -> ARCHIVED */

const db = require('../db');

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'READY', 'PUBLISHED', 'LEARNING', 'ARCHIVED'];

function create(input) {
  const ws = db.insert('workspaces', {
    name: (input.name || '').trim() || 'Nuevo proyecto',
    status: 'NOT_STARTED',
    seriesId: input.seriesId || null,
    volumeId: input.volumeId || null,
    ideaId: input.ideaId || null,
    scriptureId: null,
    contentDnaVersion: null,
    packagingVersion: null,
    publishedAt: null,
  });
  db.persist();
  return decorate(ws);
}

function get(id) {
  const ws = db.get('workspaces', id);
  return ws ? decorate(ws) : null;
}

function list() {
  return db.all('workspaces').map(decorate).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function update(id, patch) {
  const allowed = ['name', 'status', 'seriesId', 'volumeId', 'ideaId', 'rightsMetadata', 'aiDisclosure'];
  const clean = {};
  allowed.forEach((k) => { if (k in patch) clean[k] = patch[k]; });
  if ('status' in clean && !STATUSES.includes(clean.status)) delete clean.status;
  const ws = db.update('workspaces', id, clean);
  if (!ws) return null;
  db.persist();
  return decorate(ws);
}

/* Delete a workspace and everything linked to it (cascade). */
function remove(id) {
  const ws = db.get('workspaces', id);
  if (!ws) return false;
  const linked = [
    'ideas', 'content_dna', 'scriptures', 'tracks', 'lyrics_versions',
    'music_generations', 'visual_references', 'visual_assets',
    'packaging_versions', 'review_items', 'publication_snapshots',
    'analytics_snapshots', 'experiments', 'learning_observations', 'shorts',
  ];
  linked.forEach((t) => {
    db.where(t, (r) => r.workspaceId === id).forEach((r) => db.remove(t, r.id));
  });
  db.where('jobs', (j) => j.payload && j.payload.workspaceId === id).forEach((j) => db.remove('jobs', j.id));
  db.remove('workspaces', id);
  db.persist();
  return true;
}

/* Stage completion derived from related entities. */
function computeStages(ws) {
  const stages = [
    { id: 'idea', label: 'Idea', done: !!ws.ideaId },
    { id: 'dna', label: 'Content DNA', done: !!ws.contentDnaVersion },
    { id: 'scripture', label: 'Scripture', done: !!ws.scriptureId },
    { id: 'tracks', label: 'Track Plan', done: db.where('tracks', (t) => t.workspaceId === ws.id && t.status === 'APPROVED').length > 0 },
    { id: 'lyrics', label: 'Lyrics', done: db.where('lyrics_versions', (l) => l.workspaceId === ws.id && l.status === 'APPROVED').length > 0 },
    { id: 'music', label: 'Music', done: db.where('music_generations', (m) => m.workspaceId === ws.id && m.status === 'SUCCEEDED').length > 0 },
    { id: 'visual', label: 'Visual', done: db.where('visual_assets', (v) => v.workspaceId === ws.id && v.assetUrl).length > 0 },
    { id: 'packaging', label: 'Packaging', done: !!ws.packagingVersion },
    { id: 'review', label: 'Review', done: latestReviewStatus(ws.id) === 'APPROVED' },
    { id: 'publish', label: 'Publish', done: db.where('publication_snapshots', (p) => p.workspaceId === ws.id).length > 0 },
  ];
  return stages;
}

function latestReviewStatus(workspaceId) {
  const items = db.where('review_items', (r) => r.workspaceId === workspaceId);
  if (!items.length) return 'NOT_STARTED';
  return items[items.length - 1].status;
}

function blockers(ws) {
  const list = [];
  if (!ws.ideaId) list.push('Falta desarrollar una idea.');
  if (!ws.contentDnaVersion) list.push('Falta desarrollar el Content DNA.');
  if (!ws.scriptureId) list.push('Falta aprobar la Scripture.');
  if (db.where('tracks', (t) => t.workspaceId === ws.id && t.status === 'APPROVED').length === 0) list.push('Falta aprobar el Track Plan.');
  const lyricsApproved = db.where('lyrics_versions', (l) => l.workspaceId === ws.id && l.status === 'APPROVED');
  const tracks = db.where('tracks', (t) => t.workspaceId === ws.id && t.status === 'APPROVED');
  if (tracks.length && lyricsApproved.length < tracks.length) list.push('Faltan lyrics aprobadas en algunos tracks.');
  const musicDone = db.where('music_generations', (m) => m.workspaceId === ws.id && m.status === 'SUCCEEDED' && m.assetUrl);
  if (tracks.length && musicDone.length < tracks.length) list.push('Faltan activos de música (Suno) en algunos tracks.');
  const visualWithAsset = db.where('visual_assets', (v) => v.workspaceId === ws.id && v.assetUrl);
  if (!visualWithAsset.length) list.push('Falta miniatura/visual con activo.');
  if (!ws.packagingVersion) list.push('Falta packaging aprobado.');
  const rev = latestReviewStatus(ws.id);
  if (rev === 'BLOCKED') list.push('La revisión está bloqueada.');
  if (rev === 'REJECTED') list.push('La revisión fue rechazada.');
  return list;
}

function decorate(ws) {
  const stages = computeStages(ws);
  const done = stages.filter((s) => s.done).length;
  const total = stages.length;
  const rev = latestReviewStatus(ws.id);
  return Object.assign({}, ws, {
    stages,
    progress: Math.round((done / total) * 100),
    reviewStatus: rev,
    blockers: blockers(ws),
  });
}

module.exports = { STATUSES, create, get, list, update, remove, decorate, latestReviewStatus, blockers };
