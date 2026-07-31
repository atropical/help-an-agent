import React, { useMemo, useRef, useState } from "react";
import { Button, Flex, Text } from "figma-kit";
import { PluginDialogShell } from "../components/PluginDialogShell";
import { OptionsPanel } from "../components/OptionsPanel";
import { useSnapshot } from "../hooks/useSnapshot";
import { DEFAULT_OPTIONS } from "../snapshot/buildSnapshot";
import { diffSnapshots } from "../snapshot/diff";
import { diffToMarkdown } from "../snapshot/markdown";
import { copyText, downloadText, readFileAsText, slugify } from "../utils/download";
import { stableStringify } from "../utils/stable";
import { DiffEntry, SNAPSHOT_SCHEMA, Snapshot, SnapshotOptions } from "../types.d";

export const DiffView: React.FC = () => {
  const { snapshot, building, progress, error, build } = useSnapshot();
  const [options, setOptions] = useState<SnapshotOptions>(DEFAULT_OPTIONS);
  const [base, setBase] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const report = useMemo(
    () => (base && snapshot ? diffSnapshots(base, snapshot) : null),
    [base, snapshot],
  );

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoadError(null);
    try {
      const parsed = JSON.parse(await readFileAsText(file)) as Snapshot;
      if (parsed.schema !== SNAPSHOT_SCHEMA) {
        // A mismatched schema would silently produce a diff full of phantom
        // changes, which is worse for an agent than refusing outright.
        throw new Error(`Unsupported snapshot schema: ${parsed.schema ?? "missing"}`);
      }
      setBase(parsed);
    } catch (cause) {
      setBase(null);
      setLoadError(cause instanceof Error ? cause.message : "Could not read that file");
    } finally {
      event.target.value = "";
    }
  };

  const baseName = snapshot ? `${slugify(snapshot.meta.fileName)}.diff` : "diff";

  return (
    <PluginDialogShell>
      <Flex direction="column" gap="2">
        <Text weight="strong">Diff this library against a previous snapshot</Text>
        <Text size="small" style={{ opacity: 0.7 }}>
          Load the snapshot JSON your last run produced, scan the file again, and get a report of exactly
          what an agent needs to know.
        </Text>
      </Flex>

      <Flex direction="column" gap="2">
        <Flex gap="2" align="center">
          <Button onClick={() => fileInput.current?.click()}>Load base snapshot…</Button>
          <Text size="small" style={{ opacity: 0.7 }}>
            {base ? `${base.meta.fileName} · ${base.meta.generatedAt}` : "No base loaded"}
          </Text>
        </Flex>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
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
        <Text size="small" style={{ opacity: 0.7 }}>
          {progress.stage}: {progress.scanned}/{progress.total}
        </Text>
      )}
      {error && <Text style={{ color: "var(--figma-color-text-danger)" }}>{error}</Text>}

      {report && (
        <Flex direction="column" gap="3" style={{ flex: 1, minHeight: 0 }}>
          <Text weight="strong">
            {report.summary.added} added · {report.summary.removed} removed · {report.summary.renamed}{" "}
            renamed · {report.summary.modified} modified
          </Text>

          <Flex direction="column" gap="1" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {[...report.components, ...report.styles, ...report.variables].slice(0, 200).map((entry) => (
              <EntryRow key={`${entry.kind}-${entry.key}-${entry.name}`} entry={entry} />
            ))}
            {report.components.length + report.styles.length + report.variables.length === 0 && (
              <Text size="small" style={{ opacity: 0.7 }}>
                No changes between the two snapshots.
              </Text>
            )}
          </Flex>

          <Flex gap="2" wrap="wrap">
            <Button
              onClick={() =>
                downloadText(`${baseName}.md`, diffToMarkdown(report), "text/markdown")
              }
            >
              Download report
            </Button>
            <Button
              onClick={() =>
                downloadText(
                  `${baseName}.json`,
                  `${JSON.stringify(JSON.parse(stableStringify(report)), null, 2)}\n`,
                )
              }
            >
              Download JSON
            </Button>
            <Button onClick={() => copyText(diffToMarkdown(report))}>Copy report</Button>
          </Flex>
        </Flex>
      )}
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
        <Text size="small" style={{ opacity: 0.6 }}>
          was {entry.previousName}
        </Text>
      )}
    </Flex>
    {entry.changes.slice(0, 5).map((change) => (
      <Text key={change.path} size="small" style={{ opacity: 0.6, marginLeft: "1rem" }}>
        {change.path}
      </Text>
    ))}
    {entry.changes.length > 5 && (
      <Text size="small" style={{ opacity: 0.5, marginLeft: "1rem" }}>
        +{entry.changes.length - 5} more fields
      </Text>
    )}
  </Flex>
);
