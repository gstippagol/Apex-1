const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const users = [
  {
    name: 'Demo Admin',
    email: 'admin@apex.com',
    password: 'admin123',
    role: 'admin'
  },
  {
    name: 'Demo Student',
    email: 'student@apex.com',
    password: 'student123',
    role: 'student'
  }
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Delete existing demo users to avoid duplicates
    await User.deleteMany({ email: { $in: ['admin@apex.com', 'student@apex.com'] } });

    // Create new users
    await User.create(users);

    console.log('Database Seeded Successfully!');
    process.exit();
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
};

seedDB();
