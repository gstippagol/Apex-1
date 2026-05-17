const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const resetAdminPassword = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const user = await User.findOne({ email: 'admin@apex.com' });
        if (user) {
            user.password = 'password123';
            await user.save();
            console.log('Admin password reset to password123');
        } else {
            console.log('Admin user not found');
        }
        
        // Also set a student password
        const student = await User.findOne({ email: 'gstippagol2005@gmail.com' });
        if (student) {
            student.password = 'password123';
            await student.save();
            console.log('Student password reset to password123');
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

resetAdminPassword();
