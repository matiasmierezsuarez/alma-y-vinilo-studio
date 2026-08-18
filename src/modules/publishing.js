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

function currentArtifactSet(workspaceId, reviewRow) {
  const dna = dnaModule.getLatest(workspaceId);
  const sc = scripture.getApproved(workspaceId);
  const pkg = packaging.latest(workspaceId);
  const planVersion = reviewRow.lineage ? reviewRow.lineage.trackPlanVersion : null;
  const selectedTracks = tracks.allApproved(workspaceId).filter((t) => !planVersion || Number(t.trackPlanVersion) === Number(planVersion));
  const thumbnails = db.where('visual_assets', (v) => v.workspaceId === workspaceId && v.assetUrl && v.status !== 'STALE').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const thumbnail = thumbnails[thumbnails.length - 1] || null;

  return {
    contentDnaVersion: dna ? dna.version : null,
    scriptureId: sc ? sc.id : null,
    trackPlanVersion: planVersion,
    tracks: selectedTracks.map((t) => {
      const lyrics = db.where('lyrics_versions', (l) => l.trackId === t.id && l.status === 'APPROVED' && l.lineage && l.lineage.trackPlanVersion === t.trackPlanVersion).sort((a, b) => (a.version || 0) - (b.version || 0)).pop() || null;
      const music = db.where('music_generations', (m) => m.trackId === t.id && m.status === 'SUCCEEDED' && m.lineage && m.lineage.trackPlanVersion === t.trackPlanVersion).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).pop() || null;
      return {
        trackId: t.id,
        trackPlanVersion: t.trackPlanVersion,
        lyricsVersion: lyrics ? lyrics.version : null,
        musicGenerationId: music ? music.id : null,
      };
    }),
    visual: { assetVersion: thumbnail ? thumbnail.version : null, assetId: thumbnail ? thumbnail.id : null },
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
  const invalid = artifacts.tracks.some((t) => !t.lyricsVersion || !t.musicGenerationId) || !artifacts.contentDnaVersion || !artifacts.scriptureId || !artifacts.packagingVersion;
  if (invalid) throw new Error('Publicación bloqueada: el conjunto de artefactos ya no coincide con la revisión aprobada. Vuelve a evaluar.');

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
