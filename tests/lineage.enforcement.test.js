'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../src/db');
const music = require('../src/modules/music');
const lyrics = require('../src/modules/lyrics');

const file = path.join(os.tmpdir(), 'alma-y-vinilo-lineage-enforcement-' + Date.now() + '.json');
db.init(file);

try {
  const workspace = db.insert('workspaces', { name: 'Lineage enforcement' });
  const dna = db.insert('content_dna', {
    name: 'workspaceId', value: workspace.id, workspaceId: workspace.id, version: 2,
    moment: 'rest', humanNeed: 'rest', desiredEmotion: 'peace',
    soundSeed: 'SEED_A_JAZZ_VINYL', vocalMode: 'SOFT_FEMALE', visualScenario: {}, packagingFormula: 'MOMENT_FIRST',
  });
  const scripture = db.insert('scriptures', { workspaceId: workspace.id, reference: 'Salmo 23', status: 'APPROVED' });
  db.update('workspaces', workspace.id, { contentDnaVersion: dna.version, scriptureId: scripture.id });
  const track = db.insert('tracks', {
    workspaceId: workspace.id, trackPlanVersion: 4, contentDnaVersion: dna.version,
    scriptureId: scripture.id, soundSeed: dna.soundSeed, vocalMode: dna.vocalMode, status: 'APPROVED',
  });
  const mixedLyrics = db.insert('lyrics_versions', {
    workspaceId: workspace.id, trackId: track.id, version: 1, status: 'APPROVED', lyrics: 'mixed lineage',
    lineage: { workspaceId: workspace.id, trackId: track.id, trackPlanVersion: 4, contentDnaVersion: 1, scriptureId: 'scripture-old' },
  });

  db.update('lyrics_versions', mixedLyrics.id, { status: 'DRAFT' });
  assert.throws(
    () => lyrics.approve(track.id, mixedLyrics.version),
    /lineage incompatible/
  );
  assert.strictEqual(db.get('lyrics_versions', mixedLyrics.id).status, 'DRAFT');
  db.update('lyrics_versions', mixedLyrics.id, { status: 'APPROVED' });

  assert.throws(
    () => music.generateForTrack(workspace.id, track.id, { offline: true }),
    /requiere Content DNA, Scripture y Lyrics aprobadas y vigentes/
  );
  assert.strictEqual(db.where('music_generations', (row) => row.workspaceId === workspace.id).length, 0);
  console.log('lineage enforcement tests: OK');
} finally {
  try { fs.unlinkSync(file); } catch (_) {}
}
