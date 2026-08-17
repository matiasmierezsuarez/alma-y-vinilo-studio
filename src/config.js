'use strict';
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const cache = {};

function load(name) {
  if (cache[name]) return cache[name];
  const file = path.join(CONFIG_DIR, name);
  try {
    cache[name] = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    cache[name] = {};
  }
  return cache[name];
}

function save(name, data) {
  const file = path.join(CONFIG_DIR, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  cache[name] = data;
  return data;
}

function soundSeeds() { return load('sound-seeds.json'); }
function visualDna() { return load('visual-dna.json'); }
function packagingFormulas() { return load('packaging-formulas.json'); }
function experimentRules() { return load('experiment-rules.json'); }

function llmConfig() {
  const c = load('llm.json');
  return {
    provider: ['auto', 'local', 'cloud'].includes(c.provider) ? c.provider : 'auto',
    cloudModel: String(c.cloudModel || ''),
    ollamaModel: String(c.ollamaModel || ''),
    timeoutMs: Number(c.timeoutMs) > 0 ? Number(c.timeoutMs) : 120000,
  };
}

function saveLlmConfig(patch) {
  const cur = load('llm.json');
  const next = Object.assign({}, cur, patch);
  save('llm.json', next);
  return llmConfig();
}

function seedById(id) {
  const seeds = soundSeeds().seeds || {};
  return seeds[id] || null;
}

module.exports = { load, save, soundSeeds, visualDna, packagingFormulas, experimentRules, seedById, llmConfig, saveLlmConfig };
