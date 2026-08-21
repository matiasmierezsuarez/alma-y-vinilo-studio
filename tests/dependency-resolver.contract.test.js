'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../src/db');
const resolver = require('../src/modules/dependency-resolver');
const preview = require('../src/modules/impact-preview');
const invalidation = require('../src/modules/invalidation');

const file = path.join(os.tmpdir(), 'alma-y-vinilo-dependency-resolver-' + Date.now() + '.json');
db.init(file);

try {
  const workspace = db.insert('workspaces', { name: 'Dependency resolver contract' });
  const explicitA = db.insert('lyrics_versions', { workspaceId: workspace.id, trackId: 'track-a', status: 'APPROVED', lineage: { workspaceId: workspace.id, trackId: 'track-a', sourceArtifactIds: ['track-a'] } });
  const explicitB = db.insert('lyrics_versions', { workspaceId: workspace.id, trackId: 'track-b', status: 'APPROVED', lineage: { workspaceId: workspace.id, trackId: 'track-b', sourceArtifactIds: ['track-b'] } });
  const legacy = db.insert('lyrics_versions', { workspaceId: workspace.id, trackId: 'track-a', status: 'APPROVED' });
  const change = { type: 'TRACK_CHANGED', sourceArtifactId: 'track-a' };

  assert.deepStrictEqual(resolver.resolveDependency(explicitA, change), { depends: true, lineageKnown: true, fallback: false });
  assert.strictEqual(resolver.dependsOnChange(explicitB, change), false);
  assert.deepStrictEqual(resolver.resolveDependency(legacy, change), { depends: true, lineageKnown: false, fallback: true });

  const impact = preview.computeImpactPreview(workspace.id, change);
  const previewIds = new Set(impact.affectedArtifacts.filter((artifact) => artifact.type === 'lyrics').map((artifact) => artifact.id));
  assert.deepStrictEqual([...previewIds].sort(), [explicitA.id, legacy.id].sort());

  invalidation.invalidateWorkspaceArtifacts(workspace.id, change);
  assert.strictEqual(db.get('lyrics_versions', explicitA.id).status, 'STALE');
  assert.strictEqual(db.get('lyrics_versions', legacy.id).status, 'STALE');
  assert.strictEqual(db.get('lyrics_versions', explicitB.id).status, 'APPROVED');
  console.log('dependency resolver contract tests: OK');
} finally {
  try { fs.unlinkSync(file); } catch (_) {}
}
