'use strict';
/* Sound Engine + Suno-compatible MusicProvider adapter.
   Never generates a music prompt from scratch: prompts are composed as
   BASE SEED + CONTROLLED MODIFIERS, and combinations that break the
   seed identity are rejected. Generations are never overwritten. */

const db = require('../db');
const config = require('../config');
const musicProvider = require('../providers/music');
const tracks = require('./tracks');
const dnaModule = require('./content-dna');

function seeds() {
  return config.soundSeeds().seeds || {};
}

function seedList() {
  return Object.entries(seeds()).map(([id, s]) => ({ id, name: s.name, basePrompt: s.basePrompt }));
}

function modifiers(seedId) {
  const seed = config.seedById(seedId);
  return (seed && seed.modifiers) || {};
}

function validate(seedId, mods) {
  const seed = config.seedById(seedId);
  if (!seed) return { ok: false, errors: ['Semilla de sonido desconocida.'] };
  const errors = [];
  const cats = seed.modifiers || {};
  Object.keys(mods).forEach((cat) => {
    if (!(cat in cats)) { errors.push(`Categoría de modificador desconocida: ${cat}`); return; }
    const value = String(mods[cat] || '');
    if (value && !cats[cat].includes(value)) {
      errors.push(`Valor "${value}" no permitido para ${cat}. Permitidos: ${cats[cat].join(', ')}`);
    }
  });
  const text = Object.values(mods).join(' ').toLowerCase();
  (seed.forbiddenTokens || []).forEach((tok) => {
    if (text.includes(tok.toLowerCase())) errors.push(`Combinación prohibida para la identidad de la semilla: "${tok}"`);
  });
  return { ok: errors.length === 0, errors };
}

function compose(seedId, mods = {}) {
  const seed = config.seedById(seedId);
  if (!seed) throw new Error('Semilla de sonido desconocida.');
  const normalizedMods = Object.assign({}, mods, {
    emotion: mods.emotion ? emotionModifier(mods.emotion) : mods.emotion,
  });
  const v = validate(seedId, normalizedMods);
  if (!v.ok) throw new Error('Suno prompt inválido: ' + v.errors.join(' | '));
  const parts = [seed.basePrompt];
  const order = ['moment', 'emotion', 'vocal', 'energy', 'environment'];
  order.forEach((cat) => {
    const val = String(normalizedMods[cat] || '').trim();
    if (val) parts.push(`${cat.replace(/^./, (c) => c.toUpperCase())}: ${val}`);
  });
  return parts.join(', ');
}

const VOCAL_MODIFIER = {
  INSTRUMENTAL: 'instrumental',
  SOFT_MALE: 'soft male',
  SOFT_FEMALE: 'soft female',
  SOFT_DUET: 'soft duet',
  VOCAL_TEXTURE: 'vocal texture',
};

const EMOTION_MODIFIER = {
  joy: 'grateful',
  gratitude: 'grateful',
  trust: 'hopeful',
  peace: 'peaceful',
  comfort: 'comforting',
  comforted: 'comforting',
  vulnerability: 'reflective',
  vulnerable: 'reflective',
  fear: 'reflective',
  miedo: 'reflective',
  anxiety: 'reflective',
  anxious: 'reflective',
  sadness: 'reflective',
  sad: 'reflective',
  grief: 'reflective',
  culpa: 'reflective',
  guilt: 'reflective',
  anger: 'reflective',
  ira: 'reflective',
  focus: 'reflective',
  rest: 'peaceful',
  calm: 'peaceful',
  hope: 'hopeful',
  presence: 'comforting',
  patience: 'hopeful',
  // español -> inglés para prompts Suno
  paz: 'peaceful',
  calma: 'peaceful',
  serenidad: 'peaceful',
  tranquilidad: 'peaceful',
  quietud: 'peaceful',
  descanso: 'peaceful',
  reposo: 'peaceful',
  relajacion: 'peaceful',
  soledad: 'reflective',
  reflexion: 'reflective',
  introspeccion: 'reflective',
  nostalgia: 'reflective',
  anoranza: 'reflective',
  melancolia: 'reflective',
  esperanza: 'hopeful',
  confianza: 'hopeful',
  fe: 'hopeful',
  optimismo: 'hopeful',
  paciencia: 'hopeful',
  espera: 'hopeful',
  presencia: 'comforting',
  confort: 'comforting',
  consuelo: 'comforting',
  comodidad: 'comforting',
  compania: 'comforting',
  seguridad: 'comforting',
  abrigo: 'comforting',
  agradecimiento: 'grateful',
  alegria: 'grateful',
  gozo: 'grateful',
  adoracion: 'grateful',
};

function normalize(value) {
  return String(value || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function emotionModifier(value) {
  return EMOTION_MODIFIER[normalize(value)] || EMOTION_MODIFIER[normalize(value).replace(/\s+/g, '_')] || value;
}

const MOMENT_MODIFIER = {
  work: 'study',
  reading: 'evening',
  journaling: 'morning',
  reflection: 'evening',
  // español -> inglés
  manana: 'morning',
  madrugada: 'morning',
  trabajo: 'study',
  estudio: 'study',
  oracion: 'prayer',
  lectura: 'evening',
  tarde: 'evening',
  noche: 'evening',
  anochecer: 'evening',
  reflexion: 'evening',
  descanso: 'rest',
};

function momentModifier(value) {
  return MOMENT_MODIFIER[normalize(value)] || value;
}

function composeForTrack(workspaceId, trackId, mods = {}) {
  const track = tracks.get(trackId);
  if (!track) throw new Error('Track no encontrado.');
  const dna = dnaModule.getLatest(workspaceId);
  const seed = mods.seed || track.soundSeed || (dna && dna.soundSeed) || 'SEED_A_JAZZ_VINYL';
  const vocal = mods.vocal || track.vocalMode || (dna && dna.vocalMode) || 'SOFT_FEMALE';
  const vocalMod = VOCAL_MODIFIER[vocal] || (VOCAL_MODIFIER[vocal.toUpperCase()] || 'soft female');
  const merged = Object.assign({}, mods, {
    moment: momentModifier(mods.moment || (dna && dna.moment) || 'morning'),
    emotion: emotionModifier(mods.emotion || track.emotionalEnd || 'peaceful'),
    vocal: vocalMod,
  });
  const prompt = compose(seed, merged);
  return { seed, prompt, constraints: merged };
}

function generateForTrack(workspaceId, trackId, opts = {}) {
  const track = tracks.get(trackId);
  if (!track) throw new Error('Track no encontrado.');
  const { seed, prompt, constraints } = composeForTrack(workspaceId, trackId, opts.mods || {});
  return db.runJob('music-generate', { workspaceId, trackId, seed }, (job) => {
    const gen = musicProvider.generate({
      workspaceId,
      trackId,
      prompt,
      seed,
      version: (db.where('music_generations', (m) => m.trackId === trackId).length) + 1,
    });
    db.update('tracks', trackId, { sunoPrompt: prompt, soundSeed: seed, vocalMode: constraints.vocal ? track.vocalMode : track.vocalMode });
    db.persist();
    return { generationId: gen.id, seed, prompt, status: gen.status };
  });
}

function regenerateForTrack(workspaceId, trackId, opts = {}) {
  /* Keep the same seed, vary a modifier, append a new generation row. */
  const gen = generateForTrack(workspaceId, trackId, opts);
  return gen;
}

function recordAsset(workspaceId, generationId, { assetUrl, duration, providerGenerationId }) {
  const gen = db.get('music_generations', generationId);
  if (!gen) throw new Error('Generación no encontrada.');
  const updated = musicProvider.recordAsset(generationId, { assetUrl, duration, providerGenerationId });
  db.persist();
  return updated;
}

function listForWorkspace(workspaceId) {
  return db.where('music_generations', (m) => m.workspaceId === workspaceId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function listForTrack(trackId) {
  return db.where('music_generations', (m) => m.trackId === trackId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function jobStatus(jobId) {
  return musicProvider.getStatus(jobId);
}

module.exports = { seeds, seedList, modifiers, validate, compose, composeForTrack, generateForTrack, regenerateForTrack, recordAsset, listForWorkspace, listForTrack, jobStatus };
