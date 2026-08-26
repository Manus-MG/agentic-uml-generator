import pLimit from 'p-limit';
import { env } from '../config/env.js';
import { JarBackend } from './jarBackend.js';
import { ServerBackend } from './serverBackend.js';
import { staticLint, type LintOptions } from './staticLint.js';
import type { PlantUmlBackend, RenderResult, ValidationResult } from './types.js';

export { autoFix, AUTO_FIXES } from './autoFix.js';
export { staticLint } from './staticLint.js';
export { encodePlantUml } from './serverBackend.js';
export type { PlantUmlBackend, RenderResult, ValidationError, ValidationResult } from './types.js';

let backend: PlantUmlBackend | null = null;
let limit: ReturnType<typeof pLimit> | null = null;

export function getBackend(): PlantUmlBackend {
  if (!backend) {
    backend = env().PLANTUML_BACKEND === 'server' ? new ServerBackend() : new JarBackend();
  }
  return backend;
}

/** Test seam. */
export function setBackend(next: PlantUmlBackend | null): void {
  backend = next;
}

/**
 * Rendering is CPU- and memory-hungry (a JVM per call on the jar backend), so
 * it is capped independently of how many diagrams the graph fans out to.
 * Without this, a ten-diagram run starts ten JVMs at once and the box thrashes.
 */
function gate(): ReturnType<typeof pLimit> {
  if (!limit) limit = pLimit(env().DIAGRAM_CONCURRENCY);
  return limit;
}

/**
 * Full validation: cheap structural lint first, the engine only if it passes.
 *
 * The ordering matters for latency. Static lint runs in microseconds and
 * catches fences, unbalanced brackets and banned directives; only sources that
 * survive it are worth a JVM round trip.
 */
export async function validate(source: string, options: LintOptions = {}): Promise<ValidationResult> {
  const lintErrors = staticLint(source, options);
  if (lintErrors.length > 0) {
    return { valid: false, errors: lintErrors };
  }
  return gate()(() => getBackend().verify(source));
}

export async function render(source: string, outPath: string): Promise<RenderResult> {
  return gate()(() => getBackend().render(source, outPath));
}

/** Same gate as `render`: on the jar backend an SVG also costs a JVM. */
export async function renderSvg(source: string): Promise<string> {
  return gate()(() => getBackend().renderSvg(source));
}
