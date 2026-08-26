import fs from 'node:fs/promises';
import path from 'node:path';
import type { PlantUmlBackend, RenderResult, ValidationResult } from '../../src/plantuml/types.js';

/**
 * A PlantUML backend that agrees with anything and writes a one-pixel PNG.
 *
 * Route tests are about the HTTP and persistence layers; whether the jar likes
 * a given source is what `projectors.test.ts` covers, with the real jar.
 */
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export class FakePlantUmlBackend implements PlantUmlBackend {
  readonly name = 'jar' as const;
  readonly rendered: string[] = [];

  async available(): Promise<boolean> {
    return true;
  }

  async verify(): Promise<ValidationResult> {
    return { valid: true, errors: [] };
  }

  async render(_source: string, outPath: string): Promise<RenderResult> {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, ONE_PIXEL_PNG);
    this.rendered.push(outPath);
    return { pngPath: outPath, bytes: ONE_PIXEL_PNG.length };
  }

  async renderSvg(): Promise<string> {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
  }
}
