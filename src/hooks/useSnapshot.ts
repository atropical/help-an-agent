import { useCallback, useEffect, useState } from "react";
import { MessageTypes, PluginMessage, Snapshot, SnapshotOptions } from "../types.d";

export interface SnapshotState {
  snapshot: Snapshot | null;
  building: boolean;
  progress: { stage: string; scanned: number; total: number } | null;
  error: string | null;
}

/**
 * Owns the request/response round-trip with the plugin thread. Both views need
 * a snapshot of the current file, so the logic lives here rather than being
 * duplicated per view.
 */
export function useSnapshot() {
  const [state, setState] = useState<SnapshotState>({
    snapshot: null,
    building: false,
    progress: null,
    error: null,
  });

  useEffect(() => {
    const handleMessage = ({ data: { pluginMessage } }: MessageEvent<{ pluginMessage?: PluginMessage }>) => {
      if (!pluginMessage) return;

      switch (pluginMessage.type) {
        case MessageTypes.SNAPSHOT_PROGRESS:
          setState((previous) => ({
            ...previous,
            progress: {
              stage: pluginMessage.stage ?? "",
              scanned: pluginMessage.scanned ?? 0,
              total: pluginMessage.total ?? 0,
            },
          }));
          break;
        case MessageTypes.SNAPSHOT_RESULT:
          setState({
            snapshot: pluginMessage.snapshot ?? null,
            building: false,
            progress: null,
            error: null,
          });
          break;
        case MessageTypes.SNAPSHOT_ERROR:
          setState((previous) => ({
            ...previous,
            building: false,
            progress: null,
            error: pluginMessage.error ?? "Unknown error",
          }));
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const build = useCallback((options: SnapshotOptions) => {
    setState({ snapshot: null, building: true, progress: null, error: null });
    parent.postMessage({ pluginMessage: { type: MessageTypes.BUILD_SNAPSHOT, options } }, "*");
  }, []);

  return { ...state, build };
}
