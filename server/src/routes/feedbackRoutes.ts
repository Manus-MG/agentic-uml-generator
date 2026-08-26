import { Router } from 'express';
import { exportFeedback, submitFeedback } from '../controllers/feedbackController.js';

const router = Router();

router.post('/', submitFeedback);

// The RL training set. Optional ?sessionId= narrows it to one conversation.
router.get('/export', exportFeedback);

export default router;
