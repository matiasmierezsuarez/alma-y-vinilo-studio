'use strict';
/* AnalyticsProvider adapter - immutable metrics linked to the exact
   publication snapshot that produced the measured video. */

const db = require('../db');
const METRIC_FIELDS = ['views', 'impressions', 'ctr', 'avgViewDuration', 'avgPercentageViewed', 'watchTime', 'likes', 'comments', 'subscribersGained', 'trafficSources'];

function latestPublication(workspaceId) {
  return db.where('publication_snapshots', (p) => p.workspaceId === workspaceId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
}
function capture(workspaceId, snapshot) {
  const publication = snapshot.publicationSnapshotId ? db.get('publication_snapshots', snapshot.publicationSnapshotId) : latestPublication(workspaceId);
  if (snapshot.publicationSnapshotId && (!publication || publication.workspaceId !== workspaceId)) {
    throw new Error('El snapshot de publicación no pertenece al Workspace.');
  }
  const row = {
    workspaceId,
    publicationSnapshotId: publication ? publication.id : null,
    lineage: publication ? publication.artifacts || null : snapshot.lineage || null,
    kind: snapshot.kind || 'custom',
    capturedAt: snapshot.capturedAt || new Date().toISOString(),
    views: snapshot.views != null ? Number(snapshot.views) : null,
    impressions: snapshot.impressions != null ? Number(snapshot.impressions) : null,
    ctr: snapshot.ctr != null ? Number(snapshot.ctr) : null,
    avgViewDuration: snapshot.avgViewDuration != null ? Number(snapshot.avgViewDuration) : null,
    avgPercentageViewed: snapshot.avgPercentageViewed != null ? Number(snapshot.avgPercentageViewed) : null,
    watchTime: snapshot.watchTime != null ? Number(snapshot.watchTime) : null,
    likes: snapshot.likes != null ? Number(snapshot.likes) : null,
    comments: snapshot.comments != null ? Number(snapshot.comments) : null,
    subscribersGained: snapshot.subscribersGained != null ? Number(snapshot.subscribersGained) : null,
    trafficSources: Array.isArray(snapshot.trafficSources) ? snapshot.trafficSources : [],
    immutable: true,
  };
  const s = db.insert('analytics_snapshots', row); db.persist(); return s;
}
function snapshotsFor(workspaceId) { return db.where('analytics_snapshots', (r) => r.workspaceId === workspaceId).sort((a, b) => new Date(a.capturedAt) - new Date(b.capturedAt)); }
function parseCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim()); if (!lines.length) return null;
  const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase()); const idx = (name) => headers.findIndex((h) => h.includes(name));
  const out = { views: null, likes: null, comments: null, avgPercentageViewed: null };
  for (let i = 1; i < lines.length; i++) { const cells = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim()); if (cells.length < 2) continue;
    if (out.views == null) { const v = idx('views'); if (v >= 0 && cells[v]) out.views = parseFloat(cells[v].replace(/,/g, '')); }
    if (out.likes == null) { const l = idx('likes'); if (l >= 0 && cells[l]) out.likes = parseFloat(cells[l].replace(/,/g, '')); }
    if (out.comments == null) { const c = idx('comments'); if (c >= 0 && cells[c]) out.comments = parseFloat(cells[c].replace(/,/g, '')); }
    if (out.avgPercentageViewed == null) { const p = idx('percentage'); if (p >= 0 && cells[p]) out.avgPercentageViewed = parseFloat(cells[p].replace(/[^0-9.]/g, '')); }
    if (out.avgViewDuration == null) { const d = idx('duration'); if (d >= 0 && cells[d]) { const mm = String(cells[d]).match(/(\d+):(\d+)/); if (mm) out.avgViewDuration = Number(mm[1]) * 60 + Number(mm[2]); } }
  }
  return out;
}
module.exports = { capture, snapshotsFor, parseCsv, METRIC_FIELDS };
