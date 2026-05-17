const mongoose = require('mongoose');
const path = require('path');
const User = require('./models/User');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const createAccounts = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    await User.deleteMany({ email: { $in: ['admin@apex.com', 'gstippagol2005@gmail.com'] } });

    await User.create({
      name: 'System Admin',
      email: 'admin@apex.com',
      password: 'admin123',
      role: 'admin',
      department: 'ADMINCORE',
      usn: 'ADMIN-SITE-SECURE',
      mobileNumber: '+919999999999'
    });

    await User.create({
      name: 'Gopal',
      email: 'gstippagol2005@gmail.com',
      password: 'Gopal123',
      role: 'student',
      department: 'CSE',
      usn: 'GSTI2025001',
      mobileNumber: '+919876543210'
    });

    console.log('Created admin@apex.com / admin123 and gstippagol2005@gmail.com / Gopal123');
    process.exit(0);
  } catch (err) {
    console.error('Error creating accounts:', err);
    process.exit(1);
  }
};

createAccounts();
