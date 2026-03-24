import express from 'express';
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  getCustomerOrders,
  getUserMoodInsights,
} from '../controllers/orderController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.post('/', createOrder);
router.get('/', getAllOrders);
router.get('/customer/:customerId', getCustomerOrders);
router.get('/mood-insights', getUserMoodInsights);
router.get('/:id', getOrderById);
router.put('/:id/status', updateOrderStatus);

export default router;
