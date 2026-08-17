'use strict';
/* MusicProvider adapter - Suno-compatible workflow (provider-agnostic).
   The app composes the final Suno prompt; actual audio is generated in
   Suno by the user. Generations are never overwritten: every generation
   is a new versioned row. */

const db = require('../db');

function generate(input) {
  /* input: { workspaceId, trackId, prompt, seed, vocalMode, version } */
  const gen = db.insert('music_generations', {
    workspaceId: input.workspaceId || null,
    trackId: input.trackId || null,
    prompt: input.prompt || '',
    seed: input.seed || '',
    provider: 'suno-compatible',
    generationId: null,
    assetUrl: input.assetUrl || '',
    duration: input.duration || null,
    status: 'QUEUED',
    version: input.version || 1,
    createdAt: new Date().toISOString(),
  });
  db.persist();
  return gen;
}

function getStatus(jobId) {
  return db.getJob(jobId);
}

function recordAsset(generationId, { assetUrl, duration, providerGenerationId }) {
  const gen = db.get('music_generations', generationId);
  if (!gen) return null;
  return db.update('music_generations', generationId, {
    assetUrl: assetUrl || gen.assetUrl,
    duration: duration != null ? Number(duration) : gen.duration,
    generationId: providerGenerationId || gen.generationId,
    status: 'SUCCEEDED',
  });
}

module.exports = { generate, getStatus, recordAsset };
