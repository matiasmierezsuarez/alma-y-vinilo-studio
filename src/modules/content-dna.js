'use strict';
/* Content DNA - the central object of a workspace. Versioned. Immutable
   by default after publication; edits create a new version. */

const db = require('../db');
const llm = require('../providers/llm');
const config = require('../config');
const ideas = require('./ideas');
const invalidation = require('./invalidation');

const MOMENT_SCENARIOS = {
  morning: { location: 'coffeehouse', time: 'morning', weather: 'soft rain outside the window', activity: 'reading Scripture', props: ['coffee', 'open Bible', 'stack of vinyl records'], lighting: 'warm window light' },
  work: { location: 'cozy home office', time: 'morning', weather: 'clear sky', activity: 'working at a wooden desk', props: ['coffee', 'notebook', 'vinyl player'], lighting: 'soft desk lamp' },
  study: { location: 'quiet library room', time: 'afternoon', weather: 'overcast', activity: 'studying with a notebook', props: ['books', 'coffee', 'pencil'], lighting: 'warm reading lamp' },
  prayer: { location: 'cozy living room', time: 'evening', weather: 'quiet night', activity: 'praying quietly', props: ['candle', 'Bible', 'coffee'], lighting: 'candlelight' },
  reading: { location: 'cozy armchair corner', time: 'evening', weather: 'rainy', activity: 'reading a book', props: ['book', 'blanket', 'tea'], lighting: 'warm floor lamp' },
  journaling: { location: 'coffeehouse corner', time: 'morning', weather: 'soft rain', activity: 'journaling', props: ['journal', 'coffee', 'pen'], lighting: 'warm window light' },
  evening: { location: 'cozy room', time: 'evening', weather: 'quiet night', activity: 'winding down', props: ['candle', 'coffee', 'vinyl player'], lighting: 'dim warm light' },
  reflection: { location: 'late-night room', time: 'late night', weather: 'still night', activity: 'reflecting quietly', props: ['candle', 'open Bible'], lighting: 'soft lamp glow' },
  rest: { location: 'cozy bedroom', time: 'night', weather: 'quiet', activity: 'resting and calming down', props: ['blanket', 'candle', 'soft music'], lighting: 'very soft warm glow' },
};

function scenarioFor(moment) {
  return Object.assign(
    { location: '', time: '', weather: '', activity: '', props: [], lighting: '' },
    MOMENT_SCENARIOS[moment] || MOMENT_SCENARIOS.morning
  );
}

function fromIdea(idea) {
  const scenario = scenarioFor(idea.moment);
  const visuals = config.visualDna().identity || {};
  return {
    moment: idea.moment || 'morning',
    humanNeed: idea.humanNeed || 'rest',
    currentEmotion: idea.currentEmotion || idea.humanNeed || 'anxiety',
    desiredEmotion: idea.desiredEmotion || 'peace',
    scriptureId: idea.scriptureId || null,
    scriptureReference: idea.suggestedScripture || '',
    soundSeed: idea.suggestedSoundSeed || 'SEED_A_JAZZ_VINYL',
    vocalMode: idea.vocalMode || 'SOFT_FEMALE',
    visualScenario: Object.assign(scenario, {
      props: scenario.props.length ? scenario.props : ['coffee', 'open Bible'],
      lighting: scenario.lighting || (visuals.lightingLanguage || 'warm window light'),
    }),
    packagingFormula: idea.packagingFormula || 'MOMENT_FIRST',
    rationale: idea.rationale || '',
    ideaId: idea.id || null,
    source: idea.source || 'generated',
  };
}

function develop(workspaceId, ideaId, opts = {}) {
  const ws = db.get('workspaces', workspaceId);
  if (!ws) throw new Error('Workspace no encontrado.');
  const idea = ideas.get(ideaId) || { moment: 'morning', humanNeed: 'rest', desiredEmotion: 'peace', suggestedScripture: '', suggestedSoundSeed: 'SEED_A_JAZZ_VINYL', vocalMode: 'SOFT_FEMALE', packagingFormula: 'MOMENT_FIRST', rationale: '', id: null };
  const dna = fromIdea(idea);
  dna.workspaceId = workspaceId;
  const stored = db.insertVersioned('content_dna', { name: 'workspaceId', value: workspaceId }, dna);
  db.update('workspaces', workspaceId, {
    contentDnaVersion: stored.version,
    ideaId: ideaId || ws.ideaId || null,
    status: ws.status === 'NOT_STARTED' ? 'IN_PROGRESS' : ws.status,
  });
  db.persist();
  invalidation.invalidateWorkspaceArtifacts(workspaceId, {
    type: 'CONTENT_DNA_CHANGED',
    sourceArtifactId: stored.id,
    sourceVersion: stored.version,
  });
  return stored;
}

function refineVisualScenario(workspaceId, opts = {}) {
  /* Optional LLM enrichment of the visual scenario within constraints. */
  const dna = getLatest(workspaceId);
  if (!dna) throw new Error('Primero desarrolla el Content DNA.');
  const visuals = config.visualDna().identity || {};
  const messages = [
    { role: 'system', content: [
      'Refina un escenario visual manteniendo la identidad visual del canal:',
      'El canal es 100% en español. Todos los textos del escenario visual (location, time, weather, activity, lighting) deben estar en español.',
      `Personajes: ${(visuals.characters || []).map((c) => c.description).join(' ')}`,
      `Paleta: ${(visuals.palette || []).join(', ')}`,
      `Lenguaje de luz: ${visuals.lightingLanguage || ''}`,
      `Entorno: ${visuals.environmentLanguage || ''}`,
      `Encuadre: ${visuals.framing || ''}`,
      'No cambies la identidad estable; solo ajusta location/time/weather/activity/props/lighting dentro del mismo universo.',
      'Devuelve SOLO JSON: {"visualScenario":{"location":"","time":"","weather":"","activity":"","props":[""],"lighting":""}}',
    ].join('\n') },
    { role: 'user', content: `Moment: ${dna.moment}. Need: ${dna.humanNeed}. Desired emotion: ${dna.desiredEmotion}.` },
  ];
  const data = awaitLLM(messages, opts);
  const sc = data.visualScenario || data;
  const base = scenarioFor(dna.moment);
  const merged = Object.assign(base, sc, { props: Array.isArray(sc.props) && sc.props.length ? sc.props : base.props });
  dna.visualScenario = merged;
  const stored = db.insertVersioned('content_dna', { name: 'workspaceId', value: workspaceId }, dna);
  db.update('workspaces', workspaceId, { contentDnaVersion: stored.version });
  db.persist();
  invalidation.invalidateWorkspaceArtifacts(workspaceId, {
    type: 'CONTENT_DNA_CHANGED',
    sourceArtifactId: stored.id,
    sourceVersion: stored.version,
  });
  return stored;
}

async function awaitLLM(messages, opts) {
  try {
    return await llm.json(messages, { temperature: 0.6, model: opts.model });
  } catch {
    return {};
  }
}

function getLatest(workspaceId) {
  return db.latestVersion('content_dna', { name: 'workspaceId', value: workspaceId });
}

function versions(workspaceId) {
  return db.allVersions('content_dna', { name: 'workspaceId', value: workspaceId });
}

/* Edits after publication create a version; the workspace points to the
   newest version. */
function edit(workspaceId, patch) {
  const latest = getLatest(workspaceId);
  if (!latest) throw new Error('No existe Content DNA.');
  const merged = Object.assign({}, latest, patch);
  merged.workspaceId = workspaceId;
  const stored = db.insertVersioned('content_dna', { name: 'workspaceId', value: workspaceId }, merged);
  db.update('workspaces', workspaceId, { contentDnaVersion: stored.version });
  db.persist();
  invalidation.invalidateWorkspaceArtifacts(workspaceId, {
    type: 'CONTENT_DNA_CHANGED',
    sourceArtifactId: stored.id,
    sourceVersion: stored.version,
  });
  return stored;
}

module.exports = { develop, edit, getLatest, versions, fromIdea, MOMENT_SCENARIOS };
