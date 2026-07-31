import React, { useState } from "react";
import { Button, Flex, Text } from "figma-kit";
import { PluginDialogShell } from "../components/PluginDialogShell";
import { ExportLayout } from "../components/ExportLayout";
import { FormatSelector } from "../components/FormatSelector";
import { OptionsPanel } from "../components/OptionsPanel";
import { OutputPreview } from "../components/OutputPreview";
import { useSnapshot } from "../hooks/useSnapshot";
import { useEncodedOutput } from "../hooks/useEncodedOutput";
import { DEFAULT_OPTIONS } from "../snapshot/buildSnapshot";
import { encodeSnapshot, FORMATS, OutputFormats } from "../snapshot/encode";
import { downloadText, slugify } from "../utils/download";
import { SnapshotOptions } from "../types.d";

interface SnapshotViewProps {
  editorType?: string;
}

export const SnapshotView: React.FC<SnapshotViewProps> = ({ editorType }) => {
  const { snapshot, building, progress, error, build } = useSnapshot();
  const [options, setOptions] = useState<SnapshotOptions>(DEFAULT_OPTIONS);
  const [format, setFormat] = useState<OutputFormats>(OutputFormats.TOON);

  const { outputs, tokens } = useEncodedOutput(snapshot, encodeSnapshot);
  const descriptor = FORMATS.find((entry) => entry.format === format)!;
  const fileName = snapshot
    ? `${slugify(snapshot.meta.fileName)}.snapshot.${descriptor.extension}`
    : `snapshot.${descriptor.extension}`;

  return (
    <PluginDialogShell>
      <ExportLayout
        editorType={editorType}
        preview={
          snapshot ? (
            <OutputPreview
              content={outputs[format]}
              language={descriptor.language}
              onDownload={() => downloadText(fileName, outputs[format], mimeFor(format))}
              downloadLabel={`Download .${descriptor.extension}`}
            />
          ) : null
        }
      >
        <Flex direction="column" gap="2">
          <Text weight="strong">Export a snapshot of this library</Text>
          <Text size="small" style={{ color: "var(--figma-color-text-secondary)" }}>
            Writes every component, style and variable to a deterministic file. Commit it to your repo and
            `git diff` becomes the changelog your agent reads.
          </Text>
        </Flex>

        <OptionsPanel options={options} onChange={setOptions} disabled={building} />

        <Flex gap="2">
          <Button variant="primary" onClick={() => build(options)} disabled={building}>
            {building ? "Scanning…" : snapshot ? "Rescan file" : "Scan file"}
          </Button>
        </Flex>

        {building && progress && (
          <Text size="small" style={{ color: "var(--figma-color-text-secondary)" }}>
            {progress.stage}: {progress.scanned}/{progress.total}
          </Text>
        )}
        {error && <Text style={{ color: "var(--figma-color-text-danger)" }}>{error}</Text>}

        {snapshot && (
          <>
            <FormatSelector value={format} onChange={setFormat} tokens={tokens} />
            <Flex direction="column" gap="1">
              <Text weight="strong">{snapshot.meta.fileName}</Text>
              {Object.entries(snapshot.meta.counts).map(([name, count]) => (
                <Text key={name} size="small" style={{ color: "var(--figma-color-text-secondary)" }}>
                  {name}: {count}
                </Text>
              ))}
            </Flex>
          </>
        )}
      </ExportLayout>
    </PluginDialogShell>
  );
};

export function mimeFor(format: OutputFormats): string {
  if (format === OutputFormats.JSON) return "application/json";
  if (format === OutputFormats.MARKDOWN) return "text/markdown";
  return "text/plain";
}
