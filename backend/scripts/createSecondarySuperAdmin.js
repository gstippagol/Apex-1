const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const createNewSuperAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Database Connected...');

        const superAdminData = {
            name: 'Primary System Overlord',
            email: 'superadmin@apex.com',
            password: 'superadminpassword',
            role: 'superadmin',
            department: 'SYSTEM-OPERATIONS',
            usn: 'SUPER-002',
            mobileNumber: '+918888888888'
        };

        const existing = await User.findOne({ email: superAdminData.email });
        if (existing) {
            existing.role = 'superadmin';
            existing.password = superAdminData.password;
            await existing.save();
            console.log('Existing account updated to Super Admin');
        } else {
            await User.create(superAdminData);
            console.log('New Super Admin account created');
        }

        console.log('\n-----------------------------------');
        console.log('NEW SUPER ADMIN CREDENTIALS');
        console.log('Email: superadmin@apex.com');
        console.log('Password: superadminpassword');
        console.log('-----------------------------------\n');

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

createNewSuperAdmin();
