/**
 * Dependency invalidation rules for Workspace artifacts.
 *
 * This module is deliberately pure: callers persist the returned invalidations
 * using the repository's existing database/state layer.
 */

const IMPACT = {
  CONTENT_DNA_CHANGED: [
    'scripture',
    'trackPlan',
    'lyrics',
    'music',
    'visual',
    'packaging',
    'review',
  ],
  SCRIPTURE_CHANGED: [
    'trackPlan',
    'lyrics',
    'music',
    'packaging',
    'review',
  ],
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

module.exports = {
  IMPACT,
  getInvalidationImpact,
  buildInvalidations,
};
