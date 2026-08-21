/**
 * Artifact lineage primitives for Workspace production artifacts.
 *
 * This module is intentionally framework-agnostic. It provides the canonical
 * dependency shape and comparison helpers used by invalidation/review layers.
 */

const LINEAGE_FIELDS = [
  'workspaceId',
  'contentDnaVersion',
  'scriptureId',
  'trackPlanVersion',
  'trackId',
  'lyricsVersion',
  'musicGenerationId',
  'visualMasterReferenceId',
  'visualAssetVersion',
  'packagingVersion',
];

function createLineage(input = {}) {
  const lineage = {};
  for (const field of LINEAGE_FIELDS) {
    if (input[field] !== undefined && input[field] !== null) {
      lineage[field] = input[field];
    }
  }
  if (Array.isArray(input.sourceArtifactIds)) {
    lineage.sourceArtifactIds = [...new Set(input.sourceArtifactIds)];
  }
  return lineage;
}

function getLineage(artifact) {
  const stored = artifact?.lineage || {};
  const legacy = {};
  for (const field of LINEAGE_FIELDS) {
    if (stored[field] === undefined && artifact?.[field] !== undefined) legacy[field] = artifact[field];
  }
  if (stored.sourceArtifactIds === undefined && Array.isArray(artifact?.sourceArtifactIds)) {
    legacy.sourceArtifactIds = artifact.sourceArtifactIds;
  }
  return createLineage(Object.assign({}, legacy, stored));
}

function compareLineage(artifact, current = {}) {
  const actual = getLineage(artifact);
  const expected = createLineage(current);
  const reasons = [];

  for (const field of LINEAGE_FIELDS) {
    if (expected[field] === undefined) continue;
    if (actual[field] !== expected[field]) {
      reasons.push(`${field.toUpperCase()}_CHANGED`);
    }
  }

  return {
    current: reasons.length === 0,
    stale: reasons.length > 0,
    reasons,
  };
}

function isCurrent(artifact, current) {
  return compareLineage(artifact, current).current;
}

function getStaleReason(artifact, current) {
  return compareLineage(artifact, current).reasons;
}

module.exports = {
  LINEAGE_FIELDS,
  createLineage,
  getLineage,
  compareLineage,
  isCurrent,
  getStaleReason,
};
