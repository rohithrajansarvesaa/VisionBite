import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide customer name'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Please provide phone number'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide email'],
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email',
      ],
    },
    faceDescriptor: {
      type: [Number],
      required: [true, 'Face descriptor is required'],
    },
    preferences: {
      type: [String],
      default: [],
    },
    dietaryRestrictions: {
      type: [String],
      default: [],
    },
    enrolledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastVisit: {
      type: Date,
      default: Date.now,
    },
    visitCount: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

// Index for faster searching
customerSchema.index({ name: 'text' });


const Customer = mongoose.model('Customer', customerSchema);

export default Customer;
