import React, { useMemo, useState } from "react";
import { Button, Flex, Text } from "figma-kit";
import { CodeLanguage, renderCodeLines } from "../utils/highlightCode";
import { copyText } from "../utils/download";

interface OutputPreviewProps {
  content: string;
  language: CodeLanguage;
  /** DOM id used by "Select result" so a user can copy by hand. */
  previewId?: string;
  onDownload: () => void;
  downloadLabel?: string;
}

/** A full library snapshot is megabytes; the preview only needs the shape. */
const PREVIEW_LINE_LIMIT = 600;

export const OutputPreview: React.FC<OutputPreviewProps> = ({
  content,
  language,
  previewId = "help-an-agent-output",
  onDownload,
  downloadLabel = "Download",
}) => {
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");

  const { visible, hiddenLines } = useMemo(() => {
    const lines = content.split("\n");
    if (lines.length <= PREVIEW_LINE_LIMIT) return { visible: content, hiddenLines: 0 };
    return {
      visible: lines.slice(0, PREVIEW_LINE_LIMIT).join("\n"),
      hiddenLines: lines.length - PREVIEW_LINE_LIMIT,
    };
  }, [content]);

  const handleCopy = async () => {
    // Always copies the full content, never the truncated preview.
    const ok = await copyText(content);
    setCopyStatus(ok ? "success" : "error");
    setTimeout(() => setCopyStatus("idle"), 2000);
  };

  const handleSelect = () => {
    const element = document.getElementById(previewId);
    if (!element) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  if (!content) return null;

  return (
    <Flex direction="column" gap="2" style={{ flex: "2 1 300px", minWidth: 0, minHeight: 0 }}>
      <Text>Preview</Text>
      <Flex
        direction="column"
        style={{
          position: "relative",
          border: "1px solid var(--figma-color-border)",
          borderRadius: 4,
          padding: 8,
          backgroundColor: "rgba(0,0,0,.25)",
          minWidth: 0,
          maxWidth: "100%",
          boxSizing: "border-box",
          flex: "1 1 auto",
          minHeight: 0,
        }}
      >
        <Flex
          direction="row"
          gap="2"
          style={{ alignSelf: "end", position: "sticky", top: 4, right: 4, backdropFilter: "blur(4px)", zIndex: 1 }}
        >
          <Button variant="secondary" onClick={handleCopy} disabled={copyStatus !== "idle"}>
            {copyStatus === "success" ? "✓ Copied!" : copyStatus === "error" ? "✗ Failed" : "Copy"}
          </Button>
          <Button variant="secondary" onClick={handleSelect}>
            Select result
          </Button>
          <Button variant="primary" onClick={onDownload}>
            {downloadLabel}
          </Button>
        </Flex>
        <pre
          id={previewId}
          style={{
            marginTop: "-1.75rem",
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            maxWidth: "100%",
            boxSizing: "border-box",
            fontSize: 11,
            lineHeight: 1.5,
          }}
          spellCheck="false"
        >
          {renderCodeLines(visible, language)}
        </pre>
      </Flex>
      {hiddenLines > 0 && (
        <Text size="small" style={{ color: "var(--figma-color-text-secondary)" }}>
          Preview truncated — {hiddenLines.toLocaleString()} more lines. Copy and download give you the
          whole file.
        </Text>
      )}
    </Flex>
  );
};
