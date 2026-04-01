import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from './models/User.js';

dotenv.config();

const createStaffUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const email = 'staff@gmail.com';

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      await User.deleteOne({ email });
      console.log('Existing staff user removed');
    }

    const passwordHash = await bcrypt.hash('staff', 10);
    await User.collection.insertOne({
      name: 'staff@gmail.com',
      email,
      password: passwordHash,
      role: 'staff',
      isApproved: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('Staff user created successfully');
    console.log('Name: staff@gmail.com');
    console.log('Email:', email);
    console.log('Password: staff');

    process.exit(0);
  } catch (error) {
    console.error('Error creating staff user:', error.message);
    process.exit(1);
  }
};

createStaffUser();
