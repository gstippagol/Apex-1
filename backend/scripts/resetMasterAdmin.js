const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const resetMasterAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        const admin = await User.findOne({ email: 'admin@apex.com' });
        if (admin) {
            admin.password = 'admin123';
            admin.role = 'superadmin';
            admin.isActive = true;
            admin.isEliminated = false;
            await admin.save();
            console.log('Master Admin (admin@apex.com) has been reset to Super Admin with password: admin123');
        } else {
            await User.create({
                name: 'Apex Master Admin',
                email: 'admin@apex.com',
                password: 'admin123',
                role: 'superadmin',
                department: 'CORE',
                usn: 'ADMIN-000',
                mobileNumber: '+910000000000'
            });
            console.log('Master Admin (admin@apex.com) created as Super Admin with password: admin123');
        }
        
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

resetMasterAdmin();
