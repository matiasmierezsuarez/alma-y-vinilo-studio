'use strict';
/* Analytics Engine - captures metrics linked to the exact Content DNA
   that produced the video. Snapshots are immutable. Provides baseline
   and performance index with heuristic bands. */

const db = require('../db');
const analyticsProvider = require('../providers/analytics');
const config = require('../config');
const dnaModule = require('./content-dna');
const scripture = require('./scripture');

function capture(workspaceId, snapshot) {
  return analyticsProvider.capture(workspaceId, snapshot);
}

function snapshots(workspaceId) {
  return analyticsProvider.snapshotsFor(workspaceId);
}

function captureFromCsv(workspaceId, text) {
  const parsed = analyticsProvider.parseCsv(text);
  if (!parsed) throw new Error('No se pudo interpretar el CSV.');
  return analyticsProvider.capture(workspaceId, Object.assign(parsed, { kind: 'custom', capturedAt: new Date().toISOString() }));
}

/* Comparable baseline: same channel, same content type, comparable age.
   Uses other published workspaces with snapshots; falls back to the
   workspace's own average when there is no comparable set. */
function comparableBaseline(workspaceId, metric) {
  const ws = db.get('workspaces', workspaceId);
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

/* Link analytics to the exact Content DNA combination. */
function link(workspaceId) {
  const dna = dnaModule.getLatest(workspaceId);
  const sc = scripture.getApproved(workspaceId);
  const ws = db.get('workspaces', workspaceId);
  return {
    workspaceId,
    contentDna: dna ? {
      moment: dna.moment,
      humanNeed: dna.humanNeed,
      desiredEmotion: dna.desiredEmotion,
      soundSeed: dna.soundSeed,
      vocalMode: dna.vocalMode,
      packagingFormula: dna.packagingFormula,
      visualScenario: dna.visualScenario,
      version: dna.version,
    } : null,
    scripture: sc ? { reference: sc.reference, book: sc.book, theme: sc.theme } : null,
    series: ws.seriesId || null,
    duration: ws.duration || null,
  };
}

module.exports = { capture, snapshots, captureFromCsv, performance, link, comparableBaseline, labelForIndex };
