'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../src/db');
const publishing = require('../src/modules/publishing');

const file = path.join(os.tmpdir(), 'alma-y-vinilo-publish-integrity-' + Date.now() + '.json');
db.init(file);

function reviewLineage(workspaceId, dna, scripture, track, packaging, visual, lyric, music) {
  return {
    workspaceId,
    contentDnaVersion: dna.version,
    scriptureId: scripture.id,
    trackPlanVersion: track.trackPlanVersion,
    packagingVersion: packaging.version,
    visualMasterReferenceId: null,
    visualAssetId: visual.id,
    visualAssetVersion: visual.version,
    tracks: [{ trackId: track.id, trackPlanVersion: track.trackPlanVersion, lyricsVersion: lyric.version, musicGenerationId: music.id }],
  };
}

try {
  const workspace = db.insert('workspaces', { name: 'Publish integrity', aiDisclosure: true });
  const dna = db.insert('content_dna', { name: 'workspaceId', value: workspace.id, workspaceId: workspace.id, version: 1 });
  const scripture = db.insert('scriptures', { workspaceId: workspace.id, status: 'APPROVED', reference: 'Salmo 23' });
  const track = db.insert('tracks', { workspaceId: workspace.id, trackPlanVersion: 1, contentDnaVersion: 1, scriptureId: scripture.id, status: 'APPROVED' });
  const lyric = db.insert('lyrics_versions', { workspaceId: workspace.id, trackId: track.id, version: 1, status: 'APPROVED', lineage: { workspaceId: workspace.id, trackId: track.id, contentDnaVersion: 1, scriptureId: scripture.id, trackPlanVersion: 1 } });
  const music = db.insert('music_generations', { workspaceId: workspace.id, trackId: track.id, lyricsVersion: 1, status: 'SUCCEEDED', assetUrl: 'audio.mp3', lineage: { workspaceId: workspace.id, trackId: track.id, contentDnaVersion: 1, scriptureId: scripture.id, trackPlanVersion: 1, lyricsVersion: 1 } });
  const visual = db.insert('visual_assets', { workspaceId: workspace.id, version: 1, status: 'APPROVED', assetUrl: 'thumbnail.jpg', lineage: { workspaceId: workspace.id, contentDnaVersion: 1, scriptureId: scripture.id, visualMasterReferenceId: null, visualAssetVersion: 1 } });
  const packaging = db.insert('packaging_versions', { workspaceId: workspace.id, version: 1, status: 'DRAFT', lineage: { workspaceId: workspace.id, contentDnaVersion: 1, scriptureId: scripture.id, trackPlanVersion: 1, visualMasterReferenceId: null } });
  const lineage = reviewLineage(workspace.id, dna, scripture, track, packaging, visual, lyric, music);

  db.insert('review_items', { workspaceId: workspace.id, status: 'APPROVED', lineage });
  const snapshot = publishing.publish(workspace.id, { youtubeVideoId: 'valid-publication' });
  assert.strictEqual(snapshot.status, 'PUBLISHED');

  db.update('visual_assets', visual.id, { status: 'STALE' });
  db.insert('review_items', { workspaceId: workspace.id, status: 'APPROVED', lineage });
  assert.throws(
    () => publishing.publish(workspace.id, { youtubeVideoId: 'stale-publication' }),
    /conjunto exacto revisado/
  );
  assert.strictEqual(db.get('publication_snapshots', snapshot.id).youtubeVideoId, 'valid-publication');
  console.log('publish integrity tests: OK');
} finally {
  try { fs.unlinkSync(file); } catch (_) {}
}
