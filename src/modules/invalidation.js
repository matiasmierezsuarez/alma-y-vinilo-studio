'use strict';

const db = require('../db');

const IMPACT = {
  CONTENT_DNA_CHANGED: ['scripture', 'trackPlan', 'track', 'lyrics', 'music', 'visual', 'packaging', 'review'],
  SCRIPTURE_CHANGED: ['trackPlan', 'track', 'lyrics', 'music', 'packaging', 'review'],
  TRACK_PLAN_CHANGED: ['track', 'lyrics', 'music', 'packaging', 'review'],
  TRACK_CHANGED: ['lyrics', 'music', 'packaging', 'review'],
  LYRICS_CHANGED: ['music', 'review'],
  MUSIC_CHANGED: ['review'],
  SOUND_SEED_CHANGED: ['music', 'review'],
  VOCAL_MODE_CHANGED: ['music', 'review'],
  VISUAL_MASTER_CHANGED: ['visual', 'review'],
  VISUAL_ASSET_CHANGED: ['review'],
  PACKAGING_CHANGED: ['review'],
};

const TABLE_BY_STAGE = {
  scripture: 'scriptures',
  trackPlan: 'tracks',
  track: 'tracks',
  lyrics: 'lyrics_versions',
  music: 'music_generations',
  visual: 'visual_assets',
  packaging: 'packaging_versions',
  review: 'review_items',
};

function getInvalidationImpact(changeType) {
  return [...(IMPACT[changeType] || [])];
}

function buildInvalidations(workspaceId, change = {}) {
  return getInvalidationImpact(change.type).map((stage) => ({
    workspaceId,
    stage,
    reason: change.type,
    sourceArtifactId: change.sourceArtifactId || null,
    sourceVersion: change.sourceVersion ?? null,
  }));
}

function markRowsStale(workspaceId, stage, reason) {
  const table = TABLE_BY_STAGE[stage];
  if (!table) return 0;
  const rows = db.where(table, (row) => row.workspaceId === workspaceId);
  let count = 0;
  rows.forEach((row) => {
    if (table === 'review_items') {
      if (['APPROVED', 'READY_FOR_REVIEW'].includes(row.status)) {
        db.update(table, row.id, { status: 'INVALIDATED', invalidatedReason: reason, invalidatedAt: new Date().toISOString() });
        count += 1;
      }
      return;
    }
    if (!['STALE', 'SUPERSEDED'].includes(row.status)) {
      db.update(table, row.id, { status: 'STALE', staleReason: reason, staleAt: new Date().toISOString() });
      count += 1;
    }
  });
  return count;
}

function invalidateWorkspaceArtifacts(workspaceId, change = {}) {
  const stages = getInvalidationImpact(change.type);
  const result = { workspaceId, reason: change.type, stages, counts: {} };
  stages.forEach((stage) => {
    result.counts[stage] = markRowsStale(workspaceId, stage, change.type);
  });
  db.persist();
  return result;
}

module.exports = {
  IMPACT,
  getInvalidationImpact,
  buildInvalidations,
  invalidateWorkspaceArtifacts,
};
