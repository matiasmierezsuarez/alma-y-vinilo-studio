'use strict';

const lineage = require('./lineage');

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

function resolveDependency(artifact, change = {}) {
  const artifactLineage = lineage.getLineage(artifact);
  const sourceArtifactIds = artifactLineage.sourceArtifactIds || [];
  const field = LINEAGE_FIELD_BY_CHANGE[change.type];
  const hasExplicitLineage = !!artifact?.lineage && Object.keys(artifact.lineage).length > 0;

  if (change.sourceArtifactId) {
    if (sourceArtifactIds.includes(change.sourceArtifactId) || artifact.lineage?.trackId === change.sourceArtifactId) {
      return { depends: true, lineageKnown: true, fallback: false };
    }
    if (artifactLineage.trackId === change.sourceArtifactId || artifact.trackId === change.sourceArtifactId) {
      return { depends: true, lineageKnown: hasExplicitLineage, fallback: !hasExplicitLineage };
    }
    if (field === 'trackId') return { depends: false, lineageKnown: sourceArtifactIds.length > 0 || !!artifactLineage.trackId, fallback: false };
    if (field && artifactLineage[field] != null && change.sourceVersion != null) {
      return { depends: String(artifactLineage[field]) !== String(change.sourceVersion), lineageKnown: true, fallback: false };
    }
    return { depends: true, lineageKnown: false, fallback: true };
  }

  if (change.sourceVersion == null) return { depends: true, lineageKnown: false, fallback: true };
  if (!field || artifactLineage[field] == null) return { depends: true, lineageKnown: false, fallback: true };
  return { depends: String(artifactLineage[field]) !== String(change.sourceVersion), lineageKnown: true, fallback: false };
}

function dependsOnChange(artifact, change = {}) {
  return resolveDependency(artifact, change).depends;
}

module.exports = { LINEAGE_FIELD_BY_CHANGE, resolveDependency, dependsOnChange };
