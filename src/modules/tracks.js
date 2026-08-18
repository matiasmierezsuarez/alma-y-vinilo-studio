'use strict';
/* Track Plan Engine - the plan is an explicit versioned artifact. Tracks
   carry the exact Content DNA and Scripture versions used to generate them. */

const db = require('../db');
const llm = require('../providers/llm');
const dnaModule = require('./content-dna');
const scripture = require('./scripture');
const invalidation = require('./invalidation');

const RECOMMENDED_RANGE = { min: 4, max: 6 };

function currentPlanVersion(workspaceId) {
  const rows = list(workspaceId);
  return rows.reduce((max, t) => Math.max(max, Number(t.trackPlanVersion) || 0), 0);
}

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

  const previousPlanVersion = currentPlanVersion(workspaceId);
  const trackPlanVersion = previousPlanVersion + 1;
  const existing = list(workspaceId);
  existing.forEach((t) => {
    if (t.status !== 'SUPERSEDED') db.update('tracks', t.id, { status: 'SUPERSEDED', supersededAt: new Date().toISOString() });
  });

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
  tracksData = tracksData.slice(0, RECOMMENDED_RANGE.max);

  const dna = dnaModule.getLatest(workspaceId);
  const sc = scripture.getApproved(workspaceId);
  const created = tracksData.map((t, i) => db.insert('tracks', {
    workspaceId,
    trackPlanVersion,
    contentDnaVersion: dna.version,
    scriptureId: sc.id,
    number: i + 1,
    title: String(t.title || 'Track ' + (i + 1)).trim(),
    purpose: String(t.purpose || '').trim(),
    scriptureReference: String(t.scriptureReference || sc.reference || '').trim(),
    scriptureTheme: String(t.scriptureTheme || sc.theme || '').trim(),
    emotionalStart: String(t.emotionalStart || '').trim(),
    emotionalEnd: String(t.emotionalEnd || '').trim(),
    soundSeed: dna.soundSeed,
    vocalMode: dna.vocalMode,
    lyricDirection: String(t.lyricDirection || '').trim(),
    sunoPrompt: '',
    lyrics: '',
    status: 'PLANNED',
    lineage: {
      workspaceId,
      contentDnaVersion: dna.version,
      scriptureId: sc.id,
      trackPlanVersion,
    },
  }));
  db.persist();
  invalidation.invalidateWorkspaceArtifacts(workspaceId, {
    type: 'TRACK_PLAN_CHANGED',
    sourceVersion: trackPlanVersion,
  });
  return created;
}

function list(workspaceId) {
  return db.where('tracks', (t) => t.workspaceId === workspaceId).sort((a, b) => (a.trackPlanVersion || 0) - (b.trackPlanVersion || 0) || a.number - b.number);
}

function get(id) { return db.get('tracks', id); }

function approve(workspaceId, ids) {
  const rows = list(workspaceId);
  const target = new Set(ids || rows.filter((r) => r.status === 'PLANNED').map((r) => r.id));
  rows.forEach((t) => {
    if (target.has(t.id) && t.status !== 'STALE' && t.status !== 'SUPERSEDED') db.update('tracks', t.id, { status: 'APPROVED' });
  });
  db.persist();
  return list(workspaceId).filter((t) => t.status === 'APPROVED');
}

function update(id, patch) {
  const allowed = ['title', 'purpose', 'scriptureReference', 'scriptureTheme', 'emotionalStart', 'emotionalEnd', 'soundSeed', 'vocalMode', 'lyricDirection'];
  const clean = {};
  allowed.forEach((k) => { if (k in patch) clean[k] = patch[k]; });
  const t = db.update('tracks', id, clean);
  if (t && Object.keys(clean).length) {
    invalidation.invalidateWorkspaceArtifacts(t.workspaceId, {
      type: ['soundSeed', 'vocalMode'].some((k) => k in clean) ? 'SOUND_SEED_CHANGED' : 'TRACK_CHANGED',
      sourceArtifactId: t.id,
      sourceVersion: t.trackPlanVersion,
    });
  }
  db.persist();
  return t;
}

function allApproved(workspaceId) {
  return db.where('tracks', (t) => t.workspaceId === workspaceId && t.status === 'APPROVED').sort((a, b) => (a.trackPlanVersion || 0) - (b.trackPlanVersion || 0) || a.number - b.number);
}

module.exports = { plan, list, get, approve, update, allApproved, RECOMMENDED_RANGE, currentPlanVersion };
