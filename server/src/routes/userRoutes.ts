import { Router } from 'express';
import { getUser, identifyUser, listUsers } from '../controllers/userController.js';

const router = Router();

router.post('/identify', identifyUser);
router.get('/', listUsers);
router.get('/:userId', getUser);

export default router;
