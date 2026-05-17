const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, '../.env') });

const testLogin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Database Connected...');

        const email = 'admin@apex.com';
        const password = 'admin123';

        const user = await User.findOne({ email }).select('+password');
        
        if (!user) {
            console.log('FAIL: User not found in database');
            process.exit(1);
        }

        console.log('User found:', user.email);
        console.log('User Role:', user.role);
        console.log('Is Active:', user.isActive);
        console.log('Is Eliminated:', user.isEliminated);

        const isMatch = await bcrypt.compare(password, user.password);
        
        if (isMatch) {
            console.log('SUCCESS: Password matches hashed value in DB');
        } else {
            console.log('FAIL: Password does not match');
            console.log('Entered Password:', password);
            console.log('Hashed Password in DB:', user.password);
        }

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

testLogin();
