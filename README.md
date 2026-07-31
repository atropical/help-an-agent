# Help an Agent

A Figma plugin that makes a design system library **diffable**.

LLM agents working against a Figma library have no way to answer "what changed since last time?".
Figma has no API for it either — see [Why this exists](#why-this-exists). Help an Agent solves it the
way developers already solve it: it exports a deterministic snapshot file you commit to your repo, so
`git diff` becomes the changelog your agent reads.

## What it does

**Export Snapshot…** scans the current file and writes every component, component set, variant, style
and variable, with a content hash per record. Deterministic: same design in, byte-identical file out.

**Diff Against Snapshot…** loads a previous snapshot, rescans the file, and writes a report of what
was added, removed, renamed or modified — down to the field path
(`structure.children[0].props.padding`, `properties.Size.variantOptions`, `valuesByMode.Dark`).

Both views show a live preview of the output and let you pick the format, with an estimated token
count on each so you can see what you are about to spend:

| Format | Use | Typical cost |
| --- | --- | --- |
| **TOON** | Default. [toonformat.dev](https://toonformat.dev) — same data model as JSON, indentation instead of braces, tabular arrays. Losslessly convertible back to JSON. | **≈39% fewer tokens than JSON** |
| **JSON** | Universal, pretty-printed so `git diff` stays line-oriented. | baseline |
| **Markdown** | Prose report for an agent that greps rather than parses. Lossy — a rendering, not a source. | ≈78% fewer, but not machine-readable back |

Measured on a representative 12-set library: JSON ≈21.0k tokens, TOON ≈12.8k, Markdown ≈4.7k.

Snapshots can be loaded back for diffing as `.json` or `.toon`; both round-trip losslessly.

Renames are detected via the publish key, so a renamed component reads as `renamed`, not as
"deleted + added" — the single most common way an agent misreads a library.

## Suggested workflow

```bash
# Committed once per library, e.g.
design-system/
  button.tsx
  .figma/library.snapshot.toon   # ← plugin output, committed
```

1. Designer publishes the library, runs **Export Snapshot…**, replaces the committed file.
2. The commit diff *is* the design system changelog.
3. The agent reads `git diff .figma/` (or the Markdown report) and knows exactly which components to
   re-implement.

For a one-off check without committing anything, use **Diff Against Snapshot…** instead.

## What gets captured

Per component / component set:

| Field | Notes |
| --- | --- |
| `key` | Publish key — stable across renames and files |
| `name`, `path` | `path` is location-only and excluded from hashes and diffs |
| `description`, `documentationLinks` | |
| `properties` | Variant options, defaults, preferred instance-swap values |
| `variants` | Per-variant structure and hash, for component sets |
| `structure` | Node tree: auto layout, sizing, constraints, fills, strokes, effects, corner radii, style keys, bound variables, text segments, instance main-component keys and overrides |
| `hash` | Content hash of everything above |

Plus all local paint/text/effect/grid styles, variable collections, and variables (values per mode,
with aliases rendered as `{Collection/Variable}`).

Deliberately excluded, because they change without the design changing: node ids, absolute x/y,
inferred variables, and — by default — pixel sizes (toggleable).

## Options

- **Structure depth** (default 6) — how deep into each component's tree to serialize. Truncated
  branches are marked `truncated: true` rather than silently reported as leaves.
- **Include styles / variables** — on by default.
- **Include pixel sizes** — off by default; a resized wrapper is rarely a design system change.

## Why this exists

Researched against the Figma platform as of July 2026:

- **Plugin API, inside a file:** full fidelity. `figma.root.findAllWithCriteria` plus `key`,
  `description`, `componentPropertyDefinitions`, `getPublishStatusAsync()`, bound variables and
  layout give everything needed to fingerprint how a component is built.
- **Plugin API, across files:** `figma.teamLibrary` exposes *variable* collections only
  (`getAvailableLibraryVariableCollectionsAsync`, `getVariablesInLibraryCollectionAsync`). There is
  no published-component catalogue, no version history, and no "what changed since last publish"
  API. This is a long-standing gap.
- **REST API:** `/v1/files/{key}/components|component_sets|styles` return `key`, `updated_at` and
  `containing_frame`; `/v1/files/{key}/versions` returns version history. Metadata only — nothing
  about how a component is built.
- **No filesystem access:** the only way out of a plugin is a blob download from the iframe, and
  Figma caps a run at roughly ten save dialogs. Hence one file per export.

So there is no native diff to call. A committed snapshot file is the way to get one.

## Development

```bash
npm install
npm run dev              # typecheck + rebuild plugin and UI on change
npm run build            # production build into dist/
npm run test             # tsc --noEmit + token calibration + build
npm run fixtures         # regenerate scripts/fixtures from a synthetic library
npm run calibrate:tokens # check the token estimator against a real BPE tokenizer
```

### Token counts

Token figures in the UI are estimates, marked `≈`. A real tokenizer (`gpt-tokenizer`) carries ~2.6 MB
of rank tables — too much to inline into a single-file plugin UI for a number whose job is to compare
two formats. `src/utils/tokens.ts` approximates BPE segmentation instead, fitted against `o200k_base`
on the fixtures in `scripts/fixtures`; worst-case error is 9.7%. `npm run calibrate:tokens` fails the
build if that drifts past 12%, and `gpt-tokenizer` stays a devDependency.

In Figma: **Plugins → Development → Import plugin from manifest…** and pick `dist/manifest.json`.

`figma.manifest.ts` is the source of truth for the manifest; `dist/manifest.json` is generated on
build. The `id` is a placeholder until the plugin is registered with Figma.

Layout:

```
src/
  code.ts                    plugin thread: run command, build snapshot, post back
  ui.tsx                     UI thread: routes on the invoked menu command
  snapshot/
    buildSnapshot.ts         walks the document, collects components/styles/variables
    serializeNode.ts         one node -> deterministic property bag
    diff.ts                  key-matched record diff with field paths
    markdown.ts              agent-facing report rendering
    encode.ts                TOON / JSON / Markdown encoders + snapshot parsing
  components/                preview, format selector, options, layout
  utils/
    stable.ts                canonical JSON, hashing, rounding
    tokens.ts                token estimation
    highlightCode.tsx        preview syntax highlighting
```

## Status

Prototype (v0.1.0). Not yet published to the Figma Community.

## Licence

GPL-3.0-only © Atropical AS
