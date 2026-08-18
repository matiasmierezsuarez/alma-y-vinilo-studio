'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../src/db');
const analytics = require('../src/modules/analytics');
const publishingProvider = require('../src/providers/publishing');

const file = path.join(os.tmpdir(), 'alma-y-vinilo-publication-history-' + Date.now() + '.json');
db.init(file);

try {
  const ws = db.insert('workspaces', { name:'Historical lineage', seriesId:'series-a' });
  const workspaceId = ws.id;
  const dnaV1 = db.insert('content_dna', { workspaceId, version:1, moment:'night', humanNeed:'rest', desiredEmotion:'peace', soundSeed:'SEED_A_JAZZ_VINYL', vocalMode:'SOFT_FEMALE', packagingFormula:'A', visualScenario:{} });
  const scriptureA = db.insert('scriptures', { workspaceId, reference:'Salmo 23:1', book:'Salmos', theme:'rest', status:'APPROVED' });
  const snapshot = publishingProvider.recordPublication(workspaceId, {
    url:'https://youtube.example/video-a', series:'series-a',
    artifacts:{ contentDnaVersion:dnaV1.version, scriptureId:scriptureA.id, packagingVersion:1, visual:{assetId:'visual-a'}, tracks:[] }
  });

  const dnaV2 = db.insert('content_dna', { workspaceId, version:2, moment:'morning', humanNeed:'hope', desiredEmotion:'joy', soundSeed:'SEED_B_GOSPEL_RNB', vocalMode:'SOFT_MALE', packagingFormula:'B', visualScenario:{} });
  db.update('scriptures', scriptureA.id, { status:'STALE' });
  db.insert('scriptures', { workspaceId, reference:'Isaías 40:31', book:'Isaías', theme:'hope', status:'APPROVED' });

  const linked = analytics.link(workspaceId);
  assert.strictEqual(linked.publicationSnapshotId, snapshot.id);
  assert.strictEqual(linked.contentDna.version, 1, 'analytics must preserve published DNA lineage');
  assert.strictEqual(linked.contentDna.moment, 'night');
  assert.strictEqual(linked.scripture.reference, 'Salmo 23:1', 'analytics must preserve published scripture lineage');
  assert.strictEqual(db.get('publication_snapshots', snapshot.id).artifacts.contentDnaVersion, 1, 'publication snapshot must remain immutable');
  assert.strictEqual(dnaV2.version, 2);
  console.log('publication history tests: OK');
} finally { try { fs.unlinkSync(file); } catch (_) {} }
