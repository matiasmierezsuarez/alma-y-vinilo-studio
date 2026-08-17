'use strict';
/* ScriptureProvider adapter - returns curated candidates and optional
   LLM-ranked candidates. NEVER invents a verse quotation: if exact text
   is not available, only reference + theme are stored. */

const db = require('../db');

const CURATED = [
  { id: 'PSA23', translation: 'RVR1960', book: 'Salmos', chapter: 23, verseStart: 1, verseEnd: 6, reference: 'Salmo 23', theme: 'guía y presencia de Dios', needs: ['anxiety', 'uncertainty', 'loneliness', 'rest', 'hope'], moments: ['morning', 'evening', 'rest', 'prayer'] },
  { id: 'PSA25', translation: 'RVR1960', book: 'Salmos', chapter: 25, verseStart: 1, verseEnd: 22, reference: 'Salmo 25', theme: 'dirección y confianza', needs: ['direction', 'uncertainty', 'waiting', 'anxiety'], moments: ['morning', 'study', 'prayer'] },
  { id: 'PSA27', translation: 'RVR1960', book: 'Salmos', chapter: 27, verseStart: 1, verseEnd: 14, reference: 'Salmo 27', theme: 'valentía y espera en Dios', needs: ['anxiety', 'uncertainty', 'loneliness', 'hope'], moments: ['morning', 'evening', 'prayer'] },
  { id: 'PSA46', translation: 'RVR1960', book: 'Salmos', chapter: 46, verseStart: 1, verseEnd: 11, reference: 'Salmo 46', theme: 'refugio y paz en Dios', needs: ['anxiety', 'tiredness', 'rest', 'uncertainty'], moments: ['morning', 'evening', 'rest', 'prayer'] },
  { id: 'PRO3', translation: 'RVR1960', book: 'Proverbios', chapter: 3, verseStart: 5, verseEnd: 6, reference: 'Proverbios 3:5-6', theme: 'confiar en Dios y dirección', needs: ['direction', 'uncertainty', 'waiting'], moments: ['morning', 'study', 'prayer'] },
  { id: 'ISA41', translation: 'RVR1960', book: 'Isaías', chapter: 41, verseStart: 10, verseEnd: 10, reference: 'Isaías 41:10', theme: 'no temas, Dios está contigo', needs: ['anxiety', 'loneliness', 'uncertainty', 'hope'], moments: ['morning', 'evening', 'prayer', 'rest'] },
  { id: 'MAT11', translation: 'RVR1960', book: 'Mateo', chapter: 11, verseStart: 28, verseEnd: 30, reference: 'Mateo 11:28-30', theme: 'descanso en Jesús', needs: ['tiredness', 'rest', 'distraction'], moments: ['evening', 'rest', 'prayer'] },
  { id: 'FIL4', translation: 'RVR1960', book: 'Filipenses', chapter: 4, verseStart: 6, verseEnd: 7, reference: 'Filipenses 4:6-7', theme: 'paz que sobrepasa el entendimiento', needs: ['anxiety', 'uncertainty', 'rest', 'hope'], moments: ['morning', 'evening', 'rest', 'prayer'] },
  { id: '1PE5', translation: 'RVR1960', book: '1 Pedro', chapter: 5, verseStart: 7, verseEnd: 7, reference: '1 Pedro 5:7', theme: 'echar toda ansiedad sobre Dios', needs: ['anxiety', 'uncertainty', 'loneliness'], moments: ['evening', 'prayer', 'rest'] },
  { id: 'ROM8', translation: 'RVR1960', book: 'Romanos', chapter: 8, verseStart: 28, verseEnd: 28, reference: 'Romanos 8:28', theme: 'todas las cosas ayudan a bien', needs: ['uncertainty', 'waiting', 'hope', 'direction'], moments: ['morning', 'evening', 'prayer'] },
  { id: 'JOS1', translation: 'RVR1960', book: 'Josué', chapter: 1, verseStart: 9, verseEnd: 9, reference: 'Josué 1:9', theme: 'esfuérzate y sé valiente', needs: ['uncertainty', 'direction', 'anxiety'], moments: ['morning', 'study', 'prayer'] },
  { id: 'ISA43', translation: 'RVR1960', book: 'Isaías', chapter: 43, verseStart: 1, verseEnd: 2, reference: 'Isaías 43:1-2', theme: 'no temas, te he llamado por nombre', needs: ['loneliness', 'anxiety', 'uncertainty'], moments: ['morning', 'evening', 'prayer'] },
];

function candidates({ need, moment }) {
  let list = CURATED.slice();
  if (need) list = list.filter((s) => !s.needs.length || s.needs.includes(need.toLowerCase()));
  if (moment) list = list.filter((s) => !s.moments.length || s.moments.includes(moment.toLowerCase()));
  return list.map((s) => ({ id: s.id, translation: s.translation, book: s.book, chapter: s.chapter, verseStart: s.verseStart, verseEnd: s.verseEnd, reference: s.reference, theme: s.theme }));
}

function fromReference(reference) {
  const norm = String(reference || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return CURATED.find((s) => s.reference.toLowerCase() === norm) || null;
}

function storeSelected(sel, workspaceId) {
  return db.insert('scriptures', {
    workspaceId: workspaceId || null,
    translation: sel.translation || '',
    book: sel.book || '',
    chapter: sel.chapter || null,
    verseStart: sel.verseStart || null,
    verseEnd: sel.verseEnd || null,
    reference: sel.reference || '',
    passageText: sel.passageText || null,
    theme: sel.theme || '',
    rationale: sel.rationale || '',
    status: 'APPROVED',
  });
}

module.exports = { candidates, fromReference, storeSelected, CURATED };
