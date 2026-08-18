'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const db = require('../src/db');
const lineage = require('../src/modules/lineage');
const invalidation = require('../src/modules/invalidation');

const file = path.join(os.tmpdir(), 'alma-y-vinilo-lineage-test-' + Date.now() + '.json');
db.init(file);

try {
  const workspace = db.insert('workspaces', { name: 'Lineage test' });
  const workspaceId = workspace.id;

  const current = lineage.createLineage({ workspaceId, contentDnaVersion: 2, scriptureId: 'scripture-b', trackPlanVersion: 3 });
  assert.deepStrictEqual(lineage.compareLineage({ lineage: current }, current), { current: true, stale: false, reasons: [] });

  const stale = lineage.compareLineage({ lineage: { workspaceId, contentDnaVersion: 1, scriptureId: 'scripture-a', trackPlanVersion: 2 } }, current);
  assert.strictEqual(stale.current, false);
  assert.strictEqual(stale.stale, true);
  assert.ok(stale.reasons.includes('CONTENTDNAVERSION_CHANGED'));
  assert.ok(stale.reasons.includes('SCRIPTUREID_CHANGED'));
  assert.ok(stale.reasons.includes('TRACKPLANVERSION_CHANGED'));

  db.insert('tracks', { workspaceId, trackPlanVersion: 2, status: 'APPROVED' });
  db.insert('tracks', { workspaceId, trackPlanVersion: 3, status: 'PLANNED' });
  db.insert('review_items', { workspaceId, status: 'APPROVED' });

  const impact = invalidation.invalidateWorkspaceArtifacts(workspaceId, {
    type: 'TRACK_PLAN_CHANGED',
    sourceVersion: 3,
  });

  assert.strictEqual(impact.reason, 'TRACK_PLAN_CHANGED');
  assert.strictEqual(db.where('tracks', (t) => t.workspaceId === workspaceId && t.trackPlanVersion === 2)[0].status, 'STALE');
  assert.strictEqual(db.where('tracks', (t) => t.workspaceId === workspaceId && t.trackPlanVersion === 3)[0].status, 'PLANNED');
  assert.strictEqual(db.where('review_items', (r) => r.workspaceId === workspaceId)[0].status, 'INVALIDATED');

  console.log('lineage tests: OK');
} finally {
  try { fs.unlinkSync(file); } catch (_) {}
}
