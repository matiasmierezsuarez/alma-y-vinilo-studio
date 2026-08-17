# Changelog

## 1.0.0 --- Studio 2.0 Final Spec

-   Consolidated research v1--v6.
-   Workspace-first architecture.
-   Content DNA.
-   Scripture propagation.
-   Two sound seeds.
-   Two-character visual DNA.
-   Track planning before lyrics/music.
-   Simplified packaging.
-   Review gate.
-   Publishing snapshots.
-   Analytics.
-   Experiments.
-   Cross-project learning.
-   Research knowledge base.
-   Series/volume catalog.
-   Provider adapters.
-   Versioned artifacts.

Future changes must append entries and explain why the decision changed.

## 2.0.0 --- Phase A (2026-08-15): Backend REST/JSON implementation

-   New application in `ALMAYVINILO_STUDIO2\` (zero-dependency Node HTTP backend, port 3051) built from scratch; v1 stays untouched.
-   Light relational JSON store (`src/db.js`) with 22 tables, artifact versioning (`insertVersioned`) and async jobs (QUEUED/RUNNING/SUCCEEDED/FAILED) with retry.
-   All modules implemented: workspaces (stage progress + blockers), ideas, content-dna (versioned, refinable), scripture (curated catalog, no fabrication), tracks (4-6 plan + approve), lyrics (versioned + approval), music (suno-compatible prompts from seed + controlled modifiers), visual (thumbnail/video direction + master reference), packaging (versioned, formula-driven), review (BLOCKED/READY_FOR_REVIEW/APPROVED gate), publishing (snapshot of exact versions + export package with assets), analytics (immutable snapshots, CSV capture, performance bands), experiments (A/B with significance check), learning (combination = learning unit, REPEAT/EXPAND/TEST/RETIRE), research (KB seeded from benchmark), series/volumes, shorts (DISCOVERY/BRIDGE only).
-   Provider adapters isolate all external AI calls in `src/providers/*`; offline fallbacks let the whole flow run without Ollama/OpenRouter.
-   Sound prompts constrained: DNA moments/emotions are mapped to the allowed Sound modifier vocabulary (e.g. `reading`→`evening`, `joy`→`grateful`) before composing the Suno prompt.
-   `thumbnailTextFor` exported from the visual module and packaging fallback now emits a full thumbnail prompt so the Review gate can verify it.
-   Compliance fields (`rightsMetadata`, `aiDisclosure`) accepted on `PATCH /workspaces/{id}` and enforced by the Review gate.
-   End-to-end smoke test passes: idea → DNA → scripture → tracks → lyrics → music → visual → packaging → review (APPROVED) → publish (PUBLISHED) → export package (tracks + thumbnail + assets) → analytics → experiments → learning → research → series/shorts.

## 2.1.0 --- Phase M (2026-08-15): Frontend shell + launchers

-   `index.html` + `styles.css` + `app.js`: single-page shell, one main decision per screen, NEXT advances / EDIT returns, stage rail with progress and blockers always visible, raw prompts hidden behind collapsible details.
-   All stages wired to the REST API: workspaces, idea, DNA (develop/refine), scripture candidates/select, track plan/approve, lyrics generate/approve, music prompt + asset registration, visual thumbnail + asset + master reference, packaging, review (checklist + compliance + approve), publish (snapshot + export package), analytics (immutable snapshot + performance), learn (patterns + diversity + recommended next workspace).
-   Toggle "IA / sin IA" in the top bar: generation calls include `offline:true` when off for a fast path; providers still fall back on error when on.
-   LLM generation timeout reduced to 120s (configurable via `ALMA_STUDIO2_LLM_TIMEOUT`) so offline fallbacks engage promptly when the local model is slow or stuck.
-   Launchers: `iniciar.bat` and `start.ps1` for port 3051 (same style as v1; v1 on 3050 untouched).

## 2.2.0 --- 2026-08-15: OpenRouter cloud provider

-   New `config/llm.json` with provider selection: `auto` (local first, cloud fallback), `local` (Ollama only), `cloud` (OpenRouter only); plus `cloudModel`, `ollamaModel` and `timeoutMs`. Defaults to `cloud`.
-   `llm.js` reworked: cloud models no longer limited to `:free` (any OpenRouter id works); in `auto` mode the local attempt is capped at 45s when a cloud key exists so a hung local model falls back fast.
-   Key management: reads `openrouter.key` from the app root or the parent folder (reuses the v1 key); new `POST /api/llm/key` and `DELETE /api/llm/key` endpoints write/remove it.
-   Config endpoints: `GET /api/llm/config`, `PATCH /api/llm/config`, `GET /api/llm/models`.
-   UI: "Config IA" button opens a modal to choose provider, pick cloud/local model (datalists with the live model lists) and manage the OpenRouter key; the "IA" toggle still offers fast offline generation.
-   Verified end-to-end with OpenRouter (`openai/gpt-oss-20b:free`): idea, tracks plan (4), lyrics and packaging all generated through the cloud provider; JSON extraction + controlled-value validation intact.



