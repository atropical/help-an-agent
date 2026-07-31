export default {
  "name": "Help an Agent",
  "id": "0000000000000000000",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "src/index.html",
  "editorType": ["figma", "dev"],
  "documentAccess": "dynamic-page",
  "menu": [
    { "command": "snapshot", "name": "Export Snapshot…" },
    { "command": "diff", "name": "Diff Against Snapshot…" }
  ],
  "networkAccess": {
    "allowedDomains": ["none"],
    "reasoning": "Help an Agent reads the current file and writes report files locally. It never sends design data anywhere."
  }
};
