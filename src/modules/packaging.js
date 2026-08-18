'use strict';
/* Packaging Engine - versioned and lineage-aware. */

const db = require('../db');
const llm = require('../providers/llm');
const config = require('../config');
const dnaModule = require('./content-dna');
const scripture = require('./scripture');
const tracks = require('./tracks');
const visual = require('./visual');
const invalidation = require('./invalidation');

const BENEFIT_BY_MOMENT = { morning: 'a peaceful start', work: 'focus without distraction', study: 'calm and concentration', prayer: 'a closer time with God', reading: 'a quiet backdrop', journaling: 'space to think', evening: 'a gentle wind-down', reflection: 'a moment to think', rest: 'deep, restful calm' };
const MUSIC_BY_MOMENT = { morning: 'Christian jazz & soul', work: 'Christian jazz', study: 'Christian jazz', prayer: 'worship jazz & soul', reading: 'soft jazz', journaling: 'quiet jazz', evening: 'warm jazz & soul', reflection: 'reflective gospel soul', rest: 'peaceful jazz' };

function fallbackPackaging(workspaceId) {
  const dna = dnaModule.getLatest(workspaceId); const sc = scripture.getApproved(workspaceId); const formula = dna.packagingFormula || 'MOMENT_FIRST'; const moment = dna.moment; const emotion = dna.desiredEmotion; const ref = sc ? sc.reference : 'Salmo 23'; const theme = sc ? sc.theme : ''; const music = MUSIC_BY_MOMENT[moment] || 'Christian jazz'; const benefit = BENEFIT_BY_MOMENT[moment] || 'peaceful moments'; const titleCap = moment.charAt(0).toUpperCase() + moment.slice(1); const emotionCap = emotion.charAt(0).toUpperCase() + emotion.slice(1);
  let title = formula === 'EMOTION_FIRST' ? `${emotionCap} | ${titleCap} ${music} | ${ref}` : formula === 'MUSIC_FIRST' ? `Christian Jazz | ${titleCap} | ${ref} · ${benefit}` : `${titleCap} | ${music} for ${benefit} | ${ref}`;
  const tracklist = tracks.allApproved(workspaceId).map((t) => `${String(t.number).padStart(2, '0')}. ${t.title} — ${t.scriptureReference}`).join('\n');
  const description = [`HOOK: Deja que esta música te envuelva mientras ${moment === 'rest' ? 'descansas' : 'vives este momento'}.`, `WHAT THIS IS: Una sesión de ${music} inspirada en la fe, hecha para ${benefit}.`, `SCRIPTURE FOUNDATION: Esta sesión se apoya en ${ref} — ${theme}.`, `USE CASES: Ideal para ${moment}, trabajo, estudio, oración y descanso.`, `TRACKLIST:\n${tracklist}`, 'AI / HUMAN CREATION NOTE: Música generada con IA bajo dirección creativa humana; selección de Scripture y dirección editorial curadas por el equipo.', 'CTA: Si esta música te trajo paz, suscríbete y activa la campana 🔔', 'HASHTAGS: #ChristianJazz #MúsicaParaOrar #MúsicaParaEstudiar #GospelSoul #AlmaYVinilo'].join('\n\n');
  const tags = ['christian jazz', 'gospel soul', `música para ${moment}`, `jazz para ${moment}`, 'música para orar', 'música para estudiar', ref.toLowerCase(), 'christian music', 'jazz instrumental'];
  const identity = config.visualDna().identity || {}; const characters = (identity.characters || []).map((c) => c.description).join(' '); const vs = dna.visualScenario || {}; const thumbnailPrompt = `Thumbnail, two recurring characters, ${characters || 'praying quietly'}, ${vs.activity || 'a quiet moment'}, ${vs.location || 'cozy living room'}, ${vs.lighting || 'warm window light'}, cinematic medium shot, ${(identity.palette || []).join(', ')}, text: "${visual.thumbnailTextFor('T2', dna)}"`;
  return { title, thumbnailText: visual.thumbnailTextFor('T2', dna), thumbnailPrompt, description, tags, formula };
}

async function generate(workspaceId, opts = {}) {
  const dna = dnaModule.getLatest(workspaceId); if (!dna) throw new Error('Primero desarrolla el Content DNA.');
  const sc = scripture.getApproved(workspaceId); const fallback = fallbackPackaging(workspaceId); let data = null;
  if (!opts.offline) { try {
    const formulas = config.packagingFormulas().formulas || {};
    const messages = [
      { role: 'system', content: ['Genera packaging accionable para YouTube para un video de música cristiana cálida.', 'El canal es 100% en español. Título, descripción, tags y texto de miniatura deben estar en español, naturales y cálidos.', `Fórmula de título seleccionada: ${opts.formula || dna.packagingFormula} (plantilla: ${formulas[opts.formula || dna.packagingFormula] ? formulas[opts.formula || dna.packagingFormula].template : ''})`, 'No hagas keyword-stuffing: título legible para una persona, descripción útil.', 'La descripción debe seguir esta estructura: HOOK / WHAT THIS IS / SCRIPTURE FOUNDATION / USE CASES / TRACKLIST / AI-HUMAN CREATION NOTE / CTA / HASHTAGS.', 'El título NO debe incluir texto de miniatura; la miniatura lleva su propio texto corto.', 'Devuelve SOLO JSON: {"title":"","thumbnailText":"","thumbnailPrompt":"","description":"","tags":[""]}'].join('\n') },
      { role: 'user', content: `Moment: ${dna.moment}. Need: ${dna.humanNeed}. Desired emotion: ${dna.desiredEmotion}. Scripture: ${sc ? sc.reference + ' (' + sc.theme + ')' : ''}. Sound seed: ${dna.soundSeed}. Tracks:\n${tracks.allApproved(workspaceId).map((t) => t.number + '. ' + t.title).join('\n') || 'n/a'}` },
    ];
    data = await llm.json(messages, { temperature: 0.6, model: opts.model });
  } catch { data = null; } }

  const scNow = scripture.getApproved(workspaceId);
  const currentTracks = tracks.allApproved(workspaceId);
  const trackPlanVersion = currentTracks.length ? Math.max(...currentTracks.map((t) => Number(t.trackPlanVersion) || 0)) : null;
  const master = visual.getMasterReference();
  const pkg = {
    workspaceId,
    formula: opts.formula || dna.packagingFormula || fallback.formula,
    title: String((data && data.title) || fallback.title).trim(),
    thumbnailText: opts.thumbnailText != null ? String(opts.thumbnailText) : String((data && data.thumbnailText) || fallback.thumbnailText || ''),
    thumbnailPrompt: String((data && data.thumbnailPrompt) || fallback.thumbnailPrompt || ''),
    description: String((data && data.description) || fallback.description).trim(),
    tags: Array.isArray(data && data.tags) ? data.tags.filter(Boolean) : fallback.tags,
    status: 'DRAFT',
    lineage: { workspaceId, contentDnaVersion: dna.version, scriptureId: scNow ? scNow.id : null, trackPlanVersion, visualMasterReferenceId: master ? master.id : null },
  };
  const stored = db.insertVersioned('packaging_versions', { name: 'workspaceId', value: workspaceId }, pkg);
  db.update('workspaces', workspaceId, { packagingVersion: stored.version });
  db.persist();
  invalidation.invalidateWorkspaceArtifacts(workspaceId, { type: 'PACKAGING_CHANGED', sourceArtifactId: stored.id, sourceVersion: stored.version });
  return stored;
}
function latest(workspaceId) { return db.latestVersion('packaging_versions', { name: 'workspaceId', value: workspaceId }); }
function versions(workspaceId) { return db.allVersions('packaging_versions', { name: 'workspaceId', value: workspaceId }); }
module.exports = { generate, latest, versions, fallbackPackaging };
