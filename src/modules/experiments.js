'use strict';
/* Experiment Engine - each experiment stores hypothesis, variable,
   control/variant, primary and secondary metrics. Rules: 1 observation =
   signal, 3 = preliminary pattern, 5+ = strong, 10+ = candidate rule.
   Never converts one viral result into an automatic permanent rule. */

const db = require('../db');

function create(input) {
  const exp = db.insert('experiments', {
    workspaceId: input.workspaceId || null,
    hypothesis: input.hypothesis || '',
    variable: input.variable || '',
    control: input.control || {},
    variant: input.variant || {},
    primaryMetric: input.primaryMetric || 'ctr',
    secondaryMetrics: Array.isArray(input.secondaryMetrics) ? input.secondaryMetrics : [],
    startDate: input.startDate || new Date().toISOString(),
    endDate: null,
    result: null,
    confidence: null,
    decision: null,
    status: 'RUNNING',
  });
  db.persist();
  return exp;
}

function list(workspaceId) {
  let rows = db.all('experiments').slice();
  if (workspaceId) rows = rows.filter((e) => e.workspaceId === workspaceId);
  return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function get(id) { return db.get('experiments', id); }

function complete(id, input) {
  const exp = db.update('experiments', id, {
    endDate: new Date().toISOString(),
    result: input.result || '',
    confidence: input.confidence || '',
    decision: input.decision || null,
    status: 'COMPLETED',
  });
  db.persist();
  return exp;
}

function evidenceLevel(count) {
  if (count >= 10) return 'CANDIDATE_RULE';
  if (count >= 5) return 'STRONG_PATTERN';
  if (count >= 3) return 'PRELIMINARY_PATTERN';
  if (count >= 1) return 'SIGNAL';
  return 'NONE';
}

module.exports = { create, list, get, complete, evidenceLevel };
