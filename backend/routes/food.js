import express from 'express';
import {
  getAllFoodItems,
  createFoodItem,
  updateFoodItem,
  deleteFoodItem,
} from '../controllers/foodController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Public route to get all food items
router.get('/', getAllFoodItems);

// Admin only routes
router.post('/', protect, adminOnly, createFoodItem);
router.put('/:id', protect, adminOnly, updateFoodItem);
router.delete('/:id', protect, adminOnly, deleteFoodItem);

export default router;
