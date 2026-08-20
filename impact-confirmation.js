'use strict';

/* Layer 9.2 UI orchestration.
   This file deliberately does not own domain mutations. It previews impact,
   asks for confirmation, and then calls the existing route exactly once. */
(function () {
  let confirming = false;
  let currentWorkspaceId = null;
  const originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const match = url.match(/\/workspaces\/([^/?#]+)/);
    if (match) currentWorkspaceId = decodeURIComponent(match[1]);
    return originalFetch(input, init);
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function ensureModal() {
    let modal = document.getElementById('impact-confirmation-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'impact-confirmation-modal';
    modal.className = 'modal';
    modal.hidden = true;
    modal.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="impact-confirmation-title">'
      + '<div class="modal-head"><h3 id="impact-confirmation-title">Impacto de la modificación</h3></div>'
      + '<div id="impact-confirmation-body" class="modal-body"></div>'
      + '<div class="modal-foot"><button id="impact-cancel" class="btn btn-ghost" type="button">Cancelar</button><button id="impact-confirm" class="btn btn-primary" type="button">Confirmar cambio</button></div>'
      + '</div>';
    document.body.appendChild(modal);
    return modal;
  }

  function impactList(title, items) {
    if (!items || !items.length) return '';
    return '<section><h4>' + esc(title) + '</h4><ul>' + items.map(function (item) {
      return '<li>' + esc(item.label || item.title || item.type || item.stage || item.id || String(item)) + '</li>';
    }).join('') + '</ul></section>';
  }

  function showImpactConfirmation(preview) {
    if (!preview || !(preview.impactCount > 0)) return Promise.resolve(true);
    const modal = ensureModal();
    const body = document.getElementById('impact-confirmation-body');
    const direct = preview.directImpact || [];
    const indirect = preview.indirectImpact || [];
    const stages = preview.affectedStages || [];
    body.innerHTML = '<p>Este cambio afectará <strong>' + esc(preview.impactCount) + '</strong> artefacto(s) downstream.</p>'
      + (stages.length ? '<p><strong>Etapas afectadas:</strong> ' + stages.map(esc).join(', ') + '</p>' : '')
      + impactList('Directamente afectados', direct)
      + impactList('Indirectamente afectados', indirect);
    modal.hidden = false;
    return new Promise(function (resolve) {
      const cancel = document.getElementById('impact-cancel');
      const confirm = document.getElementById('impact-confirm');
      function close(result) {
        modal.hidden = true;
        cancel.onclick = null;
        confirm.onclick = null;
        resolve(result);
      }
      cancel.onclick = function () { if (!confirming) close(false); };
      confirm.onclick = function () {
        if (confirming) return;
        confirming = true;
        confirm.disabled = true;
        confirm.textContent = 'Confirmando…';
        close(true);
      };
    });
  }

  async function refreshWorkspaceUI() {
    await window.loadWorkspace();
    window.renderStage();
  }

  async function runWithImpact(options) {
    const preview = await window.api(options.previewMethod || 'POST', options.previewPath, options.previewBody);
    const proceed = await showImpactConfirmation(preview);
    if (!proceed) return { cancelled: true };
    const result = await window.api(options.method, options.path, options.body);
    await refreshWorkspaceUI();
    return result;
  }

  function wsId() { return currentWorkspaceId; }

  document.addEventListener('click', function (event) {
    const target = event.target.closest('button');
    if (!target || !wsId() || confirming) return;
    let config = null;
    if (target.id === 'btn-dna-refine') {
      config = { previewMethod: 'PATCH', previewPath: '/workspaces/' + wsId() + '/content-dna?preview=1', previewBody: {}, method: 'POST', path: '/workspaces/' + wsId() + '/content-dna/refine', body: window.genBody({}) };
    } else if (target.closest('#sc-list')) {
      const card = target.closest('.card');
      const reference = card && card.querySelector('h4') ? card.querySelector('h4').textContent.split('—')[0].trim() : null;
      if (!reference) return;
      config = { previewPath: '/workspaces/' + wsId() + '/scripture/select?preview=1', previewBody: { reference: reference }, method: 'POST', path: '/workspaces/' + wsId() + '/scripture/select', body: { reference: reference } };
    } else if (target.id === 'btn-replan') {
      config = { previewPath: '/workspaces/' + wsId() + '/tracks/plan?preview=1', previewBody: {}, method: 'POST', path: '/workspaces/' + wsId() + '/tracks/plan', body: window.genBody({}) };
    }
    if (!config) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    confirming = true;
    runWithImpact(config).catch(function (error) {
      if (window.toast) window.toast(String(error && error.message || error), true);
    }).finally(function () { confirming = false; });
  }, true);

  window.showImpactConfirmation = showImpactConfirmation;
  window.runWithImpactConfirmation = runWithImpact;
}());
