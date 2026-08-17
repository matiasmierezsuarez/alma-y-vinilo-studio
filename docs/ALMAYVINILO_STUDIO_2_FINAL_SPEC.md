# ALMAYVINILO STUDIO 2.0 --- FINAL BUILD SPEC

Version: 1.0 FINAL Status: Implementation source of truth Research
chain: v1 → v2 → v3 → v4 → v5 → v6-final

## 0. Purpose

Build a new application from scratch. Do not refactor the previous
prototype.

The product is an AI-assisted content operating system for a Christian
music YouTube channel. It manages a complete workspace from idea through
publication and learning.

Core principle:

> AI generates inside controlled creative constraints; the workspace
> stores decisions; analytics learns from outcomes.

The product must not be a generic AI prompt generator.

------------------------------------------------------------------------

# 1. Product pillars

1.  Workspace-first content production.
2.  Content DNA as the central object.
3.  Scripture-aware generation.
4.  Two controlled sound seeds.
5.  Stable visual identity with two recurring characters.
6.  Track planning before lyrics/music.
7.  Simple actionable packaging.
8.  Mandatory review before publication.
9.  Analytics attached to the exact content DNA that produced the video.
10. Cross-project learning.
11. Competitive research as a knowledge base, not as runtime
    instructions copied blindly.

------------------------------------------------------------------------

# 2. Canonical workflow

``` text
IDEA
 ↓
CONTENT DNA
 ↓
SCRIPTURE
 ↓
TRACK PLAN
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
LEARN
 ↓
NEXT PROJECT
```

UX rule: one screen = one main decision.

The primary action is always `NEXT`; previous stages remain editable
through `EDIT`.

------------------------------------------------------------------------

# 3. Workspace

A workspace is one complete YouTube content product.

Status:

-   NOT_STARTED
-   IN_PROGRESS
-   READY
-   PUBLISHED
-   LEARNING
-   ARCHIVED

Workspace sections:

-   Overview
-   Content DNA
-   Scripture
-   Track Plan
-   Lyrics
-   Music
-   Visual
-   Packaging
-   Review
-   Publish
-   Analytics
-   Learning

Workspace dashboard must show progress and blockers, not expose internal
prompt complexity.

------------------------------------------------------------------------

# 4. Content DNA

Required fields:

``` ts
type ContentDNA = {
  moment: string
  humanNeed: string
  currentEmotion: string
  desiredEmotion: string
  scriptureId: string
  soundSeed: "SEED_A_JAZZ_VINYL" | "SEED_B_GOSPEL_SOUL"
  vocalMode: "INSTRUMENTAL" | "SOFT_MALE" | "SOFT_FEMALE" | "SOFT_DUET" | "VOCAL_TEXTURE"
  visualScenario: {
    location: string
    time: string
    weather: string
    activity: string
    props: string[]
    lighting: string
  }
  packagingFormula: "MOMENT_FIRST" | "EMOTION_FIRST" | "MUSIC_FIRST"
}
```

The Content DNA must be immutable by default after publication. Edits
after publication create a version.

------------------------------------------------------------------------

# 5. Idea Engine

Input can be:

-   manual idea
-   generated idea
-   learning-engine recommendation
-   series continuation

Generated idea must contain:

-   working title
-   moment
-   human need
-   desired emotion
-   suggested Scripture
-   suggested sound seed
-   visual scenario
-   rationale

Never jump directly from idea to lyrics.

Action:

`DEVELOP IDEA`

creates Content DNA.

------------------------------------------------------------------------

# 6. Scripture Engine

Flow:

``` text
human need
→ Scripture candidates
→ passage
→ theme
→ emotional arc
→ approve
```

Store:

``` ts
type Scripture = {
  id: string
  translation: string
  book: string
  chapter: number
  verseStart: number
  verseEnd: number
  reference: string
  passageText?: string
  theme: string
  rationale: string
}
```

Never invent Scripture.

If exact text is unavailable or licensing/source policy does not allow
storing it, store reference + theme and generate thematic direction
instead.

Approved Scripture automatically propagates to:

-   track plan
-   lyrics direction
-   track titles
-   description
-   metadata
-   analytics tags

------------------------------------------------------------------------

# 7. Sound Engine

Exactly two initial sound seeds.

## Seed A --- Jazz / Vinyl

``` text
Slow jazz, 68 BPM, acoustic piano trio, upright bass, brushed drums,
intimate coffeehouse atmosphere, warm and soothing, vinyl warmth
```

## Seed B --- Gospel Soul / R&B

``` text
gospel and R&B, 72 BPM, guitar, bass, drums, violin, cello,
soft vocal, chill
```

Never generate a music prompt from scratch.

Formula:

``` text
BASE SEED
+
CONTROLLED MODIFIERS
```

Allowed modifiers:

### Moment

-   morning
-   evening
-   study
-   prayer
-   rest

### Emotion

-   peaceful
-   hopeful
-   reflective
-   grateful
-   comforting

### Vocal

-   instrumental
-   soft male
-   soft female
-   soft duet
-   vocal texture

### Energy

-   very soft
-   soft
-   moderate

### Environment

-   coffeehouse
-   rainy window
-   late-night room
-   quiet morning

Reject combinations that break the seed identity, such as
EDM/aggressive/high-energy additions to Seed A.

User actions:

-   Lock seed
-   Switch seed
-   Regenerate variation
-   Edit modifier

Output:

-   selected seed
-   final Suno prompt
-   constraints
-   version

------------------------------------------------------------------------

# 8. Track Plan Engine

Do not generate lyrics first.

First create a track plan.

A video may contain multiple tracks.

Track:

``` ts
type Track = {
  id: string
  workspaceId: string
  number: number
  title: string
  purpose: string
  scriptureReference: string
  scriptureTheme: string
  emotionalStart: string
  emotionalEnd: string
  soundSeed: string
  vocalMode: string
  lyricDirection: string
  sunoPrompt?: string
  lyrics?: string
  status: string
}
```

Track plan must demonstrate an emotional arc.

Example:

``` text
01 Steady Through It All — Psalm 23:4
02 Show Me the Way — Psalm 25:4
03 Quiet Waters — Psalm 23:2
04 Rest for My Mind — Psalm 23:3
```

The system should not produce 10 arbitrary songs.

------------------------------------------------------------------------

# 9. Lyrics Engine

Lyrics are generated only after:

-   Content DNA approved
-   Scripture approved
-   Track plan approved

Each lyric request receives:

-   track purpose
-   Scripture reference/theme
-   emotional start
-   emotional destination
-   selected sound seed
-   vocal mode

The engine must avoid claiming invented quotations are Scripture.

------------------------------------------------------------------------

# 10. Music Engine

Music generation is provider-agnostic.

Implement an adapter:

``` ts
interface MusicProvider {
  generate(input: MusicGenerationInput): Promise<MusicGenerationResult>
  getStatus(jobId: string): Promise<MusicJobStatus>
}
```

Initial provider: Suno-compatible workflow.

Store:

-   prompt
-   seed
-   provider
-   generation ID
-   asset URL
-   duration
-   status
-   version
-   createdAt

Never overwrite generations. Keep versions.

------------------------------------------------------------------------

# 11. Visual DNA

The channel has two recurring characters.

They must appear consistently in thumbnails.

The visual system has stable:

-   character identities
-   palette
-   lighting language
-   environment language
-   cinematic framing
-   warm/vinyl-inspired atmosphere

Variable:

-   location
-   time
-   weather
-   activity
-   props
-   lighting intensity
-   camera framing

The reference image supplied by the user is the canonical visual
reference for thumbnail generation.

Store a `VisualReference` entity:

``` ts
type VisualReference = {
  id: string
  name: string
  assetUrl: string
  role: "THUMBNAIL_MASTER"
  locked: boolean
}
```

Never replace the master reference implicitly.

------------------------------------------------------------------------

# 12. Visual Engine

Generate:

1.  scene concept internally
2.  final thumbnail prompt
3.  optional full-video visual prompt

The user-facing UI should not expose redundant terms such as:

-   CONCEPTO VISUAL
-   BRIEF VISUAL
-   PROMPT VISUAL

Instead expose:

-   Thumbnail Prompt
-   Thumbnail Text
-   Video Visual Direction

The thumbnail prompt is for the image generator. It is not text to paste
into YouTube.

------------------------------------------------------------------------

# 13. Packaging Engine

Outputs:

``` ts
type Packaging = {
  title: string
  thumbnailText?: string
  thumbnailPrompt: string
  description: string
  tags: string[]
  formula: "MOMENT_FIRST" | "EMOTION_FIRST" | "MUSIC_FIRST"
}
```

Title formulas:

### Moment first

`[Moment] | [Music + Benefit] | [Scripture]`

### Emotion first

`[Emotional Promise] | [Moment + Music] | [Scripture]`

### Music first

`[Christian Jazz] | [Moment] | [Scripture + Benefit]`

Packaging should be generated from Content DNA and approved Scripture.

Do not keyword-stuff.

------------------------------------------------------------------------

# 14. Description structure

``` text
HOOK
WHAT THIS IS
SCRIPTURE FOUNDATION
USE CASES
TRACKLIST
AI / HUMAN CREATION NOTE
CTA
HASHTAGS
```

Description should be useful to a human listener.

------------------------------------------------------------------------

# 15. Review Engine

Publishing is blocked until review passes.

Checklist:

## Content

-   Content DNA complete
-   Scripture approved
-   track plan complete
-   lyrics complete where required
-   music assets complete

## Visual

-   master characters present
-   thumbnail generated
-   visual reference respected

## Packaging

-   title present
-   thumbnail text reviewed
-   thumbnail prompt present
-   description present
-   tags present

## Compliance

-   rights/source metadata complete
-   AI disclosure field handled according to current platform
    requirements
-   no fabricated Scripture quotations
-   no missing required assets

Review status:

-   BLOCKED
-   READY_FOR_REVIEW
-   APPROVED
-   REJECTED

------------------------------------------------------------------------

# 16. Publish Engine

Provider-agnostic:

``` ts
interface PublishingProvider {
  upload(input: PublishInput): Promise<PublishResult>
  update(videoId: string, input: UpdatePublishInput): Promise<void>
  getStatus(videoId: string): Promise<PublishStatus>
}
```

Store:

-   YouTube video ID
-   URL
-   publish date
-   title version
-   thumbnail version
-   description version
-   playlist/series
-   disclosure state

Publishing must create a snapshot of all inputs used.

------------------------------------------------------------------------

# 17. Analytics Engine

Capture:

-   views
-   impressions
-   CTR
-   average view duration
-   average percentage viewed
-   watch time
-   likes
-   comments
-   subscribers gained
-   traffic sources

Snapshots:

-   7 days
-   28 days
-   90 days

Also allow arbitrary snapshots.

Analytics must link directly to:

-   Content DNA
-   Scripture
-   Sound Seed
-   Vocal Mode
-   Visual scenario
-   Packaging formula
-   title version
-   thumbnail version
-   series
-   duration

------------------------------------------------------------------------

# 18. Baseline

Do not compare all videos indiscriminately.

Baseline should use:

-   same channel
-   same content type
-   comparable age

Initial heuristic:

``` text
< 0.75x = WEAK
0.75–1.25x = NORMAL
1.25–2x = STRONG
> 2x = OUTLIER CANDIDATE
```

The system must recalibrate after enough own-channel data exists.

------------------------------------------------------------------------

# 19. Experiment Engine

Each experiment stores:

``` ts
type Experiment = {
  id: string
  workspaceId: string
  hypothesis: string
  variable: string
  control: unknown
  variant: unknown
  primaryMetric: string
  secondaryMetrics: string[]
  startDate: string
  endDate?: string
  result?: string
  confidence?: string
  decision?: "REPEAT" | "EXPAND" | "TEST" | "RETIRE"
}
```

Rules:

-   1 observation = signal
-   3 comparable observations = preliminary pattern
-   5+ = strong pattern
-   10+ = candidate rule

Never convert one viral result into an automatic permanent rule.

------------------------------------------------------------------------

# 20. Learning Engine

Learning unit is a combination, not a video.

Example:

``` text
Morning
+
Anxiety
+
Psalm 23
+
Seed A
+
T2 thumbnail
+
Moment-first title
```

Learning output:

-   performance index
-   confidence
-   evidence count
-   recommendation

Recommendations:

-   REPEAT
-   EXPAND
-   TEST
-   RETIRE

Never recommend exact duplication.

Example:

Winning combination:

`Morning + Psalm 23 + Seed A`

Generate variations:

-   Morning + Psalm 27 + Seed A
-   Morning + Proverbs 3 + Seed A
-   Evening + Psalm 23 + Seed A

------------------------------------------------------------------------

# 21. Diversity Engine

Prevent over-repetition.

Track combinations of:

-   moment
-   need
-   Scripture
-   sound seed
-   visual scenario

If a combination is repeated too often, flag:

`HIGH_REPETITION`

Then suggest adjacent variations.

Do not maximize diversity. Optimize:

`recognizable consistency + controlled variation`

------------------------------------------------------------------------

# 22. Series and Catalog

Support:

``` text
Series
  → Volume
     → Workspace/Video
        → Tracks
```

Example:

``` text
Quiet Mornings with God
  Volume 01 — Psalms for Peace
  Volume 02 — Psalms for Focus
  Volume 03 — Proverbs for Wisdom
```

This combines experience-based video design with catalog thinking.

------------------------------------------------------------------------

# 23. Shorts

Shorts are optional and should have a purpose:

-   DISCOVERY
-   BRIDGE_TO_LONG_FORM

A Short stores:

-   source workspace
-   clip range
-   Scripture
-   hook
-   CTA
-   published video ID

Do not generate Shorts merely because the long-form exists.

------------------------------------------------------------------------

# 24. Research Knowledge Base

Entities:

``` text
Competitor
VideoBenchmark
Pattern
Hypothesis
Experiment
Learning
```

Knowledge hierarchy:

``` text
RAW DATA
↓
OBSERVATION
↓
PATTERN
↓
HYPOTHESIS
↓
EXPERIMENT
↓
RESULT
↓
LEARNING
↓
RULE
```

Never jump from raw public data directly to rules.

Public revenue estimates are informational only and must never be
treated as exact revenue.

------------------------------------------------------------------------

# 25. Benchmark knowledge to seed the KB

## Prayer & Jazz

Model: OUTLIER

Lesson: experience-based titles + Scripture + track architecture +
focused catalog.

## Manna Jazz

Model: CATALOG

Lesson: Bible books + volumes + repeated Work/Study structure.

## Heaven Jazz Café

Model: SCALE

Lesson: broad use cases + consistent publishing.

## Morning Mercy Jazz

Model: REPETITION

Lesson: repeatable promise around morning/coffee/study/prayer.

## Prayer Jazz Morning

Model: HUMAN CURATION

Lesson: AI assists production; human direction and Scripture intention
remain important.

## The Manna Lounge

Model: SOUND EXPANSION

Lesson: jazz + R&B/soul can coexist when expansion is controlled.

Do not copy competitor identities, assets, titles, thumbnails or exact
content.

------------------------------------------------------------------------

# 26. Channel strategy

Positioning:

> Warm Christian jazz, soul and Scripture-inspired music for real
> moments of life.

Core content:

-   morning
-   work
-   study
-   prayer
-   reading
-   journaling
-   evening
-   reflection
-   rest

Human needs:

-   anxiety
-   tiredness
-   uncertainty
-   loneliness
-   distraction
-   waiting
-   gratitude
-   direction
-   rest
-   hope

Emotional destinations:

-   peace
-   trust
-   hope
-   comfort
-   gratitude
-   focus

------------------------------------------------------------------------

# 27. Sound strategy

Start with only:

`SEED_A_JAZZ_VINYL`

and

`SEED_B_GOSPEL_SOUL`

Do not add new sound families until Analytics provides evidence.

------------------------------------------------------------------------

# 28. Visual strategy

Maintain:

-   same two characters
-   same visual universe
-   same recognizable palette/style
-   different moment/context

Thumbnail experiments:

-   T1 characters only
-   T2 characters + 2--3 words
-   T3 characters + moment word

CTR must determine future default.

------------------------------------------------------------------------

# 29. Publishing strategy

Initial recommendation:

`1–2 long-form videos/week`

Shorts only when useful.

Consistency is more important than an arbitrary publishing frequency.

------------------------------------------------------------------------

# 30. UI requirements

Main navigation:

-   Dashboard
-   Workspaces
-   Research
-   Analytics
-   Learning
-   Settings

Inside Workspace:

-   Overview
-   Content
-   Scripture
-   Tracks
-   Music
-   Visual
-   Packaging
-   Review
-   Publish
-   Analytics

Do not create separate tabs for functionality already represented inside
Workspace.

------------------------------------------------------------------------

# 31. UX requirements

Every stage must show:

-   current status
-   required inputs
-   generated output
-   approve/edit action
-   next action

Avoid exposing raw AI prompts unless the user requests advanced mode.

Default UI should be operational, not technical.

------------------------------------------------------------------------

# 32. Persistence and versioning

Every generated artifact must be versioned.

Never overwrite:

-   prompts
-   lyrics
-   music generations
-   images
-   packaging
-   review decisions

Use:

``` text
version
createdAt
createdBy
sourceVersion
```

Publication stores exact artifact versions used.

------------------------------------------------------------------------

# 33. Error handling

Every generation job must support:

-   QUEUED
-   RUNNING
-   SUCCEEDED
-   FAILED
-   CANCELLED

Store error details.

Allow retry without losing previous attempt.

------------------------------------------------------------------------

# 34. Provider architecture

All external AI services must be adapters.

``` ts
interface LLMProvider {}
interface MusicProvider {}
interface ImageProvider {}
interface ScriptureProvider {}
interface PublishingProvider {}
interface AnalyticsProvider {}
```

The business logic must never call vendor-specific APIs directly.

------------------------------------------------------------------------

# 35. Suggested backend modules

``` text
workspaces
content-dna
ideas
scripture
tracks
lyrics
music
visual
packaging
review
publishing
analytics
experiments
learning
research
series
shorts
providers
```

------------------------------------------------------------------------

# 36. Suggested API surface

``` text
POST   /workspaces
GET    /workspaces/:id
PATCH  /workspaces/:id

POST   /workspaces/:id/ideas
POST   /workspaces/:id/content-dna
POST   /workspaces/:id/scripture/candidates
POST   /workspaces/:id/scripture/select

POST   /workspaces/:id/tracks/plan
POST   /tracks/:id/lyrics
POST   /tracks/:id/music

POST   /workspaces/:id/visual/thumbnail
POST   /workspaces/:id/packaging

POST   /workspaces/:id/review
POST   /workspaces/:id/publish

GET    /workspaces/:id/analytics
POST   /workspaces/:id/analytics/snapshot

POST   /experiments
GET    /experiments
POST   /learning/recommendations

GET    /research/competitors
GET    /research/patterns
```

------------------------------------------------------------------------

# 37. Database requirements

Relational database recommended.

Minimum tables:

``` text
users
workspaces
content_dna
scriptures
series
volumes
tracks
lyrics_versions
music_generations
visual_references
visual_assets
packaging_versions
review_items
publication_snapshots
analytics_snapshots
experiments
learning_observations
learning_patterns
competitors
benchmark_videos
research_patterns
```

Every content table must retain `workspace_id` where applicable.

------------------------------------------------------------------------

# 38. Acceptance criteria

A build is not complete unless a user can:

1.  Create workspace.
2.  Generate/select idea.
3.  Develop Content DNA.
4.  Select Scripture.
5.  Generate track plan.
6.  Generate lyrics.
7.  Generate Suno prompts using one of the two seeds.
8.  Generate visual prompt using the locked two-character reference.
9.  Generate actionable packaging.
10. Review everything.
11. Publish or export a publication package.
12. Record publication ID.
13. Import/capture analytics.
14. See performance against baseline.
15. Create/observe experiment.
16. Receive learning recommendation.
17. Start next workspace using learned recommendations.
18. Create series/volume relationships.
19. Version every important artifact.
20. Recover from failed AI jobs.

------------------------------------------------------------------------

# 39. Definition of Done

The product is ready when:

-   no manual copying between stages is required;
-   Scripture selection propagates through the workspace;
-   sound seed selection propagates to every track;
-   visual reference is locked and reusable;
-   packaging outputs are understandable without documentation;
-   publication is blocked by review failures;
-   analytics can trace performance back to Content DNA;
-   learning can generate recommendations across workspaces;
-   research can be updated without modifying application code;
-   providers can be replaced independently.

------------------------------------------------------------------------

# 40. Non-goals

Do not build initially:

-   generic multi-channel social media suite
-   automatic viral prediction
-   automatic exact competitor cloning
-   unrestricted genre generator
-   automatic publishing without review
-   automatic permanent strategy changes from one video
-   complicated prompt-management UI
-   unnecessary tabs duplicating Workspace

------------------------------------------------------------------------

# 41. Implementation order

Phase A: foundation + database + Workspace

Phase B: Content DNA + Idea Engine

Phase C: Scripture Engine

Phase D: Track Plan + Lyrics

Phase E: Sound Engine + Suno adapter

Phase F: Visual Engine + locked references

Phase G: Packaging

Phase H: Review

Phase I: Publishing

Phase J: Analytics

Phase K: Experiments + Learning

Phase L: Research KB + catalog/series

Phase M: polish + QA

Do not build Learning before Analytics data exists, but design the
schema from day one.

------------------------------------------------------------------------

# 42. Source-of-truth rule

For implementation:

1.  This file is the canonical product specification.
2.  Research v6 is the strategic evidence.
3.  Earlier research files are historical context.
4.  If older research conflicts with this final spec, this spec wins
    unless a new documented decision supersedes it.
5.  New changes must be recorded in a versioned CHANGELOG.

------------------------------------------------------------------------

# 43. Required project files

Create:

``` text
/docs
  ALMAYVINILO_STUDIO_2_FINAL_SPEC.md
  RESEARCH_REFERENCE.md
  DATA_MODEL.md
  API_SPEC.md
  PROMPT_CATALOG.md
  UX_FLOW.md
  ANALYTICS_LEARNING.md
  CHANGELOG.md

/config
  sound-seeds.json
  visual-dna.json
  packaging-formulas.json
  experiment-rules.json

/src
  modules/*
  providers/*
```

------------------------------------------------------------------------

# 44. Final product principle

The application is not the AI.

The application is the system that directs the AI.

``` text
Human intention
↓
Content DNA
↓
Controlled AI generation
↓
Review
↓
Publication
↓
Measurement
↓
Learning
↓
Better human intention
```

This loop is the core product.
