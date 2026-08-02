import { decode as toonDecode, encode as toonEncode } from "@toon-format/toon";
import { DiffReport, SNAPSHOT_SCHEMA, Snapshot } from "../types.d";
import { canonicalize } from "../utils/stable";
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
  /** Shown under the hint for formats a user is unlikely to have met before. */
  footnote?: { text: string; href: string; label: string };
}

/** Ordered cheapest-and-most-readable first; the first entry is the default. */
export const FORMATS: FormatDescriptor[] = [
  {
    format: OutputFormats.MARKDOWN,
    label: "Markdown",
    extension: "md",
    language: "markdown",
    hint: "Prose report for an agent that greps rather than parses. Cheapest, but a rendering — it cannot be loaded back as a diff base.",
  },
  {
    format: OutputFormats.TOON,
    label: "TOON",
    extension: "toon",
    language: "toon",
    hint: "Same data as JSON in far fewer tokens, and losslessly convertible back to JSON.",
    footnote: {
      text: "TOON is a compact encoding of the JSON data model, built for LLM input.",
      href: "https://toonformat.dev",
      label: "toonformat.dev ↗",
    },
  },
  {
    format: OutputFormats.JSON,
    label: "JSON",
    extension: "json",
    language: "json",
    hint: "Universal. Pretty-printed so `git diff` stays line-oriented.",
  },
];

export const DEFAULT_FORMAT = FORMATS[0].format;

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
  const canonical = canonicalize(value);
  if (format === OutputFormats.TOON) {
    return `${toonEncode(canonical)}\n`;
  }
  return `${JSON.stringify(canonical, null, 2)}\n`;
}
