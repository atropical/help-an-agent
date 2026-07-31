import React from "react";
import { Button, Flex, Label, Text } from "figma-kit";
import { FORMATS, OutputFormats } from "../snapshot/encode";
import { formatTokenRange, savingsPercent, TOKEN_ERROR_MARGIN } from "../utils/tokens";

interface FormatSelectorProps {
  value: OutputFormats;
  onChange: (format: OutputFormats) => void;
  /** Estimated token count per format, for the current payload. */
  tokens: Record<OutputFormats, number>;
  disabled?: boolean;
}

/**
 * Token cost is the reason to pick one format over another when the consumer
 * is an agent, so it sits on the button rather than in a tooltip.
 */
export const FormatSelector: React.FC<FormatSelectorProps> = ({ value, onChange, tokens, disabled }) => {
  const baseline = tokens[OutputFormats.JSON];
  const hint = FORMATS.find((descriptor) => descriptor.format === value)?.hint;

  return (
    <Flex direction="column" gap="2">
      <Label style={{ color: "var(--figma-color-text-secondary)" }}>Format</Label>
      <Flex gap="2" wrap="wrap">
        {FORMATS.map((descriptor) => {
          const count = tokens[descriptor.format] ?? 0;
          const saved = savingsPercent(baseline, count);
          return (
            <Button
              key={descriptor.format}
              variant={descriptor.format === value ? "primary" : "secondary"}
              onClick={() => onChange(descriptor.format)}
              disabled={disabled}
            >
              {descriptor.label}
              <span style={{ opacity: 0.7, marginLeft: "0.5em" }}>
                {formatTokenRange(count)} tokens
                {saved > 0 ? ` · −${saved}%` : ""}
              </span>
            </Button>
          );
        })}
      </Flex>
      {hint && (
        <Text size="small" style={{ color: "var(--figma-color-text-secondary)" }}>
          {hint}
        </Text>
      )}
      <TokenMethodNote />
    </Flex>
  );
};

/**
 * The ranges are estimates, and an estimate presented without its method is
 * indistinguishable from a measurement. This is the method.
 */
const TokenMethodNote: React.FC = () => (
  <details style={{ color: "var(--figma-color-text-secondary)", fontSize: 11, lineHeight: 1.5 }}>
    <summary style={{ cursor: "pointer", userSelect: "none" }}>
      How are these token ranges calculated?
    </summary>
    <div style={{ paddingTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
      <span>
        The counts are <strong>estimated, not tokenised</strong>. A real tokenizer needs about 2.6 MB of
        byte-pair rank tables — too much to load inside a plugin for a figure whose job is to compare
        formats.
      </span>
      <span>
        Instead the text is split the way byte-pair encoders tend to split it: runs of letters count as
        one token per ~5 characters, digits group in threes, punctuation runs merge in pairs, and
        indentation and newlines are charged at a lower rate. Those rates were fitted against{" "}
        <code>o200k_base</code>, the encoding used by current frontier models, on real snapshot output.
      </span>
      <span>
        Worst measured deviation was 9.7%, so each figure is shown as a ±
        {Math.round(TOKEN_ERROR_MARGIN * 100)}% range. Your model's tokenizer will differ again — treat
        the range as a budget, not a bill.
      </span>
      <span>
        The percentage compares one format against JSON. It is more reliable than the absolute numbers,
        because both sides carry the same estimator bias and it largely cancels.
      </span>
    </div>
  </details>
);
