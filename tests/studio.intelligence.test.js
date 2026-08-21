'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../src/db');
const analytics = require('../src/modules/analytics');
const learning = require('../src/modules/learning');
const publishingProvider = require('../src/providers/publishing');

const file = path.join(os.tmpdir(), 'alma-y-vinilo-studio-intelligence-' + Date.now() + '.json');
db.init(file);

(async () => {
  try {
    const source = db.insert('workspaces', { name: 'Source workspace' });
    const target = db.insert('workspaces', { name: 'Target workspace' });
    const dna = db.insert('content_dna', { name: 'workspaceId', value: source.id, workspaceId: source.id, version: 1, moment: 'night', humanNeed: 'rest', desiredEmotion: 'peace', soundSeed: 'SEED_A_JAZZ_VINYL', vocalMode: 'SOFT_FEMALE', packagingFormula: 'MOMENT_FIRST' });
    const scripture = db.insert('scriptures', { workspaceId: source.id, reference: 'Salmo 23', book: 'Salmos', status: 'APPROVED' });
    const publication = publishingProvider.recordPublication(source.id, { url: 'https://youtube.example/source', artifacts: { contentDnaVersion: dna.version, scriptureId: scripture.id, tracks: [] } });
    analytics.capture(source.id, { publicationSnapshotId: publication.id, views: 100 });
    const publicationBefore = JSON.stringify(db.get('publication_snapshots', publication.id));
    const sourceDnaBefore = JSON.stringify(db.get('content_dna', dna.id));

    const recommendation = await learning.recommendNext(target.id, { offline: true });
    assert.match(recommendation.recommendationId, /^learning-/);
    assert.strictEqual(recommendation.targetWorkspaceId, target.id);
    assert.strictEqual(recommendation.advisory, true);
    assert.ok(recommendation.evidencePublicationSnapshotIds.includes(publication.id));
    assert.strictEqual(recommendation.idea.workspaceId, target.id);
    assert.strictEqual(JSON.stringify(db.get('publication_snapshots', publication.id)), publicationBefore);
    assert.strictEqual(JSON.stringify(db.get('content_dna', dna.id)), sourceDnaBefore);
    await assert.rejects(() => learning.recommendNext('missing-workspace', { offline: true }), /Workspace no encontrado/);
    console.log('studio intelligence tests: OK');
  } finally {
    try { fs.unlinkSync(file); } catch (_) {}
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
