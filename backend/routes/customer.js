import express from 'express';
import {
  enrollCustomer,
  getAllCustomers,
  matchCustomer,
  matchCustomersBatch,
  recognizeCustomer,
  recognizeCustomersBatch,
  getRecommendations,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customerController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public customer recognition
router.post('/recognize', recognizeCustomer);
router.post('/recognize-group', recognizeCustomersBatch);
router.post('/match', matchCustomer);
router.post('/match-group', matchCustomersBatch);
router.post('/recommendations', getRecommendations);

// All enrollment/management routes require authentication
router.use(protect);

router.post('/enroll', enrollCustomer);
router.get('/', getAllCustomers);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

export default router;
