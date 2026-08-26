import { Router } from 'express';
import { deleteSession, getCanonicalModel, getSession } from '../controllers/sessionController.js';

const router = Router();

router.get('/:sessionId', getSession);
router.delete('/:sessionId', deleteSession);
router.get('/:sessionId/model', getCanonicalModel);

export default router;
