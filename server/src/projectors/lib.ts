/**
 * Shared helpers for turning CSM elements into PlantUML source.
 *
 * Everything here is pure and total. The projectors are the reason this system
 * does not need an LLM to write PlantUML, so they must never throw on a CSM
 * that passed integrity validation, and never emit a token sequence PlantUML
 * cannot parse.
 */

/** Characters PlantUML accepts in a bare alias. */
const ALIAS_SAFE = /[^A-Za-z0-9_]/g;

/**
 * Converts a CSM id into an alias PlantUML can use unquoted.
 *
 * PlantUML aliases may not contain hyphens, dots or spaces — a hyphen in
 * particular parses as an arrow fragment and produces baffling errors far from
 * the actual line. CSM ids are slug-style and routinely contain them.
 */
export function alias(id: string): string {
  const cleaned = id.replace(ALIAS_SAFE, '_');
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned || '_';
}

/**
 * Escapes a human-readable label for use inside a double-quoted PlantUML string.
 *
 * This is the single largest source of breakage in generated PlantUML: an
 * unescaped quote silently swallows the rest of the line, and a raw newline
 * ends the statement early.
 */
export function esc(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r\n|\r|\n/g, '\\n')
    .trim();
}

/**
 * Escapes a label that appears after a colon (arrow labels, transition labels).
 *
 * These are not quoted, so the danger is different: a newline terminates the
 * statement, and a trailing backslash escapes the line break PlantUML needs.
 */
export function escInline(text: string): string {
  return text
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\\/g, '/')
    .trim();
}

/** Keeps diagrams readable when the model writes an essay into a label. */
export function truncate(text: string, max = 90): string {
  const clean = text.trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** A quoted display name bound to a stable alias: `"Order Service" as order_service`. */
export function named(displayName: string, id: string): string {
  return `"${esc(truncate(displayName, 60))}" as ${alias(id)}`;
}

export interface WrapOptions {
  title: string;
  /** Extra directives (skinparam, hide, direction) emitted before the body. */
  directives?: string[];
}

/** Shared look, applied to every diagram so a run's output reads as one set. */
const BASE_DIRECTIVES = [
  'skinparam backgroundColor #FFFFFF',
  'skinparam shadowing false',
  'skinparam defaultFontName "Helvetica"',
  'skinparam defaultFontSize 12',
  'skinparam roundCorner 6',
  'skinparam ArrowColor #33475B',
  'skinparam NoteBackgroundColor #FFF8E1',
  'skinparam NoteBorderColor #E0C97F',
];

/** Wraps body lines in a complete, self-contained `@startuml … @enduml` document. */
export function wrap(body: string[], options: WrapOptions): string {
  const lines = [
    '@startuml',
    `title ${escInline(truncate(options.title, 100))}`,
    ...BASE_DIRECTIVES,
    ...(options.directives ?? []),
    '',
    ...body.filter((line) => line !== undefined),
    '',
    '@enduml',
  ];
  return `${lines.join('\n')}\n`;
}

/**
 * A valid placeholder diagram.
 *
 * A requested type whose CSM slice is genuinely empty must still produce a
 * renderable PNG that says so, rather than an empty document (which PlantUML
 * rejects) or a failed diagram (which reads as a system error when it is
 * really a gap in the brief).
 */
export function emptyDiagram(title: string, reason: string): string {
  return wrap(
    [
      'skinparam noteFontSize 13',
      `note as N`,
      `  **Not enough information**`,
      `  ${escInline(reason)}`,
      'end note',
    ],
    { title },
  );
}

/** Indents nested block content. */
export function indent(lines: string[], depth = 1): string[] {
  const pad = '  '.repeat(depth);
  return lines.map((line) => (line === '' ? line : `${pad}${line}`));
}

/** Stereotype guillemets, as PlantUML expects them. */
export function stereotype(name: string): string {
  return `<<${escInline(name)}>>`;
}
