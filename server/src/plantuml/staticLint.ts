import type { ValidationError } from './types.js';

/**
 * Directives that let a diagram read local files or make outbound requests.
 *
 * This is a real security boundary, not tidiness. PlantUML's include family
 * resolves paths on the rendering host and `!includeurl` performs an HTTP GET,
 * so a diagram source is an SSRF and file-disclosure primitive. Our own
 * projectors never emit these, but two paths carry user-influenced source into
 * the renderer: the LLM repair path, and `correctedPlantuml` submitted through
 * the feedback endpoint. Both go through this check.
 *
 * The JVM is additionally run under PlantUML's SANDBOX security profile, so
 * this is defence in depth rather than the only control.
 */
const BANNED_DIRECTIVES = [
  /^\s*!include\b/i,
  /^\s*!includeurl\b/i,
  /^\s*!includesub\b/i,
  /^\s*!import\b/i,
  /^\s*!theme\s+\S+\s+from\s/i,
  /^\s*%invoke\b/i,
  /^\s*!function\s+%/i,
];

const START_TAG = /^\s*@start(\w+)/;
const END_TAG = /^\s*@end(\w+)/;

export interface LintOptions {
  /** Keywords that must not appear for this diagram type. */
  bannedKeywords?: string[];
}

/**
 * Cheap, dependency-free checks run before the JVM is ever started.
 *
 * Everything here executes in microseconds, so a malformed draft costs nothing
 * to reject — where a JVM round trip costs about a second. Only sources that
 * survive this reach `verify()`.
 */
export function staticLint(source: string, options: LintOptions = {}): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = source.split('\n');

  if (source.trim() === '') {
    return [{ message: 'Source is empty', line: null }];
  }

  if (/^\s*```/m.test(source)) {
    errors.push({ message: 'Source contains a markdown code fence', line: lineOf(lines, /^\s*```/) });
  }

  lines.forEach((line, index) => {
    for (const pattern of BANNED_DIRECTIVES) {
      if (pattern.test(line)) {
        errors.push({
          message: `Disallowed directive: ${line.trim()}. Include and invoke directives are blocked for security.`,
          line: index + 1,
        });
      }
    }
  });

  const starts = lines.filter((l) => START_TAG.test(l));
  const ends = lines.filter((l) => END_TAG.test(l));

  if (starts.length === 0) {
    errors.push({ message: 'Missing @startuml', line: null });
  } else if (starts.length > 1) {
    errors.push({
      message: `Expected exactly one diagram block, found ${starts.length} @start tags`,
      line: lineOf(lines, START_TAG, 1),
    });
  }

  if (ends.length === 0) {
    errors.push({ message: 'Missing @enduml', line: null });
  } else if (ends.length > 1) {
    errors.push({
      message: `Expected exactly one @end tag, found ${ends.length}`,
      line: lineOf(lines, END_TAG, 1),
    });
  }

  if (starts.length === 1 && ends.length === 1) {
    const startIndex = lines.findIndex((l) => START_TAG.test(l));
    const endIndex = lines.findIndex((l) => END_TAG.test(l));
    if (endIndex < startIndex) {
      errors.push({ message: '@end tag appears before @start tag', line: endIndex + 1 });
    } else {
      const bodyLines = lines.slice(startIndex + 1, endIndex).filter((l) => l.trim() !== '');
      if (bodyLines.length === 0) {
        errors.push({ message: 'Diagram body is empty', line: startIndex + 1 });
      }
    }
    const startKind = starts[0]!.match(START_TAG)?.[1];
    const endKind = ends[0]!.match(END_TAG)?.[1];
    if (startKind && endKind && startKind !== endKind) {
      errors.push({ message: `@start${startKind} closed by @end${endKind}`, line: endIndex + 1 });
    }
  }

  errors.push(...checkBalance(lines));

  for (const keyword of options.bannedKeywords ?? []) {
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(keyword)}\\b`, 'i');
    const index = lines.findIndex((l) => pattern.test(stripLiterals(l)));
    if (index !== -1) {
      errors.push({
        message: `"${keyword}" does not belong in this diagram type`,
        line: index + 1,
      });
    }
  }

  return errors;
}

/**
 * Bracket balance, ignoring anything inside quotes and free-text blocks.
 *
 * `note`/`legend` bodies are prose and routinely contain unmatched brackets, so
 * counting them produces false rejections on perfectly good diagrams.
 */
function checkBalance(lines: string[]): ValidationError[] {
  const pairs: Record<string, string> = { '}': '{', ']': '[', ')': '(' };
  const openers = new Set(Object.values(pairs));
  const stack: { char: string; line: number }[] = [];
  let inFreeText = false;

  lines.forEach((raw, index) => {
    const trimmed = raw.trim().toLowerCase();
    if (/^(note|legend|caption|header|footer)\b/.test(trimmed) && !/\bend\s*(note|legend)?\b/.test(trimmed)) {
      // A single-line `note X : text` form does not open a block.
      if (!trimmed.includes(':')) inFreeText = true;
      return;
    }
    if (/^end\s*(note|legend|header|footer|caption)?$/.test(trimmed)) {
      inFreeText = false;
      return;
    }
    if (inFreeText) return;

    for (const char of stripLiterals(raw)) {
      if (openers.has(char)) {
        stack.push({ char, line: index + 1 });
      } else if (pairs[char]) {
        const top = stack.pop();
        if (!top || top.char !== pairs[char]) {
          return void stack.push({ char: `unmatched ${char}`, line: index + 1 });
        }
      }
    }
  });

  const unbalanced = stack.filter((s) => s.char.startsWith('unmatched') || openers.has(s.char));
  return unbalanced.slice(0, 3).map((s) => ({
    message: s.char.startsWith('unmatched')
      ? `Unbalanced bracket: ${s.char}`
      : `Unclosed "${s.char}" opened here`,
    line: s.line,
  }));
}

/** Blanks out quoted strings so their contents cannot affect structural checks. */
function stripLiterals(line: string): string {
  return line.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'.*$/, '');
}

function lineOf(lines: string[], pattern: RegExp, skip = 0): number | null {
  let seen = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (pattern.test(lines[i]!)) {
      if (seen === skip) return i + 1;
      seen += 1;
    }
  }
  return null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
