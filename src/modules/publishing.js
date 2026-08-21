'use strict';
/* Publish Engine - publishing consumes the exact artifact set validated by
   Review. It never resolves "latest" after approval. */

const db = require('../db');
const publishingProvider = require('../providers/publishing');
const review = require('./review');
const packaging = require('./packaging');
const dnaModule = require('./content-dna');
const scripture = require('./scripture');
const tracks = require('./tracks');

function getById(table, id) {
  return id ? db.get(table, id) : null;
}

function currentArtifactSet(workspaceId, reviewRow) {
  const lineage = reviewRow.lineage || {};
  const dna = db.where('content_dna', (x) => x.workspaceId === workspaceId && Number(x.version) === Number(lineage.contentDnaVersion))[0]
    || db.allVersions('content_dna', { name: 'workspaceId', value: workspaceId }).find((x) => Number(x.version) === Number(lineage.contentDnaVersion));
  const sc = getById('scriptures', lineage.scriptureId);
  const pkg = db.where('packaging_versions', (x) => x.workspaceId === workspaceId && Number(x.version) === Number(lineage.packagingVersion))[0] || null;
  const selectedTracks = (lineage.tracks || []).map((ref) => {
    const track = getById('tracks', ref.trackId);
    if (!track || track.status === 'STALE' || track.status === 'SUPERSEDED') return null;
    const trackPlanVersion = Number(track.trackPlanVersion);
    const lyrics = db.where('lyrics_versions', (l) => l.trackId === ref.trackId && l.status === 'APPROVED' && Number(l.version) === Number(ref.lyricsVersion) && l.lineage && Number(l.lineage.trackPlanVersion) === trackPlanVersion && l.lineage.contentDnaVersion === track.contentDnaVersion && l.lineage.scriptureId === track.scriptureId)[0] || null;
    const music = getById('music_generations', ref.musicGenerationId);
    if (!lyrics || !music || music.status !== 'SUCCEEDED' || music.lineage?.trackPlanVersion !== trackPlanVersion || music.lineage?.contentDnaVersion !== track.contentDnaVersion || music.lineage?.scriptureId !== track.scriptureId) return null;
    return { trackId: track.id, trackPlanVersion, lyricsVersion: lyrics.version, musicGenerationId: music.id };
  }).filter(Boolean);
  const thumbnail = getById('visual_assets', lineage.visualAssetId);

  return {
    contentDnaVersion: dna ? dna.version : null,
    scriptureId: sc ? sc.id : null,
    trackPlanVersion: lineage.trackPlanVersion || null,
    tracks: selectedTracks,
    visual: {
      masterReferenceId: lineage.visualMasterReferenceId || null,
      assetVersion: thumbnail ? thumbnail.version : null,
      assetId: thumbnail ? thumbnail.id : null,
    },
    packagingVersion: pkg ? pkg.version : null,
  };
}

function publish(workspaceId, input = {}) {
  const ws = db.get('workspaces', workspaceId);
  if (!ws) throw new Error('Workspace no encontrado.');
  const rev = review.latest(workspaceId);
  if (!rev || rev.status !== 'APPROVED') throw new Error('Publicación bloqueada: la revisión debe estar APPROVED.');
  if (!rev.lineage) throw new Error('Publicación bloqueada: la revisión no tiene lineage. Vuelve a evaluar.');

  const artifacts = currentArtifactSet(workspaceId, rev);
  const expectedCount = Array.isArray(rev.lineage.tracks) ? rev.lineage.tracks.length : 0;
  const invalid = artifacts.tracks.length !== expectedCount || !artifacts.contentDnaVersion || !artifacts.scriptureId || !artifacts.packagingVersion || !artifacts.visual.assetId;
  if (invalid) throw new Error('Publicación bloqueada: el conjunto exacto revisado ya no está disponible o fue invalidado. Vuelve a evaluar.');

  const snap = publishingProvider.recordPublication(workspaceId, {
    youtubeVideoId: input.youtubeVideoId || '',
    url: input.url || '',
    publishDate: input.publishDate || new Date().toISOString(),
    playlist: input.playlist || '',
    series: ws.seriesId || '',
    disclosureState: ws.aiDisclosure ? 'declared' : 'not_set',
    titleVersion: artifacts.packagingVersion,
    thumbnailVersion: artifacts.visual.assetVersion,
    descriptionVersion: artifacts.packagingVersion,
    artifacts,
  });
  db.update('workspaces', workspaceId, { status: 'PUBLISHED', publishedAt: new Date().toISOString() });
  db.persist();
  return snap;
}

function exportPackage(workspaceId) {
  const ws = db.get('workspaces', workspaceId);
  if (!ws) throw new Error('Workspace no encontrado.');
  const pkg = packaging.latest(workspaceId);
  const dna = dnaModule.getLatest(workspaceId);
  const sc = scripture.getApproved(workspaceId);
  const approvedTracks = tracks.allApproved(workspaceId);
  const thumbnails = db.where('visual_assets', (v) => v.workspaceId === workspaceId && v.status !== 'STALE');
  const latestThumb = thumbnails.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).pop() || null;
  const musicAssets = db.where('music_generations', (m) => m.workspaceId === workspaceId && m.status === 'SUCCEEDED' && m.status !== 'STALE');

  return {
    workspaceId,
    workspaceName: ws.name,
    package: pkg || null,
    contentDNA: dna || null,
    scripture: sc || null,
    tracks: approvedTracks.map((t) => {
      const gen = musicAssets.filter((m) => m.trackId === t.id).pop();
      const lyr = db.where('lyrics_versions', (l) => l.trackId === t.id && l.status === 'APPROVED').pop() || null;
      return { number: t.number, title: t.title, scriptureReference: t.scriptureReference, sunoPrompt: t.sunoPrompt, lyrics: lyr ? lyr.lyrics : null, audioUrl: gen ? gen.assetUrl : null };
    }),
    thumbnail: latestThumb ? { prompt: latestThumb.prompt, text: latestThumb.thumbnailText, assetUrl: latestThumb.assetUrl, format: latestThumb.format } : null,
    assets: [
      ...approvedTracks.map((t) => {
        const gen = musicAssets.filter((m) => m.trackId === t.id).pop();
        return { kind: 'music', trackNumber: t.number, trackId: t.id, assetUrl: gen ? gen.assetUrl : null, status: gen ? gen.status : 'MISSING' };
      }),
      ...(latestThumb ? [{ kind: 'thumbnail', assetUrl: latestThumb.assetUrl, status: latestThumb.assetUrl ? 'READY' : 'MISSING' }] : []),
    ],
    versions: {
      contentDna: dna ? dna.version : null,
      packaging: pkg ? pkg.version : null,
      thumbnail: latestThumb ? latestThumb.version : null,
    },
    disclosure: { aiDisclosure: ws.aiDisclosure, rightsMetadata: ws.rightsMetadata },
    exportedAt: new Date().toISOString(),
  };
}

function history(workspaceId) {
  return db.where('publication_snapshots', (p) => p.workspaceId === workspaceId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

module.exports = { publish, exportPackage, history };