'use strict';
/* Scripture Engine - human need -> candidates -> passage -> theme ->
   emotional arc -> approve. NEVER invents Scripture: if exact text is
   unavailable, only reference + theme are stored. Approved Scripture
   propagates to track plan, lyrics direction, track titles, description,
   metadata and analytics tags (resolved via the workspace's approved
   scripture id). */

const db = require('../db');
const scriptureProvider = require('../providers/scripture');

const ARC = {
  anxiety: ['anxiety', 'trust', 'peace'],
  tiredness: ['tiredness', 'rest', 'peace'],
  uncertainty: ['uncertainty', 'trust', 'hope'],
  loneliness: ['loneliness', 'presence', 'comfort'],
  distraction: ['distraction', 'focus', 'peace'],
  waiting: ['waiting', 'patience', 'hope'],
  gratitude: ['gratitude', 'joy', 'peace'],
  direction: ['direction', 'trust', 'hope'],
  rest: ['rest', 'peace', 'comfort'],
  hope: ['hope', 'trust', 'joy'],
};

function candidates(workspaceId, opts = {}) {
  const dna = db.latestVersion('content_dna', { name: 'workspaceId', value: workspaceId });
  const need = opts.need || (dna && dna.humanNeed) || '';
  const moment = opts.moment || (dna && dna.moment) || '';
  const list = scriptureProvider.candidates({ need, moment });
  /* keep reference-based suggestions that match the DNA's scripture hint */
  if (dna && dna.scriptureReference) {
    const hint = scriptureProvider.fromReference(dna.scriptureReference);
    if (hint && !list.find((s) => s.reference === hint.reference)) list.unshift(hint);
  }
  return list;
}

function emotionalArc(need) {
  return ARC[need] || ['need', 'trust', 'peace'];
}

function select(workspaceId, reference, opts = {}) {
  const ws = db.get('workspaces', workspaceId);
  if (!ws) throw new Error('Workspace no encontrado.');
  const curated = scriptureProvider.fromReference(reference);
  const dna = db.latestVersion('content_dna', { name: 'workspaceId', value: workspaceId });
  const need = (dna && dna.humanNeed) || 'anxiety';
  const base = curated || {
    id: null, translation: '', book: '', chapter: null, verseStart: null, verseEnd: null,
    reference: String(reference || '').trim(), theme: '',
  };
  const arc = emotionalArc(need);
  const row = {
    workspaceId,
    translation: base.translation || 'RVR1960',
    book: base.book || '',
    chapter: base.chapter != null ? base.chapter : null,
    verseStart: base.verseStart != null ? base.verseStart : null,
    verseEnd: base.verseEnd != null ? base.verseEnd : null,
    reference: base.reference,
    passageText: base.passageText || null,
    theme: opts.theme || base.theme || '',
    rationale: opts.rationale || '',
    emotionalArc: arc,
    status: 'APPROVED',
    approvedAt: new Date().toISOString(),
  };
  const stored = db.insert('scriptures', row);
  db.update('workspaces', workspaceId, { scriptureId: stored.id });
  /* propagate to content DNA scripture reference if not set */
  if (dna && !dna.scriptureReference) {
    dna.scriptureReference = base.reference;
    db.insertVersioned('content_dna', { name: 'workspaceId', value: workspaceId }, dna);
  }
  db.persist();
  return stored;
}

function getApproved(workspaceId) {
  return db.where('scriptures', (s) => s.workspaceId === workspaceId && s.status === 'APPROVED').sort((a, b) => new Date(b.approvedAt) - new Date(a.approvedAt))[0] || null;
}

function forWorkspace(workspaceId) {
  return db.where('scriptures', (s) => s.workspaceId === workspaceId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function currentReference(workspaceId) {
  const s = getApproved(workspaceId);
  return s ? s.reference : '';
}

function currentTheme(workspaceId) {
  const s = getApproved(workspaceId);
  return s ? s.theme : '';
}

module.exports = { candidates, select, getApproved, forWorkspace, currentReference, currentTheme, emotionalArc };
