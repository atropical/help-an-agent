TAGLINE:
Design libraries in a form agents can actually read. Snapshot your library, commit it, and let `git diff` tell your agent what changed.

RELEASE NOTES (1.2.0):
✨ **New name.** Help an Agent is now **LibLib**. Same plugin, same everything — only the name moved.
🔍 **Snapshots are built to be grepped.** Every node now leads with its own name, so an agent searching for a component lands on everything that belongs to it and nothing that belongs to its neighbour. Before, a group's name could sit hundreds of lines below its own contents, and anything reading a window of context around it — grep, a truncated read, a chunked embedding — could credit those lines to the wrong component.
📄 **First export after updating will diff as the whole file.** Every line moved, so treat that first diff as a new baseline, not as a design change. Exports after it diff normally again.
♻️ **Old snapshots still work.** Anything exported by Help an Agent loads as a diff base exactly as before, and hashes are unchanged — so a component that didn't change still reads as unchanged across the update.

DESCRIPTION:
**LibLib** is a Figma plugin that exports your design system library as one deterministic, diffable file, so an LLM agent can answer the question nothing else in Figma can: what changed since last time?

Your agent can already read your components — Figma's MCP server hands it context on demand. What it can't tell you is what changed since last week. There is no published-component history and no diff anywhere in the platform: not in the MCP server, not in the Plugin API, not in REST. So LibLib makes one.

## Features
**Deterministic Snapshots:** Every component, component set, variant, property, style and variable in one file, with a content hash per record. Same design in, byte-identical file out
**Diff Against a Snapshot:** Load a previous export, rescan, and get a report of what was added, removed, renamed or modified — down to the field path (`structure.children[0].props.padding`, `properties.Size.variantOptions`, `valuesByMode.Dark`), with old value against new
**Renames Stay Renames:** Changes are tracked by publish key, so a renamed component never reads as one deleted and another invented — the single mistake that sends agents rewriting components nobody touched
**Built to Be Grepped:** Nodes lead with their own name, so a windowed read never attributes one component's properties to its neighbour
**Three Formats With Token Counts:** Markdown to read, TOON for machines (~40% cheaper than JSON, losslessly convertible back), JSON as a universal baseline — each with an estimated token range shown before you export
**Cost Estimate Before You Scan:** Large libraries are measured first. A stratified sample and an exact node count predict scan time, file size and token cost per format, and re-predict whenever you change an option
**Resolved Tokens, Not Raw Ids:** Bound variables are resolved to `Collection/Variable` names, including variables bound inside a style's shadow colour, offset, radius or spread
**Node Ids Included:** Every component and variant carries its Figma node id, so an agent can link straight back into the file or hand it to the MCP tools
**Rendered Sizes:** Pixel `width`/`height` per node, so a 32px button rendering against a 24×24 symbol shows up as a change instead of reading as identical
**Adjustable Depth:** Choose how deep into each component's tree to serialize; truncated branches are marked rather than silently reported as leaves
**Fully Offline:** No network requests at all. Nothing leaves Figma

### Notes:
† Markdown is a rendering, not a source — it is the cheapest format to read but cannot be loaded back as a diff base. Use TOON or JSON for anything you intend to diff against later.
‡ Figma caps a plugin run at roughly ten save dialogs, which is why each export writes a single file.

## Usage
### Design Mode
1. Open the Figma file containing your library
2. Run **LibLib** from the Plugins menu
3. Choose **Export Snapshot…**
4. Review the estimate, pick a format and adjust depth if needed
5. Click **Export**, then **Download**
6. Commit the file next to your code, e.g. `design-system/.figma/library.snapshot.toon`

### Dev Mode
1. Open the file and switch to Dev Mode
2. Run **LibLib** from the Plugins menu
3. Follow the same steps as above — the plugin runs in the handoff panel

### Diffing Against a Previous Snapshot
1. Run **LibLib** and choose **Diff Against Snapshot…**
2. Select a `.json` or `.toon` file previously exported by the plugin
3. The current file is rescanned and compared
4. Review the report, expand any change to see old value against new, then download it

### Suggested Workflow
1. Designer publishes the library and re-exports the snapshot over the committed file
2. The commit diff *is* the design system changelog
3. The agent reads `git diff` (or the Markdown report) and knows exactly which components to re-implement

LibLib is open source, consider contributing. Code available on [GitHub](https://github.com/atropical/liblib).

For bug reports, suggestions, or questions, please open an [issue](https://github.com/atropical/liblib/issues).

TAGS:
design system, design tokens, agents, ai, llm, mcp, diff, changelog, snapshot, components, component library, variants, variables, styles, export, dev mode, developer, handoff, git, version control, documentation, toon, json, markdown, library audit
