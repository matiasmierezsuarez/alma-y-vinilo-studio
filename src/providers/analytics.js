'use strict';
/* AnalyticsProvider adapter - captures metrics from manual input or a
   YouTube Studio CSV export. Snapshots are immutable. */

const db = require('../db');

const METRIC_FIELDS = ['views', 'impressions', 'ctr', 'avgViewDuration', 'avgPercentageViewed', 'watchTime', 'likes', 'comments', 'subscribersGained', 'trafficSources'];

function capture(workspaceId, snapshot) {
  const row = {
    workspaceId,
    kind: snapshot.kind || 'custom', /* '7d' | '28d' | '90d' | 'custom' */
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
  const s = db.insert('analytics_snapshots', row);
  db.persist();
  return s;
}

function snapshotsFor(workspaceId) {
  return db.where('analytics_snapshots', (r) => r.workspaceId === workspaceId)
    .sort((a, b) => new Date(a.capturedAt) - new Date(b.capturedAt));
}

function parseCsv(text) {
  /* Accepts YouTube Studio style CSV: tries to find columns for views,
     likes, comments, average view duration, percentage viewed. Best
     effort; the primary import path is manual entry. */
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return null;
  const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
  const idx = (name) => headers.findIndex((h) => h.includes(name));
  const out = { views: null, likes: null, comments: null, avgPercentageViewed: null };
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
    if (cells.length < 2) continue;
    if (out.views == null) {
      const v = idx('views');
      if (v >= 0 && cells[v]) out.views = parseFloat(cells[v].replace(/,/g, ''));
    }
    if (out.likes == null) {
      const l = idx('likes');
      if (l >= 0 && cells[l]) out.likes = parseFloat(cells[l].replace(/,/g, ''));
    }
    if (out.comments == null) {
      const c = idx('comments');
      if (c >= 0 && cells[c]) out.comments = parseFloat(cells[c].replace(/,/g, ''));
    }
    if (out.avgPercentageViewed == null) {
      const p = idx('percentage');
      if (p >= 0 && cells[p]) out.avgPercentageViewed = parseFloat(cells[p].replace(/[^0-9.]/g, ''));
    }
    if (out.avgViewDuration == null) {
      const d = idx('duration');
      if (d >= 0 && cells[d]) {
        const mm = String(cells[d]).match(/(\d+):(\d+)/);
        if (mm) out.avgViewDuration = Number(mm[1]) * 60 + Number(mm[2]);
      }
    }
  }
  return out;
}

module.exports = { capture, snapshotsFor, parseCsv, METRIC_FIELDS };
