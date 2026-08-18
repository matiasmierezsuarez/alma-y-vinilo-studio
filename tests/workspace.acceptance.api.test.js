'use strict';

/* Acceptance Layer: exercise the public REST API, not direct db inserts.
   External providers remain deterministic: ideas/lyrics/visual run offline and
   Suno/thumbnail outputs are registered through the real asset endpoints. */

const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = 39000 + Math.floor(Math.random() * 1000);
const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alma-acceptance-'));
const base = `http://127.0.0.1:${port}`;
let child;

async function request(method, pathname, body) {
  const res = await fetch(base + pathname, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${pathname}: ${data.error || res.status}`);
  return data;
}

async function waitForServer() {
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    try { await request('GET', '/health'); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('Acceptance server did not start.');
}

async function buildCurrentArtifactSet(workspaceId) {
  const idea = (await request('POST', `/workspaces/${workspaceId}/ideas`, { offline: true })).idea;
  await request('POST', `/ideas/${idea.id}/use`);
  await request('POST', `/workspaces/${workspaceId}/content-dna`, { ideaId: idea.id });

  const candidates = (await request('POST', `/workspaces/${workspaceId}/scripture/candidates`, { offline: true })).candidates;
  const selected = candidates[0];
  const sc = (await request('POST', `/workspaces/${workspaceId}/scripture/select`, { reference: selected.reference || selected })).scripture;

  const planned = (await request('POST', `/workspaces/${workspaceId}/tracks/plan`, { offline: true })).tracks;
  const approved = (await request('POST', `/workspaces/${workspaceId}/tracks/approve`, { ids: planned.map((t) => t.id) })).tracks;

  for (const track of approved) {
    const lyric = (await request('POST', `/tracks/${track.id}/lyrics`, { offline: true })).lyric;
    await request('POST', `/tracks/${track.id}/lyrics/${lyric.version}/approve`);
    const job = (await request('POST', `/tracks/${track.id}/music`, {})).job;
    const generationId = job.result ? job.result.generationId : job.generationId;
    assert(generationId, 'music generation id required');
    await request('POST', `/tracks/${track.id}/music/${generationId}/asset`, { assetUrl: `https://example.test/audio/${track.id}.mp3`, duration: 180, providerGenerationId: `acceptance-${track.id}` });
  }

  const visual = (await request('POST', `/workspaces/${workspaceId}/visual/thumbnail`, { offline: true })).asset;
  await request('POST', `/workspaces/${workspaceId}/visual/${visual.id}/asset`, { assetUrl: `https://example.test/thumb/${workspaceId}.jpg` });
  await request('POST', `/workspaces/${workspaceId}/packaging`, { offline: true });
  return { scripture: sc, tracks: approved };
}

async function reviewApprovePublish(workspaceId, suffix) {
  const evaluated = (await request('POST', `/workspaces/${workspaceId}/review`, {})).review;
  assert.strictEqual(evaluated.status, 'READY_FOR_REVIEW', `review must be ready, blockers: ${JSON.stringify(evaluated.items.filter((i) => !i.pass))}`);
  const approved = (await request('POST', `/workspaces/${workspaceId}/review/approve`, {})).review;
  assert.strictEqual(approved.status, 'APPROVED');
  return (await request('POST', `/workspaces/${workspaceId}/publish`, { youtubeVideoId: `acceptance-${suffix}`, url: `https://youtube.example/${suffix}` })).snapshot;
}

(async () => {
  child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: Object.assign({}, process.env, { PORT: String(port), ALMA_STUDIO2_STATE_DIR: stateDir }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer();

  const ws = (await request('POST', '/workspaces', {
    name: 'Acceptance lineage workspace', rightsMetadata: 'owned/generated assets', aiDisclosure: true,
  })).workspace;
  // rights/compliance fields are intentionally updated through the public Workspace API.
  await request('PATCH', `/workspaces/${ws.id}`, { rightsMetadata: 'owned/generated assets', aiDisclosure: true });

  const first = await buildCurrentArtifactSet(ws.id);
  const snapshotA = await reviewApprovePublish(ws.id, 'a');
  assert.strictEqual(snapshotA.artifacts.scriptureId, first.scripture.id);

  // Mutate through the real upstream endpoint.
  const candidates = (await request('POST', `/workspaces/${ws.id}/scripture/candidates`, { offline: true })).candidates;
  const alternative = candidates.find((c) => (c.reference || c) !== first.scripture.reference) || candidates[1];
  const scriptureB = (await request('POST', `/workspaces/${ws.id}/scripture/select`, { reference: alternative.reference || alternative })).scripture;
  assert.notStrictEqual(scriptureB.id, first.scripture.id);

  const reviewAfterMutation = (await request('GET', `/workspaces/${ws.id}/review`)).latest;
  assert.strictEqual(reviewAfterMutation.status, 'INVALIDATED');
  const tracksAfterMutation = (await request('GET', `/workspaces/${ws.id}/tracks`)).tracks;
  assert(tracksAfterMutation.some((t) => t.status === 'STALE' || t.status === 'SUPERSEDED'));

  let blocked = false;
  try { await request('POST', `/workspaces/${ws.id}/publish`, { youtubeVideoId: 'must-not-publish' }); }
  catch { blocked = true; }
  assert(blocked, 'publish must be blocked after upstream mutation');

  const second = await buildCurrentArtifactSet(ws.id);
  const snapshotB = await reviewApprovePublish(ws.id, 'b');
  assert.strictEqual(snapshotB.artifacts.scriptureId, second.scripture.id);
  assert.notStrictEqual(snapshotA.id, snapshotB.id);

  const history = (await request('GET', `/workspaces/${ws.id}/publish`)).history;
  assert.strictEqual(history.length, 2);
  assert.strictEqual(history[0].artifacts.scriptureId, first.scripture.id, 'snapshot A must remain immutable');
  assert.strictEqual(history[1].artifacts.scriptureId, second.scripture.id, 'snapshot B must use rebuilt lineage');

  console.log('workspace acceptance API test passed');
})().catch((err) => {
  console.error(err.stack || err);
  process.exitCode = 1;
}).finally(() => {
  if (child) child.kill();
  try { fs.rmSync(stateDir, { recursive: true, force: true }); } catch {}
});
