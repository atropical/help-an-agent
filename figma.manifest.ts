export default {
  "name": "LibLib",
  "id": "1665168884798434636",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "src/index.html",
  "editorType": ["figma", "dev"],
  // Dev Mode refuses to launch a plugin in the handoff panel without this,
  // even with "dev" in editorType.
  "capabilities": ["inspect"],
  "documentAccess": "dynamic-page",
  "menu": [
    { "command": "snapshot", "name": "Export Snapshot…" },
    { "command": "diff", "name": "Diff Against Snapshot…" }
  ],
  "networkAccess": {
    "allowedDomains": ["none"],
    "reasoning": "LibLib reads the current file and writes report files locally. It never sends design data anywhere."
  }
};
