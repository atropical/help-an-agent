import React from "react";
import { Button, Flex, Label, Text } from "figma-kit";
import { FORMATS, OutputFormats } from "../snapshot/encode";
import { formatTokens, savingsPercent } from "../utils/tokens";

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
                ≈{formatTokens(count)}
                {saved > 0 ? ` · −${saved}%` : ""}
              </span>
            </Button>
          );
        })}
      </Flex>
      {hint && (
        <Text size="small" style={{ color: "var(--figma-color-text-secondary)" }}>
          {hint} Token counts are estimated (±10%), measured against JSON.
        </Text>
      )}
    </Flex>
  );
};
