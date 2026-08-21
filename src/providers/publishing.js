'use strict';
/* PublishingProvider adapter - publication snapshots are immutable historical
   records containing the exact lineage that was reviewed and published. */

const db = require('../db');

function buildSnapshot(input) {
  const snapshot = db.insert('publication_snapshots', {
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
    status: 'PUBLISHED',
    createdAt: new Date().toISOString(),
  });
  db.persist();
  return snapshot;
}

function recordPublication(workspaceId, input = {}) {
  const ws = db.get('workspaces', workspaceId);
  if (!ws) throw new Error('Workspace no encontrado.');
  return buildSnapshot({ ...input, workspaceId });
}

module.exports = { buildSnapshot, recordPublication };
