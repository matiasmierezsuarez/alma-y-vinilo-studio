'use strict';

const db = require('../db');
const lineage = require('./lineage');

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

const LINEAGE_FIELD_BY_CHANGE = {
  CONTENT_DNA_CHANGED: 'contentDnaVersion',
  SCRIPTURE_CHANGED: 'scriptureId',
  TRACK_PLAN_CHANGED: 'trackPlanVersion',
  TRACK_CHANGED: 'trackId',
  LYRICS_CHANGED: 'lyricsVersion',
  MUSIC_CHANGED: 'musicGenerationId',
  VISUAL_MASTER_CHANGED: 'visualMasterReferenceId',
  VISUAL_ASSET_CHANGED: 'visualAssetVersion',
  PACKAGING_CHANGED: 'packagingVersion',
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

function isSourceRow(row, stage, change) {
  if (change.sourceArtifactId && row.id === change.sourceArtifactId) return true;
  if (change.sourceVersion == null) return false;
  if (stage === 'trackPlan' || stage === 'track') return Number(row.trackPlanVersion) === Number(change.sourceVersion);
  return false;
}

function rowDependsOnChange(row, change = {}) {
  // Without a concrete source, retain the legacy workspace-wide behavior.
  if (!change.sourceArtifactId && change.sourceVersion == null) return true;

  const artifactLineage = lineage.getLineage(row);
  const sourceArtifactIds = artifactLineage.sourceArtifactIds || [];

  if (change.sourceArtifactId) {
    if (row.trackId === change.sourceArtifactId) return true;
    if (artifactLineage.trackId === change.sourceArtifactId) return true;
    if (sourceArtifactIds.includes(change.sourceArtifactId)) return true;
  }

  const field = LINEAGE_FIELD_BY_CHANGE[change.type];
  if (!field || artifactLineage[field] == null) return false;
  if (change.sourceVersion == null) return true;
  return String(artifactLineage[field]) === String(change.sourceVersion);
}

function markRowsStale(workspaceId, stage, reason, change = {}) {
  const table = TABLE_BY_STAGE[stage];
  if (!table) return 0;
  const rows = db.where(table, (row) => row.workspaceId === workspaceId);
  let count = 0;

  rows.forEach((row) => {
    if (isSourceRow(row, stage, change)) return;
    if (!rowDependsOnChange(row, change)) return;

    if (table === 'review_items') {
      if (['APPROVED', 'READY_FOR_REVIEW'].includes(row.status)) {
        db.update(table, row.id, {
          status: 'INVALIDATED',
          invalidatedReason: reason,
          invalidatedAt: new Date().toISOString(),
        });
        count += 1;
      }
      return;
    }

    if (!['STALE', 'SUPERSEDED'].includes(row.status)) {
      db.update(table, row.id, {
        status: 'STALE',
        staleReason: reason,
        staleAt: new Date().toISOString(),
      });
      count += 1;
    }
  });

  return count;
}

function invalidateWorkspaceArtifacts(workspaceId, change = {}) {
  const stages = getInvalidationImpact(change.type);
  const result = { workspaceId, reason: change.type, stages, counts: {} };
  stages.forEach((stage) => {
    result.counts[stage] = markRowsStale(workspaceId, stage, change.type, change);
  });
  db.persist();
  return result;
}

module.exports = {
  IMPACT,
  getInvalidationImpact,
  buildInvalidations,
  invalidateWorkspaceArtifacts,
  rowDependsOnChange,
};
