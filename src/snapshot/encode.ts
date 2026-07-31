import { decode as toonDecode, encode as toonEncode } from "@toon-format/toon";
import { DiffReport, SNAPSHOT_SCHEMA, Snapshot } from "../types.d";
import { normalize } from "../utils/stable";
import { diffToMarkdown, snapshotToMarkdown } from "./markdown";

export enum OutputFormats {
  TOON = "toon",
  JSON = "json",
  MARKDOWN = "markdown",
}

export interface FormatDescriptor {
  format: OutputFormats;
  label: string;
  extension: string;
  language: "toon" | "json" | "markdown";
  hint: string;
}

export const FORMATS: FormatDescriptor[] = [
  {
    format: OutputFormats.TOON,
    label: "TOON",
    extension: "toon",
    language: "toon",
    hint: "Same data as JSON, fewer tokens. Losslessly convertible back to JSON.",
  },
  {
    format: OutputFormats.JSON,
    label: "JSON",
    extension: "json",
    language: "json",
    hint: "Universal. Pretty-printed so `git diff` stays line-oriented.",
  },
  {
    format: OutputFormats.MARKDOWN,
    label: "Markdown",
    extension: "md",
    language: "markdown",
    hint: "Prose report for an agent that greps rather than parses.",
  },
];

/**
 * All three encoders read from the same canonical value, so a snapshot is
 * byte-stable regardless of which format it is written in.
 */
export function encodeSnapshot(snapshot: Snapshot, format: OutputFormats): string {
  if (format === OutputFormats.MARKDOWN) return snapshotToMarkdown(snapshot);
  return encodeData(snapshot, format);
}

export function encodeDiff(report: DiffReport, format: OutputFormats): string {
  if (format === OutputFormats.MARKDOWN) return diffToMarkdown(report);
  return encodeData(report, format);
}

/**
 * Reads a snapshot the plugin previously wrote, in either machine format.
 * A Markdown report is a rendering, not a source — it cannot be read back.
 */
export function parseSnapshot(text: string, fileName: string): Snapshot {
  const looksLikeToon = fileName.toLowerCase().endsWith(".toon") || !text.trimStart().startsWith("{");
  const parsed = (looksLikeToon ? toonDecode(text) : JSON.parse(text)) as Snapshot;

  if (!parsed || parsed.schema !== SNAPSHOT_SCHEMA) {
    // A mismatched schema would produce a diff full of phantom changes, which
    // is worse for an agent than refusing outright.
    throw new Error(`Unsupported snapshot schema: ${parsed?.schema ?? "missing"}`);
  }
  return parsed;
}

function encodeData(value: unknown, format: OutputFormats): string {
  const canonical = normalize(value);
  if (format === OutputFormats.TOON) {
    return `${toonEncode(canonical)}\n`;
  }
  return `${JSON.stringify(canonical, null, 2)}\n`;
}
