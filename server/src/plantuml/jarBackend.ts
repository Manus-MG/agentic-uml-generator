import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { env } from '../config/env.js';
import type { PlantUmlBackend, RenderResult, ValidationError, ValidationResult } from './types.js';

const run = promisify(execFile);

/**
 * PlantUML errors carry a line number in a few shapes depending on where the
 * parser gave up, e.g.
 *   "Error line 12 in file: /tmp/x.puml"
 *   "(Error) line 12"
 */
const LINE_PATTERNS = [/error\s+line\s+(\d+)/i, /\bline\s+(\d+)\b/i];

function parseErrors(output: string): ValidationError[] {
  const lines = output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !/^\s*$/.test(l));

  if (lines.length === 0) {
    return [{ message: 'PlantUML rejected the diagram without describing why', line: null }];
  }

  let line: number | null = null;
  for (const pattern of LINE_PATTERNS) {
    const match = output.match(pattern);
    if (match) {
      line = Number.parseInt(match[1]!, 10);
      break;
    }
  }

  // The first line that is not boilerplate is the useful description.
  const message =
    lines.find((l) => !/^(some diagram description contains errors|no diagram found)$/i.test(l)) ??
    lines[0]!;

  return [{ message, line }];
}

/**
 * Validation and rendering by invoking the pinned plantuml.jar.
 *
 * This is the authority on whether a diagram is valid — not the model's
 * assertion, and not our own lint. `-failfast2` runs a checking pass first and
 * aborts before any rendering work, which is both the fastest way to reject a
 * bad source and the reason `verify()` is cheap enough to run on every diagram.
 *
 * The JVM runs with PlantUML's SANDBOX security profile so that even a source
 * that slipped past `staticLint` cannot read local files or reach the network.
 */
export class JarBackend implements PlantUmlBackend {
  readonly name = 'jar' as const;

  private javaArgs(): string[] {
    return [
      `-Xmx${env().JAVA_MAX_HEAP}`,
      '-Djava.awt.headless=true',
      '-DPLANTUML_SECURITY_PROFILE=SANDBOX',
      '-jar',
      env().jarPath,
    ];
  }

  /**
   * Checks the whole path — java, the jar, and the security profile — by
   * verifying a trivial diagram.
   *
   * Not `-version`: under `PLANTUML_SECURITY_PROFILE=SANDBOX` that prints the
   * version and then exits 16, so it reports a perfectly working install as
   * broken. Checking a real diagram tests what callers actually rely on.
   */
  async available(): Promise<boolean> {
    try {
      await fs.access(env().jarPath);
      const result = await this.verify('@startuml\nA -> B: ok\n@enduml');
      return result.valid;
    } catch {
      return false;
    }
  }

  async verify(source: string): Promise<ValidationResult> {
    const file = await this.writeTemp(source);
    try {
      await run(
        env().JAVA_BIN,
        [...this.javaArgs(), '-failfast2', '-checkonly', '-charset', 'UTF-8', file],
        { timeout: env().PLANTUML_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
      );
      return { valid: true, errors: [] };
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string; killed?: boolean };
      if (e.killed) {
        return {
          valid: false,
          errors: [{ message: `PlantUML timed out after ${env().PLANTUML_TIMEOUT_MS}ms`, line: null }],
        };
      }
      return { valid: false, errors: parseErrors(`${e.stderr ?? ''}\n${e.stdout ?? ''}`) };
    } finally {
      await fs.rm(path.dirname(file), { recursive: true, force: true });
    }
  }

  async render(source: string, outPath: string): Promise<RenderResult> {
    const file = await this.writeTemp(source);
    const outDir = path.dirname(outPath);
    await fs.mkdir(outDir, { recursive: true });

    try {
      await run(
        env().JAVA_BIN,
        [...this.javaArgs(), '-tpng', '-charset', 'UTF-8', '-o', outDir, file],
        { timeout: env().PLANTUML_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 },
      );

      // PlantUML names the output after the input file, so move it into place.
      const produced = path.join(outDir, `${path.basename(file, '.puml')}.png`);
      await fs.rename(produced, outPath);
      const stat = await fs.stat(outPath);
      return { pngPath: outPath, bytes: stat.size };
    } finally {
      await fs.rm(path.dirname(file), { recursive: true, force: true });
    }
  }

  async renderSvg(source: string): Promise<string> {
    const file = await this.writeTemp(source);
    const outDir = path.dirname(file);

    try {
      await run(
        env().JAVA_BIN,
        [...this.javaArgs(), '-tsvg', '-charset', 'UTF-8', '-o', outDir, file],
        { timeout: env().PLANTUML_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 },
      );
      const produced = path.join(outDir, `${path.basename(file, '.puml')}.svg`);
      return await fs.readFile(produced, 'utf8');
    } finally {
      await fs.rm(path.dirname(file), { recursive: true, force: true });
    }
  }

  /** Each call gets its own directory so concurrent renders cannot collide. */
  private async writeTemp(source: string): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'umlgen-'));
    const file = path.join(dir, `${randomUUID()}.puml`);
    await fs.writeFile(file, source, 'utf8');
    return file;
  }
}
