'use strict';
/* Track Plan Engine - track plan BEFORE lyrics/music. A video may
   contain multiple tracks and the plan must demonstrate an emotional
   arc. The system should not produce 10 arbitrary songs: 4-6 coherent
   tracks around the approved Scripture. */

const db = require('../db');
const llm = require('../providers/llm');
const dnaModule = require('./content-dna');
const scripture = require('./scripture');

const RECOMMENDED_RANGE = { min: 4, max: 6 };

function buildPrompt(workspaceId) {
  const dna = dnaModule.getLatest(workspaceId);
  const sc = scripture.getApproved(workspaceId);
  return [
    'Crea un TRACK PLAN (no lyrics todavía) para un video largo de música Christian jazz/soul.',
    'El canal es 100% en español. Todos los títulos de tracks y textos deben estar en español, naturales y cálidos.',
    `Moment del proyecto: ${dna.moment}`,
    `Necesidad humana: ${dna.humanNeed}`,
    `Emoción deseada: ${dna.desiredEmotion}`,
    `Scripture aprobada: ${sc.reference} (tema: ${sc.theme})`,
    `Arco emocional: ${(sc.emotionalArc || []).join(' -> ')}`,
    `Semilla de sonido: ${dna.soundSeed}`,
    `Modo vocal: ${dna.vocalMode}`,
    `Elige entre ${RECOMMENDED_RANGE.min} y ${RECOMMENDED_RANGE.max} tracks.`,
    'Para emotionalStart y emotionalEnd usa SOLO estos estados en inglés: anxiety, trust, peace, rest, hope, comfort, patience, presence, joy, gratitude, vulnerability, surrender, relief, renewal, strength.',
    'No inventes etiquetas emocionales nuevas. Si una emoción no encaja exactamente, elige el estado controlado más cercano.',
    'Cada track tiene un título emocional en español y una referencia de Scripture REAL y verificable; NO inventes citas.',
    'El plan debe mostrar un arco emocional de principio a fin (no canciones arbitrarias).',
    'Devuelve SOLO JSON: {"tracks":[{"title":"","purpose":"","scriptureReference":"","scriptureTheme":"","emotionalStart":"","emotionalEnd":"","lyricDirection":""}]}',
  ].join('\n');
}

function fallbackPlan(workspaceId) {
  const dna = dnaModule.getLatest(workspaceId);
  const sc = scripture.getApproved(workspaceId);
  const need = dna.humanNeed || 'rest';
  const theme = sc.theme || 'guía y paz';
  const ref = sc.reference || 'Salmo 23';
  const seeds = ['Constante a través de todo', 'Muéstrame el Camino', 'Aguas Tranquilas', 'Descanso para mi Mente'];
  const titles = {
    anxiety: ['Paz sobre el Ruido', 'La Quietud Me Encuentra', 'Tú Me Sostienes', 'Seguro en la Calma'],
    tiredness: ['Gracia para el Cansado', 'Déjalo Caer', 'Sábado en mi Alma', 'Descanso Bajo las Estrellas'],
    uncertainty: ['Toma mi Mano', 'Confía en el Camino', 'Luz para el Mañana', 'Paso Firme'],
    loneliness: ['Estás Cerca', 'Nunca Solo', 'Compañero de mi Alma', 'La Habitación se Siente Más Cálida'],
    distraction: ['Quédate Quieto', 'Enfoca mi Corazón', 'Una Sola Cosa', 'Calla el Ruido'],
    waiting: ['Espera en Esperanza', 'Mientras Espero', 'Luz Paciente', 'La Promesa Persiste'],
    gratitude: ['Alma Agradecida', 'Cuenta las Bendiciones', 'Gratitud Silenciosa', 'Alabanza Desbordante'],
    direction: ['Muéstrame el Camino', 'Abre la Puerta', 'Sendas de Justicia', 'Guíame con Dulzura'],
    rest: ['Aguas Tranquilas', 'Suavemente Descanso', 'Atardecer de Sábado', 'Hora de Paz'],
    hope: ['Luz de la Mañana', 'La Esperanza se Levanta', 'El Mañana es Tuyo', 'Amanecer Tras la Lluvia'],
  };
  const list = titles[need] || titles.rest;
  const arc = sc.emotionalArc || [dna.currentEmotion || need, 'trust', 'peace'];
  return list.slice(0, RECOMMENDED_RANGE.max).map((title, i) => ({
    title,
    purpose: `Conduce la sesión del momento "${dna.moment}" desde "${arc[0]}" hacia "${arc[arc.length - 1]}".`,
    scriptureReference: ref,
    scriptureTheme: theme,
    emotionalStart: arc[Math.min(i, arc.length - 1)],
    emotionalEnd: arc[Math.min(i + 1, arc.length - 1)],
    lyricDirection: `Refleja el tema "${theme}" con lenguaje natural y cálido, sin frases religiosas forzadas.`,
  }));
}

async function plan(workspaceId, opts = {}) {
  const ws = db.get('workspaces', workspaceId);
  if (!ws) throw new Error('Workspace no encontrado.');
  if (!dnaModule.getLatest(workspaceId)) throw new Error('Primero desarrolla el Content DNA.');
  if (!scripture.getApproved(workspaceId)) throw new Error('Primero aprueba la Scripture.');

  /* Regenerate: keep APPROVED tracks, replace the rest so approved
     tracks survive an edit and the plan does not accumulate versions. */
  const existing = list(workspaceId);
  const approved = existing.filter((t) => t.status === 'APPROVED');
  existing.forEach((t) => { if (t.status !== 'APPROVED') db.remove('tracks', t.id); });

  let tracksData;
  if (!opts.offline) {
    try {
      const data = await llm.json(
        [{ role: 'system', content: buildPrompt(workspaceId) }, { role: 'user', content: 'Genera el track plan.' }],
        { temperature: 0.7, model: opts.model }
      );
      tracksData = Array.isArray(data.tracks) ? data.tracks : [];
    } catch {
      tracksData = [];
    }
  }
  if (!tracksData || !tracksData.length) tracksData = fallbackPlan(workspaceId);
  tracksData = tracksData.slice(0, RECOMMENDED_RANGE.max - approved.length);

  const dna = dnaModule.getLatest(workspaceId);
  const created = tracksData.map((t, i) => {
    return db.insert('tracks', {
      workspaceId,
      number: approved.length + i + 1,
      title: String(t.title || 'Track ' + (i + 1)).trim(),
      purpose: String(t.purpose || '').trim(),
      scriptureReference: String(t.scriptureReference || scripture.currentReference(workspaceId) || '').trim(),
      scriptureTheme: String(t.scriptureTheme || scripture.currentTheme(workspaceId) || '').trim(),
      emotionalStart: String(t.emotionalStart || '').trim(),
      emotionalEnd: String(t.emotionalEnd || '').trim(),
      soundSeed: dna.soundSeed,
      vocalMode: dna.vocalMode,
      lyricDirection: String(t.lyricDirection || '').trim(),
      sunoPrompt: '',
      lyrics: '',
      status: 'PLANNED',
    });
  });
  db.persist();
  return created;
}

function list(workspaceId) {
  return db.where('tracks', (t) => t.workspaceId === workspaceId).sort((a, b) => a.number - b.number);
}

function get(id) { return db.get('tracks', id); }

function approve(workspaceId, ids) {
  const rows = list(workspaceId);
  const target = new Set(ids || rows.map((r) => r.id));
  rows.forEach((t) => {
    if (target.has(t.id)) db.update('tracks', t.id, { status: 'APPROVED' });
  });
  db.persist();
  return list(workspaceId);
}

function update(id, patch) {
  const allowed = ['title', 'purpose', 'scriptureReference', 'scriptureTheme', 'emotionalStart', 'emotionalEnd', 'soundSeed', 'vocalMode', 'lyricDirection'];
  const clean = {};
  allowed.forEach((k) => { if (k in patch) clean[k] = patch[k]; });
  const t = db.update('tracks', id, clean);
  db.persist();
  return t;
}

function allApproved(workspaceId) {
  return db.where('tracks', (t) => t.workspaceId === workspaceId && t.status === 'APPROVED').sort((a, b) => a.number - b.number);
}

module.exports = { plan, list, get, approve, update, allApproved, RECOMMENDED_RANGE };
