import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "figma-kit/styles.css";
import { MessageTypes, PluginCommands, PluginMessage } from "./types.d";
import { SnapshotView } from "./views/SnapshotView";
import { DiffView } from "./views/DiffView";

const App: React.FC = () => {
  const [command, setCommand] = useState<PluginCommands>(PluginCommands.SNAPSHOT);
  const [editorType, setEditorType] = useState<string>("figma");

  useEffect(() => {
    const handleMessage = ({ data: { pluginMessage } }: MessageEvent<{ pluginMessage?: PluginMessage }>) => {
      if (pluginMessage?.type !== MessageTypes.BASIC_INFO) return;
      if (pluginMessage.command) setCommand(pluginMessage.command);
      if (pluginMessage.editorType) setEditorType(pluginMessage.editorType);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return command === PluginCommands.DIFF ? (
    <DiffView editorType={editorType} />
  ) : (
    <SnapshotView editorType={editorType} />
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
