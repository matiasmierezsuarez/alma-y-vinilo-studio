ALMA Y VINILO STUDIO
MASTER IMPLEMENTATION GUIDE

Status: Active
Architecture version: Post Layer 9.1
Next implementation: Layer 9.2 — Edit Impact Confirmation

1. Purpose of this document

This document is the persistent architectural and implementation guide for Alma y Vinilo Studio.

The project is an AI-assisted production workspace for creating Christian music content, with a workflow that evolves through decisions, artifacts, dependencies, reviews, publishing, analytics, and learning.

This document exists to ensure that future implementation work:

preserves the existing architecture;
does not recreate features already implemented;
does not introduce parallel sources of truth;
does not weaken tests to make failures disappear;
preserves Workspace isolation;
preserves Track isolation;
preserves historical publication records;
respects versioning and lineage;
evolves the system incrementally.
2. Critical instruction for AI coding agents

You are continuing an existing software architecture.

DO NOT treat this repository as a greenfield project.

Before modifying any file, you MUST:

Inspect the current repository.
Identify the current branch.
Identify the current implementation state.
Compare the requested Layer with the existing implementation.
Reuse existing domain modules and contracts.
Identify affected tests before changing implementation.
Identify potential regressions.
Create a minimal implementation plan.
Implement incrementally.
Run the complete relevant test suite.
Add regression tests for the new behavior.
Update documentation.
Review the final diff before committing.

The repository represents the current implementation state.

This document defines the architectural direction and invariants.

If the repository and an older specification differ:

Do not blindly overwrite the repository.
Determine whether the repository contains a newer implementation.
Preserve working behavior unless explicitly superseded.
Report discrepancies.
Adapt the requested Layer to the real current architecture.
3. Product mental model

Alma y Vinilo Studio is NOT a collection of independent tabs.

It is a system of connected decisions.

The conceptual flow is:

IDEA
  ↓
CONTENT DNA
  ↓
SCRIPTURE
  ↓
TRACK PLAN
  ↓
TRACK
  ↓
LYRICS
  ↓
MUSIC
  ↓
VISUAL
  ↓
PACKAGING
  ↓
REVIEW
  ↓
PUBLISH
  ↓
ANALYTICS
  ↓
LEARNING

Every decision may create downstream dependencies.

Therefore:

UPSTREAM CHANGE
       ↓
DEPENDENCY ANALYSIS
       ↓
INVALIDATION
       ↓
STALE / INVALIDATED ARTIFACTS
       ↓
REBUILD OR REVIEW

The architecture must preserve this model.

4. Core architectural invariants

These rules are mandatory.

4.1 Workspace isolation

The Workspace is the primary unit of production.

All domain artifacts must belong to a Workspace.

Conceptually:

workspaceId

must be preserved throughout:

Idea
DNA
Scripture
Track
Lyrics
Music
Visual
Packaging
Review
Publication
Analytics
Learning

No mutation may accidentally operate globally when it should operate inside one Workspace.

4.2 Track isolation

Each Track represents an independent branch inside the Workspace.

Example:

Workspace
│
├── Track A
│   ├── Lyrics A
│   ├── Music A
│   └── Assets A
│
└── Track B
    ├── Lyrics B
    ├── Music B
    └── Assets B

A mutation in:

Track A

must NOT invalidate:

Track B

unless an explicit dependency actually exists.

This rule is especially important for invalidation events.

Never use Workspace-wide invalidation when the real dependency is Track-scoped.

4.3 No parallel source of truth

The Lineage Graph is NOT a domain source of truth.

The graph must be derived from existing domain data.

The actual source of truth remains:

DOMAIN ENTITIES
+
VERSIONS
+
LINEAGE METADATA
+
INVALIDATION STATE
+
DOMAIN RELATIONSHIPS

Therefore:

Lineage Graph
      ↓
READ / OBSERVE / EXPLAIN

It must not become:

Lineage Graph
      ↓
Direct database mutation

Domain mutations must remain inside their domain modules.

4.4 Preview is read-only

Any impact preview must satisfy:

STATE BEFORE PREVIEW
        ==
STATE AFTER PREVIEW

A preview MUST NOT:

change versions;
invalidate artifacts;
create records;
modify publication history;
change review state;
mutate lineage.

Impact Preview is a simulation.

4.5 Cancel is a true no-op

If the user sees an impact confirmation and selects:

Cancel

the result must be:

NO DOMAIN MUTATION
NO VERSION CHANGE
NO INVALIDATION
NO REVIEW CHANGE
NO PUBLICATION CHANGE

The UI may close the modal, but domain state must remain unchanged.

4.6 Confirm must reuse the real domain mutation

The confirmation layer must NOT duplicate mutation logic.

Incorrect:

Impact Confirmation
        ↓
Custom mutation logic

Correct:

Impact Confirmation
        ↓
Existing domain mutation
        ↓
Invalidation Engine
        ↓
Persisted state

For example, if Scripture already has an official update operation, confirmation must call that operation.

Do not create an alternative mutation path merely because an impact modal was added.

4.7 Historical publications are immutable

Once a publication exists, it represents historical state.

Future mutations may invalidate the current production lineage, but must not rewrite historical publication records.

Example:

Publication #1
Scripture v3
Track Plan v2
Music v4

Later:

Scripture v4

The current Workspace may require reconstruction.

However:

Publication #1

must remain historically intact.

4.8 Invalidation follows dependencies

Do not invalidate based on UI stages.

Invalidate based on real dependencies.

Incorrect:

Scripture changed
↓
Invalidate everything

Correct:

Scripture changed
↓
Find dependent artifacts
↓
Invalidate direct dependents
↓
Propagate according to dependency rules
5. Current architecture and implementation state

The project has evolved through several architectural layers.

The exact implementation must always be verified against the repository.

The intended state is:

Layer 1–7 — Core Workspace and lineage architecture

Core concepts include:

Workspaces;
Ideas;
Content DNA;
Scripture;
Track planning;
Tracks;
Lyrics;
Music;
Visual;
Packaging;
Review;
Publish;
versioning;
lineage;
invalidation;
publication history.
Layer 8.3 — Journey Guardrails

The Workspace journey must not allow the user to advance before required production artifacts exist.

Important transitions:

Lyrics → Music

All required Tracks must have approved Lyrics.

Conceptually:

approvedLyricsCount
        ==
requiredTrackCount

Only then:

NEXT ENABLED

Otherwise:

NEXT BLOCKED
Music → Visual

All required Tracks must have registered Music.

Conceptually:

registeredMusicCount
        ==
requiredTrackCount
Visual → Packaging

Required Visual assets must exist.

For the current intended workflow:

requiredThumbnail

must be registered before progression.

Layer 8.4 — Browser Automation

Browser-level acceptance testing was introduced conceptually using Playwright.

Expected scripts:

npm run test:regression
npm run test:browser
npm test

The browser test suite should validate real UI behavior rather than only checking static code.

Playwright browser binaries must be installed separately from the npm package. For CI, the recommended installation pattern is npx playwright install --with-deps chromium or the equivalent configuration required by the repository.

Layer 9 — Lineage Observability

Lineage became observable.

The Workspace should expose a representation of:

Idea
 ↓
DNA
 ↓
Scripture
 ↓
Track
 ↓
Lyrics
 ↓
Music
 ↓
Visual
 ↓
Packaging
 ↓
Review
 ↓
Publication

Expected observability capabilities:

artifact type;
artifact ID;
version;
state;
stale state;
invalidation state;
invalidation reason;
Track relationship;
upstream dependencies;
downstream dependencies.

The lineage representation remains derived.

Layer 9.1 — Interactive Dependency Graph

The Lineage view evolved into an interactive dependency explorer.

Expected behavior:

Node selection

Selecting an artifact should show:

SELECTED ARTIFACT


UPSTREAM
...


DOWNSTREAM
...
Graph highlighting

Relevant dependencies should be highlighted.

Unrelated nodes may be visually de-emphasized.

Impact Preview

A read-only preview should show:

direct impact;
indirect impact;
affected artifacts;
affected stages;
projected consequences.

The impact preview must never mutate domain state.

6. Mandatory repository discovery protocol

Before implementing any Layer, execute:

git status
git branch --show-current
git log --oneline -10

Then inspect the repository:

find . -maxdepth 3 -type f

Adjust the command if the repository structure requires deeper traversal.

Inspect at minimum:

package.json
server.js
app.js
src/
tests/
docs/
.github/workflows/

Search for relevant existing implementation:

grep -R "workspaceId" .
grep -R "invalidate" .
grep -R "lineage" .
grep -R "review" .
grep -R "publish" .
grep -R "impact-preview" .

Before editing, produce an internal implementation report:

CURRENT IMPLEMENTATION
----------------------


Existing architecture:
...


Relevant modules:
...


Relevant routes:
...


Relevant UI renderers:
...


Relevant tests:
...


Requested Layer:
...


Files likely affected:
...


Potential regressions:
...


Implementation plan:
...

Do not begin implementation until the existing architecture is understood.

7. Testing rules

Tests are architectural contracts.

Never:

delete a failing test merely to obtain green status;
weaken assertions without understanding the regression;
skip a test silently;
replace a behavioral test with a static test;
change a test to match broken implementation.

When a test fails:

TEST FAILURE
     ↓
Understand expected behavior
     ↓
Inspect domain contract
     ↓
Inspect implementation
     ↓
Determine whether:
  A. implementation is wrong
  B. test is obsolete
  C. contract changed intentionally
     ↓
Fix root cause
7.1 Required regression behavior

Before considering a Layer complete:

existing regression tests pass
+
new Layer tests pass

For browser features:

regression tests
+
browser acceptance tests

must pass when the browser environment is available.

7.2 Browser testing

Playwright requires browser binaries in addition to the package dependency. The project should use the repository's existing test configuration where possible, and CI can install Chromium plus its system dependencies with Playwright's documented --with-deps flow.

If browser tests cannot run because Chromium is not installed, report explicitly:

REGRESSION TESTS: PASS


BROWSER TESTS: NOT EXECUTED


REASON:
Chromium / Playwright browser binaries unavailable.

Never report browser tests as passing if they were not executed.

8. Git workflow

Do not work directly on main.

First inspect:

git branch --show-current
git status

For a new Layer:

git checkout <current-integration-branch>
git pull
git checkout -b layer-9-2-edit-impact-confirmation

Before committing:

git diff
git diff --stat
git status

Run tests.

Then:

git add <relevant-files>
git commit -m "feat(lineage): add edit impact confirmation"

Avoid committing unrelated generated files.

Do not commit:

node_modules/
temporary screenshots/
debug artifacts/
local databases unless explicitly intended/
9. Implementation workflow for every new Layer

Every Layer follows:

DISCOVER
   ↓
MAP CURRENT ARCHITECTURE
   ↓
IDENTIFY CONTRACTS
   ↓
PLAN MINIMAL CHANGE
   ↓
IMPLEMENT
   ↓
TEST
   ↓
FIX ROOT CAUSES
   ↓
DOCUMENT
   ↓
REVIEW DIFF
   ↓
COMMIT

Do not skip directly from:

REQUEST
   ↓
WRITE CODE
10. Layer 9.2 — Edit Impact Confirmation
Status

Next implementation layer

11. Layer 9.2 objective

Connect the existing Impact Preview system to real decision mutations.

The desired flow:

USER EDITS DECISION
        ↓
DETECT PENDING CHANGE
        ↓
CALCULATE IMPACT
        ↓
HAS IMPACT?
   │          │
  NO          YES
   │           │
   ▼           ▼
DOMAIN       IMPACT
MUTATION     CONFIRMATION
DIRECTLY          │
                  ▼
              CANCEL?
             │       │
            YES      NO
             │        │
             ▼        ▼
           NO-OP   CONFIRM
                      │
                      ▼
             EXISTING DOMAIN MUTATION
                      │
                      ▼
              INVALIDATION ENGINE
                      │
                      ▼
                  STATE REFRESH
                      │
          ┌───────────┼────────────┐
          ▼           ▼            ▼
        JOURNEY     REVIEW       LINEAGE
12. Scope of Layer 9.2

Layer 9.2 must begin with the most important upstream decisions.

Priority order:

1. Scripture
2. Content DNA
3. Track Plan

Do NOT expand to every editable artifact unless the repository architecture makes this trivial and safe.

Later extensions may include:

Lyrics
Music
Visual
Packaging

The purpose of Layer 9.2 is to establish the confirmation architecture correctly.

13. Existing Impact Preview contract

Before implementing, inspect the repository for the actual impact preview endpoint or module.

Expected semantic capabilities:

artifact
direct impact
indirect impact
affected artifacts
affected stages
impact count
simulation = true

An equivalent response may look like:

{
  "artifact": {
    "id": "artifact-id",
    "type": "SCRIPTURE",
    "version": 3
  },
  "directImpact": [],
  "indirectImpact": [],
  "affectedArtifacts": [],
  "affectedStages": [],
  "impactCount": 0,
  "simulation": true
}

The exact field names may differ.

Do not introduce a second impact engine if an existing one already exists.

Reuse the current implementation.

14. Layer 9.2 architecture

The confirmation layer should conceptually look like:

EDIT UI
   │
   ├── no impact
   │      │
   │      ▼
   │  existing mutation
   │
   └── impact exists
          │
          ▼
     impact preview
          │
          ▼
     confirmation modal
          │
     ┌────┴────┐
     │         │
   cancel    confirm
     │         │
     ▼         ▼
   no-op   existing domain mutation
                    │
                    ▼
              invalidation engine
                    │
                    ▼
               refresh UI state

The confirmation system must be orchestration only.

It must not contain duplicated domain mutation logic.

15. Reusable confirmation API

Create a reusable client-side mechanism.

For example:

showImpactConfirmation({
  title,
  artifact,
  directImpact,
  indirectImpact,
  affectedStages,
  onCancel,
  onConfirm
})

The exact implementation may differ.

However, avoid:

showScriptureImpactModal()
showDNAImpactModal()
showTrackImpactModal()

if these duplicate rendering and confirmation logic.

Use a shared mechanism with domain-specific input.

16. Impact confirmation UI

The modal should communicate consequences clearly.

Example:

⚠ Impacto de la modificación


Estás a punto de modificar:


Scripture
John 3:16


Esta modificación afectará:


2 artefactos directamente
5 artefactos indirectamente


Etapas afectadas:


• Tracks
• Lyrics
• Music
• Review


────────────────────────


DIRECTAMENTE AFECTADOS


Track Plan v3


────────────────────────


INDIRECTAMENTE AFECTADOS


Lyrics A
Lyrics B
Music A
Music B
Review v4


────────────────────────


[ Cancelar ] [ Confirmar cambio ]

The UI must not claim a specific resulting state unless that result comes from the actual impact/invalidation rules.

17. No-impact behavior

If a mutation has no meaningful downstream impact, do not create unnecessary friction.

Desired behavior:

EDIT
 ↓
IMPACT COUNT = 0
 ↓
DIRECT DOMAIN MUTATION

No confirmation modal is required.

However, this must use the same mutation path as confirmation.

The confirmation layer is not a new mutation architecture.

18. Cancel behavior

Cancel must be a true no-op.

Test:

Before:
Scripture v3
Track Plan ACTIVE
Music ACTIVE
Review APPROVED


Open preview
Cancel


After:
Scripture v3
Track Plan ACTIVE
Music ACTIVE
Review APPROVED

No records should be created.

No invalidation should occur.

No version should change.

19. Confirm behavior

Example:

Scripture v3
      ↓
Track Plan v2
      ↓
Lyrics
      ↓
Music
      ↓
Review APPROVED

User modifies Scripture.

The system:

detects change
      ↓
calculates impact
      ↓
shows confirmation

If the user confirms:

existing Scripture mutation
      ↓
Scripture version changes
      ↓
existing invalidation rules execute
      ↓
dependent artifacts become affected
      ↓
Review invalidates when required
      ↓
Lineage refreshes

The confirmation modal must not manually set:

Music = STALE
Review = INVALIDATED

Those state changes belong to the existing invalidation engine.

20. Double-confirmation protection

The confirmation action must be idempotent at the UI interaction level.

Once confirmation begins:

CONFIRM BUTTON
     ↓
DISABLED
     ↓
"Confirmando..."

until completion.

The user must not be able to double-click:

Confirm
Confirm

and accidentally create:

Scripture v4
Scripture v5

If the existing API already supports idempotency keys or request protection, reuse it.

If not, UI-level protection is mandatory for this Layer.

Do not invent backend idempotency architecture unless the repository requires it.

21. Error behavior

If the mutation fails:

Preview
  ↓
Confirm
  ↓
Mutation error

the UI must:

show error
restore confirmation controls
keep state consistent
not fake success
not manually invalidate artifacts

After an error, the application must refresh or retain the authoritative current state.

22. Required UI refresh after confirmation

After successful mutation:

MUTATION COMPLETE
        ↓
REFRESH CURRENT VIEW
        ↓
REFRESH JOURNEY GUARD
        ↓
REFRESH REVIEW STATE
        ↓
REFRESH LINEAGE GRAPH

The exact functions depend on the current application architecture.

The user should not need:

F5

to see:

new version;
stale artifacts;
invalidated Review;
updated graph.
23. Scripture integration

Layer 9.2 must integrate at least one complete real scenario.

Preferred first scenario:

SCRIPTURE EDIT

Implementation flow:

User changes Scripture
       ↓
Identify current Scripture artifact
       ↓
Request impact preview
       ↓
If impactCount > 0:
       ↓
Show confirmation
       ↓
Cancel → no-op
Confirm → existing Scripture mutation
       ↓
Refresh dependent UI
24. Content DNA integration

The same architecture should then be applied to Content DNA.

Do not copy/paste the entire confirmation implementation.

Expected:

DNA edit
   ↓
shared impact preview
   ↓
shared confirmation modal
   ↓
existing DNA mutation
25. Track Plan integration

Track Plan may have more complex Track-specific effects.

The implementation must preserve Track isolation.

Example:

Track A changes

must not cause:

Track B

to become stale unless the dependency graph explicitly says so.

26. Layer 9.2 test specification

Create:

tests/edit-impact-confirmation.test.js

Adapt naming to existing project conventions if required.

26.1 Preview tests

Must verify:

✓ preview does not mutate entity
✓ preview does not change version
✓ preview does not invalidate downstream
✓ preview returns direct impact
✓ preview returns indirect impact
✓ preview identifies affected stages
26.2 Cancel tests

Must verify:

✓ cancel does not mutate
✓ cancel does not create a version
✓ cancel does not invalidate
✓ cancel does not modify review
✓ cancel does not modify publication history
26.3 Confirm tests

Must verify:

✓ confirm executes real domain mutation
✓ version changes correctly
✓ invalidation engine executes
✓ dependent artifacts reflect real rules
✓ review invalidates when required
✓ lineage reflects updated state
26.4 Track isolation

Must verify:

Track A mutation
        ↓
Track A downstream affected


Track B
        ↓
unchanged

unless an explicit dependency exists.

26.5 Publication history

Must verify:

Publication #1

remains historically unchanged after a later upstream mutation.

26.6 Duplicate confirmation

Must verify that duplicate UI confirmation cannot trigger duplicate mutation.

At minimum:

confirm once
confirm immediately again

must not create two versions.

27. Browser acceptance specification

Extend the existing browser test architecture.

Required scenario:

OPEN WORKSPACE
      ↓
GO TO SCRIPTURE
      ↓
EDIT SCRIPTURE
      ↓
IMPACT CONFIRMATION APPEARS
      ↓
VERIFY AFFECTED ARTIFACTS
      ↓
CLICK CANCEL
      ↓
VERIFY NOTHING CHANGED
      ↓
EDIT AGAIN
      ↓
CONFIRM
      ↓
WAIT FOR MUTATION
      ↓
VERIFY VERSION CHANGED
      ↓
OPEN LINEAGE
      ↓
VERIFY UPDATED DEPENDENCIES
      ↓
OPEN REVIEW
      ↓
VERIFY INVALIDATION WHEN APPLICABLE

The test must validate behavior, not merely DOM existence.

Bad:

expect(modal).toBeVisible()

Good:

open modal
cancel
verify domain state unchanged


open modal
confirm
verify domain state changed
verify lineage changed
verify review changed
28. CI requirements

The project should expose consistent scripts.

Preferred structure:

{
  "scripts": {
    "test": "npm run test:regression && npm run test:browser",
    "test:regression": "...",
    "test:browser": "..."
  }
}

Do not duplicate long test lists unnecessarily between:

package.json
GitHub Actions
documentation

Prefer package.json as the command entry point.

GitHub Actions should call the scripts.

For Playwright CI, install dependencies and required browser binaries before running browser tests; Playwright's official CI guidance uses npm ci followed by browser installation and test execution.

29. Documentation requirements

After implementing Layer 9.2, create:

docs/ALMAYVINILO_STUDIO_LAYER_9_2_EDIT_IMPACT_CONFIRMATION.md

The document must contain:

1. Objective
2. Scope
3. Architecture
4. Preview flow
5. Cancel flow
6. Confirm flow
7. Reused domain mutations
8. Files modified
9. Tests added
10. Regression results
11. Browser test results
12. CI changes
13. Known limitations
14. Follow-up recommendations

Do not claim tests passed if they were not executed.

Use this format:

PASS
FAIL
NOT EXECUTED

with reasons.

30. Required implementation report

At the end of every Layer, create or update an implementation report.

The agent must return:

IMPLEMENTATION SUMMARY
======================


Layer:
...


Branch:
...


Commit:
...


Base commit:
...


Files changed:
...


Architecture decisions:
...


Existing contracts reused:
...


New contracts introduced:
...


Regression tests:
PASS / FAIL / NOT EXECUTED


Browser tests:
PASS / FAIL / NOT EXECUTED


Known limitations:
...


31. Mandatory final verification

Before committing:

git diff
git diff --check
git status

Then run:

npm run test:regression

If browser dependencies are available:

npm run test:browser

If browser tests cannot run locally, report this explicitly.

Then:

git diff --stat

Review for accidental changes.

Only then commit.

32. Definition of Done — Layer 9.2

Layer 9.2 is complete only when:

[ ] Current architecture inspected
[ ] Existing impact preview reused
[ ] No second impact engine created
[ ] Shared confirmation UI exists
[ ] Scripture integrated
[ ] Content DNA integrated if architecture supports it
[ ] Track Plan integrated if architecture supports it
[ ] Preview is read-only
[ ] Cancel is no-op
[ ] Confirm uses existing domain mutation
[ ] Invalidation remains domain-driven
[ ] UI refreshes after mutation
[ ] Double confirmation protected
[ ] Error behavior implemented
[ ] Track isolation preserved
[ ] Publication history preserved
[ ] Regression tests pass
[ ] New Layer tests pass
[ ] Browser acceptance updated
[ ] CI updated if required
[ ] Documentation created
[ ] Final diff reviewed
[ ] Commit created
33. Future roadmap

The following roadmap is directional.

Do not implement future Layers unless explicitly requested.

Layer 9.2
EDIT IMPACT CONFIRMATION
        ↓
Layer 9.3
DECISION VERSION HISTORY
        ↓
Layer 9.4
COMPARE / RESTORE DECISIONS
        ↓
Layer 10
WORKSPACE PRODUCTIVITY
        ↓
Layer 10.1
WORKSPACE DASHBOARD
        ↓
Layer 10.2
PRODUCTION QUEUE
        ↓
Layer 10.3
BATCH OPERATIONS
        ↓
Layer 11
ANALYTICS FEEDBACK LOOP
        ↓
Layer 11.1
PERFORMANCE ATTRIBUTION
        ↓
Layer 11.2
LEARNING ENGINE
        ↓
Layer 12
PRODUCTION AUTOMATION
34. Preliminary design — Layer 9.3

Layer 9.3 should introduce Decision Version History.

Concept:

SCRIPTURE


v1
│
v2
│
v3  ← publication #1
│
v4  ← current

Capabilities:

inspect versions;
inspect timestamps;
inspect reasons for changes;
identify which publication used which version;
identify which downstream artifacts were generated from each version.

This layer must remain read-oriented initially.

35. Preliminary design — Layer 9.4

Layer 9.4 may introduce:

COMPARE

and eventually:

RESTORE

Example:

Scripture v3
        vs
Scripture v4

The UI should explain:

WHAT CHANGED
WHAT DEPENDS ON EACH VERSION
WHAT WOULD BE AFFECTED BY RESTORE

Restore must NOT bypass Impact Confirmation.

Restoring a previous version is also an upstream mutation.

Therefore:

RESTORE
   ↓
IMPACT PREVIEW
   ↓
CONFIRMATION
   ↓
DOMAIN MUTATION
   ↓
INVALIDATION
36. Agent operating rules for future Layers

For every future request:

DO NOT:
- rewrite the project unnecessarily
- create parallel architecture
- duplicate domain logic
- weaken tests
- ignore existing modules
- assume old specifications override newer repository behavior
- silently skip tests
- claim unexecuted tests passed

Instead:

ALWAYS:
- inspect first
- map existing architecture
- reuse contracts
- implement minimally
- test behavior
- preserve isolation
- preserve publication history
- document changes
- review diff
37. Final architecture principle

Alma y Vinilo Studio should increasingly behave as:

A SYSTEM OF DECISIONS

not:

A COLLECTION OF FORMS

Every important decision has:

INPUT
  ↓
VERSION
  ↓
DEPENDENCIES
  ↓
DOWNSTREAM CONSEQUENCES
  ↓
REVIEW
  ↓
PUBLICATION
  ↓
ANALYTICS
  ↓
LEARNING

The architectural goal is therefore:

MAKE DECISIONS
      ↓
UNDERSTAND CONSEQUENCES
      ↓
CONFIRM CHANGES
      ↓
PRESERVE HISTORY
      ↓
LEARN FROM RESULTS
