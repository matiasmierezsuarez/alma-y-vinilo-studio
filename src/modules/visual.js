'use strict';
/* Visual Engine - canonical thumbnail master + versioned visual assets. */

const db = require('../db');
const llm = require('../providers/llm');
const config = require('../config');
const dnaModule = require('./content-dna');
const scripture = require('./scripture');
const invalidation = require('./invalidation');

function visualIdentity() { return config.visualDna().identity || {}; }

function getMasterReference() {
  return db.where('visual_references', (r) => r.role === 'THUMBNAIL_MASTER' && r.status !== 'SUPERSEDED').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
}
function getReferences() { return db.all('visual_references'); }
function setReference(input) {
  const previous = getMasterReference();
  if (previous) db.update('visual_references', previous.id, { status: 'SUPERSEDED', supersededAt: new Date().toISOString() });
  const ref = db.insert('visual_references', { name: input.name || 'Thumbnail master', assetUrl: input.assetUrl || '', role: 'THUMBNAIL_MASTER', locked: !!input.locked, status: 'ACTIVE', supersedesId: previous ? previous.id : null });
  db.persist();
  if (input.workspaceId) invalidation.invalidateWorkspaceArtifacts(input.workspaceId, { type: 'VISUAL_MASTER_CHANGED', sourceArtifactId: ref.id });
  return ref;
}
function setMasterLocked(id, locked) { const ref = db.update('visual_references', id, { locked: !!locked }); db.persist(); return ref; }
function thumbnailTextFor(format, dna, packaging) {
  if (format === 'T1') return '';
  const moment = (dna && dna.moment) || 'morning';
  const emotion = (dna && dna.desiredEmotion) || 'peace';
  if (format === 'T3') return String(moment).toUpperCase();
  const pair = `${String(moment).toUpperCase()} ${String(emotion).toUpperCase()}`;
  return packaging && packaging.thumbnailText ? String(packaging.thumbnailText).slice(0, 20) : pair;
}
function baseIdentityBlock() {
  const id = visualIdentity();
  return ['Preserva SIEMPRE la identidad visual estable del canal:', `Dos personajes recurrentes: ${(id.characters || []).map((c) => c.description).join(' ')}`, `Paleta reconocible: ${(id.palette || []).join(', ')}`, `Lenguaje de luz: ${id.lightingLanguage || ''}`, `Entorno: ${id.environmentLanguage || ''}`, `Encuadre: ${id.framing || ''}`, `Atmósfera: ${id.atmosphere || ''}`, 'El mismo universo visual, pero el contexto/momento puede variar.'].join('\n');
}
function buildThumbnailPrompt(workspaceId, opts = {}) {
  const dna = dnaModule.getLatest(workspaceId);
  const sc = scripture.getApproved(workspaceId);
  const format = opts.format || 'T2';
  const text = opts.thumbnailText || thumbnailTextFor(format, dna);
  const master = getMasterReference();
  return [
    { role: 'system', content: ['Genera SOLO el prompt para el generador de imágenes de la miniatura del canal.', 'El texto visible de la miniatura y la dirección visual deben estar en español.', baseIdentityBlock(), master && master.locked ? 'La imagen de referencia maestra es canónica; respétala y no la reemplaces implícitamente.' : 'Aún no hay imagen de referencia maestra bloqueada.', `Formato de miniatura: ${format} (${config.visualDna().thumbnailFormats[format] || ''})`, text ? `Texto visible sobre la miniatura (si corresponde): "${text}"` : 'Sin texto visible.', 'Devuelve SOLO JSON: {"thumbnailPrompt":"","thumbnailText":"","videoVisualDirection":""}'].join('\n') },
    { role: 'user', content: `Moment: ${dna.moment}. Necesidad: ${dna.humanNeed}. Emoción deseada: ${dna.desiredEmotion}. Scripture: ${sc ? sc.reference : ''}. Escenario: ${JSON.stringify(dna.visualScenario)}` },
  ];
}
async function generate(workspaceId, opts = {}) {
  const dna = dnaModule.getLatest(workspaceId);
  if (!dna) throw new Error('Primero desarrolla el Content DNA.');
  const format = opts.format || 'T2';
  let result = {};
  if (!opts.offline) { try { result = await llm.json(buildThumbnailPrompt(workspaceId, opts), { temperature: 0.7, model: opts.model }); } catch { result = {}; } }
  const master = getMasterReference();
  const version = db.where('visual_assets', (v) => v.workspaceId === workspaceId).reduce((max, v) => Math.max(max, Number(v.version) || 0), 0) + 1;
  const thumbnailText = opts.thumbnailText != null ? opts.thumbnailText : (result.thumbnailText || thumbnailTextFor(format, dna));
  const thumbnailPrompt = result.thumbnailPrompt || `Thumbnail, two recurring characters, ${dna.visualScenario.activity || 'quiet moment'}, ${dna.visualScenario.location || 'coffeehouse'}, ${dna.visualScenario.lighting || 'warm window light'}, cinematic medium shot, ${(visualIdentity().palette || []).join(', ')}`;
  const videoDirection = result.videoVisualDirection || `Full-video visual: ${dna.visualScenario.activity} in ${dna.visualScenario.location}, ${dna.visualScenario.time}, ${dna.visualScenario.weather}, warm ${dna.visualScenario.lighting}, keep the two recurring characters present, calm pacing, cinematic framing.`;
  const asset = db.insert('visual_assets', {
    workspaceId, type: 'thumbnail', prompt: thumbnailPrompt, thumbnailText, videoVisualDirection: videoDirection, format, assetUrl: '', version,
    status: 'GENERATED',
    lineage: { workspaceId, contentDnaVersion: dna.version, scriptureId: scripture.getApproved(workspaceId)?.id || null, visualMasterReferenceId: master ? master.id : null, visualAssetVersion: version },
    createdAt: new Date().toISOString(),
  });
  db.persist();
  return asset;
}
function recordAsset(assetId, { assetUrl }) { const asset = db.get('visual_assets', assetId); if (!asset) throw new Error('Activo visual no encontrado.'); return db.update('visual_assets', assetId, { assetUrl, status: assetUrl ? 'APPROVED' : asset.status }); }
function listForWorkspace(workspaceId) { return db.where('visual_assets', (v) => v.workspaceId === workspaceId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); }
module.exports = { generate, recordAsset, listForWorkspace, getMasterReference, getReferences, setReference, setMasterLocked, visualIdentity, thumbnailTextFor };
