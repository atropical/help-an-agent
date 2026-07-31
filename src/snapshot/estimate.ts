import { ProbeResult } from "../types.d";
import { encodeSnapshot, FORMATS, OutputFormats } from "./encode";
import { estimateTokens } from "../utils/tokens";

export interface FormatEstimate {
  tokens: number;
  bytes: number;
}

export interface ScanEstimate {
  componentCount: number;
  sampleSize: number;
  /** Predicted wall-clock for a full scan, including the fixed overhead. */
  millis: number;
  perFormat: Record<OutputFormats, FormatEstimate>;
}

/**
 * Extrapolates a full scan from a sampled one.
 *
 * Both time and output size are modelled as `fixed + perComponent × count`.
 * Taking the fixed part from a component-free encode of the same file matters:
 * a library with 6 variable collections and 366 variables carries thousands of
 * tokens that have nothing to do with how many components it has.
 */
export function estimateScan(probe: ProbeResult): ScanEstimate {
  const { componentCount, sampleSize, sampleMs, overheadMs } = probe;
  const perComponentMs = sampleSize > 0 ? sampleMs / sampleSize : 0;

  const perFormat = {} as Record<OutputFormats, FormatEstimate>;
  for (const descriptor of FORMATS) {
    const sampleText = encodeSnapshot(probe.sample, descriptor.format);
    const baseText = encodeSnapshot(probe.base, descriptor.format);

    const baseTokens = estimateTokens(baseText);
    const baseBytes = baseText.length;
    const perComponentTokens =
      sampleSize > 0 ? Math.max(0, estimateTokens(sampleText) - baseTokens) / sampleSize : 0;
    const perComponentBytes = sampleSize > 0 ? Math.max(0, sampleBytes(sampleText, baseBytes)) / sampleSize : 0;

    perFormat[descriptor.format] = {
      tokens: Math.round(baseTokens + perComponentTokens * componentCount),
      bytes: Math.round(baseBytes + perComponentBytes * componentCount),
    };
  }

  return {
    componentCount,
    sampleSize,
    millis: overheadMs + perComponentMs * componentCount,
    perFormat,
  };
}

function sampleBytes(sampleText: string, baseBytes: number): number {
  return sampleText.length - baseBytes;
}

/** `95 s` -> `~1 min 35 s`. Deliberately coarse: this is a prediction. */
export function formatDuration(millis: number): string {
  const seconds = Math.round(millis / 1000);
  if (seconds < 1) return "under a second";
  if (seconds < 60) return `~${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 10) return rest === 0 ? `~${minutes} min` : `~${minutes} min ${rest} s`;
  return `~${minutes} min`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
