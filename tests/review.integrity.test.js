'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../src/db');
const review = require('../src/modules/review');

const file = path.join(os.tmpdir(), 'alma-y-vinilo-review-integrity-' + Date.now() + '.json');
db.init(file);

try {
  const workspace = db.insert('workspaces', {
    name: 'Review integrity', rightsMetadata: 'owned', aiDisclosure: true,
    contentDnaVersion: 2,
  });
  const dna = db.insert('content_dna', {
    name: 'workspaceId', value: workspace.id, workspaceId: workspace.id, version: 2,
    moment: 'rest', humanNeed: 'rest', desiredEmotion: 'peace', soundSeed: 'SEED_A_JAZZ_VINYL',
    vocalMode: 'SOFT_FEMALE', visualScenario: {}, packagingFormula: 'MOMENT_FIRST',
  });
  const scripture = db.insert('scriptures', { workspaceId: workspace.id, status: 'APPROVED', reference: 'Salmo 23', contentDnaVersion: 2 });
  db.update('workspaces', workspace.id, { scriptureId: scripture.id });
  const track = db.insert('tracks', {
    workspaceId: workspace.id, trackPlanVersion: 2, contentDnaVersion: 2, scriptureId: scripture.id,
    status: 'APPROVED', title: 'Track', number: 1,
  });
  db.insert('lyrics_versions', {
    workspaceId: workspace.id, trackId: track.id, version: 1, status: 'APPROVED', lyrics: 'lyrics',
    lineage: { workspaceId: workspace.id, trackId: track.id, trackPlanVersion: 2, contentDnaVersion: 2, scriptureId: scripture.id },
  });
  db.insert('music_generations', {
    workspaceId: workspace.id, trackId: track.id, lyricsVersion: 1, status: 'SUCCEEDED', assetUrl: 'audio.mp3',
    lineage: { workspaceId: workspace.id, trackId: track.id, trackPlanVersion: 2, contentDnaVersion: 2, scriptureId: scripture.id, lyricsVersion: 1 },
  });
  db.insert('visual_assets', {
    workspaceId: workspace.id, status: 'APPROVED', assetUrl: 'old.jpg', prompt: 'two characters',
    lineage: { workspaceId: workspace.id, contentDnaVersion: 1, scriptureId: scripture.id, visualMasterReferenceId: null },
  });
  db.insert('packaging_versions', {
    workspaceId: workspace.id, version: 1, status: 'DRAFT', title: 'Title', description: 'Description',
    thumbnailPrompt: 'two characters', tags: ['jazz'],
    lineage: { workspaceId: workspace.id, contentDnaVersion: 2, scriptureId: scripture.id, trackPlanVersion: 1, visualMasterReferenceId: null },
  });

  const result = review.evaluate(workspace.id);
  assert.strictEqual(result.status, 'BLOCKED');
  assert.strictEqual(result.items.find((item) => item.id === 'thumbnail_generated').pass, false);
  assert.strictEqual(result.items.find((item) => item.id === 'packaging_current').pass, false);
  console.log('review integrity tests: OK');
} finally {
  try { fs.unlinkSync(file); } catch (_) {}
}
