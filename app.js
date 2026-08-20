'use strict';

/* Alma y Vinilo Studio 2 - frontend shell.
   One screen = one main decision. NEXT advances, EDIT returns.
   Status and blockers always visible. Workspace is the primary container. */

const API = '';

let state = {
  workspaces: [],
  wsId: null,
  stages: [],
  idx: 0,
};

let OFFLINE = false;

/* generation calls: use the local AI when the toggle is ON, else the
   fast offline fallback already built into the modules */
function genBody(extra) {
  return Object.assign({ offline: OFFLINE }, extra || {});
}

const EXTRA_STAGES = [
  { id: 'analytics', label: 'Analytics' },
  { id: 'learn', label: 'Aprender' },
];

function $(sel, root) { return (root || document).querySelector(sel); }

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toast(msg, isErr) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), 2600);
}

async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Error de servidor');
  return data;
}

async function withBusy(label, fn) {
  $('#nav-hint').textContent = label + '…';
  try {
    const r = await fn();
    $('#nav-hint').textContent = '';
    return r;
  } catch (e) {
    toast(String(e.message || e), true);
    $('#nav-hint').textContent = '';
    throw e;
  }
}

/* ------------------------------------------------ impact confirmation */

function impactItems(preview, kind) {
  const items = (preview.affectedArtifacts || []).filter((item) => item.impact === kind);
  return items.length ? items.slice(0, 8).map((item) => `<li>${esc(item.type)} · ${esc(item.id)}</li>`).join('') : '<li>Sin artefactos activos</li>';
}

function showImpactConfirmation({ title, preview, onConfirm }) {
  return new Promise((resolve, reject) => {
    const modal = document.createElement('div');
    modal.className = 'modal impact-modal';
    const stages = (preview.affectedStages || []).map((stage) => esc(stage)).join(', ');
    const directCount = preview.projectedConsequences ? preview.projectedConsequences.directCount : 0;
    const indirectCount = preview.projectedConsequences ? preview.projectedConsequences.indirectCount : 0;
    modal.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="impact-title">
        <div class="modal-head"><h3 id="impact-title">Impacto de la modificación</h3></div>
        <div class="modal-body">
          <p>Vas a modificar: <strong>${esc(title)}</strong>.</p>
          <p class="hint">${directCount} directo(s), ${indirectCount} indirecto(s). Etapas: ${stages || 'ninguna'}.</p>
          <div class="impact-columns">
            <section><h4>Directamente afectado</h4><ul>${impactItems(preview, 'direct')}</ul></section>
            <section><h4>Indirectamente afectado</h4><ul>${impactItems(preview, 'indirect')}</ul></section>
          </div>
          <p class="hint">Esta es una simulación: no se modificó ningún dato.</p>
          <p class="impact-error" hidden></p>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" type="button" data-impact-cancel>Cancelar</button>
          <button class="btn btn-primary" type="button" data-impact-confirm>Confirmar cambio</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('[data-impact-cancel]').onclick = () => { close(); resolve(false); };
    modal.querySelector('[data-impact-confirm]').onclick = async (event) => {
      const button = event.currentTarget;
      if (button.disabled) return;
      button.disabled = true;
      button.textContent = 'Confirmando…';
      try {
        await onConfirm();
        close();
        resolve(true);
      } catch (error) {
        button.disabled = false;
        button.textContent = 'Confirmar cambio';
        const message = modal.querySelector('.impact-error');
        message.hidden = false;
        message.textContent = String(error.message || error);
        reject(error);
      }
    };
  });
}

async function confirmImpactChange({ type, title, mutate }) {
  try {
    const preview = await api('POST', `/workspaces/${state.wsId}/lineage/impact-preview`, { type });
    if (!preview.impactCount) return mutate();
    return showImpactConfirmation({ title, preview, onConfirm: mutate });
  } catch (error) {
    toast(String(error.message || error), true);
    return false;
  }
}

/* ---------------------------------------------------------------- health */

async function checkHealth() {
  const el = $('#api-status');
  try {
    const h = await api('GET', '/health');
    el.textContent = 'servidor OK';
    el.className = 'api-status ok';
  } catch {
    el.textContent = 'servidor caído';
    el.className = 'api-status err';
  }
}

/* ------------------------------------------------------------- workspaces */

async function loadWorkspaces() {
  state.workspaces = (await api('GET', '/workspaces')).workspaces || [];
}

function renderWorkspaceList() {
  const app = $('#app');
  if (!state.workspaces.length) {
    app.innerHTML = `
      <section class="screen">
        <h2>Bienvenido a Alma y Vinilo Studio 2</h2>
        <p class="empty">Todavía no hay workspaces. Crea el primero para empezar un video.</p>
        <button id="btn-create-first" class="btn btn-primary" type="button">Crear primer workspace</button>
      </section>`;
    $('#btn-create-first').onclick = () => createWorkspace();
    return;
  }
  const cards = state.workspaces.map((w) => `
    <div class="ws-card" data-wsid="${w.id}">
      <button class="ws-del" data-del="${w.id}" title="Eliminar workspace">✕</button>
      <h3>${esc(w.name)}</h3>
      <div class="meta">${w.id} · ${esc(new Date(w.createdAt).toLocaleString())}</div>
      <div class="prog"><span style="width:${w.progress || 0}%"></span></div>
      <span class="status ${esc(w.reviewStatus || '')}">${esc(w.reviewStatus || w.status)}</span>
      <span class="status">${w.progress || 0}%</span>
    </div>`).join('');
  app.innerHTML = `
    <section class="screen">
      <h2>Workspaces</h2>
      <div class="workspace-list">${cards}</div>
      <button id="btn-create-first" class="btn btn-primary" type="button">Nuevo workspace</button>
    </section>`;
  $('#btn-create-first').onclick = () => createWorkspace();
  document.querySelectorAll('.ws-card').forEach((c) => {
    c.onclick = () => openWorkspace(c.dataset.wsid);
  });
  document.querySelectorAll('.ws-del').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.del;
      const ws = state.workspaces.find((x) => x.id === id);
      if (!window.confirm(`¿Eliminar el workspace "${ws ? ws.name : id}" y todo su contenido? Esta acción no se puede deshacer.`)) return;
      deleteWorkspace(id);
    };
  });
}

async function deleteWorkspace(id) {
  try {
    await api('DELETE', '/workspaces/' + id);
    toast('Workspace eliminado');
    await loadWorkspaces();
    renderWorkspaceList();
  } catch (e) { toast(String(e.message || e), true); }
}

async function createWorkspace() {
  try {
    const r = await api('POST', '/workspaces', { name: 'Video ' + (state.workspaces.length + 1) });
    toast('Workspace creado');
    state.workspaces.push(r.workspace);
    openWorkspace(r.workspace.id);
  } catch (e) { toast(String(e.message || e), true); }
}

async function openWorkspace(wsId) {
  state.wsId = wsId;
  await loadWorkspace();
  renderStage();
}

function goHome() {
  state.wsId = null;
  state.ws = null;
  state.stages = [];
  state.idx = 0;
  renderWorkspaceList();
}

async function loadWorkspace() {
  const ws = (await api('GET', '/workspaces/' + state.wsId)).workspace;
  const serverStages = ws.stages || [];
  state.stages = serverStages.concat(EXTRA_STAGES);
  state.ws = ws;
  const i = serverStages.findIndex((s) => !s.done);
  state.idx = i >= 0 ? i : state.stages.length - 1;
}

/* --------------------------------------------------------------- stage UI */

function renderStage() {
  const ws = state.ws;
  const stage = state.stages[state.idx];
  if (!stage) return;

  const rail = state.stages.map((s, i) => {
    const serverDone = s.id !== 'analytics' && s.id !== 'learn' ? s.done : (s.id === 'analytics' ? (ws.progress >= 100) : false);
    const cls = [
      i === state.idx ? 'active' : '',
      serverDone ? 'done' : '',
    ].filter(Boolean).join(' ');
    return `<li class="${cls}" data-i="${i}"><span class="dot"></span>${esc(s.label)}</li>`;
  }).join('');

  const app = $('#app');
  app.innerHTML = `
    <section class="screen stage-screen">
      <aside class="stage-rail">
        <button id="btn-home" class="btn btn-ghost rail-home" type="button">◀ Inicio</button>
        <div class="rail-title">${esc(ws.name)}</div>
        <ol class="stage-list">${rail}</ol>
        <div class="rail-status" id="rail-status"></div>
      </aside>
      <div class="stage-body">
        <div class="stage-head">
          <h2 id="stage-title"></h2>
          <p id="stage-subtitle"></p>
        </div>
        <div id="stage-content" class="stage-content"></div>
        <div class="stage-nav">
          <button id="btn-back" class="btn btn-ghost" type="button">◀ EDIT</button>
          <div class="nav-hint" id="nav-hint"></div>
          <button id="btn-next" class="btn btn-primary" type="button">NEXT ▶</button>
        </div>
      </div>
    </section>`;

  $('#stage-title').textContent = stage.label;
  $('#stage-subtitle').textContent = subtitleFor(stage.id, ws);

  document.querySelectorAll('.stage-list li').forEach((li) => {
    li.onclick = () => { state.idx = Number(li.dataset.i); renderStage(); };
  });

  $('#btn-back').onclick = () => {
    if (state.idx > 0) { state.idx--; renderStage(); }
  };
  $('#btn-home').onclick = () => goHome();
  $('#btn-next').onclick = () => {
    if (state.idx < state.stages.length - 1) { state.idx++; renderStage(); }
  };

  renderStageContent(stage);
  renderRailStatus();
}

function subtitleFor(id, ws) {
  const map = {
    idea: 'La idea define momento, necesidad y emoción.',
    dna: 'Fija el escenario visual y la fórmula del canal.',
    scripture: 'Elige la base bíblica aprobada. El sistema nunca inventa citas.',
    tracks: 'El plan de 4–6 tracks se decide antes que letras o música.',
    lyrics: 'Cada track aprobado recibe letras versionadas.',
    music: 'Un prompt Suno por track, desde la semilla + modificadores controlados.',
    visual: 'Los dos personajes recurrentes en la miniatura.',
    packaging: 'Título, descripción, texto y tags desde el DNA.',
    review: 'Nada se publica hasta que la revisión pasa.',
    publish: 'Snapshot con las versiones exactas publicadas.',
    analytics: 'Métricas inmutables; el aprendizaje nace de aquí.',
    learn: 'Recomendaciones de combinaciones que funcionan.',
  };
  return map[id] || '';
}

function renderRailStatus() {
  const ws = state.ws;
  let html = `<div class="meta">Progreso: <strong>${ws.progress || 0}%</strong></div>`;
  if (ws.reviewStatus === 'BLOCKED') {
    const b = (ws.blockers || []).length;
    html += `<div class="blockers" style="margin-top:10px"><strong>Revisión bloqueada</strong>${b ? `<ul>${ws.blockers.map((x) => '<li>' + esc(x) + '</li>').join('')}</ul>` : ''}</div>`;
  } else if (ws.reviewStatus) {
    html += `<div style="margin-top:10px">Revisión: <strong>${esc(ws.reviewStatus)}</strong></div>`;
  }
  $('#rail-status').innerHTML = html;
}

/* ----------------------------------------------------------- stage render */

function stageEl(html) { $('#stage-content').innerHTML = html; }

async function renderStageContent(stage) {
  const id = stage.id;
  $('#btn-next').disabled = false;
  if (id === 'idea') return renderIdea();
  if (id === 'dna') return renderDna();
  if (id === 'scripture') return renderScripture();
  if (id === 'tracks') return renderTracks();
  if (id === 'lyrics') return renderLyrics();
  if (id === 'music') return renderMusic();
  if (id === 'visual') return renderVisual();
  if (id === 'packaging') return renderPackaging();
  if (id === 'review') return renderReview();
  if (id === 'publish') return renderPublish();
  if (id === 'analytics') return renderAnalytics();
  if (id === 'learn') return renderLearn();
  renderError('Etapa desconocida: ' + id);
}

function renderError(msg) {
  stageEl(`<div class="blockers"><strong>${esc(msg)}</strong></div>`);
}

/* ---------------------------------------------------------------- idea */

async function renderIdea() {
  const ws = state.ws;
  const ideas = (await api('GET', `/workspaces/${state.wsId}/ideas`)).ideas || [];
  const current = ideas.filter((i) => i.id === ws.ideaId)[0] || ideas[0] || null;

  if (!current) {
    stageEl(`
      <div class="empty">Aún no hay idea. Genera la primera (usa IA si está disponible).</div>
      <div class="row"><button id="btn-gen-idea" class="btn btn-primary" type="button">Generar idea</button></div>`);
    $('#btn-gen-idea').onclick = () => withBusy('Generando idea', async () => {
      await api('POST', `/workspaces/${state.wsId}/ideas`, genBody({}));
      await loadWorkspace();
      renderStage();
    });
    return;
  }

  const used = current.id === ws.ideaId;
  stageEl(`
    <div class="card">
      <h4>${esc(current.title)}</h4>
      <dl class="kv">
        <dt>Momento</dt><dd>${esc(current.moment)}</dd>
        <dt>Necesidad humana</dt><dd>${esc(current.humanNeed)}</dd>
        <dt>Emoción deseada</dt><dd>${esc(current.desiredEmotion)}</dd>
        <dt>Scripture sugerida</dt><dd>${esc(current.suggestedScripture)}</dd>
        <dt>Semilla de sonido</dt><dd>${esc(current.suggestedSoundSeed)}</dd>
        <dt>Racional</dt><dd>${esc(current.rationale)} <span class="badge ${current.generationSource === 'online' ? 'badge-online' : 'badge-offline'}">${current.generationSource === 'online' ? 'generada con IA' : 'generada sin IA'}</span></dd>
      </dl>
      <div class="row">
        <button id="btn-use-idea" class="btn btn-primary" type="button">${used ? 'Idea en uso ✓' : 'Usar esta idea'}</button>
        <button id="btn-new-idea" class="btn btn-ghost" type="button">Otra idea</button>
      </div>
    </div>
    <details class="advanced">
      <summary>Avanzado: JSON crudo</summary>
      <pre>${esc(JSON.stringify(current, null, 2))}</pre>
    </details>`);
  $('#btn-new-idea').onclick = () => withBusy('Generando otra idea', async () => {
    await api('POST', `/workspaces/${state.wsId}/ideas`, genBody({}));
    await loadWorkspace();
    renderStage();
  });
  $('#btn-use-idea').onclick = () => withBusy('Usando idea', async () => {
    await api('POST', `/ideas/${current.id}/use`, {});
    await loadWorkspace();
    renderStage();
  });
  $('#btn-next').disabled = !used;
}

/* ----------------------------------------------------------------- dna */

async function renderDna() {
  const r = await api('GET', `/workspaces/${state.wsId}/content-dna`);
  const dna = r.dna;

  if (!dna) {
    stageEl(`
      <div class="empty">Desarrolla el Content DNA a partir de la idea aprobada.</div>
      <div class="row"><button id="btn-dna-dev" class="btn btn-primary" type="button">Desarrollar DNA</button></div>`);
    $('#btn-dna-dev').onclick = () => withBusy('Desarrollando DNA', async () => {
      await api('POST', `/workspaces/${state.wsId}/content-dna`, genBody({ ideaId: state.ws.ideaId }));
      await loadWorkspace();
      renderStage();
    });
    return;
  }

  const props = (dna.visualScenario.props || []).map((p) => `<span class="pill">${esc(p)}</span>`).join('');
  stageEl(`
    <div class="card">
      <h4>Content DNA v${dna.version}</h4>
      <dl class="kv">
        <dt>Momento</dt><dd>${esc(dna.moment)}</dd>
        <dt>Necesidad</dt><dd>${esc(dna.humanNeed)}</dd>
        <dt>Emoción deseada</dt><dd>${esc(dna.desiredEmotion)}</dd>
        <dt>Semilla</dt><dd>${esc(dna.soundSeed)}</dd>
        <dt>Vocal</dt><dd>${esc(dna.vocalMode)}</dd>
        <dt>Fórmula packaging</dt><dd>${esc(dna.packagingFormula)}</dd>
        <dt>Escenario</dt><dd>${esc(dna.visualScenario.location)} · ${esc(dna.visualScenario.time)} · ${esc(dna.visualScenario.activity)}${props ? ' · ' + props : ''}</dd>
      </dl>
      <div class="row">
        <button id="btn-dna-refine" class="btn btn-ghost" type="button">Refinar escenario (EDIT)</button>
      </div>
    </div>
    <details class="advanced">
      <summary>Avanzado: JSON crudo (v${(r.versions || []).length} versiones)</summary>
      <pre>${esc(JSON.stringify(dna, null, 2))}</pre>
    </details>`);
  $('#btn-dna-refine').onclick = () => confirmImpactChange({
    type: 'CONTENT_DNA_CHANGED', title: 'Content DNA', mutate: () => withBusy('Refinando escenario', async () => {
      await api('POST', `/workspaces/${state.wsId}/content-dna/refine`, genBody({}));
      await loadWorkspace();
      renderStage();
    })
  });
  $('#btn-next').disabled = false;
}

/* ------------------------------------------------------------- scripture */

async function renderScripture() {
  const sc = (await api('GET', `/workspaces/${state.wsId}/scripture`)).scripture;
  if (sc) {
    stageEl(`
      <div class="card">
        <h4>Scripture aprobada</h4>
        <dl class="kv">
          <dt>Referencia</dt><dd>${esc(sc.reference)}</dd>
          <dt>Libro</dt><dd>${esc(sc.book)}</dd>
          <dt>Tema</dt><dd>${esc(sc.theme)}</dd>
          <dt>Momentos</dt><dd>${esc((sc.moments || []).join(', '))}</dd>
        </dl>
        <div class="row"><button id="btn-sc-change" class="btn btn-ghost" type="button">Cambiar (EDIT)</button></div>
      </div>`);
    $('#btn-sc-change').onclick = () => renderScriptureCandidates();
    $('#btn-next').disabled = false;
    return;
  }
  renderScriptureCandidates();
}

async function renderScriptureCandidates() {
  const r = await api('POST', `/workspaces/${state.wsId}/scripture/candidates`, {});
  const cands = r.candidates || [];
  stageEl(`
    <p>Candidatos para la necesidad y momento del workspace. Elige uno.</p>
    <div id="sc-list"></div>`);
  const list = $('#sc-list');
  if (!cands.length) {
    list.innerHTML = '<div class="empty">Sin candidatos. Desarrolla primero el DNA.</div>';
    return;
  }
  cands.forEach((c) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <h4>${esc(c.reference)} — ${esc(c.theme)}</h4>
      <dl class="kv">
        <dt>Libro</dt><dd>${esc(c.book)}</dd>
        <dt>Momentos</dt><dd>${esc((c.moments || []).join(', '))}</dd>
      </dl>
      <button class="btn btn-primary" type="button">Elegir</button>`;
    el.querySelector('button').onclick = () => confirmImpactChange({
      type: 'SCRIPTURE_CHANGED', title: `Scripture ${c.reference}`, mutate: () => withBusy('Seleccionando', async () => {
        await api('POST', `/workspaces/${state.wsId}/scripture/select`, { reference: c.reference });
        await loadWorkspace();
        renderStage();
      })
    });
    list.appendChild(el);
  });
}

/* --------------------------------------------------------------- tracks */

async function renderTracks() {
  const r = await api('GET', `/workspaces/${state.wsId}/tracks`);
  const tracks = r.tracks || [];
  const approved = tracks.filter((t) => t.status === 'APPROVED');

  if (!tracks.length) {
    stageEl(`
      <div class="empty">Genera el plan de 4–6 tracks. Letras y música vienen después.</div>
      <div class="row"><button id="btn-plan" class="btn btn-primary" type="button">Crear plan de tracks</button></div>`);
    $('#btn-plan').onclick = () => confirmImpactChange({
      type: 'TRACK_PLAN_CHANGED', title: 'Plan de tracks', mutate: () => withBusy('Creando plan', async () => {
        await api('POST', `/workspaces/${state.wsId}/tracks/plan`, genBody({}));
        await loadWorkspace();
        renderStage();
      })
    });
    return;
  }

  const rows = tracks.map((t) => {
    const checked = t.status === 'APPROVED' ? 'checked disabled' : 'checked';
    return `
    <tr>
      <td><input type="checkbox" class="tk-check" data-id="${t.id}" ${checked}></td>
      <td>${t.number}</td>
      <td>${esc(t.title)}</td>
      <td>${esc(t.emotionalEnd)}</td>
      <td>${esc(t.scriptureReference)}</td>
      <td>${esc(t.status)}</td>
    </tr>`;
  }).join('');

  stageEl(`
    <table class="data">
      <thead><tr><th></th><th>#</th><th>Título</th><th>Emoción</th><th>Scripture</th><th>Estado</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="hint">Marca los tracks que quieres conservar. Los demás se regeneran.</p>
    <div class="row">
      <button id="btn-appr" class="btn btn-primary" type="button">Aprobar seleccionados (${tracks.length})</button>
      <button id="btn-replan" class="btn btn-ghost" type="button">Regenerar no aprobados</button>
    </div>`);
  $('#btn-appr').onclick = () => withBusy('Aprobando', async () => {
    const ids = Array.from(document.querySelectorAll('.tk-check:checked:not(:disabled)')).map((c) => c.dataset.id);
    await api('POST', `/workspaces/${state.wsId}/tracks/approve`, { ids });
    await loadWorkspace();
    renderStage();
  });
  $('#btn-replan').onclick = () => confirmImpactChange({
    type: 'TRACK_PLAN_CHANGED', title: 'Plan de tracks', mutate: () => withBusy('Replanificando', async () => {
      await api('POST', `/workspaces/${state.wsId}/tracks/plan`, genBody({}));
      await loadWorkspace();
      renderStage();
    })
  });
  $('#btn-next').disabled = !approved.length;
}

/* --------------------------------------------------------------- lyrics */

async function renderLyrics() {
  const tracks = ((await api('GET', `/workspaces/${state.wsId}/tracks`)).tracks || []).filter((t) => t.status === 'APPROVED');
  if (!tracks.length) {
    stageEl('<div class="empty">Primero aprueba el plan de tracks.</div>');
    $('#btn-next').disabled = true;
    return;
  }

  const blocks = [];
  for (const t of tracks) {
    const r = await api('GET', `/tracks/${t.id}/lyrics`);
    const latest = r.latest;
    const approved = latest && latest.status === 'APPROVED';
    const status = approved ? '<span class="pill good">aprobada</span>' : (latest ? '<span class="pill warn">borrador</span>' : '');
    blocks.push(`
      <div class="card">
        <h4>${t.number}. ${esc(t.title)} ${status}</h4>
        ${latest ? `<dl class="kv"><dt>Versión</dt><dd>v${latest.version}</dd><dt>Longitud</dt><dd>${latest.lyrics ? latest.lyrics.length : 0} caracteres</dd></dl>
          <details><summary>Ver letra</summary><pre style="white-space:pre-wrap;font-family:inherit;background:var(--paper);padding:10px;border-radius:6px;border:1px solid var(--line)">${esc(latest.lyrics)}</pre></details>` : ''}
        <div class="row">
          <button data-act="gen" data-tid="${t.id}" class="btn btn-primary" type="button">${latest ? 'Regenerar letra' : 'Generar letra'}</button>
          ${latest && !approved ? `<button data-act="appr" data-tid="${t.id}" data-ver="${latest.version}" class="btn btn-ghost" type="button">Aprobar v${latest.version}</button>` : ''}
        </div>
      </div>`);
  }

  stageEl(`<p>Letras versionadas por track. Aprueba cada una antes de pasar a música.</p>${blocks.join('')}`);
  document.querySelectorAll('#stage-content [data-act="gen"]').forEach((b) => {
    b.onclick = () => withBusy('Generando letra', async () => {
      await api('POST', `/tracks/${b.dataset.tid}/lyrics`, genBody({}));
      renderStage();
    });
  });
  document.querySelectorAll('#stage-content [data-act="appr"]').forEach((b) => {
    b.onclick = () => withBusy('Aprobando', async () => {
      await api('POST', `/tracks/${b.dataset.tid}/lyrics/${b.dataset.ver}/approve`, {});
      await loadWorkspace();
      renderStage();
    });
  });

  $('#btn-next').disabled = false;
}

/* ---------------------------------------------------------------- music */

async function renderMusic() {
  const tracks = ((await api('GET', `/workspaces/${state.wsId}/tracks`)).tracks || []).filter((t) => t.status === 'APPROVED');
  if (!tracks.length) {
    stageEl('<div class="empty">Primero aprueba el plan de tracks.</div>');
    $('#btn-next').disabled = true;
    return;
  }

  const blocks = [];
  for (const t of tracks) {
    const r = await api('GET', `/tracks/${t.id}/music`);
    const gens = r.generations || [];
    const gen = gens[gens.length - 1] || null;
    const hasAsset = !!(gen && gen.assetUrl);
    blocks.push(`
      <div class="card">
        <h4>${t.number}. ${esc(t.title)} ${hasAsset ? '<span class="pill good">audio registrado</span>' : ''}</h4>
        ${gen ? `<dl class="kv"><dt>Semilla</dt><dd>${esc(gen.seed)}</dd><dt>Estado</dt><dd>${esc(gen.status)}</dd></dl>
          <details class="advanced"><summary>Prompt Suno (avanzado)</summary><pre>${esc(gen.prompt)}</pre></details>` : '<div class="empty">Sin generación.</div>'}
        <div class="row">
          <button data-act="gen" data-tid="${t.id}" class="btn btn-primary" type="button">${gen ? 'Re-generar prompt' : 'Generar prompt'}</button>
          ${gen && gen.id ? `<input data-act="url" data-gid="${gen.id}" data-tid="${t.id}" type="url" placeholder="https://cdn.suno.com/track.mp3" value="${esc(gen.assetUrl || '')}">
          <button data-act="reg" data-gid="${gen.id}" data-tid="${t.id}" class="btn btn-ghost" type="button">Registrar audio</button>` : ''}
        </div>
      </div>`);
  }

  stageEl(`<p>Un prompt Suno por track. Copia el prompt a Suno y pega la URL del audio generado.</p>${blocks.join('')}`);

  document.querySelectorAll('#stage-content [data-act="gen"]').forEach((b) => {
    b.onclick = () => withBusy('Generando prompt de sonido', async () => {
      await api('POST', `/tracks/${b.dataset.tid}/music`, {});
      renderStage();
    });
  });
  document.querySelectorAll('#stage-content [data-act="reg"]').forEach((b) => {
    b.onclick = () => {
      const input = $(`#stage-content input[data-gid="${b.dataset.gid}"]`);
      const url = input.value.trim();
      if (!url) { toast('Pega la URL del audio', true); return; }
      withBusy('Registrando audio', async () => {
        await api('POST', `/tracks/${b.dataset.tid}/music/${b.dataset.gid}/asset`, { assetUrl: url });
        renderStage();
      });
    };
  });

  const anyAssets = tracks.some(() => true);
  $('#btn-next').disabled = false;
}

/* ---------------------------------------------------------------- visual */

async function renderVisual() {
  const r = await api('GET', `/workspaces/${state.wsId}/visual`);
  const assets = r.assets || [];
  const last = assets[assets.length - 1] || null;
  const refs = (await api('GET', '/visual/references')).references || [];
  const master = refs.filter((x) => x.role === 'THUMBNAIL_MASTER').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;

  stageEl(`
    <div class="card">
      <h4>Miniatura (T2)</h4>
      ${last ? `<dl class="kv">
        <dt>Formato</dt><dd>${esc(last.format)}</dd>
        <dt>Texto</dt><dd>${esc(last.thumbnailText)}</dd>
        <dt>Activo</dt><dd>${last.assetUrl ? '<a href="' + esc(last.assetUrl) + '" target="_blank">' + esc(last.assetUrl) + '</a>' : '<span class="empty">sin registrar</span>'}</dd>
      </dl>
      <details class="advanced"><summary>Prompt del generador (avanzado)</summary><pre>${esc(last.prompt)}</pre></details>
      <details class="advanced"><summary>Dirección visual del video</summary><pre>${esc(last.videoVisualDirection)}</pre></details>` : '<div class="empty">Sin miniatura aún.</div>'}
      <div class="row">
        <button data-act="gen" class="btn btn-primary" type="button">Generar prompt de miniatura</button>
        ${last ? `<input data-act="url" type="url" placeholder="https://…/miniatura.png" value="${esc(last.assetUrl || '')}">
        <button data-act="reg" data-id="${last.id}" class="btn btn-ghost" type="button">Registrar imagen</button>` : ''}
      </div>
    </div>
    <div class="card">
      <h4>Referencia maestra</h4>
      <dl class="kv">
        <dt>Estado</dt><dd>${master ? (master.locked ? 'bloqueada' : 'sin bloquear') : 'no configurada'}</dd>
        ${master ? `<dt>URL</dt><dd>${esc(master.assetUrl)}</dd>` : ''}
      </dl>
    </div>`);

  $('#stage-content [data-act="gen"]').onclick = () => withBusy('Generando miniatura', async () => {
    await api('POST', `/workspaces/${state.wsId}/visual/thumbnail`, genBody({ format: 'T2' }));
    renderStage();
  });
  const reg = $('#stage-content [data-act="reg"]');
  if (reg) {
    reg.onclick = () => {
      const input = $('#stage-content input[data-act="url"]');
      const url = input.value.trim();
      if (!url) { toast('Pega la URL de la imagen', true); return; }
      withBusy('Registrando imagen', async () => {
        await api('POST', `/workspaces/${state.wsId}/visual/${reg.dataset.id}/asset`, { assetUrl: url });
        renderStage();
      });
    };
  }
  $('#btn-next').disabled = false;
}

/* -------------------------------------------------------------- packaging */

async function renderPackaging() {
  const r = await api('GET', `/workspaces/${state.wsId}/packaging`);
  const pkg = r.latest;

  if (!pkg) {
    stageEl(`
      <div class="empty">Genera el packaging: título, descripción, texto de miniatura y tags.</div>
      <div class="row"><button id="btn-pkg" class="btn btn-primary" type="button">Generar packaging</button></div>`);
    $('#btn-pkg').onclick = () => withBusy('Generando packaging', async () => {
      await api('POST', `/workspaces/${state.wsId}/packaging`, genBody({}));
      await loadWorkspace();
      renderStage();
    });
    return;
  }

  stageEl(`
    <div class="card">
      <h4>Packaging v${pkg.version} · ${esc(pkg.formula)}</h4>
      <dl class="kv">
        <dt>Título</dt><dd>${esc(pkg.title)}</dd>
        <dt>Texto miniatura</dt><dd>${esc(pkg.thumbnailText)}</dd>
        <dt>Tags</dt><dd>${(pkg.tags || []).map((x) => '<span class="pill">' + esc(x) + '</span>').join('')}</dd>
      </dl>
      <details><summary>Descripción</summary><pre style="white-space:pre-wrap;font-family:inherit;background:var(--paper);padding:10px;border-radius:6px;border:1px solid var(--line)">${esc(pkg.description)}</pre></details>
      <details class="advanced"><summary>Prompt de miniatura (avanzado)</summary><pre>${esc(pkg.thumbnailPrompt)}</pre></details>
      <div class="row"><button id="btn-pkg2" class="btn btn-ghost" type="button">Regenerar (EDIT)</button></div>
    </div>`);
  $('#btn-pkg2').onclick = () => withBusy('Regenerando', async () => {
    await api('POST', `/workspaces/${state.wsId}/packaging`, genBody({}));
    await loadWorkspace();
    renderStage();
  });
  $('#btn-next').disabled = false;
}

/* ---------------------------------------------------------------- review */

async function renderReview() {
  const r = await api('POST', `/workspaces/${state.wsId}/review`, {});
  const review = r.review;
  const items = review.items || [];
  const fails = items.filter((i) => !i.pass);
  const passes = items.filter((i) => i.pass);

  stageEl(`
    ${fails.length ? `<div class="blockers"><strong>Bloqueado por ${fails.length} ítem(s)</strong><ul>${fails.map((i) => '<li>' + esc(i.label) + ': ' + esc(i.detail) + '</li>').join('')}</ul></div>` : '<div class="card"><h4>✓ Listo para revisión</h4></div>'}
    <div class="card">
      <h4>Compliance</h4>
      <div class="field"><label>Metadatos de derechos / fuente</label><input id="f-rights" type="text" value="${esc(state.ws.rightsMetadata || '')}" placeholder="Música generada con IA bajo dirección humana; letras del equipo"></div>
      <label class="field" style="display:flex;gap:8px;align-items:center"><input id="f-ai" type="checkbox" ${state.ws.aiDisclosure ? 'checked' : ''}> Divulgar uso de IA en la publicación</label>
      <button id="btn-save-compliance" class="btn btn-ghost" type="button">Guardar compliance</button>
    </div>
    <div class="card">
      <h4>Checklist (${passes.length}/${items.length})</h4>
      ${items.map((i) => `<div class="review-item ${i.pass ? 'pass' : 'fail'}"><span class="mark">${i.pass ? '✓' : '✗'}</span><div><strong>${esc(i.label)}</strong><br>${esc(i.detail)}</div></div>`).join('')}
    </div>`);

  $('#btn-save-compliance').onclick = () => withBusy('Guardando compliance', async () => {
    await api('PATCH', `/workspaces/${state.wsId}`, {
      rightsMetadata: $('#f-rights').value.trim(),
      aiDisclosure: $('#f-ai').checked,
    });
    await loadWorkspace();
    renderStage();
  });

  $('#btn-next').disabled = review.status !== 'READY_FOR_REVIEW' && review.status !== 'APPROVED';
  if (review.status === 'READY_FOR_REVIEW') {
    $('#btn-next').textContent = 'APROBAR ✓';
    $('#btn-next').onclick = () => withBusy('Aprobando revisión', async () => {
      await api('POST', `/workspaces/${state.wsId}/review/approve`, {});
      await loadWorkspace();
      renderStage();
    });
  } else if (review.status === 'APPROVED') {
    $('#btn-next').textContent = 'NEXT ▶';
    $('#btn-next').disabled = false;
  } else {
    $('#btn-next').textContent = 'NEXT ▶';
    $('#btn-next').disabled = true;
  }
}

/* --------------------------------------------------------------- publish */

async function renderPublish() {
  const ws = state.ws;
  let snapshot = null;
  try {
    const r = await api('GET', `/workspaces/${state.wsId}/publish`);
    const hist = r.history || [];
    snapshot = hist[hist.length - 1] || null;
  } catch { /* not published yet */ }

  if (snapshot) {
    stageEl(`
      <div class="card">
        <h4>Publicado ✓</h4>
        <dl class="kv">
          <dt>Video</dt><dd>${esc(snapshot.youtubeVideoId || snapshot.url || '—')}</dd>
          <dt>Divulgación IA</dt><dd>${esc(snapshot.disclosureState || '—')}</dd>
          <dt>Fecha</dt><dd>${esc(new Date(snapshot.createdAt).toLocaleString())}</dd>
          <dt>Título v</dt><dd>v${snapshot.titleVersion ?? '—'}</dd>
          <dt>Miniatura v</dt><dd>v${snapshot.thumbnailVersion ?? '—'}</dd>
        </dl>
        <div class="row"><button id="btn-pkg-export" class="btn btn-ghost" type="button">Ver paquete de exportación</button></div>
      </div>`);
    $('#btn-pkg-export').onclick = async () => {
      try {
        const p = (await api('GET', `/workspaces/${state.wsId}/publish/package`)).package;
        toast('Paquete exportado: ' + p.package.title);
        console.log('EXPORT PACKAGE', p);
      } catch (e) { toast(String(e.message || e), true); }
    };
    $('#btn-next').disabled = false;
    return;
  }

  stageEl(`
    ${ws.reviewStatus !== 'APPROVED' ? '<div class="blockers"><strong>Publicación bloqueada:</strong> la revisión debe estar APPROVED.</div>' : ''}
    <div class="card">
      <h4>Publicar</h4>
      <div class="field"><label>URL de YouTube (opcional)</label><input id="f-url" type="url" placeholder="https://youtu.be/…"></div>
      <div class="field"><label>ID del video (opcional)</label><input id="f-vid" type="text" placeholder="abc123"></div>
      <div class="row"><button id="btn-pub" class="btn btn-primary" type="button">Publicar snapshot</button></div>
    </div>`);
  $('#btn-pub').onclick = () => withBusy('Publicando', async () => {
    await api('POST', `/workspaces/${state.wsId}/publish`, {
      url: $('#f-url').value.trim(),
      youtubeVideoId: $('#f-vid').value.trim(),
    });
    await loadWorkspace();
    renderStage();
  });
  $('#btn-next').disabled = ws.reviewStatus !== 'APPROVED';
}

/* -------------------------------------------------------------- analytics */

async function renderAnalytics() {
  const perf = (await api('GET', `/workspaces/${state.wsId}/analytics/performance`)).performance;
  const metrics = (perf && perf.metrics) || [];
  const rows = metrics.map((m) => `<tr><td>${esc(m.metric)}</td><td>${esc(m.value)}</td><td><span class="pill ${m.label === 'NORMAL' || m.label === 'STRONG' ? 'good' : 'warn'}">${esc(m.label)}</span></td><td>${esc(m.band || '—')}</td></tr>`).join('');

  stageEl(`
    <div class="card">
      <h4>Registrar métrica (inmutable)</h4>
      <div class="field"><label>Ventana</label>
        <select id="f-kind">
          <option value="7d">Últimos 7 días</option>
          <option value="28d">Últimos 28 días</option>
          <option value="90d">Últimos 90 días</option>
          <option value="all">Total</option>
        </select></div>
      <div class="row">
        <div class="field" style="flex:1"><label>Vistas</label><input id="f-views" type="number" min="0"></div>
        <div class="field" style="flex:1"><label>CTR %</label><input id="f-ctr" type="number" step="0.1" min="0"></div>
        <div class="field" style="flex:1"><label>Likes</label><input id="f-likes" type="number" min="0"></div>
        <div class="field" style="flex:1"><label>Comentarios</label><input id="f-comments" type="number" min="0"></div>
      </div>
      <div class="row"><button id="btn-snap" class="btn btn-primary" type="button">Capturar snapshot</button></div>
    </div>
    <div class="card">
      <h4>Rendimiento</h4>
      ${rows ? `<table class="data"><thead><tr><th>Métrica</th><th>Valor</th><th>Estado</th><th>Banda</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">Sin métricas aún.</div>'}
    </div>`);

  $('#btn-snap').onclick = () => withBusy('Capturando', async () => {
    const num = (s) => { const v = parseFloat(s.value); return isNaN(v) ? 0 : v; };
    await api('POST', `/workspaces/${state.wsId}/analytics/snapshot`, {
      kind: $('#f-kind').value,
      views: num($('#f-views')),
      ctr: num($('#f-ctr')),
      likes: num($('#f-likes')),
      comments: num($('#f-comments')),
    });
    toast('Snapshot capturado');
    renderStage();
  });
  $('#btn-next').disabled = false;
}

/* ----------------------------------------------------------------- learn */

async function renderLearn() {
  const patterns = (await api('POST', '/learning/recommendations', {})).patterns || [];
  const div = (await api('GET', `/learning/diversity/${state.wsId}`)).diversity || {};

  const rows = patterns.map((p) => `
    <tr>
      <td>${esc(p.combination.moment)}</td>
      <td>${esc(p.combination.need)}</td>
      <td>${esc(p.combination.scriptureReference)}</td>
      <td>${esc(p.combination.soundSeed)}</td>
      <td>${esc(p.performanceIndex != null ? p.performanceIndex.toFixed(2) : '—')}</td>
      <td>${esc(p.recommendation)}</td>
      <td>${p.evidenceCount}</td>
    </tr>`).join('');

  stageEl(`
    <div class="card">
      <h4>Diversidad de combinaciones</h4>
      <dl class="kv">
        <dt>Flag</dt><dd>${div.flag ? '<span class="pill warn">' + esc(div.flag) + '</span>' : 'sin repetir'}</dd>
        <dt>Combinaciones similares</dt><dd>${div.count || 0}</dd>
        <dt>Adyacentes sugeridos</dt><dd>${(div.adjacent || []).join(', ') || '—'}</dd>
      </dl>
    </div>
    <div class="card">
      <h4>Patrones de combinaciones que funcionan</h4>
      ${rows ? `<table class="data"><thead><tr><th>Momento</th><th>Necesidad</th><th>Scripture</th><th>Semilla</th><th>Índice</th><th>Recomendación</th><th>n</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">Aún no hay patrones: el aprendizaje necesita datos de Analytics.</div>'}
      <div class="row">
        <button id="btn-next-ws" class="btn btn-primary" type="button">Siguiente workspace con recomendación</button>
      </div>
    </div>`);

  $('#btn-next-ws').onclick = () => withBusy('Creando siguiente workspace', async () => {
    const ws = (await api('POST', '/workspaces', { name: 'Video recomendado' })).workspace;
    const rec = await api('POST', `/workspaces/${ws.id}/ideas/recommended`, genBody({}));
    toast('Workspace creado: ' + (rec.idea ? rec.idea.title : 'con recomendación'));
    await loadWorkspaces();
    openWorkspace(ws.id);
  });
  $('#btn-next').disabled = false;
}

/* ------------------------------------------------------------- llm config */

function openLlmModal() {
  const modal = $('#llm-modal');
  modal.hidden = false;
  loadLlmConfig();
}

function closeLlmModal() {
  $('#llm-modal').hidden = true;
}

async function loadLlmConfig() {
  const st = await api('GET', '/api/llm/config');
  const cfg = st.config;
  $('#f-provider').value = cfg.provider;
  $('#f-cloud').value = cfg.cloudModel || '';
  $('#f-ollama').value = cfg.ollamaModel || '';
  $('#f-key').value = '';
  $('#dl-cloud').innerHTML = (cfg.cloud.models || []).map((m) => `<option value="${esc(m)}">`).join('');
  $('#dl-local').innerHTML = (cfg.local || []).map((m) => `<option value="${esc(m)}">`).join('');

  const localTxt = (cfg.local || []).length ? (cfg.local || []).join(', ') : 'no detectado';
  const cloudTxt = st.keyConfigured ? ((cfg.cloud.free || []).length + ' modelos :free · ' + ((cfg.cloud.models || []).length) + ' en total') : 'falta la key';
  $('#llm-status').innerHTML =
    `<div>Proveedor actual: <strong>${esc(cfg.provider)}</strong></div>` +
    `<div>Key OpenRouter: ${st.keyConfigured ? '<span class="ok">configurada</span>' : '<span class="bad">no configurada</span>'}</div>` +
    `<div>Modelos locales: ${esc(localTxt)}</div>` +
    `<div>Modelos nube: ${esc(cloudTxt)}</div>`;
}

async function saveLlmConfig() {
  try {
    await api('PATCH', '/api/llm/config', {
      provider: $('#f-provider').value,
      cloudModel: $('#f-cloud').value.trim(),
      ollamaModel: $('#f-ollama').value.trim(),
    });
    toast('Configuración de IA guardada');
    closeLlmModal();
    checkHealth();
  } catch (e) { toast(String(e.message || e), true); }
}

async function saveLlmKey() {
  const key = $('#f-key').value.trim();
  if (!key) { toast('Pega la key de OpenRouter', true); return; }
  try {
    await api('POST', '/api/llm/key', { key });
    toast('Key guardada en openrouter.key');
    $('#f-key').value = '';
    loadLlmConfig();
  } catch (e) { toast(String(e.message || e), true); }
}

async function delLlmKey() {
  try {
    await api('DELETE', '/api/llm/key');
    toast('Key eliminada');
    loadLlmConfig();
  } catch (e) { toast(String(e.message || e), true); }
}

/* ------------------------------------------------------------------ boot */

async function init() {
  $('#btn-nuevo-ws').onclick = () => createWorkspace();
  $('#btn-ai-mode').onchange = (e) => {
    OFFLINE = !e.target.checked;
    toast(OFFLINE ? 'Modo sin IA: generación rápida (offline)' : 'Modo IA: usa el modelo configurado');
  };
  $('#btn-llm-config').onclick = openLlmModal;
  $('#btn-llm-close').onclick = closeLlmModal;
  $('#llm-modal').onclick = (e) => { if (e.target === $('#llm-modal')) closeLlmModal(); };
  $('#btn-llm-save').onclick = saveLlmConfig;
  $('#btn-key-save').onclick = saveLlmKey;
  $('#btn-key-del').onclick = delLlmKey;
  checkHealth();
  setInterval(checkHealth, 15000);
  try {
    await loadWorkspaces();
    renderWorkspaceList();
  } catch (e) {
    $('#app').innerHTML = `<section class="screen"><h2>No se pudo conectar con el servidor</h2><p class="empty">${esc(e.message || e)}. Ejecuta iniciar.bat y recarga.</p></section>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
