'use strict';
/* PublishingProvider adapter - provider-agnostic. Publishing always
   stores a snapshot of the exact artifact versions used and is blocked
   unless Review status is APPROVED. Real YouTube upload requires the
   provider credentials; until then the app exports a publication
   package with every required input. */

const db = require('../db');

function buildSnapshot(input) {
  /* input: { workspaceId, titleVersion, thumbnailVersion,
       descriptionVersion, script refs, disclosureState } */
  return db.insert('publication_snapshots', {
    workspaceId: input.workspaceId || null,
    youtubeVideoId: input.youtubeVideoId || '',
    url: input.url || '',
    publishDate: input.publishDate || new Date().toISOString(),
    titleVersion: input.titleVersion || null,
    thumbnailVersion: input.thumbnailVersion || null,
    descriptionVersion: input.descriptionVersion || null,
    playlist: input.playlist || '',
    series: input.series || '',
    disclosureState: input.disclosureState || 'not_set',
    artifacts: input.artifacts || {},
    createdAt: new Date().toISOString(),
  });
  db.persist();
  return snapshot;
}

function recordPublication(workspaceId, { youtubeVideoId, url, publishDate, playlist, series, disclosureState, titleVersion, thumbnailVersion, descriptionVersion }) {
  const ws = db.get('workspaces', workspaceId);
  if (!ws) throw new Error('Workspace no encontrado.');
  const snap = db.insert('publication_snapshots', {
    workspaceId,
    youtubeVideoId: youtubeVideoId || '',
    url: url || '',
    publishDate: publishDate || new Date().toISOString(),
    titleVersion: titleVersion || null,
    thumbnailVersion: thumbnailVersion || null,
    descriptionVersion: descriptionVersion || null,
    playlist: playlist || '',
    series: series || '',
    disclosureState: disclosureState || 'not_set',
    artifacts: {
      contentDnaVersion: ws.contentDnaVersion || null,
      scriptureId: ws.scriptureId || null,
      packagingVersion: ws.packagingVersion || null,
    },
    createdAt: new Date().toISOString(),
  });
  db.persist();
  return snap;
}

module.exports = { buildSnapshot, recordPublication };
