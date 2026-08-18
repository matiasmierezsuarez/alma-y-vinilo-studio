'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../src/db');
const invalidation = require('../src/modules/invalidation');

const file = path.join(os.tmpdir(), 'alma-y-vinilo-invalidation-' + Date.now() + '.json');
db.init(file);

const CASES = [
  ['CONTENT_DNA_CHANGED', ['scripture','trackPlan','track','lyrics','music','visual','packaging','review']],
  ['SCRIPTURE_CHANGED', ['trackPlan','track','lyrics','music','packaging','review']],
  ['TRACK_PLAN_CHANGED', ['track','lyrics','music','packaging','review']],
  ['TRACK_CHANGED', ['lyrics','music','packaging','review']],
  ['LYRICS_CHANGED', ['music','review']],
  ['MUSIC_CHANGED', ['review']],
  ['SOUND_SEED_CHANGED', ['music','review']],
  ['VOCAL_MODE_CHANGED', ['music','review']],
  ['VISUAL_MASTER_CHANGED', ['visual','review']],
  ['VISUAL_ASSET_CHANGED', ['review']],
  ['PACKAGING_CHANGED', ['review']],
];

function seedWorkspace() {
  const ws = db.insert('workspaces', { name: 'Invalidation matrix' });
  const id = ws.id;
  db.insert('scriptures', { workspaceId:id, status:'APPROVED' });
  db.insert('tracks', { workspaceId:id, trackPlanVersion:1, status:'APPROVED' });
  db.insert('lyrics_versions', { workspaceId:id, status:'APPROVED' });
  db.insert('music_generations', { workspaceId:id, status:'SUCCEEDED' });
  db.insert('visual_assets', { workspaceId:id, status:'APPROVED' });
  db.insert('packaging_versions', { workspaceId:id, status:'APPROVED' });
  db.insert('review_items', { workspaceId:id, status:'APPROVED' });
  return id;
}

try {
  CASES.forEach(([event, stages]) => {
    const workspaceId = seedWorkspace();
    const result = invalidation.invalidateWorkspaceArtifacts(workspaceId, { type:event });
    assert.deepStrictEqual(result.stages, stages, event + ' impact changed unexpectedly');
    const review = db.where('review_items', r => r.workspaceId === workspaceId)[0];
    if (stages.includes('review')) assert.strictEqual(review.status, 'INVALIDATED', event + ' must invalidate review');
    else assert.strictEqual(review.status, 'APPROVED', event + ' must preserve review');
    if (stages.includes('lyrics')) assert.strictEqual(db.where('lyrics_versions', r => r.workspaceId === workspaceId)[0].status, 'STALE');
    if (stages.includes('music')) assert.strictEqual(db.where('music_generations', r => r.workspaceId === workspaceId)[0].status, 'STALE');
    if (stages.includes('visual')) assert.strictEqual(db.where('visual_assets', r => r.workspaceId === workspaceId)[0].status, 'STALE');
    if (stages.includes('packaging')) assert.strictEqual(db.where('packaging_versions', r => r.workspaceId === workspaceId)[0].status, 'STALE');
  });
  console.log('invalidation matrix tests: OK');
} finally { try { fs.unlinkSync(file); } catch (_) {} }
