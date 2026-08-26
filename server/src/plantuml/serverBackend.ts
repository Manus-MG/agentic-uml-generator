import fs from 'node:fs/promises';
import path from 'node:path';
import { deflateRaw } from 'node:zlib';
import { promisify } from 'node:util';
import { env } from '../config/env.js';
import type { PlantUmlBackend, RenderResult, ValidationResult } from './types.js';

const deflate = promisify(deflateRaw);

/** PlantUML's custom base64 alphabet — not the standard one. */
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

function encode64(data: Buffer): string {
  let out = '';
  for (let i = 0; i < data.length; i += 3) {
    const b1 = data[i]!;
    const b2 = i + 1 < data.length ? data[i + 1]! : 0;
    const b3 = i + 2 < data.length ? data[i + 2]! : 0;
    out += ALPHABET[b1 >> 2];
    out += ALPHABET[((b1 & 0x3) << 4) | (b2 >> 4)];
    out += ALPHABET[((b2 & 0xf) << 2) | (b3 >> 6)];
    out += ALPHABET[b3 & 0x3f];
  }
  return out;
}

/** deflate + PlantUML's base64 variant, as the URL format requires. */
export async function encodePlantUml(source: string): Promise<string> {
  const compressed = await deflate(Buffer.from(source, 'utf8'), { level: 9 });
  return encode64(compressed);
}

/**
 * Validation and rendering against a running plantuml-server (the
 * `plantuml/plantuml-server:jetty` container).
 *
 * Selected with `PLANTUML_BACKEND=server`, for deployments that would rather
 * not ship a JVM in the application image. The server reports syntax errors in
 * `X-PlantUML-Diagram-Error` / `X-PlantUML-Diagram-Error-Line` response headers
 * rather than by status code alone, so those headers — not the body — are what
 * we read.
 */
export class ServerBackend implements PlantUmlBackend {
  readonly name = 'server' as const;

  private url(format: 'png' | 'svg', encoded: string): string {
    return `${env().PLANTUML_SERVER_URL.replace(/\/$/, '')}/${format}/${encoded}`;
  }

  async available(): Promise<boolean> {
    try {
      const encoded = await encodePlantUml('@startuml\nA -> B\n@enduml');
      const response = await fetch(this.url('svg', encoded), {
        signal: AbortSignal.timeout(env().PLANTUML_TIMEOUT_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async verify(source: string): Promise<ValidationResult> {
    const encoded = await encodePlantUml(source);
    const response = await fetch(this.url('svg', encoded), {
      signal: AbortSignal.timeout(env().PLANTUML_TIMEOUT_MS),
    });

    const error = response.headers.get('X-PlantUML-Diagram-Error');
    if (error) {
      const rawLine = response.headers.get('X-PlantUML-Diagram-Error-Line');
      const line = rawLine ? Number.parseInt(rawLine, 10) : null;
      return { valid: false, errors: [{ message: error, line: Number.isFinite(line) ? line : null }] };
    }
    if (!response.ok) {
      return {
        valid: false,
        errors: [{ message: `PlantUML server returned ${response.status} ${response.statusText}`, line: null }],
      };
    }
    return { valid: true, errors: [] };
  }

  async render(source: string, outPath: string): Promise<RenderResult> {
    const encoded = await encodePlantUml(source);
    const response = await fetch(this.url('png', encoded), {
      signal: AbortSignal.timeout(env().PLANTUML_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`PlantUML server render failed: ${response.status} ${response.statusText}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, bytes);
    return { pngPath: outPath, bytes: bytes.length };
  }

  async renderSvg(source: string): Promise<string> {
    const encoded = await encodePlantUml(source);
    const response = await fetch(this.url('svg', encoded), {
      signal: AbortSignal.timeout(env().PLANTUML_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`PlantUML server SVG render failed: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }
}
