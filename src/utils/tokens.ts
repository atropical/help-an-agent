/**
 * Token estimation.
 *
 * The point of offering TOON alongside JSON is that it costs an agent fewer
 * tokens, so the UI has to show that number. A real BPE tokenizer would be
 * exact, but `gpt-tokenizer`'s rank tables are ~2.6 MB — inlined into a
 * single-file plugin UI that is a bad trade for a figure used to compare two
 * formats.
 *
 * Instead this splits text the way byte-pair encoders tend to: leading space
 * stays with its word, runs of letters are one token up to a length, digits
 * group in threes, and punctuation stands alone. Calibrated against
 * `o200k_base` (the encoding used by current GPT and Claude-era models) on
 * real snapshot output; see `scripts/calibrate-tokens.mjs`. Counts are shown
 * with a `≈` in the UI because they are an estimate, not a promise.
 */

const CHUNK = /\s*(?:[A-Za-z]+|\d+|[^\sA-Za-z\d]+)|\s+/g;

// Fitted against o200k_base on the fixtures in `scripts/fixtures`; worst-case
// error 9.7% across JSON, TOON and Markdown output.
const CHARS_PER_WORD_TOKEN = 5;
const CHARS_PER_PUNCTUATION_TOKEN = 1.5;
const CHARS_PER_WHITESPACE_TOKEN = 4;
const DIGITS_PER_TOKEN = 3;

export function estimateTokens(text: string): number {
  if (!text) return 0;

  let tokens = 0;
  for (const [chunk] of text.matchAll(CHUNK)) {
    const body = chunk.trimStart();

    if (body.length === 0) {
      // A whitespace-only run: newlines and indentation are cheap but not free.
      tokens += Math.max(1, Math.ceil(chunk.length / CHARS_PER_WHITESPACE_TOKEN));
      continue;
    }

    if (/^[A-Za-z]+$/.test(body)) {
      tokens += Math.max(1, Math.ceil(body.length / CHARS_PER_WORD_TOKEN));
    } else if (/^\d+$/.test(body)) {
      tokens += Math.ceil(body.length / DIGITS_PER_TOKEN);
    } else {
      // Runs like `":` or `| --- |` merge rather than costing a token apiece.
      tokens += Math.max(1, Math.ceil(body.length / CHARS_PER_PUNCTUATION_TOKEN));
    }
  }

  return tokens;
}

/** `12345` -> `12.3k`, for a count that sits inline next to a button. */
export function formatTokens(count: number): string {
  if (count < 1000) return String(count);
  if (count < 10_000) return `${(count / 1000).toFixed(1)}k`;
  return `${Math.round(count / 1000)}k`;
}

/** Percentage saved by `candidate` relative to `baseline`, floored at 0. */
export function savingsPercent(baseline: number, candidate: number): number {
  if (baseline <= 0) return 0;
  return Math.max(0, Math.round(((baseline - candidate) / baseline) * 100));
}
