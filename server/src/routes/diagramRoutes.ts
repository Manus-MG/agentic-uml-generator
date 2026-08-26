import { Router } from 'express';
import { getDiagramTypes } from '../controllers/diagramController.js';
import { generate, listDiagrams, switchView } from '../controllers/generateController.js';

const router = Router();

// Static segments first: '/types' must not be swallowed by '/:sessionId'.
router.get('/types', getDiagramTypes);

// Case 1 (new session) and case 2 (existing session, updated prompt) share this route.
router.post('/generate/:sessionId', generate);

// A different view of the model already stored — usually zero LLM calls.
router.post('/switch-view/:sessionId', switchView);

router.get('/:sessionId', listDiagrams);

export default router;
