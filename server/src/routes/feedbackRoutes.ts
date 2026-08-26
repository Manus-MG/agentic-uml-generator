import { Router } from 'express';
import { exportFeedback } from '../controllers/feedbackController.js';

const router = Router();

// The RL training set. Optional ?sessionId= narrows it to one conversation.
// Feedback itself is captured automatically by the pipeline (see
// server/src/agent/implicitSignals.ts) — there is nothing left for a client to submit.
router.get('/export', exportFeedback);

export default router;
