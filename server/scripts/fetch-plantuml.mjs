#!/usr/bin/env node
/**
 * Downloads a pinned plantuml.jar into server/vendor/.
 *
 * Pinned rather than "latest" on purpose: the jar is the authority that decides
 * whether our generated diagrams are valid, so an unannounced upgrade could
 * change the pass/fail verdict of the whole test suite between two runs on the
 * same commit.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '1.2026.7';
const URL = `https://github.com/plantuml/plantuml/releases/download/v${VERSION}/plantuml-${VERSION}.jar`;

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, '..', 'vendor', 'plantuml.jar');
const stamp = `${target}.version`;

if (fs.existsSync(target) && fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8').trim() === VERSION) {
  console.log(`plantuml.jar ${VERSION} already present at ${target}`);
  process.exit(0);
}

console.log(`Downloading PlantUML ${VERSION}…`);
const response = await fetch(URL, { redirect: 'follow' });
if (!response.ok) {
  console.error(`Download failed: ${response.status} ${response.statusText}\n  ${URL}`);
  process.exit(1);
}

const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.length < 1_000_000) {
  console.error(`Refusing to write a suspiciously small jar (${bytes.length} bytes)`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, bytes);
fs.writeFileSync(stamp, `${VERSION}\n`);

const sha = createHash('sha256').update(bytes).digest('hex');
console.log(`Wrote ${target}`);
console.log(`  version ${VERSION}`);
console.log(`  size    ${(bytes.length / 1e6).toFixed(1)} MB`);
console.log(`  sha256  ${sha}`);
