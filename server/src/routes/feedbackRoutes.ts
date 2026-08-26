import { Router } from 'express';
import { exportFeedback, listFeedback, submitFeedback } from '../controllers/feedbackController.js';

const router = Router();

router.post('/', submitFeedback);

// Ratings already given, so a reload does not forget them. Requires ?sessionId=.
router.get('/', listFeedback);

// The RL training set. Optional ?sessionId= narrows it to one conversation.
router.get('/export', exportFeedback);

export default router;
