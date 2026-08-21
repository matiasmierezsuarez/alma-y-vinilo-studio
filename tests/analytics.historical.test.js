'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../src/db');
const analytics = require('../src/modules/analytics');
const analyticsProvider = require('../src/providers/analytics');
const publishingProvider = require('../src/providers/publishing');

const file = path.join(os.tmpdir(), 'alma-y-vinilo-analytics-historical-' + Date.now() + '.json');
db.init(file);

try {
  const workspace = db.insert('workspaces', { name: 'Historical analytics' });
  const otherWorkspace = db.insert('workspaces', { name: 'Other workspace' });
  const dnaV1 = db.insert('content_dna', { name: 'workspaceId', value: workspace.id, workspaceId: workspace.id, version: 1, moment: 'night', humanNeed: 'rest', desiredEmotion: 'peace', soundSeed: 'SEED_A_JAZZ_VINYL', vocalMode: 'SOFT_FEMALE', visualScenario: {} });
  const scriptureV1 = db.insert('scriptures', { workspaceId: workspace.id, reference: 'Salmo 23:1', book: 'Salmos', theme: 'rest', status: 'APPROVED' });
  const first = publishingProvider.recordPublication(workspace.id, { url: 'https://youtube.example/first', artifacts: { contentDnaVersion: dnaV1.version, scriptureId: scriptureV1.id } });
  const dnaV2 = db.insert('content_dna', { name: 'workspaceId', value: workspace.id, workspaceId: workspace.id, version: 2, moment: 'morning', humanNeed: 'hope', desiredEmotion: 'joy', soundSeed: 'SEED_B_GOSPEL_RNB', vocalMode: 'SOFT_MALE', visualScenario: {} });
  const scriptureV2 = db.insert('scriptures', { workspaceId: workspace.id, reference: 'Isaías 40:31', book: 'Isaías', theme: 'hope', status: 'APPROVED' });
  const second = publishingProvider.recordPublication(workspace.id, { url: 'https://youtube.example/second', artifacts: { contentDnaVersion: dnaV2.version, scriptureId: scriptureV2.id } });

  const linkedFirst = analytics.link(workspace.id, first.id);
  assert.strictEqual(linkedFirst.publicationSnapshotId, first.id);
  assert.strictEqual(linkedFirst.contentDna.version, 1);
  assert.strictEqual(linkedFirst.scripture.reference, 'Salmo 23:1');
  assert.strictEqual(analytics.link(workspace.id).publicationSnapshotId, second.id);

  const captured = analytics.capture(workspace.id, { publicationSnapshotId: first.id, views: 100 });
  assert.strictEqual(captured.publicationSnapshotId, first.id);
  assert.deepStrictEqual(captured.lineage, first.artifacts);
  assert.throws(() => analytics.capture(workspace.id, { publicationSnapshotId: publishingProvider.recordPublication(otherWorkspace.id, { url: 'https://youtube.example/other', artifacts: {} }).id, views: 1 }), /no pertenece al Workspace/);
  console.log('historical analytics tests: OK');
} finally {
  try { fs.unlinkSync(file); } catch (_) {}
}
