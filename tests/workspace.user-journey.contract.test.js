'use strict';

/* Layer 8.2: journey contract without external browser dependencies.
   This is intentionally a source-level acceptance gate for the static UI.
   It verifies that every canonical stage has a renderer and that every
   user action required by the journey still points at a public API route.
   Real browser automation remains a separate concern until a browser
   runner is added to the repository. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const stages = [
  ['idea', 'renderIdea'],
  ['dna', 'renderDna'],
  ['scripture', 'renderScripture'],
  ['tracks', 'renderTracks'],
  ['lyrics', 'renderLyrics'],
  ['music', 'renderMusic'],
  ['visual', 'renderVisual'],
  ['packaging', 'renderPackaging'],
  ['review', 'renderReview'],
  ['publish', 'renderPublish'],
];

for (const [id, renderer] of stages) {
  assert.ok(app.includes(`if (id === '${id}') return ${renderer}();`), `Missing renderer wiring for stage: ${id}`);
  assert.ok(app.includes(`function ${renderer}()`), `Missing renderer function: ${renderer}`);
}

for (const id of ['stage-list', 'stage-content', 'btn-back', 'btn-next']) {
  assert.ok(html.includes(`id="${id}"`) || app.includes(`id="${id}"`), `Missing journey shell control: ${id}`);
}

const requiredActions = [
  '/workspaces',
  '/ideas/',
  '/content-dna',
  '/scripture/select',
  '/tracks/plan',
  '/lyrics',
  '/music',
  '/visual/thumbnail',
  '/packaging',
  '/review',
  '/publish',
];

for (const route of requiredActions) {
  assert.ok(app.includes(route), `UI does not call canonical action route fragment: ${route}`);
  assert.ok(server.includes(route), `Server does not expose canonical action route fragment: ${route}`);
}

/* Music asset registration is a lineage-sensitive action. The UI must send
   both trackId and generationId, and the server contract must not discard
   the track identity before entering the music module. */
assert.ok(app.includes('/music/${b.dataset.gid}/asset'), 'Music asset registration action missing from UI');
assert.ok(server.includes('music.recordAsset('), 'Music asset registration route missing from server');

console.log('Layer 8.2 user journey contract passed');
