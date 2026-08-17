'use strict';
/* ImageProvider adapter - produces thumbnail/full-video visual direction.
   Image generation happens in an external tool (Bing Image Creator /
   Canva) using the produced prompt. The locked THUMBNAIL_MASTER
   reference is always preserved. */

const db = require('../db');

function generate(input) {
  /* input: { workspaceId, kind: 'thumbnail'|'video', prompt, version } */
  const asset = db.insert('visual_assets', {
    workspaceId: input.workspaceId || null,
    type: input.kind || 'thumbnail',
    prompt: input.prompt || '',
    assetUrl: input.assetUrl || '',
    version: input.version || 1,
    createdAt: new Date().toISOString(),
  });
  db.persist();
  return asset;
}

function recordAsset(assetId, { assetUrl }) {
  const asset = db.get('visual_assets', assetId);
  if (!asset) return null;
  return db.update('visual_assets', assetId, { assetUrl });
}

module.exports = { generate, recordAsset };
