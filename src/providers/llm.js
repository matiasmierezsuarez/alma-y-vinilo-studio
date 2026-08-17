'use strict';
/* LLMProvider adapter. Business modules never call vendor APIs directly.
   Providers: Ollama (local) and OpenRouter (cloud, free or paid models).
   Mode 'auto': probe local quickly; if local is unavailable or fails,
   fall back to the cloud when a key is configured. Mode 'local' or
   'cloud' force a single provider. */

const fs = require('fs');
const path = require('path');

const OLLAMA_BASE = process.env.OLLAMA_BASE || 'http://localhost:11434';
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const KEY_FILE = path.join(PROJECT_ROOT, 'openrouter.key');
const KEY_FILES = [KEY_FILE, path.join(PROJECT_ROOT, '..', 'openrouter.key')];

const PREFERRED_CREATIVE = [
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'openai/gpt-oss-20b:free',
];

const config = require('../config');

function readOpenRouterKey() {
  for (const f of KEY_FILES) {
    try { const k = fs.readFileSync(f, 'utf8').trim(); if (k) return k; } catch {}
  }
  return '';
}

function writeOpenRouterKey(key) {
  const k = String(key || '').trim();
  if (!k) throw new Error('La key no puede estar vacía.');
  fs.writeFileSync(KEY_FILE, k + '\n', { encoding: 'utf8' });
  return { configured: true, file: KEY_FILE };
}

/* a cloud model id contains a '/' (vendor/model, optionally ':free') */
function isCloudModel(model) {
  return typeof model === 'string' && model.includes('/');
}

function providerConfig(opts) {
  const cfg = config.llmConfig();
  const provider = opts.provider || process.env.ALMA_STUDIO2_LLM_PROVIDER || cfg.provider;
  const timeout = Number(opts.timeoutMs) || Number(process.env.ALMA_STUDIO2_LLM_TIMEOUT) || cfg.timeoutMs || 120000;
  return { provider, timeout, cfg };
}

async function listLocalModels() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    return Array.isArray(data.models) ? data.models.map((m) => m.name) : [];
  } catch { return []; }
}

async function listCloudModels() {
  const key = readOpenRouterKey();
  if (!key) return { configured: false, models: [], free: [] };
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: 'Bearer ' + key },
      signal: AbortSignal.timeout(20000),
    });
    const j = await res.json();
    const models = Array.isArray(j.data) ? j.data.map((m) => m.id).sort() : [];
    const free = models.filter((id) => id.endsWith(':free'));
    return { configured: true, models, free };
  } catch { return { configured: true, models: [], free: [] }; }
}

function resolveModel(opts, localModels) {
  if (opts.model) return opts.model;
  const cfg = config.llmConfig();
  if (cfg.ollamaModel && localModels.includes(cfg.ollamaModel)) return cfg.ollamaModel;
  return localModels[0] || '';
}

async function chat(messages, opts = {}) {
  const { provider } = providerConfig(opts);
  if (opts.model && isCloudModel(opts.model)) return cloudChat(messages, opts);
  if (provider === 'cloud') return cloudChat(messages, opts);
  if (provider === 'local') return ollamaChat(messages, opts);

  /* auto: local first, cloud as fallback */
  const localModels = await listLocalModels();
  if (!localModels.length) {
    if (readOpenRouterKey()) return cloudChat(messages, opts);
    throw new Error('No hay modelo local disponible. Instala uno con: ollama pull qwen3:8b');
  }
  if (!readOpenRouterKey()) return ollamaChat(messages, opts);
  /* cloud is available: cap the local attempt so a hung/slow local
     model does not block the request for too long */
  try {
    return await ollamaChat(Object.assign({}, opts, { timeoutMs: Math.min(providerConfig(opts).timeout, 45000) }), messages);
  } catch (e) {
    return cloudChat(messages, opts);
  }
}

async function ollamaChat(messages, opts = {}) {
  const { timeout, cfg } = providerConfig(opts);
  const localModels = await listLocalModels();
  const model = resolveModel(opts, localModels);
  if (!model) throw new Error('No hay modelo local disponible. Instala uno con: ollama pull qwen3:8b');
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false, options: { temperature: opts.temperature ?? 0.8 } }),
    signal: AbortSignal.timeout(timeout),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en Ollama');
  return data.message.content;
}

async function cloudChat(messages, opts = {}) {
  const { timeout } = providerConfig(opts);
  const key = readOpenRouterKey();
  if (!key) throw new Error('Falta la key de OpenRouter. Pégala en Configuración IA o crea openrouter.key junto a la app.');
  const candidates = [];
  if (opts.model) candidates.push(opts.model);
  const cfg = config.llmConfig();
  if (cfg.cloudModel && !candidates.includes(cfg.cloudModel)) candidates.push(cfg.cloudModel);
  const cloud = await listCloudModels();
  const sortedFree = cloud.free.slice().sort((a, b) => {
    const ai = PREFERRED_CREATIVE.indexOf(a);
    const bi = PREFERRED_CREATIVE.indexOf(b);
    const va = ai >= 0 ? ai : PREFERRED_CREATIVE.length + 1;
    const vb = bi >= 0 ? bi : PREFERRED_CREATIVE.length + 1;
    return va - vb;
  });
  sortedFree.forEach((m) => { if (!candidates.includes(m)) candidates.push(m); });
  if (!candidates.length) throw new Error('No hay modelos de OpenRouter disponibles. Revisa la key.');
  const retryable = [400, 401, 404, 429];
  let lastErr = null;
  for (const m of candidates) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key,
          'HTTP-Referer': 'http://localhost:3051',
          'X-Title': 'Alma y Vinilo Studio 2',
        },
        body: JSON.stringify({ model: m, messages, stream: false, temperature: opts.temperature ?? 0.8 }),
        signal: AbortSignal.timeout(timeout),
      });
      const data = await res.json();
      if (res.ok) {
        const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (content) return content;
        lastErr = 'La nube devolvió una respuesta vacía';
        continue;
      }
      lastErr = (data.error && data.error.message) || data.error || res.statusText;
      if (!retryable.includes(res.status)) break;
    } catch (e) {
      lastErr = String(e);
      break;
    }
  }
  throw new Error('Ningún modelo de OpenRouter respondió. ' + (lastErr || 'Revisa la key y los límites.'));
}

function extractJSON(text) {
  let s = String(text || '');
  s = s.replace(/```(?:json)?/gi, '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  const candidate = s.slice(start, end + 1);
  try { return JSON.parse(candidate); } catch {}
  /* try to repair truncated arrays */
  const repaired = candidate.replace(/,\s*([\]}])/g, '$1');
  try { return JSON.parse(repaired); } catch { return null; }
}

async function json(messages, opts = {}) {
  const text = await chat(messages, opts);
  const parsed = extractJSON(text);
  if (parsed === null) {
    const err = new Error('La IA no devolvió JSON válido.');
    err.raw = text;
    throw err;
  }
  return parsed;
}

async function status() {
  const [local, cloud] = await Promise.all([listLocalModels(), listCloudModels()]);
  return {
    provider: config.llmConfig().provider,
    cloudModel: config.llmConfig().cloudModel,
    ollamaModel: config.llmConfig().ollamaModel,
    keyConfigured: cloud.configured,
    local,
    cloud,
  };
}

module.exports = { chat, json, extractJSON, listLocalModels, listCloudModels, readOpenRouterKey, writeOpenRouterKey, status, isCloudModel };
