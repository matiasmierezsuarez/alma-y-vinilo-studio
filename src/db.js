'use strict';
/* Studio 2 - lightweight relational JSON store (zero-dependency).
   Tables mirror section 37 of the spec. Generated artifacts are
   versioned; jobs carry QUEUED/RUNNING/SUCCEEDED/FAILED/CANCELLED. */

const fs = require('fs');
const path = require('path');

const TABLES = [
  'workspaces',
  'ideas',
  'content_dna',
  'scriptures',
  'series',
  'volumes',
  'tracks',
  'lyrics_versions',
  'music_generations',
  'visual_references',
  'visual_assets',
  'packaging_versions',
  'review_items',
  'publication_snapshots',
  'analytics_snapshots',
  'experiments',
  'learning_observations',
  'learning_patterns',
  'competitors',
  'benchmark_videos',
  'research_patterns',
  'shorts',
  'jobs',
];

let state = { meta: { version: 1 }, tables: {} };
let FILE = '';

function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function emptyTables() {
  const t = {};
  TABLES.forEach((n) => { t[n] = []; });
  return t;
}

function init(filePath) {
  FILE = filePath;
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    state = raw && raw.tables ? raw : { meta: { version: 1 }, tables: emptyTables() };
  } catch {
    state = { meta: { version: 1 }, tables: emptyTables() };
    persist();
  }
  TABLES.forEach((n) => { if (!Array.isArray(state.tables[n])) state.tables[n] = []; });
  return state;
}

function persist() {
  if (!FILE) return;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, FILE);
}

function table(name) {
  if (!state.tables[name]) state.tables[name] = [];
  return state.tables[name];
}

function all(name) { return table(name); }

function get(name, id) {
  return table(name).find((r) => r.id === id) || null;
}

function insert(name, row) {
  const r = Object.assign({}, row);
  r.id = r.id || uid();
  r.createdAt = r.createdAt || new Date().toISOString();
  table(name).push(r);
  return r;
}

function update(name, id, patch) {
  const rows = table(name);
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return null;
  rows[i] = Object.assign({}, rows[i], patch, { updatedAt: new Date().toISOString() });
  return rows[i];
}

function remove(name, id) {
  const rows = table(name);
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return false;
  rows.splice(i, 1);
  return true;
}

function where(name, fn) {
  return table(name).filter(fn);
}

function latestVersion(name, groupKey) {
  const rows = table(name)
    .filter((r) => r[groupKey.name] === groupKey.value)
    .sort((a, b) => (a.version || 0) - (b.version || 0));
  return rows[rows.length - 1] || null;
}

function allVersions(name, groupKey) {
  return table(name)
    .filter((r) => r[groupKey.name] === groupKey.value)
    .sort((a, b) => (a.version || 0) - (b.version || 0));
}

/* Versioned artifact: never overwrite, always append with bumped version. */
function insertVersioned(name, groupKey, row) {
  const prev = latestVersion(name, groupKey);
  const r = Object.assign({}, row);
  r.id = r.id || uid();
  r.createdAt = r.createdAt || new Date().toISOString();
  r.version = (prev ? prev.version : 0) + 1;
  r.sourceVersion = row.sourceVersion || (prev ? prev.version : 0);
  r.createdBy = r.createdBy || 'studio';
  table(name).push(r);
  return r;
}

/* ---- jobs ---- */
function createJob(kind, payload) {
  const job = insert('jobs', {
    kind,
    status: 'QUEUED',
    payload: payload || {},
    error: null,
    result: null,
    startedAt: null,
    finishedAt: null,
  });
  persist();
  return job;
}

function updateJob(id, patch) {
  const job = update('jobs', id, patch);
  persist();
  return job;
}

function getJob(id) { return get('jobs', id); }

function succeedJob(id, result) {
  return updateJob(id, { status: 'SUCCEEDED', result, error: null, finishedAt: new Date().toISOString() });
}

function failJob(id, error) {
  return updateJob(id, { status: 'FAILED', error: String(error), finishedAt: new Date().toISOString() });
}

function runJob(kind, payload, fn) {
  const job = createJob(kind, payload);
  updateJob(job.id, { status: 'RUNNING', startedAt: new Date().toISOString() });
  try {
    const result = fn(job);
    if (result && typeof result.then === 'function') {
      return result.then((r) => { succeedJob(job.id, r); return getJob(job.id); })
        .catch((e) => { failJob(job.id, e); return getJob(job.id); });
    }
    succeedJob(job.id, result);
    return Promise.resolve(getJob(job.id));
  } catch (e) {
    failJob(job.id, e);
    return Promise.resolve(getJob(job.id));
  }
}

function snapshot() { return state; }
function meta() { return state.meta; }

module.exports = {
  TABLES,
  init,
  persist,
  all,
  get,
  insert,
  update,
  remove,
  where,
  latestVersion,
  allVersions,
  insertVersioned,
  createJob,
  updateJob,
  getJob,
  succeedJob,
  failJob,
  runJob,
  snapshot,
  meta,
};
