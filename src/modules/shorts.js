'use strict';
/* Shorts - optional and purposeful. Only two purposes are allowed:
   DISCOVERY or BRIDGE_TO_LONG_FORM. Never generated merely because the
   long-form exists. */

const db = require('../db');

const PURPOSES = ['DISCOVERY', 'BRIDGE_TO_LONG_FORM'];

function create(input) {
  const purpose = PURPOSES.includes(input.purpose) ? input.purpose : 'DISCOVERY';
  const s = db.insert('shorts', {
    workspaceId: input.workspaceId || null,
    sourceWorkspaceId: input.sourceWorkspaceId || input.workspaceId || null,
    purpose,
    clipRange: input.clipRange || '',
    scriptureReference: input.scriptureReference || '',
    hook: input.hook || '',
    cta: input.cta || '',
    publishedVideoId: input.publishedVideoId || '',
    status: input.status || 'PLANNED',
  });
  db.persist();
  return s;
}

function list(workspaceId) {
  let rows = db.all('shorts').slice();
  if (workspaceId) rows = rows.filter((s) => s.workspaceId === workspaceId);
  return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function update(id, patch) {
  const allowed = ['purpose', 'clipRange', 'scriptureReference', 'hook', 'cta', 'publishedVideoId', 'status'];
  const clean = {};
  allowed.forEach((k) => { if (k in patch) clean[k] = patch[k]; });
  const s = db.update('shorts', id, clean);
  db.persist();
  return s;
}

module.exports = { create, list, update, PURPOSES };
