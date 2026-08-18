'use strict';
/* Analytics Engine - metrics are linked to the immutable publication snapshot
   whenever one exists. Current workspace state is only a fallback for
   unpublished work. */

const db = require('../db');
const analyticsProvider = require('../providers/analytics');
const config = require('../config');
const dnaModule = require('./content-dna');
const scripture = require('./scripture');

function capture(workspaceId, snapshot) { return analyticsProvider.capture(workspaceId, snapshot); }
function snapshots(workspaceId) { return analyticsProvider.snapshotsFor(workspaceId); }
function captureFromCsv(workspaceId, text) {
  const parsed = analyticsProvider.parseCsv(text);
  if (!parsed) throw new Error('No se pudo interpretar el CSV.');
  return analyticsProvider.capture(workspaceId, Object.assign(parsed, { kind: 'custom', capturedAt: new Date().toISOString() }));
}
function latestPublication(workspaceId) {
  return db.where('publication_snapshots', (p) => p.workspaceId === workspaceId)
    .sort((a, b) => new Date(a.publishDate || a.createdAt) - new Date(b.publishDate || b.createdAt)).pop() || null;
}
function resolveDnaVersion(workspaceId, version) {
  if (version == null) return null;
  return db.allVersions('content_dna', { name: 'workspaceId', value: workspaceId })
    .find((x) => Number(x.version) === Number(version)) || null;
}
function comparableBaseline(workspaceId, metric) {
  const pubs = db.where('publication_snapshots', (p) => p.workspaceId !== workspaceId && p.url);
  const candidates = [];
  pubs.forEach((p) => {
    const snaps = analyticsProvider.snapshotsFor(p.workspaceId);
    if (snaps.length) candidates.push(snaps[snaps.length - 1][metric]);
  });
  if (candidates.length >= 2) {
    const sorted = candidates.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
  const own = analyticsProvider.snapshotsFor(workspaceId).map((s) => s[metric]).filter((v) => v != null);
  if (own.length) return own.reduce((a, b) => a + b, 0) / own.length;
  return null;
}
function labelForIndex(index) {
  const rules = config.experimentRules().baseline;
  if (index == null) return 'N/A';
  if (index < rules.bandWeak) return 'WEAK';
  if (index < rules.bandStrong) return 'NORMAL';
  if (index < rules.bandOutlier) return 'STRONG';
  return 'OUTLIER_CANDIDATE';
}
function performance(workspaceId) {
  const snaps = analyticsProvider.snapshotsFor(workspaceId);
  const latest = snaps[snaps.length - 1];
  if (!latest) return { snapshots: snaps, metrics: [], baseline: null };
  const metrics = [];
  ['views', 'impressions', 'watchTime', 'likes', 'comments', 'subscribersGained'].forEach((m) => {
    const value = latest[m];
    const base = comparableBaseline(workspaceId, m);
    const index = base ? value / base : null;
    metrics.push({ metric: m, value, baseline: base, index, label: labelForIndex(index) });
  });
  return { snapshots: snaps, metrics, baseline: 'same channel + content type + comparable age' };
}
function dnaSummary(dna) {
  if (!dna) return null;
  return {
    moment: dna.moment,
    humanNeed: dna.humanNeed,
    desiredEmotion: dna.desiredEmotion,
    soundSeed: dna.soundSeed,
    vocalMode: dna.vocalMode,
    packagingFormula: dna.packagingFormula,
    visualScenario: dna.visualScenario,
    version: dna.version,
  };
}
/* Link analytics to the exact published lineage. Unpublished work falls back
   to the current workspace because no immutable publication snapshot exists. */
function link(workspaceId) {
  const publication = latestPublication(workspaceId);
  const artifacts = publication && publication.artifacts ? publication.artifacts : null;
  const dna = artifacts ? resolveDnaVersion(workspaceId, artifacts.contentDnaVersion) : dnaModule.getLatest(workspaceId);
  const scriptureId = artifacts ? artifacts.scriptureId : null;
  const sc = scriptureId ? db.get('scriptures', scriptureId) : scripture.getApproved(workspaceId);
  const ws = db.get('workspaces', workspaceId);
  return {
    workspaceId,
    publicationSnapshotId: publication ? publication.id : null,
    contentDna: dnaSummary(dna),
    scripture: sc ? { reference: sc.reference, book: sc.book, theme: sc.theme } : null,
    series: publication ? publication.series || ws.seriesId || null : ws.seriesId || null,
    duration: ws.duration || null,
  };
}

module.exports = { capture, snapshots, captureFromCsv, performance, link, latestPublication, comparableBaseline, labelForIndex };
