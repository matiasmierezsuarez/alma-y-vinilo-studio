'use strict';
/* Idea Engine - generates/accepts ideas within controlled constraints.
   Never jumps directly from idea to lyrics: DEVELOP IDEA creates the
   Content DNA. */

const db = require('../db');
const llm = require('../providers/llm');
const config = require('../config');

const MOMENTS = ['morning', 'work', 'study', 'prayer', 'reading', 'journaling', 'evening', 'reflection', 'rest'];
const NEEDS = ['anxiety', 'tiredness', 'uncertainty', 'loneliness', 'distraction', 'waiting', 'gratitude', 'direction', 'rest', 'hope'];
const EMOTIONS = ['peace', 'trust', 'hope', 'comfort', 'gratitude', 'focus'];
const SEEDS = Object.keys(config.soundSeeds().seeds || {});
const VOCAL_MODES = ['INSTRUMENTAL', 'SOFT_MALE', 'SOFT_FEMALE', 'SOFT_DUET', 'VOCAL_TEXTURE'];
const PACKAGING_FORMULAS = ['MOMENT_FIRST', 'EMOTION_FIRST', 'MUSIC_FIRST'];

const CANONICAL = { MOMENTS, NEEDS, EMOTIONS, SEEDS, VOCAL_MODES, PACKAGING_FORMULAS };

const SCRIPTURES = [
  'Salmo 23',
  'Salmo 46:10',
  'Salmo 91:1-2',
  'Salmo 121:1-2',
  'Isaías 41:10',
  'Isaías 43:1-2',
  'Filipenses 4:6-7',
  'Filipenses 4:13',
  'Mateo 11:28',
  'Juan 14:27',
  'Romanos 8:28',
  'Romanos 15:13',
  '1 Pedro 5:7',
  'Proverbios 3:5-6',
  'Lamentaciones 3:22-23',
  'Sofonías 3:17',
];

function pick(list, prefer) {
  if (prefer && list.includes(prefer)) return prefer;
  return list[Math.floor(Math.random() * list.length)];
}

function defaultIdeaShape() {
  return {
    type: 'generated',
    title: '',
    moment: '',
    humanNeed: '',
    desiredEmotion: '',
    suggestedScripture: '',
    suggestedSoundSeed: '',
    vocalMode: 'SOFT_FEMALE',
    visualScenario: { location: '', time: '', weather: '', activity: '', props: [], lighting: '' },
    packagingFormula: '',
    rationale: '',
    workspaceId: null,
    source: 'generated',
  };
}

function buildIdeaPrompt(idea) {
  const seedsText = SEEDS.map((s) => {
    const seed = config.seedById(s);
    return `${s}: ${seed ? seed.name : ''} (${seed ? seed.basePrompt : ''})`;
  }).join('\n');
  return [
    'Eres el director creativo de "Alma y Vinilo", un canal de Christian jazz/soul cálido.',
    'El canal es 100% en español latinoamericano. TODO el texto que generes (title, rationale, visualScenario, etc.) debe estar en español.',
    'El título debe ser natural y cálido, en español, y vender la experiencia del momento.',
    'Genera UNA idea de contenido completa, no una lista.',
    'Debes elegir SOLO de estos valores controlados:',
    `Momentos: ${MOMENTS.join(', ')}`,
    `Necesidades humanas: ${NEEDS.join(', ')}`,
    `Emociones deseadas: ${EMOTIONS.join(', ')}`,
    `Semillas de sonido disponibles:\n${seedsText}`,
    `Fórmulas de packaging: ${PACKAGING_FORMULAS.join(', ')}`,
    'La idea debe venderse como una experiencia para un momento real, no como una colección de canciones.',
    'Sugiere una Scripture real y conocida (libro y referencia exacta); NO inventes versículos.',
    'Devuelve SOLO JSON válido con esta forma exacta:',
    '{"idea":{"title":"","moment":"","humanNeed":"","desiredEmotion":"","suggestedScripture":"","suggestedSoundSeed":"","vocalMode":"","visualScenario":{"location":"","time":"","weather":"","activity":"","props":[""],"lighting":""},"packagingFormula":"","rationale":""}}',
  ].join('\n');
}

async function generate(opts = {}) {
  const idea = defaultIdeaShape();
  idea.type = opts.type || 'generated';
  idea.workspaceId = opts.workspaceId || null;
  idea.source = opts.source || 'generated';

  const messages = [{ role: 'system', content: buildIdeaPrompt(idea) }];
  let userParts = ['Crea una nueva idea de contenido para el canal.'];
  if (opts.seriesContext) userParts.push(`Continúa esta serie:\n${opts.seriesContext}`);
  if (opts.learningContext) userParts.push(`Aprendizaje del canal a considerar (no copies exacto, crea variación):\n${opts.learningContext}`);
  if (opts.manual) userParts.push(`Idea manual del usuario: ${opts.manual}`);
  messages.push({ role: 'user', content: userParts.join('\n\n') });

  let raw = null;
  let generation = 'offline';
  if (!opts.offline) {
    try {
      const data = await llm.json(messages, { temperature: 0.8, model: opts.model });
      raw = data.idea || data;
      generation = 'online';
    } catch {
      raw = null;
    }
  }
  if (!raw) raw = offlineIdea(opts);
  const merged = Object.assign(idea, {
    title: raw.title || '',
    moment: pick(MOMENTS, raw.moment),
    humanNeed: pick(NEEDS, raw.humanNeed),
    desiredEmotion: pick(EMOTIONS, raw.desiredEmotion),
    suggestedScripture: raw.suggestedScripture || '',
    suggestedSoundSeed: SEEDS.includes(raw.suggestedSoundSeed) ? raw.suggestedSoundSeed : pick(SEEDS),
    vocalMode: VOCAL_MODES.includes(raw.vocalMode) ? raw.vocalMode : 'SOFT_FEMALE',
    packagingFormula: PACKAGING_FORMULAS.includes(raw.packagingFormula) ? raw.packagingFormula : 'MOMENT_FIRST',
    visualScenario: Object.assign({ location: '', time: '', weather: '', activity: '', props: [], lighting: '' }, raw.visualScenario || {}),
    rationale: raw.rationale || '',
    generationSource: generation,
  });
  if (opts.offline || !merged.suggestedScripture) {
    merged.title = merged.title || 'Momento con Dios';
    if (!merged.suggestedScripture) merged.suggestedScripture = pick(SCRIPTURES);
    if (!merged.rationale) merged.rationale = 'Combinación coherente de momento, necesidad y emoción del catálogo.';
  }
  const row = db.insert('ideas', merged);
  db.persist();
  return row;
}

function offlineIdea(opts) {
  const need = pick(NEEDS);
  const moment = pick(MOMENTS);
  const titles = {
    anxiety: ['Paz sobre el Ruido', 'La Quietud Me Encuentra', 'Confianza Serena'],
    tiredness: ['Gracia para el Cansado', 'Sábado en mi Alma', 'Descanso Suave'],
    uncertainty: ['Confía en el Camino', 'Paso Firme', 'Luz para el Mañana'],
    loneliness: ['Estás Cerca', 'Nunca Solo', 'La Habitación se Siente Más Cálida'],
    distraction: ['Quédate Quieto', 'Enfoca mi Corazón', 'Calla el Ruido'],
    waiting: ['Espera en Esperanza', 'Luz Paciente', 'La Promesa Persiste'],
    gratitude: ['Alma Agradecida', 'Cuenta las Bendiciones', 'Alabanza Desbordante'],
    direction: ['Muéstrame el Camino', 'Guíame con Dulzura', 'Abre la Puerta'],
    rest: ['Aguas Tranquilas', 'Suavemente Descanso', 'Hora de Paz'],
    hope: ['Luz de la Mañana', 'La Esperanza se Levanta', 'Amanecer Tras la Lluvia'],
  };
  const list = titles[need] || titles.rest;
  return {
    title: list[Math.floor(Math.random() * list.length)],
    moment,
    humanNeed: need,
    desiredEmotion: pick(EMOTIONS),
    suggestedScripture: pick(SCRIPTURES),
    suggestedSoundSeed: pick(SEEDS),
    vocalMode: 'SOFT_FEMALE',
    packagingFormula: 'MOMENT_FIRST',
    visualScenario: { location: '', time: '', weather: '', activity: '', props: [], lighting: '' },
    rationale: 'Idea generada offline: combinación coherente de momento, necesidad y emoción del catálogo.',
  };
}

function list(workspaceId) {
  let rows = db.all('ideas').slice();
  if (workspaceId) rows = rows.filter((i) => i.workspaceId === workspaceId);
  return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function get(id) { return db.get('ideas', id); }

function markUsed(id) {
  const idea = db.update('ideas', id, { used: true });
  if (idea && idea.workspaceId) {
    db.update('workspaces', idea.workspaceId, { ideaId: id });
  }
  db.persist();
  return idea;
}

module.exports = { generate, list, get, markUsed, CANONICAL };
