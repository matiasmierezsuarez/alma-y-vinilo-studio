'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../src/db');
const invalidation = require('../src/modules/invalidation');

const file = path.join(os.tmpdir(), 'alma-y-vinilo-track-isolation-' + Date.now() + '.json');
db.init(file);

try {
  const workspace = db.insert('workspaces', { name: 'Track isolation' });
  const workspaceId = workspace.id;

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

  invalidation.invalidateWorkspaceArtifacts(workspaceId, {
    type: 'TRACK_CHANGED',
    sourceArtifactId: 'track-a',
  });

  assert.strictEqual(db.get('lyrics_versions', lyricsA.id).status, 'STALE');
  assert.strictEqual(db.get('lyrics_versions', lyricsB.id).status, 'APPROVED');
  console.log('invalidation track isolation tests: OK');
} finally {
  try { fs.unlinkSync(file); } catch (_) {}
}
