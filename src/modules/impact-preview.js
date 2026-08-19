/**
 * Impact preview module for Layer 9.2.
 * Computes the impact of a potential change without mutating state.
 */

const db = require('../db');
const { IMPACT, getInvalidationImpact } = require('./invalidation');
const lineage = require('./lineage');

/**
 * Compute the impact preview for a given change in a workspace.
 * @param {string} workspaceId - The workspace ID.
 * @param {Object} change - The change object, containing at least { type } and optionally { sourceArtifactId, sourceVersion }.
 * @returns {Object} Impact preview with directImpact, indirectImpact, affectedArtifacts, affectedStages, impactCount, simulation.
 */
function computeImpactPreview(workspaceId, change) {
  const { type, sourceArtifactId, sourceVersion } = change;
  const impactedStages = getInvalidationImpact(change.type);
  // For simplicity, we consider all impacted stages as direct impact.
  // In a more refined version, we could separate direct and indirect impact.
  const directImpact = [...impactedStages];
  const indirectImpact = [];

  // We'll collect affected artifacts.
  const affectedArtifacts = [];
  const affectedStagesSet = new Set(impactedStages);

  // For each impacted stage, find artifacts that would become stale.
  for (const stage of impactedStages) {
    const TABLE_BY_STAGE = { scripture: 'scriptures', trackPlan: 'tracks', track: 'tracks', lyrics: 'lyrics_versions', music: 'music_generations', visual: 'visual_assets', packaging: 'packaging_versions', review: 'review_items' }; const tableName = TABLE_BY_STAGE[stage];
    if (!tableName) continue;
    const artifacts = db.where(tableName, (artifact) => artifact.workspaceId === workspaceId);
    for (const artifact of artifacts) {
      // Skip the source artifact if we have sourceArtifactId and sourceVersion.
      if (sourceArtifactId && artifact.id === sourceArtifactId) {
        continue;
      }
      // Compute the lineage of the artifact.
      const artifactLineage = lineage.getLineage(artifact);
      // We need to compute what the lineage would be after the change.
      // For simplicity, we assume that the change only affects the lineage field corresponding to the changed stage.
      // We don't have the new lineage value, but we can determine if the artifact would be stale by checking if its lineage
      // matches the current workspace lineage for the changed_stage? Actually, we need to know if the artifact depends on the changed artifact.
      // We can use lineage.compareLineage by creating a current lineage object that includes the change?
      // Since we don't have the new value, we can only determine staleness if we know that the artifact's lineage depends on the changed field.
      // For example, if the change is SCRIPTURE_CHANGED, then any artifact that has a scriptureId in its lineage would be affected if the scriptureId changes.
      // However, we don't know the new scriptureId, but we know that any artifact that has a scriptureId (i.e., depends on scripture) would need to be updated.
      // Thus, we can consider that any artifact that has a non-null value for the field corresponding to the changed stage in its lineage is potentially affected.
      // But we want to know if it would become stale, i.e., if the lineage would change.
      // Since we are changing the scriptureId to a new value, any artifact that has a scriptureId (regardless of its current value) would see its lineage change.
      // Therefore, all artifacts of stages that are impacted would be affected? Not exactly: an artifact that does not depend on scripture (e.g., a track that does not have a scriptureId in its lineage) would not be affected.
      // We need to check if the artifact's lineage includes the changed stage.

      // We can check if the artifact's lineage has a non-null value for the field that corresponds to the changed stage.
      // We need a mapping from stage to lineage field.
      const stageToLineageField = {
        scripture: 'scriptureId',
        trackPlan: 'trackPlanVersion',
        track: 'trackId',
        lyrics: 'lyricsVersion',
        music: 'musicGenerationId',
        visual: 'visualMasterReferenceId',
        packaging: 'packagingVersion',
        review: null, // review lineage is not a simple field
      };
      const field = stageToLineageField[stage];
      if (field && artifactLineage[field] !== null) {
        // This artifact depends on the stage, so changing the stage will affect its lineage.
        affectedArtifacts.push({
          type: stage,
          id: artifact.id,
        });
      }
      // For review, we need to check if the review's lineage includes the changed stage via the lineage object.
      // We'll skip review for simplicity.
    }
  }

  // Remove duplicates in affectedArtifacts (by type and id).
  const seen = new Set();
  const uniqueAffectedArtifacts = [];
  for (const artifact of affectedArtifacts) {
    const key = `${artifact.type}:${artifact.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueAffectedArtifacts.push(artifact);
    }
  }

  // Impact count is the number of affected artifacts.
  const impactCount = uniqueAffectedArtifacts.length;

  // For simplicity, we set projected consequences to empty or we could compute more.
  const projectedConsequences = {};

  return {
    directImpact: directImpact,
    indirectImpact: indirectImpact,
    affectedArtifacts: uniqueAffectedArtifacts,
    affectedStages: Array.from(affectedStagesSet),
    impactCount: impactCount,
    projectedConsequences: projectedConsequences,
    simulation: true,
  };
}

module.exports = {
  computeImpactPreview,
};

