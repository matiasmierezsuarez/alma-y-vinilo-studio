'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../src/db');
const impactPreview = require('../src/modules/impact-preview');

const file = path.join(os.tmpdir(), 'alma-y-vinilo-impact-preview-' + Date.now() + '.json');
db.init(file);

try {
  const workspace = db.insert('workspaces', { name: 'Impact preview contract' });
  const workspaceId = workspace.id;

  const trackA = db.insert('tracks', {
    workspaceId,
    status: 'APPROVED',
    lineage: { workspaceId, trackId: 'track-a', sourceArtifactIds: ['track-a'] },
  });
  const trackB = db.insert('tracks', {
    workspaceId,
    status: 'APPROVED',
    lineage: { workspaceId, trackId: 'track-b', sourceArtifactIds: ['track-b'] },
  });

  const lyricsA = db.insert('lyrics_versions', {
    workspaceId,
    trackId: 'track-a',
    status: 'APPROVED',
    lineage: { workspaceId, trackId: 'track-a', sourceArtifactIds: ['track-a'] },
  });
  const lyricsB = db.insert('lyrics_versions', {
    workspaceId,
    trackId: 'track-b',
    status: 'APPROVED',
    lineage: { workspaceId, trackId: 'track-b', sourceArtifactIds: ['track-b'] },
  });

  const before = JSON.stringify({
    trackA: db.get('tracks', trackA.id),
    trackB: db.get('tracks', trackB.id),
    lyricsA: db.get('lyrics_versions', lyricsA.id),
    lyricsB: db.get('lyrics_versions', lyricsB.id),
  });

  const preview = impactPreview.computeImpactPreview(workspaceId, {
    type: 'TRACK_CHANGED',
    sourceArtifactId: 'track-a',
  });

  assert.strictEqual(preview.simulation, true);
  assert.deepStrictEqual(preview.directImpact, ['lyrics']);
  assert.ok(preview.indirectImpact.includes('music'));
  assert.ok(preview.affectedArtifacts.some((artifact) => artifact.id === lyricsA.id));
  assert.ok(!preview.affectedArtifacts.some((artifact) => artifact.id === lyricsB.id));

  const after = JSON.stringify({
    trackA: db.get('tracks', trackA.id),
    trackB: db.get('tracks', trackB.id),
    lyricsA: db.get('lyrics_versions', lyricsA.id),
    lyricsB: db.get('lyrics_versions', lyricsB.id),
  });

  assert.strictEqual(after, before, 'impact preview must not mutate domain state');
  console.log('impact preview contract tests: OK');
} finally {
  try { fs.unlinkSync(file); } catch (_) {}
}
