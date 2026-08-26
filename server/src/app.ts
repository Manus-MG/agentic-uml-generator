import express, { type Application, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { dbState } from './config/db.js';
import { env } from './config/env.js';
import { LlmError } from './agent/llm/groq.js';
import { getDiagramTypes } from './controllers/diagramController.js';
import { serveDiagram } from './controllers/imageController.js';
import { HttpError } from './lib/httpError.js';
import { getBackend } from './plantuml/index.js';
import diagramRoutes from './routes/diagramRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import userRoutes from './routes/userRoutes.js';

/**
 * Builds the Express app without connecting to anything or listening.
 *
 * Kept separate from `server.ts` so tests can mount the real routes — same
 * middleware, same error mapping — without booting the process.
 */
export function createApp(): Application {
  const config = env();
  const app: Application = express();

  app.use(
    cors({
      origin: config.NODE_ENV === 'production' ? [/\.localhost$/] : ['http://localhost:5173'],
      credentials: true,
    }),
  );
  // Briefs are prose, not uploads; a megabyte is already generous.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.get('/api/health', async (_req: Request, res: Response) => {
    const plantuml = await getBackend()
      .available()
      .catch(() => false);
    const mongo = dbState();
    const ok = mongo === 'connected' && plantuml;

    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      message: ok ? 'Backend server is up and running' : 'Backend server is up with degraded dependencies',
      timestamp: new Date().toISOString(),
      checks: {
        mongo,
        plantuml: plantuml
          ? `${getBackend().name} backend reachable`
          : `${getBackend().name} backend unavailable`,
        groq: config.GROQ_API_KEY ? 'configured' : 'missing',
        model: config.MODEL_PRIMARY,
      },
    });
  });

  app.use('/api/users', userRoutes);
  app.use('/api/diagrams', diagramRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.get('/api/diagram/:session/:filename', serveDiagram);

  // Returns metadata for all supported UML diagram types.
  app.get('/api/diagram-types', getDiagramTypes);

  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'UML Generator API',
      status: 'running',
      endpoints: [
        'GET  /api/health',
        'POST /api/users/identify',
        'GET  /api/users',
        'GET  /api/users/:userId',
        'GET  /api/diagram-types',
        'POST /api/diagrams/generate/:sessionId',
        'POST /api/diagrams/switch-view/:sessionId',
        'GET  /api/diagrams/:sessionId?version=N',
        'GET  /api/sessions?userId=...',
        'GET  /api/sessions/:sessionId',
        'GET  /api/sessions/:sessionId/model',
        'DELETE /api/sessions/:sessionId',
        'GET  /api/diagram/:session/:filename',
        'GET  /api/feedback/export',
      ],
    });
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, message: 'Not found' });
  });

  /**
   * One place decides status codes.
   *
   * `LlmError` already classifies itself — a rate limit is not a bad request
   * and must not be reported as one — so this is a lookup, not a guess.
   */
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;

    if (error instanceof HttpError) {
      res.status(error.status).json({ success: false, message: error.message, detail: error.detail });
      return;
    }

    if (error instanceof LlmError) {
      const status =
        error.kind === 'auth' ? 401
        : error.kind === 'rate-limit' ? 429
        : error.kind === 'bad-request' || error.kind === 'too-large' ? 400
        : 502;
      if (status === 429) res.setHeader('Retry-After', '60');
      res.status(status).json({ success: false, message: error.message, kind: error.kind });
      return;
    }

    console.error('Unhandled error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unexpected server error',
    });
  });

  return app;
}
