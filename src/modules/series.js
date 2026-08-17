'use strict';
/* Series and Catalog - Series -> Volume -> Workspace/Video -> Tracks.
   Combines experience-based video design with catalog thinking. */

const db = require('../db');

function createSeries(input) {
  const s = db.insert('series', {
    name: String(input.name || '').trim(),
    description: String(input.description || '').trim(),
    scriptureFocus: String(input.scriptureFocus || '').trim(),
    createdAt: new Date().toISOString(),
  });
  db.persist();
  return s;
}

function listSeries() {
  const series = db.all('series').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return series.map((s) => Object.assign({}, s, { volumes: db.where('volumes', (v) => v.seriesId === s.id).sort((a, b) => (a.order || 0) - (b.order || 0)) }));
}

function getSeries(id) {
  return listSeries().find((s) => s.id === id) || null;
}

function createVolume(input) {
  const order = db.where('volumes', (v) => v.seriesId === input.seriesId).length + 1;
  const v = db.insert('volumes', {
    seriesId: input.seriesId,
    name: String(input.name || '').trim(),
    scriptureFocus: String(input.scriptureFocus || '').trim(),
    order: input.order != null ? Number(input.order) : order,
  });
  db.persist();
  return v;
}

function assignWorkspace(workspaceId, { seriesId, volumeId }) {
  const ws = db.update('workspaces', workspaceId, {
    seriesId: seriesId || null,
    volumeId: volumeId || null,
  });
  db.persist();
  return ws;
}

module.exports = { createSeries, listSeries, getSeries, createVolume, assignWorkspace };
