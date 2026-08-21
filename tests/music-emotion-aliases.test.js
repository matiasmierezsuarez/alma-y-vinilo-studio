'use strict';

const assert = require('assert');
const music = require('../src/modules/music');

for (const emotion of ['vulnerability', 'vulnerable', 'fear', 'anxiety', 'sadness', 'guilt', 'anger']) {
  const prompt = music.compose('SEED_A_JAZZ_VINYL', { emotion });
  assert.match(prompt, /Emotion: reflective/);
}

assert.match(music.compose('SEED_A_JAZZ_VINYL', { emotion: 'gratitude' }), /Emotion: grateful/);
console.log('music emotion alias tests: OK');
