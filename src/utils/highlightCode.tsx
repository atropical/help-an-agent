import React from "react";

/**
 * Small, dependency-free highlighter for the three formats this plugin emits.
 * It is line-based on purpose: the preview is long, and a per-line pass keeps
 * rendering cheap and lets very long files be sliced without breaking spans.
 */
export type CodeLanguage = "json" | "toon" | "markdown";

const COLOURS = {
  key: "var(--figma-color-text-brand, #7cc4ff)",
  string: "var(--figma-color-text-success, #8ce99a)",
  number: "var(--figma-color-text-warning, #ffd43b)",
  literal: "var(--figma-color-text-danger, #ff8787)",
  punctuation: "var(--figma-color-text-tertiary, #8f8f8f)",
  heading: "var(--figma-color-text-brand, #7cc4ff)",
  meta: "var(--figma-color-text-secondary, #a0a0a0)",
};

export function renderCodeLines(code: string, language: CodeLanguage): React.ReactNode {
  const lines = code.split("\n");
  return lines.map((line, index) => (
    <React.Fragment key={index}>
      {highlightLine(line, language)}
      {index < lines.length - 1 ? "\n" : null}
    </React.Fragment>
  ));
}

function highlightLine(line: string, language: CodeLanguage): React.ReactNode {
  switch (language) {
    case "json":
      return tokenise(line, JSON_RULES);
    case "toon":
      return tokenise(line, TOON_RULES);
    case "markdown":
      return highlightMarkdown(line);
  }
}

interface Rule {
  pattern: RegExp;
  colour: string;
}

/** Order matters — the first rule that matches at a position wins. */
const JSON_RULES: Rule[] = [
  { pattern: /^"(?:[^"\\]|\\.)*"(?=\s*:)/, colour: COLOURS.key },
  { pattern: /^"(?:[^"\\]|\\.)*"/, colour: COLOURS.string },
  { pattern: /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, colour: COLOURS.number },
  { pattern: /^(?:true|false|null)\b/, colour: COLOURS.literal },
  { pattern: /^[{}[\],:]/, colour: COLOURS.punctuation },
];

const TOON_RULES: Rule[] = [
  // `key[3]{a,b}:` — the whole header reads as one unit to a human.
  { pattern: /^\s*-?\s*"?[^"\s:[\]{}]+"?(?=\s*(?:\[[^\]]*\])?(?:\{[^}]*\})?\s*:)/, colour: COLOURS.key },
  { pattern: /^\[[^\]]*\]|^\{[^}]*\}/, colour: COLOURS.punctuation },
  { pattern: /^"(?:[^"\\]|\\.)*"/, colour: COLOURS.string },
  { pattern: /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/, colour: COLOURS.number },
  { pattern: /^(?:true|false|null)\b/, colour: COLOURS.literal },
  { pattern: /^[:,|]/, colour: COLOURS.punctuation },
];

function tokenise(line: string, rules: Rule[]): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let rest = line;
  let plain = "";
  let key = 0;

  const flush = () => {
    if (plain) {
      nodes.push(plain);
      plain = "";
    }
  };

  while (rest.length > 0) {
    const rule = rules.find((candidate) => candidate.pattern.test(rest));
    const match = rule ? rule.pattern.exec(rest) : null;

    if (!rule || !match || match[0].length === 0) {
      plain += rest[0];
      rest = rest.slice(1);
      continue;
    }

    flush();
    nodes.push(
      <span key={key++} style={{ color: rule.colour }}>
        {match[0]}
      </span>,
    );
    rest = rest.slice(match[0].length);
  }

  flush();
  return nodes;
}

function highlightMarkdown(line: string): React.ReactNode {
  if (/^#{1,6}\s/.test(line)) {
    return <span style={{ color: COLOURS.heading, fontWeight: 600 }}>{line}</span>;
  }
  if (/^\s*\|/.test(line)) {
    return <span style={{ color: COLOURS.meta }}>{line}</span>;
  }
  if (/^\s*[-*]\s/.test(line)) {
    return (
      <>
        <span style={{ color: COLOURS.punctuation }}>{line.slice(0, line.indexOf(line.trim()[0]) + 1)}</span>
        {line.slice(line.indexOf(line.trim()[0]) + 1)}
      </>
    );
  }
  return line;
}
