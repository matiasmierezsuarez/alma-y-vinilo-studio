'use strict';
/* Alma y Vinilo Studio 2 - server entry. REST/JSON API on port 3051.
   Business logic lives in src/modules/*; all external AI calls go
   through src/providers/*. */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 3051;
const STATE_DIR = process.env.ALMA_STUDIO2_STATE_DIR || path.join('C:', 'Users', 'Public', 'Alma y Vinilo Studio 2');
const STATE_FILE = path.join(STATE_DIR, 'studio2.json');

const db = require('./src/db');
db.init(STATE_FILE);

const llm = require('./src/providers/llm');
const music = require('./src/modules/music');
const visual = require('./src/modules/visual');
const scripture = require('./src/modules/scripture');
const dnaModule = require('./src/modules/content-dna');
const ideas = require('./src/modules/ideas');
const tracks = require('./src/modules/tracks');
const lyrics = require('./src/modules/lyrics');
const packaging = require('./src/modules/packaging');
const review = require('./src/modules/review');
const publishing = require('./src/modules/publishing');
const analytics = require('./src/modules/analytics');
const experiments = require('./src/modules/experiments');
const learning = require('./src/modules/learning');
const research = require('./src/modules/research');
const series = require('./src/modules/series');
const shorts = require('./src/modules/shorts');
const workspaces = require('./src/modules/workspaces');
const config = require('./src/config');
const impactPreview = require('./src/modules/impact-preview');

const CANONICAL_ACTION_ROUTE_FRAGMENTS = ['/ideas/', '/scripture/select', '/tracks/plan', '/visual/thumbnail'];

/* Seed the research KB from the bundled benchmark summary. */
try { research.seedBenchmarks(); } catch {}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
  return true;
}

function ok(res, data) { return json(res, 200, data); }
function fail(res, e) { return json(res, 400, { ok: false, error: String(e && e.message || e) }); }

async function handler(req, res, url, body) {
  const p = url.pathname;
  let re;
  const m = (re2) => p.match(re2);
  const seg = (i, re2) => m(re2) && m(re2)[i];

  /* ---- workspaces ---- */
  if (p === '/health') return ok(res, { ok: true, app: 'alma-y-vinilo-studio2', db: STATE_FILE });
  if (p === '/workspaces' && req.method === 'POST') return ok(res, { workspace: workspaces.create(body || {}) });
  if (p === '/workspaces' && req.method === 'GET') return ok(res, { workspaces: workspaces.list() });
  if ((re = m(/^\/workspaces\/([^/]+)$/))) {
    const id = re[1];
    if (req.method === 'GET') { const ws = workspaces.get(id); return ws ? ok(res, { workspace: ws }) : fail(res, new Error('Workspace no encontrado.')); }
    if (req.method === 'PATCH') return ok(res, { workspace: workspaces.update(id, body || {}) });
    if (req.method === 'DELETE') { const removed = workspaces.remove(id); return removed ? ok(res, { removed: true }) : fail(res, new Error('Workspace no encontrado.')); }
  }

  /* ---- ideas ---- */
  if ((re = m(/^\/workspaces\/([^/]+)\/ideas\/recommended$/))) {
    if (req.method === 'POST') {
      try { return ok(res, await learning.recommendNext(re[1], Object.assign({ offline: !!(body && body.offline) }, body || {}))); }
      catch (e) { return fail(res, e); }
    }
  }
  if ((re = m(/^\/workspaces\/([^/]+)\/ideas$/))) {
    if (req.method === 'POST') {
      try { return ok(res, { idea: await ideas.generate(Object.assign({ workspaceId: re[1], offline: !!(body && body.offline) }, body || {})) }); }
      catch (e) { return fail(res, e); }
    }
    if (req.method === 'GET') return ok(res, { ideas: ideas.list(re[1]) });
  }
  if ((re = m(/^\/ideas\/([^/]+)\/use$/)) && req.method === 'POST') return ok(res, { idea: ideas.markUsed(re[1]) });

  /* ---- content dna ---- */
  if ((re = m(/^\/workspaces\/([^/]+)\/content-dna\/refine$/)) && req.method === 'POST') {
    try { return ok(res, { dna: await dnaModule.refineVisualScenario(re[1], body || {}) }); }
    catch (e) { return fail(res, e); }
  }
  if ((re = m(/^\/workspaces\/([^/]+)\/content-dna$/))) {
    const id = re[1];
    if (req.method === 'POST') {
      try { return ok(res, { dna: dnaModule.develop(id, body && body.ideaId, body || {}) }); }
      catch (e) { return fail(res, e); }
    }
    if (req.method === 'PATCH') {
      try { return ok(res, { dna: dnaModule.edit(id, body || {}) }); }
      catch (e) { return fail(res, e); }
    }
    if (req.method === 'GET') return ok(res, { dna: dnaModule.getLatest(id), versions: dnaModule.versions(id) });
  }

  /* ---- scripture ---- */
  if ((re = m(/^\/workspaces\/([^/]+)\/scripture\/candidates$/)) && req.method === 'POST') {
    return ok(res, { candidates: scripture.candidates(re[1], body || {}) });
  }
  if ((re = m(/^\/workspaces\/([^/]+)\/scripture\/select$/)) && req.method === 'POST') {
    try { return ok(res, { scripture: scripture.select(re[1], body && body.reference, body || {}) }); }
    catch (e) { return fail(res, e); }
  }
  if ((re = m(/^\/workspaces\/([^/]+)\/scripture$/)) && req.method === 'GET') {
    return ok(res, { scripture: scripture.getApproved(re[1]), all: scripture.forWorkspace(re[1]) });
  }

  /* ---- lineage impact preview (strictly read-only) ---- */
  if ((re = m(/^\/workspaces\/([^/]+)\/lineage\/impact-preview$/)) && req.method === 'POST') {
    try {
      const workspaceId = re[1];
      const type = body && body.type;
      let change = { type };
      if (type === 'CONTENT_DNA_CHANGED') {
        const current = dnaModule.getLatest(workspaceId);
        if (current) change = { type, sourceArtifactId: current.id, sourceVersion: current.version };
      } else if (type === 'SCRIPTURE_CHANGED') {
        const current = scripture.getApproved(workspaceId);
        if (current) change = { type, sourceArtifactId: current.id, sourceVersion: current.id };
      } else if (type === 'TRACK_PLAN_CHANGED') {
        const currentVersion = tracks.currentPlanVersion(workspaceId);
        change = { type, sourceVersion: currentVersion || null };
      }
      return ok(res, impactPreview.computeImpactPreview(workspaceId, change));
    } catch (e) { return fail(res, e); }
  }

  /* ---- tracks ---- */
  if ((re = m(/^\/workspaces\/([^/]+)\/tracks\/plan$/)) && req.method === 'POST' && url.searchParams.get('preview') === '1') {
    const workspaceId = re[1];
    const sourceVersion = tracks.currentPlanVersion(workspaceId);
    return ok(res, impactPreview.computeImpactPreview(workspaceId, { type: 'TRACK_PLAN_CHANGED', sourceVersion }));
  }
  if ((re = m(/^\/workspaces\/([^/]+)\/tracks\/plan$/)) && req.method === 'POST') {
    try { return ok(res, { tracks: await tracks.plan(re[1], body || {}) }); }
    catch (e) { return fail(res, e); }
  }
  if ((re = m(/^\/workspaces\/([^/]+)\/tracks\/approve$/)) && req.method === 'POST') {
    return ok(res, { tracks: tracks.approve(re[1], body && body.ids) });
  }
  if ((re = m(/^\/workspaces\/([^/]+)\/tracks$/)) && req.method === 'GET') {
    return ok(res, { tracks: tracks.list(re[1]) });
  }

  /* ---- lyrics ---- */
  if ((re = m(/^\/tracks\/([^/]+)\/lyrics\/([^/]+)\/approve$/)) && req.method === 'POST') {
    try { return ok(res, { lyric: lyrics.approve(re[1], re[2]) }); }
    catch (e) { return fail(res, e); }
  }
  if ((re = m(/^\/tracks\/([^/]+)\/lyrics$/))) {
    if (req.method === 'POST') {
      try { return ok(res, { lyric: await lyrics.generate(re[1], body || {}) }); }
      catch (e) { return fail(res, e); }
    }
    if (req.method === 'GET') return ok(res, { versions: lyrics.versionsForTrack(re[1]), latest: lyrics.latestForTrack(re[1]) });
  }

  /* ---- music ---- */
  if ((re = m(/^\/tracks\/([^/]+)\/music\/([^/]+)\/asset$/)) && req.method === 'POST') {
    try {
      const track = tracks.get(re[1]);
      if (!track) return fail(res, new Error('Track no encontrado.'));
      return ok(res, { generation: music.recordAsset(track.workspaceId, re[2], body || {}) });
    }
    catch (e) { return fail(res, e); }
  }
  if ((re = m(/^\/tracks\/([^/]+)\/music$/))) {
    if (req.method === 'POST') {
      const track = tracks.get(re[1]);
      if (!track) return fail(res, new Error('Track no encontrado.'));
      return ok(res, { job: await music.generateForTrack(track.workspaceId, re[1], body || {}) });
    }
    if (req.method === 'GET') return ok(res, { generations: music.listForTrack(re[1]) });
  }

  /* ---- visual ---- */
  if ((re = m(/^\/workspaces\/([^/]+)\/visual\/([^/]+)\/asset$/)) && req.method === 'POST') {
    try { return ok(res, { asset: visual.recordAsset(re[2], body || {}) }); }
    catch (e) { return fail(res, e); }
  }
  if ((re = m(/^\/workspaces\/([^/]+)\/visual\/thumbnail$/)) && req.method === 'POST') {
    try { return ok(res, { asset: await visual.generate(re[1], body || {}) }); }
    catch (e) { return fail(res, e); }
  }
  if ((re = m(/^\/workspaces\/([^/]+)\/visual$/)) && req.method === 'GET') {
    return ok(res, { assets: visual.listForWorkspace(re[1]) });
  }
  if ((re = m(/^\/visual\/references\/([^/]+)\/lock$/)) && req.method === 'POST') {
    return ok(res, { reference: visual.setMasterLocked(re[1], body && body.locked) });
  }
  if (p === '/visual/references' && req.method === 'GET') return ok(res, { references: visual.getReferences() });
  if (p === '/visual/references' && req.method === 'POST') return ok(res, { reference: visual.setReference(body || {}) });

  /* ---- packaging ---- */
  if ((re = m(/^\/workspaces\/([^/]+)\/packaging$/))) {
    if (req.method === 'POST') {
      try { return ok(res, { packaging: await packaging.generate(re[1], body || {}) }); }
      catch (e) { return fail(res, e); }
    }
    if (req.method === 'GET') return ok(res, { versions: packaging.versions(re[1]), latest: packaging.latest(re[1]) });
  }

  /* ---- review ---- */
  if ((re = m(/^\/workspaces\/([^/]+)\/review\/approve$/)) && req.method === 'POST') {
    try { return ok(res, { review: review.approve(re[1]) }); }
    catch (e) { return fail(res, e); }
  }
  if ((re = m(/^\/workspaces\/([^/]+)\/review\/reject$/)) && req.method === 'POST') {
    return ok(res, { review: review.reject(re[1], body && body.note) });
  }
  if ((re = m(/^\/workspaces\/([^/]+)\/review$/))) {
    if (req.method === 'POST') {
      try { return ok(res, { review: review.evaluate(re[1]) }); }
      catch (e) { return fail(res, e); }
    }
    if (req.method === 'GET') return ok(res, { history: review.status(re[1]), latest: review.latest(re[1]) });
  }

  /* ---- publishing ---- */
  if ((re = m(/^\/workspaces\/([^/]+)\/publish\/package$/)) && req.method === 'GET') {
    return ok(res, { package: publishing.exportPackage(re[1]) });
  }
  if ((re = m(/^\/workspaces\/([^/]+)\/publish$/))) {
    if (req.method === 'POST') {
      try { return ok(res, { snapshot: publishing.publish(re[1], body || {}) }); }
      catch (e) { return fail(res, e); }
    }
    if (req.method === 'GET') return ok(res, { history: publishing.history(re[1]) });
  }

  /* ---- analytics ---- */
  if ((re = m(/^\/workspaces\/([^/]+)\/analytics\/performance$/)) && req.method === 'GET') {
    return ok(res, { performance: analytics.performance(re[1]) });
  }
  if ((re = m(/^\/workspaces\/([^/]+)\/analytics\/link$/)) && req.method === 'GET') {
    return ok(res, { link: analytics.link(re[1]) });
  }
  if ((re = m(/^\/workspaces\/([^/]+)\/analytics\/csv$/)) && req.method === 'POST') {
    try { return ok(res, { snapshot: analytics.captureFromCsv(re[1], (body && body.csv) || '') }); }
    catch (e) { return fail(res, e); }
  }
  if ((re = m(/^\/workspaces\/([^/]+)\/analytics\/snapshot$/)) && req.method === 'POST') {
    return ok(res, { snapshot: analytics.capture(re[1], body || {}) });
  }
  if ((re = m(/^\/workspaces\/([^/]+)\/analytics$/)) && req.method === 'GET') {
    return ok(res, { snapshots: analytics.snapshots(re[1]), performance: analytics.performance(re[1]) });
  }

  /* ---- experiments ---- */
  if (p === '/experiments' && req.method === 'POST') return ok(res, { experiment: experiments.create(body || {}) });
  if (p === '/experiments' && req.method === 'GET') return ok(res, { experiments: experiments.list() });
  if ((re = m(/^\/experiments\/([^/]+)\/complete$/)) && req.method === 'POST') {
    return ok(res, { experiment: experiments.complete(re[1], body || {}) });
  }

  /* ---- learning ---- */
  if (p === '/learning/recommendations' && req.method === 'POST') return ok(res, { patterns: learning.aggregate() });
  if (p === '/learning/patterns' && req.method === 'GET') return ok(res, { patterns: learning.patterns() });
  if ((re = m(/^\/learning\/diversity\/([^/]+)$/)) && req.method === 'GET') return ok(res, { diversity: learning.diversity(re[1]) });

  /* ---- research ---- */
  if (p === '/research/seed' && req.method === 'POST') return ok(res, { result: research.seedBenchmarks(body && body.csv) });
  if (p === '/research/competitors' && req.method === 'GET') return ok(res, { competitors: research.listCompetitors() });
  if (p === '/research/benchmarks' && req.method === 'GET') return ok(res, { benchmarks: research.listBenchmarks() });
  if (p === '/research/patterns' && req.method === 'GET') return ok(res, { patterns: research.listPatterns() });
  if (p === '/research/patterns' && req.method === 'POST') return ok(res, { pattern: research.addPattern(body || {}) });

  /* ---- series ---- */
  if (p === '/series' && req.method === 'POST') return ok(res, { series: series.createSeries(body || {}) });
  if (p === '/series' && req.method === 'GET') return ok(res, { series: series.listSeries() });
  if ((re = m(/^\/series\/([^/]+)\/volumes$/)) && req.method === 'POST') return ok(res, { volume: series.createVolume(Object.assign({ seriesId: re[1] }, body || {})) });
  if ((re = m(/^\/workspaces\/([^/]+)\/assign-series$/)) && req.method === 'POST') return ok(res, { workspace: series.assignWorkspace(re[1], body || {}) });

  /* ---- shorts ---- */
  if (p === '/shorts' && req.method === 'POST') return ok(res, { short: shorts.create(body || {}) });
  if (p === '/shorts' && req.method === 'GET') return ok(res, { shorts: shorts.list(body && body.workspaceId) });
  if ((re = m(/^\/shorts\/([^/]+)$/)) && req.method === 'PATCH') return ok(res, { short: shorts.update(re[1], body || {}) });

  /* ---- config / sound ---- */
  if (p === '/config/sound-seeds' && req.method === 'GET') {
    return ok(res, { seeds: music.seedList(), modifiers: music.modifiers('SEED_A_JAZZ_VINYL'), validation: { ok: 'seed + allowed modifiers only' } });
  }
  if (p === '/config/sound/validate' && req.method === 'POST') {
    return ok(res, { validation: music.validate((body && body.seed) || '', (body && body.mods) || {}) });
  }

  /* ---- jobs ---- */
  if ((re = m(/^\/jobs\/([^/]+)$/))) {
    if (req.method === 'GET') { const j = db.getJob(re[1]); return j ? ok(res, { job: j }) : fail(res, new Error('Job no encontrado.')); }
    if (req.method === 'POST') {
      /* retry without losing the previous attempt */
      const old = db.getJob(re[1]);
      if (!old) return fail(res, new Error('Job no encontrado.'));
      if (old.kind === 'music-generate') {
        const track = tracks.get(old.payload && old.payload.trackId);
        if (!track) return fail(res, new Error('Track no encontrado.'));
        const job = await music.generateForTrack(track.workspaceId, old.payload.trackId, {});
        return ok(res, { job });
      }
      return fail(res, new Error('Tipo de job no re-ejecutable.'));
    }
  }

  /* ---- llm models + config ---- */
  if (p === '/api/llm/models' && req.method === 'GET') {
    const st = await llm.status();
    return ok(res, { local: st.local, cloud: st.cloud, keyConfigured: st.keyConfigured });
  }
  if (p === '/api/llm/config' && req.method === 'GET') {
    const st = await llm.status();
    return ok(res, { config: st, keyConfigured: st.keyConfigured });
  }
  if (p === '/api/llm/config' && req.method === 'PATCH') {
    const cfg = config.saveLlmConfig({
      provider: body && body.provider,
      cloudModel: body && body.cloudModel,
      ollamaModel: body && body.ollamaModel,
      timeoutMs: body && body.timeoutMs,
    });
    return ok(res, { config: cfg });
  }
  if (p === '/api/llm/key' && req.method === 'POST') {
    try { return ok(res, { key: llm.writeOpenRouterKey(body && body.key) }); }
    catch (e) { return fail(res, e); }
  }
  if (p === '/api/llm/key' && req.method === 'DELETE') {
    const fsKey = require('fs');
    const keyFile = path.join(__dirname, 'openrouter.key');
    try { fsKey.unlinkSync(keyFile); } catch {}
    return ok(res, { keyConfigured: !!llm.readOpenRouterKey() });
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost:' + PORT); }
  catch { return json(res, 400, { error: 'Bad request' }); }

  let body = null;
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    try { body = await readBody(req); }
    catch (e) { return json(res, 400, { error: String(e.message || e) }); }
  }

  /* API routes first; if the handler does not know the path it returns
     null and we fall back to static files. */
  try {
    const handled = await handler(req, res, url, body);
    if (handled !== null && handled !== undefined) return;
  } catch (e) { return fail(res, e); }

  /* static files */
  {
    const filePath = path.normalize(path.join(ROOT, url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
    if (!filePath.startsWith(ROOT)) return json(res, 403, { error: 'Forbidden' });
    try {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      return res.end(data);
    } catch { return json(res, 404, { error: 'No encontrado' }); }
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  Alma y Vinilo Studio 2');
  console.log('  ----------------------');
  console.log(`  Abre en tu navegador:  http://localhost:${PORT}`);
  console.log('');
});
