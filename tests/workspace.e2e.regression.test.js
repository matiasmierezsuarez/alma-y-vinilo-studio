'use strict';

/* Contract test: a complete workspace can publish, an upstream mutation
   invalidates the approved graph, and a rebuilt graph can publish again
   without mutating the first publication snapshot. */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../src/db');
const invalidation = require('../src/modules/invalidation');
const publishing = require('../src/modules/publishing');

const file = path.join(os.tmpdir(), 'alma-y-vinilo-workspace-e2e-' + Date.now() + '.json');
db.init(file);

function seedGraph(workspaceId, version, scriptureId) {
  const track = db.insert('tracks', { workspaceId, number: 1, title: 'Track ' + version, trackPlanVersion: version, contentDnaVersion: version, scriptureId, status: 'APPROVED' });
  const lyric = db.insert('lyrics_versions', { workspaceId, trackId: track.id, version, lyrics: 'test', status: 'APPROVED', lineage: { workspaceId, contentDnaVersion: version, scriptureId, trackPlanVersion: version } });
  const music = db.insert('music_generations', { workspaceId, trackId: track.id, lyricsVersion: lyric.version, assetUrl: 'https://audio.example/' + version, status: 'SUCCEEDED', lineage: { workspaceId, contentDnaVersion: version, scriptureId, trackPlanVersion: version } });
  const visual = db.insert('visual_assets', { workspaceId, version, prompt: 'two characters', assetUrl: 'https://image.example/' + version, status: 'APPROVED' });
  const pkg = db.insert('packaging_versions', { workspaceId, version, title: 'Title ' + version, description: 'Description', tags: ['jazz'], thumbnailPrompt: 'two characters', status: 'APPROVED', lineage: { workspaceId, contentDnaVersion: version, scriptureId } });
  return { track, lyric, music, visual, pkg };
}

function approve(workspaceId, version, scriptureId, graph) {
  return db.insert('review_items', { workspaceId, status: 'APPROVED', lineage: {
    workspaceId,
    contentDnaVersion: version,
    scriptureId,
    trackPlanVersion: version,
    packagingVersion: graph.pkg.version,
    visualMasterReferenceId: null,
    visualAssetId: graph.visual.id,
    visualAssetVersion: graph.visual.version,
    tracks: [{ trackId: graph.track.id, trackPlanVersion: version, lyricsVersion: graph.lyric.version, musicGenerationId: graph.music.id }]
  }});
}

try {
  const ws = db.insert('workspaces', { name: 'E2E lineage contract', rightsMetadata: true, aiDisclosure: true, status: 'READY' });
  const workspaceId = ws.id;
  const dna1 = db.insert('content_dna', { workspaceId, version: 1 });
  db.update('workspaces', workspaceId, { contentDnaVersion: 1 });
  const scriptureA = db.insert('scriptures', { workspaceId, reference: 'Salmo 23:1', status: 'APPROVED', contentDnaVersion: 1 });
  const graph1 = seedGraph(workspaceId, 1, scriptureA.id);
  approve(workspaceId, dna1.version, scriptureA.id, graph1);

  const first = publishing.publish(workspaceId, { youtubeVideoId: 'video-1', url: 'https://youtube.example/video-1' });
  assert.strictEqual(first.artifacts.contentDnaVersion, 1);
  assert.strictEqual(first.artifacts.scriptureId, scriptureA.id);

  db.update('scriptures', scriptureA.id, { status: 'SUPERSEDED' });
  const scriptureB = db.insert('scriptures', { workspaceId, reference: 'Isaías 40:31', status: 'APPROVED', contentDnaVersion: 1, supersedesScriptureId: scriptureA.id });
  invalidation.invalidateWorkspaceArtifacts(workspaceId, { type: 'SCRIPTURE_CHANGED' });

  assert.strictEqual(db.get('tracks', graph1.track.id).status, 'STALE');
  assert.strictEqual(db.get('lyrics_versions', graph1.lyric.id).status, 'STALE');
  assert.strictEqual(db.get('music_generations', graph1.music.id).status, 'STALE');
  assert.strictEqual(db.get('packaging_versions', graph1.pkg.id).status, 'STALE');
  assert.strictEqual(db.where('review_items', r => r.workspaceId === workspaceId && r.status === 'INVALIDATED').length > 0, true);
  assert.throws(() => publishing.publish(workspaceId, { youtubeVideoId: 'blocked' }), /revisión debe estar APPROVED/);

  const graph2 = seedGraph(workspaceId, 2, scriptureB.id);
  // The second graph represents a rebuilt downstream chain. The Content DNA remains v1;
  // trackPlanVersion advances independently after the scripture mutation.
  graph2.track.contentDnaVersion = 1;
  db.update('tracks', graph2.track.id, { contentDnaVersion: 1 });
  db.update('lyrics_versions', graph2.lyric.id, { lineage: { workspaceId, contentDnaVersion: 1, scriptureId: scriptureB.id, trackPlanVersion: 2 } });
  db.update('music_generations', graph2.music.id, { lineage: { workspaceId, contentDnaVersion: 1, scriptureId: scriptureB.id, trackPlanVersion: 2 } });
  db.update('packaging_versions', graph2.pkg.id, { lineage: { workspaceId, contentDnaVersion: 1, scriptureId: scriptureB.id } });
  approve(workspaceId, 1, scriptureB.id, graph2);

  const second = publishing.publish(workspaceId, { youtubeVideoId: 'video-2', url: 'https://youtube.example/video-2' });
  assert.notStrictEqual(first.id, second.id);
  assert.strictEqual(second.artifacts.scriptureId, scriptureB.id);
  assert.strictEqual(db.get('publication_snapshots', first.id).artifacts.scriptureId, scriptureA.id, 'first snapshot must remain historical');
  assert.strictEqual(db.get('publication_snapshots', first.id).artifacts.tracks[0].trackId, graph1.track.id, 'first snapshot must not be rewritten');
  assert.strictEqual(publishing.history(workspaceId).length, 2);
  console.log('workspace e2e regression tests: OK');
} finally { try { fs.unlinkSync(file); } catch (_) {} }
