/// <reference types="@figma/plugin-typings" />

import { MessageTypes, PluginCommands, PluginMessage } from "./types.d";
import { buildSnapshot, DEFAULT_OPTIONS } from "./snapshot/buildSnapshot";

figma.showUI(__html__, { width: 640, height: 640, themeColors: true });

figma.on("run", ({ command }) => {
  figma.ui.postMessage({
    type: MessageTypes.BASIC_INFO,
    command: (command as PluginCommands) || PluginCommands.SNAPSHOT,
    editorType: figma.editorType || "figma",
  } as PluginMessage);
});

figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type !== MessageTypes.BUILD_SNAPSHOT) return;

  try {
    const snapshot = await buildSnapshot(msg.options ?? DEFAULT_OPTIONS, (stage, scanned, total) => {
      figma.ui.postMessage({ type: MessageTypes.SNAPSHOT_PROGRESS, stage, scanned, total } as PluginMessage);
    });

    figma.ui.postMessage({ type: MessageTypes.SNAPSHOT_RESULT, snapshot } as PluginMessage);
  } catch (error) {
    console.error(error);
    figma.ui.postMessage({
      type: MessageTypes.SNAPSHOT_ERROR,
      error: error instanceof Error ? error.message : "Unknown error while building the snapshot",
    } as PluginMessage);
  }
};
