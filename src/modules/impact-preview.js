/**
 * Impact preview module for Layer 9.2.
 *
 * The preview is intentionally read-only. It projects the artifacts that are
 * connected to a pending domain change without changing versions, statuses or
 * publication history.
 */

'use strict';

const db = require('../db');
const { getInvalidationImpact } = require('./invalidation');
const lineage = require('./lineage');

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

function artifactDependsOnChange(artifact, change = {}) {
  const artifactLineage = lineage.getLineage(artifact);
  const sourceArtifactIds = artifactLineage.sourceArtifactIds || [];

  if (change.sourceArtifactId) {
    if (sourceArtifactIds.includes(change.sourceArtifactId)) return true;
    if (artifactLineage.trackId === change.sourceArtifactId) return true;
  }

  const field = LINEAGE_FIELD_BY_CHANGE[change.type];
  if (!field || artifactLineage[field] == null) return false;

  if (change.sourceVersion == null) return true;
  return String(artifactLineage[field]) === String(change.sourceVersion);
}

function collectStageArtifacts(workspaceId, stage) {
  const table = TABLE_BY_STAGE[stage];
  if (!table) return [];
  return db.where(table, (artifact) => artifact.workspaceId === workspaceId);
}

function isSourceArtifact(artifact, change = {}) {
  return !!change.sourceArtifactId && artifact.id === change.sourceArtifactId;
}

/**
 * Compute the impact of a pending change without mutating state.
 *
 * The first affected dependency stage is reported as direct impact. Later
 * stages are indirect impact. Artifact membership is additionally filtered by
 * lineage/source identity so a Track-scoped change does not automatically pull
 * unrelated sibling tracks into the preview.
 */
function computeImpactPreview(workspaceId, change = {}) {
  const impactedStages = getInvalidationImpact(change.type);
  const directStage = impactedStages[0] || null;
  const directImpact = directStage ? [directStage] : [];
  const indirectImpact = directStage ? impactedStages.slice(1) : [];
  const affectedArtifacts = [];
  const seen = new Set();

  for (const stage of impactedStages) {
    const artifacts = collectStageArtifacts(workspaceId, stage);
    for (const artifact of artifacts) {
      if (isSourceArtifact(artifact, change)) continue;
      if (!artifactDependsOnChange(artifact, change)) continue;

      const key = `${stage}:${artifact.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      affectedArtifacts.push({
        type: stage,
        id: artifact.id,
        version: artifact.version ?? null,
        trackId: artifact.trackId || lineage.getLineage(artifact).trackId || null,
        impact: stage === directStage ? 'direct' : 'indirect',
      });
    }
  }

  const affectedStages = [...new Set(affectedArtifacts.map((artifact) => artifact.type))];

  return {
    artifact: {
      id: change.sourceArtifactId || null,
      type: change.type || null,
      version: change.sourceVersion ?? null,
    },
    directImpact,
    indirectImpact,
    affectedArtifacts,
    affectedStages,
    impactCount: affectedArtifacts.length,
    projectedConsequences: {
      directCount: affectedArtifacts.filter((artifact) => artifact.impact === 'direct').length,
      indirectCount: affectedArtifacts.filter((artifact) => artifact.impact === 'indirect').length,
    },
    simulation: true,
  };
}

module.exports = {
  computeImpactPreview,
  artifactDependsOnChange,
};
