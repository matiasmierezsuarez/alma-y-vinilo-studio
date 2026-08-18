'use strict';
/* Learning Engine - observations are anchored to immutable publication
   snapshots, so later Workspace edits never rewrite historical evidence. */

const db = require('../db');
const analyticsModule = require('./analytics');
const experiments = require('./experiments');
const ideas = require('./ideas');
const config = require('../config');

const VARIATION_BOOKS = ['Salmos 27', 'Proverbios 3', 'Isaías 41', 'Filipenses 4', 'Mateo 11', 'Josué 1'];

function contentDnaFromSnapshot(snapshot) {
  const version = snapshot && snapshot.artifacts ? snapshot.artifacts.contentDnaVersion : null;
  if (!version) return null;
  return db.allVersions('content_dna', { name: 'workspaceId', value: snapshot.workspaceId }).find((d) => Number(d.version) === Number(version)) || null;
}
function scriptureFromSnapshot(snapshot) {
  const id = snapshot && snapshot.artifacts ? snapshot.artifacts.scriptureId : null;
  return id ? db.get('scriptures', id) : null;
}
function combinationFromPublication(snapshot) {
  const dna = contentDnaFromSnapshot(snapshot); const sc = scriptureFromSnapshot(snapshot);
  if (!dna) return null;
  return { moment: dna.moment, need: dna.humanNeed, scriptureBook: sc ? sc.book : '', scriptureReference: sc ? sc.reference : '', soundSeed: dna.soundSeed, vocalMode: dna.vocalMode, packagingFormula: dna.packagingFormula };
}
function combinationOf(workspaceId) {
  const pub = db.where('publication_snapshots', (p) => p.workspaceId === workspaceId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  return pub ? combinationFromPublication(pub) : null;
}

function buildObservations() {
  const pubs = db.where('publication_snapshots', (p) => p.url || p.youtubeVideoId);
  pubs.forEach((p) => {
    const snaps = analyticsModule.snapshots(p.workspaceId).filter((s) => !s.publicationSnapshotId || s.publicationSnapshotId === p.id);
    if (!snaps.length) return;
    const combo = combinationFromPublication(p); if (!combo) return;
    const latest = snaps[snaps.length - 1];
    const existing = db.where('learning_observations', (o) => o.publicationSnapshotId === p.id);
    if (existing.length) return;
    db.insert('learning_observations', { workspaceId: p.workspaceId, publicationSnapshotId: p.id, combination: combo, combinationKey: JSON.stringify(combo), views: latest.views, ctr: latest.ctr, avgPercentageViewed: latest.avgPercentageViewed, likes: latest.likes, snapshotId: latest.id });
  });
  db.persist();
}
function aggregate(workspaceId) {
  buildObservations(); const rows = db.where('learning_observations', (o) => !workspaceId || o.workspaceId === workspaceId); const groups = {};
  rows.forEach((o) => { const key = o.combinationKey; if (!groups[key]) groups[key] = { combination: o.combination, observations: [] }; groups[key].observations.push(o); });
  const out = [];
  Object.keys(groups).forEach((key) => {
    const g = groups[key]; const views = g.observations.map((o) => o.views || 0); const count = g.observations.length; const avg = views.length ? views.reduce((a, b) => a + b, 0) / views.length : 0; const baseline = analyticsModule.comparableBaseline(workspaceId || g.observations[0].workspaceId, 'views'); const index = baseline ? avg / baseline : null; const evidence = experiments.evidenceLevel(count);
    let recommendation = 'TEST'; if (count >= 3 && index != null) recommendation = index >= 1.25 ? 'REPEAT' : index >= 0.75 ? 'EXPAND' : 'RETIRE'; else if (count >= 1 && index != null && index >= 1.25) recommendation = 'TEST';
    const pattern = { combination: g.combination, performanceIndex: index, confidence: evidence, evidenceCount: count, recommendation, latestViews: avg }; out.push(pattern);
    if (evidence === 'STRONG_PATTERN' || evidence === 'CANDIDATE_RULE') { const exists = db.where('learning_patterns', (p) => p.combinationKey === key); if (!exists.length) db.insert('learning_patterns', Object.assign({}, pattern, { combinationKey: key })); }
  });
  db.persist(); return out.sort((a, b) => (b.performanceIndex || 0) - (a.performanceIndex || 0));
}
function variationsOf(pattern) {
  const c = pattern.combination; if (!c) return []; const out = [];
  VARIATION_BOOKS.forEach((book) => out.push({ moment: c.moment, need: c.need, suggestedScripture: book, soundSeed: c.soundSeed, packagingFormula: c.packagingFormula, rationale: 'Variación coherente de la combinación ganadora (mismo momento + nuevo libro).' }));
  const otherMoment = c.moment === 'morning' ? 'evening' : 'morning'; out.push({ moment: otherMoment, need: c.need, suggestedScripture: c.scriptureReference, soundSeed: c.soundSeed, packagingFormula: c.packagingFormula, rationale: 'Variación coherente (misma Scripture + momento adyacente).' });
  return out.slice(0, 3);
}
function diversity(workspaceId) {
  const combo = combinationOf(workspaceId); if (!combo) return { flag: null, count: 0 }; const all = db.all('workspaces').map((ws) => combinationOf(ws.id)).filter(Boolean); const similar = all.filter((c) => c.moment === combo.moment && c.need === combo.need && c.scriptureBook === combo.scriptureBook && c.soundSeed === combo.soundSeed); const threshold = config.experimentRules().diversity.flagThreshold; const flag = similar.length >= threshold ? 'HIGH_REPETITION' : null; const adjacent = []; if (flag) { if (combo.scriptureBook === 'Salmos') adjacent.push('Proverbios', 'Isaías', 'Mateo'); else adjacent.push('Salmos'); combo.moment !== 'evening' && adjacent.push('momento: evening'); } return { flag, count: similar.length, threshold, adjacent: [...new Set(adjacent)] };
}
async function recommendNext(workspaceId, opts = {}) {
  const patterns = aggregate(); const winning = patterns.find((p) => p.recommendation === 'REPEAT') || patterns[0]; let learningContext = '';
  if (winning) learningContext = [`Combinación ganadora: ${winning.combination.moment} + ${winning.combination.need} + ${winning.combination.scriptureReference} + ${winning.combination.soundSeed}`, `Recomendación: ${winning.recommendation}`, 'Genera variaciones coherentes, no copies exacto.'].join('\n');
  const variations = winning ? variationsOf(winning) : []; const idea = await ideas.generate({ type: 'learning-recommendation', learningContext, workspaceId, offline: opts.offline }); return { idea, learningContext, variations, winningPattern: winning || null };
}
function patterns() { return db.all('learning_patterns').sort((a, b) => (b.performanceIndex || 0) - (a.performanceIndex || 0)); }
module.exports = { buildObservations, aggregate, variationsOf, diversity, recommendNext, patterns, combinationOf, combinationFromPublication };
