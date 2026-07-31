# Help an Agent

A Figma plugin that makes a design system library **diffable**.

LLM agents working against a Figma library have no way to answer "what changed since last time?".
Figma has no API for it either — see [Why this exists](#why-this-exists). Help an Agent solves it the
way developers already solve it: it exports a deterministic snapshot file you commit to your repo, so
`git diff` becomes the changelog your agent reads.

## What it does

**Export Snapshot…** scans the current file and writes:

- `<library>.snapshot.json` — every component, component set, variant, style and variable, with a
  content hash per record. Deterministic: same design in, byte-identical file out.
- `<library>.snapshot.md` — the same data as a flat, heading-heavy Markdown report, meant to be read
  by an agent that greps rather than parses.

**Diff Against Snapshot…** loads a previous snapshot JSON, rescans the file, and writes a report of
what was added, removed, renamed or modified — down to the field path
(`structure.children[0].props.padding`, `properties.Size.variantOptions`, `valuesByMode.Dark`).

Renames are detected via the publish key, so a renamed component reads as `renamed`, not as
"deleted + added" — the single most common way an agent misreads a library.

## Suggested workflow

```bash
# Committed once per library, e.g.
design-system/
  button.tsx
  .figma/library.snapshot.json   # ← plugin output, committed
  .figma/library.snapshot.md
```

1. Designer publishes the library, runs **Export Snapshot…**, replaces the committed JSON + MD.
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
npm run dev     # typecheck + rebuild plugin and UI on change
npm run build   # production build into dist/
npm run test    # tsc --noEmit + build
```

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
  utils/stable.ts            canonical JSON, hashing, rounding
```

## Status

Prototype (v0.1.0). Not yet published to the Figma Community.

## Licence

GPL-3.0-only © Atropical AS
