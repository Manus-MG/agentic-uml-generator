import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { badRequest, notFound } from '../lib/httpError.js';

/**
 * Serves a rendered PNG.
 *
 * Both path segments are resolved and then checked to still be inside the
 * output root. The Python original passed the caller's filename straight to
 * `os.path.join`, which happily walks out of the directory — `../../.env` was a
 * readable file over HTTP. That behaviour is not carried over.
 */
export function serveDiagram(req: Request, res: Response): void {
  const { session, filename } = req.params as { session: string; filename: string };

  if (!/^[A-Za-z0-9._-]+$/.test(session) || !/^[A-Za-z0-9._-]+\.png$/.test(filename)) {
    throw badRequest('Invalid diagram path');
  }

  const root = path.resolve(env().outputRoot);
  const target = path.resolve(root, session, filename);
  if (target !== path.join(root, session, filename) || !target.startsWith(root + path.sep)) {
    throw badRequest('Invalid diagram path');
  }

  if (!fs.existsSync(target)) throw notFound('Diagram image not found');

  res.type('image/png');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  fs.createReadStream(target).pipe(res);
}
