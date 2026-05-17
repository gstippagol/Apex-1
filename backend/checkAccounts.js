const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const admin = await User.findOne({ email: 'admin@apex.com' }).lean();
    const student = await User.findOne({ email: 'gstippagol2005@gmail.com' }).lean();
    console.log('admin', !!admin, admin ? admin.role : null);
    console.log('student', !!student, student ? student.role : null);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
