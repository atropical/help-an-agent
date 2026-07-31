import React, { useMemo, useRef, useState } from "react";
import { Button, Flex, Text } from "figma-kit";
import { PluginDialogShell } from "../components/PluginDialogShell";
import { ExportLayout } from "../components/ExportLayout";
import { FormatSelector } from "../components/FormatSelector";
import { OptionsPanel } from "../components/OptionsPanel";
import { OutputPreview } from "../components/OutputPreview";
import { useSnapshot } from "../hooks/useSnapshot";
import { useEncodedOutput } from "../hooks/useEncodedOutput";
import { DEFAULT_OPTIONS } from "../snapshot/buildSnapshot";
import { diffSnapshots } from "../snapshot/diff";
import { encodeDiff, FORMATS, OutputFormats, parseSnapshot } from "../snapshot/encode";
import { downloadText, readFileAsText, slugify } from "../utils/download";
import { DiffEntry, Snapshot, SnapshotOptions } from "../types.d";
import { mimeFor } from "./SnapshotView";

interface DiffViewProps {
  editorType?: string;
}

export const DiffView: React.FC<DiffViewProps> = ({ editorType }) => {
  const { snapshot, building, progress, error, build } = useSnapshot();
  const [options, setOptions] = useState<SnapshotOptions>(DEFAULT_OPTIONS);
  const [format, setFormat] = useState<OutputFormats>(OutputFormats.MARKDOWN);
  const [base, setBase] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const report = useMemo(
    () => (base && snapshot ? diffSnapshots(base, snapshot) : null),
    [base, snapshot],
  );
  const { outputs, tokens } = useEncodedOutput(report, encodeDiff);

  const descriptor = FORMATS.find((entry) => entry.format === format)!;
  const fileName = snapshot
    ? `${slugify(snapshot.meta.fileName)}.diff.${descriptor.extension}`
    : `diff.${descriptor.extension}`;

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoadError(null);
    try {
      setBase(parseSnapshot(await readFileAsText(file), file.name));
    } catch (cause) {
      setBase(null);
      setLoadError(cause instanceof Error ? cause.message : "Could not read that file");
    } finally {
      event.target.value = "";
    }
  };

  const entries = report ? [...report.components, ...report.styles, ...report.variables] : [];

  return (
    <PluginDialogShell>
      <ExportLayout
        editorType={editorType}
        preview={
          report ? (
            <OutputPreview
              content={outputs[format]}
              language={descriptor.language}
              previewId="help-an-agent-diff"
              onDownload={() => downloadText(fileName, outputs[format], mimeFor(format))}
              downloadLabel={`Download .${descriptor.extension}`}
            />
          ) : null
        }
      >
        <Flex direction="column" gap="2">
          <Text weight="strong">Diff against a previous snapshot</Text>
          <Text size="small" style={{ color: "var(--figma-color-text-secondary)" }}>
            Load the snapshot your last run produced, rescan the file, and get a report of exactly what an
            agent needs to know.
          </Text>
        </Flex>

        <Flex direction="column" gap="2">
          <Flex gap="2" align="center" wrap="wrap">
            <Button onClick={() => fileInput.current?.click()}>Load base snapshot…</Button>
            <Text size="small" style={{ color: "var(--figma-color-text-secondary)" }}>
              {base ? `${base.meta.fileName} · ${base.meta.generatedAt}` : "No base loaded (.json or .toon)"}
            </Text>
          </Flex>
          <input
            ref={fileInput}
            type="file"
            accept=".json,.toon,application/json,text/plain"
            onChange={handleFile}
            style={{ display: "none" }}
          />
          {loadError && <Text style={{ color: "var(--figma-color-text-danger)" }}>{loadError}</Text>}
        </Flex>

        <OptionsPanel options={options} onChange={setOptions} disabled={building} />

        <Flex gap="2">
          <Button variant="primary" onClick={() => build(options)} disabled={building || !base}>
            {building ? "Scanning…" : "Scan and compare"}
          </Button>
        </Flex>

        {building && progress && (
          <Text size="small" style={{ color: "var(--figma-color-text-secondary)" }}>
            {progress.stage}: {progress.scanned}/{progress.total}
          </Text>
        )}
        {error && <Text style={{ color: "var(--figma-color-text-danger)" }}>{error}</Text>}

        {report && (
          <>
            <FormatSelector value={format} onChange={setFormat} tokens={tokens} />
            <Text weight="strong">
              {report.summary.added} added · {report.summary.removed} removed · {report.summary.renamed}{" "}
              renamed · {report.summary.modified} modified
            </Text>
            <Flex direction="column" gap="1" style={{ maxHeight: 220, overflowY: "auto" }}>
              {entries.slice(0, 200).map((entry) => (
                <EntryRow key={`${entry.kind}-${entry.key}-${entry.name}`} entry={entry} />
              ))}
              {entries.length === 0 && (
                <Text size="small" style={{ color: "var(--figma-color-text-secondary)" }}>
                  No changes between the two snapshots.
                </Text>
              )}
            </Flex>
          </>
        )}
      </ExportLayout>
    </PluginDialogShell>
  );
};

const KIND_COLOUR: Record<DiffEntry["kind"], string> = {
  added: "var(--figma-color-text-success)",
  removed: "var(--figma-color-text-danger)",
  renamed: "var(--figma-color-text-warning)",
  modified: "var(--figma-color-text-brand)",
};

const EntryRow: React.FC<{ entry: DiffEntry }> = ({ entry }) => (
  <Flex direction="column" gap="1" style={{ padding: "0.25rem 0" }}>
    <Flex gap="2" align="center">
      <Text size="small" weight="strong" style={{ color: KIND_COLOUR[entry.kind] }}>
        {entry.kind}
      </Text>
      <Text size="small">{entry.name}</Text>
      {entry.previousName && (
        <Text size="small" style={{ color: "var(--figma-color-text-secondary)" }}>
          was {entry.previousName}
        </Text>
      )}
    </Flex>
    {entry.changes.slice(0, 5).map((change) => (
      <Text key={change.path} size="small" style={{ color: "var(--figma-color-text-secondary)", marginLeft: "1rem" }}>
        {change.path}
      </Text>
    ))}
    {entry.changes.length > 5 && (
      <Text size="small" style={{ color: "var(--figma-color-text-tertiary)", marginLeft: "1rem" }}>
        +{entry.changes.length - 5} more fields
      </Text>
    )}
  </Flex>
);
