import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const createCustomerUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const email = 'logini@visionbite.com';

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      await User.deleteOne({ email });
      console.log('Existing customer user removed');
    }

    const user = await User.create({
      name: 'logini',
      email,
      password: 'logini',
      role: 'user',
      isApproved: true,
    });

    console.log('Customer user created successfully');
    console.log('Name:', user.name);
    console.log('Email:', user.email);
    console.log('Password: logini');

    process.exit(0);
  } catch (error) {
    console.error('Error creating customer user:', error.message);
    process.exit(1);
  }
};

createCustomerUser();
