export interface AutoFix {
  name: string;
  /** Returns the repaired source, or null when this fix does not apply. */
  apply: (source: string) => string | null;
}

/**
 * Deterministic repairs, tried before any LLM call.
 *
 * These cover the failure modes that are mechanical rather than semantic — a
 * model wrapping output in a code fence, dropping the closing tag, or using
 * smart quotes. Each is a few microseconds; the LLM alternative is a network
 * round trip. They also apply to `correctedPlantuml` pasted by a user, which is
 * where fences and curly quotes most often come from.
 */
export const AUTO_FIXES: AutoFix[] = [
  {
    name: 'strip-code-fence',
    apply: (source) => {
      if (!/^\s*```/m.test(source)) return null;
      return source
        .replace(/^\s*```[a-zA-Z]*\s*$/gm, '')
        .replace(/^\s*```\s*$/gm, '')
        .trim();
    },
  },
  {
    name: 'strip-prose-around-diagram',
    apply: (source) => {
      const start = source.search(/^\s*@start\w+/m);
      const endMatch = source.match(/^\s*@end\w+.*$/m);
      if (start === -1 || !endMatch || endMatch.index === undefined) return null;
      const end = endMatch.index + endMatch[0].length;
      if (start === 0 && end === source.trimEnd().length) return null;
      return source.slice(start, end).trim();
    },
  },
  {
    name: 'append-missing-end-tag',
    apply: (source) => {
      const start = source.match(/^\s*@start(\w+)/m);
      if (!start) return null;
      if (new RegExp(`^\\s*@end${start[1]}\\b`, 'm').test(source)) return null;
      return `${source.trimEnd()}\n@end${start[1]}\n`;
    },
  },
  {
    name: 'normalise-smart-quotes',
    apply: (source) => {
      if (!/[‘’“”]/.test(source)) return null;
      return source.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    },
  },
  {
    name: 'drop-banned-directives',
    apply: (source) => {
      const pattern = /^\s*(!include(url|sub)?|!import|%invoke)\b.*$/gim;
      if (!pattern.test(source)) return null;
      return source.replace(/^\s*(!include(url|sub)?|!import|%invoke)\b.*$/gim, '').replace(/\n{3,}/g, '\n\n');
    },
  },
];

export interface AutoFixOutcome {
  source: string;
  applied: string[];
}

/** Runs every applicable fix once, in order. */
export function autoFix(source: string): AutoFixOutcome {
  let current = source;
  const applied: string[] = [];
  for (const fix of AUTO_FIXES) {
    const result = fix.apply(current);
    if (result !== null && result !== current) {
      current = result;
      applied.push(fix.name);
    }
  }
  return { source: current, applied };
}
