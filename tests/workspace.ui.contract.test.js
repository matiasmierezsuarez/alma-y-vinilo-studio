'use strict';

/*
 * Layer 8 — UI journey contract.
 *
 * This is intentionally dependency-free: the project currently ships no browser
 * automation runner. The test protects the minimum public UI contract while the
 * API acceptance suite protects the workflow semantics.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function mustInclude(source, value, message) {
  assert.ok(source.includes(value), message || `Missing ${value}`);
}

// The browser shell must expose the progressive workspace journey.
mustInclude(index, 'id="screen-workspaces"');
mustInclude(index, 'id="stage-shell"');
mustInclude(index, 'id="stage-list"');
mustInclude(index, 'id="stage-content"');
mustInclude(index, 'id="btn-back"');
mustInclude(index, 'id="btn-next"');
mustInclude(index, '<script src="app.js"></script>');

// The client must still contain all workflow domain anchors. These assertions
// deliberately avoid styling details and protect navigation/domain capability.
[
  'idea',
  'content-dna',
  'scripture',
  'track',
  'lyrics',
  'music',
  'visual',
  'packaging',
  'review',
  'publish'
].forEach((domain) => {
  assert.ok(app.toLowerCase().includes(domain), `UI contract lost workflow domain: ${domain}`);
});

// A journey UI must surface lineage/invalid state to the user instead of only
// enforcing it silently in the backend.
assert.ok(/stale|invalid|review|ready/i.test(app), 'UI must expose workflow validity state');

console.log('workspace.ui.contract.test.js: PASS');
