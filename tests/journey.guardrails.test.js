const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
const server = fs.readFileSync(require('path').join(__dirname, '..', 'server.js'), 'utf8');

assert.ok(app.includes('function setJourneyGuard('), 'app.js must centralize NEXT state through setJourneyGuard');
assert.ok(app.includes("stage: 'lyrics'"), 'Lyrics must declare a journey guard');
assert.ok(app.includes("stage: 'music'"), 'Music must declare a journey guard');
assert.ok(app.includes("stage: 'visual'"), 'Visual must declare a journey guard');
assert.ok(/track\.workspaceId[\s\S]{0,160}re\[2\]/.test(server), 'Music asset route must pass the Track workspaceId to music.recordAsset');
assert.ok(!server.includes('music.recordAsset(null, re[2], body || {})'), 'Music asset route must not pass null workspaceId');

console.log('Journey guardrails contract passed');
