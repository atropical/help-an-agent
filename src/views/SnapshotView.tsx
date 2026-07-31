import React, { useState } from "react";
import { Button, Flex, Text } from "figma-kit";
import { PluginDialogShell } from "../components/PluginDialogShell";
import { OptionsPanel } from "../components/OptionsPanel";
import { useSnapshot } from "../hooks/useSnapshot";
import { DEFAULT_OPTIONS } from "../snapshot/buildSnapshot";
import { snapshotToMarkdown } from "../snapshot/markdown";
import { copyText, downloadText, slugify } from "../utils/download";
import { stableStringify } from "../utils/stable";
import { SnapshotOptions } from "../types.d";

export const SnapshotView: React.FC = () => {
  const { snapshot, building, progress, error, build } = useSnapshot();
  const [options, setOptions] = useState<SnapshotOptions>(DEFAULT_OPTIONS);
  const [copied, setCopied] = useState(false);

  const baseName = snapshot ? `${slugify(snapshot.meta.fileName)}.snapshot` : "snapshot";

  // Snapshots are written pretty-printed on purpose: line-oriented output is
  // what makes `git diff` legible to a human reviewing the agent's reasoning.
  const json = snapshot ? `${JSON.stringify(JSON.parse(stableStringify(snapshot)), null, 2)}\n` : "";

  return (
    <PluginDialogShell>
      <Flex direction="column" gap="2">
        <Text weight="strong">Export a snapshot of this library</Text>
        <Text size="small" style={{ opacity: 0.7 }}>
          Writes every component, style and variable to a deterministic file. Commit it to your repo, and
          `git diff` becomes the changelog your agent reads.
        </Text>
      </Flex>

      <OptionsPanel options={options} onChange={setOptions} disabled={building} />

      <Flex gap="2">
        <Button variant="primary" onClick={() => build(options)} disabled={building}>
          {building ? "Scanning…" : "Scan file"}
        </Button>
      </Flex>

      {building && progress && (
        <Text size="small" style={{ opacity: 0.7 }}>
          {progress.stage}: {progress.scanned}/{progress.total}
        </Text>
      )}

      {error && <Text style={{ color: "var(--figma-color-text-danger)" }}>{error}</Text>}

      {snapshot && (
        <Flex direction="column" gap="3" style={{ flex: 1, minHeight: 0 }}>
          <Flex direction="column" gap="1">
            <Text weight="strong">{snapshot.meta.fileName}</Text>
            {Object.entries(snapshot.meta.counts).map(([name, count]) => (
              <Text key={name} size="small" style={{ opacity: 0.7 }}>
                {name}: {count}
              </Text>
            ))}
          </Flex>

          <Flex gap="2" wrap="wrap">
            <Button onClick={() => downloadText(`${baseName}.json`, json)}>Download JSON</Button>
            <Button
              onClick={() =>
                downloadText(`${baseName}.md`, snapshotToMarkdown(snapshot), "text/markdown")
              }
            >
              Download Markdown
            </Button>
            <Button
              onClick={async () => {
                setCopied(await copyText(json));
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "Copied" : "Copy JSON"}
            </Button>
          </Flex>
        </Flex>
      )}
    </PluginDialogShell>
  );
};
