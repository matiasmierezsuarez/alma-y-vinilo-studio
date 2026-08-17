'use strict';
/* Publish Engine - publishing is blocked unless Review status is
   APPROVED. Provider-agnostic. Records the exact artifact versions used
   in a publication snapshot. Also exports a publication package for
   manual upload when no publishing provider credentials exist. */

const db = require('../db');
const publishingProvider = require('../providers/publishing');
const review = require('./review');
const packaging = require('./packaging');
const dnaModule = require('./content-dna');
const scripture = require('./scripture');
const tracks = require('./tracks');

function publish(workspaceId, input = {}) {
  const ws = db.get('workspaces', workspaceId);
  if (!ws) throw new Error('Workspace no encontrado.');
  const rev = review.latest(workspaceId);
  if (!rev || rev.status !== 'APPROVED') {
    throw new Error('Publicación bloqueada: la revisión debe estar APPROVED.');
  }
  const pkg = packaging.latest(workspaceId);
  const dna = dnaModule.getLatest(workspaceId);
  const snap = publishingProvider.recordPublication(workspaceId, {
    youtubeVideoId: input.youtubeVideoId || '',
    url: input.url || '',
    publishDate: input.publishDate || new Date().toISOString(),
    playlist: input.playlist || '',
    series: ws.seriesId || '',
    disclosureState: ws.aiDisclosure ? 'declared' : 'not_set',
    titleVersion: pkg ? pkg.version : null,
    thumbnailVersion: (db.where('visual_assets', (v) => v.workspaceId === workspaceId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).pop() || {}).version || null,
    descriptionVersion: pkg ? pkg.version : null,
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
  const thumbnails = db.where('visual_assets', (v) => v.workspaceId === workspaceId);
  const latestThumb = thumbnails.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).pop() || null;
  const musicAssets = db.where('music_generations', (m) => m.workspaceId === workspaceId && m.status === 'SUCCEEDED');

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
