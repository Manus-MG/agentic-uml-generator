import { Router } from 'express';
import {
  deleteSession,
  getCanonicalModel,
  getSession,
  listSessions,
} from '../controllers/sessionController.js';

const router = Router();

// Express matches in order, so the index route has to come before `/:sessionId`
// or "sessions" would be read as a session id.
router.get('/', listSessions);
router.get('/:sessionId', getSession);
router.delete('/:sessionId', deleteSession);
router.get('/:sessionId/model', getCanonicalModel);

export default router;
