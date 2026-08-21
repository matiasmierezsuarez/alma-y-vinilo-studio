'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../src/db');
const analytics = require('../src/modules/analytics');
const learning = require('../src/modules/learning');
const publishingProvider = require('../src/providers/publishing');

const file = path.join(os.tmpdir(), 'alma-y-vinilo-learning-integrity-' + Date.now() + '.json');
db.init(file);

function seedPublication(workspaceId, version, scriptureId) {
  const packaging = db.insert('packaging_versions', { workspaceId, version, title: 'Título ' + version });
  return publishingProvider.recordPublication(workspaceId, {
    url: 'https://youtube.example/' + version,
    artifacts: {
      contentDnaVersion: version,
      scriptureId,
      trackPlanVersion: version,
      packagingVersion: packaging.version,
      visual: { assetId: 'thumbnail-' + version, assetVersion: version },
      tracks: [{ trackId: 'track-' + version, trackPlanVersion: version, lyricsVersion: version, musicGenerationId: 'music-' + version }],
    },
  });
}

try {
  const workspace = db.insert('workspaces', { name: 'Learning integrity' });
  const dna1 = db.insert('content_dna', { name: 'workspaceId', value: workspace.id, workspaceId: workspace.id, version: 1, moment: 'night', humanNeed: 'rest', desiredEmotion: 'peace', soundSeed: 'SEED_A_JAZZ_VINYL', vocalMode: 'SOFT_FEMALE', packagingFormula: 'MOMENT_FIRST' });
  const scripture1 = db.insert('scriptures', { workspaceId: workspace.id, reference: 'Salmo 23', book: 'Salmos', status: 'APPROVED' });
  const first = seedPublication(workspace.id, dna1.version, scripture1.id);
  analytics.capture(workspace.id, { publicationSnapshotId: first.id, views: 100, ctr: 2 });

  const dna2 = db.insert('content_dna', { name: 'workspaceId', value: workspace.id, workspaceId: workspace.id, version: 2, moment: 'morning', humanNeed: 'hope', desiredEmotion: 'joy', soundSeed: 'SEED_B_GOSPEL_RNB', vocalMode: 'SOFT_MALE', packagingFormula: 'EMOTION_FIRST' });
  const scripture2 = db.insert('scriptures', { workspaceId: workspace.id, reference: 'Isaías 40:31', book: 'Isaías', status: 'APPROVED' });
  const second = seedPublication(workspace.id, dna2.version, scripture2.id);
  analytics.capture(workspace.id, { publicationSnapshotId: second.id, views: 200, ctr: 4 });

  learning.buildObservations();
  const observations = db.all('learning_observations');
  assert.strictEqual(observations.length, 2);
  const firstObservation = observations.find((row) => row.publicationSnapshotId === first.id);
  assert.strictEqual(firstObservation.views, 100);
  assert.strictEqual(firstObservation.combination.contentDnaVersion, 1);
  assert.strictEqual(firstObservation.combination.packagingVersion, 1);
  assert.strictEqual(firstObservation.combination.thumbnailAssetId, 'thumbnail-1');
  assert.strictEqual(firstObservation.combination.trackCount, 1);
  const patterns = learning.aggregate();
  const firstPattern = patterns.find((pattern) => pattern.evidencePublicationSnapshotIds.includes(first.id));
  const secondPattern = patterns.find((pattern) => pattern.evidencePublicationSnapshotIds.includes(second.id));
  assert.ok(firstPattern);
  assert.ok(secondPattern);

  analytics.capture(workspace.id, { views: 999 });
  learning.buildObservations();
  assert.strictEqual(db.get('learning_observations', firstObservation.id).views, 100);
  assert.strictEqual(db.all('learning_observations').length, 2);
  console.log('learning integrity tests: OK');
} finally {
  try { fs.unlinkSync(file); } catch (_) {}
}
