import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },
    userAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    items: [
      {
        foodItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'FoodItem',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'preparing', 'ready', 'served', 'completed', 'cancelled'],
      default: 'pending',
    },
    detectedMood: {
      type: String,
      enum: ['happy', 'sad', 'neutral', 'angry', 'surprised', 'fearful', 'disgusted'],
    },
    notes: {
      type: String,
    },
    servedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

orderSchema.pre('validate', function (next) {
  if (!this.customer && !this.userAccount) {
    this.invalidate('customer', 'Order must belong to a customer or a user account');
  }
  next();
});

const Order = mongoose.model('Order', orderSchema);

export default Order;
