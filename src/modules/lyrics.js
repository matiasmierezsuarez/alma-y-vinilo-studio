'use strict';
/* Lyrics Engine - lyrics are only generated after Content DNA approved,
   Scripture approved and Track Plan approved. Each request receives the
   track purpose, Scripture reference/theme, emotional start and
   destination, selected sound seed and vocal mode. The engine never
   claims invented quotations are Scripture. */

const db = require('../db');
const llm = require('../providers/llm');
const dnaModule = require('./content-dna');
const scripture = require('./scripture');
const tracks = require('./tracks');

function requirePrereqs(workspaceId) {
  if (!dnaModule.getLatest(workspaceId)) throw new Error('Primero desarrolla el Content DNA.');
  if (!scripture.getApproved(workspaceId)) throw new Error('Primero aprueba la Scripture.');
  if (!tracks.allApproved(workspaceId).length) throw new Error('Primero aprueba el Track Plan.');
}

function buildPrompt(workspaceId, track) {
  const dna = dnaModule.getLatest(workspaceId);
  const moment = (dna && dna.moment) || '';
  const need = (dna && dna.humanNeed) || '';
  return [
    'Actúa como compositor cristiano profesional de canciones originales en español latinoamericano.',
    'No imites ni reproduzcas el estilo identificable de artistas concretos. Usa únicamente rasgos generales: intimidad, honestidad emocional, lenguaje cantable y fundamento bíblico.',
    'La canción debe sonar natural en una balada contemplativa de jazz/soul/lofi, cantada despacio.',
    'OBJETIVO: contar una escena real y específica que avance desde la emoción cruda hacia una esperanza creíble, sin negar el problema.',
    'REGLAS DE COHERENCIA:',
    '- Antes de escribir, define mentalmente una sola escena principal, un objeto concreto y una acción. Reutilízalos para que todos los versos pertenezcan al mismo mundo.',
    '- Cada verso debe continuar una pequeña historia: situación inicial, tensión y respuesta. No encadenes frases bonitas sin relación causal.',
    '- Cada línea debe expresar una sola idea y poder cantarse de corrido. Prefiere palabras comunes y verbos concretos sobre conceptos abstractos.',
    '- Mantén entre 6 y 10 sílabas aproximadas por línea. Las líneas de una misma sección deben tener longitudes parecidas.',
    '- Elige una terminación sonora para cada sección y repítela en al menos 2 líneas. Usa rima asonante natural; no fuerces palabras para rimar.',
    '- El coro debe tener 4 líneas, una frase ancla memorable y una verdad bíblica clara. La frase ancla debe reaparecer en el coro final.',
    '- Usa detalles sensoriales del momento: luz, sonido, temperatura, objetos, manos, pasos, ventana, taza, lluvia o respiración, pero sólo si pertenecen a la escena.',
    '- Evita frases intelectuales, metáforas mezcladas, abstracciones acumuladas y afirmaciones que no conecten con la línea anterior.',
    '- Escribe letras 100% originales. No copies, cites ni imites canciones existentes.',
    '- Integra el sentido del pasaje bíblico de forma orgánica. No escribas la referencia bíblica dentro de la letra.',
    '- No agregues explicaciones, análisis, notas de métrica ni comentarios fuera de la letra.',
    '',
    `Título del track: ${track.title}`,
    `Tema / mensaje: ${track.scriptureTheme}`,
    `Pasaje bíblico de apoyo: ${track.scriptureReference}`,
    `Tono: ${track.emotionalStart} → ${track.emotionalEnd}`,
    `Género sonoro: ${track.soundSeed}`,
    `Momento del día: ${moment}`,
    `Necesidad del oyente: ${need}`,
    `Hook / dirección: ${track.lyricDirection}`,
    '',
    'ESTRUCTURA OBLIGATORIA: [Intro], [Verso 1], [Verso 2], [Pre-coro], [Coro], [Puente], [Coro final].',
    'Cada verso y el puente deben tener 4-6 líneas. El pre-coro debe tener 2-4 líneas. El coro y el coro final deben tener exactamente 4 líneas.',
    'AUTOCHEQUEO ANTES DE RESPONDER: comprueba que cada verso continúa la misma escena, que las líneas de cada sección tienen longitud parecida, que hay rimas naturales y que el coro puede recordarse después de una escucha.',
    'Devuelve SOLO JSON: {"lyrics":"...texto completo con secciones en corchetes..."}',
  ].join('\n');
}

function fallbackLyrics(workspaceId, track) {
  const theme = track.scriptureTheme || 'paz y presencia';
  const title = track.title || 'Esta canción';
  return [
    `[Intro]\n${title} suena despacio,\ncomo una oración que nadie pidió\npero todos necesitaban.`,
    `[Verso 1]\nLa noche se queda en la ventana,\nun café se enfría sin prisa.\nHay algo que no se nombra,\nun peso que solo el silencio alivia.\nLas calles duermen, pero mi mente\nbusca una luz que no se apaga.`,
    `[Pre-coro]\nY aunque no tengo palabras,\nalgo se mueve dentro,\nalgo que no es mío\nme sostiene sin que yo lo pida.`,
    `[Coro]\nDescanso aquí, en este lugar\nque no tiene nombre pero se siente real.\n${theme},\ny mi alma por fin se queda quieta.`,
    `[Verso 2]\nLas promesas del día se pierden\ncomo humo sobre la taza.\nPero hay una voz que no se va,\nuna que habla bajo, sin hacer ruido.\nNo es un trueno, es una caricia,\nun hilo de luz que no se corta.`,
    `[Puente]\nSi pudiera dormir en este momento\ny despertar sin miedo,\nsabría que lo que siento\nes más fuerte que cualquier ruido.\nEs una presencia que no se va,\nuna mano que no se cansa.`,
    `[Coro final]\nDescanso aquí, en este lugar\nque no tiene nombre pero se siente real.\n${theme},\ny mi alma por fin se queda quieta.\nSe queda quieta.`,
  ].join('\n\n');
}

const BIBLE_REF_RE = /\b(?:Salmo|Salmos|Proverbios|Prov|Isaías|Isa|Jeremías|Jer|Eclesiastés|Ecle|Éxodo|Ex|Génesis|Gen|Mateo|Mat|Marcos|Mc|Lucas|Lc|Juan|Jn|Hechos|Hch|Romanos|Rom|Corintios|1? ?Cor|Efesios|Ef|Filipenses|Fil|Colosenses|Col|Tesalonicenses|Timoteo|Tim|Hebreos|Heb|Santiago|Stg|Pedro|1? ?Pe|Juan|Jn|Apocalipsis|Ap)[ 0-9]*,?\s*\d+[:–-]\d+[\d\-:,.]*\b/i;

function sanitizeLyrics(raw) {
  const out = String(raw || '')
    .split(/\n{2,}/)
    .filter((block) => !BIBLE_REF_RE.test(block))
    .join('\n\n');
  return out
    .replace(/\[Intro\]/gi, '[Intro]')
    .replace(/\[Verse \d\]/gi, (m) => '[Verso ' + m.replace(/\D/g, '') + ']')
    .replace(/\[Verso \d\]/gi, (m) => m)  // preserve Spanish verse tags
    .replace(/\[Pre-chorus\]/gi, '[Pre-coro]')
    .replace(/\[Pre-coro\]/gi, '[Pre-coro]')
    .replace(/\[Chorus final\]/gi, '[Coro final]')
    .replace(/\[Coro final\]/gi, '[Coro final]')
    .replace(/\[Chorus\]/gi, '[Coro]')
    .replace(/\[Coro\]/gi, '[Coro]')
    .replace(/\[Bridge\]/gi, '[Puente]')
    .replace(/\[Puente\]/gi, '[Puente]')
    .replace(/\[Ending\]/gi, '[Final]')
    .replace(/\[Outro\]/gi, '[Final]')
    .replace(/\[Final\]/gi, '[Final]');
}

function hasUsableStructure(lyrics) {
  const text = String(lyrics || '').trim();
  const required = ['[Verso 1]', '[Verso 2]', '[Pre-coro]', '[Coro]', '[Puente]', '[Coro final]'];
  if (!required.every((section) => text.includes(section))) return false;
  const sections = text.split(/(?=\[(?:Intro|Verso \d|Pre-coro|Coro(?: final)?|Puente|Final)\])/i).filter(Boolean);
  const contentSections = sections.filter((section) => !/^\[Intro\]/i.test(section));
  if (contentSections.length < 6) return false;
  return contentSections.every((section) => section.split('\n').slice(1).map((line) => line.trim()).filter(Boolean).length >= 2);
}

async function generate(trackId, opts = {}) {
  const track = tracks.get(trackId);
  if (!track) throw new Error('Track no encontrado.');
  requirePrereqs(track.workspaceId);
  let lyrics;
  if (!opts.offline) {
    try {
      const data = await llm.json(
        [{ role: 'system', content: buildPrompt(track.workspaceId, track) }, { role: 'user', content: 'Escribe la letra del track.' }],
        { temperature: 0.82, model: opts.model }
      );
      lyrics = sanitizeLyrics(data.lyrics);
      if (!hasUsableStructure(lyrics)) lyrics = '';
    } catch {
      lyrics = '';
    }
  }
  if (!lyrics) lyrics = fallbackLyrics(track.workspaceId, track);
  const stored = db.insertVersioned('lyrics_versions', { name: 'trackId', value: trackId }, {
    workspaceId: track.workspaceId,
    trackId,
    lyrics,
    status: 'DRAFT',
  });
  db.update('tracks', trackId, { lyrics });
  db.persist();
  return stored;
}

function approve(trackId, version) {
  const v = db.where('lyrics_versions', (l) => l.trackId === trackId && l.version === Number(version))[0];
  if (!v) throw new Error('Versión de lyrics no encontrada.');
  const approved = db.update('lyrics_versions', v.id, { status: 'APPROVED' });
  db.update('tracks', trackId, { lyrics: v.lyrics });
  db.persist();
  return approved;
}

function versionsForTrack(trackId) {
  return db.allVersions('lyrics_versions', { name: 'trackId', value: trackId });
}

function latestForTrack(trackId) {
  return db.latestVersion('lyrics_versions', { name: 'trackId', value: trackId });
}

function approvedForWorkspace(workspaceId) {
  return db.where('lyrics_versions', (l) => l.workspaceId === workspaceId && l.status === 'APPROVED');
}

module.exports = { generate, approve, versionsForTrack, latestForTrack, approvedForWorkspace, buildPrompt, fallbackLyrics, sanitizeLyrics, hasUsableStructure };
