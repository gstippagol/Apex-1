const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const createSuperAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Database Connected...');

        const superAdminData = {
            name: 'Apex Super Admin',
            email: 'super@apex.com',
            password: 'superpassword123',
            role: 'superadmin',
            department: 'CORE-CONTROL',
            usn: 'SUPER-001',
            mobileNumber: '+919999999999'
        };

        const existing = await User.findOne({ email: superAdminData.email });
        if (existing) {
            existing.role = 'superadmin';
            existing.password = superAdminData.password; // Will be hashed by pre-save hook
            await existing.save();
            console.log('Existing account upgraded to Super Admin');
        } else {
            await User.create(superAdminData);
            console.log('New Super Admin account created');
        }

        console.log('\n-----------------------------------');
        console.log('SUPER ADMIN CREDENTIALS');
        console.log('Email: super@apex.com');
        console.log('Password: superpassword123');
        console.log('-----------------------------------\n');

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

createSuperAdmin();
