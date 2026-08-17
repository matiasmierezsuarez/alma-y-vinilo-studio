'use strict';
/* Research Knowledge Base - raw data -> observation -> pattern ->
   hypothesis -> experiment -> result -> learning -> rule. Public data is
   never treated as exact revenue. Research can be updated without
   modifying application code. */

const db = require('../db');

const BUNDLED_CSV = `channel,model,subscribers,videos,public performance snapshot,key lesson,role
Prayer & Jazz,OUTLIER,36.3K subs,7 videos,~808K winner,Moment experience + Scripture + track architecture,Primary benchmark
Manna Jazz,CATALOG,53.1K subs,70 videos,multiple 100K+,Bible books + repeated Work/Study format,Catalog benchmark
Heaven Jazz Café,SCALE,43.6K subs,58 videos,~400K featured,broad use cases + consistent publishing,Scale benchmark
Morning Mercy Jazz,REPETITION,3.5K subs,93 videos,n/a,Morning + coffee + study + prayer,Consistency benchmark
Prayer Jazz Morning,HUMAN CURATION,410 subs,83 videos,n/a,AI assisted + human Scripture/creative direction,Process benchmark
The Manna Lounge,SOUND EXPANSION,6.4K subs,131 videos,356K channel views,Jazz + Bossa + R&B/Soul,Controlled sound expansion benchmark`;

function parseCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim());
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
    if (cells.length < 2) continue;
    const obj = {};
    headers.forEach((h, j) => { obj[h] = cells[j] || ''; });
    out.push(obj);
  }
  return out;
}

function seedBenchmarks(text) {
  const rows = parseCsv(text || BUNDLED_CSV);
  rows.forEach((r) => {
    if (!r.channel) return;
    const existing = db.where('competitors', (c) => c.channel === r.channel);
    if (!existing.length) {
      db.insert('competitors', {
        channel: r.channel,
        model: r.model || '',
        subscribers: r.subscribers || '',
        videos: r.videos || '',
        role: r.role || '',
        publicSnapshot: r['public performance snapshot'] || '',
        revenueEstimateInformational: null,
        note: 'Estimaciones públicas son informativas; no tratar como revenue exacto.',
      });
    }
    /* benchmarks become observations (raw data), never rules */
    if (r['key lesson']) {
      const exists = db.where('benchmark_videos', (b) => b.channel === r.channel && b.lesson === r['key lesson']);
      if (!exists.length) {
        db.insert('benchmark_videos', {
          channel: r.channel,
          level: 'OBSERVATION',
          lesson: r['key lesson'],
          snapshot: r['public performance snapshot'] || '',
          source: 'research v6 benchmark',
        });
      }
    }
  });
  db.persist();
  return { competitors: listCompetitors(), benchmarks: listBenchmarks() };
}

function listCompetitors() {
  return db.all('competitors');
}

function listBenchmarks() {
  return db.where('benchmark_videos', (b) => b.level === 'OBSERVATION');
}

function addPattern(input) {
  /* Patterns require evidence and stay at PATTERN level until proven. */
  const p = db.insert('research_patterns', {
    pattern: input.pattern || '',
    evidence: input.evidence || '',
    confidence: input.confidence || 'low',
    source: input.source || 'manual',
    level: 'PATTERN',
  });
  db.persist();
  return p;
}

function listPatterns() {
  return db.all('research_patterns');
}

module.exports = { seedBenchmarks, listCompetitors, listBenchmarks, addPattern, listPatterns, BUNDLED_CSV };
